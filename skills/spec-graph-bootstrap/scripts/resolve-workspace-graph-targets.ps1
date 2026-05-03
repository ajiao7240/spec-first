param(
  [string]$Repo = '',
  [int]$ScanDepth = 3,
  [switch]$WriteSummary
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectResolver = Join-Path $scriptDir '../../spec-mcp-setup/scripts/resolve-project-target.ps1'

function Read-JsonFileOrNull {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
  return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
}

function Test-Schema {
  param(
    [string]$Path,
    [string]$Schema
  )
  $json = Read-JsonFileOrNull -Path $Path
  if ($null -eq $json) { return $false }
  return ([string]($json.schema_version ?? '')) -eq $Schema
}

function Get-StatusHash {
  param([string]$Text)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    $hash = $sha.ComputeHash($bytes)
    return 'sha256:' + ([BitConverter]::ToString($hash).Replace('-', '').ToLowerInvariant())
  } finally {
    $sha.Dispose()
  }
}

function Get-ProviderStatus {
  param(
    [object]$ProviderStatus,
    [string]$Provider
  )
  if ($null -eq $ProviderStatus -or $null -eq $ProviderStatus.providers) { return $null }
  foreach ($item in @($ProviderStatus.providers)) {
    if ($item.provider -eq $Provider) { return $item }
  }
  return $null
}

function Get-PropertyValue {
  param(
    [object]$Object,
    [string]$Name,
    $Default = $null
  )
  if ($null -eq $Object) { return $Default }
  if ($Object.PSObject.Properties.Name -contains $Name) { return $Object.$Name }
  return $Default
}

function New-TargetItemFromSelectedRepo {
  param([object]$Target)
  [pscustomobject]@{
    repo_label = [string](Get-PropertyValue -Object $Target -Name 'repo_label' -Default '')
    git_root = [string]$Target.selected_repo_root
    workspace_relative_path = if ([string]::IsNullOrWhiteSpace([string](Get-PropertyValue -Object $Target -Name 'repo_label' -Default ''))) { '.' } else { [string]$Target.repo_label }
    relationship = 'selected_git_repo'
  }
}

function Resolve-TargetFacts {
  $params = @{ Format = 'json'; ScanDepth = $ScanDepth }
  if (-not [string]::IsNullOrWhiteSpace($Repo)) { $params.Repo = $Repo }
  $raw = & $projectResolver @params
  if ([string]::IsNullOrWhiteSpace(($raw -join "`n"))) {
    throw 'resolve-workspace-graph-targets.ps1: target resolver returned no JSON output'
  }
  return ($raw -join "`n") | ConvertFrom-Json
}

