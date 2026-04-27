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
$helperReady = $true
foreach ($property in $helperTools.PSObject.Properties) {
  if ($property.Value.result -ne 'ready') {
    $helperReady = $false
    break
  }
}
$baselineReady = ($toolsReady -and $helperReady)

$nextActions = New-Object System.Collections.Generic.List[string]
foreach ($action in @($Facts.next_actions)) {
  if (-not [string]::IsNullOrWhiteSpace($action) -and -not $nextActions.Contains($action)) {
    $nextActions.Add($action)
  }
}
foreach ($property in $helperTools.PSObject.Properties) {
  $helperAction = $property.Value.next_action
  if (-not [string]::IsNullOrWhiteSpace($helperAction) -and -not $nextActions.Contains($helperAction)) {
    $nextActions.Add($helperAction)
  }
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

function Format-Cell {
  param([object]$Value)
  if ($null -eq $Value) { return 'n/a' }
  $text = [string]$Value
  if ([string]::IsNullOrWhiteSpace($text)) { return 'n/a' }
  return $text
}

function Format-Required {
  param([object]$Value)
  if ($null -eq $Value) { return 'n/a' }
  if ([bool]$Value) { return 'yes' }
  return 'no'
}

function Format-Query {
  param([object]$Value)
  if ($null -eq $Value) { return 'n/a' }
  if ([bool]$Value) { return 'ready' }
  return 'pending'
}

function Write-StatusRow {
  param(
    [string]$Name,
    [string]$Type,
    [string]$Required,
    [string]$Dependency,
    [string]$HostConfig,
    [string]$Project,
    [string]$Query,
    [string]$Next
  )
  Write-Host ("  {0,-24} {1,-16} {2,-8} {3,-16} {4,-16} {5,-16} {6,-10} {7}" -f $Name, $Type, $Required, $Dependency, $HostConfig, $Project, $Query, $Next)
}

Write-Host "📝 宿主就绪标记已更新: $MarkerPath"
Write-Host "🔎 当前宿主基线状态: $($combined.overall_status)"
Write-Host "🧭 baseline_ready: $($combined.baseline_ready)"
Write-Host '🧩 Graph providers are configured but not query-ready yet.'
Write-Host '✅ readiness ledger v2 已写入'
Write-Host ''
Write-Host 'Required Harness Runtime status:'
Write-StatusRow 'Name' 'Type' 'Required' 'Dependency' 'Host' 'Project' 'Query' 'Next'
Write-StatusRow '----' '----' '--------' '----------' '----' '-------' '-----' '----'
foreach ($property in $combined.tools.PSObject.Properties) {
  $tool = $property.Value
  Write-StatusRow `
    (Format-Cell $property.Name) `
    (Format-Cell $tool.type) `
    (Format-Required $tool.required) `
    (Format-Cell $tool.dependency_status) `
    (Format-Cell $tool.host_config_status) `
    (Format-Cell $tool.project_status) `
    (Format-Query $tool.query_ready) `
    (Format-Cell $tool.next_action)
}
foreach ($property in $combined.helper_tools.PSObject.Properties) {
  $helper = $property.Value
  Write-StatusRow `
    (Format-Cell $property.Name) `
    (Format-Cell $(if ($helper.PSObject.Properties.Name -contains 'type') { $helper.type } else { 'helper' })) `
    (Format-Required $helper.required) `
    (Format-Cell $helper.dependency_status) `
    (Format-Cell $helper.host_config_status) `
    (Format-Cell $helper.project_status) `
    'n/a' `
    (Format-Cell $helper.next_action)
}
$projectionNext = if ($combined.repo_config_status -eq 'ready') { '' } else { 'write provider projection' }
Write-StatusRow `
  'graph-providers.json' `
  'project' `
  'yes' `
  'n/a' `
  'n/a' `
  (Format-Cell $combined.repo_config_status) `
  'n/a' `
  (Format-Cell $projectionNext)

switch ($combined.host) {
  'claude' {
    $hostDisplay = 'Claude Code'
    $setupCommand = '/spec:mcp-setup'
    $graphCommand = '/spec:graph-bootstrap'
  }
  'codex' {
    $hostDisplay = 'Codex'
    $setupCommand = '$spec-mcp-setup'
    $graphCommand = '$spec-graph-bootstrap'
  }
  default {
    $hostDisplay = 'Claude Code / Codex'
    $setupCommand = '/spec:mcp-setup or $spec-mcp-setup'
    $graphCommand = '/spec:graph-bootstrap or $spec-graph-bootstrap'
  }
}

Write-Host ''
Write-Host 'Next steps:'
if ($combined.baseline_ready) {
  if ($combined.graph_bootstrap_required) {
    Write-Host "  1. Continue graph bootstrap: run $graphCommand, or reply `"继续完成`" and the agent should run it."
    Write-Host "  2. Restart $hostDisplay or start a new session before relying on the newly written MCP config in downstream workflows."
  } else {
    Write-Host "  1. Restart $hostDisplay or start a new session before relying on the newly written MCP config in downstream workflows."
  }
} else {
  Write-Host "  1. Resolve the action-required rows above, then rerun $setupCommand."
  Write-Host "  2. Restart $hostDisplay after all rows are ready so the newly written MCP config is loaded."
}
