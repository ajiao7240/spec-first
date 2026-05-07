param(
  [string]$Repo = '',
  [switch]$AllRepos
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$script:GitNexusQueryProbeCandidateLimit = 5
$script:BootstrapProvidersScript = $PSCommandPath

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
  $childIndex = 0
  foreach ($child in $children) {
    $childIndex += 1
    [Console]::Error.WriteLine("spec-graph-bootstrap: all-repos child $childIndex/$($children.Count) start repo=$([string]$child.workspace_relative_path)")
    $childRun = Invoke-ChildJsonScript -ScriptPath $script:BootstrapProvidersScript -Arguments @{ Repo = [string]$child.workspace_relative_path }
    $childStatus = [int]$childRun.exit_code
    $childText = [string]$childRun.stdout
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
      overall_status = [string]($childResult.overall_status ?? 'unknown')
      workflow_mode = [string]($childResult.workflow_mode ?? 'unknown')
      reason_code = $childResult.reason_code
      result = $childResult
    }
    [Console]::Error.WriteLine("spec-graph-bootstrap: all-repos child $childIndex/$($children.Count) finish repo=$([string]$child.workspace_relative_path) status=$([string]($childResult.overall_status ?? 'unknown')) workflow=$([string]($childResult.workflow_mode ?? 'unknown'))")
  }

  $readyCount = @($results | Where-Object { $_.overall_status -eq 'ready' }).Count
  $degradedCount = @($results | Where-Object { $_.workflow_mode -eq 'degraded-fallback' -or $_.overall_status -eq 'degraded' }).Count
  $notApplicableCount = @($results | Where-Object { $_.workflow_mode -eq 'no-source' -or $_.overall_status -eq 'not-applicable' }).Count
  $actionRequiredCount = @($results | Where-Object { $_.overall_status -ne 'ready' -and $_.workflow_mode -ne 'degraded-fallback' -and $_.overall_status -ne 'degraded' -and $_.workflow_mode -ne 'no-source' -and $_.overall_status -ne 'not-applicable' }).Count
  $overallStatus = if ($results.Count -eq 0) { 'action-required' } elseif ($actionRequiredCount -eq 0 -and $degradedCount -eq 0) { 'ready' } elseif (($readyCount + $degradedCount) -gt 0) { 'partial' } else { 'action-required' }
  $summary = [ordered]@{
    schema_version = 'workspace-graph-bootstrap-summary.v1'
    generated_at = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    run_id = $runId
    advisory = $true
    workflow_mode = 'all-repos'
    selection_source = $SelectionSource
    workspace_root = $TargetFacts.workspace_root
    parent_writes_repo_local_artifacts = $false
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
    next_action = if ($actionRequiredCount -gt 0) { 'Inspect per-child reason_code and rerun setup/bootstrap for action-required repos.' } elseif ($degradedCount -gt 0) { 'Use degraded child artifacts with disclosed limitations, or refresh query readiness for degraded repos.' } elseif ($notApplicableCount -gt 0) { 'All code-bearing child repos produced graph bootstrap artifacts; skip GitNexus process routing for no-source children.' } else { 'All child repos produced graph bootstrap artifacts.' }
  }

  $workspaceDir = Join-Path $TargetFacts.workspace_root '.spec-first/workspace'
  New-Item -ItemType Directory -Force -Path $workspaceDir | Out-Null
  Write-JsonFileAtomic -Path (Join-Path $workspaceDir 'graph-bootstrap-summary.json') -Payload ([pscustomobject]$summary) -Depth 30
  [pscustomobject]$summary | ConvertTo-Json -Depth 30 -Compress
  if ($overallStatus -eq 'action-required') { exit 1 }
  exit 0
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
    $normalized = Get-ObjectPropertyValue -Object $gitNexusArtifacts -Name 'normalized_artifacts'
    if ((Get-ObjectPropertyValue -Object $normalized -Name 'architecture_facts') -ne '.spec-first/providers/gitnexus/normalized/architecture-facts.json') { return $false }
    if ((Get-ObjectPropertyValue -Object $normalized -Name 'reuse_candidates') -ne '.spec-first/providers/gitnexus/normalized/reuse-candidates.json') { return $false }
  }

  $crgArtifacts = Get-ObjectPropertyValue -Object $ProviderArtifacts.providers -Name 'code-review-graph'
  if ($null -ne $crgArtifacts) {
    if ((Get-ObjectPropertyValue -Object $crgArtifacts -Name 'raw_dir') -ne '.spec-first/providers/code-review-graph/raw') { return $false }
    if ((Get-ObjectPropertyValue -Object $crgArtifacts -Name 'normalized_dir') -ne '.spec-first/providers/code-review-graph/normalized') { return $false }
    if ((Get-ObjectPropertyValue -Object $crgArtifacts -Name 'status_path') -ne '.spec-first/providers/code-review-graph/status.json') { return $false }
    $rawLogs = Get-ObjectPropertyValue -Object $crgArtifacts -Name 'raw_logs'
    if ((Get-ObjectPropertyValue -Object $rawLogs -Name 'bootstrap') -ne '.spec-first/providers/code-review-graph/raw/build.log') { return $false }
    if ((Get-ObjectPropertyValue -Object $rawLogs -Name 'status') -ne '.spec-first/providers/code-review-graph/raw/status.log') { return $false }
    if ((Get-ObjectPropertyValue -Object $rawLogs -Name 'query_probe') -ne '.spec-first/providers/code-review-graph/raw/query.log') { return $false }
    $normalized = Get-ObjectPropertyValue -Object $crgArtifacts -Name 'normalized_artifacts'
    if ((Get-ObjectPropertyValue -Object $normalized -Name 'impact_capabilities') -ne '.spec-first/providers/code-review-graph/normalized/impact-capabilities.json') { return $false }
  }

  return $true
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
    if ([string]::IsNullOrWhiteSpace([string]$policy.token) -or [string]$policy.token -match '[;&|`$<>]') {
      return $false
    }
  }
  if (-not ($policy.PSObject.Properties.Name -contains 'candidates') -or $null -eq $policy.candidates) {
    return $true
  }
  foreach ($candidate in @($policy.candidates)) {
    if (-not ($candidate.PSObject.Properties.Name -contains 'token') -or [string]::IsNullOrWhiteSpace([string]$candidate.token) -or [string]$candidate.token -match '[;&|`$<>]') {
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
  foreach ($argument in @($CommandArguments)) {
    [void]$processInfo.ArgumentList.Add([string]$argument)
  }
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
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $LogPath) | Out-Null
  $command = @($ProviderConfig.providers.$Provider.commands.$Kind)
  $exe = [string]$command[0]
  $commandArgs = @($command | Select-Object -Skip 1)
  [Console]::Error.WriteLine("spec-graph-bootstrap: running $Provider $Kind; dependencies may download on first use...")
  $result = Invoke-ExternalCommandWithTimeout -Exe $exe -CommandArguments $commandArgs -WorkingDirectory $RepoRoot -TimeoutSeconds $script:ProviderCommandTimeoutSeconds
  $exitCode = [int]$result.exit_code
  if ($result.timed_out) {
    [Console]::Error.WriteLine("spec-graph-bootstrap: timed out $Provider $Kind after ${script:ProviderCommandTimeoutSeconds}s")
  } else {
    [Console]::Error.WriteLine("spec-graph-bootstrap: finished $Provider $Kind with exit $exitCode")
  }
  $outputText = [string]$result.output
  Set-Content -Encoding utf8 -Path $LogPath -Value $outputText
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
  }
}

