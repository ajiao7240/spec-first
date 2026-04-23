param(
  [string]$Install,
  [string]$Skip
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillDir = Split-Path -Parent $ScriptDir
$ToolsJsonPath = Join-Path $SkillDir 'mcp-tools.json'
$ToolsJson = Get-Content -Raw $ToolsJsonPath | ConvertFrom-Json
$HostInfo = & (Join-Path $ScriptDir 'detect-host.ps1') | ConvertFrom-Json
$DetectedHost = $HostInfo.host
$HostDisplayName = $HostInfo.display_name
$Platform = $HostInfo.platform

function Parse-List {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return @() }
  @($Value -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

$InstallArray = Parse-List $Install
$SkipArray = Parse-List $Skip

function Should-Install {
  param([object]$Tool)
  if ($SkipArray -contains $Tool.id) { return $false }
  if ($InstallArray.Count -gt 0) { return $InstallArray -contains $Tool.id }
  return [bool]$Tool.required
}

function Invoke-Warmup {
  param([object]$Tool)
  $platformKey = if ($Platform -eq 'windows') { 'windows' } else { 'unix' }
  $step = $Tool.installation.$platformKey
  if ($null -eq $step) { return }
  $command = $step.command
  $args = @($step.args)
  if ($Platform -eq 'windows' -and $command -eq 'npx') {
    & cmd /c $command @args | Out-Null
  } else {
    & $command @args | Out-Null
  }
}

$results = New-Object System.Collections.Generic.List[object]
foreach ($tool in @($ToolsJson.tools)) {
  if (-not (Should-Install $tool)) { continue }

  $status = 'ready'
  $lastAction = 'installed'
  $reasonCode = ''
  $nextAction = ''
  $configuredPath = ''
  $selectedScope = ''
  $fallbackApplied = $false

  if ($tool.installation.kind -eq 'warmup') {
    try {
      Invoke-Warmup -Tool $tool
    } catch {
      $status = 'action-required'
      $lastAction = 'failed'
      $reasonCode = 'warmup_failed'
      $nextAction = '检查工具 warmup 命令与网络可达性'
    }
  }

  if ($status -eq 'ready') {
    try {
      $configureResult = & (Join-Path $ScriptDir 'configure-host.ps1') -Tool $tool.id | ConvertFrom-Json
      $configuredPath = $configureResult.configured_path
      $selectedScope = $configureResult.selected_scope
      $fallbackApplied = [bool]$configureResult.fallback_applied
    } catch {
      try {
        $repairResult = & (Join-Path $ScriptDir 'repair-install.ps1') -Tool $tool.id | ConvertFrom-Json
        $lastAction = 'repaired'
        $configuredPath = $repairResult.configured_path
        $selectedScope = $repairResult.selected_scope
        $fallbackApplied = [bool]$repairResult.fallback_applied
      } catch {
        $status = 'action-required'
        $lastAction = 'failed'
        $reasonCode = 'configure_failed'
        $nextAction = '检查宿主 CLI、依赖与配置写入权限'
      }
    }
  }

  if ($tool.id -eq 'serena' -and $status -eq 'ready') {
    try {
      & (Join-Path $ScriptDir 'activate-serena.ps1') | Out-Null
      $readyMarkerFile = if ($null -ne $tool.project_bootstrap.ready_marker_file) { $tool.project_bootstrap.ready_marker_file } else { '.serena/index-ready.json' }
      $readyMarkerPath = Join-Path (try { git rev-parse --show-toplevel } catch { (Get-Location).Path }) $readyMarkerFile
      if (-not (Test-Path $readyMarkerPath)) {
        throw 'Serena ready marker 缺失'
      }
    } catch {
      $status = 'partial'
      $lastAction = 'failed'
      $reasonCode = 'serena_bootstrap_failed'
      $nextAction = '检查当前仓库 Serena project bootstrap'
    }
  }

  $results.Add([pscustomobject]@{
    tool_id = $tool.id
    status = $status
    last_action = $lastAction
    install_kind = $tool.installation.kind
    reason_code = $reasonCode
    next_action = $nextAction
    configured_path = $configuredPath
    selected_scope = $selectedScope
    fallback_applied = [bool]$fallbackApplied
  })
}

[pscustomobject]@{
  host = $DetectedHost
  display_name = $HostDisplayName
  platform = $Platform
  results = @($results)
} | ConvertTo-Json -Depth 6 -Compress
