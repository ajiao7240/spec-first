const fs = require('fs');
const os = require('node:os');
const path = require('path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '../..');
const configureHostPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/configure-host.ps1');
const detectToolsPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/detect-tools.ps1');
const verifyToolsPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/verify-tools.ps1');
const writeSetupFactsPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/write-setup-facts.ps1');
const mcpToolsJsonPath = path.join(repoRoot, 'skills/spec-mcp-setup/mcp-tools.json');
const mcpSetupSkillPath = path.join(repoRoot, 'skills/spec-mcp-setup/SKILL.md');

function spawnPwsh(args, options = {}) {
  const result = spawnSync('pwsh', args, options);
  if (result.error && result.error.code === 'ENOENT') {
    return null;
  }
  return result;
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('spec-mcp-setup PowerShell setup facts contract', () => {
  test('host config writes remain atomic and rollback guarded', () => {
    const source = read(configureHostPs1);

    expect(source).toContain('function Acquire-ConfigLock');
    expect(source).toContain('function Release-ConfigLock');
    expect(source).toContain('$LockPath = "$ConfigPath.lock"');
    expect(source).toContain('[System.IO.FileShare]::None');
    expect(source).toContain('function Restore-Backup');
    expect(source).toContain('Restore-Backup -BackupPath $backupPath');
    expect(source).toContain('Set-TextFileAtomic -Path $ConfigPath -Value ($config | ConvertTo-Json -Depth 8)');
  });

  test('setup sources use direct setup facts only', () => {
    const toolsJson = JSON.parse(read(mcpToolsJsonPath));
    const combined = [
      read(detectToolsPs1),
      read(verifyToolsPs1),
      read(writeSetupFactsPs1),
      read(mcpSetupSkillPath),
    ].join('\n');

    expect(toolsJson.schema_version).toBe('6');
    expect(toolsJson.tools.map((tool) => tool.id)).toEqual(['sequential-thinking', 'context7']);
    expect(toolsJson.tools.every((tool) => tool.category === 'mcp')).toBe(true);
    expect(toolsJson.tools.every((tool) => !Object.prototype.hasOwnProperty.call(tool, 'provider_config'))).toBe(true);
    expect(toolsJson.tools.every((tool) => !Object.prototype.hasOwnProperty.call(tool, 'provider_role'))).toBe(true);
    expect(combined).toContain("schema_version = 'tool-facts.v1'");
    expect(combined).toContain("schema_version = 'runtime-capabilities.v1'");
    expect(combined).toContain("reason_code = 'setup-facts-ready'");
    expect(combined).toContain('tool-facts.json');
    expect(combined).toContain('runtime-capabilities.json');
  });

  test('write-setup-facts writes setup facts when PowerShell is available', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-mcp-setup-'));
    try {
      const repo = path.join(tmp, 'repo');
      fs.mkdirSync(repo, { recursive: true });
      fs.writeFileSync(path.join(repo, 'package.json'), '{"name":"fixture"}\n');
      const factsPath = path.join(tmp, 'facts.json');
      fs.writeFileSync(factsPath, JSON.stringify({
        repo_status: 'git-repo',
        repo_root: repo,
        host: 'codex',
        baseline_ready: true,
        tools: {
          context7: { status: 'ready' },
        },
        target: {
          target_kind: 'child_git_repo',
          target_root: repo,
          state_write_allowed: true,
          reason_code: 'explicit-repo-target',
        },
      }));

      const result = spawnPwsh(['-NoProfile', '-File', writeSetupFactsPs1, '-FactsFile', factsPath], {
        cwd: repoRoot,
        encoding: 'utf8',
      });
      if (result === null) {
        return;
      }

      expect(result.status).toBe(0);
      const stdout = JSON.parse(result.stdout);
      const toolFacts = JSON.parse(read(path.join(repo, '.spec-first/config/tool-facts.json')));
      const runtimeCapabilities = JSON.parse(read(path.join(repo, '.spec-first/config/runtime-capabilities.json')));

      expect(stdout.reason_code).toBe('setup-facts-ready');
      expect(stdout.tool_facts_path).toContain('tool-facts.json');
      expect(stdout.runtime_capabilities_path).toContain('runtime-capabilities.json');
      expect(toolFacts.schema_version).toBe('tool-facts.v1');
      expect(toolFacts.tools.context7.status).toBe('ready');
      expect(runtimeCapabilities.schema_version).toBe('runtime-capabilities.v1');
      expect(runtimeCapabilities.direct_evidence.bounded_source_reads).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
