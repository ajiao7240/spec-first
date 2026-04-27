'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runInit } = require('../../src/cli/commands/init');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.join(__dirname, '..', '..');

const LOCAL_AGENT_BROWSER_DIR = path.join(REPO_ROOT, 'skills', 'agent-browser');
const PLUGIN_MANIFEST_PATH = path.join(REPO_ROOT, '.claude-plugin', 'plugin.json');
const GOVERNANCE_PATH = path.join(
  REPO_ROOT,
  'src',
  'cli',
  'contracts',
  'dual-host-governance',
  'skills-governance.json',
);
const MCP_TOOLS_PATH = path.join(REPO_ROOT, 'skills', 'spec-mcp-setup', 'mcp-tools.json');
const MCP_SETUP_SKILL_PATH = path.join(REPO_ROOT, 'skills', 'spec-mcp-setup', 'SKILL.md');
const MCP_SETUP_CHECK_HEALTH_PATH = path.join(REPO_ROOT, 'skills', 'spec-mcp-setup', 'scripts', 'check-health');
const MCP_SETUP_REFERENCE_PATH = path.join(
  REPO_ROOT,
  'skills',
  'spec-mcp-setup',
  'references',
  'supported-mcp-tools.md',
);
const SPEC_SETUP_SKILL_PATH = path.join(REPO_ROOT, 'skills', 'spec-setup', 'SKILL.md');
const SPEC_SETUP_CHECK_HEALTH_PATH = path.join(REPO_ROOT, 'skills', 'spec-setup', 'scripts', 'check-health');

const DOWNSTREAM_PROMPTS = [
  path.join(REPO_ROOT, 'skills', 'test-browser', 'SKILL.md'),
  path.join(REPO_ROOT, 'skills', 'feature-video', 'references', 'tier-browser-reel.md'),
  path.join(REPO_ROOT, 'skills', 'feature-video', 'references', 'tier-static-screenshots.md'),
  path.join(REPO_ROOT, 'skills', 'frontend-design', 'SKILL.md'),
  path.join(REPO_ROOT, 'skills', 'spec-polish-beta', 'SKILL.md'),
];

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(read(filePath));
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-browser-helper-'));
}

function withCwd(cwd, fn) {
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    return fn();
  } finally {
    process.chdir(previous);
  }
}

function captureInit(cwd, args) {
  const logs = [];
  const errors = [];
  const warns = [];
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  console.log = (message = '') => logs.push(String(message));
  console.error = (message = '') => errors.push(String(message));
  console.warn = (message = '') => warns.push(String(message));
  try {
    const exitCode = withCwd(cwd, () => runInit(args));
    return {
      exitCode,
      stdout: logs.join('\n'),
      stderr: errors.join('\n'),
      warnings: warns.join('\n'),
    };
  } finally {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  }
}

function writeOldClaudeStateWithAgentBrowser(projectRoot) {
  const statePath = path.join(projectRoot, '.claude', 'spec-first', 'state.json');
  const skillPath = path.join(projectRoot, '.claude', 'skills', 'agent-browser', 'SKILL.md');

  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.mkdirSync(path.dirname(skillPath), { recursive: true });
  fs.writeFileSync(skillPath, 'name: agent-browser\nold local runtime copy\n', 'utf8');
  fs.writeFileSync(
    statePath,
    `${JSON.stringify({
      manifestVersion: '0.0.0-old',
      platform: 'claude',
      developer: {
        path: '.claude/spec-first/.developer',
        name: 'reviewer',
        lang: 'zh',
        initializedAt: '2026-04-01T00:00:00.000Z',
        version: '1.5.9',
      },
      commands: [],
      skills: ['agent-browser'],
      workflowSkills: [],
      agents: [],
      agentSupportFiles: [],
    }, null, 2)}\n`,
    'utf8',
  );
}

