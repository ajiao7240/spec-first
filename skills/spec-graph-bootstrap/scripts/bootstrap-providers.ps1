param(
  [string]$Repo = '',
  [string]$Folder = '',
  [switch]$AllRepos,
  [switch]$Incremental,
  [switch]$Full,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not [string]::IsNullOrWhiteSpace($Repo) -and -not [string]::IsNullOrWhiteSpace($Folder)) {
  throw 'bootstrap-providers.ps1: use either -Repo or -Folder, not both'
}
if ($AllRepos -and -not [string]::IsNullOrWhiteSpace($Folder)) {
  throw 'bootstrap-providers.ps1: use either -AllRepos or -Folder, not both'
}

$script:GitNexusQueryProbeCandidateLimit = 5
$script:BootstrapProvidersScript = $PSCommandPath
$script:DefaultRefreshModeSingleRepo = 'full'
$script:DefaultRefreshModeAllRepos = 'full'
$script:SetupOwnedDirtyIgnorePrefixes = @(
  '.spec-first/',
  '.gitnexus/',
  '.code-review-graph/',
  'AGENTS.md',
  'CLAUDE.md',
  '.gitignore',
  '.codex/spec-first/',
  '.claude/spec-first/',
  '.agents/skills/'
)
$script:NonGraphMetadataDirtyPaths = @(
  'CHANGELOG.md',
  'docs/变更日志.md'
)
$script:ExternalActorFingerprintIgnorePattern = '^(\.spec-first/(providers|graph|impact|workspace)/|\.gitnexus/|\.code-review-graph/)'
$script:DirtyClassification = ''
$script:DirtyPathsBreakdown = [ordered]@{
  setup_owned_count = 0
  non_graph_metadata_count = 0
  graph_affecting_count = 0
  sample_paths = @()
  truncated = $false
}

function Get-NonNegativeIntEnv {
  param(
    [string]$Name,
    [int]$Default
  )
  $raw = [Environment]::GetEnvironmentVariable($Name)
  [int]$parsed = 0
  if ([int]::TryParse($raw, [ref]$parsed) -and $parsed -ge 0) { return $parsed }
  return $Default
}

$script:ProviderCommandTimeoutSeconds = Get-NonNegativeIntEnv `
  -Name 'SPEC_FIRST_PROVIDER_COMMAND_TIMEOUT_SECONDS' `
  -Default (Get-NonNegativeIntEnv -Name 'SPEC_FIRST_STAGE_TIMEOUT_SECONDS' -Default 900)

function Get-UtcTimestamp {
  return [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
}

function Get-EpochMilliseconds {
  return [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
}

$script:ScriptStartedAt = Get-UtcTimestamp
$script:ScriptStartedEpochMs = Get-EpochMilliseconds

function Ensure-Directory {
  param([string[]]$Path)

  foreach ($entry in $Path) {
    if ([string]::IsNullOrWhiteSpace($entry)) { continue }
    [System.IO.Directory]::CreateDirectory($entry) | Out-Null
  }
}

function Test-SymlinkPath {
  param([string]$CandidatePath)
  if ([string]::IsNullOrWhiteSpace($CandidatePath)) { return $false }
  $item = Get-Item -LiteralPath $CandidatePath -Force -ErrorAction SilentlyContinue
  return ($null -ne $item -and (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0))
}

function Write-WorkspaceSummaryJsonAtomic {
  param(
    [string]$WorkspaceRoot,
    [string]$FileName,
    [object]$Payload,
    [int]$Depth = 30
  )
  $specDir = Join-Path $WorkspaceRoot '.spec-first'
  $workspaceDir = Join-Path $specDir 'workspace'
  if ((Test-SymlinkPath $specDir) -or (Test-SymlinkPath $workspaceDir)) {
    throw 'workspace-summary-symlink-escape'
  }
  [System.IO.Directory]::CreateDirectory($workspaceDir) | Out-Null
  $summaryPath = Join-Path $workspaceDir $FileName
  if ((Test-SymlinkPath $specDir) -or (Test-SymlinkPath $workspaceDir) -or (Test-SymlinkPath $summaryPath)) {
    throw 'workspace-summary-symlink-escape'
  }
  $tmpPath = "$summaryPath.$([guid]::NewGuid().ToString('N')).tmp"
  try {
    [pscustomobject]$Payload | ConvertTo-Json -Depth $Depth | Set-Content -LiteralPath $tmpPath -Encoding UTF8
    if ((Test-SymlinkPath $specDir) -or (Test-SymlinkPath $workspaceDir) -or (Test-SymlinkPath $summaryPath)) {
      throw 'workspace-summary-symlink-escape'
    }
    Move-Item -Force -LiteralPath $tmpPath -Destination $summaryPath
  } catch {
    Remove-Item -Force -LiteralPath $tmpPath -ErrorAction SilentlyContinue
    throw
  }
}

function Write-ResultAndExit {
  param(
    [string]$WorkflowMode,
    [string]$ReasonCode,
    [string]$NextAction,
    [int]$ExitCode = 1,
    [string]$RepoRoot = '',
    [string]$InvocationWorkspaceRoot = '',
    [string]$SelectionSource = '',
    [bool]$CanonicalArtifactsPreserved = $false,
    [string]$GraphDir = ''
  )

  if (-not $CanonicalArtifactsPreserved -and -not [string]::IsNullOrWhiteSpace($GraphDir)) {
    Ensure-Directory -Path @($GraphDir)
    Write-TextFileAtomic -Path (Join-Path $GraphDir 'bootstrap-report.md') -Value @"
# Graph Bootstrap Report

- workflow_mode: $WorkflowMode
- reason_code: $ReasonCode
- next_action: $NextAction
"@
  }

  $payload = [ordered]@{
    schema_version = 'graph-bootstrap-result.v1'
    overall_status = 'action-required'
    workflow_mode = $WorkflowMode
    reason_code = $ReasonCode
    next_action = $NextAction
    canonical_artifacts_preserved = $CanonicalArtifactsPreserved
  }
  if (-not [string]::IsNullOrWhiteSpace($RepoRoot)) {
    $payload['repo_root'] = $RepoRoot
  }
  if (-not [string]::IsNullOrWhiteSpace($InvocationWorkspaceRoot)) {
    $payload['invocation_workspace_root'] = $InvocationWorkspaceRoot
  }
  if (-not [string]::IsNullOrWhiteSpace($SelectionSource)) {
    $payload['selection_source'] = $SelectionSource
  }
  if (-not [string]::IsNullOrWhiteSpace($script:DirtyClassification)) {
    $payload['dirty_classification'] = $script:DirtyClassification
    $payload['dirty_paths_breakdown'] = $script:DirtyPathsBreakdown
  }
  [pscustomobject]$payload | ConvertTo-Json -Compress
  exit $ExitCode
}

function Resolve-ChildPowerShellExecutable {
  $currentEdition = if ($PSVersionTable.PSObject.Properties.Name -contains 'PSEdition') { [string]$PSVersionTable.PSEdition } else { '' }
  $currentCommandName = if ($currentEdition -eq 'Core') { 'pwsh' } else { 'powershell' }
  $currentCommand = Get-Command $currentCommandName -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -ne $currentCommand -and -not [string]::IsNullOrWhiteSpace([string]$currentCommand.Path)) {
    return [string]$currentCommand.Path
  }

  $pwshCommand = Get-Command pwsh -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -ne $pwshCommand -and -not [string]::IsNullOrWhiteSpace([string]$pwshCommand.Path)) {
    return [string]$pwshCommand.Path
  }

  $powershellCommand = Get-Command powershell -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -ne $powershellCommand -and -not [string]::IsNullOrWhiteSpace([string]$powershellCommand.Path)) {
    return [string]$powershellCommand.Path
  }

  return 'pwsh'
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

function Get-FileContentHash {
  param([string]$Path)
  if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return 'missing'
  }
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $stream = [System.IO.File]::OpenRead($Path)
    try {
      $hash = $sha.ComputeHash($stream)
      return 'sha256:' + ([BitConverter]::ToString($hash).Replace('-', '').ToLowerInvariant())
    } finally {
      $stream.Dispose()
    }
  } finally {
    $sha.Dispose()
  }
}

function Get-FolderContentFingerprint {
  param([string]$Root)
  $rootPrefix = ([System.IO.Path]::GetFullPath($Root)).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  $lines = New-Object System.Collections.Generic.List[string]
  $files = @(
    Get-ChildItem -LiteralPath $Root -File -Recurse -Force -ErrorAction Stop |
      ForEach-Object {
        $full = [System.IO.Path]::GetFullPath($_.FullName)
        if ($full.StartsWith($rootPrefix, [System.StringComparison]::Ordinal)) {
          $relative = $full.Substring($rootPrefix.Length).Replace('\', '/')
          if ($relative -notmatch '^(\.spec-first|\.gitnexus|\.code-review-graph|\.agents|\.codex|\.claude|node_modules|vendor)/') {
            [pscustomobject]@{ Relative = $relative; Full = $full }
          }
        }
      } |
      Sort-Object Relative
  )
  foreach ($file in $files) {
    $lines.Add([string]$file.Relative) | Out-Null
    $lines.Add((Get-FileContentHash -Path $file.Full)) | Out-Null
  }
  return (Get-StatusHash -Text ($lines -join "`n"))
}

function ConvertTo-CanonicalJsonValue {
  param([AllowNull()][object]$Value)

  if ($null -eq $Value) {
    return $null
  }

  if (
    $Value -is [string] -or
    $Value -is [bool] -or
    $Value -is [byte] -or
    $Value -is [int16] -or
    $Value -is [int] -or
    $Value -is [int64] -or
    $Value -is [single] -or
    $Value -is [double] -or
    $Value -is [decimal]
  ) {
    return $Value
  }

  if ($Value -is [DateTime]) {
    return $Value.ToString('o', [System.Globalization.CultureInfo]::InvariantCulture)
  }

  if ($Value -is [DateTimeOffset]) {
    return $Value.ToString('o', [System.Globalization.CultureInfo]::InvariantCulture)
  }

  if ($Value -is [System.Collections.IDictionary]) {
    $ordered = [ordered]@{}
    foreach ($key in @($Value.Keys | Sort-Object)) {
      $ordered[[string]$key] = ConvertTo-CanonicalJsonValue -Value $Value[$key]
    }
    return [pscustomobject]$ordered
  }

  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
    $items = @()
    foreach ($item in $Value) {
      $items += ,(ConvertTo-CanonicalJsonValue -Value $item)
    }
    return @($items)
  }

  $properties = @($Value.PSObject.Properties | Where-Object {
    $_.MemberType -eq 'NoteProperty'
  } | Sort-Object Name)
  if ($properties.Count -gt 0) {
    $ordered = [ordered]@{}
    foreach ($property in $properties) {
      $ordered[[string]$property.Name] = ConvertTo-CanonicalJsonValue -Value $property.Value
    }
    return [pscustomobject]$ordered
  }

  return $Value
}

function ConvertFrom-JsonWithoutDateCoercion {
  param([string]$Json)
  $convertFromJsonCommand = Get-Command ConvertFrom-Json -ErrorAction Stop
  if ($convertFromJsonCommand.Parameters.ContainsKey('DateKind')) {
    return $Json | ConvertFrom-Json -DateKind String
  }
  return $Json | ConvertFrom-Json
}

function Get-JsonFileHash {
  param([string]$Path)
  if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return 'missing'
  }
  try {
    $jsonValue = ConvertFrom-JsonWithoutDateCoercion -Json (Get-Content -Raw -LiteralPath $Path)
    $canonicalJson = ConvertTo-CanonicalJsonValue -Value $jsonValue | ConvertTo-Json -Depth 100 -Compress
    return (Get-StatusHash -Text $canonicalJson)
  } catch {
    return (Get-FileContentHash -Path $Path)
  }
}

function Invoke-ChildJsonScript {
  param(
    [string]$ScriptPath,
    [hashtable]$Arguments
  )

  $stderrPath = Join-Path ([System.IO.Path]::GetTempPath()) ('spec-first-child-stderr-{0}.log' -f ([guid]::NewGuid().ToString('N')))
  $informationPath = Join-Path ([System.IO.Path]::GetTempPath()) ('spec-first-child-information-{0}.log' -f ([guid]::NewGuid().ToString('N')))
  $powerShellExe = Resolve-ChildPowerShellExecutable
  $childArgs = @('-NoProfile', '-File', $ScriptPath)
  foreach ($entry in $Arguments.GetEnumerator()) {
    if ($entry.Value -is [bool]) {
      if ([bool]$entry.Value) {
        $childArgs += "-$($entry.Key)"
      }
      continue
    }
    $childArgs += "-$($entry.Key)"
    foreach ($value in @($entry.Value)) {
      $childArgs += [string]$value
    }
  }
  $stdout = @()
  $exitCode = 0
  $exceptionText = ''
  try {
    $global:LASTEXITCODE = 0
    $stdout = @(& $powerShellExe @childArgs 2> $stderrPath 6> $informationPath)
    if ($LASTEXITCODE -is [int]) { $exitCode = $LASTEXITCODE }
  } catch {
    $exitCode = if ($LASTEXITCODE -is [int] -and $LASTEXITCODE -ne 0) { $LASTEXITCODE } else { 1 }
    $exceptionText = [string]$_.Exception.Message
  }

  $stderrText = if (Test-Path -LiteralPath $stderrPath -PathType Leaf) { Get-Content -Raw -LiteralPath $stderrPath } else { '' }
  $informationText = if (Test-Path -LiteralPath $informationPath -PathType Leaf) { Get-Content -Raw -LiteralPath $informationPath } else { '' }
  Remove-Item -Force -ErrorAction SilentlyContinue -LiteralPath $stderrPath, $informationPath

  $diagnosticParts = @($stderrText, $informationText, $exceptionText) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }
  [pscustomobject]@{
    stdout = ($stdout -join "`n")
    stderr = $stderrText
    information = $informationText
    diagnostic = ($diagnosticParts -join "`n").Trim()
    exit_code = $exitCode
  }
}

function Write-WorkspaceGraphBootstrapSummaryAndExit {
  param(
    [object]$TargetFacts,
    [string]$SelectionSource = 'explicit-all-repos'
  )

  if (-not [string]::IsNullOrWhiteSpace($Repo)) {
    [pscustomobject]@{
      schema_version = 'workspace-graph-bootstrap-summary.v1'
      overall_status = 'action-required'
      workflow_mode = 'blocked'
      reason_code = 'all-repos-conflicts-with-repo'
      workspace_root = $TargetFacts.workspace_root
      advisory = $true
      next_action = 'Use either -AllRepos from a parent workspace or -Repo <child>, not both.'
    } | ConvertTo-Json -Compress
    exit 1
  }

  if ($TargetFacts.mode -eq 'git-repo') {
    [pscustomobject]@{
      schema_version = 'workspace-graph-bootstrap-summary.v1'
      overall_status = 'action-required'
      workflow_mode = 'blocked'
      reason_code = 'all-repos-requires-parent-workspace'
      workspace_root = $TargetFacts.workspace_root
      advisory = $true
      next_action = 'Run -AllRepos from a parent workspace containing child Git repos, or omit -AllRepos in a single Git repo.'
    } | ConvertTo-Json -Compress
    exit 1
  }

  $children = @($TargetFacts.candidates)
  if ($children.Count -eq 0) {
    [pscustomobject]@{
      schema_version = 'workspace-graph-bootstrap-summary.v1'
      overall_status = 'action-required'
      workflow_mode = 'blocked'
      reason_code = if ([string]::IsNullOrWhiteSpace([string]$TargetFacts.reason_code)) { 'workspace-no-git-candidates' } else { [string]$TargetFacts.reason_code }
      workspace_root = $TargetFacts.workspace_root
      candidates = @($TargetFacts.candidates)
      advisory = $true
      next_action = if ([string]::IsNullOrWhiteSpace([string]$TargetFacts.next_action)) { 'Run from a parent workspace containing child Git repos.' } else { [string]$TargetFacts.next_action }
    } | ConvertTo-Json -Compress
    exit 1
  }

  $runId = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
  $results = @()
  $childRefreshArgs = @{}
  switch ($script:DefaultRefreshModeAllRepos) {
    'full' {
      $childRefreshArgs.Full = $true
    }
    'incremental' {
      $childRefreshArgs.Incremental = $true
    }
    default {
      [pscustomobject]@{
        schema_version = 'workspace-graph-bootstrap-summary.v1'
        overall_status = 'action-required'
        workflow_mode = 'blocked'
        reason_code = 'unsupported-default-refresh-mode'
        workspace_root = $TargetFacts.workspace_root
        advisory = $true
        next_action = "Unsupported DefaultRefreshModeAllRepos value: $script:DefaultRefreshModeAllRepos"
      } | ConvertTo-Json -Compress
      exit 1
    }
  }
  $childIndex = 0
  foreach ($child in $children) {
    $childIndex += 1
    $childStartedAt = Get-UtcTimestamp
    $childStartedEpochMs = Get-EpochMilliseconds
    [Console]::Error.WriteLine("spec-graph-bootstrap: all-repos child $childIndex/$($children.Count) start repo=$([string]$child.workspace_relative_path)")
    $childArgs = @{ Repo = [string]$child.workspace_relative_path }
    foreach ($entry in $childRefreshArgs.GetEnumerator()) {
      $childArgs[$entry.Key] = $entry.Value
    }
    $childRun = Invoke-ChildJsonScript -ScriptPath $script:BootstrapProvidersScript -Arguments $childArgs
    $childStatus = [int]$childRun.exit_code
    $childText = [string]$childRun.stdout
    $childFinishedAt = Get-UtcTimestamp
    $childDurationMs = (Get-EpochMilliseconds) - $childStartedEpochMs
    try {
      $childResult = $childText | ConvertFrom-Json
    } catch {
      $diagnostic = (@($childText, [string]$childRun.diagnostic) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }) -join "`n"
      $childResult = [pscustomobject]@{
        schema_version = 'graph-bootstrap-result.v1'
        overall_status = 'action-required'
        workflow_mode = 'blocked'
        reason_code = 'child-bootstrap-output-unparseable'
        diagnostic = $diagnostic
      }
    }
    $results += [pscustomobject][ordered]@{
      parent_run_id = $runId
      repo_label = [string]$child.repo_label
      workspace_relative_path = [string]$child.workspace_relative_path
      exit_code = $childStatus
      started_at = $childStartedAt
      finished_at = $childFinishedAt
      duration_ms = $childDurationMs
      overall_status = [string]($childResult.overall_status ?? 'unknown')
      workflow_mode = [string]($childResult.workflow_mode ?? 'unknown')
      reason_code = $childResult.reason_code
      dirty_classification = if ($childResult.PSObject.Properties.Name -contains 'dirty_classification') { $childResult.dirty_classification } else { $null }
      dirty_paths_breakdown = if ($childResult.PSObject.Properties.Name -contains 'dirty_paths_breakdown') { $childResult.dirty_paths_breakdown } else { $null }
      result = $childResult
    }
    [Console]::Error.WriteLine("spec-graph-bootstrap: all-repos child $childIndex/$($children.Count) finish repo=$([string]$child.workspace_relative_path) status=$([string]($childResult.overall_status ?? 'unknown')) workflow=$([string]($childResult.workflow_mode ?? 'unknown')) duration_ms=$childDurationMs")
  }

  $parentHostInstructionNormalization = New-GitNexusInstructionNormalizationResult -Status 'not-applicable' -ReasonCode 'all-repos-gitnexus-provider-not-bootstrapped' -ExitCode $null -Results @()
  $shouldNormalizeParentHostInstructions = $false
  foreach ($result in $results) {
    foreach ($providerResult in @($result.result.results)) {
      if ([string]$providerResult.provider -ne 'gitnexus') { continue }
      foreach ($commandResult in @($providerResult.command_results)) {
        if ([string]$commandResult.kind -eq 'bootstrap' -and [int]$commandResult.exit_code -eq 0) {
          $shouldNormalizeParentHostInstructions = $true
          break
        }
      }
      if ($shouldNormalizeParentHostInstructions) { break }
    }
    if ($shouldNormalizeParentHostInstructions) { break }
  }
  if ($shouldNormalizeParentHostInstructions) {
    $parentHostInstructionNormalization = Normalize-GitNexusInstructionBlockViaCli -RepoRoot ([string]$TargetFacts.workspace_root) -GitRootTopology 'multi-repo-workspace'
  }
  $workspaceGitNexusReadiness = Compile-WorkspaceGitNexusReadinessForAllRepos -TargetFacts $TargetFacts
  $parentWritesHostInstructionFiles = @($parentHostInstructionNormalization.results | Where-Object {
    $_.PSObject.Properties.Name -contains 'written' -and [bool]$_.written
  }).Count -gt 0

  $readyCount = @($results | Where-Object { $_.overall_status -eq 'ready' -or $_.overall_status -eq 'ready-dirty-advisory' }).Count
  $degradedCount = @($results | Where-Object { $_.workflow_mode -eq 'degraded-fallback' -or $_.overall_status -eq 'degraded' }).Count
  $notApplicableCount = @($results | Where-Object { $_.workflow_mode -eq 'no-source' -or $_.overall_status -eq 'not-applicable' }).Count
  $actionRequiredCount = @($results | Where-Object { $_.overall_status -ne 'ready' -and $_.overall_status -ne 'ready-dirty-advisory' -and $_.workflow_mode -ne 'degraded-fallback' -and $_.overall_status -ne 'degraded' -and $_.workflow_mode -ne 'no-source' -and $_.overall_status -ne 'not-applicable' }).Count
  $overallStatus = if ($results.Count -eq 0) { 'action-required' } elseif ($actionRequiredCount -eq 0 -and $degradedCount -eq 0) { 'ready' } elseif (($readyCount + $degradedCount) -gt 0) { 'partial' } else { 'action-required' }
  $finishedAt = Get-UtcTimestamp
  $durationMs = (Get-EpochMilliseconds) - $script:ScriptStartedEpochMs
  $summary = [ordered]@{
    schema_version = 'workspace-graph-bootstrap-summary.v1'
    generated_at = $finishedAt
    run_id = $runId
    advisory = $true
    workflow_mode = 'all-repos'
    selection_source = $SelectionSource
    workspace_root = $TargetFacts.workspace_root
    parent_writes_repo_local_artifacts = $false
    parent_writes_host_instruction_files = $parentWritesHostInstructionFiles
    parent_host_instruction_normalization = $parentHostInstructionNormalization
    workspace_gitnexus_readiness_pointer = $workspaceGitNexusReadiness.workspace_gitnexus_readiness_pointer
    query_usability_counts = $workspaceGitNexusReadiness.query_usability_counts
    group = $workspaceGitNexusReadiness.group
    group_reason_code = $workspaceGitNexusReadiness.group_reason_code
    timing = [ordered]@{
      started_at = $script:ScriptStartedAt
      finished_at = $finishedAt
      duration_ms = $durationMs
    }
    results = @($results)
    counts = [ordered]@{
      total = $results.Count
      ready = $readyCount
      degraded = $degradedCount
      not_applicable = $notApplicableCount
      action_required = $actionRequiredCount
      primary = @($results | Where-Object { $_.workflow_mode -eq 'primary' }).Count
      blocked = @($results | Where-Object { $_.workflow_mode -eq 'blocked' -or $_.workflow_mode -eq 'setup-not-ready' }).Count
    }
    overall_status = $overallStatus
    reason_code = if ($actionRequiredCount -gt 0) { 'all-repos-partial-or-action-required' } elseif ($degradedCount -gt 0) { 'all-repos-degraded-fallback' } else { $null }
    next_action = if ($actionRequiredCount -gt 0) { 'Inspect per-child reason_code and rerun setup/bootstrap for action-required repos.' } elseif ($degradedCount -gt 0) { 'Inspect per-child provider reason_code/recommended_action. Use degraded child artifacts with disclosed limitations, or refresh query readiness for degraded repos.' } elseif ($notApplicableCount -gt 0) { 'All code-bearing child repos produced graph bootstrap artifacts; skip GitNexus process routing for no-source children.' } else { 'All child repos produced graph bootstrap artifacts.' }
  }

  try {
    Write-WorkspaceSummaryJsonAtomic -WorkspaceRoot ([string]$TargetFacts.workspace_root) -FileName 'graph-bootstrap-summary.json' -Payload ([pscustomobject]$summary) -Depth 30
  } catch {
    [pscustomobject]@{
      schema_version = 'workspace-graph-bootstrap-summary.v1'
      overall_status = 'action-required'
      workflow_mode = 'blocked'
      reason_code = 'workspace-summary-symlink-escape'
      workspace_root = [string]$TargetFacts.workspace_root
      advisory = $true
      parent_writes_repo_local_artifacts = $false
      next_action = 'Replace symlinked .spec-first/workspace with a real workspace-local directory and rerun graph bootstrap.'
    } | ConvertTo-Json -Compress
    exit 1
  }
  [pscustomobject]$summary | ConvertTo-Json -Depth 30 -Compress
  if ($overallStatus -ne 'ready') { exit 1 }
  exit 0
}

