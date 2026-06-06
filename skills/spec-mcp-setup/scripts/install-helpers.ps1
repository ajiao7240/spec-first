param(
  [switch]$Install,
  [switch]$VerifyOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'lib-helper-registry.ps1')

$mode = if ($VerifyOnly) { 'verify-only' } else { 'install' }

$script:MirrorEndpoints = [ordered]@{
  npm    = 'https://registry.npmmirror.com'
  uv     = 'https://mirrors.tuna.tsinghua.edu.cn/pypi/simple'
  chrome = 'https://npmmirror.com/mirrors/chrome-for-testing'
}

$script:LastInstallProvenance = $null
$browserHelperOptInAction = 'set SPEC_FIRST_BROWSER_HELPER_REQUIRED=1 and rerun spec-mcp-setup install'
$helperRegistry = Get-HelperRegistry

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

function Get-HelperEntry {
  param([string]$Id)
  foreach ($helper in @($helperRegistry.helpers)) {
    if ($helper.id -eq $Id) { return $helper }
  }
  return $null
}

function Get-HelperProfile {
  param([object]$Helper)
  if ($null -ne $Helper -and $Helper.profiles -and @($Helper.profiles).Count -gt 0) {
    return [string]@($Helper.profiles)[0]
  }
  return 'minimal'
}

function Test-EffectiveBaselineBlocking {
  param([object]$Helper)
  if ($null -eq $Helper) { return $true }
  if ([string]$Helper.id -eq 'jq' -and (Get-PlatformName) -eq 'windows') {
    return $false
  }
  return [bool]$Helper.baseline_blocking
}

function Get-HelperSafetyResult {
  param([object]$Helper)
  if ($null -eq $Helper -or $null -eq $Helper.safety) { return 'blocked' }
  $flags = @($Helper.safety.risk_flags)
  $pinStatus = if ($Helper.safety.version_policy) { [string]$Helper.safety.version_policy.pin_status } else { '' }
  if ([string]::IsNullOrWhiteSpace([string]$Helper.safety.source) -or [string]::IsNullOrWhiteSpace($pinStatus)) { return 'blocked' }
  if ($flags -contains 'installer-script' -or $flags -contains 'unknown-source') { return 'blocked' }
  if ($Helper.installation -and [string]$Helper.installation.strategy -eq 'manual') { return 'unsupported' }
  # review-required 由 registry 显式 review_required 或具体高风险 flag 决定;pin_status 的风险
  # 已由各 helper 的 unpinned-* flag 显式编码,不用 latest 一刀切(否则 safe 分支永不可达,
  # 与 Node setup-plan-renderer.cjs 不一致)。与 Node 真相源对齐(REVIEW_RISK_FLAGS 同集)。
  $reviewRiskFlags = @('unpinned-npx', 'global-npm-install', 'global-cargo-install', 'global-install', 'browser-runtime-install', 'unpinned-latest')
  $matchedFlag = $reviewRiskFlags | Where-Object { $flags -contains $_ } | Select-Object -First 1
  if ([bool]$Helper.safety.review_required -or $matchedFlag) {
    return 'review-required'
  }
  return 'safe'
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

  function Get-AgentBrowserInstallCommand {
    param([bool]$WithDeps)
    $browserInstall = if ($WithDeps) { 'agent-browser install --with-deps' } else { 'agent-browser install' }
    return '$env:CI=''true''; npm install -g agent-browser@latest --no-audit --no-fund --loglevel=error; if ($LASTEXITCODE -eq 0) { ' + $browserInstall + ' }; if ($LASTEXITCODE -eq 0) { npx -y skills@latest add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y }'
  }

  # agent-browser 的展示命令是真实安装命令(本脚本是 installer);其余 helper 委派到
  # lib-helper-registry.ps1 的共享展示生成器,消除与 check-health.ps1 的双份维护漂移。
  if ($Name -eq 'agent-browser') {
    if ($Platform -eq 'linux') {
      return (Get-AgentBrowserInstallCommand -WithDeps $true)
    }
    return (Get-AgentBrowserInstallCommand -WithDeps $false)
  }
  return (Get-HelperInstallCommandDisplay -Name $Name -Platform $Platform)
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
    (Test-Path (Join-Path $HOME ".claude/skills/$Name/SKILL.md")) -or
    (Test-Path (Join-Path $HOME ".codex/skills/$Name/SKILL.md"))
  )
}

