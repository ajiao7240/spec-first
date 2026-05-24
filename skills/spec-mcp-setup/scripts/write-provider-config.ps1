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
. (Join-Path $scriptDir 'lib-template.ps1')
$toolsJsonPath = Join-Path $skillDir 'mcp-tools.json'
$toolsJson = Read-McpToolsJson -Path $toolsJsonPath
Assert-McpToolsSchemaVersion -ToolsJson $toolsJson

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

function Test-SymlinkPath {
  param([string]$CandidatePath)
  if ([string]::IsNullOrWhiteSpace($CandidatePath)) { return $false }
  $item = Get-Item -LiteralPath $CandidatePath -Force -ErrorAction SilentlyContinue
  return ($null -ne $item -and (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0))
}

function Write-ProviderConfigBlocked {
  param([string]$ReasonCode)
  [pscustomobject]@{
    repo_config_status = $ReasonCode
    repo_config_path = $null
    runtime_capabilities_status = $ReasonCode
    runtime_capabilities_path = $null
    provider_artifacts_status = $ReasonCode
    provider_artifacts_path = $null
    graph_bootstrap_required = $true
    reason_code = $ReasonCode
    next_action = 'Replace symlinked .spec-first/config with a real repo-local directory and rerun spec-mcp-setup.'
  } | ConvertTo-Json -Compress
}

$specRoot = Join-Path $repoRoot '.spec-first'
if ((Test-SymlinkPath $specRoot) -or (Test-SymlinkPath $outDir)) {
  Write-ProviderConfigBlocked -ReasonCode 'project-config-symlink-escape'
  return
}
[System.IO.Directory]::CreateDirectory($outDir) | Out-Null
if ((Test-SymlinkPath $specRoot) -or (Test-SymlinkPath $outDir)) {
  Write-ProviderConfigBlocked -ReasonCode 'project-config-symlink-escape'
  return
}

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

function Get-ProviderCommandHashForCommands {
  param([object]$Commands)
  $ordered = [ordered]@{}
  if ($Commands -is [System.Collections.IDictionary]) {
    foreach ($name in @($Commands.Keys | Sort-Object)) {
      $ordered[[string]$name] = @($Commands[$name])
    }
  } else {
    foreach ($property in @($Commands.PSObject.Properties | Where-Object { $_.MemberType -eq 'NoteProperty' } | Sort-Object Name)) {
      $ordered[[string]$property.Name] = @($property.Value)
    }
  }
  return (Get-StatusHash -Text ($ordered | ConvertTo-Json -Depth 20 -Compress))
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

function Normalize-GitNexusRepoName {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return '' }
  $trimmed = $Value.Trim()
  if ($trimmed -match '^[A-Za-z0-9._-]+$') {
    return $trimmed
  }
  return ''
}

function Get-GitNexusRepoNameFromRemoteUrl {
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
  return (Normalize-GitNexusRepoName -Value $name)
}

