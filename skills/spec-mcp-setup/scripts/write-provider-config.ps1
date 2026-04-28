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

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$skillDir = Split-Path -Parent $scriptDir
$toolsJsonPath = Join-Path $skillDir 'mcp-tools.json'
if (-not (Test-Path $toolsJsonPath)) {
  throw "mcp-tools.json not found: $toolsJsonPath"
}

$facts = Get-Content -Raw $FactsFile | ConvertFrom-Json
$targetWriteAllowed = if ($null -ne $facts.PSObject.Properties['target']) { [bool]$facts.target.state_write_allowed } else { $facts.repo_status -eq 'git-repo' }
$targetReasonCode = if ($null -ne $facts.PSObject.Properties['target'] -and -not [string]::IsNullOrWhiteSpace([string]$facts.target.reason_code)) { [string]$facts.target.reason_code } else { 'skipped-no-git-repo' }
if (-not $targetWriteAllowed -or $facts.repo_status -ne 'git-repo') {
  [pscustomobject]@{
    repo_config_status = $targetReasonCode
    repo_config_path = $null
    runtime_capabilities_status = $targetReasonCode
    runtime_capabilities_path = $null
    provider_artifacts_status = $targetReasonCode
    provider_artifacts_path = $null
    graph_bootstrap_required = $true
    reason_code = $targetReasonCode
    next_action = if ($null -ne $facts.PSObject.Properties['target']) { [string]$facts.target.next_action } else { 'Choose a Git repo target and rerun spec-mcp-setup with --repo <child>.' }
    candidates = if ($null -ne $facts.PSObject.Properties['target']) { @($facts.target.candidates) } else { @() }
  } | ConvertTo-Json -Compress
  return
}

$repoRoot = if ($null -ne $facts.PSObject.Properties['selected_repo_root'] -and -not [string]::IsNullOrWhiteSpace([string]$facts.selected_repo_root)) { [string]$facts.selected_repo_root } else { [string]$facts.repo_root }
$outDir = Join-Path $repoRoot '.spec-first/config'
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
    [string]$RepoRoot,
    [string]$GitNexusPackageSpec,
    [object]$GitNexusQueryProbePolicy
  )
  $repoName = Split-Path -Leaf $RepoRoot
  if ($Provider -eq 'gitnexus') {
    return [ordered]@{
      bootstrap = @('npx', '-y', $GitNexusPackageSpec, 'analyze', '--force')
      status = @('npx', '-y', $GitNexusPackageSpec, 'status')
      query_probe = @('npx', '-y', $GitNexusPackageSpec, 'query', [string]$GitNexusQueryProbePolicy.token, '--repo', $repoName)
    }
  }
  if ($Provider -eq 'code-review-graph') {
    return [ordered]@{
      bootstrap = @('uvx', '--upgrade', 'code-review-graph', 'build')
      status = @('uvx', '--upgrade', 'code-review-graph', 'status')
      query_probe = @('uvx', '--upgrade', 'code-review-graph', 'status', '--repo', $RepoRoot)
    }
  }
  return [ordered]@{}
}

function Test-GitNexusProbePathExcluded {
  param([string]$Path)
  return ($Path -match '(^|/)(\.spec-first|\.gitnexus|\.code-review-graph|\.agents|\.codex|\.claude|\.serena|node_modules|vendor|build|cache|runtime|generated|\.gradle|test|tests|androidTest)(/|$)' -or
    $Path -match '\.(jar|aar|apk|dex|so|dylib|class|png|jpg|jpeg|gif|webp|zip|tar|gz|tgz|mp4|mov|pdf)$')
}

function Test-GitNexusProbeSourcePath {
  param([string]$Path)
  return ($Path -match '\.(kt|java|ts|tsx|js|jsx|mjs|cjs|py|go|rb|php|rs|c|cc|cpp|h|hpp|swift)$')
}

function Get-GitNexusProbeTokenFromPath {
  param([string]$Path)
  $base = [System.IO.Path]::GetFileName($Path)
  $token = [System.IO.Path]::GetFileNameWithoutExtension($base)
  if ($token -match '^[A-Za-z_][A-Za-z0-9_]*$') {
    return $token
  }
  return ''
}