function Invoke-GitNexusQueryProbeCandidate {
  param(
    [object]$ProviderConfig,
    [string]$Provider,
    [string]$Token,
    [string]$LogPath,
    [string]$RepoRoot
  )
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $LogPath) | Out-Null
  $command = @($ProviderConfig.providers.$Provider.commands.query_probe)
  $command[4] = $Token
  $exe = [string]$command[0]
  $commandArgs = @($command | Select-Object -Skip 1)
  [Console]::Error.WriteLine("spec-graph-bootstrap: running $Provider query_probe token=$Token; dependencies may download on first use...")
  $result = Invoke-ExternalCommandWithTimeout -Exe $exe -CommandArguments $commandArgs -WorkingDirectory $RepoRoot -TimeoutSeconds $script:ProviderCommandTimeoutSeconds
  $exitCode = [int]$result.exit_code
  if ($result.timed_out) {
    [Console]::Error.WriteLine("spec-graph-bootstrap: timed out $Provider query_probe token=$Token after ${script:ProviderCommandTimeoutSeconds}s")
  } else {
    [Console]::Error.WriteLine("spec-graph-bootstrap: finished $Provider query_probe token=$Token with exit $exitCode")
  }
  $outputText = [string]$result.output
  Set-Content -Encoding utf8 -Path $LogPath -Value $outputText
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
  }
}