function Read-JsonFile {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "missing JSON file: $Path"
  }
  Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
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
  Set-Content -Encoding utf8 -LiteralPath $tmp -Value $Value
  Move-Item -Force -LiteralPath $tmp -Destination $Path
}

function Write-JsonFileAtomic {
  param(
    [string]$Path,
    [object]$Payload,
    [int]$Depth = 20
  )
  Write-TextFileAtomic -Path $Path -Value ($Payload | ConvertTo-Json -Depth $Depth)
}

function Invoke-SpecFirstCli {
  param([string[]]$CliArguments)
  $captured = Invoke-SpecFirstCliCaptured -CliArguments $CliArguments
  if (-not [string]::IsNullOrWhiteSpace($captured.output)) {
    Write-Output $captured.output
  }
  return $captured.exit_code
}

function Invoke-SpecFirstCliCaptured {
  param([string[]]$CliArguments)
  $invocation = Resolve-SpecFirstCliInvocation
  if ($null -eq $invocation) {
    return [pscustomobject]@{
      exit_code = 127
      output = ''
      timed_out = $false
    }
  }
  $exe = if ($invocation.Kind -eq 'node-script') { 'node' } else { $invocation.Path }
  $commandArgs = if ($invocation.Kind -eq 'node-script') { @($invocation.Path) + @($CliArguments) } else { @($CliArguments) }
  try {
    $startedAt = Get-UtcTimestamp
    $startedEpochMs = Get-EpochMilliseconds
    $result = Invoke-ExternalCommandWithTimeout -Exe $exe -CommandArguments $commandArgs -WorkingDirectory ([string](Get-Location)) -TimeoutSeconds $script:ProviderCommandTimeoutSeconds
    $finishedAt = Get-UtcTimestamp
    return [pscustomobject]@{
      exit_code = [int]$result.exit_code
      output = [string]$result.output
      timed_out = [bool]$result.timed_out
      started_at = $startedAt
      finished_at = $finishedAt
      duration_ms = ((Get-EpochMilliseconds) - $startedEpochMs)
    }
  } catch {
    return [pscustomobject]@{
      exit_code = 127
      output = [string]$_.Exception.Message
      timed_out = $false
      started_at = Get-UtcTimestamp
      finished_at = Get-UtcTimestamp
      duration_ms = 0
    }
  }
}

function Resolve-SpecFirstCliInvocation {
  $sourceCli = Join-Path $PSScriptRoot '../../../bin/spec-first.js'
  if (-not [string]::IsNullOrWhiteSpace($env:SPEC_FIRST_CLI)) {
    if ((Test-Path -LiteralPath $env:SPEC_FIRST_CLI -PathType Leaf) -and $env:SPEC_FIRST_CLI.EndsWith('.js')) {
      return [pscustomobject]@{
        Kind = 'node-script'
        Path = $env:SPEC_FIRST_CLI
      }
    } else {
      return [pscustomobject]@{
        Kind = 'executable'
        Path = $env:SPEC_FIRST_CLI
      }
    }
  }

  if (Test-Path -LiteralPath $sourceCli -PathType Leaf) {
    return [pscustomobject]@{
      Kind = 'node-script'
      Path = $sourceCli
    }
  }

  $command = Get-Command spec-first -ErrorAction SilentlyContinue
  if ($null -ne $command) {
    return [pscustomobject]@{
      Kind = 'executable'
      Path = $command.Source
    }
  }

  return $null
}

function Normalize-GitNexusInstructionBlockViaCli {
  param(
    [string]$RepoRoot,
    [string]$GitRootTopology = 'single-repo'
  )
  $captured = Invoke-SpecFirstCliCaptured -CliArguments @('gitnexus-instruction', 'normalize', '--repo-root', $RepoRoot, '--git-root-topology', $GitRootTopology, '--json')
  try {
    $payload = $captured.output | ConvertFrom-Json -ErrorAction Stop
    $results = if ($null -ne $payload -and ($payload.PSObject.Properties.Name -contains 'results')) { @($payload.results) } else { @() }
    $overallStatus = if ($null -ne $payload -and ($payload.PSObject.Properties.Name -contains 'overall_status')) { [string]$payload.overall_status } else { '' }
    if ($overallStatus -eq 'partial' -or @($results | Where-Object { $_.status -eq 'partial' }).Count -gt 0) {
      return New-GitNexusInstructionNormalizationResult -Status 'failed' -ReasonCode 'gitnexus-instruction-block-partial' -ExitCode $captured.exit_code -Results $results
    }
    if ($captured.exit_code -ne 0) {
      [Console]::Error.WriteLine('spec-graph-bootstrap: warning: could not dry-run GitNexus instruction block drift; run `spec-first init --claude` or `spec-first init --codex` to refresh host instructions.')
      $failureReason = if ($captured.timed_out) { 'gitnexus-instruction-normalizer-timeout' } else { 'gitnexus-instruction-normalizer-failed' }
      return New-GitNexusInstructionNormalizationResult -Status 'failed' -ReasonCode $failureReason -ExitCode $captured.exit_code -Diagnostic $captured.output -Results $results
    }
    if ($overallStatus -eq 'normalized' -or @($results | Where-Object { $_.status -eq 'updated' -and [bool]$_.changed }).Count -gt 0 -or @($results | Where-Object { $_.status -eq 'created' -and [bool]$_.changed }).Count -gt 0) {
      $writeFlag = if ($null -ne $payload -and ($payload.PSObject.Properties.Name -contains 'write')) { [bool]$payload.write } else { $false }
      $driftStatus = if ($writeFlag) { 'normalized' } else { 'drift-detected' }
      return New-GitNexusInstructionNormalizationResult -Status $driftStatus -ExitCode 0 -Results $results
    }
    if ($overallStatus -eq 'unchanged' -or @($results | Where-Object { $_.status -eq 'already-current' }).Count -gt 0) {
      return New-GitNexusInstructionNormalizationResult -Status 'unchanged' -ExitCode 0 -Results $results
    }
    $reasonCode = if ($null -ne $payload -and ($payload.PSObject.Properties.Name -contains 'reason_code') -and -not [string]::IsNullOrWhiteSpace([string]$payload.reason_code)) { [string]$payload.reason_code } else { 'gitnexus-instruction-block-missing' }
    return New-GitNexusInstructionNormalizationResult -Status 'not-applicable' -ReasonCode $reasonCode -ExitCode 0 -Results $results
  } catch {
    if ($captured.exit_code -ne 0) {
      [Console]::Error.WriteLine('spec-graph-bootstrap: warning: could not dry-run GitNexus instruction block drift; run `spec-first init --claude` or `spec-first init --codex` to refresh host instructions.')
      $failureReason = if ($captured.timed_out) { 'gitnexus-instruction-normalizer-timeout' } else { 'gitnexus-instruction-normalizer-failed' }
      return New-GitNexusInstructionNormalizationResult -Status 'failed' -ReasonCode $failureReason -ExitCode $captured.exit_code -Diagnostic $captured.output -Results @()
    }
    [Console]::Error.WriteLine('spec-graph-bootstrap: warning: GitNexus instruction normalizer returned non-JSON output.')
    return New-GitNexusInstructionNormalizationResult -Status 'failed' -ReasonCode 'gitnexus-instruction-normalizer-output-invalid' -ExitCode 0 -Diagnostic $captured.output -Results @()
  }
}

function New-WorkspaceGitNexusReadinessDefaultSummary {
  param([string]$ReasonCode)
  return [ordered]@{
    query_usability_counts = [ordered]@{
      'fresh-primary' = 0
      'stale-advisory' = 0
      'definitions-pointer' = 0
      unavailable = 0
    }
    workspace_gitnexus_readiness_pointer = [ordered]@{
      path = $null
      reason_code = $ReasonCode
    }
    group = [ordered]@{
      name = $null
      status = 'not-evaluated-no-mcp-input'
      query_selector = $null
    }
    group_reason_code = $ReasonCode
  }
}

function Compile-WorkspaceGitNexusReadinessForAllRepos {
  param([object]$TargetFacts)
  $workspaceDir = Join-Path ([string]$TargetFacts.workspace_root) '.spec-first/workspace'
  $workspaceSpecDir = Split-Path -Parent $workspaceDir
  if ((Test-SymlinkPath $workspaceSpecDir) -or (Test-SymlinkPath $workspaceDir)) {
    return New-WorkspaceGitNexusReadinessDefaultSummary -ReasonCode 'workspace-summary-symlink-escape'
  }
  Ensure-Directory -Path @($workspaceDir)
  if ((Test-SymlinkPath $workspaceSpecDir) -or (Test-SymlinkPath $workspaceDir)) {
    return New-WorkspaceGitNexusReadinessDefaultSummary -ReasonCode 'workspace-summary-symlink-escape'
  }
  $targetsPath = Join-Path $workspaceDir 'graph-targets.json'
  $readinessPath = Join-Path $workspaceDir 'gitnexus-readiness.json'
  $workspaceTargets = $null
  try {
    $workspaceResolver = Join-Path $PSScriptRoot 'resolve-workspace-graph-targets.ps1'
    Push-Location -LiteralPath ([string]$TargetFacts.workspace_root)
    try {
      $rawTargets = & $workspaceResolver -WriteSummary
    } finally {
      Pop-Location
    }
    $workspaceTargetsText = ($rawTargets -join "`n").Trim()
    $workspaceTargets = $workspaceTargetsText | ConvertFrom-Json -ErrorAction Stop
  } catch {
    $summary = New-WorkspaceGitNexusReadinessDefaultSummary -ReasonCode 'classifier-failed'
    $summary.workspace_gitnexus_readiness_pointer.diagnostic = 'workspace graph target resolver failed'
    return $summary
  }

  if ([string]$workspaceTargets.git_root_topology -ne 'multi-repo-workspace') {
    return New-WorkspaceGitNexusReadinessDefaultSummary -ReasonCode 'classifier-not-invoked'
  }

  $captured = Invoke-SpecFirstCliCaptured -CliArguments @('internal', 'workspace-gitnexus-readiness', '--mode', 'script', '--workspace-targets', $targetsPath, '--write-artifact', '--output', $readinessPath)
  $output = [string]$captured.output
  $exitCode = [int]$captured.exit_code

  if ($exitCode -eq 0) {
    try {
      $payload = $output | ConvertFrom-Json -ErrorAction Stop
      $reasonCode = if (Test-Path -LiteralPath $readinessPath -PathType Leaf) { 'script-mode-no-mcp' } else { 'script-mode-degraded' }
      $pointerPath = if ($reasonCode -eq 'script-mode-no-mcp') { '.spec-first/workspace/gitnexus-readiness.json' } else { $null }
      return [ordered]@{
        query_usability_counts = $payload.query_usability_counts
        workspace_gitnexus_readiness_pointer = [ordered]@{
          path = $pointerPath
          reason_code = $reasonCode
        }
        group = $payload.group
        group_reason_code = $payload.group_reason_code
      }
    } catch {
      $exitCode = 1
    }
  }

  [Console]::Error.WriteLine('spec-graph-bootstrap: warning: workspace GitNexus readiness classifier failed.')
  $failed = New-WorkspaceGitNexusReadinessDefaultSummary -ReasonCode 'classifier-failed'
  $failed.workspace_gitnexus_readiness_pointer.diagnostic = if ($output.Length -gt 1200) { $output.Substring(0, 1200) } else { $output }
  return $failed
}

function New-GitNexusInstructionNormalizationResult {
  param(
    [string]$Status,
    [string]$ReasonCode = '',
    [object]$ExitCode = $null,
    [string]$Diagnostic = '',
    [object[]]$Results = @()
  )
  $payload = [ordered]@{
    provider = 'gitnexus'
    status = $Status
    advisory = $true
    reason_code = if ([string]::IsNullOrWhiteSpace($ReasonCode)) { $null } else { $ReasonCode }
    exit_code = $ExitCode
    results = @($Results)
  }
  if (-not [string]::IsNullOrWhiteSpace($Diagnostic)) {
    $payload['diagnostic'] = $Diagnostic
  }
  return [pscustomobject]$payload
}

function Get-ObjectPropertyValue {
  param(
    [object]$Object,
    [string]$Name
  )
  if ($null -eq $Object) { return $null }
  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) { return $null }
  return $property.Value
}

function Test-ProviderArtifactContractSupported {
  param(
    [object]$ProviderArtifacts,
    [object]$ProviderConfig
  )
  $canonical = $ProviderArtifacts.canonical
  if ((Get-ObjectPropertyValue -Object $canonical -Name 'provider_status') -ne '.spec-first/graph/provider-status.json') { return $false }
  if ((Get-ObjectPropertyValue -Object $canonical -Name 'graph_facts') -ne '.spec-first/graph/graph-facts.json') { return $false }
  if ((Get-ObjectPropertyValue -Object $canonical -Name 'bootstrap_report') -ne '.spec-first/graph/bootstrap-report.md') { return $false }
  if ((Get-ObjectPropertyValue -Object $canonical -Name 'impact_capabilities') -ne '.spec-first/impact/bootstrap-impact-capabilities.json') { return $false }

  foreach ($property in $ProviderConfig.providers.PSObject.Properties) {
    if ($null -eq (Get-ObjectPropertyValue -Object $ProviderArtifacts.providers -Name $property.Name)) {
      return $false
    }
  }

  $gitNexusArtifacts = Get-ObjectPropertyValue -Object $ProviderArtifacts.providers -Name 'gitnexus'
  if ($null -ne $gitNexusArtifacts) {
    if ((Get-ObjectPropertyValue -Object $gitNexusArtifacts -Name 'raw_dir') -ne '.spec-first/providers/gitnexus/raw') { return $false }
    if ((Get-ObjectPropertyValue -Object $gitNexusArtifacts -Name 'normalized_dir') -ne '.spec-first/providers/gitnexus/normalized') { return $false }
    if ((Get-ObjectPropertyValue -Object $gitNexusArtifacts -Name 'status_path') -ne '.spec-first/providers/gitnexus/status.json') { return $false }
    $rawLogs = Get-ObjectPropertyValue -Object $gitNexusArtifacts -Name 'raw_logs'
    if ((Get-ObjectPropertyValue -Object $rawLogs -Name 'bootstrap') -ne '.spec-first/providers/gitnexus/raw/analyze.log') { return $false }
    if ((Get-ObjectPropertyValue -Object $rawLogs -Name 'status') -ne '.spec-first/providers/gitnexus/raw/status.log') { return $false }
    if ((Get-ObjectPropertyValue -Object $rawLogs -Name 'query_probe') -ne '.spec-first/providers/gitnexus/raw/query.log') { return $false }
    if ((Get-ObjectPropertyValue -Object $rawLogs -Name 'impact_probe') -ne '.spec-first/providers/gitnexus/raw/impact.log') { return $false }
    $normalized = Get-ObjectPropertyValue -Object $gitNexusArtifacts -Name 'normalized_artifacts'
    if ((Get-ObjectPropertyValue -Object $normalized -Name 'architecture_facts') -ne '.spec-first/providers/gitnexus/normalized/architecture-facts.json') { return $false }
    if ((Get-ObjectPropertyValue -Object $normalized -Name 'reuse_candidates') -ne '.spec-first/providers/gitnexus/normalized/reuse-candidates.json') { return $false }
    if ((Get-ObjectPropertyValue -Object $normalized -Name 'impact_capabilities') -ne '.spec-first/providers/gitnexus/normalized/impact-capabilities.json') { return $false }
  }

  return $true
}

function Test-SafeProviderCommandString {
  param([object]$Value)
  if ($Value -isnot [string]) { return $false }
  $text = [string]$Value
  foreach ($char in $text.ToCharArray()) {
    $code = [int][char]$char
    if ($code -lt 32 -or $code -eq 127) { return $false }
  }
  return ($text -notmatch '[;&|`$<>]')
}

