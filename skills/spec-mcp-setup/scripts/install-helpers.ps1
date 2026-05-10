param(
  [switch]$Install,
  [switch]$VerifyOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$mode = if ($VerifyOnly) { 'verify-only' } else { 'install' }

$script:MirrorEndpoints = [ordered]@{
  npm    = 'https://registry.npmmirror.com'
  uv     = 'https://mirrors.tuna.tsinghua.edu.cn/pypi/simple'
  chrome = 'https://npmmirror.com/mirrors/chrome-for-testing'
}

$script:LastInstallProvenance = $null

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

function Reset-InstallProvenance {
  $script:LastInstallProvenance = $null
}

function Get-InstallProvenance {
  if ($null -eq $script:LastInstallProvenance) {
    return [ordered]@{ install_source = 'official'; mirror_used = $false }
  }
  return $script:LastInstallProvenance
}

function Invoke-WithMirrorFallback {
  param(
    [scriptblock]$Action,
    [hashtable]$MirrorEnv
  )

  $official = & $Action
  if ($official) {
    $script:LastInstallProvenance = [ordered]@{ install_source = 'official'; mirror_used = $false }
    return $true
  }

  if ($null -eq $MirrorEnv -or $MirrorEnv.Count -eq 0) {
    $script:LastInstallProvenance = [ordered]@{ install_source = 'both-failed'; mirror_used = $false }
    return $false
  }

  $previous = @{}
  foreach ($key in $MirrorEnv.Keys) {
    $previous[$key] = [Environment]::GetEnvironmentVariable($key)
    Set-Item -Path "env:$key" -Value $MirrorEnv[$key]
  }
  try {
    $mirror = & $Action
  } finally {
    foreach ($key in $MirrorEnv.Keys) {
      if ($null -eq $previous[$key]) {
        Remove-Item -Path "env:$key" -ErrorAction SilentlyContinue
      } else {
        Set-Item -Path "env:$key" -Value $previous[$key]
      }
    }
  }
  if ($mirror) {
    $script:LastInstallProvenance = [ordered]@{ install_source = 'mirror'; mirror_used = $true }
    return $true
  }
  $script:LastInstallProvenance = [ordered]@{ install_source = 'both-failed'; mirror_used = $true }
  return $false
}

function Get-NpmMirrorEnv {
  $value = $script:MirrorEndpoints.npm
  return @{
    NPM_CONFIG_REGISTRY = $value
  }
}

function Test-CommandExists {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Invoke-HelperCommand {
  param([scriptblock]$Script)
  try {
    $global:LASTEXITCODE = 0
    & $Script *> $null
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  }
}

function Invoke-NpmGlobalInstallWithOptionalSudo {
  param([string[]]$Packages)

  $previousCi = $env:CI
  $env:CI = 'true'
  try {
    $action = {
      if (Invoke-HelperCommand { npm install -g @Packages --no-audit --no-fund --loglevel=error --fetch-timeout=30000 --fetch-retries=1 }) {
        return $true
      }
      if (Test-CommandExists 'sudo') {
        $forwardEnv = @()
        foreach ($name in @(
          'NPM_CONFIG_REGISTRY',
          'npm_config_registry',
          'HTTPS_PROXY',
          'https_proxy',
          'HTTP_PROXY',
          'http_proxy',
          'NO_PROXY',
          'no_proxy'
        )) {
          $value = [Environment]::GetEnvironmentVariable($name)
          if (-not [string]::IsNullOrWhiteSpace($value)) {
            $forwardEnv += "$name=$value"
          }
        }

        if ($forwardEnv.Count -gt 0) {
          return (Invoke-HelperCommand { sudo -n env CI=true @forwardEnv npm install -g @Packages --no-audit --no-fund --loglevel=error --fetch-timeout=30000 --fetch-retries=1 })
        }
        return (Invoke-HelperCommand { sudo -n env CI=true npm install -g @Packages --no-audit --no-fund --loglevel=error --fetch-timeout=30000 --fetch-retries=1 })
      }
      return $false
    }.GetNewClosure()
    return (Invoke-WithMirrorFallback -Action $action -MirrorEnv (Get-NpmMirrorEnv))
  } finally {
    $env:CI = $previousCi
  }
}

function Write-AgentBrowserInstallMarker {
  param([string]$InstallCommand)
  $markerDir = Split-Path -Parent $agentBrowserInstallMarker
  New-Item -ItemType Directory -Force -Path $markerDir | Out-Null
  [pscustomobject]@{
    schema_version = 'agent-browser-install.v1'
    installed_by = 'spec-mcp-setup'
    installed_at = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
    install_command = $InstallCommand
  } | ConvertTo-Json -Compress | Set-Content -Encoding utf8 $agentBrowserInstallMarker
}

function Get-PlatformName {
  $hasIsWindows = $null -ne (Get-Variable -Name IsWindows -ErrorAction SilentlyContinue)
  $hasIsLinux = $null -ne (Get-Variable -Name IsLinux -ErrorAction SilentlyContinue)
  $hasIsMacOS = $null -ne (Get-Variable -Name IsMacOS -ErrorAction SilentlyContinue)
  if ($hasIsWindows) {
    if ($IsWindows) { return 'windows' }
    if ($IsMacOS) { return 'macos' }
    if ($IsLinux) { return 'linux' }
    return 'unknown'
  }
  switch ([System.Environment]::OSVersion.Platform) {
    ([System.PlatformID]::Win32NT) { return 'windows' }
    ([System.PlatformID]::Unix) { return 'linux' }
    ([System.PlatformID]::MacOSX) { return 'macos' }
  }
  return 'unknown'
}

function Get-HelperInstallCommand {
  param(
    [string]$Name,
    [string]$Platform
  )

  function Get-LinuxPackageInstallCommand {
    param(
      [string]$AptPackage,
      [string]$DnfPackage,
      [string]$YumPackage,
      [string]$PacmanPackage,
      [string]$ApkPackage
    )

    if (Test-CommandExists 'apt-get') { return "sudo apt-get update && sudo apt-get install -y $AptPackage" }
    if (Test-CommandExists 'dnf') { return "sudo dnf upgrade -y $DnfPackage || sudo dnf install -y $DnfPackage" }
    if (Test-CommandExists 'yum') { return "sudo yum update -y $YumPackage || sudo yum install -y $YumPackage" }
    if (Test-CommandExists 'pacman') { return "sudo pacman -Syu --needed $PacmanPackage" }
    if (Test-CommandExists 'apk') { return "sudo apk update && sudo apk add --upgrade $ApkPackage" }
    return ''
  }

  function Get-BrewLatestInstallCommand {
    param([string]$Package)
    return "brew update && if brew list --formula $Package >/dev/null 2>&1; then brew upgrade -q $Package; else brew install -q $Package; fi"
  }

function Get-WingetLatestInstallCommand {
    param([string]$PackageId)
    return "winget upgrade --id $PackageId -e --silent --accept-package-agreements --accept-source-agreements || winget install --id $PackageId -e --silent --accept-package-agreements --accept-source-agreements"
  }

  function Get-AgentBrowserInstallCommand {
    param([bool]$WithDeps)
    $browserInstall = if ($WithDeps) { 'agent-browser install --with-deps' } else { 'agent-browser install' }
    return '$env:CI=''true''; npm install -g agent-browser@latest --no-audit --no-fund --loglevel=error; if ($LASTEXITCODE -eq 0) { ' + $browserInstall + ' }; if ($LASTEXITCODE -eq 0) { npx -y skills@latest add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y }'
  }

switch ($Name) {
    'agent-browser' {
      if ($Platform -eq 'linux') {
        return (Get-AgentBrowserInstallCommand -WithDeps $true)
      }
      return (Get-AgentBrowserInstallCommand -WithDeps $false)
    }
    'gh' {
      if ($Platform -eq 'windows') { return (Get-WingetLatestInstallCommand -PackageId 'GitHub.cli') }
      if ($Platform -eq 'linux') {
        $linuxCommand = Get-LinuxPackageInstallCommand -AptPackage 'gh' -DnfPackage 'gh' -YumPackage 'gh' -PacmanPackage 'github-cli' -ApkPackage 'github-cli'
        if (-not [string]::IsNullOrWhiteSpace($linuxCommand)) { return $linuxCommand }
        return 'Install gh from https://cli.github.com'
      }
      return (Get-BrewLatestInstallCommand -Package 'gh')
    }
    'jq' {
      if ($Platform -eq 'windows') { return (Get-WingetLatestInstallCommand -PackageId 'jqlang.jq') }
      if ($Platform -eq 'linux') {
        $linuxCommand = Get-LinuxPackageInstallCommand -AptPackage 'jq' -DnfPackage 'jq' -YumPackage 'jq' -PacmanPackage 'jq' -ApkPackage 'jq'
        if (-not [string]::IsNullOrWhiteSpace($linuxCommand)) { return $linuxCommand }
        return 'Install jq from https://jqlang.github.io/jq/'
      }
      return (Get-BrewLatestInstallCommand -Package 'jq')
    }
    'vhs' {
      if ($Platform -eq 'windows') { return 'go install github.com/charmbracelet/vhs@latest' }
      if ($Platform -eq 'linux') {
        if (Test-CommandExists 'go') { return 'go install github.com/charmbracelet/vhs@latest' }
        return 'Install vhs from https://github.com/charmbracelet/vhs'
      }
      return (Get-BrewLatestInstallCommand -Package 'vhs')
    }
    'silicon' {
      if ($Platform -eq 'windows') { return 'cargo install silicon --force' }
      if ($Platform -eq 'linux') {
        if (Test-CommandExists 'cargo') { return 'cargo install silicon --force' }
        return 'Install silicon from https://github.com/Aloxaf/silicon'
      }
      return (Get-BrewLatestInstallCommand -Package 'silicon')
    }
    'ffmpeg' {
      if ($Platform -eq 'windows') { return (Get-WingetLatestInstallCommand -PackageId 'Gyan.FFmpeg') }
      if ($Platform -eq 'linux') {
        $linuxCommand = Get-LinuxPackageInstallCommand -AptPackage 'ffmpeg' -DnfPackage 'ffmpeg' -YumPackage 'ffmpeg' -PacmanPackage 'ffmpeg' -ApkPackage 'ffmpeg'
        if (-not [string]::IsNullOrWhiteSpace($linuxCommand)) { return $linuxCommand }
        return 'Install ffmpeg from https://ffmpeg.org/download.html'
      }
      return (Get-BrewLatestInstallCommand -Package 'ffmpeg')
    }
    'ast-grep' {
      if ($Platform -eq 'windows') { return 'npm install -g @ast-grep/cli@latest' }
      if ($Platform -eq 'linux') {
        if (Test-CommandExists 'cargo') { return 'cargo install ast-grep --locked --force' }
        if (Test-CommandExists 'npm') { return 'npm install -g @ast-grep/cli@latest' }
        return 'Install ast-grep from https://ast-grep.github.io'
      }
      return (Get-BrewLatestInstallCommand -Package 'ast-grep')
    }
    'ast-grep-skill' { return 'npx -y skills@latest add ast-grep/agent-skill -g -y' }
    default { return '' }
  }
}

function Invoke-HelperInstall {
  param(
    [string]$Name,
    [string]$Platform
  )

  function Invoke-WithOptionalSudo {
    param(
      [string]$Command,
      [object[]]$Arguments
    )

    if (Test-CommandExists 'sudo') {
      & sudo -n $Command @Arguments
    } else {
      & $Command @Arguments
    }
  }

  function Invoke-LinuxPackageInstall {
    param(
      [string]$AptPackage,
      [string]$DnfPackage,
      [string]$YumPackage,
      [string]$PacmanPackage,
      [string]$ApkPackage
    )

    if (Test-CommandExists 'apt-get') { return ((Invoke-HelperCommand { Invoke-WithOptionalSudo 'apt-get' @('update') }) -and (Invoke-HelperCommand { Invoke-WithOptionalSudo 'apt-get' @('install', '-y', $AptPackage) })) }
    if (Test-CommandExists 'dnf') { return ((Invoke-HelperCommand { Invoke-WithOptionalSudo 'dnf' @('upgrade', '-y', $DnfPackage) }) -or (Invoke-HelperCommand { Invoke-WithOptionalSudo 'dnf' @('install', '-y', $DnfPackage) })) }
    if (Test-CommandExists 'yum') { return ((Invoke-HelperCommand { Invoke-WithOptionalSudo 'yum' @('update', '-y', $YumPackage) }) -or (Invoke-HelperCommand { Invoke-WithOptionalSudo 'yum' @('install', '-y', $YumPackage) })) }
    if (Test-CommandExists 'pacman') { return (Invoke-HelperCommand { Invoke-WithOptionalSudo 'pacman' @('-Syu', '--needed', '--noconfirm', $PacmanPackage) }) }
    if (Test-CommandExists 'apk') { return ((Invoke-HelperCommand { Invoke-WithOptionalSudo 'apk' @('update') }) -and (Invoke-HelperCommand { Invoke-WithOptionalSudo 'apk' @('add', '--upgrade', $ApkPackage) })) }
    return $false
  }

  function Invoke-BrewLatestInstall {
    param([string]$Package)
    Invoke-HelperCommand { brew update } | Out-Null
    if (Invoke-HelperCommand { brew list --formula $Package }) {
      Invoke-HelperCommand { brew upgrade -q $Package } | Out-Null
      return $true
    }
    return (Invoke-HelperCommand { brew install -q $Package })
  }

  function Invoke-WingetLatestInstall {
    param([string]$PackageId)
    return (
      (Invoke-HelperCommand { winget upgrade --id $PackageId -e --silent --accept-package-agreements --accept-source-agreements }) -or
      (Invoke-HelperCommand { winget install --id $PackageId -e --silent --accept-package-agreements --accept-source-agreements })
    )
  }

  switch ($Name) {
    'gh' {
      if ($Platform -eq 'windows') { if (-not (Test-CommandExists 'winget')) { return $false }; return (Invoke-WingetLatestInstall -PackageId 'GitHub.cli') }
      if ($Platform -eq 'linux') { return (Invoke-LinuxPackageInstall -AptPackage 'gh' -DnfPackage 'gh' -YumPackage 'gh' -PacmanPackage 'github-cli' -ApkPackage 'github-cli') }
      return (Invoke-BrewLatestInstall -Package 'gh')
    }
    'jq' {
      if ($Platform -eq 'windows') { if (-not (Test-CommandExists 'winget')) { return $false }; return (Invoke-WingetLatestInstall -PackageId 'jqlang.jq') }
      if ($Platform -eq 'linux') { return (Invoke-LinuxPackageInstall -AptPackage 'jq' -DnfPackage 'jq' -YumPackage 'jq' -PacmanPackage 'jq' -ApkPackage 'jq') }
      return (Invoke-BrewLatestInstall -Package 'jq')
    }
    'vhs' {
      if ($Platform -eq 'windows') { return (Invoke-HelperCommand { go install github.com/charmbracelet/vhs@latest }) }
      if ($Platform -eq 'linux') { if (-not (Test-CommandExists 'go')) { return $false }; return (Invoke-HelperCommand { go install github.com/charmbracelet/vhs@latest }) }
      return (Invoke-BrewLatestInstall -Package 'vhs')
    }
    'silicon' {
      if ($Platform -eq 'windows') { return (Invoke-HelperCommand { cargo install silicon --force }) }
      if ($Platform -eq 'linux') { if (-not (Test-CommandExists 'cargo')) { return $false }; return (Invoke-HelperCommand { cargo install silicon --force }) }
      return (Invoke-BrewLatestInstall -Package 'silicon')
    }
    'ffmpeg' {
      if ($Platform -eq 'windows') { if (-not (Test-CommandExists 'winget')) { return $false }; return (Invoke-WingetLatestInstall -PackageId 'Gyan.FFmpeg') }
      if ($Platform -eq 'linux') { return (Invoke-LinuxPackageInstall -AptPackage 'ffmpeg' -DnfPackage 'ffmpeg' -YumPackage 'ffmpeg' -PacmanPackage 'ffmpeg' -ApkPackage 'ffmpeg') }
      return (Invoke-BrewLatestInstall -Package 'ffmpeg')
    }
    'ast-grep' {
      if ($Platform -eq 'windows') { return (Invoke-NpmGlobalInstallWithOptionalSudo -Packages @('@ast-grep/cli@latest')) }
      if ($Platform -eq 'linux') {
        if (Test-CommandExists 'cargo') { return (Invoke-HelperCommand { cargo install ast-grep --locked --force }) }
        if (Test-CommandExists 'npm') { return (Invoke-NpmGlobalInstallWithOptionalSudo -Packages @('@ast-grep/cli@latest')) }
        return $false
      }
      return (Invoke-BrewLatestInstall -Package 'ast-grep')
    }
    'ast-grep-skill' {
      return (Invoke-WithMirrorFallback -Action { Invoke-HelperCommand { npx -y skills@latest add ast-grep/agent-skill -g -y } } -MirrorEnv (Get-NpmMirrorEnv))
    }
    default { return $false }
  }
}

function Test-GlobalSkill {
  param([string]$Name)
  return (
    (Test-Path (Join-Path $HOME ".agents/skills/$Name/SKILL.md")) -or
    (Test-Path (Join-Path $HOME ".claude/skills/$Name/SKILL.md"))
  )
}

function Add-HelperFact {
  param(
    [System.Collections.IDictionary]$HelperTools,
    [string]$Id,
    [string]$Type,
    [string]$DependencyStatus,
    [string]$InstallStatus,
    [string]$SkillStatus,
    [string]$Result,
    [string]$NextAction,
    [bool]$BaselineBlocking = $true,
    [string]$InstallSource = 'official',
    [bool]$MirrorUsed = $false
  )

  $HelperTools[$Id] = [ordered]@{
    required = $true
    baseline_blocking = [bool]$BaselineBlocking
    type = $Type
    dependency_status = $DependencyStatus
    host_config_status = 'not-applicable'
    install_status = $InstallStatus
    skill_status = $SkillStatus
    project_status = 'not-applicable'
    result = $Result
    next_action = $NextAction
    install_source = $InstallSource
    mirror_used = [bool]$MirrorUsed
  }
}

function Start-ParallelCommandTask {
  param(
    [string]$Name,
    [scriptblock]$ScriptBlock,
    [System.Collections.IDictionary]$Tasks
  )

  $statusPath = [System.IO.Path]::GetTempFileName()
  $job = Start-Job -ScriptBlock {
    param($InnerScriptBlock, $StatusPath)

    try {
      $global:LASTEXITCODE = 0
      & $InnerScriptBlock *> $null
      $exitCode = $LASTEXITCODE
    } catch {
      $exitCode = 1
    }

    Set-Content -Encoding ascii -NoNewline -Path $StatusPath -Value $exitCode
  } -ArgumentList $ScriptBlock, $statusPath

  $Tasks[$Name] = [ordered]@{
    job = $job
    status_path = $statusPath
  }
}

function Wait-ParallelCommandTasks {
  param(
    [System.Collections.IDictionary]$Tasks,
    [int]$TimeoutSeconds
  )

  $results = [ordered]@{}
  foreach ($entry in $Tasks.GetEnumerator()) {
    $completed = Wait-Job -Job $entry.Value.job -Timeout $TimeoutSeconds
    $exitCode = 1
    if (-not $completed) {
      Stop-Job -Job $entry.Value.job -Force | Out-Null
      $exitCode = 124
    }

    Receive-Job $entry.Value.job -ErrorAction SilentlyContinue | Out-Null
    if ($exitCode -ne 124 -and (Test-Path $entry.Value.status_path)) {
      $raw = Get-Content -Raw -Path $entry.Value.status_path
      if (-not [string]::IsNullOrWhiteSpace($raw)) {
        $exitCode = [int]$raw
      }
    }
    $results[$entry.Key] = $exitCode
    Remove-Job $entry.Value.job -Force | Out-Null
    Remove-Item $entry.Value.status_path -ErrorAction SilentlyContinue
  }

  return $results
}

$helperTools = [ordered]@{}
$parallelTasks = [ordered]@{}
$platform = Get-PlatformName
$agentBrowserInstallMarker = Join-Path $HOME '.agent-browser/spec-first-install.json'
$stageTimeoutSeconds = Get-NonNegativeIntEnv -Name 'SPEC_FIRST_STAGE_TIMEOUT_SECONDS' -Default 900

$agentBrowserStatus = 'ready'
$agentBrowserDependencyStatus = 'ready'
$agentBrowserInstallStatus = 'ready'
$agentBrowserSkillStatus = 'ready'
$agentBrowserNextAction = ''
$agentBrowserBaselineBlocking = $true
$agentBrowserInstallSource = 'official'
$agentBrowserMirrorUsed = $false
$agentBrowserInstallCommand = 'agent-browser install'
if ($platform -eq 'linux') {
  $agentBrowserInstallCommand = 'agent-browser install --with-deps'
}

$agentBrowserBrowserInstallQueued = $false
$agentBrowserSkillInstallQueued = $false
$astGrepSkillInstallQueued = $false

if ($mode -eq 'install' -and -not (Test-GlobalSkill 'agent-browser')) {
  $agentBrowserSkillStatus = 'action-required'
  $agentBrowserStatus = 'action-required'
  $agentBrowserSkillInstallQueued = $true
  Start-ParallelCommandTask -Name 'agent-browser-skill-install' -ScriptBlock { npx -y skills@latest add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y } -Tasks $parallelTasks
}

if (-not (Test-CommandExists 'agent-browser')) {
  $agentBrowserDependencyStatus = 'missing'
  $agentBrowserInstallStatus = 'action-required'
  $agentBrowserStatus = 'action-required'
  $agentBrowserNextAction = 'install agent-browser CLI'
  if ($mode -eq 'install') {
    Reset-InstallProvenance
    $installed = Invoke-NpmGlobalInstallWithOptionalSudo -Packages @('agent-browser@latest')
    $provenance = Get-InstallProvenance
    $agentBrowserInstallSource = $provenance.install_source
    $agentBrowserMirrorUsed = [bool]$provenance.mirror_used
    if ($installed) {
      $agentBrowserDependencyStatus = 'ready'
      $agentBrowserInstallStatus = 'ready'
      if (-not (Test-CommandExists 'agent-browser')) {
        $agentBrowserStatus = 'action-required'
        $agentBrowserDependencyStatus = 'missing'
        $agentBrowserInstallStatus = 'action-required'
        $agentBrowserNextAction = 'agent-browser CLI not found after npm install'
      } else {
        $agentBrowserStatus = 'ready'
        $agentBrowserNextAction = ''
      }
    } else {
      $agentBrowserStatus = 'action-required'
      $agentBrowserNextAction = 'npm install -g agent-browser@latest failed'
    }
  }
}

if ($mode -eq 'verify-only' -and $agentBrowserStatus -eq 'ready' -and -not (Test-Path $agentBrowserInstallMarker)) {
  $agentBrowserInstallStatus = 'action-required'
  if ($platform -eq 'windows') {
    $agentBrowserStatus = 'degraded'
    $agentBrowserBaselineBlocking = $false
    $agentBrowserNextAction = "agent-browser browser runtime is not installed; browser automation may be unavailable. Rerun $agentBrowserInstallCommand or set AGENT_BROWSER_EXECUTABLE_PATH to an existing Chrome/Chromium/Brave executable."
  } else {
    $agentBrowserStatus = 'action-required'
    $agentBrowserNextAction = "run $agentBrowserInstallCommand"
  }
}

if ($mode -eq 'verify-only' -and $agentBrowserDependencyStatus -eq 'ready' -and -not (Test-GlobalSkill 'agent-browser')) {
  $agentBrowserStatus = 'action-required'
  $agentBrowserSkillStatus = 'action-required'
  $agentBrowserBaselineBlocking = $true
  $agentBrowserNextAction = 'install global agent-browser skill'
}

if ($mode -eq 'install' -and (Test-CommandExists 'agent-browser') -and -not (Test-Path $agentBrowserInstallMarker)) {
  $agentBrowserInstallStatus = 'action-required'
  $agentBrowserStatus = 'action-required'
  $agentBrowserBaselineBlocking = $true
  $agentBrowserBrowserInstallQueued = $true
  if ($platform -eq 'linux') {
    Start-ParallelCommandTask -Name 'agent-browser-browser-install' -ScriptBlock { & agent-browser install --with-deps } -Tasks $parallelTasks
  } else {
    Start-ParallelCommandTask -Name 'agent-browser-browser-install' -ScriptBlock { & agent-browser install } -Tasks $parallelTasks
  }
}

Add-HelperFact -HelperTools $helperTools -Id 'agent-browser' -Type 'helper' -DependencyStatus $agentBrowserDependencyStatus -InstallStatus $agentBrowserInstallStatus -SkillStatus $agentBrowserSkillStatus -Result $agentBrowserStatus -NextAction $agentBrowserNextAction -BaselineBlocking $agentBrowserBaselineBlocking -InstallSource $agentBrowserInstallSource -MirrorUsed $agentBrowserMirrorUsed

$demoOnlyHelpers = @('vhs', 'silicon', 'ffmpeg')
foreach ($helper in @('gh', 'jq', 'vhs', 'silicon', 'ffmpeg', 'ast-grep')) {
  $status = 'ready'
  $dependencyStatus = 'ready'
  $installStatus = 'ready'
  $nextAction = ''
  $isDemoOnly = $demoOnlyHelpers -contains $helper
  $baselineBlocking = -not $isDemoOnly
  $installSource = 'official'
  $mirrorUsed = $false

  if (-not (Test-CommandExists $helper)) {
    $dependencyStatus = 'missing'
    $installStatus = 'action-required'
    $installCommand = Get-HelperInstallCommand -Name $helper -Platform $platform
    if ($mode -eq 'install') {
      Reset-InstallProvenance
      if ((Invoke-HelperInstall -Name $helper -Platform $platform) -and (Test-CommandExists $helper)) {
        $dependencyStatus = 'ready'
        $installStatus = 'ready'
        $status = 'ready'
        $nextAction = ''
        $provenance = Get-InstallProvenance
        $installSource = $provenance.install_source
        $mirrorUsed = [bool]$provenance.mirror_used
      } else {
        if ($isDemoOnly) {
          $status = 'degraded'
          $nextAction = "optional helper for feature-video skill; install via: $installCommand"
        } else {
          $status = 'action-required'
          $nextAction = $installCommand
        }
      }
    } else {
      if ($isDemoOnly) {
        $status = 'degraded'
        $nextAction = "optional helper for feature-video skill; install via: $installCommand"
      } else {
        $status = 'action-required'
        $nextAction = $installCommand
      }
    }
  }

  Add-HelperFact -HelperTools $helperTools -Id $helper -Type 'helper' -DependencyStatus $dependencyStatus -InstallStatus $installStatus -SkillStatus 'not-applicable' -Result $status -NextAction $nextAction -BaselineBlocking $baselineBlocking -InstallSource $installSource -MirrorUsed $mirrorUsed
}

$astGrepSkillStatus = 'ready'
$astGrepSkillDependencyStatus = 'ready'
$astGrepSkillInstallStatus = 'ready'
$astGrepSkillNextAction = ''

if (-not (Test-GlobalSkill 'ast-grep')) {
  $astGrepSkillDependencyStatus = 'missing'
  $astGrepSkillInstallStatus = 'action-required'
  $astGrepSkillStatus = 'action-required'
  $astGrepSkillNextAction = Get-HelperInstallCommand -Name 'ast-grep-skill' -Platform $platform
  if ($mode -eq 'install') {
    $astGrepSkillInstallQueued = $true
    Start-ParallelCommandTask -Name 'ast-grep-skill-install' -ScriptBlock { npx -y skills@latest add ast-grep/agent-skill -g -y } -Tasks $parallelTasks
  }
}

$parallelResults = Wait-ParallelCommandTasks -Tasks $parallelTasks -TimeoutSeconds $stageTimeoutSeconds

  if ($agentBrowserSkillInstallQueued -or $agentBrowserBrowserInstallQueued) {
  if ($agentBrowserBrowserInstallQueued) {
    if (($parallelResults['agent-browser-browser-install'] -eq 0) -and (Test-CommandExists 'agent-browser')) {
      Write-AgentBrowserInstallMarker -InstallCommand $agentBrowserInstallCommand
      $agentBrowserInstallStatus = 'ready'
    } else {
      $agentBrowserInstallStatus = 'action-required'
      if ($platform -eq 'windows') {
        $agentBrowserStatus = 'degraded'
        $agentBrowserBaselineBlocking = $false
        $agentBrowserNextAction = "agent-browser browser runtime install failed; browser automation may be unavailable. Rerun $agentBrowserInstallCommand or set AGENT_BROWSER_EXECUTABLE_PATH to an existing Chrome/Chromium/Brave executable."
      } elseif ($platform -eq 'macos') {
        $agentBrowserStatus = 'action-required'
        $agentBrowserNextAction = "run $agentBrowserInstallCommand manually or set AGENT_BROWSER_EXECUTABLE_PATH to an existing Chrome/Chromium/Brave executable"
      } else {
        $agentBrowserStatus = 'action-required'
        $agentBrowserNextAction = "run $agentBrowserInstallCommand manually"
      }
    }
  }

  if ($agentBrowserSkillInstallQueued) {
    if (($parallelResults['agent-browser-skill-install'] -eq 0) -and (Test-GlobalSkill 'agent-browser')) {
      $agentBrowserSkillStatus = 'ready'
    } else {
      $agentBrowserSkillStatus = 'action-required'
      $agentBrowserStatus = 'action-required'
      $agentBrowserBaselineBlocking = $true
      if ($agentBrowserDependencyStatus -eq 'ready' -and $agentBrowserInstallStatus -eq 'ready') {
        $agentBrowserNextAction = 'install global agent-browser skill manually'
      }
    }
  }

  if (($agentBrowserDependencyStatus -eq 'ready') -and ($agentBrowserInstallStatus -eq 'ready') -and ($agentBrowserSkillStatus -eq 'ready')) {
    $agentBrowserStatus = 'ready'
    $agentBrowserBaselineBlocking = $true
    $agentBrowserNextAction = ''
  }

  $helperTools['agent-browser'] = [ordered]@{
    required = $true
    baseline_blocking = [bool]$agentBrowserBaselineBlocking
    type = 'helper'
    dependency_status = $agentBrowserDependencyStatus
    host_config_status = 'not-applicable'
    install_status = $agentBrowserInstallStatus
    skill_status = $agentBrowserSkillStatus
    project_status = 'not-applicable'
    result = $agentBrowserStatus
    next_action = $agentBrowserNextAction
    install_source = $agentBrowserInstallSource
    mirror_used = [bool]$agentBrowserMirrorUsed
  }
}

if ($astGrepSkillInstallQueued) {
    if (($parallelResults['ast-grep-skill-install'] -eq 0) -and (Test-GlobalSkill 'ast-grep')) {
      $astGrepSkillDependencyStatus = 'ready'
      $astGrepSkillInstallStatus = 'ready'
      $astGrepSkillStatus = 'ready'
      $astGrepSkillNextAction = ''
    } else {
      $astGrepSkillDependencyStatus = 'missing'
      $astGrepSkillInstallStatus = 'action-required'
      $astGrepSkillStatus = 'action-required'
      if ($parallelResults['ast-grep-skill-install'] -eq 124) {
        $astGrepSkillNextAction = "global ast-grep skill install timed out after ${stageTimeoutSeconds}s"
      } else {
        $astGrepSkillNextAction = 'install global ast-grep skill manually'
      }
  }

  $helperTools['ast-grep-skill'] = [ordered]@{
    required = $true
    type = 'global-skill'
    dependency_status = $astGrepSkillDependencyStatus
    host_config_status = 'not-applicable'
    install_status = $astGrepSkillInstallStatus
    skill_status = $astGrepSkillStatus
    project_status = 'not-applicable'
    result = $astGrepSkillStatus
    next_action = $astGrepSkillNextAction
  }
} elseif (-not (Test-GlobalSkill 'ast-grep')) {
  Add-HelperFact -HelperTools $helperTools -Id 'ast-grep-skill' -Type 'global-skill' -DependencyStatus $astGrepSkillDependencyStatus -InstallStatus $astGrepSkillInstallStatus -SkillStatus $astGrepSkillStatus -Result $astGrepSkillStatus -NextAction $astGrepSkillNextAction
} else {
  Add-HelperFact -HelperTools $helperTools -Id 'ast-grep-skill' -Type 'global-skill' -DependencyStatus $astGrepSkillDependencyStatus -InstallStatus $astGrepSkillInstallStatus -SkillStatus $astGrepSkillStatus -Result $astGrepSkillStatus -NextAction $astGrepSkillNextAction
}

[pscustomobject]@{
  helper_tools = $helperTools
  mirror_endpoints = $script:MirrorEndpoints
  recommended_environment_variables = [ordered]@{
    npm = [ordered]@{ npm_config_registry = $script:MirrorEndpoints.npm }
    uv  = [ordered]@{ UV_INDEX_URL = $script:MirrorEndpoints.uv }
  }
} | ConvertTo-Json -Compress -Depth 8
