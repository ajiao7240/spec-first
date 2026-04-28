param(
  [string]$FactsFile
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($FactsFile)) {
  throw '-FactsFile is required'
}
if (-not (Test-Path $FactsFile)) {
  throw "facts file not found: $FactsFile"
}

$facts = Get-Content -Raw $FactsFile | ConvertFrom-Json
if ($facts.repo_status -ne 'git-repo') {
  [pscustomobject]@{
    repo_config_status = 'skipped-no-git-repo'
    repo_config_path = $null
    runtime_capabilities_path = $null
    provider_artifacts_path = $null
  } | ConvertTo-Json -Compress
  return
}

$outDir = Join-Path $facts.repo_root '.spec-first/config'
$providerFile = Join-Path $outDir 'graph-providers.json'
$runtimeFile = Join-Path $outDir 'runtime-capabilities.json'
$artifactsFile = Join-Path $outDir 'provider-artifacts.json'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Read-ExistingJson {
  param(
    [string]$Path,
    [string]$SchemaVersion,
    [string]$RepoRoot
  )
  if (-not (Test-Path $Path)) { return $null }
  try {
    $candidate = Get-Content -Raw $Path | ConvertFrom-Json
    if ($candidate.schema_version -eq $SchemaVersion -and $candidate.repo_root -eq $RepoRoot) {
      return $candidate
    }
  } catch {
    return $null
  }
  return $null
}

function Read-CanonicalJson {
  param(
    [string]$Path,
    [string]$SchemaVersion
  )
  if (-not (Test-Path $Path)) { return $null }
  try {
    $candidate = Get-Content -Raw $Path | ConvertFrom-Json
    if ($candidate.schema_version -eq $SchemaVersion) {
      return $candidate
    }
  } catch {
    return $null
  }
  return $null
}

function ConvertTo-ComparableProjectionJson {
  param([object]$Projection)
  if ($null -eq $Projection) { return '' }

  $clone = $Projection | ConvertTo-Json -Depth 30 | ConvertFrom-Json
  if ($clone.PSObject.Properties.Name -contains 'generated_at') {
    $clone.PSObject.Properties.Remove('generated_at')
  }
  return ($clone | ConvertTo-Json -Depth 30 -Compress)
}

function Get-ProviderCommands {
  param(
    [string]$Provider,
    [string]$RepoRoot
  )
  $repoName = Split-Path -Leaf $RepoRoot
  if ($Provider -eq 'gitnexus') {
    return [ordered]@{
      bootstrap = @('npx', '-y', 'gitnexus@latest', 'analyze')
      status = @('npx', '-y', 'gitnexus@latest', 'status')
      query_probe = @('npx', '-y', 'gitnexus@latest', 'query', 'spec-first-readiness-probe', '--repo', $repoName)
    }
  }
  if ($Provider -eq 'code-review-graph') {
    return [ordered]@{
      bootstrap = @('uvx', 'code-review-graph', 'build')
      status = @('uvx', 'code-review-graph', 'status')
      query_probe = @('uvx', 'code-review-graph', 'status', '--repo', $RepoRoot)
    }
  }
  return [ordered]@{}
}

function Get-ProviderArtifacts {
  param([string]$Provider)
  [ordered]@{
    raw_dir = ".spec-first/providers/$Provider/raw"
    normalized_dir = ".spec-first/providers/$Provider/normalized"
    status_path = ".spec-first/providers/$Provider/status.json"
  }
}

