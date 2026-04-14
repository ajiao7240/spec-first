param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillDir = Split-Path -Parent $ScriptDir
$HostInfo = & (Join-Path $ScriptDir 'detect-host.ps1') | ConvertFrom-Json
$DetectedHost = $HostInfo.host
$ConfigPath = $HostInfo.config_path
$ToolsJson = Get-Content -Raw (Join-Path $SkillDir 'mcp-tools.json') | ConvertFrom-Json
$HostContext = if ($DetectedHost -eq 'codex') { 'codex' } else { 'ide-assistant' }

function Get-TomlSection {
  param(
    [string]$Path,
    [string]$SectionName
  )

  if (-not (Test-Path $Path)) {
    return @()
  }

  $sectionHeader = "[mcp_servers.$SectionName]"
  $lines = Get-Content $Path
  $capturing = $false
  $sectionLines = New-Object System.Collections.Generic.List[string]

  foreach ($line in $lines) {
    if ($line -eq $sectionHeader) {
      $capturing = $true
      continue
    }

    if ($capturing -and $line -match '^\[mcp_servers\..+\]$') {
      break
    }

    if ($capturing) {
      $sectionLines.Add($line)
    }
  }

  return @($sectionLines)
}

function Get-ExpectedToolConfig {
  param([object]$Tool)

  $args = @()
  foreach ($arg in @($Tool.mcp_config.args)) {
    if ($arg -eq '__HOST_CONTEXT__') {
      $args += $HostContext
    } else {
      $args += $arg
    }
  }

  return @{
    command = $Tool.mcp_config.command
    args = $args
  }
}

$installed = New-Object System.Collections.Generic.List[string]
$missing = New-Object System.Collections.Generic.List[string]

foreach ($tool in $ToolsJson.tools) {
  $found = $false

  switch ($tool.detect.method) {
    'mcp_config' {
      $detectKey = $tool.detect.key
      $expected = Get-ExpectedToolConfig -Tool $tool
      if ((Test-Path $ConfigPath)) {
        if ($DetectedHost -eq 'claude') {
          try {
            $config = Get-Content -Raw $ConfigPath | ConvertFrom-Json
            $server = $config.mcpServers.PSObject.Properties[$detectKey].Value
            if ($null -ne $server -and
                $server.command -eq $expected.command -and
                (@($server.args) -join "`n") -eq (@($expected.args) -join "`n")) {
              $found = $true
            }
          } catch {
            $found = $false
          }
        } elseif ($DetectedHost -eq 'codex') {
          $block = Get-TomlSection -Path $ConfigPath -SectionName $detectKey
          $blockText = ($block -join "`n")
          if ($blockText.Contains("command = `"$($expected.command)`"")) {
            $allArgsFound = $true
            foreach ($expectedArg in $expected.args) {
              if (-not $blockText.Contains($expectedArg)) {
                $allArgsFound = $false
                break
              }
            }

            if ($allArgsFound) {
            $found = $true
            }
          }
        }
      }
    }
    'mcp_key_only' {
      $detectKey = $tool.detect.key
      if (Test-Path $ConfigPath) {
        if ($DetectedHost -eq 'claude') {
          try {
            $config = Get-Content -Raw $ConfigPath | ConvertFrom-Json
            if ($null -ne $config.mcpServers.PSObject.Properties[$detectKey]) {
              $found = $true
            }
          } catch {
            $found = $false
          }
        } elseif ($DetectedHost -eq 'codex') {
          if (Select-String -Path $ConfigPath -SimpleMatch "[mcp_servers.$detectKey]" -Quiet) {
            $found = $true
          }
        }
      }
    }
    'command' {
      try {
        $detectProc = Start-Process -FilePath 'pwsh' -ArgumentList '-c',$tool.detect.command -NoNewWindow -PassThru -RedirectStandardOutput NUL -RedirectStandardError NUL
        if ($detectProc.WaitForExit(10000)) {
          if ($detectProc.ExitCode -eq 0) { $found = $true }
        } else {
          $detectProc.Kill()
        }
      } catch {
        $found = $false
      }
    }
  }

  if ($found) {
    $installed.Add($tool.id)
  } else {
    $missing.Add($tool.id)
  }
}

[pscustomobject]@{
  installed = @($installed)
  missing = @($missing)
} | ConvertTo-Json -Compress -Depth 4