describe('browser helper tool contracts', () => {
  test('agent-browser is external helper tooling, not a bundled source skill', () => {
    const manifest = readJson(PLUGIN_MANIFEST_PATH);
    const governance = readJson(GOVERNANCE_PATH);
    const mcpTools = readJson(MCP_TOOLS_PATH);

    expect(fs.existsSync(LOCAL_AGENT_BROWSER_DIR)).toBe(false);
    expect(manifest.skills).not.toContain('agent-browser');
    expect(governance.skills.map((entry) => entry.skill_name)).not.toContain('agent-browser');
    expect(mcpTools.tools.map((tool) => tool.id)).not.toContain('agent-browser');
  });

  test('spec-mcp-setup owns agent-browser helper detection and install handoff', () => {
    const setupSkill = read(MCP_SETUP_SKILL_PATH);
    const checkHealth = read(MCP_SETUP_CHECK_HEALTH_PATH);
    const reference = read(MCP_SETUP_REFERENCE_PATH);

    expect(setupSkill).toContain('browser automation helper substrate');
    expect(setupSkill).toContain('`agent-browser` is required');
    expect(setupSkill).toContain('helper_tools');
    expect(setupSkill).toContain('Tool | Type | Required | Dependency | Host Config | Project Bootstrap | Result | Next Action');
    expect(setupSkill).toContain('required MCP tools');
    expect(setupSkill).toContain('not-applicable` -> `n/a');
    expect(setupSkill).toContain('optional-pending');
    expect(setupSkill).toContain('npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y');
    expect(checkHealth).toContain('"agent-browser|required"');
    expect(checkHealth).toContain('--json');
    expect(checkHealth).toContain('Tool install status');
    expect(checkHealth).toContain('Required');
    expect(checkHealth).toContain('Status');
    expect(checkHealth).toContain('npm install -g agent-browser');
    expect(checkHealth).toContain('agent-browser install');
    expect(checkHealth).toContain('npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y');
    expect(reference).toContain('not listed in the MCP Tool Index');
    expect(reference).toContain('agent-browser skills get core');
  });

  test('check-health JSON exposes agent-browser as required helper table input', () => {
    const result = spawnSync('bash', [MCP_SETUP_CHECK_HEALTH_PATH, '--json'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);

    const payload = JSON.parse(result.stdout);
    const agentBrowser = payload.tools.find((tool) => tool.id === 'agent-browser');
    expect(agentBrowser).toMatchObject({
      required: true,
      host_config_status: 'not-applicable',
      project_status: 'not-applicable',
    });
    expect(['ready', 'missing']).toContain(agentBrowser.dependency_status);
  });

  test('spec-setup delegates instead of keeping a second agent-browser installer', () => {
    const setupSkill = read(SPEC_SETUP_SKILL_PATH);
    const setupHealth = read(SPEC_SETUP_CHECK_HEALTH_PATH);

    expect(setupSkill).toContain('Browser automation setup is owned by `spec-mcp-setup`');
    expect(setupSkill).toContain('/spec:mcp-setup');
    expect(setupSkill).toContain('$spec-mcp-setup');
    expect(setupHealth).not.toContain('npm install -g agent-browser');
    expect(setupHealth).not.toContain('npx skills add https://github.com/vercel-labs/agent-browser');
  });

  test('downstream browser prompts keep CLI usage and dual-host missing-tool guidance', () => {
    for (const promptPath of DOWNSTREAM_PROMPTS) {
      const prompt = read(promptPath);

      expect(prompt).toContain('agent-browser');
      expect(prompt).not.toContain('skills/agent-browser');
      expect(prompt).not.toMatch(/load\/use the `agent-browser` skill/i);
    }

    const testBrowser = read(path.join(REPO_ROOT, 'skills', 'test-browser', 'SKILL.md'));
    expect(testBrowser).toContain('Use `agent-browser` Only For Browser Automation');
    expect(testBrowser).toContain('agent-browser open');
    expect(testBrowser).toContain('agent-browser snapshot -i');
    expect(testBrowser).toContain('/spec:mcp-setup');
    expect(testBrowser).toContain('$spec-mcp-setup');
    expect(testBrowser).toContain('agent-browser skills get core');
  });

  test('Claude init removes obsolete local agent-browser runtime copies from old managed state', () => {
    const projectRoot = makeTempDir();
    try {
      writeOldClaudeStateWithAgentBrowser(projectRoot);

      const dryRun = captureInit(projectRoot, ['--claude', '--dry-run', '-u', 'reviewer', '--lang', 'zh']);
      expect(dryRun.exitCode).toBe(0);
      expect(dryRun.stderr).toBe('');
      expect(dryRun.stdout).toContain('Would perform a managed hard reset before regenerating runtime assets');
      expect(dryRun.stdout).toContain('Would remove');

      const apply = captureInit(projectRoot, ['--claude', '-u', 'reviewer', '--lang', 'zh']);
      expect(apply.exitCode).toBe(0);
      expect(apply.stderr).toBe('');
      expect(fs.existsSync(path.join(projectRoot, '.claude', 'skills', 'agent-browser'))).toBe(false);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
