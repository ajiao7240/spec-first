param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

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

$detectedHost = Get-DetectedHost

switch ($detectedHost) {
  'claude' {
    $cliCommand = 'claude'
    $displayName = 'Claude Code'
    $configPath = [System.IO.Path]::Combine($HOME, '.claude.json')
    $markerPath = [System.IO.Path]::Combine($HOME, '.claude', 'spec-first', 'host-setup.json')
    $configFormat = 'json'
  }
  'codex' {
    $cliCommand = 'codex'
    $displayName = 'Codex'
    $configPath = [System.IO.Path]::Combine($HOME, '.codex', 'config.toml')
    $markerPath = [System.IO.Path]::Combine($HOME, '.codex', 'spec-first', 'host-setup.json')
    $configFormat = 'toml'
  }
  default {
    throw "错误：无法识别宿主：$detectedHost"
  }
}

[pscustomobject]@{
  host = $detectedHost
  display_name = $displayName
  cli_command = $cliCommand
  config_path = $configPath
  marker_path = $markerPath
  config_format = $configFormat
} | ConvertTo-Json -Compress
