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

function Test-JsonProperty {
  param(
    [AllowNull()][object]$Object,
    [string]$Name
  )
  return ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name)
}

function Get-JsonPropertyValue {
  param(
    [AllowNull()][object]$Object,
    [string]$Name
  )
  if (Test-JsonProperty -Object $Object -Name $Name) {
    return $Object.PSObject.Properties[$Name].Value
  }
  return $null
}

function Write-Result {
  param([hashtable]$Payload)
  [pscustomobject]$Payload | ConvertTo-Json -Depth 20 -Compress
}

function Test-SymlinkPath {
  param([string]$CandidatePath)
  if ([string]::IsNullOrWhiteSpace($CandidatePath)) { return $false }
  $item = Get-Item -LiteralPath $CandidatePath -Force -ErrorAction SilentlyContinue
  return ($null -ne $item -and (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0))
}

function Write-JsonIfChanged {
  param(
    [string]$Path,
    [object]$Payload
  )
  $nextJson = ($Payload | ConvertTo-Json -Depth 30)
  if (Test-Path -LiteralPath $Path) {
    try {
      $existing = Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
      $existingComparable = $existing | Select-Object -Property * -ExcludeProperty generated_at
      $nextComparable = $Payload | Select-Object -Property * -ExcludeProperty generated_at
      $existingJson = $existingComparable | ConvertTo-Json -Depth 30 -Compress
      $nextComparableJson = $nextComparable | ConvertTo-Json -Depth 30 -Compress
      if ($existingJson -eq $nextComparableJson) {
        return 'ready'
      }
    } catch {
      # Rewrite invalid JSON below.
    }
  }
  $tmp = "$Path.$PID.tmp"
  Set-Content -LiteralPath $tmp -Value ($nextJson + [Environment]::NewLine) -Encoding UTF8
  Move-Item -LiteralPath $tmp -Destination $Path -Force
  return 'written'
}

$facts = Get-Content -Raw $FactsFile | ConvertFrom-Json
$targetObject = Get-JsonPropertyValue -Object $facts -Name 'target'
$targetKind = if (Test-JsonProperty -Object $facts -Name 'target_kind' -and -not [string]::IsNullOrWhiteSpace([string](Get-JsonPropertyValue -Object $facts -Name 'target_kind'))) {
  [string](Get-JsonPropertyValue -Object $facts -Name 'target_kind')
} elseif (Test-JsonProperty -Object $targetObject -Name 'target_kind') {
  [string](Get-JsonPropertyValue -Object $targetObject -Name 'target_kind')
} else {
  ''
}
$targetWriteAllowed = if (Test-JsonProperty -Object $targetObject -Name 'state_write_allowed') { [bool](Get-JsonPropertyValue -Object $targetObject -Name 'state_write_allowed') } else { $facts.repo_status -eq 'git-repo' }
$targetReasonCode = if (Test-JsonProperty -Object $targetObject -Name 'reason_code' -and -not [string]::IsNullOrWhiteSpace([string](Get-JsonPropertyValue -Object $targetObject -Name 'reason_code'))) { [string](Get-JsonPropertyValue -Object $targetObject -Name 'reason_code') } else { 'skipped-no-git-repo' }
if (-not $targetWriteAllowed -or ($facts.repo_status -ne 'git-repo' -and $targetKind -ne 'non-git-folder')) {
  Write-Result @{
    tool_facts_status = $targetReasonCode
    tool_facts_path = $null
    runtime_capabilities_status = $targetReasonCode
    runtime_capabilities_path = $null
    reason_code = $targetReasonCode
    next_action = if (Test-JsonProperty -Object $targetObject -Name 'next_action') { [string](Get-JsonPropertyValue -Object $targetObject -Name 'next_action') } else { 'Choose a Git repo target and rerun spec-mcp-setup with --repo <child>.' }
    candidates = if (Test-JsonProperty -Object $targetObject -Name 'candidates') { @((Get-JsonPropertyValue -Object $targetObject -Name 'candidates')) } else { @() }
  }
  return
}

