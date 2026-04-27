param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$HostInfo = & (Join-Path $ScriptDir 'detect-host.ps1') | ConvertFrom-Json
$MarkerPath = $HostInfo.marker_path
$MarkerDir = Split-Path -Parent $MarkerPath
$Facts = & (Join-Path $ScriptDir 'detect-tools.ps1') | ConvertFrom-Json

$HelperTools = [ordered]@{}
$helperDefinitions = @(
  @{ id = 'agent-browser'; required = $true; install_command = 'CI=true npm install -g agent-browser --no-audit --no-fund --loglevel=error && agent-browser install && npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y' },
  @{ id = 'gh'; required = $false; install_command = '' },
  @{ id = 'jq'; required = $false; install_command = '' },
  @{ id = 'vhs'; required = $false; install_command = '' },
  @{ id = 'silicon'; required = $false; install_command = '' },
  @{ id = 'ffmpeg'; required = $false; install_command = '' }
)
foreach ($helper in $helperDefinitions) {
  $installed = $null -ne (Get-Command $helper.id -ErrorAction SilentlyContinue)
  $dependencyStatus = if ($installed) { 'ready' } else { 'missing' }
  $result = if ($installed) { 'ready' } elseif ($helper.required) { 'action-required' } else { 'pending' }
  $HelperTools[$helper.id] = [ordered]@{
    required = [bool]$helper.required
    dependency_status = $dependencyStatus
    host_config_status = 'not-applicable'
    project_status = 'not-applicable'
    result = $result
    next_action = if ($installed) { '' } else { $helper.install_command }
  }
}

New-Item -ItemType Directory -Force -Path $MarkerDir | Out-Null
$payload = [ordered]@{
  schema_version = 'v1'
  host = $Facts.host
  platform = $Facts.platform
  repo_root = $Facts.repo_root
  overall_status = $Facts.overall_status
  baseline_ready = [bool]$Facts.baseline_ready
  completed_at = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
  tools = $Facts.tools
  helper_tools = $HelperTools
  next_actions = @($Facts.next_actions)
}
$tempFile = Join-Path $MarkerDir ("readiness-ledger.{0}.tmp" -f ([guid]::NewGuid().ToString('N')))
$payload | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 $tempFile
Move-Item -Force $tempFile $MarkerPath
Write-Host "📝 宿主就绪标记已更新: $MarkerPath"
Write-Host "🔎 当前宿主基线状态: $($Facts.overall_status)"
Write-Host "🧭 MCP baseline_ready: $($Facts.baseline_ready)"
Write-Host '✅ readiness ledger 已写入'
