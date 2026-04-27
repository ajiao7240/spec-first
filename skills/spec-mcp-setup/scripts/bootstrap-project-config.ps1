#!/usr/bin/env pwsh
# bootstrap-project-config.ps1 - Apply explicit project-local setup actions.

param(
  [switch]$RefreshExample,
  [switch]$CreateLocal,
  [switch]$EnsureGitignore,
  [switch]$DeleteLegacyMarkdown,
  [switch]$Json
)

$ErrorActionPreference = 'Stop'

function Write-Result {
  param(
    [string]$OverallStatus,
    [string]$Reason,
    [string]$RepoRoot,
    [string]$ExampleStatus,
    [string]$LocalStatus,
    [string]$GitignoreStatus,
    [string]$LegacyMarkdownStatus,
    [string]$LegacyConfigStatus
  )

  $payload = [ordered]@{
    schema_version = 'project-config-bootstrap.v1'
    overall_status = $OverallStatus
    reason = $Reason
    repo_root = $RepoRoot
    project = [ordered]@{
      example_config_status = $ExampleStatus
      local_config_status = $LocalStatus
      local_config_gitignore_status = $GitignoreStatus
    }
    legacy = [ordered]@{
      compound_engineering_markdown_status = $LegacyMarkdownStatus
      compound_engineering_config_status = $LegacyConfigStatus
    }
  }

  if ($Json) {
    $payload | ConvertTo-Json -Compress
  } else {
    Write-Output "Project config bootstrap complete."
    Write-Output "  example_config: $ExampleStatus"
    Write-Output "  local_config: $LocalStatus"
    Write-Output "  local_config_gitignore: $GitignoreStatus"
    Write-Output "  legacy_markdown: $LegacyMarkdownStatus"
    Write-Output "  legacy_config: $LegacyConfigStatus"
  }
}

$insideRepo = $false
try {
  $insideRepo = ((git rev-parse --is-inside-work-tree 2>$null) -eq 'true')
} catch {
  $insideRepo = $false
}

if (-not $insideRepo) {
  Write-Result `
    -OverallStatus 'action-required' `
    -Reason 'not-git-repo' `
    -RepoRoot '' `
    -ExampleStatus 'not-applicable' `
    -LocalStatus 'not-applicable' `
    -GitignoreStatus 'not-applicable' `
    -LegacyMarkdownStatus 'not-applicable' `
    -LegacyConfigStatus 'not-applicable'
  exit 0
}

$repoRoot = (git rev-parse --show-toplevel)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$template = Join-Path (Split-Path -Parent $scriptDir) 'references/config-template.yaml'
$specDir = Join-Path $repoRoot '.spec-first'
$exampleConfig = Join-Path $specDir 'config.local.example.yaml'
$localConfig = Join-Path $specDir 'config.local.yaml'
$gitignore = Join-Path $repoRoot '.gitignore'
$legacyMarkdown = Join-Path $repoRoot 'compound-engineering.local.md'
$legacyConfig = Join-Path $repoRoot '.compound-engineering/config.local.yaml'

if (-not (Test-Path -LiteralPath $template -PathType Leaf)) {
  Write-Result `
    -OverallStatus 'action-required' `
    -Reason 'missing-template' `
    -RepoRoot $repoRoot `
    -ExampleStatus 'missing-template' `
    -LocalStatus 'skipped' `
    -GitignoreStatus 'skipped' `
    -LegacyMarkdownStatus 'skipped' `
    -LegacyConfigStatus 'skipped'
  exit 1
}

$exampleStatus = 'skipped'
$localStatus = 'skipped'
$gitignoreStatus = 'skipped'
$legacyMarkdownStatus = if (Test-Path -LiteralPath $legacyMarkdown -PathType Leaf) { 'present' } else { 'missing' }
$legacyConfigStatus = if (Test-Path -LiteralPath $legacyConfig -PathType Leaf) { 'present' } else { 'missing' }

if ($RefreshExample) {
  New-Item -ItemType Directory -Force -Path $specDir | Out-Null
  Copy-Item -LiteralPath $template -Destination $exampleConfig -Force
  $exampleStatus = 'refreshed'
}

if ($CreateLocal) {
  New-Item -ItemType Directory -Force -Path $specDir | Out-Null
  if (Test-Path -LiteralPath $localConfig -PathType Leaf) {
    $localStatus = 'already-exists'
  } else {
    Copy-Item -LiteralPath $template -Destination $localConfig
    $localStatus = 'created'
  }
}

if ($EnsureGitignore) {
  $line = '.spec-first/*.local.yaml'
  if (-not (Test-Path -LiteralPath $gitignore -PathType Leaf)) {
    New-Item -ItemType File -Path $gitignore | Out-Null
  }
  $content = Get-Content -LiteralPath $gitignore -ErrorAction SilentlyContinue
  if ($content -contains $line) {
    $gitignoreStatus = 'already-present'
  } else {
    Add-Content -LiteralPath $gitignore -Value $line
    $gitignoreStatus = 'added'
  }
}

if ($DeleteLegacyMarkdown) {
  if (Test-Path -LiteralPath $legacyMarkdown -PathType Leaf) {
    Remove-Item -LiteralPath $legacyMarkdown
    $legacyMarkdownStatus = 'deleted'
  } else {
    $legacyMarkdownStatus = 'missing'
  }
}

Write-Result `
  -OverallStatus 'ready' `
  -Reason '' `
  -RepoRoot $repoRoot `
  -ExampleStatus $exampleStatus `
  -LocalStatus $localStatus `
  -GitignoreStatus $gitignoreStatus `
  -LegacyMarkdownStatus $legacyMarkdownStatus `
  -LegacyConfigStatus $legacyConfigStatus
