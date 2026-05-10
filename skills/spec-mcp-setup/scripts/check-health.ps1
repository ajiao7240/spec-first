param(
  [string]$Version = '',
  [switch]$Json
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Test-CommandExists {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-PlatformName {
  $hasIsWindows = $null -ne (Get-Variable -Name IsWindows -ErrorAction SilentlyContinue)
  if ($hasIsWindows) {
    if ($IsWindows) { return 'windows' }
    if ($IsMacOS) { return 'macos' }
    if ($IsLinux) { return 'linux' }
  }

  switch ([System.Environment]::OSVersion.Platform) {
    ([System.PlatformID]::Win32NT) { return 'windows' }
    ([System.PlatformID]::MacOSX) { return 'macos' }
    ([System.PlatformID]::Unix) { return 'linux' }
    default { return 'unknown' }
  }
}

function Get-WingetLatestInstallCommand {
  param([string]$PackageId)
  return "if (winget upgrade --id $PackageId -e --silent --accept-package-agreements --accept-source-agreements) { } else { winget install --id $PackageId -e --silent --accept-package-agreements --accept-source-agreements }"
}

function Get-InstallCommand {
  param(
    [string]$Name,
    [string]$Platform
  )

  switch ($Name) {
    'agent-browser' {
      $browserInstall = if ($Platform -eq 'linux') { 'agent-browser install --with-deps' } else { 'agent-browser install' }
      return '$env:CI=''true''; npm install -g agent-browser@latest --no-audit --no-fund --loglevel=error; if ($LASTEXITCODE -eq 0) { ' + $browserInstall + ' }; if ($LASTEXITCODE -eq 0) { npx -y skills@latest add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y }'
    }
    'gh' {
      if ($Platform -eq 'windows') { return (Get-WingetLatestInstallCommand -PackageId 'GitHub.cli') }
      if ($Platform -eq 'macos') { return 'brew install gh' }
      return 'Install gh from https://cli.github.com'
    }
    'jq' {
      if ($Platform -eq 'windows') { return 'Not required for the native PowerShell setup path; install jqlang.jq only for Git Bash or WSL scripts.' }
      if ($Platform -eq 'macos') { return 'brew install jq' }
      return 'Install jq from https://jqlang.github.io/jq/'
    }
    'vhs' {
      if ($Platform -eq 'macos') { return 'brew install vhs' }
      return 'go install github.com/charmbracelet/vhs@latest'
    }
    'silicon' {
      if ($Platform -eq 'macos') { return 'brew install silicon' }
      return 'cargo install silicon --force'
    }
    'ffmpeg' {
      if ($Platform -eq 'windows') { return (Get-WingetLatestInstallCommand -PackageId 'Gyan.FFmpeg') }
      if ($Platform -eq 'macos') { return 'brew install ffmpeg' }
      return 'Install ffmpeg from https://ffmpeg.org/download.html'
    }
    'ast-grep' {
      return 'npm install -g @ast-grep/cli@latest'
    }
    'ast-grep-skill' {
      return 'npx -y skills@latest add ast-grep/agent-skill -g -y'
    }
    default {
      return ''
    }
  }
}

function Get-ProjectUrl {
  param([string]$Name)
  switch ($Name) {
    'agent-browser' { return 'https://github.com/vercel-labs/agent-browser' }
    'gh' { return 'https://cli.github.com' }
    'jq' { return 'https://jqlang.github.io/jq/' }
    'vhs' { return 'https://github.com/charmbracelet/vhs' }
    'silicon' { return 'https://github.com/Aloxaf/silicon' }
    'ffmpeg' { return 'https://ffmpeg.org/download.html' }
    'ast-grep' { return 'https://ast-grep.github.io' }
    'ast-grep-skill' { return 'https://ast-grep.github.io' }
    default { return '' }
  }
}

function Test-GlobalSkillInstalled {
  param([string]$SkillName)
  $paths = @(
    [System.IO.Path]::Combine($HOME, '.agents', 'skills', $SkillName, 'SKILL.md'),
    [System.IO.Path]::Combine($HOME, '.codex', 'skills', $SkillName, 'SKILL.md'),
    [System.IO.Path]::Combine($HOME, '.claude', 'skills', $SkillName, 'SKILL.md')
  )
  foreach ($path in $paths) {
    if (Test-Path -LiteralPath $path -PathType Leaf) { return $true }
  }
  return $false
}

function Test-AgentBrowserReady {
  if (-not (Test-CommandExists 'agent-browser')) { return $false }
  if (-not (Test-Path -LiteralPath ([System.IO.Path]::Combine($HOME, '.agent-browser', 'spec-first-install.json')) -PathType Leaf)) { return $false }
  return (Test-GlobalSkillInstalled -SkillName 'agent-browser')
}

function New-HealthItem {
  param(
    [string]$Id,
    [bool]$Required,
    [bool]$Ready,
    [string]$InstallCommand,
    [string]$Url
  )

  $result = if ($Ready) { 'ready' } elseif ($Required) { 'action-required' } else { 'pending' }
  $dependencyStatus = if ($Ready) { 'ready' } else { 'missing' }
  $nextAction = if ($Ready) { '' } else { $InstallCommand }
  return [ordered]@{
    id = $Id
    required = $Required
    dependency_status = $dependencyStatus
    host_config_status = 'not-applicable'
    project_status = 'not-applicable'
    result = $result
    next_action = $nextAction
    install_command = $InstallCommand
    url = $Url
  }
}

function Invoke-Git {
  param([string[]]$Arguments)
  if (-not (Test-CommandExists 'git')) { return $null }
  $output = @(& git @Arguments 2>$null)
  if ($LASTEXITCODE -ne 0) { return $null }
  return ($output -join "`n").Trim()
}

$platform = Get-PlatformName
$toolDefs = @(
  @{ id = 'agent-browser'; required = $true; ready = (Test-AgentBrowserReady) },
  @{ id = 'gh'; required = $true; ready = (Test-CommandExists 'gh') },
  @{ id = 'jq'; required = $false; ready = (Test-CommandExists 'jq') },
  @{ id = 'vhs'; required = $true; ready = (Test-CommandExists 'vhs') },
  @{ id = 'silicon'; required = $true; ready = (Test-CommandExists 'silicon') },
  @{ id = 'ffmpeg'; required = $true; ready = (Test-CommandExists 'ffmpeg') },
  @{ id = 'ast-grep'; required = $true; ready = ((Test-CommandExists 'ast-grep') -or (Test-CommandExists 'sg')) }
)

$tools = @()
foreach ($tool in $toolDefs) {
  $installCommand = Get-InstallCommand -Name $tool.id -Platform $platform
  $tools += New-HealthItem -Id $tool.id -Required ([bool]$tool.required) -Ready ([bool]$tool.ready) -InstallCommand $installCommand -Url (Get-ProjectUrl -Name $tool.id)
}

$astGrepSkillReady = Test-GlobalSkillInstalled -SkillName 'ast-grep'
$skills = @(
  New-HealthItem -Id 'ast-grep' -Required $true -Ready $astGrepSkillReady -InstallCommand (Get-InstallCommand -Name 'ast-grep-skill' -Platform $platform) -Url (Get-ProjectUrl -Name 'ast-grep-skill')
)

$repoRoot = Invoke-Git -Arguments @('rev-parse', '--show-toplevel')
$insideGitRepo = -not [string]::IsNullOrWhiteSpace($repoRoot)
$legacyMarkdown = 'skip'
$legacyConfig = 'skip'
$localConfig = 'skip'
$localConfigGitignore = 'skip'
$exampleConfig = 'skip'

if ($insideGitRepo) {
  $legacyMarkdown = if (Test-Path -LiteralPath (Join-Path $repoRoot 'compound-engineering.local.md') -PathType Leaf) { 'present' } else { 'missing' }
  $legacyConfig = if (Test-Path -LiteralPath (Join-Path $repoRoot '.compound-engineering/config.local.yaml') -PathType Leaf) { 'present' } else { 'missing' }
  $localConfigPath = Join-Path $repoRoot '.spec-first/config.local.yaml'
  $localConfig = if (Test-Path -LiteralPath $localConfigPath -PathType Leaf) { 'ok' } else { 'missing' }
  if ($localConfig -eq 'ok' -and (Test-CommandExists 'git')) {
    & git check-ignore -q $localConfigPath 2>$null
    $localConfigGitignore = if ($LASTEXITCODE -eq 0) { 'ok' } else { 'missing' }
  }
  $template = Join-Path (Split-Path -Parent $PSScriptRoot) 'references/config-template.yaml'
  $example = Join-Path $repoRoot '.spec-first/config.local.example.yaml'
  if (-not (Test-Path -LiteralPath $example -PathType Leaf)) {
    $exampleConfig = 'missing'
  } elseif ((Test-Path -LiteralPath $template -PathType Leaf) -and ((Get-Content -Raw -LiteralPath $template) -ne (Get-Content -Raw -LiteralPath $example))) {
    $exampleConfig = 'outdated'
  } else {
    $exampleConfig = 'ok'
  }
}

$payload = [ordered]@{
  schema_version = 'spec-mcp-setup-preflight.v2'
  tools = $tools
  skills = $skills
  project = [ordered]@{
    inside_git_repo = $insideGitRepo
    local_config_status = $localConfig
    local_config_gitignore_status = $localConfigGitignore
    example_config_status = $exampleConfig
  }
  legacy = [ordered]@{
    compound_engineering_markdown_status = $legacyMarkdown
    compound_engineering_config_status = $legacyConfig
  }
}

if ($Json) {
  $payload | ConvertTo-Json -Depth 8
  exit 0
}

if (-not [string]::IsNullOrWhiteSpace($Version)) {
  Write-Host "Spec-First version v$Version"
}

$readyTools = @($tools | Where-Object { $_.dependency_status -eq 'ready' }).Count
Write-Host ''
Write-Host "Tool install status $readyTools/$($tools.Count)"
foreach ($tool in $tools) {
  $status = if ($tool.dependency_status -eq 'ready') { 'installed' } else { 'missing' }
  Write-Host ("  {0,-15} {1,-8} {2}" -f $tool.id, $(if ($tool.required) { 'yes' } else { 'no' }), $status)
  if ($status -eq 'missing' -and -not [string]::IsNullOrWhiteSpace($tool.next_action)) {
    Write-Host "    $($tool.next_action)"
  }
}

$readySkills = @($skills | Where-Object { $_.dependency_status -eq 'ready' }).Count
Write-Host ''
Write-Host "Skill install status $readySkills/$($skills.Count)"
foreach ($skill in $skills) {
  $status = if ($skill.dependency_status -eq 'ready') { 'installed' } else { 'missing' }
  Write-Host ("  {0,-15} {1,-8} {2}" -f $skill.id, $(if ($skill.required) { 'yes' } else { 'no' }), $status)
  if ($status -eq 'missing' -and -not [string]::IsNullOrWhiteSpace($skill.next_action)) {
    Write-Host "    $($skill.next_action)"
  }
}

Write-Host ''
Write-Host "Project local_config=$localConfig example_config=$exampleConfig gitignore=$localConfigGitignore"
