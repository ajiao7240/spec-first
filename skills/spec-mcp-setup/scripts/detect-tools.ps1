param(
  [string]$Repo = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillDir = Split-Path -Parent $ScriptDir
. (Join-Path $ScriptDir 'lib-toml.ps1')
. (Join-Path $ScriptDir 'lib-template.ps1')
$ToolsJson = Get-Content -Raw (Join-Path $SkillDir 'mcp-tools.json') | ConvertFrom-Json
$HostInfo = & (Join-Path $ScriptDir 'detect-host.ps1') | ConvertFrom-Json
$DetectedHost = $HostInfo.host
$ConfigPath = $HostInfo.config_path
$Platform = $HostInfo.platform
$SelectedScope = $HostInfo.selected_scope

$resolverParams = @{ Format = 'json' }
if (-not [string]::IsNullOrWhiteSpace($Repo)) { $resolverParams.Repo = $Repo }
$targetJson = & (Join-Path $ScriptDir 'resolve-project-target.ps1') @resolverParams
$TargetFacts = $targetJson | ConvertFrom-Json
$RepoRoot = if (-not [string]::IsNullOrWhiteSpace([string]$TargetFacts.selected_repo_root)) { [string]$TargetFacts.selected_repo_root } else { [string]$TargetFacts.workspace_root }
$RepoStatus = [string]$TargetFacts.repo_status

function Get-DependencyStatus {
  param([string]$Name)
  if (Get-Command $Name -ErrorAction SilentlyContinue) { 'ready' } else { 'missing' }
}

function Get-PathSizeBytes {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return 0 }
  if (Test-Path -LiteralPath $Path -PathType Leaf) {
    return ([System.IO.FileInfo]$Path).Length
  }
  $total = 0L
  Get-ChildItem -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
    if (-not $_.PSIsContainer) { $total += [int64]$_.Length }
  }
  return $total
}

function Get-SerenaCacheWarning {
  param([int64]$SizeBytes)
  if ($SizeBytes -ge 1073741824) { return 'large-cache-high' }
  if ($SizeBytes -ge 536870912) { return 'large-cache' }
  return $null
}

function Get-SerenaProjectFacts {
  param([object]$Tool)
  if ($Tool.id -ne 'serena' -or -not [bool]$TargetFacts.state_write_allowed) { return $null }

  $readyMarkerFile = if ($null -ne $Tool.project_bootstrap.ready_marker_file) { [string]$Tool.project_bootstrap.ready_marker_file } else { '.serena/index-ready.json' }
  $readyMarkerPath = Join-Path $RepoRoot $readyMarkerFile
  $cacheDir = Join-Path $RepoRoot '.serena/cache'
  $cacheSizeBytes = [int64](Get-PathSizeBytes -Path $cacheDir)
  $cacheStatus = if (-not (Test-Path -LiteralPath $cacheDir -PathType Container)) {
    'not-found'
  } elseif (Test-Path -LiteralPath $readyMarkerPath -PathType Leaf) {
    'ready'
  } else {
    'incomplete'
  }

  [ordered]@{
    serena_cache = [ordered]@{
      path = '.serena/cache'
      status = $cacheStatus
      size_bytes = $cacheSizeBytes
      warning = Get-SerenaCacheWarning -SizeBytes $cacheSizeBytes
    }
  }
}

function Test-HostConfigRequired {
  param([object]$Tool)
  if ($null -ne $Tool.PSObject.Properties['host_config_required']) {
    return [bool]$Tool.host_config_required
  }
  return $true
}

function Get-ProviderAccessMode {
  param([object]$Tool)
  if ($null -ne $Tool.provider_config -and $null -ne $Tool.provider_config.PSObject.Properties['access_mode']) {
    return [string]$Tool.provider_config.access_mode
  }
  if (Test-HostConfigRequired -Tool $Tool) { return 'live_mcp' }
  return 'cli_artifact'
}