function Invoke-GitConfigValue {
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

function Get-GitPorcelainStatusText {
  param([string]$RepoRoot)
  try {
    $output = @(git -C $RepoRoot status --porcelain 2>$null)
    if ($LASTEXITCODE -eq 0 -and $null -ne $output) {
      return ($output -join "`n")
    }
  } catch {
  }
  return ''
}

function Get-GitRemoteUrl {
  param([string]$RepoRoot)
  if ($null -eq (Get-Command git -ErrorAction SilentlyContinue)) {
    return ''
  }

  $originUrl = Invoke-GitConfigValue -RepoRoot $RepoRoot -GitArguments @('config', '--get', 'remote.origin.url')
  if (-not [string]::IsNullOrWhiteSpace($originUrl)) {
    return $originUrl
  }

  $currentBranch = Invoke-GitConfigValue -RepoRoot $RepoRoot -GitArguments @('rev-parse', '--abbrev-ref', 'HEAD')
  if (-not [string]::IsNullOrWhiteSpace($currentBranch) -and $currentBranch -ne 'HEAD') {
    $branchRemote = Invoke-GitConfigValue -RepoRoot $RepoRoot -GitArguments @('config', '--get', "branch.$currentBranch.remote")
    if (-not [string]::IsNullOrWhiteSpace($branchRemote)) {
      $branchRemoteUrl = Invoke-GitConfigValue -RepoRoot $RepoRoot -GitArguments @('config', '--get', "remote.$branchRemote.url")
      if (-not [string]::IsNullOrWhiteSpace($branchRemoteUrl)) {
        return $branchRemoteUrl
      }
    }
  }

  try {
    $remoteNames = @(& git -C $RepoRoot remote 2>$null | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
    if ($LASTEXITCODE -eq 0 -and $remoteNames.Count -eq 1) {
      return (Invoke-GitConfigValue -RepoRoot $RepoRoot -GitArguments @('config', '--get', "remote.$($remoteNames[0]).url"))
    }
  } catch {
  }
  return ''
}

function Get-GitNexusRepoNameCandidate {
  param(
    [object]$Object,
    [string]$PropertyName
  )
  if ($null -eq $Object -or -not ($Object.PSObject.Properties.Name -contains $PropertyName)) {
    return ''
  }
  return (Normalize-GitNexusRepoName -Value ([string]$Object.PSObject.Properties[$PropertyName].Value))
}

function Get-GitNexusRepoName {
  param(
    [string]$RepoRoot,
    [object]$Facts
  )

  $candidates = @()
  $candidates += Get-GitNexusRepoNameCandidate -Object $Facts -PropertyName 'gitnexus_repo_name'
  if ($null -ne $Facts -and $Facts.PSObject.Properties.Name -contains 'gitnexus') {
    $candidates += Get-GitNexusRepoNameCandidate -Object $Facts.gitnexus -PropertyName 'repo_name'
    $candidates += Get-GitNexusRepoNameCandidate -Object $Facts.gitnexus -PropertyName 'repository_name'
  }
  if ($null -ne $Facts -and $Facts.PSObject.Properties.Name -contains 'graph_providers' -and $null -ne $Facts.graph_providers -and $Facts.graph_providers.PSObject.Properties.Name -contains 'gitnexus') {
    $candidates += Get-GitNexusRepoNameCandidate -Object $Facts.graph_providers.gitnexus -PropertyName 'repo_name'
    $candidates += Get-GitNexusRepoNameCandidate -Object $Facts.graph_providers.gitnexus -PropertyName 'repository_name'
  }
  if ($null -ne $Facts -and $Facts.PSObject.Properties.Name -contains 'target') {
    $candidates += Get-GitNexusRepoNameCandidate -Object $Facts.target -PropertyName 'gitnexus_repo_name'
  }
  foreach ($candidate in $candidates) {
    if (-not [string]::IsNullOrWhiteSpace($candidate)) {
      return $candidate
    }
  }

  $metaPath = Join-Path $RepoRoot '.gitnexus/meta.json'
  if (Test-Path -LiteralPath $metaPath -PathType Leaf) {
    try {
      $meta = Get-Content -Raw $metaPath | ConvertFrom-Json
      if ($meta.PSObject.Properties.Name -contains 'remoteUrl') {
        $remoteRepoName = Get-GitNexusRepoNameFromRemoteUrl -RemoteUrl ([string]$meta.remoteUrl)
        if (-not [string]::IsNullOrWhiteSpace($remoteRepoName)) {
          return $remoteRepoName
        }
      }
    } catch {
    }
  }

  $gitRemoteRepoName = Get-GitNexusRepoNameFromRemoteUrl -RemoteUrl (Get-GitRemoteUrl -RepoRoot $RepoRoot)
  if (-not [string]::IsNullOrWhiteSpace($gitRemoteRepoName)) {
    return $gitRemoteRepoName
  }

  $fallback = Normalize-GitNexusRepoName -Value (Split-Path -Leaf $RepoRoot)
  if (-not [string]::IsNullOrWhiteSpace($fallback)) {
    return $fallback
  }
  return (Split-Path -Leaf $RepoRoot)
}

function Get-ProviderCommands {
  param(
    [string]$Provider,
    [string]$RepoRoot,
    [string]$GitNexusPackageSpec,
    [string]$CodeReviewGraphPackageSpec,
    [object]$GitNexusQueryProbePolicy,
    [string]$GitNexusRepoName
  )
  if ($Provider -eq 'gitnexus') {
    return [ordered]@{
      bootstrap = @('npx', '-y', $GitNexusPackageSpec, 'analyze', '--force', '--skip-agents-md', '--no-stats')
      incremental = @('npx', '-y', $GitNexusPackageSpec, 'analyze', '--skip-agents-md', '--no-stats')
      status = @('npx', '-y', $GitNexusPackageSpec, 'status')
      query_probe = @('npx', '-y', $GitNexusPackageSpec, 'query', [string]$GitNexusQueryProbePolicy.token, '--repo', $GitNexusRepoName)
    }
  }
  if ($Provider -eq 'code-review-graph') {
    return [ordered]@{
      bootstrap = @('uvx', $CodeReviewGraphPackageSpec, 'build')
      incremental = @('uvx', $CodeReviewGraphPackageSpec, 'update', '--base', '__SPEC_FIRST_LAST_INDEXED_COMMIT__')
      status = @('uvx', $CodeReviewGraphPackageSpec, 'status')
      query_probe = @('uvx', $CodeReviewGraphPackageSpec, 'status', '--repo', $RepoRoot)
    }
  }
  return [ordered]@{}
}

function Test-GitNexusProbePathExcluded {
  param([string]$Path)
  return ($Path -match '(^|/)(\.spec-first|\.gitnexus|\.code-review-graph|\.agents|\.codex|\.claude|node_modules|vendor|build|cache|runtime|generated|\.gradle|test|tests|androidTest)(/|$)' -or
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

function Test-GitNexusProbeLowSignalToken {
  param([string]$Token)
  return ($Token -match '^(app|App|index|Index|main|Main|postinstall|preinstall|install|setup|config|constants|types|utils|helpers|test|spec)$' -or
    $Token -match '(Config|Types?|Schema|Constants?)$' -or
    $Token -match '_(config|types?|schema|constants?)$')
}

function Test-GitNexusProbeWorkflowSignalToken {
  param([string]$Token)
  return ($Token -match '(Activity|Fragment|ViewModel|Manager|Repository|Service|Controller|Handler|Form|Table|Page|Dashboard|Assessment|Questionnaire|Users|Relations|Login)$')
}

function Test-GitNexusProbeEntrySignalToken {
  param([string]$Token)
  return ($Token -match '^(MainActivity|Launcher|Launch[A-Za-z0-9_]*|Loading[A-Za-z0-9_]*|Home[A-Za-z0-9_]*|Login[A-Za-z0-9_]*)$' -or
    $Token -match '(Router|Navigator|Navigation|Redirect)[A-Za-z0-9_]*$')
}

function Test-GitNexusProbeWeakProofToken {
  param([string]$Token)
  return ($Token -match '^(Ad|Ads)$' -or
    $Token -match '^(Advertise|Advertisement|Splash|Guide|Intro|Onboarding)[A-Za-z0-9_]*' -or
    $Token -match '(Dialog|Adapter|Bean|DTO|Dto|VO|PO|Entity)$')
}

function Test-GitNexusProbeInfrastructureToken {
  param([string]$Token)
  return ($Token -match '^(Health|Ping|Actuator|Status|Info|Error|Metrics)[A-Za-z0-9_]*$' -or
    $Token -match '(Health|Ping|Actuator|Status|Info|Error|Metrics)(Controller|Endpoint|Handler|Service|Page|View|Route|Router)$')
}

function Test-GitNexusProbeDisplaySignalToken {
  param([string]$Token)
  return ($Token -match '(View|Screen|Layout|Modal|Report)$')
}

function Test-GitNexusProbeMethodSignalToken {
  param([string]$Token)
  return ($Token -match '^(step[A-Za-z0-9_]*|validate[A-Za-z0-9_]*|parse[A-Za-z0-9_]*|booleanResult|isSuccess|success|failure|options|bootstrap|start|submit|resubmit|create[A-Za-z0-9_]*|cancel[A-Za-z0-9_]*|add[A-Za-z0-9_]*|save[A-Za-z0-9_]*|delete[A-Za-z0-9_]*|update[A-Za-z0-9_]*|upload[A-Za-z0-9_]*|download[A-Za-z0-9_]*|handle[A-Za-z0-9_]*|process[A-Za-z0-9_]*)$')
}

function Test-GitNexusProbeLowSignalMethodToken {
  param([string]$Token)
  return ($Token -match '^(get|set|is|has|toString|equals|hashCode|query[A-Za-z0-9_]*|list[A-Za-z0-9_]*|resolve[A-Za-z0-9_]*|build[A-Za-z0-9_]*|convert[A-Za-z0-9_]*|map[A-Za-z0-9_]*)$')
}

function Get-GitNexusProbeMethodTokensFromPath {
  param(
    [string]$RepoRoot,
    [string]$Path
  )
  $fullPath = Join-Path $RepoRoot $Path
  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { return @() }
  $item = Get-Item -LiteralPath $fullPath -ErrorAction SilentlyContinue
  if ($null -eq $item -or $item.Length -gt $script:gitNexusQueryProbeSourceFileLimitBytes) { return @() }

  $tokens = New-Object System.Collections.Generic.List[string]
  foreach ($line in Get-Content -LiteralPath $fullPath -ErrorAction SilentlyContinue) {
    if ($line -notmatch '\(') { continue }
    $candidateLine = ($line -replace '//.*$', '').Trim()
    if ($candidateLine -match '^(if|for|while|switch|catch|return|throw|new)\s*\(') { continue }
    if ($candidateLine -match '=>') { continue }
    $before = ($candidateLine -replace '\(.*$', '').Trim()
    if ([string]::IsNullOrWhiteSpace($before)) { continue }
    $parts = @($before -split '\s+' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($parts.Count -eq 0) { continue }
    $token = [string]$parts[$parts.Count - 1]
    if ($token -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { continue }
    if ($token -match '^(if|for|while|switch|catch|return|throw|new|class|interface|enum)$') { continue }
    if (-not (Test-GitNexusProbeMethodSignalToken -Token $token)) { continue }
    if (Test-GitNexusProbeLowSignalMethodToken -Token $token) { continue }
    if (@($tokens | Where-Object { $_ -eq $token }).Count -gt 0) { continue }
    $tokens.Add($token) | Out-Null
  }
  return $tokens.ToArray()
}

function Get-GitNexusQueryProbePolicy {
  param([string]$RepoRoot)
  $files = @()
  $candidateLimit = if (Get-Variable -Name gitNexusQueryProbeCandidateLimit -Scope Script -ErrorAction SilentlyContinue) { $script:gitNexusQueryProbeCandidateLimit } else { 5 }
  $candidates = New-Object System.Collections.Generic.List[object]
  try {
    $files = @(git -C $RepoRoot ls-files 2>$null)
  } catch {
    $files = @()
  }

  foreach ($priority in @('entrypoint_named', 'workflow_method', 'src_method', 'workflow_named', 'src_high_signal', 'high_signal', 'android_named', 'workflow_display_named', 'any_source')) {
    foreach ($path in $files) {
      if (Test-GitNexusProbePathExcluded -Path $path) { continue }
      if (-not (Test-GitNexusProbeSourcePath -Path $path)) { continue }
      $token = Get-GitNexusProbeTokenFromPath -Path $path
      if ([string]::IsNullOrWhiteSpace($token)) { continue }
      if ($priority -eq 'entrypoint_named') {
        if (-not (Test-GitNexusProbeEntrySignalToken -Token $token)) { continue }
      } elseif ($priority -eq 'workflow_method') {
        if (-not (Test-GitNexusProbeWorkflowSignalToken -Token $token)) { continue }
        if (Test-GitNexusProbeInfrastructureToken -Token $token) { continue }
        if (Test-GitNexusProbeWeakProofToken -Token $token) { continue }
        foreach ($methodToken in @(Get-GitNexusProbeMethodTokensFromPath -RepoRoot $RepoRoot -Path $path)) {
          if (@($candidates | Where-Object { $_.token -eq $methodToken }).Count -gt 0) { continue }
          $candidates.Add([pscustomobject][ordered]@{
            token = $methodToken
            selected_from = $path
            reason_code = $priority
          }) | Out-Null
          if ($candidates.Count -ge $candidateLimit) { break }
        }
        if ($candidates.Count -ge $candidateLimit) { break }
        continue
      } elseif ($priority -eq 'src_method') {
        if ($path -notmatch '(^|/)src/') { continue }
        if (Test-GitNexusProbeInfrastructureToken -Token $token) { continue }
        if (Test-GitNexusProbeWeakProofToken -Token $token) { continue }
        foreach ($methodToken in @(Get-GitNexusProbeMethodTokensFromPath -RepoRoot $RepoRoot -Path $path)) {
          if (@($candidates | Where-Object { $_.token -eq $methodToken }).Count -gt 0) { continue }
          $candidates.Add([pscustomobject][ordered]@{
            token = $methodToken
            selected_from = $path
            reason_code = $priority
          }) | Out-Null
          if ($candidates.Count -ge $candidateLimit) { break }
        }
        if ($candidates.Count -ge $candidateLimit) { break }
        continue
      } elseif ($priority -eq 'android_named') {
        if ($path -notmatch '\.(kt|java)$') { continue }
        if ($token -notmatch '(Activity|Fragment|ViewModel|Manager|Repository|Service)$') { continue }
        if (Test-GitNexusProbeLowSignalToken -Token $token) { continue }
        if (Test-GitNexusProbeInfrastructureToken -Token $token) { continue }
        if (Test-GitNexusProbeDisplaySignalToken -Token $token) { continue }
        if (Test-GitNexusProbeWeakProofToken -Token $token) { continue }
      } elseif ($priority -eq 'workflow_named') {
        if (-not (Test-GitNexusProbeWorkflowSignalToken -Token $token)) { continue }
        if (Test-GitNexusProbeInfrastructureToken -Token $token) { continue }
        if (Test-GitNexusProbeWeakProofToken -Token $token) { continue }
      } elseif ($priority -eq 'src_high_signal') {
        if ($path -notmatch '(^|/)src/') { continue }
        if (Test-GitNexusProbeLowSignalToken -Token $token) { continue }
        if (Test-GitNexusProbeInfrastructureToken -Token $token) { continue }
        if (Test-GitNexusProbeDisplaySignalToken -Token $token) { continue }
        if (Test-GitNexusProbeWeakProofToken -Token $token) { continue }
      } elseif ($priority -eq 'high_signal') {
        if (Test-GitNexusProbeLowSignalToken -Token $token) { continue }
        if (Test-GitNexusProbeInfrastructureToken -Token $token) { continue }
        if (Test-GitNexusProbeDisplaySignalToken -Token $token) { continue }
        if (Test-GitNexusProbeWeakProofToken -Token $token) { continue }
      } elseif ($priority -eq 'workflow_display_named') {
        if (-not (Test-GitNexusProbeDisplaySignalToken -Token $token)) { continue }
      }

      if (@($candidates | Where-Object { $_.token -eq $token }).Count -gt 0) { continue }
      $candidates.Add([pscustomobject][ordered]@{
        token = $token
        selected_from = $path
        reason_code = $priority
      }) | Out-Null
      if ($candidates.Count -ge $candidateLimit) {
        break
      }
    }
    if ($candidates.Count -ge $candidateLimit) {
      break
    }
  }

  if ($candidates.Count -gt 0) {
    $first = $candidates[0]
    $source = if ([string]$first.reason_code -match '_method$') { 'git-ls-files-source-symbol' } else { 'git-ls-files-code-basename' }
    return [ordered]@{
      expected_hit = $true
      source = $source
      token = [string]$first.token
      selected_from = [string]$first.selected_from
      candidates = @($candidates.ToArray())
    }
  }

  return [ordered]@{
    expected_hit = $false
    source = 'fallback-static'
    token = 'main src build README package'
    selected_from = $null
    candidates = @([pscustomobject][ordered]@{
      token = 'main src build README package'
      selected_from = $null
      reason_code = 'fallback-static'
    })
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

function Test-CanonicalProviderFreshForCurrent {
  param(
    [object]$CanonicalProviderStatus,
    [string]$Provider,
    [string]$CurrentPackageSpec,
    [string]$CurrentCommandHash
  )
  if ($null -eq $CanonicalProviderStatus -or $null -eq $CanonicalProviderStatus.providers) {
    return $false
  }
  $matches = @($CanonicalProviderStatus.providers | Where-Object { $_.provider -eq $Provider } | Select-Object -First 1)
  if ($matches.Count -le 0) {
    return $false
  }
  $status = $matches[0]
  if ($null -eq $status.bootstrap_fingerprint -or $null -eq $status.bootstrap_fingerprint.provider) {
    return $false
  }
  $fingerprint = $status.bootstrap_fingerprint.provider
  return (
    -not [string]::IsNullOrWhiteSpace($CurrentPackageSpec) -and
    -not [string]::IsNullOrWhiteSpace($CurrentCommandHash) -and
    [string]$fingerprint.version_policy -eq 'pinned' -and
    [string]$fingerprint.configured_package_spec -eq $CurrentPackageSpec -and
    [string]$fingerprint.bundled_package_spec -eq $CurrentPackageSpec -and
    [string]$fingerprint.command_hash -eq $CurrentCommandHash
  )
}

function Test-ProviderReady {
  param([object]$Provider)
  $hostReady = (
    $Provider.host_config_status -eq 'ready' -or
    $Provider.host_config_status -eq 'fallback-active' -or
    (
      $Provider.PSObject.Properties.Name -contains 'host_config_required' -and
      -not [bool]$Provider.host_config_required -and
      $Provider.host_config_status -eq 'not-required'
    )
  )
  return (
    [bool]$Provider.configured -and
    [bool]$Provider.enabled_for_bootstrap -and
    $Provider.dependency_status -eq 'ready' -and
    $hostReady
  )
}

function Test-ProviderHostReady {
  param([object]$Provider)
  if ($null -eq $Provider) { return $false }
  return (
    $Provider.host_config_status -eq 'ready' -or
    $Provider.host_config_status -eq 'fallback-active' -or
    (
      $Provider.PSObject.Properties.Name -contains 'host_config_required' -and
      -not [bool]$Provider.host_config_required -and
      $Provider.host_config_status -eq 'not-required'
    )
  )
}

function Get-NativeCapabilityStatus {
  param(
    [object]$Provider,
    [object]$Metadata
  )
  if ($null -eq $Provider) { return 'unknown' }
  if (-not [bool]$Provider.configured) { return 'unavailable' }
  if (-not [bool]$Provider.enabled_for_bootstrap) { return 'unavailable' }
  if ([string]::IsNullOrWhiteSpace([string]$Provider.dependency_status) -or [string]$Provider.dependency_status -eq 'unknown') { return 'unknown' }
  if ([string]$Provider.dependency_status -ne 'ready') { return 'unavailable' }
  if ([string]::IsNullOrWhiteSpace([string]$Provider.host_config_status) -or [string]$Provider.host_config_status -eq 'unknown') { return 'unknown' }
  if (-not (Test-ProviderHostReady -Provider $Provider)) { return 'unavailable' }
  if (
    $null -ne $Metadata -and
    $Metadata.PSObject.Properties.Name -contains 'mutation_boundary' -and
    ([string]$Metadata.mutation_boundary -eq 'mutation-gated' -or [string]$Metadata.mutation_boundary -eq 'policy-blocked')
  ) { return 'mutation-gated' }
  return 'available'
}

function Get-NativeCapabilitySourceTags {
  param(
    [object]$Metadata
  )
  $tags = New-Object System.Collections.Generic.List[string]
  $allowedRegistryTags = @('checked-in-baseline', 'provider-pin')
  if ($null -eq $Metadata -or -not ($Metadata.PSObject.Properties.Name -contains 'source_tags')) {
    throw 'invalid_gitnexus_source_tags:missing-field'
  }
  $sourceTagsValue = $Metadata.PSObject.Properties['source_tags'].Value
  if ($sourceTagsValue -is [string] -or -not ($sourceTagsValue -is [System.Collections.IEnumerable])) {
    throw 'invalid_gitnexus_source_tags:not-array'
  }
  $baselineTags = @($sourceTagsValue)
  foreach ($tag in @($baselineTags)) {
    $tagValue = [string]$tag
    if ([string]::IsNullOrWhiteSpace($tagValue) -or -not ($allowedRegistryTags -contains $tagValue)) {
      throw "invalid_gitnexus_source_tag:$tagValue"
    }
    if (-not [string]::IsNullOrWhiteSpace($tagValue) -and -not $tags.Contains($tagValue)) {
      $tags.Add($tagValue) | Out-Null
    }
  }
  if (-not $tags.Contains('checked-in-baseline') -or -not $tags.Contains('provider-pin')) {
    throw 'invalid_gitnexus_source_tags:missing-baseline'
  }
  if (-not $tags.Contains('setup-projection')) {
    $tags.Add('setup-projection') | Out-Null
  }
  return $tags.ToArray()
}

function Get-NativeCapabilityArrayField {
  param(
    [object]$Metadata,
    [string]$FieldName
  )
  if ($null -eq $Metadata -or -not ($Metadata.PSObject.Properties.Name -contains $FieldName)) {
    throw ('invalid_gitnexus_{0}:missing-field' -f $FieldName)
  }
  $fieldValue = $Metadata.PSObject.Properties[$FieldName].Value
  if ($fieldValue -is [string] -or -not ($fieldValue -is [System.Collections.IEnumerable])) {
    throw ('invalid_gitnexus_{0}:not-array' -f $FieldName)
  }
  foreach ($entry in @($fieldValue)) {
    if ($entry -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$entry)) {
      throw ('invalid_gitnexus_{0}:invalid-entry' -f $FieldName)
    }
  }
  return @($fieldValue)
}

function Get-NativeCapabilityStringField {
  param(
    [object]$Metadata,
    [string]$FieldName
  )
  if ($null -eq $Metadata -or -not ($Metadata.PSObject.Properties.Name -contains $FieldName)) {
    throw ('invalid_gitnexus_{0}:missing-field' -f $FieldName)
  }
  $fieldValue = $Metadata.PSObject.Properties[$FieldName].Value
  if ($fieldValue -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$fieldValue)) {
    throw ('invalid_gitnexus_{0}:invalid-entry' -f $FieldName)
  }
  return [string]$fieldValue
}

function Get-NativeCapabilityMutationBoundary {
  param(
    [object]$Metadata
  )
  if ($null -eq $Metadata -or -not ($Metadata.PSObject.Properties.Name -contains 'mutation_boundary')) {
    throw 'invalid_gitnexus_mutation_boundary:missing-field'
  }
  $boundary = [string]$Metadata.mutation_boundary
  $allowedBoundaries = @('read-only', 'mutation-gated', 'policy-blocked', 'unknown')
  if (-not ($allowedBoundaries -contains $boundary)) {
    throw "invalid_gitnexus_mutation_boundary:$boundary"
  }
  return $boundary
}

function Get-NativeCapabilitySourceProvenance {
  param(
    [object]$Provider,
    [string]$Status
  )
  if ($null -eq $Provider) { return 'registry-only' }
  if (($Status -eq 'available' -or $Status -eq 'mutation-gated') -and (Test-ProviderReady -Provider $Provider)) { return 'configured-and-detected' }
  if ([bool]$Provider.configured) { return 'configured-not-verified' }
  return 'registry-only'
}

function Get-NativeCapabilityLimitations {
  param(
    [object]$Provider,
    [object]$Metadata,
    [string]$Status
  )
  $limitations = New-Object System.Collections.Generic.List[string]
  if ($Status -eq 'unknown') {
    $limitations.Add('setup-inferred unknown: deterministic setup facts are incomplete for this capability.') | Out-Null
  }
  if ($Status -eq 'unavailable') {
    $limitations.Add('setup-inferred unavailable: GitNexus host config or dependency prerequisites are not ready for this capability.') | Out-Null
  }
  if ($null -ne $Metadata -and $Metadata.PSObject.Properties.Name -contains 'mutation_boundary' -and [string]$Metadata.mutation_boundary -eq 'policy-blocked') {
    $limitations.Add('setup-inferred availability only; policy-blocked surfaces such as group_sync, group creation, or rename-like mutations must not run in setup or Plan.') | Out-Null
  }
  return $limitations.ToArray()
}

function Get-GitNexusNativeCapabilityProjection {
  param(
    [object]$Provider,
    [object]$RegistryCapabilities
  )
  $projection = [ordered]@{}
  if ($null -eq $RegistryCapabilities) { return $projection }
  foreach ($property in @($RegistryCapabilities.PSObject.Properties)) {
    $metadata = $property.Value
    if ($null -ne $metadata -and $metadata.PSObject.Properties.Name -contains 'native_surfaces') {
      throw 'invalid_gitnexus_native_surfaces:retired-field'
    }
    $meaning = Get-NativeCapabilityStringField -Metadata $metadata -FieldName 'meaning'
    $fallbackPosture = Get-NativeCapabilityStringField -Metadata $metadata -FieldName 'fallback_posture'
    $tools = @(Get-NativeCapabilityArrayField -Metadata $metadata -FieldName 'native_tools')
    $resources = @(Get-NativeCapabilityArrayField -Metadata $metadata -FieldName 'native_resources')
    if ((@($tools).Count + @($resources).Count) -eq 0) {
      throw 'invalid_gitnexus_native_capability:no-surfaces'
    }
    $mutationBoundary = Get-NativeCapabilityMutationBoundary -Metadata $metadata
    $statusMetadata = [pscustomobject]@{
      mutation_boundary = $mutationBoundary
      meaning = $meaning
      fallback_posture = $fallbackPosture
    }
    $status = Get-NativeCapabilityStatus -Provider $Provider -Metadata $statusMetadata
    $projection[$property.Name] = [ordered]@{
      status = $status
      source_tags = @(Get-NativeCapabilitySourceTags -Metadata $metadata)
      source_provenance = Get-NativeCapabilitySourceProvenance -Provider $Provider -Status $status
      native_tools = @($tools)
      native_resources = @($resources)
      mutation_boundary = $mutationBoundary
      limitations = @(Get-NativeCapabilityLimitations -Provider $Provider -Metadata $metadata -Status $status)
    }
  }
  return $projection
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
    $dir = Split-Path -Parent $Path
    if ((Test-SymlinkPath (Split-Path -Parent $dir)) -or (Test-SymlinkPath $dir) -or (Test-SymlinkPath $Path)) {
      throw 'project-config-symlink-escape'
    }
    [System.IO.Directory]::CreateDirectory($dir) | Out-Null
    if ((Test-SymlinkPath (Split-Path -Parent $dir)) -or (Test-SymlinkPath $dir) -or (Test-SymlinkPath $Path)) {
      throw 'project-config-symlink-escape'
    }
    $tmp = Join-Path $dir ('.{0}.{1}.tmp' -f (Split-Path -Leaf $Path), ([guid]::NewGuid().ToString('N')))
    try {
      $Payload | ConvertTo-Json -Depth 30 | Set-Content -Encoding utf8 -LiteralPath $tmp
      if ((Test-SymlinkPath (Split-Path -Parent $dir)) -or (Test-SymlinkPath $dir) -or (Test-SymlinkPath $Path)) {
        throw 'project-config-symlink-escape'
      }
      Move-Item -Force -LiteralPath $tmp -Destination $Path
    } catch {
      Remove-Item -Force -LiteralPath $tmp -ErrorAction SilentlyContinue
      throw
    }
  }
  return $repoConfigStatus
}

$existingProvider = Read-ExistingJson -Path $providerFile -SchemaVersion 'graph-providers.v1' -RepoRoot $repoRoot
$existingRuntime = Read-ExistingJson -Path $runtimeFile -SchemaVersion 'runtime-capabilities.v1' -RepoRoot $repoRoot
$generatedAt = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
$script:gitNexusQueryProbeCandidateLimit = 5
$script:gitNexusQueryProbeSourceFileLimitBytes = 200000
$gitNexusTool = @($toolsJson.tools | Where-Object { $_.id -eq 'gitnexus' } | Select-Object -First 1)
if ($gitNexusTool.Count -eq 0) {
  throw 'GitNexus tool entry not found in mcp-tools.json'
}
$gitNexusEntry = $gitNexusTool[0]
$gitNexusPackage = if ($null -ne $gitNexusEntry.PSObject.Properties['package']) { [string]$gitNexusEntry.package } else { '' }
$gitNexusVersion = if ($null -ne $gitNexusEntry.PSObject.Properties['version']) { [string]$gitNexusEntry.version } else { '' }
if ([string]::IsNullOrWhiteSpace($gitNexusPackage) -or [string]::IsNullOrWhiteSpace($gitNexusVersion)) {
  throw 'GitNexus package/version fields not found in mcp-tools.json'
}
$gitNexusPackageSpec = "$gitNexusPackage@$gitNexusVersion"
$gitNexusNativeCapabilities = if (
  $null -ne $gitNexusEntry.provider_config -and
  $gitNexusEntry.provider_config.PSObject.Properties.Name -contains 'native_capabilities'
) {
  $gitNexusEntry.provider_config.native_capabilities
} else {
  [pscustomobject]@{}
}
$codeReviewGraphTool = @($toolsJson.tools | Where-Object { $_.id -eq 'code-review-graph' } | Select-Object -First 1)
if ($codeReviewGraphTool.Count -eq 0) {
  throw 'code-review-graph tool entry not found in mcp-tools.json'
}
$codeReviewGraphEntry = $codeReviewGraphTool[0]
$codeReviewGraphPackage = if ($null -ne $codeReviewGraphEntry.PSObject.Properties['package']) { [string]$codeReviewGraphEntry.package } else { '' }
$codeReviewGraphVersion = if ($null -ne $codeReviewGraphEntry.PSObject.Properties['version']) { [string]$codeReviewGraphEntry.version } else { '' }
if ([string]::IsNullOrWhiteSpace($codeReviewGraphPackage) -or [string]::IsNullOrWhiteSpace($codeReviewGraphVersion)) {
  throw 'code-review-graph package/version fields not found in mcp-tools.json'
}
$codeReviewGraphPackageSpec = "$codeReviewGraphPackage@$codeReviewGraphVersion"
$gitNexusQueryProbePolicy = Get-GitNexusQueryProbePolicy -RepoRoot $repoRoot
$gitNexusRepoName = Get-GitNexusRepoName -RepoRoot $repoRoot -Facts $facts
$currentSourceRevision = Invoke-GitConfigValue -RepoRoot $repoRoot -GitArguments @('rev-parse', '--verify', 'HEAD^{commit}')
$currentWorktreeStatus = Get-GitPorcelainStatusText -RepoRoot $repoRoot
$currentWorktreeDirty = -not [string]::IsNullOrWhiteSpace($currentWorktreeStatus)
$currentWorktreeStatusHash = Get-StatusHash -Text $currentWorktreeStatus
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
$canonicalGraphFactsSourceRevision = if ($null -ne $canonicalGraphFacts -and $canonicalGraphFacts.PSObject.Properties.Name -contains 'source_revision') { [string]$canonicalGraphFacts.source_revision } else { '' }
$canonicalGraphFactsWorktreeHash = ''
if ($null -ne $canonicalGraphFacts) {
  if ($canonicalGraphFacts.PSObject.Properties.Name -contains 'worktree_status_hash') {
    $canonicalGraphFactsWorktreeHash = [string]$canonicalGraphFacts.worktree_status_hash
  } elseif (
    ($canonicalGraphFacts.PSObject.Properties.Name -contains 'staleness_hints') -and
    $null -ne $canonicalGraphFacts.staleness_hints -and
    ($canonicalGraphFacts.staleness_hints.PSObject.Properties.Name -contains 'worktree_status_hash')
  ) {
    $canonicalGraphFactsWorktreeHash = [string]$canonicalGraphFacts.staleness_hints.worktree_status_hash
  }
}
$canonicalGraphFactsWorktreeDirtyPresent = $false
$canonicalGraphFactsWorktreeDirty = $false
if ($null -ne $canonicalGraphFacts -and $canonicalGraphFacts.PSObject.Properties.Name -contains 'worktree_dirty') {
  $canonicalGraphFactsWorktreeDirtyPresent = $true
  $canonicalGraphFactsWorktreeDirty = [bool]$canonicalGraphFacts.worktree_dirty
}
$canonicalGraphSourceRevisionCurrent = (
  -not [string]::IsNullOrWhiteSpace($currentSourceRevision) -and
  -not [string]::IsNullOrWhiteSpace($canonicalGraphFactsSourceRevision) -and
  $canonicalGraphFactsSourceRevision -eq $currentSourceRevision
)
$canonicalGraphWorktreeCurrent = (
  -not [string]::IsNullOrWhiteSpace($currentWorktreeStatusHash) -and
  -not [string]::IsNullOrWhiteSpace($canonicalGraphFactsWorktreeHash) -and
  $canonicalGraphFactsWorktreeDirtyPresent -and
  $canonicalGraphFactsWorktreeDirty -eq $currentWorktreeDirty -and
  $canonicalGraphFactsWorktreeHash -eq $currentWorktreeStatusHash
)
$canonicalArtifactsCurrent = $canonicalArtifactsAvailable -and $null -ne $canonicalGraphFacts -and $null -ne $canonicalProviderStatus -and $null -ne $canonicalImpactCapabilities -and $canonicalGraphFactsRepoRoot -eq $repoRoot -and $canonicalGraphSourceRevisionCurrent -and $canonicalGraphWorktreeCurrent
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
  $commands = Get-ProviderCommands -Provider $property.Name -RepoRoot $repoRoot -GitNexusPackageSpec $gitNexusPackageSpec -CodeReviewGraphPackageSpec $codeReviewGraphPackageSpec -GitNexusQueryProbePolicy $gitNexusQueryProbePolicy -GitNexusRepoName $gitNexusRepoName
  $currentPackageSpec = if ($property.Name -eq 'gitnexus') { $gitNexusPackageSpec } elseif ($property.Name -eq 'code-review-graph') { $codeReviewGraphPackageSpec } else { '' }
  $currentCommandHash = Get-ProviderCommandHashForCommands -Commands $commands
  $preserveQueryReady = (
    $ready -and
    $canonicalArtifactsCurrent -and
    (Test-CanonicalProviderFreshForCurrent -CanonicalProviderStatus $canonicalProviderStatus -Provider $property.Name -CurrentPackageSpec $currentPackageSpec -CurrentCommandHash $currentCommandHash) -and
    [bool]$previous.query_ready -and
    -not [bool]$previous.bootstrap_required
  )

  $providers[$property.Name] = [ordered]@{
    configured = [bool]$provider.configured
    enabled_for_bootstrap = [bool]$provider.enabled_for_bootstrap
    required = [bool]$provider.required
    role = $provider.role
    access_mode = if ($provider.PSObject.Properties.Name -contains 'access_mode') { $provider.access_mode } elseif ($provider.PSObject.Properties.Name -contains 'host_config_required' -and -not [bool]$provider.host_config_required) { 'cli_artifact' } else { 'live_mcp' }
    host_config_required = if ($provider.PSObject.Properties.Name -contains 'host_config_required') { [bool]$provider.host_config_required } else { $true }
    mcp_server = if ($provider.PSObject.Properties.Name -contains 'host_config_required' -and -not [bool]$provider.host_config_required) { $null } else { $property.Name }
    dependency_status = $provider.dependency_status
    host_config_status = $provider.host_config_status
    capabilities = @($provider.capabilities)
    commands = $commands
    query_probe_policy = if ($property.Name -eq 'gitnexus') { $gitNexusQueryProbePolicy } else { $null }
    artifacts = Get-ProviderArtifacts -Provider $property.Name
    next_action = if ($ready -and $preserveQueryReady) { '' } elseif ($ready) { 'run spec-graph-bootstrap' } else { 'Fix provider setup and rerun spec-mcp-setup.' }
  }
  if ($property.Name -eq 'gitnexus') {
    $providers[$property.Name]['native_capabilities'] = Get-GitNexusNativeCapabilityProjection -Provider $provider -RegistryCapabilities $gitNexusNativeCapabilities
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
$derivedWorkflowMode = if ($canonicalArtifactsCurrent) {
  if ($graphBootstrapRequired -and $canonicalWorkflowMode -eq 'primary') { 'setup-ready-bootstrap-required' } else { $canonicalWorkflowMode }
} elseif ($graphBootstrapRequired) {
  'setup-ready-bootstrap-required'
} elseif ($null -ne $existingProvider -and $null -ne $existingProvider.derived_readiness -and $existingProvider.derived_readiness.workflow_mode) {
  $existingProvider.derived_readiness.workflow_mode
} else {
  'setup-ready-bootstrap-required'
}
$providerPayload = [ordered]@{
  schema_version = 'graph-providers.v1'
  generated_by = 'spec-mcp-setup'
  generated_at = $generatedAt
  repo_root = $repoRoot
  providers = $providers
  derived_readiness = [ordered]@{
    updated_by = 'spec-mcp-setup'
    updated_at = if ($canonicalArtifactsCurrent) { $canonicalUpdatedAt } elseif ($graphBootstrapRequired) { $null } elseif ($null -ne $existingProvider -and $null -ne $existingProvider.derived_readiness) { $existingProvider.derived_readiness.updated_at } else { $null }
    workflow_mode = $derivedWorkflowMode
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

$helperTools = if ($facts.PSObject.Properties.Name -contains 'helper_tools') { $facts.helper_tools } else { $null }
$helperToolProperties = if ($null -ne $helperTools) { @($helperTools.PSObject.Properties) } else { @() }
$astGrepProperty = @($helperToolProperties | Where-Object { $_.Name -eq 'ast-grep' } | Select-Object -First 1)
$astGrep = if ($astGrepProperty.Count -gt 0) { $astGrepProperty[0].Value } else { $null }
$astGrepReady = Test-HelperReady -Helper $astGrep
$fallbackProviders = if ($astGrepReady) { New-StringList -Values @('ast-grep') } else { New-StringList }

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
  $providerBootstrapRequired = [bool]$providerPayload.derived_readiness.graph_bootstrap_required
  $projectGraphReadinessStatus = if ($providerBootstrapRequired -and $canonicalWorkflowMode -eq 'primary') { 'setup-ready-bootstrap-required' } else { $canonicalWorkflowMode }
  $projectGraphReadiness = [ordered]@{
    status = $projectGraphReadinessStatus
    canonical_graph_facts_artifact = '.spec-first/graph/graph-facts.json'
    provider_status_artifact = '.spec-first/graph/provider-status.json'
    impact_capabilities_artifact = '.spec-first/impact/bootstrap-impact-capabilities.json'
    graph_bootstrap_required = ($providerBootstrapRequired -or $canonicalWorkflowMode -ne 'primary')
    updated_by = 'spec-mcp-setup'
    updated_at = $canonicalUpdatedAt
    confidence = $canonicalConfidence
    limitations = @('Setup projection derived from canonical graph artifacts; canonical readiness truth is under .spec-first/graph/ and .spec-first/impact/.')
  }
}
$gitNexusProjectedCapabilities = if (
  $providers.Contains('gitnexus') -and
  $providers['gitnexus'].Contains('native_capabilities')
) {
  $providers['gitnexus']['native_capabilities']
} else {
  [ordered]@{}
}
$gitNexusCapabilityDiscovery = [ordered]@{
  schema_version = 'gitnexus-capability-discovery.v1'
  generated_by = 'spec-mcp-setup'
  provider_projection = '.spec-first/config/graph-providers.json.providers.gitnexus.native_capabilities'
  capability_status_semantics = 'setup-inferred availability only; not query-ready graph evidence.'
  graph_readiness_reconciliation = 'setup-inferred available or mutation-gated native capability plus project_graph_readiness.status=not-bootstrapped is not a contradiction; durable graph-backed claims still require canonical provider query_ready=true.'
  freshness_policy = 'Reuse existing setup-owned provider projection and fingerprint freshness checks; generated_at is audit metadata only.'
  handoff = [ordered]@{
    durable_readiness_refresh = 'Run spec-graph-bootstrap when current durable graph readiness is needed.'
    plan_live_evidence = 'Use spec-plan lightweight GitNexus live MCP probing when the current session exposes a relevant read-only surface.'
    stale_or_dirty_boundary = 'Dirty worktree or stale durable readiness does not automatically make prior or session-local Plan evidence unusable.'
  }
  capabilities = $gitNexusProjectedCapabilities
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
    'ast-grep' = [ordered]@{
      support_level = if ($astGrepReady) { 'partial' } else { 'none' }
      readiness_status = if ($astGrepReady) { 'ready' } else { 'action-required' }
      confidence = if ($astGrepReady) { 'medium' } else { 'low' }
      capabilities = New-StringList -Values @('structural_search', 'safe_rewrite')
      limitations = if ($astGrepReady) { New-StringList } else { New-StringList -Values @('ast-grep helper is not ready.') }
    }
  }
  fallback_capabilities = [ordered]@{
    context_selection = [ordered]@{
      support_level = if ($astGrepReady) { 'partial' } else { 'none' }
      confidence = if ($astGrepReady) { 'medium' } else { 'low' }
      providers = $fallbackProviders
      limitations = New-StringList -Values @('Fallback context is bounded local repo reads, not compiled graph evidence.')
    }
    impact_radius = [ordered]@{
      support_level = if ($astGrepReady) { 'partial' } else { 'none' }
      confidence = if ($astGrepReady) { 'low' } else { 'unknown' }
      providers = if ($astGrepReady) { New-StringList -Values @('ast-grep') } else { New-StringList }
      limitations = New-StringList -Values @('Fallback impact is heuristic and does not replace graph-provider impact radius.')
    }
    review_support = [ordered]@{
      support_level = if ($astGrepReady) { 'partial' } else { 'none' }
      confidence = if ($astGrepReady) { 'low' } else { 'unknown' }
      providers = if ($astGrepReady) { New-StringList -Values @('ast-grep') } else { New-StringList }
      limitations = New-StringList -Values @('Fallback review support has no canonical graph facts.')
    }
  }
  project_graph_readiness = $projectGraphReadiness
  gitnexus_capability_discovery = $gitNexusCapabilityDiscovery
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

try {
  $providerStatus = Write-JsonIfChanged -Payload ([pscustomobject]$providerPayload) -Path $providerFile
  $runtimeStatus = Write-JsonIfChanged -Payload ([pscustomobject]$runtimePayload) -Path $runtimeFile
  $artifactsStatus = Write-JsonIfChanged -Payload ([pscustomobject]$artifactsPayload) -Path $artifactsFile
} catch {
  Write-ProviderConfigBlocked -ReasonCode 'project-config-symlink-escape'
  return
}

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
