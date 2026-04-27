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

$status = 'ready'
$dependencyStatus = 'ready'
$installStatus = 'ready'
$skillStatus = 'ready'
$projectStatus = 'not-applicable'
$nextAction = ''
$globalAgentBrowserSkill = Join-Path $HOME '.agents/skills/agent-browser/SKILL.md'
$agentBrowserInstallMarker = Join-Path $HOME '.agent-browser/spec-first-install.json'

if (-not (Test-CommandExists 'agent-browser')) {
  $dependencyStatus = 'missing'
  $installStatus = 'action-required'
  if ($mode -eq 'verify-only') {
    $status = 'action-required'
    $nextAction = 'install agent-browser CLI'
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
  if (-not (Invoke-HelperCommand { npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y })) {
    $status = 'action-required'
    $skillStatus = 'action-required'
    $nextAction = 'install global agent-browser skill manually'
  }
}

[pscustomobject]@{
  helper_tools = [ordered]@{
    'agent-browser' = [ordered]@{
      required = $true
      type = 'helper'
      dependency_status = $dependencyStatus
      host_config_status = 'not-applicable'
      install_status = $installStatus
      skill_status = $skillStatus
      project_status = $projectStatus
      result = $status
      next_action = $nextAction
    }
  }
} | ConvertTo-Json -Compress -Depth 8