function Get-PreviousReadiness {
  param(
    [object]$Existing,
    [string]$Provider,
    [bool]$CanonicalArtifactsCurrent,
    [object]$CanonicalProviderStatus
  )
  if ($CanonicalArtifactsCurrent -and $null -ne $CanonicalProviderStatus -and $null -ne $CanonicalProviderStatus.providers) {
    $matches = @($CanonicalProviderStatus.providers | Where-Object { $_.provider -eq $Provider } | Select-Object -First 1)
    if ($matches.Count -gt 0) {
      $status = $matches[0]
      $queryReady = if ($status.PSObject.Properties.Name -contains 'query_ready') { [bool]$status.query_ready } else { $false }
      return [pscustomobject]@{
        query_ready = $queryReady
        bootstrap_required = -not $queryReady
        last_bootstrap_status = if ($status.PSObject.Properties.Name -contains 'status') { $status.status } else { 'unknown' }
        last_bootstrapped_at = if ($status.PSObject.Properties.Name -contains 'generated_at') { $status.generated_at } else { $null }
        provider_status_artifact = ".spec-first/providers/$Provider/status.json"
      }
    }
  }
  if ($null -ne $Existing -and $null -ne $Existing.derived_readiness -and $null -ne $Existing.derived_readiness.providers -and ($Existing.derived_readiness.providers.PSObject.Properties.Name -contains $Provider)) {
    return $Existing.derived_readiness.providers.PSObject.Properties[$Provider].Value
  }
  if ($null -ne $Existing -and $null -ne $Existing.providers -and ($Existing.providers.PSObject.Properties.Name -contains $Provider)) {
    $legacy = $Existing.providers.PSObject.Properties[$Provider].Value
    return [pscustomobject]@{
      query_ready = if ($legacy.PSObject.Properties.Name -contains 'query_ready') { [bool]$legacy.query_ready } else { $false }
      bootstrap_required = if ($legacy.PSObject.Properties.Name -contains 'bootstrap_required') { [bool]$legacy.bootstrap_required } else { $true }
      last_bootstrap_status = if ($legacy.PSObject.Properties.Name -contains 'last_bootstrap_status') { $legacy.last_bootstrap_status } else { 'not-bootstrapped' }
      last_bootstrapped_at = if ($legacy.PSObject.Properties.Name -contains 'last_bootstrapped_at') { $legacy.last_bootstrapped_at } else { $null }
    }
  }
  [pscustomobject]@{
    query_ready = $false
    bootstrap_required = $true
    last_bootstrap_status = 'not-bootstrapped'
    last_bootstrapped_at = $null
  }
}

function Test-ProviderReady {
  param([object]$Provider)
  return (
    [bool]$Provider.configured -and
    [bool]$Provider.enabled_for_bootstrap -and
    $Provider.dependency_status -eq 'ready' -and
    ($Provider.host_config_status -eq 'ready' -or $Provider.host_config_status -eq 'fallback-active')
  )
}

function Test-ToolReady {
  param([object]$Tool)
  if ($null -eq $Tool) { return $false }
  return (
    $Tool.dependency_status -eq 'ready' -and
    ($Tool.host_config_status -eq 'ready' -or $Tool.host_config_status -eq 'fallback-active') -and
    ($Tool.project_status -eq 'ready' -or $Tool.project_status -eq 'not-applicable')
  )
}

function Test-HelperReady {
  param([object]$Helper)
  if ($null -eq $Helper) { return $false }
  return (($Helper.result | ForEach-Object { if ($_ -eq $null) { 'action-required' } else { $_ } }) -eq 'ready')
}

function Write-JsonIfChanged {
  param(
    [object]$Payload,
    [string]$Path
  )
  $repoConfigStatus = 'written'
  $existing = $null
  if (Test-Path $Path) {
    try { $existing = Get-Content -Raw $Path | ConvertFrom-Json } catch { $existing = $null }
  }
  if ($null -ne $existing -and $existing.PSObject.Properties.Name -contains 'generated_at') {
    $existingComparable = ConvertTo-ComparableProjectionJson -Projection $existing
    $payloadComparable = ConvertTo-ComparableProjectionJson -Projection $Payload
    if ($existingComparable -eq $payloadComparable) {
      $Payload.generated_at = $existing.generated_at
      $repoConfigStatus = 'ready'
    }
  }
  if ($repoConfigStatus -eq 'written') {
    $Payload | ConvertTo-Json -Depth 30 | Set-Content -Encoding utf8 $Path
  }
  return $repoConfigStatus
}

