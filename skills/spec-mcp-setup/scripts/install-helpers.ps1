param(
  [switch]$Install,
  [switch]$VerifyOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$mode = if ($VerifyOnly) { 'verify-only' } else { 'install' }

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

function Write-AgentBrowserInstallMarker {
  $markerDir = Split-Path -Parent $agentBrowserInstallMarker
  New-Item -ItemType Directory -Force -Path $markerDir | Out-Null
  [pscustomobject]@{
    schema_version = 'agent-browser-install.v1'
    installed_by = 'spec-mcp-setup'
    installed_at = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
    install_command = 'agent-browser install'
  } | ConvertTo-Json -Compress | Set-Content -Encoding utf8 $agentBrowserInstallMarker
}

function Get-PlatformName {
  if ($IsWindows) { return 'windows' }
  if ($IsLinux) { return 'linux' }
  if ($IsMacOS) { return 'macos' }
  return 'unknown'
}

function Get-HelperInstallCommand {
  param(
    [string]$Name,
    [string]$Platform
  )

  switch ($Name) {
    'agent-browser' { return 'CI=true npm install -g agent-browser --no-audit --no-fund --loglevel=error && agent-browser install && npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y' }
    'gh' {
      if ($Platform -eq 'windows') { return 'winget install --id GitHub.cli -e --silent' }
      if ($Platform -eq 'linux') { return 'sudo apt-get install -y gh' }
      return 'NONINTERACTIVE=1 HOMEBREW_NO_AUTO_UPDATE=1 brew install -q gh'
    }
    'jq' {
      if ($Platform -eq 'windows') { return 'winget install --id jqlang.jq -e --silent' }
      if ($Platform -eq 'linux') { return 'sudo apt-get install -y jq' }
      return 'NONINTERACTIVE=1 HOMEBREW_NO_AUTO_UPDATE=1 brew install -q jq'
    }
    'vhs' {
      if ($Platform -eq 'windows') { return 'go install github.com/charmbracelet/vhs@latest' }
      if ($Platform -eq 'linux') { return 'go install github.com/charmbracelet/vhs@latest' }
      return 'NONINTERACTIVE=1 HOMEBREW_NO_AUTO_UPDATE=1 brew install -q vhs'
    }
    'silicon' {
      if ($Platform -eq 'windows') { return 'cargo install silicon' }
      if ($Platform -eq 'linux') { return 'cargo install silicon' }
      return 'NONINTERACTIVE=1 HOMEBREW_NO_AUTO_UPDATE=1 brew install -q silicon'
    }
    'ffmpeg' {
      if ($Platform -eq 'windows') { return 'winget install --id Gyan.FFmpeg -e --silent' }
      if ($Platform -eq 'linux') { return 'sudo apt-get install -y ffmpeg' }
      return 'NONINTERACTIVE=1 HOMEBREW_NO_AUTO_UPDATE=1 brew install -q ffmpeg'
    }
    'ast-grep' {
      if ($Platform -eq 'windows') { return 'npm install -g @ast-grep/cli' }
      if ($Platform -eq 'linux') { return 'cargo install ast-grep --locked' }
      return 'NONINTERACTIVE=1 HOMEBREW_NO_AUTO_UPDATE=1 brew install -q ast-grep'
    }
    'ast-grep-skill' { return 'npx skills add ast-grep/agent-skill -g -y' }
    default { return '' }
  }
}

function Invoke-HelperInstall {
  param(
    [string]$Name,
    [string]$Platform
  )

  switch ($Name) {
    'gh' {
      if ($Platform -eq 'windows') { return (Invoke-HelperCommand { winget install --id GitHub.cli -e --silent }) }
      if ($Platform -eq 'linux') { return (Invoke-HelperCommand { sudo apt-get install -y gh }) }
      return (Invoke-HelperCommand { brew install -q gh })
    }
    'jq' {
      if ($Platform -eq 'windows') { return (Invoke-HelperCommand { winget install --id jqlang.jq -e --silent }) }
      if ($Platform -eq 'linux') { return (Invoke-HelperCommand { sudo apt-get install -y jq }) }
      return (Invoke-HelperCommand { brew install -q jq })
    }
    'vhs' {
      if ($Platform -eq 'windows') { return (Invoke-HelperCommand { go install github.com/charmbracelet/vhs@latest }) }
      if ($Platform -eq 'linux') { return (Invoke-HelperCommand { go install github.com/charmbracelet/vhs@latest }) }
      return (Invoke-HelperCommand { brew install -q vhs })
    }
    'silicon' {
      if ($Platform -eq 'windows') { return (Invoke-HelperCommand { cargo install silicon }) }
      if ($Platform -eq 'linux') { return (Invoke-HelperCommand { cargo install silicon }) }
      return (Invoke-HelperCommand { brew install -q silicon })
    }
    'ffmpeg' {
      if ($Platform -eq 'windows') { return (Invoke-HelperCommand { winget install --id Gyan.FFmpeg -e --silent }) }
      if ($Platform -eq 'linux') { return (Invoke-HelperCommand { sudo apt-get install -y ffmpeg }) }
      return (Invoke-HelperCommand { brew install -q ffmpeg })
    }
    'ast-grep' {
      if ($Platform -eq 'windows') { return (Invoke-HelperCommand { npm install -g @ast-grep/cli }) }
      if ($Platform -eq 'linux') { return (Invoke-HelperCommand { cargo install ast-grep --locked }) }
      return (Invoke-HelperCommand { brew install -q ast-grep })
    }
    'ast-grep-skill' {
      return (Invoke-HelperCommand { npx skills add ast-grep/agent-skill -g -y })
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
    [ordered]$HelperTools,
    [string]$Id,
    [string]$Type,
    [string]$DependencyStatus,
    [string]$InstallStatus,
    [string]$SkillStatus,
    [string]$Result,
    [string]$NextAction
  )

  $HelperTools[$Id] = [ordered]@{
    required = $true
    type = $Type
    dependency_status = $DependencyStatus
    host_config_status = 'not-applicable'
    install_status = $InstallStatus
    skill_status = $SkillStatus
    project_status = 'not-applicable'
    result = $Result
    next_action = $NextAction
  }
}

$helperTools = [ordered]@{}
$platform = Get-PlatformName
$globalAgentBrowserSkill = Join-Path $HOME '.agents/skills/agent-browser/SKILL.md'
$agentBrowserInstallMarker = Join-Path $HOME '.agent-browser/spec-first-install.json'

$status = 'ready'
$dependencyStatus = 'ready'
$installStatus = 'ready'
$skillStatus = 'ready'
$nextAction = ''

if (-not (Test-CommandExists 'agent-browser')) {
  $dependencyStatus = 'missing'
  $installStatus = 'action-required'
  $status = 'action-required'
  $nextAction = 'install agent-browser CLI'
  if ($mode -eq 'verify-only') {
  } else {
    $previousCi = $env:CI
    $env:CI = 'true'
    $installed = Invoke-HelperCommand { npm install -g agent-browser --no-audit --no-fund --loglevel=error }
    $env:CI = $previousCi
    if ($installed) {
      $dependencyStatus = 'ready'
      $installStatus = 'ready'
      if (-not (Test-CommandExists 'agent-browser')) {
        $status = 'action-required'
        $dependencyStatus = 'missing'
        $installStatus = 'action-required'
        $nextAction = 'agent-browser CLI not found after npm install'
      } else {
        $status = 'ready'
        $nextAction = ''
      }
    } else {
      $status = 'action-required'
      $nextAction = 'npm install -g agent-browser failed'
    }
  }
}

if ($status -eq 'ready' -and $mode -eq 'verify-only' -and -not (Test-Path $agentBrowserInstallMarker)) {
  $status = 'action-required'
  $installStatus = 'action-required'
  $nextAction = 'run agent-browser install'
}

if ($status -eq 'ready' -and $mode -eq 'verify-only' -and -not (Test-Path $globalAgentBrowserSkill)) {
  $status = 'action-required'
  $skillStatus = 'action-required'
  $nextAction = 'install global agent-browser skill'
}

if ($status -eq 'ready' -and $mode -eq 'install') {
  if (-not (Invoke-HelperCommand { agent-browser install })) {
    $status = 'action-required'
    $installStatus = 'action-required'
    $nextAction = 'run agent-browser install manually'
  } else {
    Write-AgentBrowserInstallMarker
  }
}

if ($status -eq 'ready' -and $mode -eq 'install') {
  if (-not ((Invoke-HelperCommand { npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y }) -and (Test-Path $globalAgentBrowserSkill))) {
    $status = 'action-required'
    $skillStatus = 'action-required'
    $nextAction = 'install global agent-browser skill manually'
  }
}

Add-HelperFact -HelperTools $helperTools -Id 'agent-browser' -Type 'helper' -DependencyStatus $dependencyStatus -InstallStatus $installStatus -SkillStatus $skillStatus -Result $status -NextAction $nextAction

foreach ($helper in @('gh', 'jq', 'vhs', 'silicon', 'ffmpeg', 'ast-grep')) {
  $status = 'ready'
  $dependencyStatus = 'ready'
  $installStatus = 'ready'
  $nextAction = ''

  if (-not (Test-CommandExists $helper)) {
    $dependencyStatus = 'missing'
    $installStatus = 'action-required'
    $status = 'action-required'
    $nextAction = Get-HelperInstallCommand -Name $helper -Platform $platform
    if ($mode -eq 'install') {
      if ((Invoke-HelperInstall -Name $helper -Platform $platform) -and (Test-CommandExists $helper)) {
        $dependencyStatus = 'ready'
        $installStatus = 'ready'
        $status = 'ready'
        $nextAction = ''
      }
    }
  }

  Add-HelperFact -HelperTools $helperTools -Id $helper -Type 'helper' -DependencyStatus $dependencyStatus -InstallStatus $installStatus -SkillStatus 'not-applicable' -Result $status -NextAction $nextAction
}

$status = 'ready'
$dependencyStatus = 'ready'
$installStatus = 'ready'
$skillStatus = 'ready'
$nextAction = ''

if (-not (Test-GlobalSkill 'ast-grep')) {
  $dependencyStatus = 'missing'
  $installStatus = 'action-required'
  $skillStatus = 'action-required'
  $status = 'action-required'
  $nextAction = Get-HelperInstallCommand -Name 'ast-grep-skill' -Platform $platform
  if ($mode -eq 'install') {
    if ((Invoke-HelperInstall -Name 'ast-grep-skill' -Platform $platform) -and (Test-GlobalSkill 'ast-grep')) {
      $dependencyStatus = 'ready'
      $installStatus = 'ready'
      $skillStatus = 'ready'
      $status = 'ready'
      $nextAction = ''
    }
  }
}

Add-HelperFact -HelperTools $helperTools -Id 'ast-grep-skill' -Type 'global-skill' -DependencyStatus $dependencyStatus -InstallStatus $installStatus -SkillStatus $skillStatus -Result $status -NextAction $nextAction

[pscustomobject]@{
  helper_tools = $helperTools
} | ConvertTo-Json -Compress -Depth 8