$repoRoot = if (Test-JsonProperty -Object $targetObject -Name 'target_root' -and -not [string]::IsNullOrWhiteSpace([string](Get-JsonPropertyValue -Object $targetObject -Name 'target_root'))) {
  [string](Get-JsonPropertyValue -Object $targetObject -Name 'target_root')
} elseif (Test-JsonProperty -Object $facts -Name 'selected_repo_root' -and -not [string]::IsNullOrWhiteSpace([string](Get-JsonPropertyValue -Object $facts -Name 'selected_repo_root'))) {
  [string](Get-JsonPropertyValue -Object $facts -Name 'selected_repo_root')
} elseif (Test-JsonProperty -Object $targetObject -Name 'selected_folder_root' -and -not [string]::IsNullOrWhiteSpace([string](Get-JsonPropertyValue -Object $targetObject -Name 'selected_folder_root'))) {
  [string](Get-JsonPropertyValue -Object $targetObject -Name 'selected_folder_root')
} elseif (Test-JsonProperty -Object $facts -Name 'selected_folder_root' -and -not [string]::IsNullOrWhiteSpace([string](Get-JsonPropertyValue -Object $facts -Name 'selected_folder_root'))) {
  [string](Get-JsonPropertyValue -Object $facts -Name 'selected_folder_root')
} else {
  [string]$facts.repo_root
}

$outDir = Join-Path $repoRoot '.spec-first/config'
$toolFactsFile = Join-Path $outDir 'tool-facts.json'
$runtimeFile = Join-Path $outDir 'runtime-capabilities.json'
$specRoot = Join-Path $repoRoot '.spec-first'

if ((Test-SymlinkPath $specRoot) -or (Test-SymlinkPath $outDir)) {
  Write-Result @{
    tool_facts_status = 'project-config-symlink-escape'
    tool_facts_path = $null
    runtime_capabilities_status = 'project-config-symlink-escape'
    runtime_capabilities_path = $null
    reason_code = 'project-config-symlink-escape'
    next_action = 'Replace symlinked .spec-first/config with a real repo-local directory and rerun spec-mcp-setup.'
  }
  return
}

[System.IO.Directory]::CreateDirectory($outDir) | Out-Null
if ((Test-SymlinkPath $specRoot) -or (Test-SymlinkPath $outDir)) {
  Write-Result @{
    tool_facts_status = 'project-config-symlink-escape'
    tool_facts_path = $null
    runtime_capabilities_status = 'project-config-symlink-escape'
    runtime_capabilities_path = $null
    reason_code = 'project-config-symlink-escape'
    next_action = 'Replace symlinked .spec-first/config with a real repo-local directory and rerun spec-mcp-setup.'
  }
  return
}

$generatedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$configuredDependencies = @()
# scan 失败时不静默伪装成空结果:用 configured_scan_status 区分「扫了没有」与「扫描失败」,
# 与 bash write-setup-facts.sh 的 configured_scan_status 双宿主对等(诚实降级,非漏检美化)。
$configuredScanStatus = 'ok'
try {
  $scanRaw = & node (Join-Path $scriptDir 'scan-configured-deps.cjs') --repo-root $repoRoot --facts-file $FactsFile
  $scan = $scanRaw | ConvertFrom-Json
  if (Test-JsonProperty -Object $scan -Name 'configured_dependencies') {
    $configuredDependencies = @((Get-JsonPropertyValue -Object $scan -Name 'configured_dependencies'))
  }
} catch {
  $configuredDependencies = @()
  $configuredScanStatus = 'scan-failed'
}

function Get-SetupItemResult {
  param(
    [AllowNull()][object]$Value,
    [string]$DependencyStatus,
    [string]$ConfiguredStatus,
    [string]$ProjectStatus
  )
  $sourceResult = if (Test-JsonProperty -Object $Value -Name 'result') { [string](Get-JsonPropertyValue -Object $Value -Name 'result') } else { $null }
  $sourceStatus = if (Test-JsonProperty -Object $Value -Name 'status') { [string](Get-JsonPropertyValue -Object $Value -Name 'status') } else { $null }

  if ($sourceResult -eq 'skipped') { return 'skipped' }
  if (@('action-required', 'precedence-blocked') -contains $ConfiguredStatus) { return 'action-required' }
  if ($DependencyStatus -ne 'ready' -and $DependencyStatus -ne 'ok') {
    if ($sourceResult -eq 'degraded') { return 'degraded' }
    if (-not [string]::IsNullOrWhiteSpace($sourceResult) -and $sourceResult -ne 'ready') { return $sourceResult }
    return 'action-required'
  }
  if ($ConfiguredStatus -eq 'registry-args-drift') { return 'degraded' }
  if (@('pending', 'failed') -contains $ProjectStatus) { return 'action-required' }
  if (-not [string]::IsNullOrWhiteSpace($sourceResult) -and $sourceResult -ne 'ready') { return $sourceResult }
  if (@('ready', 'ok') -contains $sourceStatus) { return 'ready' }
  if ($sourceResult -eq 'ready') { return 'ready' }
  if (@('ready', 'not-applicable', 'not-required', 'fallback-active') -contains $ConfiguredStatus) { return 'ready' }
  if ($sourceStatus -eq 'missing') { return 'action-required' }
  if (-not [string]::IsNullOrWhiteSpace($sourceStatus)) { return $sourceStatus }
  return 'unknown'
}

