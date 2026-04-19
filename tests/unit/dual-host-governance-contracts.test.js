'use strict';

const fs = require('node:fs');
const path = require('node:path');

const CodexAdapter = require('../../src/cli/adapters/codex');
const { buildFilteredAssetSet } = require('../../src/cli/plugin');

const REPO_ROOT = path.join(__dirname, '..', '..');
const GOVERNANCE_CONTRACT_PATH = path.join(
  REPO_ROOT,
  'docs/contracts/dual-host-governance/README.md',
);
const DOCS_SIDE_GOVERNANCE_DIR = path.join(
  REPO_ROOT,
  'docs/contracts/dual-host-governance',
);
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');
const README_PATH = path.join(REPO_ROOT, 'README.md');
const RELEASE_SMOKE_PATH = path.join(REPO_ROOT, 'tests/smoke/release-dual-host-governance.sh');
const MCP_SETUP_SKILL_PATH = path.join(REPO_ROOT, 'skills/spec-mcp-setup/SKILL.md');
const SETUP_SKILL_PATH = path.join(REPO_ROOT, 'skills/setup/SKILL.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(read(filePath));
}

describe('dual-host governance contracts', () => {
  test('governance contract fixes Codex compatibility-layer decision and filtered asset set schema', () => {
    const contract = read(GOVERNANCE_CONTRACT_PATH);

    expect(contract).toContain('不再为 Codex 安装 `.codex/commands/spec/*`');
    expect(contract).toContain('src/cli/contracts/dual-host-governance/skills-governance.json');
    expect(contract).toContain('src/cli/contracts/dual-host-governance/skills-governance.schema.json');
    expect(contract).not.toContain('docs/contracts/dual-host-governance/skills-governance.json');
    expect(contract).toContain('entry_surface');
    expect(contract).toContain('host_scope');
    expect(contract).toContain('host_delivery');
    expect(contract).toContain('filtered asset set');
    expect(contract).toContain('commands');
    expect(contract).toContain('workflowSkills');
    expect(contract).toContain('skills');
    expect(contract).toContain('skipped');
    expect(contract).toContain('至少还要有一个非 `owner_host` 宿主可交付');
  });

  test('codex adapter stops installing command files but retains cleanup path', () => {
    const adapter = new CodexAdapter();

    expect(adapter.hasCommands).toBe(false);
    expect(adapter.commandRoot).toBe('.codex/commands/spec');
    expect(adapter.skillsRoot).toBe('.agents/skills');
    expect(adapter.workflowsRoot).toBe('.agents/skills');
  });

  test('default release gate covers both governance relocation and full tarball install regression', () => {
    const pkg = readJson(PACKAGE_JSON_PATH);

    expect(pkg.scripts['test:release']).toContain('test:release:governance');
    expect(pkg.scripts['test:release']).toContain('test:release:install');
    expect(pkg.scripts['test:release:governance']).toContain('release-dual-host-governance.sh');
    expect(pkg.scripts['test:release:install']).toContain('install-tarball.sh');
  });

  test('docs-side governance directory keeps only the human-readable contract', () => {
    expect(fs.readdirSync(DOCS_SIDE_GOVERNANCE_DIR).sort((a, b) => a.localeCompare(b))).toEqual([
      'README.md',
    ]);
  });

  test('release governance smoke forbids docs-side machine-readable assets from tarball payload', () => {
    const releaseSmoke = read(RELEASE_SMOKE_PATH);

    expect(releaseSmoke).toContain('package/docs/contracts/dual-host-governance/skills-governance.json');
    expect(releaseSmoke).toContain('package/docs/contracts/dual-host-governance/skills-governance.schema.json');
    expect(releaseSmoke).toContain('tar -tf "$TARBALL_PATH" | grep -q');
    expect(releaseSmoke).toContain('if tar -tf "$TARBALL_PATH" | grep -q');
  });

  test('Codex-facing docs use $spec-* or $setup instead of /spec:*', () => {
    const readme = read(README_PATH);
    const mcpSetup = read(MCP_SETUP_SKILL_PATH);
    const setup = read(SETUP_SKILL_PATH);

    expect(readme).toContain('$spec-mcp-setup');
    expect(readme).not.toContain('$spec-bootstrap');
    expect(readme).not.toContain('Codex now also receives shared `/spec:*` command files under `.codex/commands/spec/`');

    expect(mcpSetup).toContain('**Codex entry point:** `$spec-mcp-setup [quick|custom]`');
    expect(mcpSetup).not.toContain('**Codex entry point:** `/spec:mcp-setup [quick|custom]`');

    expect(setup).toContain('**Codex entry point:** `$setup`');
    expect(setup).not.toContain('**Codex entry point:** `/spec:setup`');
  });

  test('README runtime counts stay aligned with current bundled assets', () => {
    const readme = read(README_PATH);
    const claudeAssets = buildFilteredAssetSet('claude');

    expect(readme).toContain(
      `| Capability layer | Ships with \`${claudeAssets.skills.length + claudeAssets.workflowSkills.length}\` skills, \`${claudeAssets.agents.length}\` agents, and \`${claudeAssets.agentSupportFiles.length}\` agent support files |`,
    );
    expect(readme).toContain(`📦 Generated ${claudeAssets.commands.length} command file(s) in .claude/commands/spec`);
    expect(readme).toContain(`🧩 Generated ${claudeAssets.skills.length} skill directory(ies) in .claude/skills`);
    expect(readme).toContain(`🤖 Generated ${claudeAssets.agents.length} agent file(s) in .claude/agents`);
  });
});
