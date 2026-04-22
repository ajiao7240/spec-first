param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillDir = Split-Path -Parent $ScriptDir
$ToolsJson = Get-Content -Raw (Join-Path $SkillDir 'mcp-tools.json') | ConvertFrom-Json
$HostInfo = & (Join-Path $ScriptDir 'detect-host.ps1') | ConvertFrom-Json
$DetectedHost = $HostInfo.host
$ConfigPath = $HostInfo.config_path
$Platform = $HostInfo.platform
$RepoRoot = try { git rev-parse --show-toplevel } catch { (Get-Location).Path }

function Get-TomlSection {
  param([string]$Path, [string]$SectionName)
  if (-not (Test-Path $Path)) { return '' }
  $header = "[mcp_servers.$SectionName]"
  $lines = Get-Content $Path
  $capturing = $false
  $buffer = New-Object System.Collections.Generic.List[string]
  foreach ($line in $lines) {
    if ($line -eq $header) { $capturing = $true; continue }
    if ($capturing -and $line -match '^\[mcp_servers\..+\]$') { break }
    if ($capturing) { $buffer.Add($line) }
  }
  $buffer -join "`n"
}

function Get-DependencyStatus {
  param([string]$Name)
  if (Get-Command $Name -ErrorAction SilentlyContinue) { 'ready' } else { 'missing' }
}