function Test-BrowserHelperRequired {
  $raw = [Environment]::GetEnvironmentVariable('SPEC_FIRST_BROWSER_HELPER_REQUIRED')
  if ([string]::IsNullOrWhiteSpace($raw)) { return $false }
  return @('1', 'true', 'yes') -contains $raw.ToLowerInvariant()
}

function Get-BrowserDemandSignals {
  $signals = New-Object System.Collections.Generic.List[string]

  if (Test-Path -LiteralPath 'package.json' -PathType Leaf) {
    try {
      $package = Get-Content -Raw -LiteralPath 'package.json' | ConvertFrom-Json -ErrorAction Stop
      foreach ($section in @('dependencies', 'devDependencies', 'optionalDependencies')) {
        if ($package.PSObject.Properties.Name -contains $section) {
          foreach ($property in $package.$section.PSObject.Properties) {
            if ($property.Name -match '(@playwright/test|playwright|cypress|puppeteer|storybook|@storybook/)') {
              $signals.Add("package.json:dependency:$($property.Name)")
            }
          }
        }
      }
      if ($package.PSObject.Properties.Name -contains 'scripts') {
        foreach ($property in $package.scripts.PSObject.Properties) {
          $scriptText = "$($property.Name) $($property.Value)"
          if ($scriptText -match 'playwright|cypress|puppeteer|storybook|vite|next|nuxt|astro|remix|svelte-kit|sveltekit') {
            $signals.Add("package.json:scripts.$($property.Name)")
          }
        }
      }
    } catch {
      # Keep setup deterministic: unreadable package.json simply contributes no demand signal.
    }
  }

  foreach ($file in @('next.config.js', 'next.config.mjs', 'vite.config.js', 'vite.config.ts', 'nuxt.config.js', 'nuxt.config.ts', 'astro.config.mjs', 'remix.config.js', 'svelte.config.js', 'config/routes.rb', 'manage.py', 'mix.exs', 'artisan', 'storybook.config.js', '.storybook/main.js', '.storybook/main.ts')) {
    if (Test-Path -LiteralPath $file) { $signals.Add("config-file:$file") }
  }

  foreach ($dir in @('src/app', 'pages', 'app/views', 'templates', 'public', 'storybook', '.storybook')) {
    if ((Test-Path -LiteralPath $dir -PathType Container) -and (@(Get-ChildItem -LiteralPath $dir -Force -ErrorAction SilentlyContinue | Select-Object -First 1).Count -gt 0)) {
      $signals.Add("dir:$dir")
    }
  }

  return @($signals | Sort-Object -Unique)
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
    [bool]$MirrorUsed = $false,
    [string[]]$BrowserCapabilityDemandSignals = @()
  )

  $helper = Get-HelperEntry -Id $Id
  $required = if ($null -ne $helper -and $helper.PSObject.Properties.Name -contains 'required') { [bool]$helper.required } else { $true }
  $effectiveBaselineBlocking = if ($PSBoundParameters.ContainsKey('BaselineBlocking')) { [bool]$BaselineBlocking } else { Test-EffectiveBaselineBlocking -Helper $helper }
  $profile = Get-HelperProfile -Helper $helper
  $kind = if ($null -ne $helper -and -not [string]::IsNullOrWhiteSpace([string]$helper.kind)) { [string]$helper.kind } else { $Type }
  $safety = Get-HelperSafetyResult -Helper $helper
  $reasonCode = switch ($Result) {
    'ready' { 'ready' }
    'skipped' { 'optional-skipped' }
    'degraded' { 'optional-capability-degraded' }
    'action-required' { 'required-runtime-action-required' }
    default { 'unknown' }
  }

  $HelperTools[$Id] = [ordered]@{
    required = $required
    baseline_blocking = $effectiveBaselineBlocking
    profile = $profile
    kind = $kind
    type = $Type
    dependency_status = $DependencyStatus
    configured_status = 'not-applicable'
    host_config_status = 'not-applicable'
    allowed = 'not-applicable'
    install_status = $InstallStatus
    safety = $safety
    skill_status = $SkillStatus
    project_status = 'not-applicable'
    result = $Result
    reason_code = $reasonCode
    next_action = $NextAction
    install_source = $InstallSource
    mirror_used = [bool]$MirrorUsed
    browser_capability_demand_signals = @($BrowserCapabilityDemandSignals)
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
$providerReadiness = @()
$parallelTasks = [ordered]@{}
$platform = Get-PlatformName
$agentBrowserInstallMarker = Join-Path $HOME '.agent-browser/spec-first-install.json'
$stageTimeoutSeconds = Get-NonNegativeIntEnv -Name 'SPEC_FIRST_STAGE_TIMEOUT_SECONDS' -Default 900

$agentBrowserStatus = 'ready'
$agentBrowserDependencyStatus = 'ready'
$agentBrowserInstallStatus = 'ready'
$agentBrowserSkillStatus = 'ready'
$agentBrowserNextAction = ''
$agentBrowserBaselineBlocking = $false
$agentBrowserInstallSource = 'official'
$agentBrowserMirrorUsed = $false
$agentBrowserRequired = Test-BrowserHelperRequired
$agentBrowserDemandSignals = Get-BrowserDemandSignals
$agentBrowserInstallCommand = 'agent-browser install'
if ($platform -eq 'linux') {
  $agentBrowserInstallCommand = 'agent-browser install --with-deps'
}

$agentBrowserBrowserInstallQueued = $false
$agentBrowserSkillInstallQueued = $false
$astGrepSkillInstallQueued = $false

if (-not (Test-GlobalSkill 'agent-browser')) {
  $agentBrowserSkillStatus = 'action-required'
  if ($agentBrowserRequired) {
    $agentBrowserStatus = 'degraded'
    if ($mode -eq 'install') {
      $agentBrowserSkillInstallQueued = $true
      Start-ParallelCommandTask -Name 'agent-browser-skill-install' -ScriptBlock { npx -y skills@latest add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y } -Tasks $parallelTasks
    }
  } else {
    $agentBrowserStatus = 'skipped'
    $agentBrowserNextAction = $browserHelperOptInAction
  }
}

if (-not (Test-CommandExists 'agent-browser')) {
  $agentBrowserDependencyStatus = 'missing'
  $agentBrowserInstallStatus = 'action-required'
  $agentBrowserStatus = 'skipped'
  $agentBrowserNextAction = $browserHelperOptInAction
  if ($mode -eq 'install' -and $agentBrowserRequired) {
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
      $agentBrowserStatus = 'degraded'
      $agentBrowserNextAction = 'npm install -g agent-browser@latest failed'
    }
  }
}

