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

  if (-not (Test-CommandExists $Name)) { return $null }
  try {
    return [string](& $Name $VersionFlag 2>&1 | Select-Object -First 1)
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

function Get-InstallSuggestion {
  param([string]$Name, [string]$Os)
  switch -Regex ("$Name`:$Os") {
    '^(node|npm|npx):windows$' { return 'winget install OpenJS.NodeJS.LTS' }
    '^(node|npm|npx):macos$' { return 'brew install node' }
    '^(node|npm|npx):(linux|wsl)$' { return 'curl -fsSL https://fnm.vercel.app/install | bash && fnm install --lts' }
    '^(uv|uvx):' { return 'curl -LsSf https://astral.sh/uv/install.sh | sh' }
    '^git:windows$' { return 'winget install Git.Git' }
    '^git:macos$' { return 'xcode-select --install or brew install git' }
    '^git:(linux|wsl)$' { return 'sudo apt-get install -y git' }
    default { return $null }
  }
}

function New-DependencyFact {
  param(
    [string]$Name,
    [bool]$Required,
    [string]$Os,
    [string]$VersionFlag = '--version'
  )

  $installed = Test-CommandExists $Name
  [pscustomobject]@{
    required = [bool]$Required
    installed = [bool]$installed
    version = if ($installed) { Get-CommandVersion $Name $VersionFlag } else { $null }
    install_suggestion = if ($installed) { $null } else { Get-InstallSuggestion $Name $Os }
  }
}

$os = Get-OsName
$dependencies = [ordered]@{
  node = New-DependencyFact 'node' $true $os
  npm = New-DependencyFact 'npm' $true $os
  npx = New-DependencyFact 'npx' $true $os
  uv = New-DependencyFact 'uv' $true $os
  uvx = New-DependencyFact 'uvx' $true $os
  git = New-DependencyFact 'git' $false $os
}

$requiredReady = $true
foreach ($entry in $dependencies.GetEnumerator()) {
  if ($entry.Value.required -and -not $entry.Value.installed) {
    $requiredReady = $false
  }
}

$warnings = @()
foreach ($entry in $dependencies.GetEnumerator()) {
  if (-not $entry.Value.required -and -not $entry.Value.installed) {
    $warnings += "$($entry.Key) missing"
  }
}

[pscustomobject]@{
  schema_version = 'deps.v2'
  platform = $os
  dependencies = $dependencies
  required_ready = [bool]$requiredReady
  warnings = @($warnings)
} | ConvertTo-Json -Compress -Depth 8
