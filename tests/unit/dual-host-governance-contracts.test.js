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
const README_ZH_PATH = path.join(REPO_ROOT, 'README.zh-CN.md');
const RELEASE_SMOKE_PATH = path.join(REPO_ROOT, 'tests/smoke/release-dual-host-governance.sh');
const MCP_SETUP_SKILL_PATH = path.join(REPO_ROOT, 'skills/spec-mcp-setup/SKILL.md');
const MCP_SETUP_TOOLS_PATH = path.join(REPO_ROOT, 'skills/spec-mcp-setup/mcp-tools.json');
const MCP_SETUP_VERIFY_SH_PATH = path.join(REPO_ROOT, 'skills/spec-mcp-setup/scripts/verify-tools.sh');
const MCP_SETUP_VERIFY_PS1_PATH = path.join(REPO_ROOT, 'skills/spec-mcp-setup/scripts/verify-tools.ps1');
const SETUP_SKILL_PATH = path.join(REPO_ROOT, 'skills/setup/SKILL.md');
const GRAPH_BOOTSTRAP_COMMAND_PATH = path.join(REPO_ROOT, 'templates/claude/commands/spec/graph-bootstrap.md');
const DOCS_MCP_SETUP_SKILL_PATH = path.join(REPO_ROOT, 'docs/10-prompt/skills/spec-mcp-setup/SKILL.md');
const DOCS_MCP_SETUP_FLOW_PATH = path.join(REPO_ROOT, 'docs/10-prompt/skills/spec-mcp-setup/execution-flow.md');
const DOCS_SETUP_SKILL_PATH = path.join(REPO_ROOT, 'docs/10-prompt/skills/setup/SKILL.md');
const RETIRED_BOOTSTRAP_NAME = ['spec', 'bootstrap'].join('-');
const RETIRED_CLAUDE_ENTRYPOINT = '/spec:' + 'bootstrap';
const RETIRED_CODEX_ENTRYPOINT = ['$spec', 'bootstrap'].join('-');
const RETIRED_WORKFLOW_PATH = `workflows/${RETIRED_BOOTSTRAP_NAME}`;
const RETIRED_SKILL_PATH = `skills/${RETIRED_BOOTSTRAP_NAME}`;

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
    expect(readme).not.toContain(RETIRED_CODEX_ENTRYPOINT);
    expect(readme).not.toContain('Codex now also receives shared `/spec:*` command files under `.codex/commands/spec/`');

    expect(mcpSetup).toContain('**Codex entry point:** `$spec-mcp-setup [quick|custom]`');
    expect(mcpSetup).not.toContain('**Codex entry point:** `/spec:mcp-setup [quick|custom]`');

    expect(setup).toContain('**Codex entry point:** `$setup`');
    expect(setup).not.toContain('**Codex entry point:** `/spec:setup`');
  });

  test('active source-of-truth surfaces no longer advertise retired bootstrap workflow', () => {
    const activeSurfaces = [
      README_PATH,
      README_ZH_PATH,
      MCP_SETUP_SKILL_PATH,
      MCP_SETUP_TOOLS_PATH,
      MCP_SETUP_VERIFY_SH_PATH,
      MCP_SETUP_VERIFY_PS1_PATH,
      SETUP_SKILL_PATH,
      GRAPH_BOOTSTRAP_COMMAND_PATH,
      DOCS_MCP_SETUP_SKILL_PATH,
      DOCS_MCP_SETUP_FLOW_PATH,
      DOCS_SETUP_SKILL_PATH,
    ];

    for (const surface of activeSurfaces) {
      const content = read(surface);

      expect(content).not.toContain(RETIRED_BOOTSTRAP_NAME);
      expect(content).not.toContain(RETIRED_CLAUDE_ENTRYPOINT);
      expect(content).not.toContain(RETIRED_CODEX_ENTRYPOINT);
      expect(content).not.toContain(RETIRED_WORKFLOW_PATH);
      expect(content).not.toContain(RETIRED_SKILL_PATH);
    }
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