function Inspect-Repo {
  param([object]$TargetItem)

  $repoRoot = [string]$TargetItem.git_root
  $repoLabel = [string](Get-PropertyValue -Object $TargetItem -Name 'repo_label' -Default '')
  $workspaceRelativePath = [string](Get-PropertyValue -Object $TargetItem -Name 'workspace_relative_path' -Default $repoLabel)
  $specDir = Join-Path $repoRoot '.spec-first'
  $configDir = Join-Path $specDir 'config'
  $graphDir = Join-Path $specDir 'graph'
  $impactDir = Join-Path $specDir 'impact'
  $providersDir = Join-Path $specDir 'providers'

  $graphProvidersPath = Join-Path $configDir 'graph-providers.json'
  $runtimeCapabilitiesPath = Join-Path $configDir 'runtime-capabilities.json'
  $providerArtifactsPath = Join-Path $configDir 'provider-artifacts.json'
  $graphFactsPath = Join-Path $graphDir 'graph-facts.json'
  $providerStatusPath = Join-Path $graphDir 'provider-status.json'
  $impactCapabilitiesPath = Join-Path $impactDir 'bootstrap-impact-capabilities.json'
  $gitNexusStatusPath = Join-Path $providersDir 'gitnexus/status.json'

  $currentRevision = (git -C $repoRoot rev-parse --verify 'HEAD^{commit}' 2>$null)
  if ($null -eq $currentRevision) { $currentRevision = '' }
  $worktreeStatus = (git -C $repoRoot status --porcelain 2>$null) -join "`n"
  $currentDirty = -not [string]::IsNullOrWhiteSpace($worktreeStatus)
  $currentStatusHash = Get-StatusHash -Text $worktreeStatus

  $setupReady = (Test-Schema -Path $graphProvidersPath -Schema 'graph-providers.v1') -and
    (Test-Schema -Path $runtimeCapabilitiesPath -Schema 'runtime-capabilities.v1') -and
    (Test-Schema -Path $providerArtifactsPath -Schema 'provider-artifacts.v1')

  $graphProviders = Read-JsonFileOrNull -Path $graphProvidersPath
  $runtimeCapabilities = Read-JsonFileOrNull -Path $runtimeCapabilitiesPath
  $providerArtifacts = Read-JsonFileOrNull -Path $providerArtifactsPath
  $graphFacts = Read-JsonFileOrNull -Path $graphFactsPath
  $providerStatus = Read-JsonFileOrNull -Path $providerStatusPath
  $impactCapabilities = Read-JsonFileOrNull -Path $impactCapabilitiesPath
  $gitNexusStatus = Read-JsonFileOrNull -Path $gitNexusStatusPath

  $sourceRevision = Get-PropertyValue -Object $graphFacts -Name 'source_revision' -Default $null
  $recordedHash = Get-PropertyValue -Object $graphFacts -Name 'worktree_status_hash' -Default $null
  if ($null -eq $recordedHash -and $null -ne $graphFacts -and $null -ne (Get-PropertyValue -Object $graphFacts -Name 'staleness_hints' -Default $null)) {
    $recordedHash = Get-PropertyValue -Object $graphFacts.staleness_hints -Name 'worktree_status_hash' -Default $null
  }
  $stale = ($null -ne $sourceRevision -and -not [string]::IsNullOrWhiteSpace([string]$sourceRevision) -and -not [string]::IsNullOrWhiteSpace([string]$currentRevision) -and [string]$sourceRevision -ne [string]$currentRevision)
  $dirtyAtBootstrap = [bool](Get-PropertyValue -Object $graphFacts -Name 'worktree_dirty' -Default $false)
  $dirtyUncertain = ($null -ne $graphFacts -and $dirtyAtBootstrap -and (($null -eq $recordedHash) -or ([string]$recordedHash -ne $currentStatusHash)))
  $setupWorkflowMode = Get-PropertyValue -Object (Get-PropertyValue -Object $graphProviders -Name 'derived_readiness' -Default $null) -Name 'workflow_mode' -Default $(if ($setupReady) { 'setup-ready-bootstrap-required' } else { $null })
  $graphWorkflowMode = Get-PropertyValue -Object $graphFacts -Name 'workflow_mode' -Default $null

  if ([string]::IsNullOrWhiteSpace([string]$currentRevision)) {
    $graphStatus = 'unavailable'
  } elseif ($null -ne $graphFacts) {
    if ($stale) { $graphStatus = 'stale' }
	    elseif ($dirtyUncertain) { $graphStatus = 'dirty-uncertain' }
	    elseif ($graphWorkflowMode -eq 'primary') { $graphStatus = 'primary' }
	    elseif ($graphWorkflowMode -eq 'degraded-fallback') { $graphStatus = 'degraded-fallback' }
	    elseif ($graphWorkflowMode -eq 'no-source') { $graphStatus = 'no-source' }
	    else { $graphStatus = [string]($graphWorkflowMode ?? 'unavailable') }
  } elseif ($setupReady) {
    $graphStatus = [string]($setupWorkflowMode ?? 'setup-ready-bootstrap-required')
  } else {
    $graphStatus = 'unavailable'
  }

  $gitNexusProvider = Get-PropertyValue -Object (Get-PropertyValue -Object $graphProviders -Name 'providers' -Default $null) -Name 'gitnexus' -Default $null
  $crgProvider = Get-PropertyValue -Object (Get-PropertyValue -Object $graphProviders -Name 'providers' -Default $null) -Name 'code-review-graph' -Default $null
  $gitNexusProviderStatus = Get-ProviderStatus -ProviderStatus $providerStatus -Provider 'gitnexus'
  $crgProviderStatus = Get-ProviderStatus -ProviderStatus $providerStatus -Provider 'code-review-graph'

  $limitations = New-Object System.Collections.Generic.List[string]
  if (-not $setupReady) { $limitations.Add('setup-owned config is missing or unsupported') }
  if ($stale) { $limitations.Add('compiled graph facts source revision differs from current HEAD') }
  if ($dirtyUncertain) { $limitations.Add('compiled graph facts were generated from a dirty worktree without a matching status fingerprint') }
  if ($null -eq $graphFacts -and $setupReady) { $limitations.Add('graph bootstrap has not produced canonical graph facts') }
  if ([string](Get-PropertyValue -Object $gitNexusProviderStatus -Name 'status' -Default '') -eq 'query-not-applicable') {
    $limitations.Add('GitNexus process routing is not applicable because no source-derived query target exists')
  } elseif ([bool](Get-PropertyValue -Object $gitNexusProviderStatus -Name 'graph_ready' -Default $false) -and -not [bool](Get-PropertyValue -Object $gitNexusProviderStatus -Name 'query_ready' -Default $false)) {
    $limitations.Add('GitNexus graph exists but query readiness is unverified; use live MCP probe or bounded direct reads')
  }

  $queryProbePolicy = Get-PropertyValue -Object $gitNexusProvider -Name 'query_probe_policy' -Default $null
  $candidateTokens = @()
  if ($null -ne $queryProbePolicy -and $null -ne (Get-PropertyValue -Object $queryProbePolicy -Name 'candidates' -Default $null)) {
    $candidateTokens += @($queryProbePolicy.candidates | ForEach-Object {
      [ordered]@{
        token = $_.token
        selected_from = Get-PropertyValue -Object $_ -Name 'selected_from' -Default $null
        reason_code = Get-PropertyValue -Object $_ -Name 'reason_code' -Default $null
      }
    })
  }
  $legacyToken = Get-PropertyValue -Object $queryProbePolicy -Name 'token' -Default ''
  if (-not [string]::IsNullOrWhiteSpace([string]$legacyToken) -and @($candidateTokens | Where-Object { $_.token -eq $legacyToken }).Count -eq 0) {
    $candidateTokens += [ordered]@{
      token = [string]$legacyToken
      selected_from = Get-PropertyValue -Object $queryProbePolicy -Name 'selected_from' -Default $null
      reason_code = Get-PropertyValue -Object $queryProbePolicy -Name 'source' -Default 'legacy-token'
    }
  }

  [ordered]@{
    target_repo = $repoLabel
    repo_label = $repoLabel
    git_root = $repoRoot
    workspace_relative_path = $workspaceRelativePath
    status = $graphStatus
    graph_status = $graphStatus
    workflow_mode = [string]($graphWorkflowMode ?? $setupWorkflowMode ?? $graphStatus)
    setup_status = if ($setupReady) { 'ready' } else { 'missing-or-unsupported' }
    setup_ready = $setupReady
    git = [ordered]@{
      current_revision = if ([string]::IsNullOrWhiteSpace([string]$currentRevision)) { $null } else { [string]$currentRevision }
      current_worktree_dirty = $currentDirty
      current_worktree_status_hash = $currentStatusHash
    }
    freshness = [ordered]@{
      source_revision = $sourceRevision
      source_revision_matches = if ($null -eq $sourceRevision -or [string]::IsNullOrWhiteSpace([string]$currentRevision)) { $null } else { [string]$sourceRevision -eq [string]$currentRevision }
      stale = $stale
      worktree_dirty_at_bootstrap = Get-PropertyValue -Object $graphFacts -Name 'worktree_dirty' -Default $null
      worktree_status_hash = $recordedHash
      dirty_uncertain = $dirtyUncertain
    }
    providers = [ordered]@{
      gitnexus = [ordered]@{
        configured = [bool](Get-PropertyValue -Object $gitNexusProvider -Name 'configured' -Default $false)
        graph_ready = [bool](Get-PropertyValue -Object $gitNexusProviderStatus -Name 'graph_ready' -Default (Get-PropertyValue -Object $gitNexusStatus -Name 'graph_ready' -Default $false))
        query_ready = [bool](Get-PropertyValue -Object $gitNexusProviderStatus -Name 'query_ready' -Default (Get-PropertyValue -Object $gitNexusStatus -Name 'query_ready' -Default $false))
        status = Get-PropertyValue -Object $gitNexusProviderStatus -Name 'status' -Default (Get-PropertyValue -Object $gitNexusStatus -Name 'status' -Default $null)
        repo = if ($null -ne $gitNexusProvider -and $null -ne $gitNexusProvider.commands -and $null -ne $gitNexusProvider.commands.query_probe -and $gitNexusProvider.commands.query_probe.Count -gt 6) { $gitNexusProvider.commands.query_probe[6] } else { $null }
        query_probe_policy = $queryProbePolicy
        status_artifact = '.spec-first/providers/gitnexus/status.json'
      }
      'code-review-graph' = [ordered]@{
        configured = [bool](Get-PropertyValue -Object $crgProvider -Name 'configured' -Default $false)
        graph_ready = [bool](Get-PropertyValue -Object $crgProviderStatus -Name 'graph_ready' -Default $false)
        query_ready = [bool](Get-PropertyValue -Object $crgProviderStatus -Name 'query_ready' -Default $false)
        status = Get-PropertyValue -Object $crgProviderStatus -Name 'status' -Default $null
        status_artifact = '.spec-first/providers/code-review-graph/status.json'
      }
    }
    capabilities = [ordered]@{
      query_global_graph = [bool](Get-PropertyValue -Object (Get-PropertyValue -Object $graphFacts -Name 'capabilities' -Default $null) -Name 'query_global_graph' -Default $false)
      impact_context = [bool](Get-PropertyValue -Object (Get-PropertyValue -Object $graphFacts -Name 'capabilities' -Default $null) -Name 'impact_context' -Default $false)
      context_selection = Get-PropertyValue -Object (Get-PropertyValue -Object (Get-PropertyValue -Object $impactCapabilities -Name 'capabilities' -Default $null) -Name 'context_selection' -Default $null) -Name 'support_level' -Default $null
      impact_radius = Get-PropertyValue -Object (Get-PropertyValue -Object (Get-PropertyValue -Object $impactCapabilities -Name 'capabilities' -Default $null) -Name 'impact_radius' -Default $null) -Name 'support_level' -Default $null
      review_support = Get-PropertyValue -Object (Get-PropertyValue -Object (Get-PropertyValue -Object $impactCapabilities -Name 'capabilities' -Default $null) -Name 'review_support' -Default $null) -Name 'support_level' -Default $null
    }
    artifacts = [ordered]@{
      graph_providers = if ($null -ne $graphProviders) { '.spec-first/config/graph-providers.json' } else { $null }
      runtime_capabilities = if ($null -ne $runtimeCapabilities) { '.spec-first/config/runtime-capabilities.json' } else { $null }
      provider_artifacts = if ($null -ne $providerArtifacts) { '.spec-first/config/provider-artifacts.json' } else { $null }
      provider_status = if ($null -ne $providerStatus) { '.spec-first/graph/provider-status.json' } else { $null }
      graph_facts = if ($null -ne $graphFacts) { '.spec-first/graph/graph-facts.json' } else { $null }
      impact_capabilities = if ($null -ne $impactCapabilities) { '.spec-first/impact/bootstrap-impact-capabilities.json' } else { $null }
    }
    candidate_tokens = @($candidateTokens)
    limitations = @($limitations)
	    next_action = switch ($graphStatus) {
	      'primary' { 'Use GitNexus-first for bounded read-only evidence.'; break }
	      'degraded-fallback' { 'Use available provider facts with disclosed fallback limitations.'; break }
	      'no-source' { 'Skip GitNexus process routing for this no-source child repo.'; break }
	      'dirty-uncertain' { 'Refresh graph bootstrap or use one bounded live MCP probe/direct read fallback.'; break }
      'stale' { 'Rerun spec-graph-bootstrap for this child repo or use bounded fallback evidence.'; break }
      'setup-ready-bootstrap-required' { 'Run spec-graph-bootstrap for this child repo.'; break }
      default { 'Run spec-mcp-setup for this child repo.' }
    }
  }
}

