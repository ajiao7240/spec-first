param(
  [switch]$NoInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$HostInfo = & (Join-Path $ScriptDir 'detect-host.ps1') | ConvertFrom-Json
$MarkerPath = $HostInfo.marker_path
$MarkerDir = Split-Path -Parent $MarkerPath
$Facts = & (Join-Path $ScriptDir 'detect-tools.ps1') | ConvertFrom-Json
$HelperFacts = & (Join-Path $ScriptDir 'install-helpers.ps1') -VerifyOnly | ConvertFrom-Json

function Test-ToolReady {
  param([object]$Tool)
  return (
    $Tool.dependency_status -eq 'ready' -and
    ($Tool.host_config_status -eq 'ready' -or $Tool.host_config_status -eq 'fallback-active') -and
    ($Tool.project_status -eq 'ready' -or $Tool.project_status -eq 'not-applicable')
  )
}

$toolsReady = $true
foreach ($property in $Facts.tools.PSObject.Properties) {
  if (-not (Test-ToolReady -Tool $property.Value)) {
    $toolsReady = $false
    break
  }
}

$helperTools = $HelperFacts.helper_tools
$helperReady = ($helperTools.'agent-browser'.result -eq 'ready')
$baselineReady = ($toolsReady -and $helperReady)

$nextActions = New-Object System.Collections.Generic.List[string]
foreach ($action in @($Facts.next_actions)) {
  if (-not [string]::IsNullOrWhiteSpace($action) -and -not $nextActions.Contains($action)) {
    $nextActions.Add($action)
  }
}
$helperAction = $helperTools.'agent-browser'.next_action
if (-not [string]::IsNullOrWhiteSpace($helperAction) -and -not $nextActions.Contains($helperAction)) {
  $nextActions.Add($helperAction)
}
if ($baselineReady -and -not $nextActions.Contains('run spec-graph-bootstrap')) {
  $nextActions.Add('run spec-graph-bootstrap')
}
if ($Facts.repo_status -eq 'not-git-repo' -and -not $nextActions.Contains('enter a git repo and run spec-graph-bootstrap')) {
  $nextActions.Add('enter a git repo and run spec-graph-bootstrap')
}

New-Item -ItemType Directory -Force -Path $MarkerDir | Out-Null
$combined = [ordered]@{
  schema_version = 'v2'
  host = $Facts.host
  platform = $Facts.platform
  repo_root = $Facts.repo_root
  repo_status = $Facts.repo_status
  repo_config_status = 'pending'
  repo_config_path = $null
  overall_status = if ($baselineReady) { 'ready' } else { 'action-required' }
  baseline_ready = [bool]$baselineReady
  host_runtime_ready = [bool]$baselineReady
  graph_bootstrap_required = $true
  completed_at = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
  tools = $Facts.tools
  graph_providers = $Facts.graph_providers
  helper_tools = $helperTools
  next_actions = @($nextActions)
}

$combinedTmp = Join-Path $MarkerDir ("readiness-ledger-combined.{0}.tmp" -f ([guid]::NewGuid().ToString('N')))
$finalTmp = Join-Path $MarkerDir ("readiness-ledger.{0}.tmp" -f ([guid]::NewGuid().ToString('N')))
$combined | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $combinedTmp

$providerResult = & (Join-Path $ScriptDir 'write-provider-config.ps1') -FactsFile $combinedTmp | ConvertFrom-Json
$combined.repo_config_status = $providerResult.repo_config_status
$combined.repo_config_path = $providerResult.repo_config_path

$combined | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $finalTmp
Move-Item -Force $finalTmp $MarkerPath
Remove-Item -Force $combinedTmp -ErrorAction SilentlyContinue

Write-Host "📝 宿主就绪标记已更新: $MarkerPath"
Write-Host "🔎 当前宿主基线状态: $($combined.overall_status)"
Write-Host "🧭 baseline_ready: $($combined.baseline_ready)"
Write-Host '🧩 Graph providers are configured but not query-ready yet.'
Write-Host '✅ readiness ledger v2 已写入'
