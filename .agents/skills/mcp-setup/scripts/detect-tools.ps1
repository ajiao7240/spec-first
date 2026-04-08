param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillDir = Split-Path -Parent $ScriptDir
$HostInfo = & (Join-Path $ScriptDir 'detect-host.ps1') | ConvertFrom-Json
$DetectedHost = $HostInfo.host
$ConfigPath = $HostInfo.config_path
$ToolsJson = Get-Content -Raw (Join-Path $SkillDir 'mcp-tools.json') | ConvertFrom-Json

$installed = New-Object System.Collections.Generic.List[string]
$missing = New-Object System.Collections.Generic.List[string]

foreach ($tool in $ToolsJson.tools) {
  $found = $false

  switch ($tool.detect.method) {
    'mcp_config' {
      $detectKey = $tool.detect.key
      if ((Test-Path $ConfigPath)) {
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
        Invoke-Expression $tool.detect.command | Out-Null
        $found = $true
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