function Get-SetupItemReasonCode {
  param(
    [AllowNull()][object]$Value,
    [string]$DependencyStatus,
    [string]$ConfiguredStatus,
    [string]$ProjectStatus,
    [string]$Result,
    [bool]$BaselineBlocking
  )
  $sourceReason = if (Test-JsonProperty -Object $Value -Name 'reason_code') { [string](Get-JsonPropertyValue -Object $Value -Name 'reason_code') } else { $null }

  if ($Result -eq 'ready') { return 'ready' }
  if ($Result -eq 'skipped') {
    if (-not [string]::IsNullOrWhiteSpace($sourceReason) -and $sourceReason -ne 'ready') { return $sourceReason }
    return 'optional-skipped'
  }
  if ($ConfiguredStatus -eq 'registry-args-drift') { return 'host-config-version-drift' }
  if ($DependencyStatus -eq 'missing') { return 'missing_dependency' }
  if ($ConfiguredStatus -eq 'action-required') { return 'host-config-action-required' }
  if ($ConfiguredStatus -eq 'precedence-blocked') { return 'host-config-precedence-blocked' }
  if ($ProjectStatus -eq 'pending') { return 'project-bootstrap-pending' }
  if ($ProjectStatus -eq 'failed') { return 'project-bootstrap-failed' }
  if ($Result -eq 'degraded') {
    if (-not [string]::IsNullOrWhiteSpace($sourceReason) -and $sourceReason -ne 'ready') { return $sourceReason }
    if ($BaselineBlocking) { return 'baseline-degraded' }
    return 'optional-capability-degraded'
  }
  if ($Result -eq 'action-required') { return 'required-runtime-action-required' }
  if (-not [string]::IsNullOrWhiteSpace($sourceReason)) { return $sourceReason }
  return 'unknown'
}

function Convert-ToolMapToItems {
  param(
    [AllowNull()][object]$Map,
    [string]$DefaultKind
  )
  $items = @()
  if ($null -eq $Map) { return $items }
  foreach ($property in $Map.PSObject.Properties) {
    $value = $property.Value
    $dependencyStatus = if (Test-JsonProperty -Object $value -Name 'dependency_status') { [string](Get-JsonPropertyValue -Object $value -Name 'dependency_status') } elseif (Test-JsonProperty -Object $value -Name 'status') { [string](Get-JsonPropertyValue -Object $value -Name 'status') } else { 'unknown' }
    $required = if (Test-JsonProperty -Object $value -Name 'required') { [bool](Get-JsonPropertyValue -Object $value -Name 'required') } else { $true }
    $baselineBlocking = if (Test-JsonProperty -Object $value -Name 'baseline_blocking') { [bool](Get-JsonPropertyValue -Object $value -Name 'baseline_blocking') } else { $required }
    $configuredStatus = if (Test-JsonProperty -Object $value -Name 'configured_status') { [string](Get-JsonPropertyValue -Object $value -Name 'configured_status') } elseif (Test-JsonProperty -Object $value -Name 'host_config_status') { [string](Get-JsonPropertyValue -Object $value -Name 'host_config_status') } else { 'not-checked' }
    $projectStatus = if (Test-JsonProperty -Object $value -Name 'project_status') { [string](Get-JsonPropertyValue -Object $value -Name 'project_status') } else { 'not-applicable' }
    $result = Get-SetupItemResult -Value $value -DependencyStatus $dependencyStatus -ConfiguredStatus $configuredStatus -ProjectStatus $projectStatus
    $items += [pscustomobject][ordered]@{
      id = $property.Name
      kind = if (Test-JsonProperty -Object $value -Name 'kind') { [string](Get-JsonPropertyValue -Object $value -Name 'kind') } elseif (Test-JsonProperty -Object $value -Name 'type') { [string](Get-JsonPropertyValue -Object $value -Name 'type') } else { $DefaultKind }
      profile = if (Test-JsonProperty -Object $value -Name 'profile') { [string](Get-JsonPropertyValue -Object $value -Name 'profile') } else { 'minimal' }
      required = $required
      baseline_blocking = $baselineBlocking
      dependency_status = $dependencyStatus
      configured_status = $configuredStatus
      result = $result
      reason_code = Get-SetupItemReasonCode -Value $value -DependencyStatus $dependencyStatus -ConfiguredStatus $configuredStatus -ProjectStatus $projectStatus -Result $result -BaselineBlocking $baselineBlocking
      installed = ($dependencyStatus -eq 'ready')
      missing_dependency_reason = if ($dependencyStatus -eq 'ready') { $null } else { 'missing_dependency' }
      next_action = if (Test-JsonProperty -Object $value -Name 'next_action') { [string](Get-JsonPropertyValue -Object $value -Name 'next_action') } else { '' }
    }
  }
  return $items
}

