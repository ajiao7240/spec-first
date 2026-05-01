param(
  [string]$Repo = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-ResultAndExit {
  param(
    [string]$WorkflowMode,
    [string]$ReasonCode,
    [string]$NextAction,
    [int]$ExitCode = 1
  )
  [pscustomobject]@{
    schema_version = 'graph-bootstrap-result.v1'
    overall_status = 'action-required'
    workflow_mode = $WorkflowMode
    reason_code = $ReasonCode
    next_action = $NextAction
  } | ConvertTo-Json -Compress
  exit $ExitCode
}

function Read-JsonFile {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "missing JSON file: $Path"
  }
  Get-Content -Raw $Path | ConvertFrom-Json
}

function Assert-Schema {
  param(
    [string]$Path,
    [string]$SchemaVersion,
    [string]$MissingReason
  )
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    Write-ResultAndExit -WorkflowMode 'blocked' -ReasonCode $MissingReason -NextAction 'Run spec-mcp-setup inside this git repo first.'
  }
  $json = Read-JsonFile -Path $Path
  if ($json.schema_version -ne $SchemaVersion) {
    Write-ResultAndExit -WorkflowMode 'blocked' -ReasonCode 'schema-unsupported' -NextAction 'Rerun spec-mcp-setup to regenerate v1 config artifacts.'
  }
  return $json
}

function Resolve-PointerPath {
  param([string]$Path)
  if ($Path.StartsWith('~/')) {
    return (Join-Path $HOME $Path.Substring(2))
  }
  if ($Path.StartsWith('$HOME/')) {
    return (Join-Path $HOME $Path.Substring(6))
  }
  return $Path
}

function Write-TextFileAtomic {
  param(
    [string]$Path,
    [string]$Value
  )
  $tmp = "$Path.$([guid]::NewGuid().ToString('N')).tmp"
  Set-Content -Encoding utf8 -Path $tmp -Value $Value
  Move-Item -Force -Path $tmp -Destination $Path
}

function Write-JsonFileAtomic {
  param(
    [string]$Path,
    [object]$Payload,
    [int]$Depth = 20
  )
  Write-TextFileAtomic -Path $Path -Value ($Payload | ConvertTo-Json -Depth $Depth)
}

function Test-CommandShapeSupported {
  param(
    [object]$ProviderConfig,
    [string]$Provider,
    [string]$Kind,
    [string]$RepoRoot
  )
  $actual = @($ProviderConfig.providers.$Provider.commands.$Kind)
  if ($actual.Count -eq 0) { return $false }
  foreach ($arg in $actual) {
    if ($arg -isnot [string]) { return $false }
    if ([string]$arg -match '[;&|`$<>]') { return $false }
  }

  if ($Provider -eq 'gitnexus') {
    $subcommand = switch ($Kind) {
      'bootstrap' { 'analyze' }
      'status' { 'status' }
      'query_probe' { 'query' }
      default { $null }
    }
    if ($Kind -eq 'query_probe') {
      return (
        $actual.Count -eq 7 -and
        [string]$actual[0] -eq 'npx' -and
        [string]$actual[1] -eq '-y' -and
        [string]$actual[2] -match '^gitnexus(@[A-Za-z0-9._~+:-]+)?$' -and
        [string]$actual[3] -eq 'query' -and
        ([string]$actual[4]).Length -gt 0 -and
        [string]$actual[5] -eq '--repo' -and
        ([string]$actual[6]).Length -gt 0
      )
    }
    if ($Kind -eq 'bootstrap') {
      return (
        (
          $actual.Count -eq 4 -and
          [string]$actual[0] -eq 'npx' -and
          [string]$actual[1] -eq '-y' -and
          [string]$actual[2] -match '^gitnexus(@[A-Za-z0-9._~+:-]+)?$' -and
          [string]$actual[3] -eq 'analyze'
        ) -or (
          $actual.Count -eq 5 -and
          [string]$actual[0] -eq 'npx' -and
          [string]$actual[1] -eq '-y' -and
          [string]$actual[2] -match '^gitnexus(@[A-Za-z0-9._~+:-]+)?$' -and
          [string]$actual[3] -eq 'analyze' -and
          [string]$actual[4] -eq '--force'
        )
      )
    }
    return (
      $null -ne $subcommand -and
      $actual.Count -eq 4 -and
      [string]$actual[0] -eq 'npx' -and
      [string]$actual[1] -eq '-y' -and
      [string]$actual[2] -match '^gitnexus(@[A-Za-z0-9._~+:-]+)?$' -and
      [string]$actual[3] -eq $subcommand
    )
  }

  if ($Provider -eq 'code-review-graph') {
    $tail = @()
    if ($actual.Count -ge 3 -and [string]$actual[0] -eq 'uvx' -and ([string]$actual[1] -eq '--upgrade' -or [string]$actual[1] -eq '--refresh') -and [string]$actual[2] -eq 'code-review-graph') {
      $tail = @($actual | Select-Object -Skip 3)
    } elseif ($actual.Count -ge 2 -and [string]$actual[0] -eq 'uvx' -and [string]$actual[1] -eq 'code-review-graph') {
      $tail = @($actual | Select-Object -Skip 2)
    }
    if ($Kind -eq 'bootstrap') {
      return ($tail.Count -eq 1 -and [string]$tail[0] -eq 'build')
    }
    if ($Kind -eq 'status') {
      return ($tail.Count -eq 1 -and [string]$tail[0] -eq 'status')
    }
    if ($Kind -eq 'query_probe') {
      return ($tail.Count -eq 3 -and [string]$tail[0] -eq 'status' -and [string]$tail[1] -eq '--repo' -and [string]$tail[2] -eq $RepoRoot)
    }
  }

  return $false
}

