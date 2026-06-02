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
$toolFactsPayload = [ordered]@{
  schema_version = 'tool-facts.v1'
  generated_at = $generatedAt
  repo_root = $repoRoot
  host = Get-JsonPropertyValue -Object $facts -Name 'host'
  platform = Get-JsonPropertyValue -Object $facts -Name 'platform'
  tools = Get-JsonPropertyValue -Object $facts -Name 'tools'
  helper_tools = Get-JsonPropertyValue -Object $facts -Name 'helper_tools'
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
