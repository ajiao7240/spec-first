const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const configureHostPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/configure-host.ps1');
const detectToolsPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/detect-tools.ps1');
const verifyToolsPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/verify-tools.ps1');

describe('spec-mcp-setup PowerShell host config contract', () => {
  const source = fs.readFileSync(configureHostPs1, 'utf8');

  test('serializes writes with a config-path scoped lock', () => {
    expect(source).toContain('function Acquire-ConfigLock');
    expect(source).toContain('function Release-ConfigLock');
    expect(source).toContain('$LockPath = "$ConfigPath.lock"');
    expect(source).toContain('[System.IO.FileShare]::None');
    expect(source).toContain('$ConfigLock = Acquire-ConfigLock');
    expect(source).toContain('finally');
    expect(source).toContain('Release-ConfigLock -LockHandle $ConfigLock');
  });

  test('keeps backup, verify, and rollback before reporting success', () => {
    expect(source).toContain('Copy-Item $ConfigPath $path');
    expect(source).toContain('function Restore-Backup');
    expect(source).toContain('Restore-Backup -BackupPath $backupPath');
    expect(source).toContain('if (-not (Test-ToolConfigured))');
    expect(source.indexOf('if (-not (Test-ToolConfigured))')).toBeLessThan(source.indexOf('ConvertTo-Json -Compress', source.indexOf('if (-not (Test-ToolConfigured))')));
  });

  test('readiness ledger does not expose retired graph runtime facts', () => {
    const retiredGraph = 'cr' + 'g';
    const nativeModules = 'native' + '_modules_status';
    const sqliteDep = 'better' + '-sqlite3';
    const parserDep = 'tree' + '-sitter';
    const providerKey = 'graph' + '_providers';
    const detectSource = fs.readFileSync(detectToolsPs1, 'utf8');
    const verifySource = fs.readFileSync(verifyToolsPs1, 'utf8');
    const combined = `${detectSource}\n${verifySource}`;

    expect(combined).not.toContain(`${retiredGraph}.`);
    expect(combined).not.toContain(nativeModules);
    expect(combined).not.toContain(sqliteDep);
    expect(combined).not.toContain(parserDep);
    expect(combined).toContain(providerKey);
    expect(verifySource).toContain("schema_version = 'v2'");
  });

  test('uses shared TOML helpers for quoted Codex MCP keys', () => {
    const configureSource = fs.readFileSync(configureHostPs1, 'utf8');
    const detectSource = fs.readFileSync(detectToolsPs1, 'utf8');

    expect(configureSource).toContain("Join-Path $ScriptDir 'lib-toml.ps1'");
    expect(configureSource).toContain('Write-TomlMcpSection -Path $ConfigPath -Key $ToolDef.detection.key');
    expect(detectSource).toContain("Join-Path $ScriptDir 'lib-toml.ps1'");
    expect(detectSource).toContain('Get-TomlMcpSection -Path $ConfigPath -Key $Tool.detection.key');
  });
});
