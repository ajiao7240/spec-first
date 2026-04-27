param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillDir = Split-Path -Parent $ScriptDir
. (Join-Path $ScriptDir 'lib-toml.ps1')
$ToolsJson = Get-Content -Raw (Join-Path $SkillDir 'mcp-tools.json') | ConvertFrom-Json
$HostInfo = & (Join-Path $ScriptDir 'detect-host.ps1') | ConvertFrom-Json
$DetectedHost = $HostInfo.host
$ConfigPath = $HostInfo.config_path
$Platform = $HostInfo.platform
$SelectedScope = $HostInfo.selected_scope
$PrecedenceBlocked = [bool]$HostInfo.precedence_blocked

try {
  $RepoRoot = (git rev-parse --show-toplevel 2>$null)
  if ([string]::IsNullOrWhiteSpace($RepoRoot)) { throw 'not git' }
  $RepoStatus = 'git-repo'
} catch {
  $RepoRoot = (Get-Location).Path
  $RepoStatus = 'not-git-repo'
}

function Get-DependencyStatus {
  param([string]$Name)
  if (Get-Command $Name -ErrorAction SilentlyContinue) { 'ready' } else { 'missing' }
}

function Get-HostConfigStatus {
  param([object]$Tool)
  if ([string]::IsNullOrWhiteSpace($SelectedScope)) { return 'action-required' }
  if ($PrecedenceBlocked) { return 'precedence-blocked' }
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
        if ($SelectedScope -eq 'managed') { return 'ready' }
        return 'fallback-active'
      }

      $section = Get-TomlMcpSection -Path $ConfigPath -Key $Tool.detection.key
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
        if ($null -eq $config.mcpServers.PSObject.Properties[$Tool.detection.key]) { return 'action-required' }
        if ($SelectedScope -eq 'managed') { return 'ready' }
        return 'fallback-active'
      }
      if (-not [string]::IsNullOrWhiteSpace((Get-TomlMcpSection -Path $ConfigPath -Key $Tool.detection.key))) { return 'ready' }
      return 'action-required'
    }
    default { return 'action-required' }
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

  if (-not (Test-Path $projectFile)) { return 'pending' }
  if ($Tool.project_bootstrap.kind -eq 'serena') {
    if (-not [string]::IsNullOrWhiteSpace($readyMarkerPath) -and (Test-Path $readyMarkerPath)) { return 'ready' }
    return 'failed'
  }
  return 'ready'
}

$tools = [ordered]@{}
$graphProviders = [ordered]@{}
$nextActions = New-Object System.Collections.Generic.List[string]

function Add-NextAction {
  param([string]$Action)
  if ([string]::IsNullOrWhiteSpace($Action)) { return }
  if (-not $nextActions.Contains($Action)) { $nextActions.Add($Action) }
}

foreach ($tool in @($ToolsJson.tools)) {
  $dependencyStatus = 'ready'
  foreach ($dep in @($tool.dependencies)) {
    $current = Get-DependencyStatus -Name $dep
    if ($current -ne 'ready') { $dependencyStatus = $current; break }
  }

  $hostConfigStatus = Get-HostConfigStatus -Tool $tool
  $projectStatus = Get-ProjectStatus -Tool $tool
  $configured = ($hostConfigStatus -eq 'ready' -or $hostConfigStatus -eq 'fallback-active')
  $type = if ($null -ne $tool.category) { $tool.category } else { 'mcp' }
  $nextAction = ''

  if ($dependencyStatus -ne 'ready') {
    $nextAction = 'install dependency'
  } elseif ($hostConfigStatus -eq 'action-required') {
    $nextAction = 'configure host'
  } elseif ($hostConfigStatus -eq 'precedence-blocked') {
    $nextAction = 'review higher-precedence host config'
  } elseif ($projectStatus -eq 'pending') {
    $nextAction = 'bootstrap project'
  } elseif ($type -eq 'graph-provider' -and $configured) {
    $nextAction = 'run spec-graph-bootstrap'
  }

  Add-NextAction $nextAction

  $toolFact = [ordered]@{
    required = [bool]$tool.required
    type = $type
    dependency_status = $dependencyStatus
    host_config_status = $hostConfigStatus
    project_status = $projectStatus
    selected_scope = $SelectedScope
    next_action = $nextAction
  }

  if ($type -eq 'graph-provider') {
    $toolFact.configured = [bool]$configured
    $toolFact.enabled_for_bootstrap = [bool]$configured
    $toolFact.query_ready = $false
    $toolFact.bootstrap_required = $true

    $graphProviders[$tool.id] = [ordered]@{
      required = [bool]$tool.required
      role = $tool.provider_role
      dependency_status = $dependencyStatus
      host_config_status = $hostConfigStatus
      configured = [bool]$configured
      enabled_for_bootstrap = [bool]$configured
      query_ready = $false
      bootstrap_required = $true
      capabilities = @($tool.provider_config.capabilities)
      next_action = $nextAction
    }
  }

  $tools[$tool.id] = $toolFact
}

[pscustomobject]@{
  schema_version = 'tool-facts.v2'
  host = $DetectedHost
  platform = $Platform
  repo_root = $RepoRoot
  repo_status = $RepoStatus
  tools = $tools
  graph_providers = $graphProviders
  next_actions = @($nextActions)
} | ConvertTo-Json -Depth 10 -Compress