$targetFacts = Resolve-TargetFacts
$targets = @()
if ($null -ne $targetFacts.selected_repo_root) {
  $targets += New-TargetItemFromSelectedRepo -Target $targetFacts
} elseif ($null -ne $targetFacts.candidates) {
  $targets += @($targetFacts.candidates)
}

$repos = @($targets | ForEach-Object { Inspect-Repo -TargetItem $_ })
$primaryCount = @($repos | Where-Object { $_.status -eq 'primary' }).Count

$result = [ordered]@{
  schema_version = 'workspace-graph-targets.v1'
  generated_at = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
  advisory = $true
  mode = [string]($targetFacts.mode ?? 'unknown')
  repo_status = [string]($targetFacts.repo_status ?? 'not-git-repo')
  invocation_cwd = $targetFacts.invocation_cwd
  workspace_root = $targetFacts.workspace_root
  selection_source = [string]($targetFacts.selection_source ?? '')
  state_write_allowed = [bool]($targetFacts.state_write_allowed ?? $false)
  parent_writes_repo_local_artifacts = $false
  repos = @($repos)
  counts = [ordered]@{
    total = $repos.Count
	    primary = $primaryCount
	    degraded = @($repos | Where-Object { $_.status -eq 'degraded-fallback' }).Count
	    no_source = @($repos | Where-Object { $_.status -eq 'no-source' }).Count
	    stale = @($repos | Where-Object { $_.status -eq 'stale' }).Count
    dirty_uncertain = @($repos | Where-Object { $_.status -eq 'dirty-uncertain' }).Count
    setup_ready_bootstrap_required = @($repos | Where-Object { $_.status -eq 'setup-ready-bootstrap-required' }).Count
    unavailable = @($repos | Where-Object { $_.status -eq 'unavailable' }).Count
  }
  reason_code = if ($repos.Count -eq 0) { [string]($targetFacts.reason_code ?? 'workspace-no-git-candidates') } elseif ($primaryCount -gt 0) { 'workspace-graph-targets-ready' } else { 'workspace-graph-targets-degraded' }
  next_action = if ($repos.Count -eq 0) { [string]($targetFacts.next_action ?? 'Run from a Git repo or parent workspace with child Git repos.') } elseif ($primaryCount -gt 0) { 'Use bounded GitNexus-first routing for read-only questions; require target_repo before writes.' } else { 'Use per-child next_action values to bootstrap or refresh graph readiness.' }
}

if ($WriteSummary) {
  $workspaceDir = Join-Path $targetFacts.workspace_root '.spec-first/workspace'
  New-Item -ItemType Directory -Force -Path $workspaceDir | Out-Null
  $summaryPath = Join-Path $workspaceDir 'graph-targets.json'
  $tmpPath = "$summaryPath.tmp"
  [pscustomobject]$result | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $tmpPath -Encoding UTF8
  Move-Item -Force $tmpPath $summaryPath
}

[pscustomobject]$result | ConvertTo-Json -Depth 30 -Compress