function Test-ProviderEnabled {
  param(
    [object]$ProviderConfig,
    [string]$Provider
  )
  $entry = $ProviderConfig.providers.$Provider
  $hostConfigRequired = if ($entry.PSObject.Properties.Name -contains 'host_config_required') { [bool]$entry.host_config_required } else { $true }
  $hostReady = (
    $entry.host_config_status -eq 'ready' -or
    $entry.host_config_status -eq 'fallback-active' -or
    (-not $hostConfigRequired -and $entry.host_config_status -eq 'not-required')
  )
  return (
    [bool]$entry.configured -and
    [bool]$entry.enabled_for_bootstrap -and
    $entry.dependency_status -eq 'ready' -and
    $hostReady
  )
}

function Invoke-ConfiguredCommand {
  param(
    [object]$ProviderConfig,
    [string]$Provider,
    [string]$Kind,
    [string]$LogPath,
    [string]$RepoRoot
  )
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $LogPath) | Out-Null
  $command = @($ProviderConfig.providers.$Provider.commands.$Kind)
  $exe = [string]$command[0]
  $args = @($command | Select-Object -Skip 1)
  $output = New-Object System.Collections.Generic.List[string]
  $exitCode = 0
  [Console]::Error.WriteLine("spec-graph-bootstrap: running $Provider $Kind; dependencies may download on first use...")
  Push-Location $RepoRoot
  try {
    $global:LASTEXITCODE = 0
    $captured = & $exe @args 2>&1
    foreach ($line in @($captured)) { $output.Add([string]$line) }
    if ($LASTEXITCODE -is [int]) { $exitCode = $LASTEXITCODE }
  } catch {
    $exitCode = if ($LASTEXITCODE -is [int] -and $LASTEXITCODE -ne 0) { $LASTEXITCODE } else { 1 }
    $output.Add([string]$_.Exception.Message)
  } finally {
    Pop-Location
  }
  [Console]::Error.WriteLine("spec-graph-bootstrap: finished $Provider $Kind with exit $exitCode")
  $outputText = ($output -join [Environment]::NewLine)
  Set-Content -Encoding utf8 -Path $LogPath -Value $outputText
  $diagnostic = (($output -join ' ') -replace '\s+', ' ').Trim()
  $truncated = $false
  if ($diagnostic.Length -gt 1000) {
    $diagnostic = $diagnostic.Substring(0, 1000)
    $truncated = $true
  }
  [pscustomobject]@{
    kind = $Kind
    command = ($command -join ' ')
    exit_code = $exitCode
    diagnostic = $diagnostic
    diagnostics_truncated = $truncated
    raw_log = $LogPath.Replace("$RepoRoot/", '')
  }
}

$script:QueryProbeVerificationReason = ''

