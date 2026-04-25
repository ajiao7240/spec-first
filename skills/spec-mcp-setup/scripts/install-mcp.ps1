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

function Invoke-Captured {
  param(
    [scriptblock]$Script,
    [int]$Limit = 1000
  )

  $output = New-Object System.Collections.Generic.List[string]
  $exitCode = 0
  $captured = @()
  try {
    $global:LASTEXITCODE = 0
    $captured = & $Script 2>&1
    if ($null -ne $captured) {
      foreach ($line in @($captured)) {
        $output.Add([string]$line)
      }
    }
    if ($LASTEXITCODE -is [int] -and $LASTEXITCODE -ne 0) {
      $exitCode = $LASTEXITCODE
      throw "Command exited with code $exitCode"
    }
  } catch {
    if ($exitCode -eq 0) {
      $exitCode = if ($LASTEXITCODE -is [int] -and $LASTEXITCODE -ne 0) { $LASTEXITCODE } else { 1 }
    }
    $output.Add([string]$_.Exception.Message)
    $summary = (($output -join ' ') -replace '\s+', ' ').Trim()
    if ($summary.Length -gt $Limit) { $summary = $summary.Substring(0, $Limit) }
    return [pscustomobject]@{ ok = $false; exit_code = $exitCode; stdout = ($captured -join "`n"); diagnostic_summary = $summary }
  }

  $summary = (($output -join ' ') -replace '\s+', ' ').Trim()
  if ($summary.Length -gt $Limit) { $summary = $summary.Substring(0, $Limit) }
  [pscustomobject]@{ ok = $true; exit_code = 0; stdout = ($captured -join "`n"); diagnostic_summary = $summary }
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
  if ([bool]$tool.required -and ($SkipArray -contains $tool.id)) {
    $results.Add([pscustomobject]@{
      tool_id = $tool.id
      status = 'action-required'
      last_action = 'failed'
      install_kind = $tool.installation.kind
      reason_code = 'invalid_required_skip'
      next_action = 'required MCP baseline 工具不能通过 -Skip 跳过'
      configured_path = ''
      selected_scope = ''
      fallback_applied = $false
      exit_code = $null
      diagnostic_summary = ''
      repair_diagnostic_summary = ''
    })
    continue
  }

  if (-not (Should-Install $tool)) { continue }

  $status = 'ready'
  $lastAction = 'installed'
  $reasonCode = ''
  $nextAction = ''
  $configuredPath = ''
  $selectedScope = ''
  $fallbackApplied = $false
  $exitCode = $null
  $diagnosticSummary = ''
  $repairDiagnosticSummary = ''

  if ($tool.installation.kind -eq 'warmup') {
    $warmupResult = Invoke-Captured { Invoke-Warmup -Tool $tool }
    if (-not $warmupResult.ok) {
      $status = 'action-required'
      $lastAction = 'failed'
      $reasonCode = 'warmup_failed'
      $nextAction = '检查工具 warmup 命令与网络可达性'
      $exitCode = $warmupResult.exit_code
      $diagnosticSummary = $warmupResult.diagnostic_summary
    }
  }

  if ($status -eq 'ready') {
    $configureRun = Invoke-Captured { & (Join-Path $ScriptDir 'configure-host.ps1') -Tool $tool.id }
    if ($configureRun.ok) {
      $configureResult = $configureRun.stdout | ConvertFrom-Json
      $configuredPath = $configureResult.configured_path
      $selectedScope = $configureResult.selected_scope
      $fallbackApplied = [bool]$configureResult.fallback_applied
    } else {
      $exitCode = $configureRun.exit_code
      $diagnosticSummary = $configureRun.diagnostic_summary
      $repairRun = Invoke-Captured { & (Join-Path $ScriptDir 'repair-install.ps1') -Tool $tool.id }
      if ($repairRun.ok) {
        $repairResult = $repairRun.stdout | ConvertFrom-Json
        $lastAction = 'repaired'
        $configuredPath = $repairResult.configured_path
        $selectedScope = $repairResult.selected_scope
        $fallbackApplied = [bool]$repairResult.fallback_applied
      } else {
        $status = 'action-required'
        $lastAction = 'failed'
        $reasonCode = 'configure_failed'
        $nextAction = '检查宿主 CLI、依赖与配置写入权限'
        $repairDiagnosticSummary = $repairRun.diagnostic_summary
      }
    }
  }

  if ($tool.id -eq 'serena' -and $status -eq 'ready') {
    $activateRun = Invoke-Captured { & (Join-Path $ScriptDir 'activate-serena.ps1') }
    try {
      if (-not $activateRun.ok) {
        throw 'Serena bootstrap command failed'
      }
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
      $exitCode = $activateRun.exit_code
      $diagnosticSummary = $activateRun.diagnostic_summary
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
    exit_code = $exitCode
    diagnostic_summary = $diagnosticSummary
    repair_diagnostic_summary = $repairDiagnosticSummary
  })
}

[pscustomobject]@{
  host = $DetectedHost
  display_name = $HostDisplayName
  platform = $Platform
  results = @($results)
} | ConvertTo-Json -Depth 6 -Compress
