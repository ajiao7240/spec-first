param(
  [string]$Only,
  [string]$Repo = '',
  [Alias('SerenaLanguages')]
  [string[]]$SerenaLanguage = @()
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
$resolverParams = @{ Format = 'json' }
if (-not [string]::IsNullOrWhiteSpace($Repo)) { $resolverParams.Repo = $Repo }
$TargetFacts = (& (Join-Path $ScriptDir 'resolve-project-target.ps1') @resolverParams) | ConvertFrom-Json
$ResolvedRepoRoot = if (-not [string]::IsNullOrWhiteSpace([string]$TargetFacts.selected_repo_root)) { [string]$TargetFacts.selected_repo_root } else { [string]$TargetFacts.workspace_root }

function Parse-List {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return @() }
  @($Value -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

function Normalize-LanguageValues {
  param([string[]]$Values)
  $normalized = New-Object System.Collections.Generic.List[string]
  foreach ($value in @($Values)) {
    if ([string]::IsNullOrWhiteSpace($value)) { continue }
    foreach ($language in @($value -split ',')) {
      $trimmed = $language.Trim()
      if (-not [string]::IsNullOrWhiteSpace($trimmed)) {
        $normalized.Add($trimmed)
      }
    }
  }
  @($normalized)
}

$OnlyArray = Parse-List $Only

function Should-Install {
  param([object]$Tool)
  if ($OnlyArray.Count -gt 0) { return $OnlyArray -contains $Tool.id }
  return $true
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
  if (-not [bool]$tool.required) {
    $results.Add([pscustomobject]@{
      tool_id = $tool.id
      status = 'action-required'
      last_action = 'failed'
      install_kind = $tool.installation.kind
      reason_code = 'registry_not_required'
      next_action = 'mcp-tools.json schema v4 只允许 required tools'
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

  foreach ($dep in @($tool.dependencies)) {
    if (-not (Get-Command $dep -ErrorAction SilentlyContinue)) {
      $status = 'action-required'
      $lastAction = 'failed'
      $reasonCode = 'missing_dependency'
      $nextAction = "安装依赖: $dep"
      $diagnosticSummary = "missing dependency: $dep"
      break
    }
  }

  if ($status -eq 'ready' -and $tool.installation.kind -eq 'warmup') {
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

  $hostConfigRequired = if ($null -ne $tool.PSObject.Properties['host_config_required']) { [bool]$tool.host_config_required } else { $true }

  if ($status -eq 'ready' -and $hostConfigRequired) {
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
  } elseif ($status -eq 'ready') {
    $lastAction = 'host-config-skipped'
    $nextAction = 'run spec-graph-bootstrap'
    $diagnosticSummary = 'host MCP config is not required for this provider'
  }

  if ($tool.id -eq 'serena' -and $status -eq 'ready') {
    if (-not [bool]$TargetFacts.state_write_allowed) {
      $status = 'partial'
      $lastAction = 'skipped'
      $reasonCode = if ([string]::IsNullOrWhiteSpace([string]$TargetFacts.reason_code)) { 'workspace-target-required' } else { [string]$TargetFacts.reason_code }
      $nextAction = [string]$TargetFacts.next_action
      $diagnosticSummary = "project target unresolved: $reasonCode"
    } else {
      $filteredSerenaLanguages = @(Normalize-LanguageValues -Values $SerenaLanguage)
      $activateParams = @{ Repo = $ResolvedRepoRoot }
      if ($filteredSerenaLanguages.Count -gt 0) {
        $activateParams.Language = @($filteredSerenaLanguages)
      }
      $activateRun = Invoke-Captured { & (Join-Path $ScriptDir 'activate-serena.ps1') @activateParams }
      try {
        if (-not $activateRun.ok) {
          throw 'Serena bootstrap command failed'
        }
        $readyMarkerFile = if ($null -ne $tool.project_bootstrap.ready_marker_file) { $tool.project_bootstrap.ready_marker_file } else { '.serena/index-ready.json' }
        $readyMarkerPath = Join-Path $ResolvedRepoRoot $readyMarkerFile
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
        if ($diagnosticSummary -like '*first-time bootstrap requires -Language*') {
          $reasonCode = 'serena_language_required'
          $nextAction = '基于项目证据选择 Serena 语言，并用 -SerenaLanguage <language> 重试'
        }
      }
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