$toolsMap = Get-JsonPropertyValue -Object $facts -Name 'tools'
$helperToolsMap = Get-JsonPropertyValue -Object $facts -Name 'helper_tools'
$items = @()
$items += Convert-ToolMapToItems -Map $toolsMap -DefaultKind 'mcp'
$items += Convert-ToolMapToItems -Map $helperToolsMap -DefaultKind 'helper'
$providerReadiness = @()
if (Test-JsonProperty -Object $facts -Name 'provider_readiness') {
  $providerReadiness = @((Get-JsonPropertyValue -Object $facts -Name 'provider_readiness'))
}

$toolFactsPayload = [ordered]@{
  schema_version = 'tool-facts.v2'
  generated_at = $generatedAt
  repo_root = $repoRoot
  host = Get-JsonPropertyValue -Object $facts -Name 'host'
  platform = Get-JsonPropertyValue -Object $facts -Name 'platform'
  profile = 'minimal'
  tools = $toolsMap
  helper_tools = $helperToolsMap
  provider_readiness = $providerReadiness
  items = $items
  configured_dependencies = $configuredDependencies
  configured_scan_status = $configuredScanStatus
  schema_capabilities = @('items', 'configured_dependencies', 'schema_capabilities', 'tool-existence', 'provider-readiness-generic')
  target = Get-JsonPropertyValue -Object $facts -Name 'target'
}
$runtimePayload = [ordered]@{
  schema_version = 'runtime-capabilities.v1'
  generated_at = $generatedAt
  repo_root = $repoRoot
  host = Get-JsonPropertyValue -Object $facts -Name 'host'
  direct_evidence = [ordered]@{
    bounded_source_reads = $true
    ripgrep = $true
    ast_grep = $true
    git_diff = $true
    tests_and_logs = $true
  }
  setup_summary = [ordered]@{
    host_runtime_ready = if (Test-JsonProperty -Object $facts -Name 'host_runtime_ready') { [bool](Get-JsonPropertyValue -Object $facts -Name 'host_runtime_ready') } else { [bool](Get-JsonPropertyValue -Object $facts -Name 'baseline_ready') }
    baseline_ready = if (Test-JsonProperty -Object $facts -Name 'baseline_ready') { [bool](Get-JsonPropertyValue -Object $facts -Name 'baseline_ready') } else { $false }
    reason_code = 'setup-facts-ready'
  }
  host_ledger_pointer = Get-JsonPropertyValue -Object $facts -Name 'host_ledger_pointer'
}

$toolFactsStatus = Write-JsonIfChanged -Path $toolFactsFile -Payload ([pscustomobject]$toolFactsPayload)
$runtimeStatus = Write-JsonIfChanged -Path $runtimeFile -Payload ([pscustomobject]$runtimePayload)

Write-Result @{
  tool_facts_status = $toolFactsStatus
  tool_facts_path = $toolFactsFile
  runtime_capabilities_status = $runtimeStatus
  runtime_capabilities_path = $runtimeFile
  reason_code = 'setup-facts-ready'
  next_action = ''
}