$script:QueryProbeVerificationReason = ''
$script:QueryProbeResultClass = ''

function Test-GitNexusQueryProbeVerified {
  param(
    [object]$CommandResult,
    [string]$LogPath
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
      $script:QueryProbeVerificationReason = 'GitNexus query probe returned definitions-only evidence without BM25/process query results.'
      $script:QueryProbeResultClass = 'definitions-only'
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
      recommended_action = 'Do not trust GitNexus artifacts. Use code-review-graph and bounded local fallback; capture analyze.log and retry with a newer GitNexus rc or safer GitNexus runtime settings.'
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
    [string]$ProvidersDir,
    [object[]]$QueryProbeAttempts = @()
  )
  $normalizedDir = Join-Path (Join-Path $ProvidersDir $Provider) 'normalized'
  New-Item -ItemType Directory -Force -Path $normalizedDir | Out-Null
  $sourceStatusPath = ".spec-first/providers/$Provider/status.json"

  if ($Provider -eq 'gitnexus') {
    $attemptLogs = @($QueryProbeAttempts | ForEach-Object { $_.raw_log })
    $sourceRawLogs = @('.spec-first/providers/gitnexus/raw/analyze.log', '.spec-first/providers/gitnexus/raw/status.log')
    if ($attemptLogs.Count -gt 0) {
      $sourceRawLogs += $attemptLogs
    } else {
      $sourceRawLogs += '.spec-first/providers/gitnexus/raw/query.log'
    }
    $winningLogs = @($QueryProbeAttempts | Where-Object { $_.result_class -eq 'process-results' } | Select-Object -First 1 | ForEach-Object { $_.raw_log })
    $winningQueryProbeLog = if ($winningLogs.Count -gt 0) { $winningLogs[0] } else { $null }
    $availableQuerySurfaces = if ($QueryReady) { @('status', 'query') } else { @() }
    $confidence = if ($QueryReady) { 'high' } else { 'low' }
    $limitations = if ($QueryReady) { @() } else { @('Provider query readiness is not verified.') }
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
        capabilities = @('architecture_map', 'dependency_map', 'execution_flow', 'repo_wiki', 'query_global_graph')
        confidence = $confidence
        limitations = $limitations
      }
      Write-JsonFileAtomic -Path (Join-Path $normalizedDir "$artifact.json") -Payload ([pscustomobject]$payload) -Depth 20
    }
  } else {
    $availableQuerySurfaces = if ($QueryReady) { @('status', 'query_graph_tool', 'get_impact_radius_tool') } else { @() }
    $confidence = if ($QueryReady) { 'medium' } else { 'low' }
    $limitations = if ($QueryReady) { @('code-review-graph query-surface proof is conservative and should be treated as provider readiness, not semantic evidence.') } else { @('Provider query readiness is not verified.') }
    $payload = [ordered]@{
      schema_version = 'provider-normalized-envelope.v1'
      provider = $Provider
      generated_at = $BootstrappedAt
      source_status_path = $sourceStatusPath
      source_raw_logs = @('.spec-first/providers/code-review-graph/raw/build.log', '.spec-first/providers/code-review-graph/raw/status.log', '.spec-first/providers/code-review-graph/raw/query.log')
      available_query_surfaces = $availableQuerySurfaces
      capabilities = @('detect_changes', 'blast_radius', 'minimal_context', 'review_context', 'related_tests', 'graph_stats')
      confidence = $confidence
      limitations = $limitations
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
$resolverOverride = [Environment]::GetEnvironmentVariable('SPEC_FIRST_PROJECT_TARGET_RESOLVER')
if ([string]::IsNullOrWhiteSpace($resolverOverride)) {
  $resolverPath = Join-Path (Split-Path -Parent (Split-Path -Parent $scriptDir)) 'spec-mcp-setup/scripts/resolve-project-target.ps1'
} else {
  $resolverPath = $resolverOverride
}
$resolverParams = @{ Format = 'json' }
if (-not [string]::IsNullOrWhiteSpace($Repo)) { $resolverParams.Repo = $Repo }
$targetFacts = (& $resolverPath @resolverParams) | ConvertFrom-Json
if ($AllRepos) {
  Write-WorkspaceGraphBootstrapSummaryAndExit -TargetFacts $targetFacts -SelectionSource 'explicit-all-repos'
}
$targetCandidates = @($targetFacts.candidates)
if (-not $AllRepos -and [string]::IsNullOrWhiteSpace($Repo) -and $targetFacts.mode -ne 'git-repo' -and $targetCandidates.Count -gt 0) {
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
  if (-not (Test-QueryProbePolicySupported -ProviderConfig $providerConfig -Provider $property.Name)) {
    Write-ResultAndExit -WorkflowMode 'blocked' -ReasonCode 'unsupported-provider-command' -NextAction "Provider query probe policy is unsupported for $($property.Name)."
  }
}

$bootstrappedAt = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
$sourceRevisionOutput = @(git -C $repoRoot rev-parse --verify 'HEAD^{commit}' 2>$null)
if ($LASTEXITCODE -ne 0 -or $sourceRevisionOutput.Count -eq 0 -or [string]::IsNullOrWhiteSpace([string]$sourceRevisionOutput[0])) {
  Write-ResultAndExit -WorkflowMode 'blocked' -ReasonCode 'repo-snapshot-unavailable' -NextAction 'Resolve git repository state before graph bootstrap.'
}
$sourceRevision = [string]$sourceRevisionOutput[0]
$worktreeStatus = (git -C $repoRoot status --porcelain 2>$null) -join "`n"
$worktreeDirty = -not [string]::IsNullOrWhiteSpace($worktreeStatus)
$worktreeStatusHash = Get-StatusHash -Text $worktreeStatus
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
  $queryProbeAttempts = New-Object System.Collections.Generic.List[object]
  $queryProbeCandidatesTruncated = $false
  $queryProbeExpectedHit = $true

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
              $verified = Test-QueryProbeVerified -Provider $provider -CommandResult $queryProbe -LogPath $candidateLog
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
            if ($verified) {
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
            }
          }
        } else {
          $queryProbe = Invoke-ConfiguredCommand -ProviderConfig $providerConfig -Provider $provider -Kind 'query_probe' -LogPath $queryLog -RepoRoot $repoRoot
          $commandResults.Add($queryProbe)
          if ($queryProbe.exit_code -eq 0 -and (Test-QueryProbeVerified -Provider $provider -CommandResult $queryProbe -LogPath $queryLog)) {
            $queryReady = $true
          }
        }
        if ($queryReady) {
          $status = 'ready'
          $confidence = 'high'
          $limitations = @()
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
      $failureInfo = Get-ProviderFailureInfo -Provider $provider -Phase 'bootstrap' -ExitCode ([int]$bootstrap.exit_code) -Diagnostic ([string]$bootstrap.diagnostic)
      $limitations = @('Provider bootstrap command failed.')
      if (-not [string]::IsNullOrWhiteSpace([string]$failureInfo['recommended_action'])) {
        $limitations += [string]$failureInfo['recommended_action']
      }
    }
  }

  $statusPath = Join-Path $providerDir 'status.json'
  Write-NormalizedArtifacts -Provider $provider -StatusPath $statusPath -QueryReady $queryReady -BootstrappedAt $bootstrappedAt -ProvidersDir $providersDir -QueryProbeAttempts @($queryProbeAttempts)
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
    query_verification_reason = if (($status -eq 'query-unverified' -or $status -eq 'query-not-applicable') -and $limitations.Count -gt 0) { $limitations[$limitations.Count - 1] } else { $null }
    query_probe_policy = if ($entry.PSObject.Properties.Name -contains 'query_probe_policy') { $entry.query_probe_policy } else { $null }
    query_probe_candidate_limit = if ($provider -eq 'gitnexus') { $script:GitNexusQueryProbeCandidateLimit } else { $null }
    query_probe_candidates_truncated = if ($provider -eq 'gitnexus') { $queryProbeCandidatesTruncated } else { $null }
    repo_snapshot = [ordered]@{
      source_revision = $sourceRevision
      worktree_dirty = $worktreeDirty
    }
    command_results = @($commandResults)
    query_probe_attempts = if ($provider -eq 'gitnexus') { @($queryProbeAttempts) } else { $null }
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
$notApplicableCount = @($providerStatuses | Where-Object { $_.status -eq 'query-not-applicable' }).Count
$blockingNotReadyCount = @($providerStatuses | Where-Object { -not $_.query_ready -and $_.status -ne 'query-not-applicable' -and $_.status -ne 'skipped' }).Count
$fallbackReady = [bool](@($runtimeCapabilities.fallback_capabilities.PSObject.Properties | Where-Object { $_.Value.support_level -ne 'none' }).Count)
if ($providerCount -gt 0 -and $readyCount -eq $providerCount) {
  $workflowMode = 'primary'
  $overallStatus = 'ready'
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

$providerAggregate = [ordered]@{
  schema_version = 'graph-provider-status.v1'
  generated_at = $bootstrappedAt
  workflow_mode = $workflowMode
  ready_primary_providers = @($providerStatuses | Where-Object { $_.query_ready } | ForEach-Object { $_.provider })
  failed_primary_providers = @($providerStatuses | Where-Object { -not $_.query_ready -and $_.status -ne 'skipped' -and $_.status -ne 'query-not-applicable' } | ForEach-Object { $_.provider })
  not_applicable_providers = @($providerStatuses | Where-Object { $_.status -eq 'query-not-applicable' } | ForEach-Object { $_.provider })
  skipped_primary_providers = @($providerStatuses | Where-Object { $_.status -eq 'skipped' } | ForEach-Object { $_.provider })
  partial_primary_available = ($readyCount -gt 0)
  providers = @($providerStatuses)
  confidence = if ($workflowMode -eq 'primary') { 'high' } elseif ($workflowMode -eq 'degraded-fallback' -or $workflowMode -eq 'no-source') { 'medium' } else { 'low' }
  limitations = if ($workflowMode -eq 'primary') { @() } elseif ($workflowMode -eq 'degraded-fallback') { @('One or more primary graph providers are unavailable or query-unverified; fallback capabilities are required.') } elseif ($workflowMode -eq 'no-source') { @('No source-derived GitNexus process query target is available for this repo.') } else { @('No query-ready graph provider or fallback capability is available.') }
}
Write-JsonFileAtomic -Path (Join-Path $graphDir 'provider-status.json') -Payload ([pscustomobject]$providerAggregate) -Depth 30

$graphFacts = [ordered]@{
  schema_version = 'graph-facts.v1'
  generated_at = $bootstrappedAt
  repo_root = $repoRoot
  source_revision = $sourceRevision
  worktree_dirty = $worktreeDirty
  worktree_status_hash = $worktreeStatusHash
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
    query_global_graph = (@($providerStatuses | Where-Object { $_.provider -eq 'gitnexus' -and $_.query_ready }).Count -gt 0)
    impact_context = (@($providerStatuses | Where-Object { $_.provider -eq 'code-review-graph' -and $_.query_ready }).Count -gt 0)
  }
  staleness_hints = [ordered]@{
    compare_source_revision = $true
    compare_worktree_dirty = $true
    worktree_status_hash = $worktreeStatusHash
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
  "| $($_.provider) | $($_.graph_ready) | $($_.query_ready) | $token | $($_.status) | $reason |"
})

Write-TextFileAtomic -Path (Join-Path $graphDir 'bootstrap-report.md') -Value @"
# Graph Bootstrap Report

- workflow_mode: $workflowMode
- overall_status: $overallStatus
- source_revision: $sourceRevision
- worktree_dirty: $worktreeDirty
- provider_status: .spec-first/graph/provider-status.json
- graph_facts: .spec-first/graph/graph-facts.json
- impact_capabilities: .spec-first/impact/bootstrap-impact-capabilities.json

| Provider | Graph Ready | Query Ready | Probe Token | Evidence | Query Verification Reason |
| --- | --- | --- | --- | --- | --- |
$($providerReportRows -join [Environment]::NewLine)
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