function Test-GitNexusQueryProbeVerified {
  param(
    [object]$CommandResult,
    [string]$LogPath
  )
  $script:QueryProbeVerificationReason = ''
  $badDiagnosticPattern = 'FTS index ensure failed|Cannot execute write operations in a read-only database|doesn.?t have an index|Connection exception|BM25/FTS search failed|FTS extension unavailable|missing[ -]index'
  if ([string]$CommandResult.diagnostic -match $badDiagnosticPattern) {
    $script:QueryProbeVerificationReason = 'GitNexus query probe emitted FTS/read-only/missing-index diagnostics.'
    return $false
  }
  $logText = if (Test-Path -LiteralPath $LogPath -PathType Leaf) { Get-Content -Raw -LiteralPath $LogPath } else { '' }
  $jsonMatch = [regex]::Match($logText, '(?ms)^[ \t]*\{.*\}\s*$')
  if (-not $jsonMatch.Success) {
    $script:QueryProbeVerificationReason = 'GitNexus query probe did not return parseable JSON.'
    return $false
  }
  try {
    $payload = $jsonMatch.Value | ConvertFrom-Json
  } catch {
    $script:QueryProbeVerificationReason = 'GitNexus query probe did not return parseable JSON.'
    return $false
  }
  if ($payload.PSObject.Properties.Name -contains 'warning') {
    $script:QueryProbeVerificationReason = 'GitNexus query probe returned a warning payload.'
    return $false
  }
  $resultCount = 0
  foreach ($propertyName in @('processes', 'process_symbols')) {
    if ($payload.PSObject.Properties.Name -contains $propertyName -and $null -ne $payload.$propertyName) {
      $resultCount += @($payload.$propertyName).Count
    }
  }
  if ($resultCount -le 0) {
    $script:QueryProbeVerificationReason = 'GitNexus query probe did not return non-empty BM25/process query results.'
  }
  return ($resultCount -gt 0)
}

function Get-ProviderFailureInfo {
  param(
    [string]$Provider,
    [string]$Phase,
    [int]$ExitCode
  )
  if ($Provider -eq 'gitnexus' -and $Phase -eq 'bootstrap' -and $ExitCode -eq 139) {
    return [ordered]@{
      failed_phase = 'bootstrap'
      failure_class = 'provider-crash'
      reason_code = 'gitnexus-analyze-sigsegv'
      exit_code = $ExitCode
      recommended_action = 'Do not trust GitNexus artifacts. Use code-review-graph and bounded local fallback; capture analyze.log and retry with a newer GitNexus rc or safer GitNexus runtime settings.'
    }
  }
  if ($ExitCode -ne 0) {
    return [ordered]@{
      failed_phase = $Phase
      failure_class = 'provider-command-failed'
      reason_code = 'provider-command-failed'
      exit_code = $ExitCode
      recommended_action = 'Inspect the provider raw log and rerun graph bootstrap after fixing the provider command failure.'
    }
  }
  return [ordered]@{
    failed_phase = $null
    failure_class = $null
    reason_code = $null
    exit_code = $null
    recommended_action = $null
  }
}

function Test-QueryProbeVerified {
  param(
    [string]$Provider,
    [object]$CommandResult,
    [string]$LogPath
  )
  if ($Provider -ne 'gitnexus') {
    return $true
  }
  return (Test-GitNexusQueryProbeVerified -CommandResult $CommandResult -LogPath $LogPath)
}

function Get-ProviderSkipReason {
  param([object]$Entry)
  $hostConfigRequired = if ($Entry.PSObject.Properties.Name -contains 'host_config_required') { [bool]$Entry.host_config_required } else { $true }
  $hostReady = (
    $Entry.host_config_status -eq 'ready' -or
    $Entry.host_config_status -eq 'fallback-active' -or
    (-not $hostConfigRequired -and $Entry.host_config_status -eq 'not-required')
  )
  if (-not [bool]$Entry.configured) { return 'not-configured' }
  if (-not [bool]$Entry.enabled_for_bootstrap) { return 'disabled-for-bootstrap' }
  if ($Entry.dependency_status -ne 'ready') { return 'dependency-not-ready' }
  if (-not $hostReady) { return 'host-not-ready' }
  return ''
}

function Get-ProviderSkipLimitations {
  param([string]$SkipReason)
  switch ($SkipReason) {
    'not-configured' { return @('Provider is not configured.') }
    'disabled-for-bootstrap' { return @('Provider is disabled for bootstrap.') }
    'dependency-not-ready' { return @('Provider dependency is not ready.') }
    'host-not-ready' { return @('Provider host configuration is not ready.') }
    default { return @('Provider is not configured for bootstrap.') }
  }
}