if ($agentBrowserDependencyStatus -eq 'ready' -and -not (Test-Path $agentBrowserInstallMarker)) {
  $agentBrowserInstallStatus = 'action-required'
  if ($agentBrowserRequired) {
    $agentBrowserStatus = 'degraded'
    if ($mode -eq 'verify-only') {
      $agentBrowserNextAction = $browserHelperOptInAction
    } else {
      $agentBrowserNextAction = "run $agentBrowserInstallCommand or set AGENT_BROWSER_EXECUTABLE_PATH to an existing Chrome/Chromium/Brave executable"
    }
  } else {
    $agentBrowserStatus = 'skipped'
    $agentBrowserNextAction = $browserHelperOptInAction
  }
}

if ($mode -eq 'verify-only' -and $agentBrowserDependencyStatus -eq 'ready' -and $agentBrowserSkillStatus -eq 'action-required') {
  if ($agentBrowserRequired) {
    $agentBrowserStatus = 'degraded'
    $agentBrowserNextAction = $browserHelperOptInAction
  } else {
    $agentBrowserStatus = 'skipped'
    $agentBrowserNextAction = $browserHelperOptInAction
  }
}

if ($mode -eq 'install' -and $agentBrowserRequired -and (Test-CommandExists 'agent-browser') -and -not (Test-Path $agentBrowserInstallMarker)) {
  $agentBrowserInstallStatus = 'action-required'
  $agentBrowserStatus = 'degraded'
  $agentBrowserBrowserInstallQueued = $true
  if ($platform -eq 'linux') {
    Start-ParallelCommandTask -Name 'agent-browser-browser-install' -ScriptBlock { & agent-browser install --with-deps } -Tasks $parallelTasks
  } else {
    Start-ParallelCommandTask -Name 'agent-browser-browser-install' -ScriptBlock { & agent-browser install } -Tasks $parallelTasks
  }
}

