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

$providers = [ordered]@{}
foreach ($property in $facts.graph_providers.PSObject.Properties) {
  $provider = $property.Value
  $ready = (
    [bool]$provider.configured -and
    $provider.dependency_status -eq 'ready' -and
    ($provider.host_config_status -eq 'ready' -or $provider.host_config_status -eq 'fallback-active')
  )
  $providers[$property.Name] = [ordered]@{
    configured = [bool]$provider.configured
    enabled_for_bootstrap = [bool]$provider.enabled_for_bootstrap
    query_ready = $false
    bootstrap_required = $true
    required = [bool]$provider.required
    role = $provider.role
    mcp_server = $property.Name
    dependency_status = $provider.dependency_status
    host_config_status = $provider.host_config_status
    capabilities = @($provider.capabilities)
    next_action = if ($ready) { 'run spec-graph-bootstrap' } else { 'Fix provider setup and rerun spec-mcp-setup.' }
  }
}

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
    graph_bootstrap_required = $true
  }
}

$payload | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $outFile
[pscustomobject]@{
  repo_config_status = 'written'
  repo_config_path = $outFile
} | ConvertTo-Json -Compress