function Write-NormalizedArtifacts {
  param(
    [string]$Provider,
    [string]$StatusPath,
    [bool]$QueryReady,
    [string]$BootstrappedAt,
    [string]$ProvidersDir
  )
  $normalizedDir = Join-Path (Join-Path $ProvidersDir $Provider) 'normalized'
  New-Item -ItemType Directory -Force -Path $normalizedDir | Out-Null
  $sourceStatusPath = ".spec-first/providers/$Provider/status.json"

  if ($Provider -eq 'gitnexus') {
    foreach ($artifact in @('architecture-facts', 'reuse-candidates')) {
      $payload = [ordered]@{
        schema_version = 'provider-normalized-envelope.v1'
        provider = $Provider
        generated_at = $BootstrappedAt
        source_status_path = $sourceStatusPath
        source_raw_logs = @('.spec-first/providers/gitnexus/raw/analyze.log', '.spec-first/providers/gitnexus/raw/status.log', '.spec-first/providers/gitnexus/raw/query.log')
        available_query_surfaces = if ($QueryReady) { @('status', 'query') } else { @() }
        capabilities = @('architecture_map', 'dependency_map', 'execution_flow', 'repo_wiki', 'query_global_graph')
        confidence = if ($QueryReady) { 'high' } else { 'low' }
        limitations = if ($QueryReady) { @() } else { @('Provider query readiness is not verified.') }
      }
      Write-JsonFileAtomic -Path (Join-Path $normalizedDir "$artifact.json") -Payload ([pscustomobject]$payload) -Depth 20
    }
  } else {
    $payload = [ordered]@{
      schema_version = 'provider-normalized-envelope.v1'
      provider = $Provider
      generated_at = $BootstrappedAt
      source_status_path = $sourceStatusPath
      source_raw_logs = @('.spec-first/providers/code-review-graph/raw/build.log', '.spec-first/providers/code-review-graph/raw/status.log', '.spec-first/providers/code-review-graph/raw/query.log')
      available_query_surfaces = if ($QueryReady) { @('status', 'query_graph_tool', 'get_impact_radius_tool') } else { @() }
      capabilities = @('detect_changes', 'blast_radius', 'minimal_context', 'review_context', 'related_tests', 'graph_stats')
      confidence = if ($QueryReady) { 'medium' } else { 'low' }
      limitations = if ($QueryReady) { @('code-review-graph query-surface proof is conservative and should be treated as provider readiness, not semantic evidence.') } else { @('Provider query readiness is not verified.') }
    }
    Write-JsonFileAtomic -Path (Join-Path $normalizedDir 'impact-capabilities.json') -Payload ([pscustomobject]$payload) -Depth 20
  }
}

function Get-FallbackCapability {
  param(
    [object]$RuntimeCapabilities,
    [string]$Name
  )
  if ($null -ne $RuntimeCapabilities.fallback_capabilities -and ($RuntimeCapabilities.fallback_capabilities.PSObject.Properties.Name -contains $Name)) {
    return $RuntimeCapabilities.fallback_capabilities.PSObject.Properties[$Name].Value
  }
  return [pscustomobject]@{
    support_level = 'none'
    confidence = 'unknown'
    providers = @()
    limitations = @()
  }
}