Add-HelperFact -HelperTools $helperTools -Id 'agent-browser' -Type 'helper' -DependencyStatus $agentBrowserDependencyStatus -InstallStatus $agentBrowserInstallStatus -SkillStatus $agentBrowserSkillStatus -Result $agentBrowserStatus -NextAction $agentBrowserNextAction -BaselineBlocking $agentBrowserBaselineBlocking -InstallSource $agentBrowserInstallSource -MirrorUsed $agentBrowserMirrorUsed -BrowserCapabilityDemandSignals $agentBrowserDemandSignals

foreach ($helperEntry in @($helperRegistry.helpers | Where-Object { ($_.kind -eq 'cli' -or $_.kind -eq 'browser-helper') -and $_.id -ne 'agent-browser' })) {
  $helper = [string]$helperEntry.id
  $status = 'ready'
  $dependencyStatus = 'ready'
  $installStatus = 'ready'
  $nextAction = ''
  $baselineBlocking = Test-EffectiveBaselineBlocking -Helper $helperEntry
  $installSource = 'official'
  $mirrorUsed = $false

  if (-not (Test-CommandExists $helper)) {
    $dependencyStatus = 'missing'
    $installStatus = 'action-required'
    $installCommand = Get-HelperInstallCommand -Name $helper -Platform $platform
    if ($helper -eq 'ast-grep' -and (Test-CommandExists 'rg') -and $mode -ne 'install') {
      $status = 'degraded'
      $nextAction = "ast-grep missing; falling back to rg. Install via: $installCommand"
    } elseif ($mode -eq 'install') {
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
        if (-not $baselineBlocking) {
          $status = 'degraded'
          $nextAction = "optional helper for feature-video skill; install via: $installCommand"
        } else {
          $status = 'action-required'
          $nextAction = $installCommand
        }
      }
    } else {
      if (-not $baselineBlocking) {
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
      $agentBrowserStatus = 'degraded'
      $agentBrowserBaselineBlocking = $false
      $agentBrowserNextAction = "agent-browser browser runtime install failed; browser automation may be unavailable. Rerun $agentBrowserInstallCommand or set AGENT_BROWSER_EXECUTABLE_PATH to an existing Chrome/Chromium/Brave executable."
    }
  }

  if ($agentBrowserSkillInstallQueued) {
    if (($parallelResults['agent-browser-skill-install'] -eq 0) -and (Test-GlobalSkill 'agent-browser')) {
      $agentBrowserSkillStatus = 'ready'
    } else {
      $agentBrowserSkillStatus = 'action-required'
      $agentBrowserStatus = 'degraded'
      $agentBrowserBaselineBlocking = $false
      if ($agentBrowserDependencyStatus -eq 'ready' -and $agentBrowserInstallStatus -eq 'ready') {
        $agentBrowserNextAction = 'install global agent-browser skill manually'
      }
    }
  }

  if (($agentBrowserDependencyStatus -eq 'ready') -and ($agentBrowserInstallStatus -eq 'ready') -and ($agentBrowserSkillStatus -eq 'ready')) {
    $agentBrowserStatus = 'ready'
    $agentBrowserBaselineBlocking = $false
    $agentBrowserNextAction = ''
  }

  Add-HelperFact -HelperTools $helperTools -Id 'agent-browser' -Type 'helper' -DependencyStatus $agentBrowserDependencyStatus -InstallStatus $agentBrowserInstallStatus -SkillStatus $agentBrowserSkillStatus -Result $agentBrowserStatus -NextAction $agentBrowserNextAction -BaselineBlocking $agentBrowserBaselineBlocking -InstallSource $agentBrowserInstallSource -MirrorUsed $agentBrowserMirrorUsed -BrowserCapabilityDemandSignals $agentBrowserDemandSignals
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

  Add-HelperFact -HelperTools $helperTools -Id 'ast-grep-skill' -Type 'global-skill' -DependencyStatus $astGrepSkillDependencyStatus -InstallStatus $astGrepSkillInstallStatus -SkillStatus $astGrepSkillStatus -Result $astGrepSkillStatus -NextAction $astGrepSkillNextAction
} elseif (-not (Test-GlobalSkill 'ast-grep')) {
  Add-HelperFact -HelperTools $helperTools -Id 'ast-grep-skill' -Type 'global-skill' -DependencyStatus $astGrepSkillDependencyStatus -InstallStatus $astGrepSkillInstallStatus -SkillStatus $astGrepSkillStatus -Result $astGrepSkillStatus -NextAction $astGrepSkillNextAction
} else {
  Add-HelperFact -HelperTools $helperTools -Id 'ast-grep-skill' -Type 'global-skill' -DependencyStatus $astGrepSkillDependencyStatus -InstallStatus $astGrepSkillInstallStatus -SkillStatus $astGrepSkillStatus -Result $astGrepSkillStatus -NextAction $astGrepSkillNextAction
}

