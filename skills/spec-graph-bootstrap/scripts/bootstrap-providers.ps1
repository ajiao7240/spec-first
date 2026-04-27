param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillDir = Split-Path -Parent $ScriptDir
$McpSetupScriptsDir = Join-Path (Split-Path -Parent $SkillDir) 'spec-mcp-setup/scripts'

function Invoke-Captured {
  param(
    [string]$Provider,
    [string]$Display,
    [scriptblock]$Script
  )

  $output = New-Object System.Collections.Generic.List[string]
  $exitCode = 0
  try {
    $global:LASTEXITCODE = 0
    $captured = & $Script 2>&1
    foreach ($line in @($captured)) { $output.Add([string]$line) }
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
    if ($summary.Length -gt 1000) { $summary = $summary.Substring(0, 1000) }
    return [pscustomobject]@{ provider = $Provider; status = 'action-required'; command = $Display; exit_code = $exitCode; diagnostic_summary = $summary }
  }

  $readySummary = (($output -join ' ') -replace '\s+', ' ').Trim()
  if ($readySummary.Length -gt 1000) { $readySummary = $readySummary.Substring(0, 1000) }
  [pscustomobject]@{ provider = $Provider; status = 'ready'; command = $Display; exit_code = 0; diagnostic_summary = $readySummary }
}

function Set-JsonProperty {
  param(
    [object]$Object,
    [string]$Name,
    [object]$Value
  )

  if ($null -ne $Object.PSObject.Properties[$Name]) {
    $Object.$Name = $Value
  } else {
    $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $Value
  }
}

$repoRoot = (git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($repoRoot)) {
  [pscustomobject]@{ schema_version = 'graph-bootstrap-result.v1'; overall_status = 'action-required'; reason_code = 'not_git_repo'; next_action = 'Run spec-graph-bootstrap inside a git repo.' } | ConvertTo-Json -Compress
  exit 1
}

$hostInfo = & (Join-Path $McpSetupScriptsDir 'detect-host.ps1') | ConvertFrom-Json
$ledgerPath = $hostInfo.marker_path
$providerConfigPath = Join-Path $repoRoot '.spec-first/config/graph-providers.json'

if (-not (Test-Path $ledgerPath)) {
  [pscustomobject]@{ schema_version = 'graph-bootstrap-result.v1'; overall_status = 'action-required'; reason_code = 'missing_ledger'; ledger_path = $ledgerPath; next_action = 'Run spec-mcp-setup first.' } | ConvertTo-Json -Compress
  exit 1
}

$ledger = Get-Content -Raw $ledgerPath | ConvertFrom-Json
if ($ledger.schema_version -ne 'v2' -or -not [bool]$ledger.baseline_ready) {
  [pscustomobject]@{ schema_version = 'graph-bootstrap-result.v1'; overall_status = 'action-required'; reason_code = 'baseline_not_ready'; ledger_path = $ledgerPath; next_action = 'Fix Required Harness Runtime setup, then rerun spec-mcp-setup.' } | ConvertTo-Json -Compress
  exit 1
}

if (-not (Test-Path $providerConfigPath)) {
  [pscustomobject]@{ schema_version = 'graph-bootstrap-result.v1'; overall_status = 'action-required'; reason_code = 'missing_provider_config'; provider_config_path = $providerConfigPath; next_action = 'Run spec-mcp-setup inside this git repo first.' } | ConvertTo-Json -Compress
  exit 1
}

$providerConfig = Get-Content -Raw $providerConfigPath | ConvertFrom-Json
if ($providerConfig.schema_version -ne 'graph-providers.v1') {
  [pscustomobject]@{ schema_version = 'graph-bootstrap-result.v1'; overall_status = 'action-required'; reason_code = 'unsupported_provider_config_schema'; provider_config_path = $providerConfigPath; next_action = 'Rerun spec-mcp-setup to refresh graph-providers.json.' } | ConvertTo-Json -Compress
  exit 1
}

$results = New-Object System.Collections.Generic.List[object]
$successes = New-Object System.Collections.Generic.HashSet[string]

if ($providerConfig.providers.gitnexus.configured -and $providerConfig.providers.gitnexus.enabled_for_bootstrap) {
  $result = Invoke-Captured -Provider 'gitnexus' -Display 'npx -y gitnexus@latest analyze' -Script { Push-Location $repoRoot; try { npx -y gitnexus@latest analyze } finally { Pop-Location } }
  $results.Add($result)
  if ($result.status -eq 'ready') { $null = $successes.Add('gitnexus') }
} else {
  $results.Add([pscustomobject]@{ provider = 'gitnexus'; status = 'skipped'; command = 'npx -y gitnexus@latest analyze'; exit_code = $null; diagnostic_summary = 'provider is not configured for bootstrap' })
}

$crgProvider = $providerConfig.providers.'code-review-graph'
if ($crgProvider.configured -and $crgProvider.enabled_for_bootstrap) {
  $result = Invoke-Captured -Provider 'code-review-graph' -Display 'uvx code-review-graph build' -Script { Push-Location $repoRoot; try { uvx code-review-graph build } finally { Pop-Location } }
  $results.Add($result)
  if ($result.status -eq 'ready') { $null = $successes.Add('code-review-graph') }
} else {
  $results.Add([pscustomobject]@{ provider = 'code-review-graph'; status = 'skipped'; command = 'uvx code-review-graph build'; exit_code = $null; diagnostic_summary = 'provider is not configured for bootstrap' })
}

$bootstrappedAt = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
foreach ($property in $providerConfig.providers.PSObject.Properties) {
  $provider = $property.Value
  if ($successes.Contains($property.Name)) {
    Set-JsonProperty -Object $provider -Name 'query_ready' -Value $true
    Set-JsonProperty -Object $provider -Name 'bootstrap_required' -Value $false
    Set-JsonProperty -Object $provider -Name 'next_action' -Value ''
    Set-JsonProperty -Object $provider -Name 'last_bootstrap_status' -Value 'ready'
    Set-JsonProperty -Object $provider -Name 'last_bootstrapped_at' -Value $bootstrappedAt
  } else {
    Set-JsonProperty -Object $provider -Name 'query_ready' -Value $false
    Set-JsonProperty -Object $provider -Name 'bootstrap_required' -Value $true
    Set-JsonProperty -Object $provider -Name 'next_action' -Value 'run spec-graph-bootstrap'
    Set-JsonProperty -Object $provider -Name 'last_bootstrap_status' -Value 'not-ready'
  }
}
Set-JsonProperty -Object $providerConfig -Name 'last_updated_by' -Value 'spec-graph-bootstrap'
Set-JsonProperty -Object $providerConfig -Name 'last_bootstrapped_at' -Value $bootstrappedAt
Set-JsonProperty -Object $providerConfig.boundaries -Name 'graph_bootstrap_required' -Value ([bool](@($providerConfig.providers.PSObject.Properties | Where-Object { $_.Value.bootstrap_required }).Count))
$providerConfig | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $providerConfigPath

$overallStatus = if (@($results | Where-Object { $_.status -ne 'ready' }).Count -eq 0) { 'ready' } else { 'action-required' }
[pscustomobject]@{
  schema_version = 'graph-bootstrap-result.v1'
  overall_status = $overallStatus
  repo_root = $repoRoot
  ledger_path = $ledgerPath
  provider_config_path = $providerConfigPath
  results = @($results)
} | ConvertTo-Json -Depth 8 -Compress

if ($overallStatus -ne 'ready') { exit 1 }
