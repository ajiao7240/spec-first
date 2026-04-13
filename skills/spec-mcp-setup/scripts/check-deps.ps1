param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Test-CommandExists {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-CommandVersion {
  param(
    [string]$Name,
    [string]$VersionFlag = '--version'
  )

  if (-not (Test-CommandExists $Name)) {
    return $null
  }

  try {
    $output = & $Name $VersionFlag 2>&1 | Select-Object -First 1
    return [string]$output
  } catch {
    return $null
  }
}

function Get-OsName {
  if ($IsWindows) { return 'windows' }
  if ($IsLinux) { return 'linux' }
  if ($IsMacOS) { return 'macos' }
  return 'unknown'
}

function New-InstallSuggestion {
  param(
    [string]$Command,
    [string]$Safety,
    [string]$RiskHint,
    [string]$Manual
  )

  return [pscustomobject]@{
    command = $Command
    safety = $Safety
    risk_hint = $RiskHint
    manual = $Manual
  }
}

$os = Get-OsName

$nodeInstalled = Test-CommandExists 'node'
$uvInstalled = Test-CommandExists 'uv'
$jqInstalled = Test-CommandExists 'jq'

$node = [pscustomobject]@{
  installed = [bool]$nodeInstalled
  version = $null
  install_suggestion = $null
}

if ($nodeInstalled) {
  $node.version = Get-CommandVersion 'node' '--version'
} elseif ($os -eq 'windows') {
  $node.install_suggestion = New-InstallSuggestion `
    'winget install OpenJS.NodeJS.LTS' `
    'gated_auto' `
    'Uses the system package manager; may require a terminal restart' `
    'Install Node.js from https://nodejs.org/ or use winget install OpenJS.NodeJS.LTS'
} elseif ($os -eq 'macos') {
  $node.install_suggestion = New-InstallSuggestion `
    'curl -fsSL https://fnm.vercel.app/install | bash && export FNM_PATH="$HOME/.fnm" && export PATH="$FNM_PATH:$PATH" && eval "$(fnm env)" && fnm install --lts' `
    'gated_auto' `
    'fnm installs Node.js to the user directory and may conflict with system Node.js' `
    'Install from https://nodejs.org/ or use brew install node'
} elseif ($os -eq 'linux') {
  $node.install_suggestion = New-InstallSuggestion `
    'curl -fsSL https://fnm.vercel.app/install | bash && export FNM_PATH="$HOME/.fnm" && export PATH="$FNM_PATH:$PATH" && eval "$(fnm env)" && fnm install --lts' `
    'gated_auto' `
    'fnm installs Node.js to the user directory and may conflict with system Node.js' `
    'Install from https://nodejs.org/ or use sudo apt install nodejs'
} else {
  $node.install_suggestion = New-InstallSuggestion `
    'echo "Please install Node.js from https://nodejs.org/"' `
    'manual' `
    '' `
    'Install from https://nodejs.org/'
}

$uv = [pscustomobject]@{
  installed = [bool]$uvInstalled
  version = $null
  install_suggestion = $null
}

if ($uvInstalled) {
  $uv.version = Get-CommandVersion 'uv' '--version'
} else {
  $uv.install_suggestion = New-InstallSuggestion `
    'curl -LsSf https://astral.sh/uv/install.sh | sh' `
    'safe_auto' `
    'Installs to ~/.cargo/bin/, no sudo required' `
    'Install from https://docs.astral.sh/uv/getting-started/installation/'
}

$jq = [pscustomobject]@{
  installed = [bool]$jqInstalled
  version = $null
  install_suggestion = $null
}

if ($jqInstalled) {
  $jq.version = Get-CommandVersion 'jq' '--version'
} elseif ($os -eq 'windows') {
  $jq.install_suggestion = New-InstallSuggestion `
    'winget install jqlang.jq' `
    'safe_auto' `
    'Standard package manager install on Windows' `
    'Install jq from https://jqlang.github.io/jq/ or use winget install jqlang.jq'
} elseif ($os -eq 'macos') {
  $jq.install_suggestion = New-InstallSuggestion `
    'brew install jq' `
    'safe_auto' `
    'Standard Homebrew package, no conflicts' `
    'brew install jq or install from https://jqlang.github.io/jq/'
} elseif ($os -eq 'linux') {
  $jq.install_suggestion = New-InstallSuggestion `
    'sudo apt-get install -y jq' `
    'safe_auto' `
    'Standard system package' `
    'sudo apt install jq or install from https://jqlang.github.io/jq/'
} else {
  $jq.install_suggestion = New-InstallSuggestion `
    'echo "Please install jq from https://jqlang.github.io/jq/"' `
    'manual' `
    '' `
    'Install from https://jqlang.github.io/jq/'
}

[pscustomobject]@{
  os = $os
  node = $node
  uv = $uv
  jq = $jq
} | ConvertTo-Json -Compress -Depth 6