$existingProvider = Read-ExistingJson -Path $providerFile -SchemaVersion 'graph-providers.v1' -RepoRoot $facts.repo_root
$existingRuntime = Read-ExistingJson -Path $runtimeFile -SchemaVersion 'runtime-capabilities.v1' -RepoRoot $facts.repo_root
$generatedAt = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
$graphFactsPath = Join-Path $facts.repo_root '.spec-first/graph/graph-facts.json'
$providerStatusPath = Join-Path $facts.repo_root '.spec-first/graph/provider-status.json'
$impactCapabilitiesPath = Join-Path $facts.repo_root '.spec-first/impact/bootstrap-impact-capabilities.json'
$canonicalArtifactsAvailable = (
  (Test-Path -LiteralPath $graphFactsPath -PathType Leaf) -and
  (Test-Path -LiteralPath $providerStatusPath -PathType Leaf) -and
  (Test-Path -LiteralPath $impactCapabilitiesPath -PathType Leaf)
)
$canonicalGraphFacts = Read-CanonicalJson -Path $graphFactsPath -SchemaVersion 'graph-facts.v1'
$canonicalProviderStatus = Read-CanonicalJson -Path $providerStatusPath -SchemaVersion 'graph-provider-status.v1'
$canonicalImpactCapabilities = Read-CanonicalJson -Path $impactCapabilitiesPath -SchemaVersion 'bootstrap-impact-capabilities.v1'
$canonicalGraphFactsRepoRoot = if ($null -ne $canonicalGraphFacts -and $canonicalGraphFacts.PSObject.Properties.Name -contains 'repo_root') { $canonicalGraphFacts.repo_root } else { $facts.repo_root }
$canonicalArtifactsCurrent = $canonicalArtifactsAvailable -and $null -ne $canonicalGraphFacts -and $null -ne $canonicalProviderStatus -and $null -ne $canonicalImpactCapabilities -and $canonicalGraphFactsRepoRoot -eq $facts.repo_root
$canonicalWorkflowMode = if ($canonicalArtifactsCurrent -and $canonicalProviderStatus.PSObject.Properties.Name -contains 'workflow_mode') {
  $canonicalProviderStatus.workflow_mode
} elseif ($canonicalArtifactsCurrent -and $canonicalGraphFacts.PSObject.Properties.Name -contains 'workflow_mode') {
  $canonicalGraphFacts.workflow_mode
} else {
  $null
}
$canonicalUpdatedAt = if ($canonicalArtifactsCurrent -and $canonicalProviderStatus.PSObject.Properties.Name -contains 'generated_at') {
  $canonicalProviderStatus.generated_at
} elseif ($canonicalArtifactsCurrent -and $canonicalGraphFacts.PSObject.Properties.Name -contains 'generated_at') {
  $canonicalGraphFacts.generated_at
} else {
  $null
}

$providers = [ordered]@{}
$readiness = [ordered]@{}
foreach ($property in $facts.graph_providers.PSObject.Properties) {
  $provider = $property.Value
  $ready = Test-ProviderReady -Provider $provider
  $previous = Get-PreviousReadiness -Existing $existingProvider -Provider $property.Name -CanonicalArtifactsCurrent $canonicalArtifactsCurrent -CanonicalProviderStatus $canonicalProviderStatus
  $preserveQueryReady = (
    $ready -and
    $canonicalArtifactsCurrent -and
    [bool]$previous.query_ready -and
    -not [bool]$previous.bootstrap_required
  )

  $providers[$property.Name] = [ordered]@{
    configured = [bool]$provider.configured
    enabled_for_bootstrap = [bool]$provider.enabled_for_bootstrap
    required = [bool]$provider.required
    role = $provider.role
    mcp_server = $property.Name
    dependency_status = $provider.dependency_status
    host_config_status = $provider.host_config_status
    capabilities = @($provider.capabilities)
    commands = Get-ProviderCommands -Provider $property.Name -RepoRoot $facts.repo_root
    artifacts = Get-ProviderArtifacts -Provider $property.Name
    next_action = if ($ready -and $preserveQueryReady) { '' } elseif ($ready) { 'run spec-graph-bootstrap' } else { 'Fix provider setup and rerun spec-mcp-setup.' }
  }
  $readiness[$property.Name] = [ordered]@{
    query_ready = [bool]$preserveQueryReady
    bootstrap_required = if ($ready) { -not [bool]$preserveQueryReady } else { $true }
    last_bootstrap_status = if ($preserveQueryReady) { if ($previous.last_bootstrap_status) { $previous.last_bootstrap_status } else { 'ready' } } else { 'not-bootstrapped' }
    last_bootstrapped_at = if ($preserveQueryReady) { $previous.last_bootstrapped_at } else { $null }
    provider_status_artifact = ".spec-first/providers/$($property.Name)/status.json"
  }
}

$graphBootstrapRequired = [bool](@($readiness.Values | Where-Object { $_.bootstrap_required }).Count)
$providerPayload = [ordered]@{
  schema_version = 'graph-providers.v1'
  generated_by = 'spec-mcp-setup'
  generated_at = $generatedAt
  repo_root = $facts.repo_root
  providers = $providers
  derived_readiness = [ordered]@{
    updated_by = 'spec-mcp-setup'
    updated_at = if ($canonicalArtifactsCurrent) { $canonicalUpdatedAt } elseif ($graphBootstrapRequired) { $null } elseif ($null -ne $existingProvider -and $null -ne $existingProvider.derived_readiness) { $existingProvider.derived_readiness.updated_at } else { $null }
    workflow_mode = if ($canonicalArtifactsCurrent) { $canonicalWorkflowMode } elseif ($graphBootstrapRequired) { 'setup-ready-bootstrap-required' } elseif ($null -ne $existingProvider -and $null -ne $existingProvider.derived_readiness -and $existingProvider.derived_readiness.workflow_mode) { $existingProvider.derived_readiness.workflow_mode } else { 'setup-ready-bootstrap-required' }
    graph_bootstrap_required = $graphBootstrapRequired
    provider_status_artifact = '.spec-first/graph/provider-status.json'
    graph_facts_artifact = '.spec-first/graph/graph-facts.json'
    impact_capabilities_artifact = '.spec-first/impact/bootstrap-impact-capabilities.json'
    providers = $readiness
  }
  selection = [ordered]@{
    global_knowledge = 'gitnexus'
    impact_context = 'code-review-graph'
    context_selection = 'code-review-graph'
  }
  boundaries = [ordered]@{
    setup_only = $true
    does_not_run_gitnexus_analyze = $true
    does_not_run_code_review_graph_build = $true
    graph_bootstrap_required = $graphBootstrapRequired
  }
}