function Get-ClaudeMcpServer {
  param(
    [object]$Config,
    [string]$Key
  )

  if ($null -eq $Config) { return $null }
  if ($null -eq $Config.PSObject.Properties['mcpServers']) { return $null }
  $servers = $Config.PSObject.Properties['mcpServers'].Value
  if ($null -eq $servers) { return $null }
  if ($null -eq $servers.PSObject.Properties[$Key]) { return $null }
  return $servers.PSObject.Properties[$Key].Value
}

function Get-HostConfigStatus {
  param([object]$Tool)
  if (-not (Test-HostConfigRequired -Tool $Tool)) { return 'not-required' }
  if ([string]::IsNullOrWhiteSpace($SelectedScope)) { return 'action-required' }

  $hostConfig = $Tool.host_config.$DetectedHost
  if ($DetectedHost -eq 'codex') {
    $selectedProperty = $HostInfo.targets.PSObject.Properties[$SelectedScope]
    $selectedPrecedence = if ($null -ne $selectedProperty) { [int](Get-ToolField -Tool $selectedProperty.Value -Name 'precedence') } else { 0 }
    foreach ($entry in $HostInfo.targets.PSObject.Properties) {
      if ($entry.Name -eq $SelectedScope) { continue }
      $target = $entry.Value
      if (-not [bool](Get-ToolField -Tool $target -Name 'exists')) { continue }
      if ([int](Get-ToolField -Tool $target -Name 'precedence') -le $selectedPrecedence) { continue }
      $path = [string](Get-ToolField -Tool $target -Name 'config_path')
      if ([string]::IsNullOrWhiteSpace($path) -or -not (Test-Path -LiteralPath $path -PathType Leaf)) { continue }
      $section = Get-TomlMcpSection -Path $path -Key $Tool.detection.key
      if ([string]::IsNullOrWhiteSpace($section)) { continue }
      if (Test-TomlMcpSectionExact -Path $path -Key $Tool.detection.key -Command $hostConfig.command -Args @(Expand-ToolArgs -Tool $Tool -Args $hostConfig.args)) {
        return 'ready'
      }
      return 'precedence-blocked'
    }
  }

  if (-not (Test-Path $ConfigPath)) { return 'action-required' }

  switch ($Tool.detection.kind) {
    'host_config_exact' {
      if ($DetectedHost -eq 'claude') {
        $config = Get-Content -Raw $ConfigPath | ConvertFrom-Json
        $server = Get-ClaudeMcpServer -Config $config -Key $Tool.detection.key
        if ($null -eq $server) { return 'action-required' }
        if ($server.command -ne $hostConfig.command) { return 'action-required' }
        $serverArgs = @($server.args)
        $expectedArgs = @(Expand-ToolArgs -Tool $Tool -Args $hostConfig.args)
        if ($serverArgs.Count -ne $expectedArgs.Count) { return 'action-required' }
        for ($i = 0; $i -lt $expectedArgs.Count; $i++) {
          if ($serverArgs[$i] -ne $expectedArgs[$i]) { return 'action-required' }
        }
        if ($null -ne $server.PSObject.Properties['scope']) { return 'action-required' }
        if ($SelectedScope -eq 'managed') { return 'ready' }
        return 'fallback-active'
      }

      if (-not (Test-TomlMcpSectionExact -Path $ConfigPath -Key $Tool.detection.key -Command $hostConfig.command -Args @(Expand-ToolArgs -Tool $Tool -Args $hostConfig.args))) {
        return 'action-required'
      }
      return 'ready'
    }
    'host_config_key_only' {
      if ($DetectedHost -eq 'claude') {
        $config = Get-Content -Raw $ConfigPath | ConvertFrom-Json
        if ($null -eq (Get-ClaudeMcpServer -Config $config -Key $Tool.detection.key)) { return 'action-required' }
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
  if (-not [bool]$TargetFacts.state_write_allowed) {
    if (-not [string]::IsNullOrWhiteSpace([string]$TargetFacts.reason_code)) { return [string]$TargetFacts.reason_code }
    return 'workspace-target-required'
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
  $serenaProjectFacts = Get-SerenaProjectFacts -Tool $tool
  $hostConfigRequired = Test-HostConfigRequired -Tool $tool
  $hostReady = (
    $hostConfigStatus -eq 'ready' -or
    $hostConfigStatus -eq 'fallback-active' -or
    ((-not $hostConfigRequired) -and $hostConfigStatus -eq 'not-required')
  )
  $type = if ($null -ne $tool.category) { $tool.category } else { 'mcp' }
  $providerEnabled = (
    $type -eq 'graph-provider' -and
    $null -ne $tool.provider_config -and
    [bool]$tool.provider_config.enabled_for_bootstrap
  )
  $configured = if ($type -eq 'graph-provider') {
    ($providerEnabled -and $dependencyStatus -eq 'ready' -and $hostReady)
  } else {
    ($hostConfigStatus -eq 'ready' -or $hostConfigStatus -eq 'fallback-active')
  }
  $nextAction = ''

  if ($dependencyStatus -ne 'ready') {
    $nextAction = 'install dependency'
  } elseif ($hostConfigStatus -eq 'action-required') {
    $nextAction = 'configure host'
  } elseif ($hostConfigStatus -eq 'precedence-blocked') {
    $nextAction = 'review higher-precedence host config'
  } elseif ($projectStatus -eq 'workspace-target-required' -or $projectStatus -like 'repo-target-*' -or $projectStatus -eq 'workspace-no-git-candidates') {
    $nextAction = [string]$TargetFacts.next_action
  } elseif ($projectStatus -eq 'pending') {
    $nextAction = 'bootstrap project'
  } elseif ($projectStatus -eq 'failed') {
    if ($null -ne $serenaProjectFacts -and $serenaProjectFacts.serena_cache.status -eq 'incomplete') {
      $nextAction = 'remove incomplete .serena/cache and rerun spec-mcp-setup'
    } else {
      $nextAction = 'repair project bootstrap'
    }
  } elseif ($type -eq 'graph-provider' -and $configured) {
    $nextAction = 'run spec-graph-bootstrap'
  } elseif ($tool.id -eq 'serena' -and $null -ne $serenaProjectFacts -and $serenaProjectFacts.serena_cache.warning -eq 'large-cache-high') {
    $nextAction = 'review .serena/cache size and clear stale cache only if Serena indexing is complete'
  }

  Add-NextAction $nextAction

  $toolFact = [ordered]@{
    required = [bool]$tool.required
    type = $type
    host_config_required = [bool]$hostConfigRequired
    dependency_status = $dependencyStatus
    host_config_status = $hostConfigStatus
    project_status = $projectStatus
    selected_scope = $SelectedScope
    next_action = $nextAction
  }
  if ($null -ne $serenaProjectFacts) {
    $toolFact.serena_cache = $serenaProjectFacts.serena_cache
  }

  if ($type -eq 'graph-provider') {
    $toolFact.configured = [bool]$configured
    $toolFact.enabled_for_bootstrap = [bool]$configured
    $toolFact.query_ready = $false
    $toolFact.bootstrap_required = $true

    $graphProviders[$tool.id] = [ordered]@{
      required = [bool]$tool.required
      role = $tool.provider_role
      access_mode = Get-ProviderAccessMode -Tool $tool
      host_config_required = [bool]$hostConfigRequired
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
  target = $TargetFacts
  target_mode = $TargetFacts.mode
  workspace_root = $TargetFacts.workspace_root
  selected_repo_root = $TargetFacts.selected_repo_root
  target_candidate_count = @($TargetFacts.candidates).Count
  target_candidates = @($TargetFacts.candidates)
  reason_code = $TargetFacts.reason_code
  tools = $tools
  graph_providers = $graphProviders
  next_actions = @($nextActions)
} | ConvertTo-Json -Depth 10 -Compress
