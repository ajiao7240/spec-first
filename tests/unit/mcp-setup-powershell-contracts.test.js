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
    expect(combined).toContain("schema_version = 'tool-facts.v2'");
    expect(combined).toContain('configured_dependencies');
    expect(combined).toContain('schema_capabilities');
    expect(combined).toContain("schema_version = 'runtime-capabilities.v1'");
    expect(combined).toContain("reason_code = 'setup-facts-ready'");
    expect(combined).toContain('tool-facts.json');
    expect(combined).toContain('runtime-capabilities.json');
    for (const section of [
      'Execution result',
      'MCP servers',
      'Helper tools',
      'Provider tools',
      'Host configured dependencies',
      'Install safety',
      'Project setup facts',
      'Verification profile',
      'Next steps',
    ]) {
      expect(read(verifyToolsPs1)).toContain(`title = '${section}'`);
    }
  });

  test('PowerShell helper verification keeps registry baseline semantics', () => {
    const installHelpersPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/install-helpers.ps1');
    const result = spawnPwsh(['-NoProfile', '-File', installHelpersPs1, '-VerifyOnly'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    if (result === null) {
      return;
    }

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.helper_tools['agent-browser']).toMatchObject({
      required: true,
      baseline_blocking: false,
      kind: 'browser-helper',
    });
    expect(payload.helper_tools['ast-grep']).toMatchObject({
      required: true,
      baseline_blocking: false,
      kind: 'cli',
    });
    expect(payload.helper_tools['ast-grep-skill']).toMatchObject({
      required: true,
      baseline_blocking: true,
      kind: 'global-skill',
    });
    expect(Object.values(payload.helper_tools).every((helper) => helper.profile && helper.kind && helper.safety && helper.reason_code)).toBe(true);
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
      expect(toolFacts.schema_version).toBe('tool-facts.v2');
      expect(toolFacts.tools.context7.status).toBe('ready');
      expect(toolFacts.items.some((item) => item.id === 'context7')).toBe(true);
      expect(Array.isArray(toolFacts.configured_dependencies)).toBe(true);
      expect(toolFacts.schema_capabilities).toContain('items');
      expect(toolFacts.schema_capabilities).toContain('configured_dependencies');
      expect(runtimeCapabilities.schema_version).toBe('runtime-capabilities.v1');
      expect(runtimeCapabilities.direct_evidence.bounded_source_reads).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('write-setup-facts repairs contradictory ready item projection when PowerShell is available', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-mcp-setup-conflict-'));
    try {
      const repo = path.join(tmp, 'repo');
      fs.mkdirSync(repo, { recursive: true });
      fs.writeFileSync(path.join(repo, 'package.json'), '{"name":"fixture"}\n');
      const factsPath = path.join(tmp, 'facts.json');
      fs.writeFileSync(factsPath, JSON.stringify({
        repo_status: 'git-repo',
        repo_root: repo,
        host: 'claude',
        tools: {
          context7: {
            dependency_status: 'ready',
            host_config_status: 'action-required',
            result: 'ready',
            reason_code: 'ready',
            next_action: 'configure host',
          },
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
      const toolFacts = JSON.parse(read(path.join(repo, '.spec-first/config/tool-facts.json')));
      expect(toolFacts.items.find((item) => item.id === 'context7')).toMatchObject({
        configured_status: 'action-required',
        result: 'action-required',
        reason_code: 'host-config-action-required',
      });
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('detect-tools treats npm @latest host config drift as non-blocking when PowerShell is available', () => {
    if (process.platform === 'win32') {
      return;
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-mcp-setup-drift-'));
    const managedParent = path.join(tmp, 'managed-readonly');
    try {
      const repo = path.join(tmp, 'repo');
      const home = path.join(tmp, 'home');
      fs.mkdirSync(repo, { recursive: true });
      fs.mkdirSync(home, { recursive: true });
      fs.mkdirSync(managedParent, { recursive: true });
      fs.writeFileSync(path.join(repo, 'package.json'), '{"name":"fixture"}\n');
      spawnSync('git', ['init'], { cwd: repo, encoding: 'utf8' });
      fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({
        mcpServers: {
          'sequential-thinking': {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
          },
          context7: {
            command: 'npx',
            args: ['-y', '@upstash/context7-mcp'],
          },
        },
      }));
      const managedPath = path.join(managedParent, 'managed-mcp.json');
      fs.writeFileSync(managedPath, '{}\n');
      fs.chmodSync(managedParent, 0o500);
      fs.chmodSync(managedPath, 0o400);

      const result = spawnPwsh(['-NoProfile', '-File', detectToolsPs1, '-Repo', repo], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          MCP_SETUP_HOST: 'claude',
          HOME: home,
          MCP_SETUP_CLAUDE_MANAGED_PATH_OVERRIDE: managedPath,
        },
      });
      if (result === null) {
        return;
      }

      expect(result.status).toBe(0);
      const payload = JSON.parse(result.stdout);
      expect(payload.tools.context7).toMatchObject({
        host_config_status: 'registry-args-drift',
        result: 'degraded',
        reason_code: 'host-config-version-drift',
        next_action: '',
      });
      expect(payload.tools['sequential-thinking']).toMatchObject({
        host_config_status: 'registry-args-drift',
        result: 'degraded',
        reason_code: 'host-config-version-drift',
        next_action: '',
      });
    } finally {
      try { fs.chmodSync(managedParent, 0o700); } catch (_error) {}
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