function Test-SafeProviderToken {
  param([object]$Value)
  if (-not (Test-SafeProviderCommandString -Value $Value)) { return $false }
  return (-not [string]::IsNullOrWhiteSpace([string]$Value))
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
    if (-not (Test-SafeProviderCommandString -Value $arg)) { return $false }
  }

  if ($Provider -eq 'gitnexus') {
    $subcommand = switch ($Kind) {
      'bootstrap' { 'analyze' }
      'incremental' { 'analyze' }
      'status' { 'status' }
      'query_probe' { 'query' }
      'impact_probe' { 'impact' }
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
    if ($Kind -eq 'impact_probe') {
      return (
        $actual.Count -eq 10 -and
        [string]$actual[0] -eq 'npx' -and
        [string]$actual[1] -eq '-y' -and
        [string]$actual[2] -match '^gitnexus(@[A-Za-z0-9._~+:-]+)?$' -and
        [string]$actual[3] -eq 'impact' -and
        ([string]$actual[4]).Length -gt 0 -and
        [string]$actual[5] -eq '--repo' -and
        ([string]$actual[6]).Length -gt 0 -and
        [string]$actual[7] -eq '--include-tests' -and
        [string]$actual[8] -eq '--depth' -and
        [string]$actual[9] -eq '2'
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
        ) -or (
          $actual.Count -eq 6 -and
          [string]$actual[0] -eq 'npx' -and
          [string]$actual[1] -eq '-y' -and
          [string]$actual[2] -match '^gitnexus(@[A-Za-z0-9._~+:-]+)?$' -and
          [string]$actual[3] -eq 'analyze' -and
          [string]$actual[4] -eq '--skip-agents-md' -and
          [string]$actual[5] -eq '--no-stats'
        ) -or (
          $actual.Count -eq 7 -and
          [string]$actual[0] -eq 'npx' -and
          [string]$actual[1] -eq '-y' -and
          [string]$actual[2] -match '^gitnexus(@[A-Za-z0-9._~+:-]+)?$' -and
          [string]$actual[3] -eq 'analyze' -and
          [string]$actual[4] -eq '--force' -and
          [string]$actual[5] -eq '--skip-agents-md' -and
          [string]$actual[6] -eq '--no-stats'
        ) -or (
          $actual.Count -eq 8 -and
          [string]$actual[0] -eq 'npx' -and
          [string]$actual[1] -eq '-y' -and
          [string]$actual[2] -match '^gitnexus(@[A-Za-z0-9._~+:-]+)?$' -and
          [string]$actual[3] -eq 'analyze' -and
          [string]$actual[4] -eq '--skip-git' -and
          [string]$actual[5] -eq '--force' -and
          [string]$actual[6] -eq '--skip-agents-md' -and
          [string]$actual[7] -eq '--no-stats'
        )
      )
    }
    if ($Kind -eq 'incremental') {
      return (
        (
          $actual.Count -eq 4 -and
          [string]$actual[0] -eq 'npx' -and
          [string]$actual[1] -eq '-y' -and
          [string]$actual[2] -match '^gitnexus(@[A-Za-z0-9._~+:-]+)?$' -and
          [string]$actual[3] -eq 'analyze'
        ) -or (
          $actual.Count -eq 6 -and
          [string]$actual[0] -eq 'npx' -and
          [string]$actual[1] -eq '-y' -and
          [string]$actual[2] -match '^gitnexus(@[A-Za-z0-9._~+:-]+)?$' -and
          [string]$actual[3] -eq 'analyze' -and
          [string]$actual[4] -eq '--skip-agents-md' -and
          [string]$actual[5] -eq '--no-stats'
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

function Test-QueryProbePolicySupported {
  param(
    [object]$ProviderConfig,
    [string]$Provider
  )
  if ($Provider -ne 'gitnexus') { return $true }
  $entry = $ProviderConfig.providers.$Provider
  if (-not ($entry.PSObject.Properties.Name -contains 'query_probe_policy') -or $null -eq $entry.query_probe_policy) {
    return $true
  }
  $policy = $entry.query_probe_policy
  if ($policy -isnot [pscustomobject]) {
    return $false
  }
  foreach ($propertyName in @('selected_from', 'source')) {
    if ($policy.PSObject.Properties.Name -contains $propertyName -and $null -ne $policy.$propertyName -and $policy.$propertyName -isnot [string]) {
      return $false
    }
  }
  if ($policy.PSObject.Properties.Name -contains 'token') {
    if (-not (Test-SafeProviderToken -Value $policy.token)) {
      return $false
    }
  }
  if (-not ($policy.PSObject.Properties.Name -contains 'candidates') -or $null -eq $policy.candidates) {
    return $true
  }
  foreach ($candidate in @($policy.candidates)) {
    if (-not ($candidate.PSObject.Properties.Name -contains 'token') -or -not (Test-SafeProviderToken -Value $candidate.token)) {
      return $false
    }
    foreach ($propertyName in @('selected_from', 'reason_code')) {
      if ($candidate.PSObject.Properties.Name -contains $propertyName -and $null -ne $candidate.$propertyName -and $candidate.$propertyName -isnot [string]) {
        return $false
      }
    }
  }
  return $true
}

function Resolve-ProcessExecutable {
  param([string]$Exe)

  if ([string]::IsNullOrWhiteSpace($Exe)) {
    return $Exe
  }
  if ([System.IO.Path]::IsPathRooted($Exe) -or $Exe.Contains('\') -or $Exe.Contains('/')) {
    return $Exe
  }

  $commands = @(Get-Command $Exe -All -ErrorAction SilentlyContinue)
  $application = @($commands | Where-Object { $_.CommandType -eq 'Application' } | Select-Object -First 1)
  if ($application.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace([string]$application[0].Path)) {
    return [string]$application[0].Path
  }

  $externalScript = @($commands | Where-Object { $_.CommandType -eq 'ExternalScript' } | Select-Object -First 1)
  if ($externalScript.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace([string]$externalScript[0].Path)) {
    $scriptPath = [string]$externalScript[0].Path
    if ((Test-WindowsHost) -and [System.IO.Path]::GetExtension($scriptPath).Equals('.ps1', [System.StringComparison]::OrdinalIgnoreCase)) {
      $basePath = [System.IO.Path]::Combine([System.IO.Path]::GetDirectoryName($scriptPath), [System.IO.Path]::GetFileNameWithoutExtension($scriptPath))
      foreach ($extension in @('.cmd', '.exe', '.bat', '.com')) {
        $candidate = "${basePath}${extension}"
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
          return $candidate
        }
      }
    }
    return $scriptPath
  }

  return $Exe
}

function Test-WindowsHost {
  $isWindowsVariable = Get-Variable -Name IsWindows -ValueOnly -ErrorAction SilentlyContinue
  return ([bool]$isWindowsVariable -or [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT)
}

function ConvertTo-RepoRelativePath {
  param(
    [string]$Path,
    [string]$RepoRoot
  )
  if ([string]::IsNullOrWhiteSpace($Path) -or [string]::IsNullOrWhiteSpace($RepoRoot)) {
    return $Path
  }

  $normalizedPath = [System.IO.Path]::GetFullPath($Path).Replace('\', '/')
  $normalizedRoot = [System.IO.Path]::GetFullPath($RepoRoot).Replace('\', '/').TrimEnd('/')
  $comparison = if (Test-WindowsHost) { [System.StringComparison]::OrdinalIgnoreCase } else { [System.StringComparison]::Ordinal }
  if ($normalizedPath.Equals($normalizedRoot, $comparison)) {
    return '.'
  }
  $prefix = "$normalizedRoot/"
  if ($normalizedPath.StartsWith($prefix, $comparison)) {
    return $normalizedPath.Substring($prefix.Length)
  }
  return $normalizedPath
}

function Join-WindowsProcessArguments {
  param([object[]]$Arguments)

  $quoted = foreach ($argument in @($Arguments)) {
    $value = [string]$argument
    if ($value.Length -eq 0) { '""'; continue }
    if ($value -notmatch '[\s"]') { $value; continue }

    $builder = New-Object System.Text.StringBuilder
    [void]$builder.Append('"')
    $backslashes = 0
    foreach ($char in $value.ToCharArray()) {
      if ($char -eq '\') {
        $backslashes += 1
        continue
      }
      if ($char -eq '"') {
        if ($backslashes -gt 0) { [void]$builder.Append(('\' * ($backslashes * 2))) }
        [void]$builder.Append('\"')
        $backslashes = 0
        continue
      }
      if ($backslashes -gt 0) {
        [void]$builder.Append(('\' * $backslashes))
        $backslashes = 0
      }
      [void]$builder.Append($char)
    }
    if ($backslashes -gt 0) { [void]$builder.Append(('\' * ($backslashes * 2))) }
    [void]$builder.Append('"')
    $builder.ToString()
  }

  return ($quoted -join ' ')
}

function Set-ProcessArgumentsCompat {
  param(
    [System.Diagnostics.ProcessStartInfo]$ProcessInfo,
    [object[]]$Arguments
  )

  if ($ProcessInfo.PSObject.Properties.Name -contains 'ArgumentList') {
    foreach ($argument in @($Arguments)) {
      [void]$ProcessInfo.ArgumentList.Add([string]$argument)
    }
    return
  }

  $ProcessInfo.Arguments = Join-WindowsProcessArguments -Arguments $Arguments
}

function Invoke-ExternalCommandWithTimeout {
  param(
    [string]$Exe,
    [object[]]$CommandArguments,
    [string]$WorkingDirectory,
    [int]$TimeoutSeconds
  )
  $resolvedExe = Resolve-ProcessExecutable -Exe $Exe
  $processInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $processInfo.FileName = $resolvedExe
  Set-ProcessArgumentsCompat -ProcessInfo $processInfo -Arguments $CommandArguments
  $processInfo.WorkingDirectory = $WorkingDirectory
  $processInfo.RedirectStandardOutput = $true
  $processInfo.RedirectStandardError = $true
  $processInfo.UseShellExecute = $false

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $processInfo
  try {
    [void]$process.Start()
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $timedOut = -not $process.WaitForExit($TimeoutSeconds * 1000)
    if ($timedOut) {
      try {
        $process.Kill($true)
      } catch {
        try { $process.Kill() } catch {}
      }
      $process.WaitForExit()
    }
    $stdoutTask.Wait()
    $stderrTask.Wait()
    $outputParts = @($stdoutTask.Result, $stderrTask.Result) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }
    if ($timedOut) {
      $outputParts += "command timed out after ${TimeoutSeconds}s"
    }
    return [pscustomobject]@{
      exit_code = if ($timedOut) { 124 } else { $process.ExitCode }
      output = ($outputParts -join [Environment]::NewLine)
      timed_out = $timedOut
    }
  } catch {
    return [pscustomobject]@{
      exit_code = 127
      output = [string]$_.Exception.Message
      timed_out = $false
    }
  } finally {
    $process.Dispose()
  }
}

function Invoke-ConfiguredCommand {
  param(
    [object]$ProviderConfig,
    [string]$Provider,
    [string]$Kind,
    [string]$LogPath,
    [string]$RepoRoot
  )
  Ensure-Directory -Path @((Split-Path -Parent $LogPath))
  $command = @($ProviderConfig.providers.$Provider.commands.$Kind)
  $exe = [string]$command[0]
  $commandArgs = @($command | Select-Object -Skip 1)
  [Console]::Error.WriteLine("spec-graph-bootstrap: running $Provider $Kind; dependencies may download on first use...")
  $startedAt = Get-UtcTimestamp
  $startedEpochMs = Get-EpochMilliseconds
  $result = Invoke-ExternalCommandWithTimeout -Exe $exe -CommandArguments $commandArgs -WorkingDirectory $RepoRoot -TimeoutSeconds $script:ProviderCommandTimeoutSeconds
  $finishedAt = Get-UtcTimestamp
  $durationMs = (Get-EpochMilliseconds) - $startedEpochMs
  $exitCode = [int]$result.exit_code
  if ($result.timed_out) {
    [Console]::Error.WriteLine("spec-graph-bootstrap: timed out $Provider $Kind after ${script:ProviderCommandTimeoutSeconds}s")
  } else {
    [Console]::Error.WriteLine("spec-graph-bootstrap: finished $Provider $Kind with exit $exitCode")
  }
  $outputText = [string]$result.output
  Set-Content -Encoding utf8 -LiteralPath $LogPath -Value $outputText
  $diagnostic = (($outputText -replace '\s+', ' ').Trim())
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
    raw_log = ConvertTo-RepoRelativePath -Path $LogPath -RepoRoot $RepoRoot
    started_at = $startedAt
    finished_at = $finishedAt
    duration_ms = $durationMs
  }
}

function Invoke-ProviderCommandArray {
  param(
    [object[]]$Command,
    [string]$Provider,
    [string]$Kind,
    [string]$LogPath,
    [string]$RepoRoot,
    [string]$RefreshMode = '',
    [string]$AttemptRole = ''
  )
  Ensure-Directory -Path @((Split-Path -Parent $LogPath))
  $exe = [string]$Command[0]
  $commandArgs = @($Command | Select-Object -Skip 1)
  [Console]::Error.WriteLine("spec-graph-bootstrap: running $Provider $Kind; dependencies may download on first use...")
  $startedAt = Get-UtcTimestamp
  $startedEpochMs = Get-EpochMilliseconds
  $result = Invoke-ExternalCommandWithTimeout -Exe $exe -CommandArguments $commandArgs -WorkingDirectory $RepoRoot -TimeoutSeconds $script:ProviderCommandTimeoutSeconds
  $finishedAt = Get-UtcTimestamp
  $durationMs = (Get-EpochMilliseconds) - $startedEpochMs
  $exitCode = [int]$result.exit_code
  if ($result.timed_out) {
    [Console]::Error.WriteLine("spec-graph-bootstrap: timed out $Provider $Kind after ${script:ProviderCommandTimeoutSeconds}s")
  } else {
    [Console]::Error.WriteLine("spec-graph-bootstrap: finished $Provider $Kind with exit $exitCode")
  }
  $outputText = [string]$result.output
  Set-Content -Encoding utf8 -LiteralPath $LogPath -Value $outputText
  $diagnostic = (($outputText -replace '\s+', ' ').Trim())
  $truncated = $false
  if ($diagnostic.Length -gt 1000) {
    $diagnostic = $diagnostic.Substring(0, 1000)
    $truncated = $true
  }
  $payload = [ordered]@{
    kind = 'bootstrap'
    command = ($Command -join ' ')
    exit_code = $exitCode
    diagnostic = $diagnostic
    diagnostics_truncated = $truncated
    raw_log = ConvertTo-RepoRelativePath -Path $LogPath -RepoRoot $RepoRoot
    started_at = $startedAt
    finished_at = $finishedAt
    duration_ms = $durationMs
  }
  if (-not [string]::IsNullOrWhiteSpace($RefreshMode)) {
    $payload['refresh_mode'] = $RefreshMode
  }
  if (-not [string]::IsNullOrWhiteSpace($AttemptRole)) {
    $payload['attempt_role'] = $AttemptRole
  }
  return [pscustomobject]$payload
}

function Get-ProviderIncrementalCommand {
  param(
    [object]$ProviderConfig,
    [string]$Provider,
    [string]$LastIndexedCommit
  )
  $command = @($ProviderConfig.providers.$Provider.commands.incremental)
  return @($command)
}

function Get-ProviderFullCommand {
  param(
    [object]$ProviderConfig,
    [string]$Provider
  )
  return @($ProviderConfig.providers.$Provider.commands.bootstrap)
}

function Get-ProviderBootstrapLogPath {
  param(
    [string]$Provider,
    [string]$RefreshMode,
    [string]$AttemptRole,
    [string]$RawDir
  )
  if ($Provider -eq 'gitnexus') {
    if ($AttemptRole -eq 'fallback') { return (Join-Path $RawDir 'fallback-analyze.log') }
    return (Join-Path $RawDir 'analyze.log')
  }
  if ($RefreshMode -eq 'incremental') { return (Join-Path $RawDir 'update.log') }
  if ($AttemptRole -eq 'fallback') { return (Join-Path $RawDir 'fallback-build.log') }
  return (Join-Path $RawDir 'build.log')
}

function Invoke-GitNexusQueryProbeCandidate {
  param(
    [object]$ProviderConfig,
    [string]$Provider,
    [string]$Token,
    [string]$LogPath,
    [string]$RepoRoot
  )
  Ensure-Directory -Path @((Split-Path -Parent $LogPath))
  $command = @($ProviderConfig.providers.$Provider.commands.query_probe)
  $command[4] = $Token
  $exe = [string]$command[0]
  $commandArgs = @($command | Select-Object -Skip 1)
  [Console]::Error.WriteLine("spec-graph-bootstrap: running $Provider query_probe token=$Token; dependencies may download on first use...")
  $startedAt = Get-UtcTimestamp
  $startedEpochMs = Get-EpochMilliseconds
  $result = Invoke-ExternalCommandWithTimeout -Exe $exe -CommandArguments $commandArgs -WorkingDirectory $RepoRoot -TimeoutSeconds $script:ProviderCommandTimeoutSeconds
  $finishedAt = Get-UtcTimestamp
  $durationMs = (Get-EpochMilliseconds) - $startedEpochMs
  $exitCode = [int]$result.exit_code
  if ($result.timed_out) {
    [Console]::Error.WriteLine("spec-graph-bootstrap: timed out $Provider query_probe token=$Token after ${script:ProviderCommandTimeoutSeconds}s")
  } else {
    [Console]::Error.WriteLine("spec-graph-bootstrap: finished $Provider query_probe token=$Token with exit $exitCode")
  }
  $outputText = [string]$result.output
  Set-Content -Encoding utf8 -LiteralPath $LogPath -Value $outputText
  $diagnostic = (($outputText -replace '\s+', ' ').Trim())
  $truncated = $false
  if ($diagnostic.Length -gt 1000) {
    $diagnostic = $diagnostic.Substring(0, 1000)
    $truncated = $true
  }
  [pscustomobject]@{
    kind = 'query_probe'
    command = ($command -join ' ')
    exit_code = $exitCode
    diagnostic = $diagnostic
    diagnostics_truncated = $truncated
    raw_log = ConvertTo-RepoRelativePath -Path $LogPath -RepoRoot $RepoRoot
    started_at = $startedAt
    finished_at = $finishedAt
    duration_ms = $durationMs
  }
}

$script:QueryProbeVerificationReason = ''
$script:QueryProbeResultClass = ''

function Test-GitNexusQueryProbeVerified {
  param(
    [object]$CommandResult,
    [string]$LogPath,
    [string]$TargetKind = ''
)
  $script:QueryProbeVerificationReason = ''
  $script:QueryProbeResultClass = ''
  $badDiagnosticPattern = 'FTS index ensure failed|Cannot execute write operations in a read-only database|doesn.?t have an index|Connection exception|BM25/FTS search failed|FTS extension unavailable|missing[ -]index'
  if ([string]$CommandResult.diagnostic -match $badDiagnosticPattern) {
    $script:QueryProbeVerificationReason = 'GitNexus query probe emitted FTS/read-only/missing-index diagnostics.'
    $script:QueryProbeResultClass = 'diagnostic'
    return $false
  }
  $logText = if (Test-Path -LiteralPath $LogPath -PathType Leaf) { Get-Content -Raw -LiteralPath $LogPath } else { '' }
  $jsonMatch = [regex]::Match($logText, '(?ms)^[ \t]*\{.*\}\s*$')
  if (-not $jsonMatch.Success) {
    $script:QueryProbeVerificationReason = 'GitNexus query probe did not return parseable JSON.'
    $script:QueryProbeResultClass = 'empty-or-unparseable'
    return $false
  }
  try {
    $payload = $jsonMatch.Value | ConvertFrom-Json
  } catch {
    $script:QueryProbeVerificationReason = 'GitNexus query probe did not return parseable JSON.'
    $script:QueryProbeResultClass = 'empty-or-unparseable'
    return $false
  }
  if ($payload.PSObject.Properties.Name -contains 'warning') {
    $script:QueryProbeVerificationReason = 'GitNexus query probe returned a warning payload.'
    $script:QueryProbeResultClass = 'empty-or-unparseable'
    return $false
  }
  $resultCount = 0
  foreach ($propertyName in @('processes', 'process_symbols')) {
    if ($payload.PSObject.Properties.Name -contains $propertyName -and $null -ne $payload.$propertyName) {
      $resultCount += @($payload.$propertyName).Count
    }
  }
  if ($resultCount -le 0) {
    $definitionCount = if ($payload.PSObject.Properties.Name -contains 'definitions' -and $null -ne $payload.definitions) { @($payload.definitions).Count } else { 0 }
    if ($definitionCount -gt 0) {
      $script:QueryProbeResultClass = 'definitions-only'
      $script:QueryProbeVerificationReason = 'GitNexus query probe returned definitions-only evidence; accepted as query-ready for query/context orientation without process graph evidence.'
      return $true
    } else {
      $script:QueryProbeVerificationReason = 'GitNexus query probe did not return non-empty BM25/process query results.'
      $script:QueryProbeResultClass = 'empty-or-unparseable'
    }
  }
  if ($resultCount -gt 0) {
    $script:QueryProbeResultClass = 'process-results'
  }
  return ($resultCount -gt 0)
}

function Test-GitNexusImpactProbeHasRelatedTests {
  param([string]$LogPath)
  $logText = if (Test-Path -LiteralPath $LogPath -PathType Leaf) { Get-Content -Raw -LiteralPath $LogPath } else { '' }
  $jsonMatch = [regex]::Match($logText, '(?ms)^[ \t]*\{.*\}\s*$')
  if (-not $jsonMatch.Success) { return $false }
  try {
    $payload = $jsonMatch.Value | ConvertFrom-Json
  } catch {
    return $false
  }

  function Get-PathLikeJsonValues {
    param([AllowNull()][object]$Value)
    if ($null -eq $Value) { return }
    if ($Value -is [string]) { return }
    if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [System.Collections.IDictionary])) {
      foreach ($item in $Value) {
        Get-PathLikeJsonValues -Value $item
      }
      return
    }
    foreach ($property in @($Value.PSObject.Properties)) {
      if (@('filePath', 'path', 'file') -contains [string]$property.Name -and $property.Value -is [string]) {
        [string]$property.Value
      }
      Get-PathLikeJsonValues -Value $property.Value
    }
  }

  foreach ($candidatePath in @(Get-PathLikeJsonValues -Value $payload)) {
    $normalizedPath = ([string]$candidatePath).Replace('\', '/')
    if ($normalizedPath -match '(^|/)(tests?|__tests__|androidTest)(/|$)' -or $normalizedPath -match '\.(test|spec)\.[A-Za-z0-9]+$') {
      return $true
    }
  }
  return $false
}

function Get-GitNexusQueryProbeCandidates {
  param(
    [object]$ProviderConfig,
    [string]$Provider
  )
  $entry = $ProviderConfig.providers.$Provider
  if ($entry.PSObject.Properties.Name -contains 'query_probe_policy' -and $null -ne $entry.query_probe_policy -and $entry.query_probe_policy.PSObject.Properties.Name -contains 'candidates' -and @($entry.query_probe_policy.candidates).Count -gt 0) {
    return @($entry.query_probe_policy.candidates | Select-Object -First $script:GitNexusQueryProbeCandidateLimit)
  }
  $policy = if ($entry.PSObject.Properties.Name -contains 'query_probe_policy') { $entry.query_probe_policy } else { $null }
  $token = if ($null -ne $policy -and $policy.PSObject.Properties.Name -contains 'token') { [string]$policy.token } else { [string]@($entry.commands.query_probe)[4] }
  $selectedFrom = if ($null -ne $policy -and $policy.PSObject.Properties.Name -contains 'selected_from') { $policy.selected_from } else { $null }
  return @([pscustomobject][ordered]@{
    token = $token
    selected_from = $selectedFrom
    reason_code = if ($null -ne $policy -and $policy.PSObject.Properties.Name -contains 'source') { [string]$policy.source } else { 'legacy-token' }
  })
}

function Get-GitNexusQueryProbeCandidateCount {
  param(
    [object]$ProviderConfig,
    [string]$Provider
  )
  $entry = $ProviderConfig.providers.$Provider
  if ($entry.PSObject.Properties.Name -contains 'query_probe_policy' -and $null -ne $entry.query_probe_policy -and $entry.query_probe_policy.PSObject.Properties.Name -contains 'candidates' -and @($entry.query_probe_policy.candidates).Count -gt 0) {
    return @($entry.query_probe_policy.candidates).Count
  }
  return 1
}

function Test-GitNexusQueryProbeExpectedHit {
  param(
    [object]$ProviderConfig,
    [string]$Provider
  )
  $entry = $ProviderConfig.providers.$Provider
  if ($entry.PSObject.Properties.Name -contains 'query_probe_policy' -and $null -ne $entry.query_probe_policy -and $entry.query_probe_policy.PSObject.Properties.Name -contains 'expected_hit') {
    return [bool]$entry.query_probe_policy.expected_hit
  }
  return $true
}

function Get-GitNexusRepoNameFromRemoteUrlForDiagnostic {
  param([string]$RemoteUrl)
  if ([string]::IsNullOrWhiteSpace($RemoteUrl)) { return '' }
  $remote = $RemoteUrl.Trim()
  $remote = ($remote -split '[?#]', 2)[0].TrimEnd([char[]]@('/', '\'))
  if ([string]::IsNullOrWhiteSpace($remote)) { return '' }

  $name = [System.IO.Path]::GetFileName($remote)
  if ([string]::IsNullOrWhiteSpace($name) -or $name -eq $remote) {
    $parts = $remote -split ':'
    $name = $parts[$parts.Count - 1]
  }
  if ($name.EndsWith('.git')) {
    $name = $name.Substring(0, $name.Length - 4)
  }
  if ($name -match '^[A-Za-z0-9._-]+$') {
    return $name
  }
  return ''
}

function Invoke-GitConfigValueForDiagnostic {
  param(
    [string]$RepoRoot,
    [string[]]$GitArguments
  )
  try {
    $output = & git -C $RepoRoot @GitArguments 2>$null
    if ($LASTEXITCODE -eq 0 -and $null -ne $output) {
      return [string](@($output)[0])
    }
  } catch {
  }
  return ''
}

function Get-GitRemoteUrlForDiagnostic {
  param([string]$RepoRoot)
  if ($targetKind -eq 'non-git-folder') {
    return ''
  }
  if ($null -eq (Get-Command git -ErrorAction SilentlyContinue)) {
    return ''
  }

  $originUrl = Invoke-GitConfigValueForDiagnostic -RepoRoot $RepoRoot -GitArguments @('config', '--get', 'remote.origin.url')
  if (-not [string]::IsNullOrWhiteSpace($originUrl)) {
    return $originUrl
  }

  $currentBranch = Invoke-GitConfigValueForDiagnostic -RepoRoot $RepoRoot -GitArguments @('rev-parse', '--abbrev-ref', 'HEAD')
  if (-not [string]::IsNullOrWhiteSpace($currentBranch) -and $currentBranch -ne 'HEAD') {
    $branchRemote = Invoke-GitConfigValueForDiagnostic -RepoRoot $RepoRoot -GitArguments @('config', '--get', "branch.$currentBranch.remote")
    if (-not [string]::IsNullOrWhiteSpace($branchRemote)) {
      $branchRemoteUrl = Invoke-GitConfigValueForDiagnostic -RepoRoot $RepoRoot -GitArguments @('config', '--get', "remote.$branchRemote.url")
      if (-not [string]::IsNullOrWhiteSpace($branchRemoteUrl)) {
        return $branchRemoteUrl
      }
    }
  }

  try {
    $remoteNames = @(& git -C $RepoRoot remote 2>$null | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
    if ($LASTEXITCODE -eq 0 -and $remoteNames.Count -eq 1) {
      return (Invoke-GitConfigValueForDiagnostic -RepoRoot $RepoRoot -GitArguments @('config', '--get', "remote.$($remoteNames[0]).url"))
    }
  } catch {
  }
  return ''
}

function Get-GitNexusCurrentRepoLabelForDiagnostic {
  param([string]$RepoRoot)
  $metaPath = Join-Path $RepoRoot '.gitnexus/meta.json'
  if (Test-Path -LiteralPath $metaPath -PathType Leaf) {
    try {
      $meta = Get-Content -Raw -LiteralPath $metaPath | ConvertFrom-Json
      if ($meta.PSObject.Properties.Name -contains 'remoteUrl') {
        $metaRepoName = Get-GitNexusRepoNameFromRemoteUrlForDiagnostic -RemoteUrl ([string]$meta.remoteUrl)
        if (-not [string]::IsNullOrWhiteSpace($metaRepoName)) {
          return $metaRepoName
        }
      }
    } catch {
    }
  }

  return (Get-GitNexusRepoNameFromRemoteUrlForDiagnostic -RemoteUrl (Get-GitRemoteUrlForDiagnostic -RepoRoot $RepoRoot))
}

function Get-GitNexusRepoLabelMismatchFailureInfo {
  param(
    [object]$ProviderConfig,
    [string]$RepoRoot,
    [int]$ExitCode
  )
  $configured = [string]@($ProviderConfig.providers.gitnexus.commands.query_probe)[6]
  $current = Get-GitNexusCurrentRepoLabelForDiagnostic -RepoRoot $RepoRoot
  if (-not [string]::IsNullOrWhiteSpace($configured) -and -not [string]::IsNullOrWhiteSpace($current) -and $configured -ne $current) {
    return [ordered]@{
      failed_phase = 'query_probe'
      failure_class = 'provider-projection-stale'
      reason_code = 'gitnexus-repo-label-mismatch'
      exit_code = $ExitCode
      recommended_action = 'Rerun spec-mcp-setup to refresh .spec-first/config/graph-providers.json from GitNexus metadata or git remote basename, then rerun spec-graph-bootstrap.'
      diagnostic = "GitNexus query probe used setup-projected repo label '$configured', but current repository metadata points to '$current'."
    }
  }
  return $null
}

function Get-ConfiguredGitNexusPackageSpec {
  param([object]$ProviderConfig)
  return (Get-ProviderConfiguredPackageSpec -ProviderConfig $ProviderConfig -Provider 'gitnexus')
}

function Get-ProviderCommandPackageSpec {
  param(
    [object]$ProviderConfig,
    [string]$Provider,
    [string]$Kind
  )
  $command = @($ProviderConfig.providers.$Provider.commands.$Kind)
  if ($Provider -eq 'gitnexus') {
    if ($command.Count -ge 3 -and [string]$command[0] -eq 'npx' -and [string]$command[1] -eq '-y') {
      return [string]$command[2]
    }
    return ''
  }
  return ''
}

function Get-BundledGitNexusPackageSpec {
  if ([string]::IsNullOrWhiteSpace([string]$script:McpToolsJson) -or -not (Test-Path -LiteralPath $script:McpToolsJson -PathType Leaf)) {
    return ''
  }
  try {
    $toolsJson = Get-Content -Raw -LiteralPath $script:McpToolsJson | ConvertFrom-Json
    $tool = @($toolsJson.tools | Where-Object { $_.id -eq 'gitnexus' } | Select-Object -First 1)
    if ($tool.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace([string]$tool[0].package) -and -not [string]::IsNullOrWhiteSpace([string]$tool[0].version)) {
      return "$($tool[0].package)@$($tool[0].version)"
    }
  } catch {
  }
  return ''
}

function Get-ProviderConfiguredPackageSpec {
  param(
    [object]$ProviderConfig,
    [string]$Provider
  )
  $phases = @('bootstrap', 'status', 'query_probe')
  $commands = $ProviderConfig.providers.$Provider.commands
  if ($null -ne $commands -and $commands.PSObject.Properties.Name -contains 'incremental') {
    $phases += 'incremental'
  }
  if ($null -ne $commands -and $commands.PSObject.Properties.Name -contains 'impact_probe') {
    $phases += 'impact_probe'
  }
  $packages = @($phases | ForEach-Object {
    Get-ProviderCommandPackageSpec -ProviderConfig $ProviderConfig -Provider $Provider -Kind $_
  })
  $missing = @($packages | Where-Object { [string]::IsNullOrWhiteSpace([string]$_) })
  $unique = @($packages | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } | Sort-Object -Unique)
  if ($missing.Count -eq 0 -and $unique.Count -eq 1) {
    return [string]$unique[0]
  }
  if ($packages.Count -gt 0) {
    return "mixed-provider-command-packages:$($packages -join ',')"
  }
  return ''
}

function Get-ProviderBundledPackageSpec {
  param([string]$Provider)
  if ($Provider -eq 'gitnexus') {
    return (Get-BundledGitNexusPackageSpec)
  }
  return ''
}

function Get-ProviderVersionPolicy {
  param(
    [string]$Provider,
    [string]$ConfiguredPackage,
    [string]$BundledPackage
  )
  if (-not [string]::IsNullOrWhiteSpace($ConfiguredPackage) -and -not [string]::IsNullOrWhiteSpace($BundledPackage) -and $ConfiguredPackage -eq $BundledPackage) {
    return 'pinned'
  }
  if (-not [string]::IsNullOrWhiteSpace($ConfiguredPackage) -and -not [string]::IsNullOrWhiteSpace($BundledPackage) -and $ConfiguredPackage -ne $BundledPackage) {
    return 'projection-stale'
  }
  return 'floating-unverifiable'
}

function Get-ProviderReuseDecision {
  param(
    [string]$SkipReason,
    [string]$VersionPolicy
  )
  if (-not [string]::IsNullOrWhiteSpace($SkipReason)) {
    return [pscustomobject]@{ eligible = $false; reason = 'provider-not-enabled' }
  }
  if ($VersionPolicy -eq 'pinned') {
    return [pscustomobject]@{ eligible = $true; reason = $null }
  }
  if ($VersionPolicy -eq 'projection-stale') {
    return [pscustomobject]@{ eligible = $false; reason = 'provider-projection-stale' }
  }
  return [pscustomobject]@{ eligible = $false; reason = 'provider-version-unverifiable' }
}

function Get-ProviderCommandHash {
  param(
    [object]$ProviderConfig,
    [string]$Provider
  )
  $commands = ConvertTo-CanonicalJsonValue -Value $ProviderConfig.providers.$Provider.commands | ConvertTo-Json -Depth 20 -Compress
  return (Get-StatusHash -Text $commands)
}

function Get-BootstrapFingerprint {
  param(
    [object]$ProviderConfig,
    [string]$Provider,
    [string]$ConfiguredPackage,
    [string]$BundledPackage,
    [string]$VersionPolicy,
    [string]$SourceRevision,
    [bool]$WorktreeDirty,
    [string]$WorktreeStatusHash,
    [string]$TargetKind = '',
    [string]$ContentFingerprint = ''
  )
  return [ordered]@{
    schema_version = 'graph-bootstrap-fingerprint.v1'
    repo_snapshot = [ordered]@{
      target_kind = $TargetKind
      source_revision = if ($TargetKind -eq 'non-git-folder') { $null } else { $SourceRevision }
      worktree_dirty = if ($TargetKind -eq 'non-git-folder') { $null } else { $WorktreeDirty }
      worktree_status_hash = if ($TargetKind -eq 'non-git-folder') { $null } else { $WorktreeStatusHash }
      folder_snapshot = if ($TargetKind -eq 'non-git-folder') { [ordered]@{ content_fingerprint = $ContentFingerprint } } else { $null }
    }
    spec_first = [ordered]@{
      package_version = $script:SpecFirstPackageVersion
      graph_bootstrap_script_hash = $script:GraphBootstrapScriptHash
      mcp_tools_hash = $script:McpToolsHash
    }
    provider_projection = [ordered]@{
      graph_providers_hash = $script:GraphProvidersHash
      runtime_capabilities_hash = $script:RuntimeCapabilitiesHash
      provider_artifacts_hash = $script:ProviderArtifactsHash
    }
    provider = [ordered]@{
      id = $Provider
      command_hash = (Get-ProviderCommandHash -ProviderConfig $ProviderConfig -Provider $Provider)
      configured_package_spec = if ([string]::IsNullOrWhiteSpace($ConfiguredPackage)) { $null } else { $ConfiguredPackage }
      bundled_package_spec = if ([string]::IsNullOrWhiteSpace($BundledPackage)) { $null } else { $BundledPackage }
      version_policy = $VersionPolicy
    }
  }
}

function Get-GitNexusProviderProjectionStaleFailureInfo {
  param(
    [string]$ConfiguredPackage,
    [string]$BundledPackage
  )
  return [ordered]@{
    failed_phase = 'preflight'
    failure_class = 'provider-projection-stale'
    reason_code = 'gitnexus-provider-projection-stale'
    exit_code = $null
    recommended_action = "Rerun spec-mcp-setup to refresh .spec-first/config/graph-providers.json from bundled GitNexus package '$BundledPackage'; it currently projects '$ConfiguredPackage'. Then rerun spec-graph-bootstrap."
    diagnostic = "GitNexus setup-projected package '$ConfiguredPackage' differs from bundled package '$BundledPackage' before provider commands ran."
  }
}

function Get-ProviderProjectionStaleFailureInfo {
  param(
    [string]$Provider,
    [string]$ConfiguredPackage,
    [string]$BundledPackage
  )
  if ($Provider -eq 'gitnexus') {
    return (Get-GitNexusProviderProjectionStaleFailureInfo -ConfiguredPackage $ConfiguredPackage -BundledPackage $BundledPackage)
  }
  return $null
}

function Get-ProviderDisplayName {
  param([string]$Provider)
  if ($Provider -eq 'gitnexus') { return 'GitNexus' }
  return $Provider
}

function Get-GitNexusQueryDiagnosticFailureInfo {
  param(
    [object]$ProviderConfig,
    [int]$ExitCode,
    [object[]]$QueryProbeAttempts
  )
  if (@($QueryProbeAttempts | Where-Object { $_.result_class -eq 'diagnostic' }).Count -le 0) {
    return $null
  }

  $configuredPackage = Get-ConfiguredGitNexusPackageSpec -ProviderConfig $ProviderConfig
  $bundledPackage = Get-BundledGitNexusPackageSpec
  if (
    -not [string]::IsNullOrWhiteSpace($configuredPackage) -and
    -not [string]::IsNullOrWhiteSpace($bundledPackage) -and
    $configuredPackage -ne $bundledPackage
  ) {
    return [ordered]@{
      failed_phase = 'query_probe'
      failure_class = 'provider-projection-stale'
      reason_code = 'gitnexus-query-provider-projection-stale'
      exit_code = $ExitCode
      recommended_action = "Rerun spec-mcp-setup to refresh .spec-first/config/graph-providers.json from bundled GitNexus package '$bundledPackage'; it currently projects '$configuredPackage'. Then rerun spec-graph-bootstrap. Use bounded source reads, git diff, ast-grep, tests, and logs until GitNexus query proof returns process results."
      diagnostic = "GitNexus query probe emitted FTS/read-only/missing-index diagnostics while setup-projected package '$configuredPackage' differs from bundled package '$bundledPackage'."
    }
  }

  return [ordered]@{
    failed_phase = 'query_probe'
    failure_class = 'provider-storage-readonly'
    reason_code = 'gitnexus-query-fts-readonly'
    exit_code = $ExitCode
    recommended_action = 'GitNexus query emitted FTS/read-only/missing-index diagnostics after build/status succeeded. Repair GitNexus index storage or permissions, or clean/reanalyze GitNexus with a fixed provider version, then rerun spec-graph-bootstrap. Use bounded source reads, git diff, ast-grep, tests, and logs meanwhile.'
    diagnostic = 'GitNexus query probe emitted FTS/read-only/missing-index diagnostics after build/status succeeded.'
  }
}

function Get-ProviderFailureInfo {
  param(
    [string]$Provider,
    [string]$Phase,
    [int]$ExitCode,
    [string]$Diagnostic = ''
  )
  if ($Provider -eq 'gitnexus' -and $Phase -eq 'bootstrap' -and $ExitCode -eq 139) {
    return [ordered]@{
      failed_phase = 'bootstrap'
      failure_class = 'provider-crash'
      reason_code = 'gitnexus-analyze-sigsegv'
      exit_code = $ExitCode
      recommended_action = 'Do not trust GitNexus artifacts. Use bounded local fallback; capture analyze.log and retry with a newer GitNexus rc or safer GitNexus runtime settings.'
    }
  }
  if (
    $Provider -eq 'gitnexus' -and
    $Phase -eq 'bootstrap' -and
    $ExitCode -ne 0 -and
    [string]$Diagnostic -match '(?i)(Cannot open file.*\.gitnexus[\\/]+lbug|\.gitnexus[\\/]+lbug.*Error 3)'
  ) {
    return [ordered]@{
      failed_phase = 'bootstrap'
      failure_class = 'provider-storage-write-failed'
      reason_code = 'gitnexus-analyze-storage-write-failed'
      exit_code = $ExitCode
      recommended_action = 'GitNexus analyze could not open or write its .gitnexus index state such as .gitnexus/lbug. First verify spec-mcp-setup refreshed the provider projection to the bundled GitNexus package, then rerun spec-graph-bootstrap. If the current bundled package still fails, preserve analyze.log and inspect Windows locks, permissions, path state, or explicitly archive/remove stale .gitnexus as a recovery action. Use bounded source reads, git diff, ast-grep, tests, and logs meanwhile.'
    }
  }
  if ($ExitCode -eq 124) {
    return [ordered]@{
      failed_phase = $Phase
      failure_class = 'provider-timeout'
      reason_code = 'provider-command-timeout'
      exit_code = $ExitCode
      recommended_action = 'Provider command timed out. Inspect the raw log, increase SPEC_FIRST_PROVIDER_COMMAND_TIMEOUT_SECONDS if the command is legitimately slow, or fix the provider before rerunning graph bootstrap.'
    }
  }
  if ($ExitCode -ne 0 -and [string]$Diagnostic -match '(?i)(ENOTFOUND|getaddrinfo|registry\.npmmirror\.com|registry\.npmjs\.org|EAI_AGAIN)') {
    return [ordered]@{
      failed_phase = $Phase
      failure_class = 'provider-environment'
      reason_code = 'provider-network-unavailable'
      exit_code = $ExitCode
      recommended_action = 'Provider package registry or network resolution failed. Restore registry/network access or warm the package cache, then rerun graph bootstrap.'
    }
  }
  if (
    $ExitCode -ne 0 -and
    [string]$Diagnostic -match '(?i)(Operation not permitted|Permission denied|EACCES)' -and
    [string]$Diagnostic -match '(?i)(\.cache[\\/]+uv|[\\/]\.npm|\.npm)'
  ) {
    return [ordered]@{
      failed_phase = $Phase
      failure_class = 'provider-environment'
      reason_code = 'provider-cache-permission-denied'
      exit_code = $ExitCode
      recommended_action = 'Provider cache access was denied. Fix permissions or run with access to the provider cache directories, then rerun graph bootstrap.'
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
    [string]$LogPath,
    [string]$TargetKind = ''
  )
  if ($Provider -ne 'gitnexus') {
    return $true
  }
  return (Test-GitNexusQueryProbeVerified -CommandResult $CommandResult -LogPath $LogPath -TargetKind $TargetKind)
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
    [string]$ProvidersDir,
    [string]$TargetKind = '',
    [object[]]$CommandResults = @(),
    [object[]]$QueryProbeAttempts = @()
  )
  $normalizedDir = Join-Path (Join-Path $ProvidersDir $Provider) 'normalized'
  Ensure-Directory -Path @($normalizedDir)
  $sourceStatusPath = ".spec-first/providers/$Provider/status.json"
  $bootstrapLogs = @($CommandResults | Where-Object { [string]$_.kind -eq 'bootstrap' } | ForEach-Object { [string]$_.raw_log })

  if ($Provider -eq 'gitnexus') {
    $attemptLogs = @($QueryProbeAttempts | ForEach-Object { $_.raw_log })
    $sourceRawLogs = if ($bootstrapLogs.Count -gt 0) { @($bootstrapLogs) } else { @('.spec-first/providers/gitnexus/raw/analyze.log') }
    $sourceRawLogs += '.spec-first/providers/gitnexus/raw/status.log'
    if ($attemptLogs.Count -gt 0) {
      $sourceRawLogs += $attemptLogs
    } else {
      $sourceRawLogs += '.spec-first/providers/gitnexus/raw/query.log'
    }
    $impactProbeLogs = @($CommandResults | Where-Object { [string]$_.kind -eq 'impact_probe' } | ForEach-Object { [string]$_.raw_log })
    if ($impactProbeLogs.Count -gt 0) {
      $sourceRawLogs += $impactProbeLogs
    }
    $winningLogs = @($QueryProbeAttempts | Where-Object { $_.result_class -eq 'process-results' } | Select-Object -First 1 | ForEach-Object { $_.raw_log })
    $winningQueryProbeLog = if ($winningLogs.Count -gt 0) { $winningLogs[0] } else { $null }
    $availableQuerySurfaces = if ($QueryReady) { @('status', 'query') } else { @() }
    $isNonGitFolder = ($TargetKind -eq 'non-git-folder')
    $definitionsOnlyEvidence = @($QueryProbeAttempts | Where-Object { $_.result_class -eq 'definitions-only' }).Count -gt 0
    $isQueryOnlyTarget = ($isNonGitFolder -or $definitionsOnlyEvidence)
    $nonGitLimitations = @('non_git_folder_no_process_graph', 'non_git_folder_no_git_diff', 'non_git_folder_no_commit_freshness', 'non_git_folder_no_incremental')
    $definitionsOnlyLimitations = @('definitions_only_no_process_graph', 'definitions_only_no_impact_evidence', 'definitions_only_no_related_tests')
    $architectureCapabilities = if ($isQueryOnlyTarget) { @('architecture_map', 'dependency_map', 'repo_wiki', 'query_global_graph') } else { @('architecture_map', 'dependency_map', 'execution_flow', 'repo_wiki', 'query_global_graph') }
    $confidence = if ($QueryReady -and -not $isQueryOnlyTarget) { 'high' } elseif ($QueryReady) { 'medium' } else { 'low' }
    $limitations = if ($isNonGitFolder) { $nonGitLimitations } elseif ($definitionsOnlyEvidence) { $definitionsOnlyLimitations } elseif ($QueryReady) { @() } else { @('Provider query readiness is not verified.') }
    foreach ($artifact in @('architecture-facts', 'reuse-candidates')) {
      $payload = [ordered]@{
        schema_version = 'provider-normalized-envelope.v1'
        provider = $Provider
        generated_at = $BootstrappedAt
        source_status_path = $sourceStatusPath
        source_raw_logs = $sourceRawLogs
        query_probe_attempt_logs = $attemptLogs
        winning_query_probe_log = $winningQueryProbeLog
        available_query_surfaces = $availableQuerySurfaces
        capabilities = $architectureCapabilities
        confidence = $confidence
        limitations = $limitations
      }
      Write-JsonFileAtomic -Path (Join-Path $normalizedDir "$artifact.json") -Payload ([pscustomobject]$payload) -Depth 20
    }
    $impactSurfaces = if ($QueryReady -and $isQueryOnlyTarget) { @('query', 'context') } elseif ($QueryReady) { @('query', 'context', 'impact', 'detect_changes', 'route_map', 'api_impact', 'shape_check') } else { @() }
    $impactCapabilities = if ($isQueryOnlyTarget) { @('query_context_orientation') } else { @('detect_changes', 'impact_radius', 'execution_flow', 'route_api_evidence', 'shape_check', 'review_context_candidate') }
    $impactEvidenceSurfaces = if ($QueryReady -and -not $isQueryOnlyTarget) { @('detect_changes', 'impact', 'query', 'route_map', 'api_impact', 'shape_check') } else { @() }
    $relatedTestsSupported = @($CommandResults | Where-Object { [string]$_.kind -eq 'impact_probe' -and [int]$_.exit_code -eq 0 -and [string]$_.result_class -eq 'related-tests-supported' }).Count -gt 0
    $impactSupport = if ($isQueryOnlyTarget) { 'unavailable' } elseif ($QueryReady -and $relatedTestsSupported) { 'supported' } elseif ($QueryReady) { 'candidate-only' } else { 'unavailable' }
    $nonGitImpactLimitations = @('non_git_folder_no_git_diff', 'non_git_folder_no_commit_freshness', 'non_git_folder_no_incremental')
    $definitionsOnlyImpactLimitations = @('definitions_only_no_process_graph', 'definitions_only_no_impact_evidence', 'definitions_only_no_related_tests')
    $impactLimitations = if ($isNonGitFolder) {
      $nonGitImpactLimitations
    } elseif ($definitionsOnlyEvidence) {
      $definitionsOnlyImpactLimitations
    } elseif ($impactSupport -eq 'supported') {
      @()
    } elseif ($QueryReady) {
      @('related_tests_unverified', 'GitNexus related-test provenance is not verified; review support is candidate-only.')
    } else {
      @('Provider query readiness is not verified.')
    }
    $reviewSupportLimitations = if ($isNonGitFolder) { $nonGitImpactLimitations } elseif ($definitionsOnlyEvidence) { $definitionsOnlyImpactLimitations } elseif ($impactSupport -eq 'supported') { @() } elseif ($QueryReady) { @('related_tests_unverified') } else { @('Provider query readiness is not verified.') }
    $impactConfidence = if ($impactSupport -eq 'supported') { 'high' } elseif ($QueryReady -and -not $isQueryOnlyTarget) { 'medium' } else { 'low' }
    $impactPayload = [ordered]@{
      schema_version = 'provider-normalized-envelope.v1'
      provider = $Provider
      generated_at = $BootstrappedAt
      source_status_path = $sourceStatusPath
      source_raw_logs = $sourceRawLogs
      available_query_surfaces = $impactSurfaces
      capabilities = $impactCapabilities
      impact_evidence_surfaces = $impactEvidenceSurfaces
      review_support = [ordered]@{
        support_level = $impactSupport
        related_tests = $impactSupport
        limitations = $reviewSupportLimitations
      }
      related_tests = $impactSupport
      confidence = $impactConfidence
      limitations = $impactLimitations
    }
    Write-JsonFileAtomic -Path (Join-Path $normalizedDir 'impact-capabilities.json') -Payload ([pscustomobject]$impactPayload) -Depth 20
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

function ConvertTo-ComparableJson {
  param([AllowNull()][object]$Value)
  return (ConvertTo-CanonicalJsonValue -Value $Value | ConvertTo-Json -Depth 100 -Compress)
}

function New-RefreshDecision {
  param(
    [string]$RefreshMode,
    [string]$ReasonCode = '',
    [string]$LastIndexedCommit = ''
  )
  return [pscustomobject][ordered]@{
    refresh_mode = $RefreshMode
    reason_code = if ([string]::IsNullOrWhiteSpace($ReasonCode)) { $null } else { $ReasonCode }
    last_indexed_commit = if ([string]::IsNullOrWhiteSpace($LastIndexedCommit)) { $null } else { $LastIndexedCommit }
  }
}

function New-RefreshPreflightFailureInfo {
  param([string]$ReasonCode)
  return [ordered]@{
    failed_phase = 'preflight'
    failure_class = 'refresh-mode-decision'
    reason_code = $ReasonCode
    exit_code = $null
    recommended_action = $null
    diagnostic = "Refresh mode preflight selected full refresh: $ReasonCode"
  }
}

function New-IncrementalFallbackSuccessFailureInfo {
  param([int]$ExitCode)
  return [ordered]@{
    failed_phase = 'bootstrap'
    failure_class = 'incremental-fallback-recovered'
    reason_code = 'incremental-refresh-failed-fallback-full'
    exit_code = $ExitCode
    recommended_action = $null
    diagnostic = 'Incremental refresh failed, then full fallback completed successfully.'
  }
}

function New-IncrementalBothFailedFailureInfo {
  param([int]$ExitCode)
  return [ordered]@{
    failed_phase = 'bootstrap'
    failure_class = 'provider-command-failed'
    reason_code = 'incremental-and-full-failed'
    exit_code = $ExitCode
    recommended_action = 'Inspect the provider raw logs. Run a clean full graph bootstrap after fixing the provider command failure.'
    diagnostic = 'Incremental refresh failed and the full fallback also failed.'
  }
}

function Test-GitCommitExists {
  param(
    [string]$RepoRoot,
    [string]$Commit
  )
  & git -C $RepoRoot cat-file -e "$Commit^{commit}" 2>$null
  return ($LASTEXITCODE -eq 0)
}

function Test-GitCommitIsAncestor {
  param(
    [string]$RepoRoot,
    [string]$Ancestor,
    [string]$Descendant
  )
  & git -C $RepoRoot merge-base --is-ancestor $Ancestor $Descendant 2>$null
  return ($LASTEXITCODE -eq 0)
}

function Resolve-ProviderRefreshMode {
  param(
    [object]$ProviderConfig,
    [string]$Provider,
    [string]$StatusPath,
    [object]$BootstrapFingerprint,
    [string]$InvocationRefreshMode,
    [string]$RepoRoot,
    [string]$SourceRevision
  )
  if ($InvocationRefreshMode -ne 'incremental') {
    return (New-RefreshDecision -RefreshMode 'full')
  }

  $commands = $ProviderConfig.providers.$Provider.commands
  if ($null -eq $commands -or -not ($commands.PSObject.Properties.Name -contains 'incremental')) {
    return (New-RefreshDecision -RefreshMode 'full' -ReasonCode 'incremental-command-unavailable')
  }
  if (-not (Test-CommandShapeSupported -ProviderConfig $ProviderConfig -Provider $Provider -Kind 'incremental' -RepoRoot $RepoRoot)) {
    return (New-RefreshDecision -RefreshMode 'blocked' -ReasonCode 'unsupported-provider-command')
  }

  if (-not (Test-Path -LiteralPath $StatusPath -PathType Leaf)) {
    return (New-RefreshDecision -RefreshMode 'full' -ReasonCode 'incremental-base-ref-unset')
  }
  try {
    $priorStatus = Read-JsonFile -Path $StatusPath
  } catch {
    return (New-RefreshDecision -RefreshMode 'full' -ReasonCode 'incremental-base-ref-unset')
  }
  if ($priorStatus.schema_version -ne 'provider-status.v1') {
    return (New-RefreshDecision -RefreshMode 'full' -ReasonCode 'incremental-base-ref-unset')
  }

  if ($null -eq $priorStatus.bootstrap_fingerprint) {
    return (New-RefreshDecision -RefreshMode 'full' -ReasonCode 'incremental-base-ref-unset')
  }
  if ((ConvertTo-ComparableJson -Value $priorStatus.bootstrap_fingerprint.spec_first) -ne (ConvertTo-ComparableJson -Value $BootstrapFingerprint.spec_first)) {
    return (New-RefreshDecision -RefreshMode 'full' -ReasonCode 'fingerprint-spec-first-changed')
  }
  if ((ConvertTo-ComparableJson -Value $priorStatus.bootstrap_fingerprint.provider_projection) -ne (ConvertTo-ComparableJson -Value $BootstrapFingerprint.provider_projection)) {
    return (New-RefreshDecision -RefreshMode 'full' -ReasonCode 'fingerprint-projection-changed')
  }
  if ((ConvertTo-ComparableJson -Value $priorStatus.bootstrap_fingerprint.provider) -ne (ConvertTo-ComparableJson -Value $BootstrapFingerprint.provider)) {
    return (New-RefreshDecision -RefreshMode 'full' -ReasonCode 'fingerprint-provider-changed')
  }

  if ($priorStatus.PSObject.Properties.Name -contains 'requires_clean_full_refresh' -and [bool]$priorStatus.requires_clean_full_refresh) {
    return (New-RefreshDecision -RefreshMode 'full' -ReasonCode 'clean-full-refresh-required')
  }
  $lastIndexedCommit = if ($priorStatus.PSObject.Properties.Name -contains 'last_indexed_commit') { [string]$priorStatus.last_indexed_commit } else { '' }
  if ([string]::IsNullOrWhiteSpace($lastIndexedCommit)) {
    return (New-RefreshDecision -RefreshMode 'full' -ReasonCode 'incremental-base-ref-unset')
  }
  if ($lastIndexedCommit -notmatch '^[0-9a-f]{40}$') {
    return (New-RefreshDecision -RefreshMode 'full' -ReasonCode 'incremental-base-ref-invalid-format')
  }
  if (
    -not [bool]$priorStatus.graph_ready -or
    -not [bool]$priorStatus.query_ready -or
    [bool]$priorStatus.repo_snapshot.worktree_dirty -or
    [string]$priorStatus.repo_snapshot.source_revision -ne $lastIndexedCommit -or
    [string]$priorStatus.bootstrap_fingerprint.repo_snapshot.source_revision -ne $lastIndexedCommit
  ) {
    return (New-RefreshDecision -RefreshMode 'full' -ReasonCode 'incremental-base-status-untrusted')
  }
  if (-not (Test-GitCommitExists -RepoRoot $RepoRoot -Commit $lastIndexedCommit)) {
    return (New-RefreshDecision -RefreshMode 'full' -ReasonCode 'incremental-base-ref-missing')
  }
  if (-not (Test-GitCommitIsAncestor -RepoRoot $RepoRoot -Ancestor $lastIndexedCommit -Descendant $SourceRevision)) {
    return (New-RefreshDecision -RefreshMode 'full' -ReasonCode 'incremental-base-ref-not-ancestor')
  }

  return (New-RefreshDecision -RefreshMode 'incremental' -LastIndexedCommit $lastIndexedCommit)
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$mcpToolsOverride = [Environment]::GetEnvironmentVariable('SPEC_FIRST_MCP_TOOLS_JSON')
if ([string]::IsNullOrWhiteSpace($mcpToolsOverride)) {
  $script:McpToolsJson = Join-Path (Split-Path -Parent (Split-Path -Parent $scriptDir)) 'spec-mcp-setup/mcp-tools.json'
} else {
  $script:McpToolsJson = $mcpToolsOverride
}
$packageJsonOverride = [Environment]::GetEnvironmentVariable('SPEC_FIRST_PACKAGE_JSON')
if ([string]::IsNullOrWhiteSpace($packageJsonOverride)) {
  $script:PackageJson = Join-Path (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $scriptDir))) 'package.json'
} else {
  $script:PackageJson = $packageJsonOverride
}
$resolverOverride = [Environment]::GetEnvironmentVariable('SPEC_FIRST_PROJECT_TARGET_RESOLVER')
if ([string]::IsNullOrWhiteSpace($resolverOverride)) {
  $resolverPath = Join-Path (Split-Path -Parent (Split-Path -Parent $scriptDir)) 'spec-mcp-setup/scripts/resolve-project-target.ps1'
} else {
  $resolverPath = $resolverOverride
}
$resolverParams = @{ Format = 'json' }
if (-not [string]::IsNullOrWhiteSpace($Repo)) { $resolverParams.Repo = $Repo }
if (-not [string]::IsNullOrWhiteSpace($Folder)) { $resolverParams.Folder = $Folder }
$targetFacts = (& $resolverPath @resolverParams) | ConvertFrom-Json
$targetCandidates = @($targetFacts.candidates)
$targetKind = if ($targetFacts.PSObject.Properties.Name -contains 'target_kind') { [string]$targetFacts.target_kind } else { '' }
$targetDefaultAllRepos = (-not $AllRepos -and [string]::IsNullOrWhiteSpace($Repo) -and [string]::IsNullOrWhiteSpace($Folder) -and $targetFacts.mode -ne 'git-repo' -and $targetCandidates.Count -gt 0)
if ($Incremental -and ($Full -or $Force)) {
  Write-ResultAndExit -WorkflowMode 'blocked' -ReasonCode 'conflicting-refresh-flags' -NextAction 'Use either -Incremental or -Full/-Force, not both.'
}
if (($AllRepos -or $targetDefaultAllRepos) -and $Incremental) {
  [pscustomobject]@{
    schema_version = 'workspace-graph-bootstrap-summary.v1'
    overall_status = 'action-required'
    workflow_mode = 'blocked'
    reason_code = 'incremental-all-repos-unsupported'
    workspace_root = $targetFacts.workspace_root
    parent_writes_repo_local_artifacts = $false
    canonical_artifacts_preserved = $true
    next_action = 'Run -AllRepos without -Incremental, or run -Incremental against one clean child repo with -Repo <child>.'
  } | ConvertTo-Json -Compress
  exit 1
}
if ($AllRepos) {
  Write-WorkspaceGraphBootstrapSummaryAndExit -TargetFacts $targetFacts -SelectionSource 'explicit-all-repos'
}
if ($targetDefaultAllRepos) {
  Write-WorkspaceGraphBootstrapSummaryAndExit -TargetFacts $targetFacts -SelectionSource 'workspace-default-all-repos'
}
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

$repoRoot = if (-not [string]::IsNullOrWhiteSpace([string]$targetFacts.target_root)) {
  [string]$targetFacts.target_root
} elseif (-not [string]::IsNullOrWhiteSpace([string]$targetFacts.selected_repo_root)) {
  [string]$targetFacts.selected_repo_root
} else {
  [string]$targetFacts.selected_folder_root
}
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
Ensure-Directory -Path @($graphDir, $impactDir, $providersDir)

if ($targetKind -eq 'non-git-folder' -and $Incremental) {
  Write-ResultAndExit -WorkflowMode 'blocked' -ReasonCode 'incremental-non-git-folder-unsupported' -NextAction 'Non-git folder targets do not support incremental graph bootstrap; rerun without -Incremental.' -RepoRoot $repoRoot -InvocationWorkspaceRoot ([string]$targetFacts.workspace_root) -SelectionSource ([string]$targetFacts.selection_source) -CanonicalArtifactsPreserved $true -GraphDir $graphDir
}

$bootstrappedAt = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
$folderContentFingerprint = ''
if ($targetKind -eq 'non-git-folder') {
  $sourceRevision = ''
  $worktreeStatus = ''
  $worktreeDirty = $false
  $worktreeStatusHash = ''
  $folderContentFingerprint = Get-FolderContentFingerprint -Root $repoRoot
} else {
  $sourceRevisionOutput = @(git -C $repoRoot rev-parse --verify 'HEAD^{commit}' 2>$null)
  if ($LASTEXITCODE -ne 0 -or $sourceRevisionOutput.Count -eq 0 -or [string]::IsNullOrWhiteSpace([string]$sourceRevisionOutput[0])) {
    Write-ResultAndExit -WorkflowMode 'blocked' -ReasonCode 'repo-snapshot-unavailable' -NextAction 'Resolve git repository state before graph bootstrap.' -RepoRoot $repoRoot -InvocationWorkspaceRoot $invocationWorkspaceRoot -SelectionSource $selectionSource -GraphDir $graphDir
  }
  $sourceRevision = [string]$sourceRevisionOutput[0]
  $worktreeStatus = (git -C $repoRoot status --porcelain 2>$null) -join "`n"
  $worktreeDirty = -not [string]::IsNullOrWhiteSpace($worktreeStatus)
  $worktreeStatusHash = Get-StatusHash -Text $worktreeStatus
}
$script:ExpectedHostInstructionHashes = @{}
$script:BootstrapOwnedHostInstructionPaths = @{}
$script:ExternalActorFingerprintBeforeText = ''
$script:ExternalActorFingerprintBefore = ''

function Remove-ExternalActorFingerprintBeforePath {
  param([string]$Path)
  if ([string]::IsNullOrEmpty($script:ExternalActorFingerprintBeforeText)) {
    return
  }
  $lines = @($script:ExternalActorFingerprintBeforeText -split "`n" | Where-Object {
    $line = [string]$_
    ($line.Length -le 3) -or ($line.Substring(3) -ne $Path)
  })
  $script:ExternalActorFingerprintBeforeText = ($lines -join "`n")
  $script:ExternalActorFingerprintBefore = Get-StatusHash -Text $script:ExternalActorFingerprintBeforeText
}

function Register-BootstrapOwnedHostInstructionHashes {
  param(
    [object]$Normalization,
    [string]$RepoRoot
  )
  foreach ($fileName in @('AGENTS.md', 'CLAUDE.md')) {
    $result = @($Normalization.results | Where-Object {
      $file = if ($null -ne $_.PSObject.Properties['file']) { [string]$_.PSObject.Properties['file'].Value } else { '' }
      $written = if ($null -ne $_.PSObject.Properties['written']) { [bool]$_.PSObject.Properties['written'].Value } else { $false }
      $changed = if ($null -ne $_.PSObject.Properties['changed']) { [bool]$_.PSObject.Properties['changed'].Value } else { $false }
      $status = if ($null -ne $_.PSObject.Properties['status']) { [string]$_.PSObject.Properties['status'].Value } else { '' }
      $file -eq $fileName -and ($written -or $changed -or $status -eq 'updated')
    } | Select-Object -First 1)
    if ($result.Count -gt 0) {
      $script:ExpectedHostInstructionHashes[$fileName] = Get-FileContentHash -Path (Join-Path $RepoRoot $fileName)
      $script:BootstrapOwnedHostInstructionPaths[$fileName] = $true
      Remove-ExternalActorFingerprintBeforePath -Path $fileName
    }
  }
}

function Test-BootstrapOwnedHostInstructionPath {
  param([string]$FileName)
  return $script:BootstrapOwnedHostInstructionPaths.ContainsKey($FileName)
}

function Test-BootstrapOwnedHostInstructionChange {
  param([string]$FileName)
  if (-not $script:ExpectedHostInstructionHashes.ContainsKey($FileName)) {
    return $false
  }
  $currentHash = Get-FileContentHash -Path (Join-Path $repoRoot $FileName)
  return $currentHash -eq $script:ExpectedHostInstructionHashes[$FileName]
}

function Test-BootstrapOwnedHostInstructionHashMismatch {
  foreach ($fileName in @('AGENTS.md', 'CLAUDE.md')) {
    if ((Test-BootstrapOwnedHostInstructionPath -FileName $fileName) -and -not (Test-BootstrapOwnedHostInstructionChange -FileName $fileName)) {
      return $true
    }
  }
  return $false
}

function Get-ManagedBlockRanges {
  param(
    [string]$Path,
    [string]$Content
  )

  $lines = if ([string]::IsNullOrEmpty($Content)) { @() } else { $Content -split "`r?`n" }
  if ($lines.Count -gt 0 -and $lines[$lines.Count - 1] -eq '') {
    $lines = @($lines | Select-Object -First ($lines.Count - 1))
  }
  $ranges = @()
  $inBlock = $false
  $currentName = ''
  $startLine = 0
  $seenStart = @{}
  $seenEnd = @{}

  for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = [string]$lines[$i]
    $lineNo = $i + 1
    if ($Path -eq '.gitignore') {
      if ($line -eq '# spec-first:start') {
        if ($inBlock -or $seenStart.ContainsKey('__gitignore__')) { return $null }
        $inBlock = $true
        $currentName = '__gitignore__'
        $seenStart[$currentName] = $true
        $startLine = $lineNo
      } elseif ($line -eq '# spec-first:end') {
        if (-not $inBlock -or $seenEnd.ContainsKey('__gitignore__')) { return $null }
        $inBlock = $false
        $seenEnd[$currentName] = $true
        $ranges += [pscustomobject]@{ Start = $startLine; End = $lineNo }
      }
      continue
    }

    if ($line -match '^<!-- spec-first:([^:]+):start -->$') {
      $name = $Matches[1]
      if ($inBlock -or $seenStart.ContainsKey($name)) { return $null }
      $inBlock = $true
      $currentName = $name
      $seenStart[$name] = $true
      $startLine = $lineNo
    } elseif ($line -match '^<!-- spec-first:([^:]+):end -->$') {
      $name = $Matches[1]
      if (-not $inBlock -or $currentName -ne $name -or $seenEnd.ContainsKey($name)) { return $null }
      $inBlock = $false
      $seenEnd[$name] = $true
      $ranges += [pscustomobject]@{ Start = $startLine; End = $lineNo }
    }
  }

  if ($inBlock -or $ranges.Count -eq 0) { return $null }
  foreach ($name in $seenStart.Keys) {
    if (-not $seenEnd.ContainsKey($name)) { return $null }
  }
  return @($ranges)
}

function Test-LineInManagedRanges {
  param(
    [int]$LineNumber,
    [object[]]$Ranges
  )
  foreach ($range in @($Ranges)) {
    if ($LineNumber -ge [int]$range.Start -and $LineNumber -le [int]$range.End) {
      return $true
    }
  }
  return $false
}

function Test-BlankLine {
  param([string]$Line)
  return $Line -match '^\s*$'
}

function Test-UntrackedManagedFileSetupOwned {
  param([string]$Path)
  $absolutePath = Join-Path $repoRoot $Path
  if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) { return $false }
  $content = Get-Content -Raw -LiteralPath $absolutePath
  $ranges = Get-ManagedBlockRanges -Path $Path -Content $content
  if ($null -eq $ranges) { return $false }
  $lines = if ([string]::IsNullOrEmpty($content)) { @() } else { $content -split "`r?`n" }
  if ($lines.Count -gt 0 -and $lines[$lines.Count - 1] -eq '') {
    $lines = @($lines | Select-Object -First ($lines.Count - 1))
  }
  if ($lines.Count -eq 0) { return $false }
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if (-not (Test-LineInManagedRanges -LineNumber ($i + 1) -Ranges $ranges)) {
      if (-not (Test-BlankLine -Line ([string]$lines[$i]))) {
        return $false
      }
    }
  }
  return $true
}

function Test-ManagedBlockFileSetupOwned {
  param(
    [string]$Path,
    [string]$StatusHint
  )
  if ($StatusHint -eq 'untracked') {
    return (Test-UntrackedManagedFileSetupOwned -Path $Path)
  }

  $beforeContent = (@(git -C $repoRoot show "HEAD:$Path" 2>$null) -join "`n")
  $afterPath = Join-Path $repoRoot $Path
  $afterContent = if (Test-Path -LiteralPath $afterPath -PathType Leaf) { Get-Content -Raw -LiteralPath $afterPath } else { '' }
  $beforeRanges = Get-ManagedBlockRanges -Path $Path -Content $beforeContent
  $afterRanges = Get-ManagedBlockRanges -Path $Path -Content $afterContent
  $diffLines = @(git -C $repoRoot diff --unified=0 --no-ext-diff HEAD -- $Path 2>$null)

  $oldLine = 0
  $newLine = 0
  $sawChange = $false
  foreach ($line in $diffLines) {
    $text = [string]$line
    if ($text -match '^@@ -([0-9]+)(?:,[0-9]+)? \+([0-9]+)(?:,[0-9]+)? @@') {
      $oldLine = [int]$Matches[1]
      $newLine = [int]$Matches[2]
      continue
    }
    if ($text.StartsWith('+++') -or $text.StartsWith('---')) { continue }
    if ($text.StartsWith('+')) {
      $sawChange = $true
      if ($null -eq $afterRanges -or -not (Test-LineInManagedRanges -LineNumber $newLine -Ranges $afterRanges)) {
        if (-not (Test-BlankLine -Line $text.Substring(1))) {
          return $false
        }
      }
      $newLine += 1
      continue
    }
    if ($text.StartsWith('-')) {
      $sawChange = $true
      if ($null -eq $beforeRanges -or -not (Test-LineInManagedRanges -LineNumber $oldLine -Ranges $beforeRanges)) {
        if (-not (Test-BlankLine -Line $text.Substring(1))) {
          return $false
        }
      }
      $oldLine += 1
      continue
    }
    if (-not ($text.StartsWith('diff --git') -or $text.StartsWith('index ') -or $text.StartsWith('new file mode') -or $text.StartsWith('deleted file mode'))) {
      $oldLine += 1
      $newLine += 1
    }
  }
  return $sawChange
}

function Get-PorcelainPathField {
  param(
    [string]$Record,
    [int]$FieldCount
  )
  $parts = $Record.Split([char[]]@(' '), $FieldCount, [System.StringSplitOptions]::None)
  if ($parts.Count -lt $FieldCount) { return '' }
  return [string]$parts[$FieldCount - 1]
}

function Get-SetupOwnedDirtyRule {
  param([string]$Path)

  foreach ($prefix in $script:SetupOwnedDirtyIgnorePrefixes) {
    if ($prefix.EndsWith('/')) {
      if ($Path.StartsWith($prefix, [System.StringComparison]::Ordinal)) {
        return 'whole-prefix'
      }
    } elseif ($Path -eq $prefix) {
      if ($prefix -eq 'AGENTS.md' -or $prefix -eq 'CLAUDE.md' -or $prefix -eq '.gitignore') {
        return 'managed-block'
      }
      return 'whole-file'
    }
  }
  return 'graph-affecting'
}

function Get-NonGraphMetadataDirtyRule {
  param([string]$Path)

  foreach ($metadataPath in $script:NonGraphMetadataDirtyPaths) {
    if ($Path -eq $metadataPath) {
      return 'whole-file'
    }
  }
  return 'graph-affecting'
}

function Get-DirtyPathClassification {
  param(
    [string]$Path,
    [string]$StatusHint
  )

  $setupRule = Get-SetupOwnedDirtyRule -Path $Path
  if ($setupRule -eq 'whole-prefix' -or $setupRule -eq 'whole-file') {
    return 'setup-owned'
  }
  if ($setupRule -eq 'managed-block') {
    if (Test-ManagedBlockFileSetupOwned -Path $Path -StatusHint $StatusHint) {
      return 'setup-owned'
    }
    return 'graph-affecting'
  }
  $metadataRule = Get-NonGraphMetadataDirtyRule -Path $Path
  if ($metadataRule -eq 'whole-file') {
    return 'non-graph-metadata'
  }
  return 'graph-affecting'
}

function Get-GitStatusPorcelainV2ZRecords {
  $psi = [System.Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = 'git'
  $psi.ArgumentList.Add('-C')
  $psi.ArgumentList.Add($repoRoot)
  $psi.ArgumentList.Add('status')
  $psi.ArgumentList.Add('--porcelain=v2')
  $psi.ArgumentList.Add('-z')
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false
  $process = [System.Diagnostics.Process]::Start($psi)
  $memory = [System.IO.MemoryStream]::new()
  try {
    $process.StandardOutput.BaseStream.CopyTo($memory)
    $process.WaitForExit()
    $text = [System.Text.Encoding]::UTF8.GetString($memory.ToArray())
    return @($text -split "`0" | Where-Object { -not [string]::IsNullOrEmpty([string]$_) })
  } finally {
    $memory.Dispose()
    $process.Dispose()
  }
}

function Set-WorktreeDirtyClassification {
  $classifications = @()
  $records = @(Get-GitStatusPorcelainV2ZRecords)
  for ($i = 0; $i -lt $records.Count; $i++) {
    $record = [string]$records[$i]
    $paths = @()
    $statusHint = 'tracked'
    if ($record.StartsWith('1 ')) {
      $paths += Get-PorcelainPathField -Record $record -FieldCount 9
    } elseif ($record.StartsWith('2 ')) {
      $paths += Get-PorcelainPathField -Record $record -FieldCount 10
      if (($i + 1) -lt $records.Count) {
        $i += 1
        $paths += [string]$records[$i]
      }
    } elseif ($record.StartsWith('u ')) {
      $paths += Get-PorcelainPathField -Record $record -FieldCount 11
    } elseif ($record.StartsWith('? ')) {
      $paths += $record.Substring(2)
      $statusHint = 'untracked'
    }
    foreach ($path in $paths) {
      if ([string]::IsNullOrWhiteSpace($path)) { continue }
      $classifications += [pscustomobject]@{
        classification = Get-DirtyPathClassification -Path $path -StatusHint $statusHint
        path = $path
      }
    }
  }

  $setupOwnedCount = @($classifications | Where-Object { $_.classification -eq 'setup-owned' }).Count
  $nonGraphMetadataCount = @($classifications | Where-Object { $_.classification -eq 'non-graph-metadata' }).Count
  $graphAffectingCount = @($classifications | Where-Object { $_.classification -eq 'graph-affecting' }).Count
  $script:DirtyPathsBreakdown = [ordered]@{
    setup_owned_count = $setupOwnedCount
    non_graph_metadata_count = $nonGraphMetadataCount
    graph_affecting_count = $graphAffectingCount
    sample_paths = @($classifications | Select-Object -First 20 | ForEach-Object { [string]$_.path })
    truncated = ($classifications.Count -gt 20)
  }
  if ($classifications.Count -eq 0) {
    $script:DirtyClassification = 'clean'
  } elseif ($graphAffectingCount -gt 0) {
    $script:DirtyClassification = 'graph-affecting-blocked'
  } elseif ($nonGraphMetadataCount -gt 0) {
    $script:DirtyClassification = 'non-graph-only'
  } else {
    $script:DirtyClassification = 'setup-owned-only'
  }
}

# U1: external-actor fingerprint 排除 bootstrap 自身写入的路径。
# AGENTS.md / CLAUDE.md 只在当前内容等于本轮 normalizer 写入结果时排除，
# 这样 critical write window 内后续外部编辑仍会触发 concurrent-write-detected。
function Get-ExternalActorFingerprint {
  if ($targetKind -eq 'non-git-folder') {
    return (Get-FolderContentFingerprint -Root $repoRoot)
  }
  $statusLines = @(git -C $repoRoot status --porcelain 2>$null)
  $filtered = foreach ($line in $statusLines) {
    $statusPath = if ($line.Length -gt 3) { $line.Substring(3) } else { '' }
    if ($statusPath -match $script:ExternalActorFingerprintIgnorePattern) {
      continue
    }
    if ($statusPath -eq 'AGENTS.md' -or $statusPath -eq 'CLAUDE.md') {
      if (Test-BootstrapOwnedHostInstructionPath -FileName $statusPath) {
        continue
      }
    }
    $line
  }
  return ($filtered -join "`n")
}
$script:ExternalActorFingerprintBeforeText = Get-ExternalActorFingerprint
$script:ExternalActorFingerprintBefore = Get-StatusHash -Text $script:ExternalActorFingerprintBeforeText
$externalActorFingerprintBefore = $script:ExternalActorFingerprintBefore
$invocationRefreshMode = if ($Incremental) { 'incremental' } elseif ($Full -or $Force) { 'full' } else { $script:DefaultRefreshModeSingleRepo }
if ($targetKind -eq 'non-git-folder') {
  $script:DirtyClassification = 'not-applicable'
  $script:DirtyPathsBreakdown = [ordered]@{
    setup_owned_count = 0
    non_graph_metadata_count = 0
    graph_affecting_count = 0
    sample_paths = @()
    truncated = $false
  }
} else {
  Set-WorktreeDirtyClassification
}
$script:DirtyIncrementalDowngrade = $false
if ($script:DirtyClassification -eq 'graph-affecting-blocked') {
  $dirtyPaths = @()
  try { $dirtyPaths = ($script:DirtyPathsBreakdown.sample_paths ?? @()) | Select-Object -First 20 } catch {}
  [Console]::Error.WriteLine('WARNING: graph-affecting dirty paths detected. Index will reflect current uncommitted disk state.')
  [Console]::Error.WriteLine('  source_revision will not precisely align with HEAD.')
  foreach ($p in $dirtyPaths) { [Console]::Error.WriteLine("  dirty: $p") }
  if ($invocationRefreshMode -eq 'incremental') {
    $invocationRefreshMode = 'full'
    $script:DirtyIncrementalDowngrade = $true
  }
}

$providerConfig = Assert-Schema -Path $providerConfigPath -SchemaVersion 'graph-providers.v1' -MissingReason 'missing_provider_config'
$runtimeCapabilities = Assert-Schema -Path $runtimeCapabilitiesPath -SchemaVersion 'runtime-capabilities.v1' -MissingReason 'missing_runtime_capabilities'
$providerArtifacts = Assert-Schema -Path $providerArtifactsPath -SchemaVersion 'provider-artifacts.v1' -MissingReason 'missing_provider_artifacts'
$script:SpecFirstPackageVersion = 'unknown'
if (Test-Path -LiteralPath $script:PackageJson -PathType Leaf) {
  try {
    $packageJson = Get-Content -Raw -LiteralPath $script:PackageJson | ConvertFrom-Json
    if ($packageJson.PSObject.Properties.Name -contains 'version' -and -not [string]::IsNullOrWhiteSpace([string]$packageJson.version)) {
      $script:SpecFirstPackageVersion = [string]$packageJson.version
    }
  } catch {
  }
}
$script:GraphBootstrapScriptHash = Get-FileContentHash -Path $script:BootstrapProvidersScript
$script:McpToolsHash = Get-JsonFileHash -Path $script:McpToolsJson
$script:GraphProvidersHash = Get-JsonFileHash -Path $providerConfigPath
$script:RuntimeCapabilitiesHash = Get-JsonFileHash -Path $runtimeCapabilitiesPath
$script:ProviderArtifactsHash = Get-JsonFileHash -Path $providerArtifactsPath
$staleProviderKeys = @($providerConfig.providers.PSObject.Properties | Where-Object { $_.Name -ne 'gitnexus' } | ForEach-Object { $_.Name })
if ($staleProviderKeys.Count -gt 0) {
  Write-ResultAndExit -WorkflowMode 'action-required' -ReasonCode 'stale-provider-projection' -NextAction 'provider projection is stale; run `$spec-mcp-setup` to update before running graph-bootstrap'
}
if (-not (Test-ProviderArtifactContractSupported -ProviderArtifacts $providerArtifacts -ProviderConfig $providerConfig)) {
  Write-ResultAndExit -WorkflowMode 'blocked' -ReasonCode 'readiness-conflict' -NextAction 'Rerun spec-mcp-setup; provider artifact path contract drifted.'
}

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
# Host pointer drift 由 spec-mcp-setup 自愈（U2: host_pointer_reconciliation event 写入 ledger）。
# bootstrap 不再替 setup 检查 runtime/ledger baseline 是否一致;只校验当前 ledger baseline_ready。
if (-not [bool]$ledger.baseline_ready) {
  Write-ResultAndExit -WorkflowMode 'setup-not-ready' -ReasonCode 'baseline_not_ready' -NextAction 'Fix Required Harness Runtime setup, then rerun spec-mcp-setup.'
}

foreach ($property in $providerConfig.providers.PSObject.Properties) {
  if ($property.Name -ne 'gitnexus') {
    Write-ResultAndExit -WorkflowMode 'blocked' -ReasonCode 'unsupported-provider-command' -NextAction "Unsupported graph provider id: $($property.Name)"
  }
  foreach ($kind in @('bootstrap', 'status', 'query_probe')) {
    if (-not (Test-CommandShapeSupported -ProviderConfig $providerConfig -Provider $property.Name -Kind $kind -RepoRoot $repoRoot)) {
      Write-ResultAndExit -WorkflowMode 'blocked' -ReasonCode 'unsupported-provider-command' -NextAction "Provider command shape is unsupported for $($property.Name):$kind."
    }
  }
  $commands = $property.Value.commands
  if ($null -ne $commands -and $commands.PSObject.Properties.Name -contains 'incremental') {
    if (-not (Test-CommandShapeSupported -ProviderConfig $providerConfig -Provider $property.Name -Kind 'incremental' -RepoRoot $repoRoot)) {
      Write-ResultAndExit -WorkflowMode 'blocked' -ReasonCode 'unsupported-provider-command' -NextAction "Provider command shape is unsupported for $($property.Name):incremental."
    }
  }
  if ($null -ne $commands -and $commands.PSObject.Properties.Name -contains 'impact_probe') {
    if (-not (Test-CommandShapeSupported -ProviderConfig $providerConfig -Provider $property.Name -Kind 'impact_probe' -RepoRoot $repoRoot)) {
      Write-ResultAndExit -WorkflowMode 'blocked' -ReasonCode 'unsupported-provider-command' -NextAction "Provider command shape is unsupported for $($property.Name):impact_probe."
    }
  }
  if (-not (Test-QueryProbePolicySupported -ProviderConfig $providerConfig -Provider $property.Name)) {
    Write-ResultAndExit -WorkflowMode 'blocked' -ReasonCode 'unsupported-provider-command' -NextAction "Provider query probe policy is unsupported for $($property.Name)."
  }
}

$providerStatuses = New-Object System.Collections.Generic.List[psobject]

foreach ($property in $providerConfig.providers.PSObject.Properties) {
  $provider = $property.Name
  $entry = $property.Value
  $providerStartedAt = Get-UtcTimestamp
  $providerStartedEpochMs = Get-EpochMilliseconds
  $providerDir = Join-Path $providersDir $provider
  $rawDir = Join-Path $providerDir 'raw'
  $normalizedDir = Join-Path $providerDir 'normalized'
  Ensure-Directory -Path @($rawDir, $normalizedDir)
  $commandResults = New-Object System.Collections.Generic.List[psobject]
  $status = 'skipped'
  $graphReady = $false
  $queryReady = $false
  $confidence = 'low'
  $skipReason = Get-ProviderSkipReason -Entry $entry
  $limitations = Get-ProviderSkipLimitations -SkipReason $skipReason
  $failureInfo = Get-ProviderFailureInfo -Provider $provider -Phase '' -ExitCode 0
  $readinessSource = 'skipped'
  $priorLastIndexedCommit = ''
  $priorRequiresCleanFullRefresh = $false
  $providerRefreshMode = 'full'
  $fallbackFromIncremental = $false
  $refreshProcessFailed = $false
  $finalFullAttemptSucceeded = $false
  $skipNormalizedWrite = $false
  $queryProbeAttempts = New-Object System.Collections.Generic.List[psobject]
  $queryProbeCandidatesTruncated = $false
  $queryProbeExpectedHit = $true
  $hostInstructionNormalization = $null
  if ($provider -eq 'gitnexus') {
    $hostInstructionNormalization = New-GitNexusInstructionNormalizationResult -Status 'not-applicable' -ReasonCode 'gitnexus-provider-not-bootstrapped' -Results @()
  }
  $statusPath = Join-Path $providerDir 'status.json'
  if (Test-Path -LiteralPath $statusPath -PathType Leaf) {
    try {
      $priorStatus = Read-JsonFile -Path $statusPath
      if ($priorStatus.schema_version -eq 'provider-status.v1') {
        if ($priorStatus.PSObject.Properties.Name -contains 'last_indexed_commit' -and $null -ne $priorStatus.last_indexed_commit) {
          $priorLastIndexedCommit = [string]$priorStatus.last_indexed_commit
        }
        if ($priorStatus.PSObject.Properties.Name -contains 'requires_clean_full_refresh') {
          $priorRequiresCleanFullRefresh = [bool]$priorStatus.requires_clean_full_refresh
        }
      }
    } catch {
    }
  }
  $configuredPackage = Get-ProviderConfiguredPackageSpec -ProviderConfig $providerConfig -Provider $provider
  $bundledPackage = Get-ProviderBundledPackageSpec -Provider $provider
  $versionPolicy = Get-ProviderVersionPolicy -Provider $provider -ConfiguredPackage $configuredPackage -BundledPackage $bundledPackage
  $reuseDecision = Get-ProviderReuseDecision -SkipReason $skipReason -VersionPolicy $versionPolicy
  $bootstrapFingerprint = Get-BootstrapFingerprint `
    -ProviderConfig $providerConfig `
    -Provider $provider `
    -ConfiguredPackage $configuredPackage `
    -BundledPackage $bundledPackage `
    -VersionPolicy $versionPolicy `
    -SourceRevision $sourceRevision `
    -WorktreeDirty $worktreeDirty `
    -WorktreeStatusHash $worktreeStatusHash `
    -TargetKind $targetKind `
    -ContentFingerprint $folderContentFingerprint

  if (Test-ProviderEnabled -ProviderConfig $providerConfig -Provider $provider) {
    $readinessSource = 'cold-run'
    if ($versionPolicy -eq 'projection-stale') {
      $readinessSource = 'preflight-blocked'
      $status = 'failed'
      $graphReady = $false
      $queryReady = $false
      $confidence = 'low'
      $failureInfo = Get-ProviderProjectionStaleFailureInfo -Provider $provider -ConfiguredPackage $configuredPackage -BundledPackage $bundledPackage
      $providerDisplayName = Get-ProviderDisplayName -Provider $provider
      $limitations = @("$providerDisplayName provider projection is not fresh/verifiable; provider commands were not run.", [string]$failureInfo['recommended_action'])
      $script:QueryProbeVerificationReason = [string]$failureInfo['diagnostic']
    } else {
    $statusLog = Join-Path $rawDir 'status.log'
    $queryLog = Join-Path $rawDir 'query.log'
    $refreshDecision = Resolve-ProviderRefreshMode `
      -ProviderConfig $providerConfig `
      -Provider $provider `
      -StatusPath $statusPath `
      -BootstrapFingerprint ([pscustomobject]$bootstrapFingerprint) `
      -InvocationRefreshMode $invocationRefreshMode `
      -RepoRoot $repoRoot `
      -SourceRevision $sourceRevision
    $providerRefreshMode = [string]$refreshDecision.refresh_mode
    $refreshReasonCode = [string]$refreshDecision.reason_code
    $incrementalBaseCommit = [string]$refreshDecision.last_indexed_commit
    if ($providerRefreshMode -eq 'blocked') {
      Write-ResultAndExit `
        -WorkflowMode 'blocked' `
        -ReasonCode $refreshReasonCode `
        -NextAction "Provider command shape is unsupported for ${provider}:incremental." `
        -RepoRoot $repoRoot `
        -InvocationWorkspaceRoot $invocationWorkspaceRoot `
        -SelectionSource $selectionSource `
        -GraphDir $graphDir
    }
    if ($providerRefreshMode -eq 'incremental') {
      $readinessSource = 'incremental-update'
      $bootstrapLog = Get-ProviderBootstrapLogPath -Provider $provider -RefreshMode 'incremental' -AttemptRole 'primary' -RawDir $rawDir
      $incrementalCommand = Get-ProviderIncrementalCommand -ProviderConfig $providerConfig -Provider $provider -LastIndexedCommit $incrementalBaseCommit
      $bootstrap = Invoke-ProviderCommandArray -Command $incrementalCommand -Provider $provider -Kind 'incremental' -LogPath $bootstrapLog -RepoRoot $repoRoot -RefreshMode 'incremental' -AttemptRole 'primary'
      $commandResults.Add($bootstrap)
      if ($bootstrap.exit_code -ne 0) {
        $fallbackFromIncremental = $true
        $providerRefreshMode = 'incremental-fallback-full'
        $readinessSource = 'incremental-fallback-full'
        $incrementalExitCode = [int]$bootstrap.exit_code
        $bootstrapLog = Get-ProviderBootstrapLogPath -Provider $provider -RefreshMode 'full' -AttemptRole 'fallback' -RawDir $rawDir
        $fullCommand = Get-ProviderFullCommand -ProviderConfig $providerConfig -Provider $provider
        $bootstrap = Invoke-ProviderCommandArray -Command $fullCommand -Provider $provider -Kind 'bootstrap' -LogPath $bootstrapLog -RepoRoot $repoRoot -RefreshMode 'full' -AttemptRole 'fallback'
        $commandResults.Add($bootstrap)
        if ($bootstrap.exit_code -eq 0) {
          $finalFullAttemptSucceeded = $true
          $failureInfo = New-IncrementalFallbackSuccessFailureInfo -ExitCode $incrementalExitCode
        } else {
          $refreshProcessFailed = $true
          $providerRefreshMode = 'failed'
          $skipNormalizedWrite = $true
          $failureInfo = New-IncrementalBothFailedFailureInfo -ExitCode ([int]$bootstrap.exit_code)
        }
      }
    } else {
      $readinessSource = 'cold-run'
      if (-not [string]::IsNullOrWhiteSpace($refreshReasonCode)) {
        $failureInfo = New-RefreshPreflightFailureInfo -ReasonCode $refreshReasonCode
      }
      $bootstrapLog = Get-ProviderBootstrapLogPath -Provider $provider -RefreshMode 'full' -AttemptRole 'primary' -RawDir $rawDir
      $fullCommand = Get-ProviderFullCommand -ProviderConfig $providerConfig -Provider $provider
      $bootstrap = Invoke-ProviderCommandArray -Command $fullCommand -Provider $provider -Kind 'bootstrap' -LogPath $bootstrapLog -RepoRoot $repoRoot -RefreshMode 'full' -AttemptRole 'primary'
      $commandResults.Add($bootstrap)
      if ($bootstrap.exit_code -eq 0) {
        $finalFullAttemptSucceeded = $true
      } else {
        $refreshProcessFailed = $true
      }
    }
    if ($provider -eq 'gitnexus' -and $bootstrap.exit_code -eq 0 -and $targetKind -ne 'non-git-folder') {
      $hostInstructionNormalization = Normalize-GitNexusInstructionBlockViaCli -RepoRoot $repoRoot -GitRootTopology 'single-repo'
      Register-BootstrapOwnedHostInstructionHashes -Normalization $hostInstructionNormalization -RepoRoot $repoRoot
    }
    if ($bootstrap.exit_code -eq 0) {
      $statusProbe = Invoke-ConfiguredCommand -ProviderConfig $providerConfig -Provider $provider -Kind 'status' -LogPath $statusLog -RepoRoot $repoRoot
      $commandResults.Add($statusProbe)
      if ($statusProbe.exit_code -eq 0) {
        $graphReady = $true
        $script:QueryProbeVerificationReason = ''
        if ($provider -eq 'gitnexus') {
          $attemptIndex = 0
          $queryProbeExpectedHit = Test-GitNexusQueryProbeExpectedHit -ProviderConfig $providerConfig -Provider $provider
          $candidateCount = Get-GitNexusQueryProbeCandidateCount -ProviderConfig $providerConfig -Provider $provider
          if ($candidateCount -gt $script:GitNexusQueryProbeCandidateLimit) {
            $queryProbeCandidatesTruncated = $true
          }
          foreach ($candidate in @(Get-GitNexusQueryProbeCandidates -ProviderConfig $providerConfig -Provider $provider)) {
            $attemptIndex += 1
            $candidateToken = [string]$candidate.token
            $candidateLog = if ($attemptIndex -eq 1) { Join-Path $rawDir 'query.log' } else { Join-Path $rawDir "query-$attemptIndex.log" }
            $queryProbe = Invoke-GitNexusQueryProbeCandidate -ProviderConfig $providerConfig -Provider $provider -Token $candidateToken -LogPath $candidateLog -RepoRoot $repoRoot
            $verified = $false
            if ($queryProbe.exit_code -eq 0) {
              $verified = Test-QueryProbeVerified -Provider $provider -CommandResult $queryProbe -LogPath $candidateLog -TargetKind $targetKind
            } else {
              $script:QueryProbeResultClass = 'command-failed'
              $script:QueryProbeVerificationReason = 'GitNexus query probe command failed.'
            }
            $queryProbe | Add-Member -NotePropertyName probe_token -NotePropertyValue $candidateToken
            $queryProbe | Add-Member -NotePropertyName probe_selected_from -NotePropertyValue $(if ($candidate.PSObject.Properties.Name -contains 'selected_from') { $candidate.selected_from } else { $null })
            $queryProbe | Add-Member -NotePropertyName probe_reason_code -NotePropertyValue $(if ($candidate.PSObject.Properties.Name -contains 'reason_code') { [string]$candidate.reason_code } else { 'legacy-token' })
            $queryProbe | Add-Member -NotePropertyName result_class -NotePropertyValue $script:QueryProbeResultClass
            $queryProbe | Add-Member -NotePropertyName verification_reason -NotePropertyValue $script:QueryProbeVerificationReason
            $commandResults.Add($queryProbe)
            $queryProbeAttempts.Add([pscustomobject][ordered]@{
              token = $candidateToken
              selected_from = if ($candidate.PSObject.Properties.Name -contains 'selected_from') { $candidate.selected_from } else { $null }
              reason_code = if ($candidate.PSObject.Properties.Name -contains 'reason_code') { [string]$candidate.reason_code } else { 'legacy-token' }
              exit_code = [int]$queryProbe.exit_code
              result_class = $script:QueryProbeResultClass
              verification_reason = if ([string]::IsNullOrWhiteSpace($script:QueryProbeVerificationReason)) { $null } else { $script:QueryProbeVerificationReason }
              raw_log = $queryProbe.raw_log
            }) | Out-Null
            if ($verified -and ($script:QueryProbeResultClass -eq 'process-results' -or $script:QueryProbeResultClass -eq 'definitions-only')) {
              $queryReady = $true
              break
            }
          }
          if (-not $queryReady) {
            if ($queryProbeAttempts.Count -eq 0) {
              $script:QueryProbeVerificationReason = 'GitNexus query probe did not run any candidate.'
            } elseif (@($queryProbeAttempts | Where-Object { $_.result_class -ne 'definitions-only' }).Count -eq 0) {
              $script:QueryProbeVerificationReason = 'All GitNexus query probe candidates returned definitions-only evidence without BM25/process query results.'
            } elseif (@($queryProbeAttempts | Where-Object { $_.result_class -eq 'diagnostic' }).Count -gt 0) {
              $script:QueryProbeVerificationReason = 'GitNexus query probe emitted FTS/read-only/missing-index diagnostics.'
            } elseif (@($queryProbeAttempts | Where-Object { $_.result_class -eq 'command-failed' }).Count -gt 0) {
              $script:QueryProbeVerificationReason = 'GitNexus query probe command failed.'
            } else {
              $script:QueryProbeVerificationReason = 'GitNexus query probe candidates did not return non-empty BM25/process query results.'
            }
            if ($queryProbeCandidatesTruncated) {
              $script:QueryProbeVerificationReason = "$($script:QueryProbeVerificationReason) Only the first $script:GitNexusQueryProbeCandidateLimit bounded GitNexus query probe candidates were attempted."
            }
            $lastQueryExitCode = if ($queryProbeAttempts.Count -gt 0) { [int]$queryProbeAttempts[$queryProbeAttempts.Count - 1].exit_code } else { 0 }
            $mismatchFailureInfo = Get-GitNexusRepoLabelMismatchFailureInfo -ProviderConfig $providerConfig -RepoRoot $repoRoot -ExitCode $lastQueryExitCode
            if ($null -ne $mismatchFailureInfo) {
              $failureInfo = $mismatchFailureInfo
              $script:QueryProbeVerificationReason = [string]$mismatchFailureInfo['diagnostic']
            } else {
              $diagnosticFailureInfo = Get-GitNexusQueryDiagnosticFailureInfo -ProviderConfig $providerConfig -ExitCode $lastQueryExitCode -QueryProbeAttempts @($queryProbeAttempts)
              if ($null -ne $diagnosticFailureInfo) {
                $failureInfo = $diagnosticFailureInfo
                $script:QueryProbeVerificationReason = [string]$diagnosticFailureInfo['diagnostic']
              }
            }
          }
        } else {
          $queryProbe = Invoke-ConfiguredCommand -ProviderConfig $providerConfig -Provider $provider -Kind 'query_probe' -LogPath $queryLog -RepoRoot $repoRoot
          $commandResults.Add($queryProbe)
          if ($queryProbe.exit_code -eq 0 -and (Test-QueryProbeVerified -Provider $provider -CommandResult $queryProbe -LogPath $queryLog -TargetKind $targetKind)) {
            $queryReady = $true
          }
        }
        if (
          $provider -eq 'gitnexus' -and
          $queryReady -and
          $targetKind -ne 'non-git-folder' -and
          @($queryProbeAttempts | Where-Object { $_.result_class -eq 'definitions-only' }).Count -eq 0 -and
          $entry.commands.PSObject.Properties.Name -contains 'impact_probe'
        ) {
          $impactLog = Join-Path $rawDir 'impact.log'
          $impactProbe = Invoke-ConfiguredCommand -ProviderConfig $providerConfig -Provider $provider -Kind 'impact_probe' -LogPath $impactLog -RepoRoot $repoRoot
          if ($impactProbe.exit_code -eq 0 -and (Test-GitNexusImpactProbeHasRelatedTests -LogPath $impactLog)) {
            $impactProbe | Add-Member -NotePropertyName result_class -NotePropertyValue 'related-tests-supported'
          } elseif ($impactProbe.exit_code -eq 0) {
            $impactProbe | Add-Member -NotePropertyName result_class -NotePropertyValue 'related-tests-unproven'
            $impactProbe | Add-Member -NotePropertyName verification_reason -NotePropertyValue 'GitNexus impact probe returned no test provenance.'
          } else {
            $impactProbe | Add-Member -NotePropertyName result_class -NotePropertyValue 'command-failed'
            $impactProbe | Add-Member -NotePropertyName verification_reason -NotePropertyValue 'GitNexus impact probe command failed.'
          }
          $commandResults.Add($impactProbe)
        }
        if ($queryReady) {
          $status = 'ready'
          $confidence = 'high'
          if ($provider -eq 'gitnexus' -and @($queryProbeAttempts | Where-Object { $_.result_class -eq 'definitions-only' }).Count -gt 0) {
            $limitations = @('Definitions-only GitNexus evidence accepted as query-ready for query/context orientation; no process graph or GitNexus impact/review evidence is available.')
          } else {
            $limitations = @()
          }
        } elseif ($provider -eq 'gitnexus' -and -not $queryProbeExpectedHit) {
          $status = 'query-not-applicable'
          $confidence = 'medium'
          $script:QueryProbeVerificationReason = 'GitNexus query proof is not expected because setup found no source-derived probe candidate.'
          $failureInfo = [ordered]@{
            failed_phase = $null
            failure_class = $null
            reason_code = 'gitnexus-query-not-applicable'
            exit_code = $null
            recommended_action = 'Skip GitNexus process routing for this no-source child repo; use file/direct-read context only if needed.'
          }
          $limitations = @('Build and status succeeded; this repo has no source-derived GitNexus query probe candidate.', $script:QueryProbeVerificationReason)
        } else {
          $status = 'query-unverified'
          $confidence = 'medium'
          $reason = if ([string]::IsNullOrWhiteSpace($script:QueryProbeVerificationReason)) { 'Provider-specific query-surface proof did not verify provider readiness.' } else { $script:QueryProbeVerificationReason }
          $limitations = @('Build and status succeeded, but provider-specific query-surface proof did not verify provider readiness.', $reason)
          if (-not [string]::IsNullOrWhiteSpace([string]$failureInfo['recommended_action'])) {
            $limitations += [string]$failureInfo['recommended_action']
          }
        }
      } else {
        $status = 'query-unverified'
        $confidence = 'medium'
        $failureInfo = Get-ProviderFailureInfo -Provider $provider -Phase 'status' -ExitCode ([int]$statusProbe.exit_code) -Diagnostic ([string]$statusProbe.diagnostic)
        $limitations = @('Build succeeded, but status probe did not verify provider readiness.')
        if (-not [string]::IsNullOrWhiteSpace([string]$failureInfo['recommended_action'])) {
          $limitations += [string]$failureInfo['recommended_action']
        }
      }
    } else {
      $status = 'failed'
      $providerRefreshMode = 'failed'
      if ([string]$failureInfo['reason_code'] -ne 'incremental-and-full-failed') {
        $failureInfo = Get-ProviderFailureInfo -Provider $provider -Phase 'bootstrap' -ExitCode ([int]$bootstrap.exit_code) -Diagnostic ([string]$bootstrap.diagnostic)
      }
      $limitations = @('Provider bootstrap command failed.')
      if (-not [string]::IsNullOrWhiteSpace([string]$failureInfo['recommended_action'])) {
        $limitations += [string]$failureInfo['recommended_action']
      }
    }
    }
  }

  $statusPath = Join-Path $providerDir 'status.json'
  if (-not $skipNormalizedWrite) {
    Write-NormalizedArtifacts -Provider $provider -StatusPath $statusPath -QueryReady $queryReady -BootstrappedAt $bootstrappedAt -ProvidersDir $providersDir -TargetKind $targetKind -CommandResults @($commandResults) -QueryProbeAttempts @($queryProbeAttempts)
  }
  $providerFinishedAt = Get-UtcTimestamp
  $providerDurationMs = (Get-EpochMilliseconds) - $providerStartedEpochMs
  $lastIndexedCommit = if ($targetKind -eq 'non-git-folder') {
    $null
  } elseif ($graphReady -and $queryReady -and -not $worktreeDirty) {
    $sourceRevision
  } elseif (-not [string]::IsNullOrWhiteSpace($priorLastIndexedCommit)) {
    $priorLastIndexedCommit
  } else {
    $null
  }
  $requiresCleanFullRefresh = if ($targetKind -eq 'non-git-folder') {
    $false
  } elseif ((-not $worktreeDirty) -and $finalFullAttemptSucceeded -and $graphReady -and $queryReady) {
    $false
  } elseif ($refreshProcessFailed) {
    $true
  } else {
    $priorRequiresCleanFullRefresh
  }
  $bootstrapRawLogsForStatus = @($commandResults | Where-Object { [string]$_.kind -eq 'bootstrap' } | ForEach-Object { [string]$_.raw_log })
  $statusRawLogsForStatus = @($commandResults | Where-Object { [string]$_.kind -eq 'status' } | ForEach-Object { [string]$_.raw_log })
  $queryRawLogsForStatus = @($commandResults | Where-Object { [string]$_.kind -eq 'query_probe' } | ForEach-Object { [string]$_.raw_log })
  $impactRawLogsForStatus = @($commandResults | Where-Object { [string]$_.kind -eq 'impact_probe' } | ForEach-Object { [string]$_.raw_log })
  $providerRawLogs = [ordered]@{
    bootstrap = if ($bootstrapRawLogsForStatus.Count -gt 0) {
      $bootstrapRawLogsForStatus[$bootstrapRawLogsForStatus.Count - 1]
    } else {
      ".spec-first/providers/$provider/raw/" + $(if ($provider -eq 'gitnexus') { 'analyze.log' } else { 'build.log' })
    }
    status = if ($statusRawLogsForStatus.Count -gt 0) { $statusRawLogsForStatus[0] } else { ".spec-first/providers/$provider/raw/status.log" }
    query_probe = if ($queryRawLogsForStatus.Count -gt 0) { $queryRawLogsForStatus[0] } else { ".spec-first/providers/$provider/raw/query.log" }
  }
  if ($impactRawLogsForStatus.Count -gt 0) {
    $providerRawLogs['impact_probe'] = $impactRawLogsForStatus[0]
  }
  $relatedTestsSupportedForStatus = @($commandResults | Where-Object { [string]$_.kind -eq 'impact_probe' -and [int]$_.exit_code -eq 0 -and [string]$_.result_class -eq 'related-tests-supported' }).Count -gt 0
  $providerStatus = [ordered]@{
    schema_version = 'provider-status.v1'
    provider = $provider
    generated_at = $bootstrappedAt
    timing = [ordered]@{
      started_at = $providerStartedAt
      finished_at = $providerFinishedAt
      duration_ms = $providerDurationMs
    }
    configured = [bool]$entry.configured
    enabled_for_bootstrap = [bool]$entry.enabled_for_bootstrap
    dependency_status = $entry.dependency_status
    host_config_status = $entry.host_config_status
    skip_reason = if ($status -eq 'skipped') { $skipReason } else { $null }
    status = $status
    graph_ready = $graphReady
    query_ready = $queryReady
    readiness_source = $readinessSource
    refresh_mode = $providerRefreshMode
    fallback_from_incremental = $fallbackFromIncremental
    last_indexed_commit = $lastIndexedCommit
    requires_clean_full_refresh = $requiresCleanFullRefresh
    reuse_eligible = [bool]$reuseDecision.eligible
    reuse_ineligible_reason = $reuseDecision.reason
    bootstrap_fingerprint = $bootstrapFingerprint
    failed_phase = $failureInfo['failed_phase']
    failure_class = $failureInfo['failure_class']
    reason_code = $failureInfo['reason_code']
    exit_code = $failureInfo['exit_code']
    recommended_action = $failureInfo['recommended_action']
    confidence = $confidence
    limitations = $limitations
    review_support = if ($provider -eq 'gitnexus') {
      $definitionsOnlyForStatus = @($queryProbeAttempts | Where-Object { $_.result_class -eq 'definitions-only' }).Count -gt 0
      [ordered]@{
        related_tests_status = if ($targetKind -eq 'non-git-folder' -or $definitionsOnlyForStatus) { 'unavailable' } elseif ($relatedTestsSupportedForStatus) { 'supported' } elseif ($queryReady) { 'candidate-only' } else { 'unavailable' }
        impact_probe_raw_log = if ($impactRawLogsForStatus.Count -gt 0) { $impactRawLogsForStatus[0] } else { $null }
        limitations = if ($targetKind -eq 'non-git-folder') { @('non_git_folder_no_git_diff') } elseif ($definitionsOnlyForStatus) { @('definitions_only_no_process_graph', 'definitions_only_no_impact_evidence', 'definitions_only_no_related_tests') } elseif ($relatedTestsSupportedForStatus) { @() } elseif ($queryReady) { @('related_tests_unverified') } else { @('gitnexus_query_unverified') }
      }
    } else {
      $null
    }
    query_verification_reason = if ($status -eq 'query-unverified' -or $status -eq 'query-not-applicable') {
      if (-not [string]::IsNullOrWhiteSpace($script:QueryProbeVerificationReason)) { $script:QueryProbeVerificationReason } elseif ($limitations.Count -gt 0) { $limitations[$limitations.Count - 1] } else { $null }
    } else {
      $null
    }
    query_probe_policy = if ($entry.PSObject.Properties.Name -contains 'query_probe_policy') { $entry.query_probe_policy } else { $null }
    query_probe_candidate_limit = if ($provider -eq 'gitnexus') { $script:GitNexusQueryProbeCandidateLimit } else { $null }
    query_probe_candidates_truncated = if ($provider -eq 'gitnexus') { $queryProbeCandidatesTruncated } else { $null }
    repo_snapshot = [ordered]@{
      target_kind = $targetKind
      source_revision = if ($targetKind -eq 'non-git-folder') { $null } else { $sourceRevision }
      worktree_dirty = if ($targetKind -eq 'non-git-folder') { $null } else { $worktreeDirty }
      worktree_status_hash = if ($targetKind -eq 'non-git-folder') { $null } else { $worktreeStatusHash }
      folder_snapshot = if ($targetKind -eq 'non-git-folder') { [ordered]@{ content_fingerprint = $folderContentFingerprint } } else { $null }
    }
    command_results = @($commandResults)
    query_probe_attempts = if ($provider -eq 'gitnexus') { @($queryProbeAttempts) } else { $null }
    host_instruction_normalization = if ($provider -eq 'gitnexus') { $hostInstructionNormalization } else { $null }
    command_source = '.spec-first/config/graph-providers.json'
    diagnostics = @($commandResults | Where-Object { -not [string]::IsNullOrWhiteSpace($_.diagnostic) } | ForEach-Object { $_.diagnostic })
    diagnostics_truncated = [bool](@($commandResults | Where-Object { $_.diagnostics_truncated }).Count)
    raw_logs = $providerRawLogs
    normalized_artifacts = [ordered]@{
      architecture_facts = '.spec-first/providers/gitnexus/normalized/architecture-facts.json'
      reuse_candidates = '.spec-first/providers/gitnexus/normalized/reuse-candidates.json'
      impact_capabilities = '.spec-first/providers/gitnexus/normalized/impact-capabilities.json'
    }
  }
  Write-JsonFileAtomic -Path $statusPath -Payload ([pscustomobject]$providerStatus) -Depth 20
  $providerStatuses.Add([pscustomobject]$providerStatus)
}

$readyCount = @($providerStatuses | Where-Object { $_.query_ready }).Count
$providerCount = @($providerStatuses).Count
$notApplicableCount = @($providerStatuses | Where-Object { $_.status -eq 'query-not-applicable' }).Count
$blockingNotReadyCount = @($providerStatuses | Where-Object { -not $_.query_ready -and $_.status -ne 'query-not-applicable' -and $_.status -ne 'skipped' }).Count
$fallbackReady = [bool](@($runtimeCapabilities.fallback_capabilities.PSObject.Properties | Where-Object { $_.Value.support_level -ne 'none' }).Count)
$preserveCanonicalFreshness = @($providerStatuses | Where-Object { $_.reason_code -eq 'incremental-and-full-failed' }).Count -gt 0
if ($providerCount -gt 0 -and $readyCount -eq $providerCount) {
  $workflowMode = 'primary'
  $overallStatus = if ($script:DirtyClassification -eq 'graph-affecting-blocked') { 'ready-dirty-advisory' } else { 'ready' }
  $exitCode = 0
} elseif ($providerCount -gt 0 -and $notApplicableCount -gt 0 -and $blockingNotReadyCount -eq 0) {
  $workflowMode = 'no-source'
  $overallStatus = 'not-applicable'
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
$bootstrapFinishedAt = Get-UtcTimestamp
$bootstrapDurationMs = (Get-EpochMilliseconds) - $script:ScriptStartedEpochMs
# U1: critical write window 内 worktree 被外部修改时,
# 标记 concurrent-write-detected 并阻断,canonical_artifacts_preserved=false。
# 使用 external-actor fingerprint 排除 bootstrap 自身 owned 路径,避免 false positive。
$externalActorFingerprintBefore = $script:ExternalActorFingerprintBefore
$hostInstructionHashMismatch = Test-BootstrapOwnedHostInstructionHashMismatch
$externalActorFingerprintAfter = Get-StatusHash -Text (Get-ExternalActorFingerprint)
if (($externalActorFingerprintAfter -ne $externalActorFingerprintBefore) -or $hostInstructionHashMismatch) {
  $topLevelReasonCode = 'concurrent-write-detected'
  $workflowMode = 'blocked'
  $overallStatus = 'action-required'
  $preserveCanonicalFreshness = $false
  $exitCode = 1
} elseif ($preserveCanonicalFreshness) {
  $topLevelReasonCode = 'incremental-and-full-failed'
} elseif ($workflowMode -eq 'blocked') {
  $topLevelReasonCode = 'graph-not-ready'
} else {
  $topLevelReasonCode = $null
}

$providerAggregate = [ordered]@{
  schema_version = 'graph-provider-status.v1'
  generated_at = $bootstrappedAt
  timing = [ordered]@{
    started_at = $script:ScriptStartedAt
    finished_at = $bootstrapFinishedAt
    duration_ms = $bootstrapDurationMs
  }
  workflow_mode = $workflowMode
  target_kind = $targetKind
  folder_snapshot = if ($targetKind -eq 'non-git-folder') { [ordered]@{ content_fingerprint = $folderContentFingerprint } } else { $null }
  ready_primary_providers = @($providerStatuses | Where-Object { $_.query_ready } | ForEach-Object { $_.provider })
  failed_primary_providers = @($providerStatuses | Where-Object { -not $_.query_ready -and $_.status -ne 'skipped' -and $_.status -ne 'query-not-applicable' } | ForEach-Object { $_.provider })
  not_applicable_providers = @($providerStatuses | Where-Object { $_.status -eq 'query-not-applicable' } | ForEach-Object { $_.provider })
  skipped_primary_providers = @($providerStatuses | Where-Object { $_.status -eq 'skipped' } | ForEach-Object { $_.provider })
  partial_primary_available = ($readyCount -gt 0)
  providers = @($providerStatuses)
  confidence = if ($workflowMode -eq 'primary') { 'high' } elseif ($workflowMode -eq 'degraded-fallback' -or $workflowMode -eq 'no-source') { 'medium' } else { 'low' }
  limitations = if ($workflowMode -eq 'primary') { @() } elseif ($workflowMode -eq 'degraded-fallback') { @('One or more primary graph providers are unavailable or query-unverified; fallback capabilities are required.') } elseif ($workflowMode -eq 'no-source') { @('No source-derived GitNexus process query target is available for this repo.') } else { @('No query-ready graph provider or fallback capability is available.') }
}
$providerAggregatePath = Join-Path $graphDir 'provider-status.json'
if (-not $preserveCanonicalFreshness -or -not (Test-Path -LiteralPath $providerAggregatePath -PathType Leaf)) {
  Write-JsonFileAtomic -Path $providerAggregatePath -Payload ([pscustomobject]$providerAggregate) -Depth 30
}

$gitNexusReadyProviders = @($providerStatuses | Where-Object { $_.provider -eq 'gitnexus' -and $_.query_ready } | ForEach-Object { $_.provider })
$gitNexusReady = ($gitNexusReadyProviders.Count -gt 0)
$gitNexusRelatedTestsSupported = @($providerStatuses | Where-Object { $_.provider -eq 'gitnexus' -and $null -ne $_.review_support -and $_.review_support.related_tests_status -eq 'supported' }).Count -gt 0
$gitNexusDefinitionsOnlyReady = $false
foreach ($providerStatus in $providerStatuses) {
  if ($providerStatus.provider -eq 'gitnexus' -and $providerStatus.query_ready -and @($providerStatus.query_probe_attempts | Where-Object { $_.result_class -eq 'definitions-only' }).Count -gt 0) {
    $gitNexusDefinitionsOnlyReady = $true
    break
  }
}
$queryOnlyGitNexusReady = ($targetKind -eq 'non-git-folder' -or $gitNexusDefinitionsOnlyReady)
$gitNexusImpactProviders = if ($queryOnlyGitNexusReady) { @() } else { @($gitNexusReadyProviders) }

$graphFacts = [ordered]@{
  schema_version = 'graph-facts.v1'
  generated_at = $bootstrappedAt
  timing = [ordered]@{
    started_at = $script:ScriptStartedAt
    finished_at = $bootstrapFinishedAt
    duration_ms = $bootstrapDurationMs
  }
  repo_root = $repoRoot
  target_kind = $targetKind
  folder_snapshot = if ($targetKind -eq 'non-git-folder') { [ordered]@{ content_fingerprint = $folderContentFingerprint } } else { $null }
  source_revision = if ($targetKind -eq 'non-git-folder') { $null } else { $sourceRevision }
  source_revision_dirty = if ($targetKind -eq 'non-git-folder') { $false } else { ($script:DirtyClassification -eq 'graph-affecting-blocked') }
  freshness_state = if ($script:DirtyClassification -eq 'graph-affecting-blocked') { 'dirty-advisory' } else { 'fresh' }
  worktree_dirty = if ($targetKind -eq 'non-git-folder') { $null } else { $worktreeDirty }
  worktree_status_hash = if ($targetKind -eq 'non-git-folder') { $null } else { $worktreeStatusHash }
  dirty_classification = $script:DirtyClassification
  dirty_paths_breakdown = $script:DirtyPathsBreakdown
  workflow_mode = $workflowMode
  provider_summary = [ordered]@{
    ready_primary_providers = @($providerAggregate.ready_primary_providers)
    degraded_providers = @($providerStatuses | Where-Object { -not $_.query_ready -and $_.status -ne 'skipped' -and $_.status -ne 'query-not-applicable' } | ForEach-Object { $_.provider })
    not_applicable_providers = @($providerStatuses | Where-Object { $_.status -eq 'query-not-applicable' } | ForEach-Object { $_.provider })
    skipped_primary_providers = @($providerStatuses | Where-Object { $_.status -eq 'skipped' } | ForEach-Object { $_.provider })
    partial_primary_available = ($readyCount -gt 0)
  }
  canonical_artifacts = [ordered]@{
    provider_status = '.spec-first/graph/provider-status.json'
    impact_capabilities = '.spec-first/impact/bootstrap-impact-capabilities.json'
  }
  capabilities = [ordered]@{
    query_global_graph = $gitNexusReady
    impact_context = ($gitNexusReady -and $gitNexusRelatedTestsSupported -and -not $queryOnlyGitNexusReady)
    impact_context_status = if ($gitNexusReady -and $gitNexusRelatedTestsSupported -and -not $queryOnlyGitNexusReady) { 'supported' } elseif ($queryOnlyGitNexusReady) { 'unavailable' } elseif ($gitNexusReady) { 'limited' } else { 'unavailable' }
    impact_context_limitations = if ($gitNexusReady -and $gitNexusRelatedTestsSupported -and -not $queryOnlyGitNexusReady) { @() } elseif ($targetKind -eq 'non-git-folder') { @('non_git_folder_no_git_diff', 'non_git_folder_no_commit_freshness', 'non_git_folder_no_incremental') } elseif ($gitNexusDefinitionsOnlyReady) { @('definitions_only_no_process_graph', 'definitions_only_no_impact_evidence', 'definitions_only_no_related_tests') } elseif ($gitNexusReady) { @('related_tests_unverified') } else { @('gitnexus_query_unverified') }
  }
  staleness_hints = [ordered]@{
    compare_source_revision = ($targetKind -ne 'non-git-folder')
    compare_worktree_dirty = ($targetKind -ne 'non-git-folder')
    worktree_status_hash = if ($targetKind -eq 'non-git-folder') { $null } else { $worktreeStatusHash }
    content_fingerprint = if ($targetKind -eq 'non-git-folder') { $folderContentFingerprint } else { $null }
  }
  confidence = $providerAggregate.confidence
  limitations = if ($targetKind -eq 'non-git-folder') {
    @(
      'Non-git folder target: no source_revision, branch, dirty hash, last_indexed_commit, Git diff evidence, or no incremental refresh/freshness is available.',
      'Supports query/context/architecture orientation only; downstream review-impact must use source reads and explicit diffs from other evidence.'
    )
  } elseif ($gitNexusDefinitionsOnlyReady) {
    @('Definitions-only GitNexus evidence: supports query/context/architecture orientation only; no process graph or GitNexus impact/review evidence is available. Downstream LLM workflows decide whether this matches the user task.')
  } else {
    @($providerAggregate.limitations)
  }
}
$graphFactsPath = Join-Path $graphDir 'graph-facts.json'
if (-not $preserveCanonicalFreshness -or -not (Test-Path -LiteralPath $graphFactsPath -PathType Leaf)) {
  Write-JsonFileAtomic -Path $graphFactsPath -Payload ([pscustomobject]$graphFacts) -Depth 20
}

$readyPrimaryProviders = @($providerStatuses | Where-Object { $_.query_ready } | ForEach-Object { $_.provider })
$contextFallback = Get-FallbackCapability -RuntimeCapabilities $runtimeCapabilities -Name 'context_selection'
$impactFallback = Get-FallbackCapability -RuntimeCapabilities $runtimeCapabilities -Name 'impact_radius'
$reviewFallback = Get-FallbackCapability -RuntimeCapabilities $runtimeCapabilities -Name 'review_support'
$impactCapabilities = [ordered]@{
  schema_version = 'bootstrap-impact-capabilities.v1'
  generated_at = $bootstrappedAt
  workflow_mode = $workflowMode
  target_kind = $targetKind
  capabilities = [ordered]@{
    context_selection = [ordered]@{
      support_level = if ($readyPrimaryProviders.Count -gt 0) { 'full' } elseif (Test-FallbackSupported -Fallback $contextFallback) { 'partial' } else { 'none' }
      primary_providers = @($readyPrimaryProviders)
      fallback_support = $contextFallback
      confidence = if ($readyPrimaryProviders.Count -gt 0) { 'high' } else { $contextFallback.confidence }
      limitations = if ($readyPrimaryProviders.Count -gt 0) { @() } else { @('Using fallback context selection only.') }
    }
    impact_radius = [ordered]@{
      support_level = if ($queryOnlyGitNexusReady) { 'none' } elseif ($gitNexusReady) { 'full' } elseif (Test-FallbackSupported -Fallback $impactFallback) { 'partial' } else { 'none' }
      primary_providers = @($gitNexusImpactProviders)
      fallback_support = $impactFallback
      confidence = if ($queryOnlyGitNexusReady) { 'low' } elseif ($gitNexusReady) { 'high' } else { $impactFallback.confidence }
      limitations = if ($targetKind -eq 'non-git-folder') { @('non_git_folder_no_git_diff', 'non_git_folder_no_commit_freshness', 'non_git_folder_no_incremental') } elseif ($gitNexusDefinitionsOnlyReady) { @('definitions_only_no_process_graph', 'definitions_only_no_impact_evidence', 'definitions_only_no_related_tests') } elseif ($gitNexusReady) { @() } else { @('Impact radius is not backed by a query-ready provider.') }
    }
    review_support = [ordered]@{
      support_level = if ($queryOnlyGitNexusReady) { 'none' } elseif ($gitNexusReady -and $gitNexusRelatedTestsSupported) { 'full' } elseif ($gitNexusReady) { 'partial' } elseif (Test-FallbackSupported -Fallback $reviewFallback) { 'partial' } else { 'none' }
      primary_providers = @($gitNexusImpactProviders)
      related_tests_status = if ($queryOnlyGitNexusReady) { 'unavailable' } elseif ($gitNexusRelatedTestsSupported) { 'supported' } elseif ($gitNexusReady) { 'candidate-only' } else { 'unavailable' }
      fallback_support = $reviewFallback
      confidence = if ($queryOnlyGitNexusReady) { 'low' } elseif ($gitNexusRelatedTestsSupported) { 'high' } elseif ($gitNexusReady) { 'medium' } else { $reviewFallback.confidence }
      limitations = @('This artifact reports readiness only; downstream LLM workflows decide review evidence relevance.') + $(if ($targetKind -eq 'non-git-folder') { @('non_git_folder_no_git_diff', 'non_git_folder_no_commit_freshness', 'non_git_folder_no_incremental') } elseif ($gitNexusDefinitionsOnlyReady) { @('definitions_only_no_process_graph', 'definitions_only_no_impact_evidence', 'definitions_only_no_related_tests') } elseif ($gitNexusReady -and -not $gitNexusRelatedTestsSupported) { @('related_tests_unverified') } else { @() })
    }
  }
  downstream_guidance = [ordered]@{
    canonical_graph_facts = '.spec-first/graph/graph-facts.json'
    provider_status = '.spec-first/graph/provider-status.json'
    limitations_required = ($workflowMode -ne 'primary')
  }
}
$impactCapabilitiesPath = Join-Path $impactDir 'bootstrap-impact-capabilities.json'
if (-not $preserveCanonicalFreshness -or -not (Test-Path -LiteralPath $impactCapabilitiesPath -PathType Leaf)) {
  Write-JsonFileAtomic -Path $impactCapabilitiesPath -Payload ([pscustomobject]$impactCapabilities) -Depth 20
}

$providerReportRows = @($providerStatuses | ForEach-Object {
  $attemptSummary = if ($_.PSObject.Properties.Name -contains 'query_probe_attempts' -and $null -ne $_.query_probe_attempts -and @($_.query_probe_attempts).Count -gt 0) {
    (@($_.query_probe_attempts) | ForEach-Object { "$($_.token):$($_.result_class)" }) -join ','
  } else {
    ''
  }
  $token = if (-not [string]::IsNullOrWhiteSpace($attemptSummary)) { $attemptSummary } elseif ($null -ne $_.query_probe_policy -and $_.query_probe_policy.PSObject.Properties.Name -contains 'token') { [string]$_.query_probe_policy.token } else { 'n/a' }
  $reason = if (-not [string]::IsNullOrWhiteSpace([string]$_.query_verification_reason)) { [string]$_.query_verification_reason } else { (@($_.limitations) -join '; ') }
  if ([string]::IsNullOrWhiteSpace($reason)) { $reason = 'n/a' }
  $reason = $reason.Replace('|', '/')
  "| $($_.provider) | $($_.graph_ready) | $($_.query_ready) | $token | $($_.status) | $($_.timing.duration_ms) | $reason |"
})

if (-not $preserveCanonicalFreshness) {
  $freshnessStateVal = if ($script:DirtyClassification -eq 'graph-affecting-blocked') { 'dirty-advisory' } else { 'fresh' }
  Write-TextFileAtomic -Path (Join-Path $graphDir 'bootstrap-report.md') -Value @"
# Graph Bootstrap Report

- workflow_mode: $workflowMode
- overall_status: $overallStatus
- freshness_state: $freshnessStateVal
- target_kind: $targetKind
- source_revision: $(if ($targetKind -eq 'non-git-folder') { 'n/a' } else { $sourceRevision })
- content_fingerprint: $(if ($targetKind -eq 'non-git-folder') { $folderContentFingerprint } else { 'n/a' })
- worktree_dirty: $(if ($targetKind -eq 'non-git-folder') { 'n/a' } else { $worktreeDirty })
- dirty_classification: $script:DirtyClassification
- duration_ms: $bootstrapDurationMs
- provider_status: .spec-first/graph/provider-status.json
- graph_facts: .spec-first/graph/graph-facts.json
- impact_capabilities: .spec-first/impact/bootstrap-impact-capabilities.json

| Provider | Graph Ready | Query Ready | Probe Token | Evidence | Duration ms | Query Verification Reason |
| --- | --- | --- | --- | --- | ---: | --- |
$($providerReportRows -join [Environment]::NewLine)
"@
}

[pscustomobject]@{
  schema_version = 'graph-bootstrap-result.v1'
  overall_status = $overallStatus
  workflow_mode = $workflowMode
  reason_code = $topLevelReasonCode
  freshness_state = if ($script:DirtyClassification -eq 'graph-affecting-blocked') { 'dirty-advisory' } else { 'fresh' }
  target_kind = $targetKind
  folder_snapshot = if ($targetKind -eq 'non-git-folder') { [ordered]@{ content_fingerprint = $folderContentFingerprint } } else { $null }
  source_revision_dirty = if ($targetKind -eq 'non-git-folder') { $false } else { ($script:DirtyClassification -eq 'graph-affecting-blocked') }
  dirty_classification = $script:DirtyClassification
  dirty_paths_breakdown = $script:DirtyPathsBreakdown
  canonical_artifacts_preserved = $preserveCanonicalFreshness
  repo_root = $repoRoot
  invocation_workspace_root = $invocationWorkspaceRoot
  selection_source = $selectionSource
  ledger_path = $ledgerPath
  provider_config_path = $providerConfigPath
  runtime_capabilities_path = $runtimeCapabilitiesPath
  provider_artifacts_path = $providerArtifactsPath
  provider_summary = $graphFacts.provider_summary
  canonical_artifacts = $graphFacts.canonical_artifacts
  capabilities = $graphFacts.capabilities
  timing = [ordered]@{
    started_at = $script:ScriptStartedAt
    finished_at = $bootstrapFinishedAt
    duration_ms = $bootstrapDurationMs
  }
  results = @($providerStatuses)
} | ConvertTo-Json -Depth 30 -Compress

exit $exitCode