function Test-FallbackSupported {
  param([object]$Fallback)
  return ($null -ne $Fallback -and $Fallback.support_level -and $Fallback.support_level -ne 'none')
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$resolverPath = Join-Path (Split-Path -Parent (Split-Path -Parent $scriptDir)) 'spec-mcp-setup/scripts/resolve-project-target.ps1'
$resolverParams = @{ Format = 'json' }
if (-not [string]::IsNullOrWhiteSpace($Repo)) { $resolverParams.Repo = $Repo }
$targetFacts = (& $resolverPath @resolverParams) | ConvertFrom-Json
if (-not [bool]$targetFacts.state_write_allowed) {
  [pscustomobject]@{
    schema_version = 'graph-bootstrap-result.v1'
    overall_status = 'action-required'
    workflow_mode = 'blocked'
    reason_code = if ([string]::IsNullOrWhiteSpace([string]$targetFacts.reason_code)) { 'workspace-target-required' } else { [string]$targetFacts.reason_code }
    workspace_root = $targetFacts.workspace_root
    candidates = @($targetFacts.candidates)
    next_action = $targetFacts.next_action
  } | ConvertTo-Json -Compress
  exit 1
}

$repoRoot = [string]$targetFacts.selected_repo_root
$invocationWorkspaceRoot = [string]$targetFacts.workspace_root
$selectionSource = [string]$targetFacts.selection_source
$specDir = Join-Path $repoRoot '.spec-first'
$configDir = Join-Path $specDir 'config'
$providerConfigPath = Join-Path $configDir 'graph-providers.json'
$runtimeCapabilitiesPath = Join-Path $configDir 'runtime-capabilities.json'
$providerArtifactsPath = Join-Path $configDir 'provider-artifacts.json'
$graphDir = Join-Path $specDir 'graph'
$impactDir = Join-Path $specDir 'impact'
$providersDir = Join-Path $specDir 'providers'
New-Item -ItemType Directory -Force -Path $graphDir, $impactDir, $providersDir | Out-Null

$providerConfig = Assert-Schema -Path $providerConfigPath -SchemaVersion 'graph-providers.v1' -MissingReason 'missing_provider_config'
$runtimeCapabilities = Assert-Schema -Path $runtimeCapabilitiesPath -SchemaVersion 'runtime-capabilities.v1' -MissingReason 'missing_runtime_capabilities'
$providerArtifacts = Assert-Schema -Path $providerArtifactsPath -SchemaVersion 'provider-artifacts.v1' -MissingReason 'missing_provider_artifacts'

$ledgerPointer = $runtimeCapabilities.host_ledger_pointer.path
if ([string]::IsNullOrWhiteSpace($ledgerPointer)) {
  Write-ResultAndExit -WorkflowMode 'blocked' -ReasonCode 'readiness-conflict' -NextAction 'Rerun spec-mcp-setup to write host_ledger_pointer.'
}
$ledgerPath = Resolve-PointerPath -Path $ledgerPointer
if (-not (Test-Path -LiteralPath $ledgerPath -PathType Leaf)) {
  Write-ResultAndExit -WorkflowMode 'blocked' -ReasonCode 'readiness-conflict' -NextAction 'Rerun spec-mcp-setup; host readiness ledger pointer is not readable.'
}
$ledger = Read-JsonFile -Path $ledgerPath
if ($ledger.schema_version -ne 'v2') {
  Write-ResultAndExit -WorkflowMode 'blocked' -ReasonCode 'schema-unsupported' -NextAction 'Rerun spec-mcp-setup to write readiness ledger v2.'
}
if ($runtimeCapabilities.baseline_summary.baseline_ready -ne $ledger.baseline_ready) {
  Write-ResultAndExit -WorkflowMode 'blocked' -ReasonCode 'readiness-conflict' -NextAction 'Rerun spec-mcp-setup; runtime capabilities and host ledger disagree.'
}
if (-not [bool]$ledger.baseline_ready) {
  Write-ResultAndExit -WorkflowMode 'setup-not-ready' -ReasonCode 'baseline_not_ready' -NextAction 'Fix Required Harness Runtime setup, then rerun spec-mcp-setup.'
}

foreach ($property in $providerConfig.providers.PSObject.Properties) {
  if ($property.Name -ne 'gitnexus' -and $property.Name -ne 'code-review-graph') {
    Write-ResultAndExit -WorkflowMode 'blocked' -ReasonCode 'unsupported-provider-command' -NextAction "Unsupported graph provider id: $($property.Name)"
  }
  foreach ($kind in @('bootstrap', 'status', 'query_probe')) {
    if (-not (Test-CommandShapeSupported -ProviderConfig $providerConfig -Provider $property.Name -Kind $kind -RepoRoot $repoRoot)) {
      Write-ResultAndExit -WorkflowMode 'blocked' -ReasonCode 'unsupported-provider-command' -NextAction "Provider command shape is unsupported for $($property.Name):$kind."
    }
  }
}

$bootstrappedAt = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
$sourceRevision = (git -C $repoRoot rev-parse HEAD 2>$null)
$worktreeDirty = -not [string]::IsNullOrWhiteSpace((git -C $repoRoot status --porcelain 2>$null))
$providerStatuses = New-Object System.Collections.Generic.List[object]

foreach ($property in $providerConfig.providers.PSObject.Properties) {
  $provider = $property.Name
  $entry = $property.Value
  $providerDir = Join-Path $providersDir $provider
  $rawDir = Join-Path $providerDir 'raw'
  $normalizedDir = Join-Path $providerDir 'normalized'
  New-Item -ItemType Directory -Force -Path $rawDir, $normalizedDir | Out-Null
  $commandResults = New-Object System.Collections.Generic.List[object]
  $status = 'skipped'
  $graphReady = $false
  $queryReady = $false
  $confidence = 'low'
  $skipReason = Get-ProviderSkipReason -Entry $entry
  $limitations = Get-ProviderSkipLimitations -SkipReason $skipReason
  $failureInfo = Get-ProviderFailureInfo -Provider $provider -Phase '' -ExitCode 0

  if (Test-ProviderEnabled -ProviderConfig $providerConfig -Provider $provider) {
    $bootstrapLog = Join-Path $rawDir $(if ($provider -eq 'gitnexus') { 'analyze.log' } else { 'build.log' })
    $statusLog = Join-Path $rawDir 'status.log'
    $queryLog = Join-Path $rawDir 'query.log'
    $bootstrap = Invoke-ConfiguredCommand -ProviderConfig $providerConfig -Provider $provider -Kind 'bootstrap' -LogPath $bootstrapLog -RepoRoot $repoRoot
    $commandResults.Add($bootstrap)
    if ($bootstrap.exit_code -eq 0) {
      $statusProbe = Invoke-ConfiguredCommand -ProviderConfig $providerConfig -Provider $provider -Kind 'status' -LogPath $statusLog -RepoRoot $repoRoot
      $commandResults.Add($statusProbe)
      if ($statusProbe.exit_code -eq 0) {
        $graphReady = $true
        $script:QueryProbeVerificationReason = ''
        $queryProbe = Invoke-ConfiguredCommand -ProviderConfig $providerConfig -Provider $provider -Kind 'query_probe' -LogPath $queryLog -RepoRoot $repoRoot
        $commandResults.Add($queryProbe)
        if ($queryProbe.exit_code -eq 0 -and (Test-QueryProbeVerified -Provider $provider -CommandResult $queryProbe -LogPath $queryLog)) {
          $status = 'ready'
          $queryReady = $true
          $confidence = 'high'
          $limitations = @()
        } else {
          $status = 'query-unverified'
          $confidence = 'medium'
          $reason = if ([string]::IsNullOrWhiteSpace($script:QueryProbeVerificationReason)) { 'Provider-specific query-surface proof did not verify provider readiness.' } else { $script:QueryProbeVerificationReason }
          $limitations = @('Build and status succeeded, but provider-specific query-surface proof did not verify provider readiness.', $reason)
        }
      } else {
        $status = 'query-unverified'
        $confidence = 'medium'
        $limitations = @('Build succeeded, but status probe did not verify provider readiness.')
      }
    } else {
      $status = 'failed'
      $failureInfo = Get-ProviderFailureInfo -Provider $provider -Phase 'bootstrap' -ExitCode ([int]$bootstrap.exit_code)
      $limitations = @('Provider bootstrap command failed.')
      if (-not [string]::IsNullOrWhiteSpace([string]$failureInfo['recommended_action'])) {
        $limitations += [string]$failureInfo['recommended_action']
      }
    }
  }

  $statusPath = Join-Path $providerDir 'status.json'
  Write-NormalizedArtifacts -Provider $provider -StatusPath $statusPath -QueryReady $queryReady -BootstrappedAt $bootstrappedAt -ProvidersDir $providersDir
  $providerStatus = [ordered]@{
    schema_version = 'provider-status.v1'
    provider = $provider
    generated_at = $bootstrappedAt
    configured = [bool]$entry.configured
    enabled_for_bootstrap = [bool]$entry.enabled_for_bootstrap
    dependency_status = $entry.dependency_status
    host_config_status = $entry.host_config_status
    skip_reason = if ($status -eq 'skipped') { $skipReason } else { $null }
    status = $status
    graph_ready = $graphReady
    query_ready = $queryReady
    failed_phase = $failureInfo['failed_phase']
    failure_class = $failureInfo['failure_class']
    reason_code = $failureInfo['reason_code']
    exit_code = $failureInfo['exit_code']
    recommended_action = $failureInfo['recommended_action']
    confidence = $confidence
    limitations = $limitations
    query_probe_policy = if ($entry.PSObject.Properties.Name -contains 'query_probe_policy') { $entry.query_probe_policy } else { $null }
    repo_snapshot = [ordered]@{
      source_revision = $sourceRevision
      worktree_dirty = $worktreeDirty
    }
    command_results = @($commandResults)
    command_source = '.spec-first/config/graph-providers.json'
    diagnostics = @($commandResults | Where-Object { -not [string]::IsNullOrWhiteSpace($_.diagnostic) } | ForEach-Object { $_.diagnostic })
    diagnostics_truncated = [bool](@($commandResults | Where-Object { $_.diagnostics_truncated }).Count)
    raw_logs = [ordered]@{
      bootstrap = ".spec-first/providers/$provider/raw/" + $(if ($provider -eq 'gitnexus') { 'analyze.log' } else { 'build.log' })
      status = ".spec-first/providers/$provider/raw/status.log"
      query_probe = ".spec-first/providers/$provider/raw/query.log"
    }
    normalized_artifacts = if ($provider -eq 'gitnexus') {
      [ordered]@{
        architecture_facts = '.spec-first/providers/gitnexus/normalized/architecture-facts.json'
        reuse_candidates = '.spec-first/providers/gitnexus/normalized/reuse-candidates.json'
      }
    } else {
      [ordered]@{
        impact_capabilities = '.spec-first/providers/code-review-graph/normalized/impact-capabilities.json'
      }
    }
  }
  Write-JsonFileAtomic -Path $statusPath -Payload ([pscustomobject]$providerStatus) -Depth 20
  $providerStatuses.Add([pscustomobject]$providerStatus)
}

$readyCount = @($providerStatuses | Where-Object { $_.query_ready }).Count
$providerCount = @($providerStatuses).Count
$fallbackReady = [bool](@($runtimeCapabilities.fallback_capabilities.PSObject.Properties | Where-Object { $_.Value.support_level -ne 'none' }).Count)
if ($providerCount -gt 0 -and $readyCount -eq $providerCount) {
  $workflowMode = 'primary'
  $overallStatus = 'ready'
  $exitCode = 0
} elseif ($fallbackReady) {
  $workflowMode = 'degraded-fallback'
  $overallStatus = 'degraded'
  $exitCode = 0
} else {
  $workflowMode = 'blocked'
  $overallStatus = 'action-required'
  $exitCode = 1
}

$providerAggregate = [ordered]@{
  schema_version = 'graph-provider-status.v1'
  generated_at = $bootstrappedAt
  workflow_mode = $workflowMode
  ready_primary_providers = @($providerStatuses | Where-Object { $_.query_ready } | ForEach-Object { $_.provider })
  failed_primary_providers = @($providerStatuses | Where-Object { -not $_.query_ready -and $_.status -ne 'skipped' } | ForEach-Object { $_.provider })
  skipped_primary_providers = @($providerStatuses | Where-Object { $_.status -eq 'skipped' } | ForEach-Object { $_.provider })
  partial_primary_available = ($readyCount -gt 0)
  providers = @($providerStatuses)
  confidence = if ($workflowMode -eq 'primary') { 'high' } elseif ($workflowMode -eq 'degraded-fallback') { 'medium' } else { 'low' }
  limitations = if ($workflowMode -eq 'primary') { @() } elseif ($workflowMode -eq 'degraded-fallback') { @('One or more primary graph providers are unavailable or query-unverified; fallback capabilities are required.') } else { @('No query-ready graph provider or fallback capability is available.') }
}
Write-JsonFileAtomic -Path (Join-Path $graphDir 'provider-status.json') -Payload ([pscustomobject]$providerAggregate) -Depth 30

$graphFacts = [ordered]@{
  schema_version = 'graph-facts.v1'
  generated_at = $bootstrappedAt
  repo_root = $repoRoot
  source_revision = $sourceRevision
  worktree_dirty = $worktreeDirty
  workflow_mode = $workflowMode
  provider_summary = [ordered]@{
    ready_primary_providers = @($providerAggregate.ready_primary_providers)
    degraded_providers = @($providerStatuses | Where-Object { -not $_.query_ready } | ForEach-Object { $_.provider })
    partial_primary_available = ($readyCount -gt 0)
  }
  canonical_artifacts = [ordered]@{
    provider_status = '.spec-first/graph/provider-status.json'
    impact_capabilities = '.spec-first/impact/bootstrap-impact-capabilities.json'
  }
  confidence = $providerAggregate.confidence
  limitations = @($providerAggregate.limitations)
}
Write-JsonFileAtomic -Path (Join-Path $graphDir 'graph-facts.json') -Payload ([pscustomobject]$graphFacts) -Depth 20

$readyPrimaryProviders = @($providerStatuses | Where-Object { $_.query_ready } | ForEach-Object { $_.provider })
$crgReadyProviders = @($providerStatuses | Where-Object { $_.provider -eq 'code-review-graph' -and $_.query_ready } | ForEach-Object { $_.provider })
$contextFallback = Get-FallbackCapability -RuntimeCapabilities $runtimeCapabilities -Name 'context_selection'
$impactFallback = Get-FallbackCapability -RuntimeCapabilities $runtimeCapabilities -Name 'impact_radius'
$reviewFallback = Get-FallbackCapability -RuntimeCapabilities $runtimeCapabilities -Name 'review_support'
$impactCapabilities = [ordered]@{
  schema_version = 'bootstrap-impact-capabilities.v1'
  generated_at = $bootstrappedAt
  workflow_mode = $workflowMode
  capabilities = [ordered]@{
    context_selection = [ordered]@{
      support_level = if ($readyPrimaryProviders.Count -gt 0) { 'full' } elseif (Test-FallbackSupported -Fallback $contextFallback) { 'partial' } else { 'none' }
      primary_providers = @($readyPrimaryProviders)
      fallback_support = $contextFallback
      confidence = if ($readyPrimaryProviders.Count -gt 0) { 'high' } else { $contextFallback.confidence }
      limitations = if ($readyPrimaryProviders.Count -gt 0) { @() } else { @('Using fallback context selection only.') }
    }
    impact_radius = [ordered]@{
      support_level = if ($crgReadyProviders.Count -gt 0) { 'full' } elseif (Test-FallbackSupported -Fallback $impactFallback) { 'partial' } else { 'none' }
      primary_providers = @($crgReadyProviders)
      fallback_support = $impactFallback
      confidence = if ($crgReadyProviders.Count -gt 0) { 'high' } else { $impactFallback.confidence }
      limitations = if ($crgReadyProviders.Count -gt 0) { @() } else { @('Impact radius is not backed by a query-ready provider.') }
    }
    review_support = [ordered]@{
      support_level = if ($crgReadyProviders.Count -gt 0) { 'partial' } elseif (Test-FallbackSupported -Fallback $reviewFallback) { 'partial' } else { 'none' }
      primary_providers = @($crgReadyProviders)
      fallback_support = $reviewFallback
      confidence = if ($crgReadyProviders.Count -gt 0) { 'medium' } else { $reviewFallback.confidence }
      limitations = @('This artifact reports readiness only; downstream LLM workflows decide review evidence relevance.')
    }
  }
  downstream_guidance = [ordered]@{
    canonical_graph_facts = '.spec-first/graph/graph-facts.json'
    provider_status = '.spec-first/graph/provider-status.json'
    limitations_required = ($workflowMode -ne 'primary')
  }
}
Write-JsonFileAtomic -Path (Join-Path $impactDir 'bootstrap-impact-capabilities.json') -Payload ([pscustomobject]$impactCapabilities) -Depth 20

Write-TextFileAtomic -Path (Join-Path $graphDir 'bootstrap-report.md') -Value @"
# Graph Bootstrap Report

- workflow_mode: $workflowMode
- overall_status: $overallStatus
- provider_status: .spec-first/graph/provider-status.json
- graph_facts: .spec-first/graph/graph-facts.json
- impact_capabilities: .spec-first/impact/bootstrap-impact-capabilities.json
"@

[pscustomobject]@{
  schema_version = 'graph-bootstrap-result.v1'
  overall_status = $overallStatus
  workflow_mode = $workflowMode
  reason_code = if ($workflowMode -eq 'blocked') { 'graph-not-ready' } else { $null }
  repo_root = $repoRoot
  invocation_workspace_root = $invocationWorkspaceRoot
  selection_source = $selectionSource
  ledger_path = $ledgerPath
  provider_config_path = $providerConfigPath
  runtime_capabilities_path = $runtimeCapabilitiesPath
  provider_artifacts_path = $providerArtifactsPath
  results = @($providerStatuses)
} | ConvertTo-Json -Depth 30 -Compress

exit $exitCode
