param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$HostInfo = & (Join-Path $ScriptDir 'detect-host.ps1') | ConvertFrom-Json
$MarkerPath = $HostInfo.marker_path
$MarkerDir = Split-Path -Parent $MarkerPath
$Facts = & (Join-Path $ScriptDir 'detect-tools.ps1') | ConvertFrom-Json

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
  crg = $Facts.crg
  next_actions = @($Facts.next_actions)
}
$tempFile = Join-Path $MarkerDir ("readiness-ledger.{0}.tmp" -f ([guid]::NewGuid().ToString('N')))
$payload | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 $tempFile
Move-Item -Force $tempFile $MarkerPath
Write-Host "📝 宿主就绪标记已更新: $MarkerPath"
Write-Host "🔎 当前宿主基线状态: $($Facts.overall_status)"
Write-Host "🧭 MCP baseline_ready: $($Facts.baseline_ready)"
Write-Host '✅ readiness ledger 已写入'