$serena = if ($facts.tools.PSObject.Properties.Name -contains 'serena') { $facts.tools.serena } else { $null }
$astGrep = if ($facts.helper_tools.PSObject.Properties.Name -contains 'ast-grep') { $facts.helper_tools.'ast-grep' } else { $null }
$serenaReady = Test-ToolReady -Tool $serena
$astGrepReady = Test-HelperReady -Helper $astGrep
$fallbackProviders = @()
if ($serenaReady) { $fallbackProviders += 'serena' }
if ($astGrepReady) { $fallbackProviders += 'ast-grep' }

$projectGraphReadiness = [ordered]@{
  status = 'not-bootstrapped'
  canonical_graph_facts_artifact = '.spec-first/graph/graph-facts.json'
  provider_status_artifact = '.spec-first/graph/provider-status.json'
  impact_capabilities_artifact = '.spec-first/impact/bootstrap-impact-capabilities.json'
  graph_bootstrap_required = $true
  confidence = 'unknown'
  limitations = @('Run spec-graph-bootstrap to compile project graph readiness.')
}
$providerReadinessCurrent = (-not [bool]$providerPayload.derived_readiness.graph_bootstrap_required) -and (@($readiness.Values | Where-Object { $_.query_ready }).Count -gt 0)
$existingProjectGraphCurrent = (
  $null -ne $existingRuntime -and
  $null -ne $existingRuntime.project_graph_readiness -and
  ($existingRuntime.project_graph_readiness.status -ne 'not-bootstrapped') -and
  (-not [bool]$existingRuntime.project_graph_readiness.graph_bootstrap_required)
)
if ($canonicalArtifactsCurrent -and $existingProjectGraphCurrent) {
  $projectGraphReadiness = $existingRuntime.project_graph_readiness
} elseif ($canonicalArtifactsCurrent) {
  $canonicalConfidence = if ($canonicalGraphFacts.PSObject.Properties.Name -contains 'confidence') { $canonicalGraphFacts.confidence } else { 'medium' }
  $projectGraphReadiness = [ordered]@{
    status = $canonicalWorkflowMode
    canonical_graph_facts_artifact = '.spec-first/graph/graph-facts.json'
    provider_status_artifact = '.spec-first/graph/provider-status.json'
    impact_capabilities_artifact = '.spec-first/impact/bootstrap-impact-capabilities.json'
    graph_bootstrap_required = ($canonicalWorkflowMode -ne 'primary')
    updated_by = 'spec-mcp-setup'
    updated_at = $canonicalUpdatedAt
    confidence = $canonicalConfidence
    limitations = @('Setup projection derived from canonical graph artifacts; canonical readiness truth is under .spec-first/graph/ and .spec-first/impact/.')
  }
}