function Test-ProviderConsentApproved {
  param([string]$Provider)
  $value = [Environment]::GetEnvironmentVariable("SPEC_FIRST_PROVIDER_${Provider}_CONSENT")
  if ([string]::IsNullOrWhiteSpace($value)) { return $false }
  return @('approved', 'yes', 'true', '1') -contains $value.ToLowerInvariant()
}

function Invoke-GraphifyProviderInstallIfRequested {
  if ($mode -ne 'install') { return }
  if (-not (Test-ProviderConsentApproved -Provider 'GRAPHIFY')) { return }
  if (Test-CommandExists 'graphify') { return }
  if (-not (Test-CommandExists 'uv')) { return }
  Invoke-HelperCommand { uv tool install graphifyy==0.8.33 } | Out-Null
}

Invoke-GraphifyProviderInstallIfRequested
try {
  $providerReadinessRaw = & node (Join-Path $PSScriptRoot 'provider-readiness-renderer.cjs') --source helper --repo-root (Get-Location).Path
  $providerReadiness = @($providerReadinessRaw | ConvertFrom-Json)
} catch {
  $providerReadiness = @()
}

[pscustomobject]@{
  helper_tools = $helperTools
  provider_readiness = @($providerReadiness)
  mirror_endpoints = $script:MirrorEndpoints
  recommended_environment_variables = [ordered]@{
    npm = [ordered]@{ npm_config_registry = $script:MirrorEndpoints.npm }
    uv  = [ordered]@{ UV_INDEX_URL = $script:MirrorEndpoints.uv }
  }
} | ConvertTo-Json -Compress -Depth 8