function Get-GitNexusQueryProbePolicy {
  param([string]$RepoRoot)
  $files = @()
  try {
    $files = @(git -C $RepoRoot ls-files 2>$null)
  } catch {
    $files = @()
  }

  foreach ($priority in @('android_named', 'named', 'any_source')) {
    foreach ($path in $files) {
      if (Test-GitNexusProbePathExcluded -Path $path) { continue }
      if (-not (Test-GitNexusProbeSourcePath -Path $path)) { continue }
      $token = Get-GitNexusProbeTokenFromPath -Path $path
      if ([string]::IsNullOrWhiteSpace($token)) { continue }
      if ($priority -eq 'android_named') {
        if ($path -notmatch '\.(kt|java)$') { continue }
        if ($token -notmatch '(Activity|Fragment|ViewModel|Manager|Repository|Service)$') { continue }
      } elseif ($priority -eq 'named') {
        if ($token -notmatch '(Activity|Fragment|ViewModel|Manager|Repository|Service)$') { continue }
      }

      return [ordered]@{
        expected_hit = $true
        source = 'git-ls-files-code-basename'
        token = $token
        selected_from = $path
      }
    }
  }

  return [ordered]@{
    expected_hit = $false
    source = 'fallback-static'
    token = 'main src build README package'
    selected_from = $null
  }
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

$existingProvider = Read-ExistingJson -Path $providerFile -SchemaVersion 'graph-providers.v1' -RepoRoot $repoRoot
$existingRuntime = Read-ExistingJson -Path $runtimeFile -SchemaVersion 'runtime-capabilities.v1' -RepoRoot $repoRoot
$generatedAt = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
$toolsJson = Get-Content -Raw $toolsJsonPath | ConvertFrom-Json
$gitNexusTool = @($toolsJson.tools | Where-Object { $_.id -eq 'gitnexus' } | Select-Object -First 1)
if ($gitNexusTool.Count -eq 0 -or $null -eq $gitNexusTool[0].installation -or $null -eq $gitNexusTool[0].installation.unix -or @($gitNexusTool[0].installation.unix.args).Count -lt 2) {
  throw 'GitNexus package spec not found in mcp-tools.json'
}
$gitNexusPackageSpec = [string]$gitNexusTool[0].installation.unix.args[1]
if ([string]::IsNullOrWhiteSpace($gitNexusPackageSpec)) {
  throw 'GitNexus package spec not found in mcp-tools.json'
}
$gitNexusQueryProbePolicy = Get-GitNexusQueryProbePolicy -RepoRoot $repoRoot
$graphFactsPath = Join-Path $repoRoot '.spec-first/graph/graph-facts.json'
$providerStatusPath = Join-Path $repoRoot '.spec-first/graph/provider-status.json'
$impactCapabilitiesPath = Join-Path $repoRoot '.spec-first/impact/bootstrap-impact-capabilities.json'
$canonicalArtifactsAvailable = (
  (Test-Path -LiteralPath $graphFactsPath -PathType Leaf) -and
  (Test-Path -LiteralPath $providerStatusPath -PathType Leaf) -and
  (Test-Path -LiteralPath $impactCapabilitiesPath -PathType Leaf)
)
$canonicalGraphFacts = Read-CanonicalJson -Path $graphFactsPath -SchemaVersion 'graph-facts.v1'
$canonicalProviderStatus = Read-CanonicalJson -Path $providerStatusPath -SchemaVersion 'graph-provider-status.v1'
$canonicalImpactCapabilities = Read-CanonicalJson -Path $impactCapabilitiesPath -SchemaVersion 'bootstrap-impact-capabilities.v1'
$canonicalGraphFactsRepoRoot = if ($null -ne $canonicalGraphFacts -and $canonicalGraphFacts.PSObject.Properties.Name -contains 'repo_root') { $canonicalGraphFacts.repo_root } else { $repoRoot }
$canonicalArtifactsCurrent = $canonicalArtifactsAvailable -and $null -ne $canonicalGraphFacts -and $null -ne $canonicalProviderStatus -and $null -ne $canonicalImpactCapabilities -and $canonicalGraphFactsRepoRoot -eq $repoRoot
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
    commands = Get-ProviderCommands -Provider $property.Name -RepoRoot $repoRoot -GitNexusPackageSpec $gitNexusPackageSpec -GitNexusQueryProbePolicy $gitNexusQueryProbePolicy
    query_probe_policy = if ($property.Name -eq 'gitnexus') { $gitNexusQueryProbePolicy } else { $null }
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
  repo_root = $repoRoot
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
if ($canonicalArtifactsCurrent) {
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
  repo_root = $repoRoot
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
  repo_root = $repoRoot
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
