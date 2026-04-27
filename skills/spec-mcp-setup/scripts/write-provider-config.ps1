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
  } | ConvertTo-Json -Compress
  return
}

$outDir = Join-Path $facts.repo_root '.spec-first/config'
$outFile = Join-Path $outDir 'graph-providers.json'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$existing = $null
if (Test-Path $outFile) {
  try {
    $candidate = Get-Content -Raw $outFile | ConvertFrom-Json
    if ($candidate.schema_version -eq 'graph-providers.v1' -and $candidate.repo_root -eq $facts.repo_root) {
      $existing = $candidate
    }
  } catch {
    $existing = $null
  }
}

function ConvertTo-ComparableProjectionJson {
  param([object]$Projection)
  if ($null -eq $Projection) { return '' }

  $clone = $Projection | ConvertTo-Json -Depth 20 | ConvertFrom-Json
  if ($clone.PSObject.Properties.Name -contains 'generated_at') {
    $clone.PSObject.Properties.Remove('generated_at')
  }
  return ($clone | ConvertTo-Json -Depth 20 -Compress)
}

$providers = [ordered]@{}
foreach ($property in $facts.graph_providers.PSObject.Properties) {
  $provider = $property.Value
  $ready = (
    [bool]$provider.configured -and
    $provider.dependency_status -eq 'ready' -and
    ($provider.host_config_status -eq 'ready' -or $provider.host_config_status -eq 'fallback-active')
  )
  $previous = $null
  if ($null -ne $existing -and $null -ne $existing.providers -and ($existing.providers.PSObject.Properties.Name -contains $property.Name)) {
    $previous = $existing.providers.PSObject.Properties[$property.Name].Value
  }
  $preserveQueryReady = (
    $ready -and
    $null -ne $previous -and
    [bool]$previous.query_ready -and
    -not [bool]$previous.bootstrap_required
  )
  $providers[$property.Name] = [ordered]@{
    configured = [bool]$provider.configured
    enabled_for_bootstrap = [bool]$provider.enabled_for_bootstrap
    query_ready = [bool]$preserveQueryReady
    bootstrap_required = if ($ready) { -not [bool]$preserveQueryReady } else { $true }
    required = [bool]$provider.required
    role = $provider.role
    mcp_server = $property.Name
    dependency_status = $provider.dependency_status
    host_config_status = $provider.host_config_status
    capabilities = @($provider.capabilities)
    next_action = if ($ready -and $preserveQueryReady) { '' } elseif ($ready) { 'run spec-graph-bootstrap' } else { 'Fix provider setup and rerun spec-mcp-setup.' }
  }
  if ($preserveQueryReady) {
    $providers[$property.Name]['last_bootstrap_status'] = if ($previous.PSObject.Properties.Name -contains 'last_bootstrap_status') { $previous.last_bootstrap_status } else { 'ready' }
    $providers[$property.Name]['last_bootstrapped_at'] = if ($previous.PSObject.Properties.Name -contains 'last_bootstrapped_at') { $previous.last_bootstrapped_at } else { $null }
  }
}

$graphBootstrapRequired = [bool](@($providers.Values | Where-Object { $_.bootstrap_required }).Count)

$payload = [ordered]@{
  schema_version = 'graph-providers.v1'
  generated_by = 'spec-mcp-setup'
  generated_at = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
  repo_root = $facts.repo_root
  providers = $providers
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
$hasQueryReadyProvider = [bool](@($providers.Values | Where-Object { $_.query_ready }).Count)
if ($hasQueryReadyProvider -and $null -ne $existing) {
  if ($existing.PSObject.Properties.Name -contains 'last_updated_by') {
    $payload['last_updated_by'] = $existing.last_updated_by
  }
  if ($existing.PSObject.Properties.Name -contains 'last_bootstrapped_at') {
    $payload['last_bootstrapped_at'] = $existing.last_bootstrapped_at
  }
}

$repoConfigStatus = 'written'
$existingGeneratedAt = if ($null -ne $existing -and $existing.PSObject.Properties.Name -contains 'generated_at') { $existing.generated_at } else { $null }
if ($null -ne $existing -and -not [string]::IsNullOrWhiteSpace([string]$existingGeneratedAt)) {
  $existingComparable = ConvertTo-ComparableProjectionJson -Projection $existing
  $payloadComparable = ConvertTo-ComparableProjectionJson -Projection ([pscustomobject]$payload)
  if ($existingComparable -eq $payloadComparable) {
    $payload['generated_at'] = $existingGeneratedAt
    $repoConfigStatus = 'ready'
  }
}

if ($repoConfigStatus -eq 'written') {
  $payload | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $outFile
}
[pscustomobject]@{
  repo_config_status = $repoConfigStatus
  repo_config_path = $outFile
  graph_bootstrap_required = $graphBootstrapRequired
  providers = $providers
} | ConvertTo-Json -Compress