function Get-HostConfigStatus {
  param([object]$Tool)
  if (-not (Test-Path $ConfigPath)) { return 'action-required' }
  $hostConfig = $Tool.host_config.$DetectedHost
  switch ($Tool.detection.kind) {
    'host_config_exact' {
      if ($DetectedHost -eq 'claude') {
        $config = Get-Content -Raw $ConfigPath | ConvertFrom-Json
        $server = $config.mcpServers.PSObject.Properties[$Tool.detection.key].Value
        if ($null -eq $server) { return 'action-required' }
        if ($server.command -ne $hostConfig.command) { return 'action-required' }
        $serverArgs = @($server.args)
        $expectedArgs = @($hostConfig.args)
        if ($serverArgs.Count -ne $expectedArgs.Count) { return 'action-required' }
        for ($i = 0; $i -lt $expectedArgs.Count; $i++) {
          if ($serverArgs[$i] -ne $expectedArgs[$i]) { return 'action-required' }
        }
        return 'ready'
      }
      $section = Get-TomlSection -Path $ConfigPath -SectionName $Tool.detection.key
      if ([string]::IsNullOrWhiteSpace($section)) { return 'action-required' }
      if (-not $section.Contains("command = `"$($hostConfig.command)`"")) { return 'action-required' }
      foreach ($arg in @($hostConfig.args)) {
        if (-not $section.Contains($arg)) { return 'action-required' }
      }
      return 'ready'
    }
    'host_config_key_only' {
      if ($DetectedHost -eq 'claude') {
        $config = Get-Content -Raw $ConfigPath | ConvertFrom-Json
        if ($null -ne $config.mcpServers.PSObject.Properties[$Tool.detection.key]) { return 'ready' }
        return 'action-required'
      }
      if (Select-String -Path $ConfigPath -SimpleMatch "[mcp_servers.$($Tool.detection.key)]" -Quiet) { 'ready' } else { 'action-required' }
    }
    default { 'action-required' }
  }
}

function Get-ProjectStatus {
  param([object]$Tool)
  if ($Tool.project_bootstrap.kind -eq 'none' -or -not $Tool.project_bootstrap.required) {
    return 'not-applicable'
  }
  $projectFile = Join-Path $RepoRoot $Tool.project_bootstrap.project_file
  $readyMarkerFile = if ($null -ne $Tool.project_bootstrap.ready_marker_file) { $Tool.project_bootstrap.ready_marker_file } else { '' }
  $readyMarkerPath = if ([string]::IsNullOrWhiteSpace($readyMarkerFile)) { '' } else { Join-Path $RepoRoot $readyMarkerFile }
  if (-not (Test-Path $projectFile)) {
    return 'pending'
  }
  if ($Tool.project_bootstrap.kind -eq 'serena') {
    if (-not [string]::IsNullOrWhiteSpace($readyMarkerPath) -and (Test-Path $readyMarkerPath)) { return 'ready' }
    return 'failed'
  }
  return 'ready'
}

function Get-CrgCliStatus {
  if (-not (Get-Command spec-first -ErrorAction SilentlyContinue)) { return 'unavailable' }
  try {
    & spec-first crg --help | Out-Null
    return 'ready'
  } catch {
    return 'unavailable'
  }
}

function Get-CrgNativeModulesStatus {
  if ((Get-CrgCliStatus) -ne 'ready') { return 'unchecked' }
  try {
    & node -e "try{require('better-sqlite3')}catch{process.exit(1)}" | Out-Null
  } catch {
    return 'missing'
  }
  try {
    & node -e "try{require('tree-sitter')}catch{process.exit(1)}" | Out-Null
  } catch {
    return 'missing'
  }
  return 'ready'
}

$overallStatus = 'ready'
$baselineReady = $true
$results = [ordered]@{}
$crgCliStatus = Get-CrgCliStatus
$crgNativeModulesStatus = Get-CrgNativeModulesStatus
$nextActions = New-Object System.Collections.Generic.List[string]
function Add-NextAction {
  param([string]$Action)
  if ([string]::IsNullOrWhiteSpace($Action)) { return }
  if (-not $nextActions.Contains($Action)) {
    $nextActions.Add($Action)
  }
}
if ($crgCliStatus -eq 'unavailable') {
  $overallStatus = 'partial'
  Add-NextAction 'install or repair spec-first crg CLI'
} elseif ($crgNativeModulesStatus -eq 'missing') {
  $overallStatus = 'partial'
  Add-NextAction 'repair better-sqlite3/tree-sitter native modules'
}

foreach ($tool in @($ToolsJson.tools)) {
  $dependencyStatus = 'ready'
  foreach ($dep in @($tool.dependencies)) {
    $current = Get-DependencyStatus -Name $dep
    if ($current -ne 'ready') { $dependencyStatus = $current; break }
  }

  $hostConfigStatus = Get-HostConfigStatus -Tool $tool
  $projectStatus = Get-ProjectStatus -Tool $tool
  $nextAction = ''
  if ($dependencyStatus -ne 'ready') {
    $nextAction = 'install dependency'
  } elseif ($hostConfigStatus -ne 'ready') {
    $nextAction = 'configure host'
  } elseif ($projectStatus -eq 'pending') {
    $nextAction = 'bootstrap project'
  }

  if ($tool.required -and ($dependencyStatus -ne 'ready' -or $hostConfigStatus -ne 'ready' -or ($projectStatus -ne 'ready' -and $projectStatus -ne 'not-applicable'))) {
    $baselineReady = $false
    if ($overallStatus -eq 'ready') { $overallStatus = 'partial' }
  }

  if ($dependencyStatus -eq 'missing' -or $hostConfigStatus -eq 'action-required') {
    $overallStatus = 'action-required'
  } elseif ($projectStatus -eq 'failed' -and $overallStatus -eq 'ready') {
    $overallStatus = 'partial'
  }

  Add-NextAction $nextAction

  $results[$tool.id] = [ordered]@{
    required = [bool]$tool.required
    dependency_status = $dependencyStatus
    host_config_status = $hostConfigStatus
    project_status = $projectStatus
    next_action = $nextAction
  }
}

[pscustomobject]@{
  host = $DetectedHost
  platform = $Platform
  repo_root = $RepoRoot
  overall_status = $overallStatus
  baseline_ready = [bool]$baselineReady
  tools = $results
  crg = [ordered]@{
    cli_status = $crgCliStatus
    native_modules_status = $crgNativeModulesStatus
  }
  next_actions = @($nextActions)
} | ConvertTo-Json -Depth 8 -Compress
