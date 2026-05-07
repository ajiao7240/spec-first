param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillDir = Split-Path -Parent $ScriptDir
$ToolsJson = Get-Content -Raw (Join-Path $SkillDir 'mcp-tools.json') | ConvertFrom-Json -AsHashtable

function Test-CommandExists {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-DetectedHost {
  if ($env:MCP_SETUP_HOST -in @('claude', 'codex')) {
    return $env:MCP_SETUP_HOST
  }

  if (-not [string]::IsNullOrEmpty($env:CODEX_CI) -or
      -not [string]::IsNullOrEmpty($env:CODEX_MANAGED_BY_NPM) -or
      -not [string]::IsNullOrEmpty($env:CODEX_THREAD_ID) -or
      -not [string]::IsNullOrEmpty($env:CODEX_SANDBOX)) {
    return 'codex'
  }

  if (-not [string]::IsNullOrEmpty($env:CLAUDE_CODE_SSE_PORT) -or
      -not [string]::IsNullOrEmpty($env:CLAUDE_CODE_SESSION_ID) -or
      -not [string]::IsNullOrEmpty($env:CLAUDE_PROJECT_DIR)) {
    return 'claude'
  }

  if ((Test-CommandExists 'codex') -and -not (Test-CommandExists 'claude')) {
    return 'codex'
  }

  if ((Test-CommandExists 'claude') -and -not (Test-CommandExists 'codex')) {
    return 'claude'
  }

  throw '错误：无法自动识别宿主。请显式设置 MCP_SETUP_HOST=claude 或 MCP_SETUP_HOST=codex 后再运行。'
}

function Resolve-PathTemplate {
  param([string]$Template)
  if ($Template.StartsWith('$HOME')) {
    return $HOME + $Template.Substring(5)
  }
  return $Template
}

function Resolve-TargetPathOverride {
  param(
    [string]$HostName,
    [string]$TargetKey,
    [string]$ResolvedPath
  )

  if ($HostName -eq 'claude' -and $TargetKey -eq 'managed' -and -not [string]::IsNullOrWhiteSpace($env:MCP_SETUP_CLAUDE_MANAGED_PATH_OVERRIDE)) {
    return $env:MCP_SETUP_CLAUDE_MANAGED_PATH_OVERRIDE
  }
  if ($HostName -eq 'codex' -and $TargetKey -eq 'system' -and -not [string]::IsNullOrWhiteSpace($env:MCP_SETUP_CODEX_SYSTEM_PATH_OVERRIDE)) {
    return $env:MCP_SETUP_CODEX_SYSTEM_PATH_OVERRIDE
  }
  return $ResolvedPath
}

function Get-ExistingParent {
  param([string]$Path)
  $current = $Path
  while (-not [string]::IsNullOrWhiteSpace($current) -and -not (Test-Path $current)) {
    $next = Split-Path -Parent $current
    if ($next -eq $current) { break }
    $current = $next
  }
  return $current
}

function Test-TargetWritable {
  param(
    [string]$Path,
    [string]$CheckMode
  )

  if (Test-Path $Path) {
    try {
      $item = Get-Item $Path -ErrorAction Stop
      if (-not $item.PSIsContainer) {
        $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
        $stream.Dispose()
        return $true
      }
    } catch {
      if ($CheckMode -ne 'parent-or-file') { return $false }
    }
  }

  if ($CheckMode -eq 'file-only' -and -not (Test-Path $Path)) {
    return $false
  }

  $parent = Split-Path -Parent $Path
  $existingParent = Get-ExistingParent $parent
  if ([string]::IsNullOrWhiteSpace($existingParent) -or -not (Test-Path $existingParent)) {
    return $false
  }

  $probe = Join-Path $existingParent ('.write-test-' + [guid]::NewGuid().ToString('N'))
  try {
    [System.IO.File]::WriteAllText($probe, '')
    Remove-Item -Force $probe -ErrorAction SilentlyContinue
    return $true
  } catch {
    return $false
  }
}

function Get-HostContract {
  param([string]$HostName)
  $contracts = @($ToolsJson.tools | ForEach-Object {
    $cfg = $_.host_config[$HostName]
    [ordered]@{
      scope = $cfg.scope
      targets = $cfg.targets
      fallback_order = $cfg.fallback_order
      uninstall_targets = $cfg.uninstall_targets
    } | ConvertTo-Json -Depth 20 -Compress
  })
  $uniqueContracts = @($contracts | Select-Object -Unique)
  if ($uniqueContracts.Count -ne 1) {
    throw "错误：$HostName 宿主配置元数据在不同工具之间不一致，请先统一 mcp-tools.json"
  }
  return ($uniqueContracts[0] | ConvertFrom-Json -AsHashtable)
}

function Get-TargetFact {
  param(
    [hashtable]$McpHostContract,
    [string]$Platform,
    [string]$TargetKey
  )

  $target = $McpHostContract.targets[$TargetKey]
  $rawPath = if ($target.config_path -is [hashtable]) { $target.config_path[$Platform] } else { $target.config_path }
  $resolvedPath = Resolve-PathTemplate $rawPath
  $resolvedPath = Resolve-TargetPathOverride -HostName $detectedHost -TargetKey $TargetKey -ResolvedPath $resolvedPath
  $exists = Test-Path $resolvedPath
  $writableCheck = if ($target.ContainsKey('writable_check')) { $target.writable_check } else { 'parent-or-file' }
  $writable = Test-TargetWritable -Path $resolvedPath -CheckMode $writableCheck

  return [ordered]@{
    key = $TargetKey
    config_path = $resolvedPath
    config_format = $target.config_format
    precedence = [int]$target.precedence
    writable_check = $writableCheck
    exists = [bool]$exists
    writable = [bool]$writable
  }
}

$detectedHost = Get-DetectedHost
$platform = if ($IsWindows) { 'windows' } elseif ($IsMacOS) { 'macos' } elseif ($IsLinux) { 'linux' } else { 'unknown' }

switch ($detectedHost) {
  'claude' {
    $cliCommand = 'claude'
    $displayName = 'Claude Code'
    $markerPath = [System.IO.Path]::Combine($HOME, '.claude', 'spec-first', 'host-setup.json')
    $configFormat = 'json'
  }
  'codex' {
    $cliCommand = 'codex'
    $displayName = 'Codex'
    $markerPath = [System.IO.Path]::Combine($HOME, '.codex', 'spec-first', 'host-setup.json')
    $configFormat = 'toml'
  }
  default {
    throw "错误：无法识别宿主：$detectedHost"
  }
}

$mcpHostContract = Get-HostContract $detectedHost
$primaryScope = $mcpHostContract.scope
$fallbackOrder = @($mcpHostContract.fallback_order)
$uninstallTargets = @($mcpHostContract.uninstall_targets)
$targets = [ordered]@{}
foreach ($targetKey in $mcpHostContract.targets.Keys) {
  $targets[$targetKey] = Get-TargetFact -McpHostContract $mcpHostContract -Platform $platform -TargetKey $targetKey
}

$selectedScope = ''
$selectedTarget = $null
foreach ($scopeKey in $fallbackOrder) {
  $candidate = $targets[$scopeKey]
  if ($null -ne $candidate -and $candidate.writable) {
    $selectedScope = $scopeKey
    $selectedTarget = $candidate
    break
  }
}
if ([string]::IsNullOrWhiteSpace($selectedScope) -and $fallbackOrder.Count -gt 0) {
  $selectedScope = $fallbackOrder[0]
  $selectedTarget = $targets[$selectedScope]
}

$precedenceBlocked = $false
$precedenceBlockingScope = ''
$precedenceBlockingPath = ''
$higherPrecedenceTargets = New-Object System.Collections.Generic.List[object]
if ($detectedHost -eq 'codex' -and $null -ne $selectedTarget) {
  foreach ($entry in $targets.GetEnumerator()) {
    if ($entry.Key -eq $selectedScope) { continue }
    if ($entry.Value.exists -and [int]$entry.Value.precedence -gt [int]$selectedTarget.precedence) {
      $higherPrecedenceTargets.Add([ordered]@{
        key = $entry.Key
        config_path = $entry.Value.config_path
        precedence = [int]$entry.Value.precedence
      })
    }
  }
}

[pscustomobject]@{
  host = $detectedHost
  display_name = $displayName
  cli_command = $cliCommand
  config_path = if ($null -ne $selectedTarget) { $selectedTarget.config_path } else { '' }
  marker_path = $markerPath
  config_format = $configFormat
  platform = $platform
  primary_scope = $primaryScope
  selected_scope = $selectedScope
  selected_writable = if ($null -ne $selectedTarget) { [bool]$selectedTarget.writable } else { $false }
  selected_exists = if ($null -ne $selectedTarget) { [bool]$selectedTarget.exists } else { $false }
  fallback_order = @($fallbackOrder)
  uninstall_targets = @($uninstallTargets)
  targets = $targets
  precedence_blocked = [bool]$precedenceBlocked
  precedence_blocking_scope = $precedenceBlockingScope
  precedence_blocking_path = $precedenceBlockingPath
  higher_precedence_targets = @($higherPrecedenceTargets)
} | ConvertTo-Json -Depth 8 -Compress