$runtimePayload = [ordered]@{
  schema_version = 'runtime-capabilities.v1'
  generated_by = 'spec-mcp-setup'
  generated_at = $generatedAt
  repo_root = $facts.repo_root
  host = $facts.host
  platform = $facts.platform
  repo_status = $facts.repo_status
  host_ledger_pointer = $facts.host_ledger_pointer
  baseline_summary = [ordered]@{
    baseline_ready = [bool]$facts.baseline_ready
    host_runtime_ready = [bool]$facts.host_runtime_ready
    source = 'host-readiness-ledger-v2'
  }
  fallback_tools = [ordered]@{
    serena = [ordered]@{
      support_level = if ($serenaReady) { 'partial' } else { 'none' }
      readiness_status = if ($serenaReady) { 'ready' } else { 'action-required' }
      confidence = if ($serenaReady) { 'medium' } else { 'low' }
      capabilities = @('symbol_overview', 'symbol_lookup', 'references')
      limitations = if ($serenaReady) { @() } else { @('Serena is not ready.') }
    }
    'ast-grep' = [ordered]@{
      support_level = if ($astGrepReady) { 'partial' } else { 'none' }
      readiness_status = if ($astGrepReady) { 'ready' } else { 'action-required' }
      confidence = if ($astGrepReady) { 'medium' } else { 'low' }
      capabilities = @('structural_search', 'safe_rewrite')
      limitations = if ($astGrepReady) { @() } else { @('ast-grep helper is not ready.') }
    }
  }
  fallback_capabilities = [ordered]@{
    context_selection = [ordered]@{
      support_level = if ($serenaReady -or $astGrepReady) { 'partial' } else { 'none' }
      confidence = if ($serenaReady -or $astGrepReady) { 'medium' } else { 'low' }
      providers = @($fallbackProviders)
      limitations = @('Fallback context is bounded local repo reads, not compiled graph evidence.')
    }
    impact_radius = [ordered]@{
      support_level = if ($astGrepReady) { 'partial' } else { 'none' }
      confidence = if ($astGrepReady) { 'low' } else { 'unknown' }
      providers = if ($astGrepReady) { @('ast-grep') } else { @() }
      limitations = @('Fallback impact is heuristic and does not replace graph-provider impact radius.')
    }
    review_support = [ordered]@{
      support_level = if ($astGrepReady) { 'partial' } else { 'none' }
      confidence = if ($astGrepReady) { 'low' } else { 'unknown' }
      providers = if ($astGrepReady) { @('ast-grep') } else { @() }
      limitations = @('Fallback review support has no canonical graph facts.')
    }
  }
  project_graph_readiness = $projectGraphReadiness
}

$artifactProviders = [ordered]@{}
foreach ($name in $providers.Keys) {
  $rawLogs = if ($name -eq 'gitnexus') {
    [ordered]@{
      bootstrap = '.spec-first/providers/gitnexus/raw/analyze.log'
      status = '.spec-first/providers/gitnexus/raw/status.log'
      query_probe = '.spec-first/providers/gitnexus/raw/query.log'
    }
  } else {
    [ordered]@{
      bootstrap = '.spec-first/providers/code-review-graph/raw/build.log'
      status = '.spec-first/providers/code-review-graph/raw/status.log'
      query_probe = '.spec-first/providers/code-review-graph/raw/query.log'
    }
  }
  $normalized = if ($name -eq 'gitnexus') {
    [ordered]@{
      architecture_facts = '.spec-first/providers/gitnexus/normalized/architecture-facts.json'
      reuse_candidates = '.spec-first/providers/gitnexus/normalized/reuse-candidates.json'
    }
  } else {
    [ordered]@{
      impact_capabilities = '.spec-first/providers/code-review-graph/normalized/impact-capabilities.json'
    }
  }
  $artifactProviders[$name] = [ordered]@{
    raw_dir = ".spec-first/providers/$name/raw"
    normalized_dir = ".spec-first/providers/$name/normalized"
    status_path = ".spec-first/providers/$name/status.json"
    raw_logs = $rawLogs
    normalized_artifacts = $normalized
  }
}

$artifactsPayload = [ordered]@{
  schema_version = 'provider-artifacts.v1'
  generated_by = 'spec-mcp-setup'
  generated_at = $generatedAt
  repo_root = $facts.repo_root
  providers = $artifactProviders
  canonical = [ordered]@{
    provider_status = '.spec-first/graph/provider-status.json'
    graph_facts = '.spec-first/graph/graph-facts.json'
    bootstrap_report = '.spec-first/graph/bootstrap-report.md'
    impact_capabilities = '.spec-first/impact/bootstrap-impact-capabilities.json'
  }
}

$providerStatus = Write-JsonIfChanged -Payload ([pscustomobject]$providerPayload) -Path $providerFile
$runtimeStatus = Write-JsonIfChanged -Payload ([pscustomobject]$runtimePayload) -Path $runtimeFile
$artifactsStatus = Write-JsonIfChanged -Payload ([pscustomobject]$artifactsPayload) -Path $artifactsFile

[pscustomobject]@{
  repo_config_status = $providerStatus
  repo_config_path = $providerFile
  runtime_capabilities_status = $runtimeStatus
  runtime_capabilities_path = $runtimeFile
  provider_artifacts_status = $artifactsStatus
  provider_artifacts_path = $artifactsFile
  graph_bootstrap_required = $graphBootstrapRequired
  providers = $readiness
} | ConvertTo-Json -Compress -Depth 20
