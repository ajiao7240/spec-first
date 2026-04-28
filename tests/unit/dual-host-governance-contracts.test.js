'use strict';

const fs = require('node:fs');
const path = require('node:path');

const CodexAdapter = require('../../src/cli/adapters/codex');
const {
  buildFilteredAssetSet,
  listBundledAgents,
  listBundledAgentSupportFiles,
  listBundledSkills,
  loadPluginManifest,
} = require('../../src/cli/plugin');

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
const GITIGNORE_PATH = path.join(REPO_ROOT, '.gitignore');
const RELEASE_SMOKE_PATH = path.join(REPO_ROOT, 'tests/smoke/release-dual-host-governance.sh');
const MCP_SETUP_SKILL_PATH = path.join(REPO_ROOT, 'skills/spec-mcp-setup/SKILL.md');
const MCP_SETUP_TOOLS_PATH = path.join(REPO_ROOT, 'skills/spec-mcp-setup/mcp-tools.json');
const MCP_SETUP_VERIFY_SH_PATH = path.join(REPO_ROOT, 'skills/spec-mcp-setup/scripts/verify-tools.sh');
const MCP_SETUP_VERIFY_PS1_PATH = path.join(REPO_ROOT, 'skills/spec-mcp-setup/scripts/verify-tools.ps1');
const DOCS_MCP_SETUP_SKILL_PATH = path.join(REPO_ROOT, 'docs/10-prompt/skills/spec-mcp-setup/SKILL.md');
const DOCS_MCP_SETUP_FLOW_PATH = path.join(REPO_ROOT, 'docs/10-prompt/skills/spec-mcp-setup/execution-flow.md');
const DOCS_GRAPH_BOOTSTRAP_SKILL_PATH = path.join(
  REPO_ROOT,
  'docs/10-prompt/skills/spec-graph-bootstrap/SKILL.md',
);
const GRAPH_BOOTSTRAP_SKILL_PATH = path.join(REPO_ROOT, 'skills/spec-graph-bootstrap/SKILL.md');
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

    expect(pkg.files).not.toContain('.claude-plugin/');
    expect(pkg.scripts['test:release']).toContain('test:release:governance');
    expect(pkg.scripts['test:release']).toContain('test:release:install');
    expect(pkg.scripts['test:release:governance']).toContain('release-dual-host-governance.sh');
    expect(pkg.scripts['test:release:install']).toContain('install-tarball.sh');
  });

  test('workflow manifest is generated from governance and command template frontmatter', () => {
    const manifest = loadPluginManifest();
    const mcpSetup = manifest.commands.find((command) => command.name === 'mcp-setup');
    const graphBootstrap = manifest.commands.find((command) => command.name === 'graph-bootstrap');

    expect(manifest.version).toBe(readJson(PACKAGE_JSON_PATH).version);
    expect(mcpSetup).toMatchObject({
      filename: 'mcp-setup.md',
      description: 'Install and verify the required harness runtime for spec-first workflows',
      argumentHint: '',
      skill: 'spec-mcp-setup',
    });
    expect(graphBootstrap).toMatchObject({
      filename: 'graph-bootstrap.md',
      description: 'Compile graph readiness facts for external graph-provider workflows',
      argumentHint: '',
      skill: 'spec-graph-bootstrap',
    });
  });

  test('mcp setup final response preserves the full readiness table contract', () => {
    const mcpSetup = read(MCP_SETUP_SKILL_PATH);

    expect(mcpSetup).toContain("the assistant's final response must restate the complete Markdown status table");
    expect(mcpSetup).toContain('Do not rely on prior command output as the only place where the table appears.');
    expect(mcpSetup).toContain('Required Harness Runtime status:');
    expect(mcpSetup).toContain('| Name | Remark | Type | Required | Dependency | Host | Project | Query | Next |');
    expect(mcpSetup).toContain('下一步:');
  });

  test('docs-side governance directory keeps only the human-readable contract', () => {
    expect(fs.readdirSync(DOCS_SIDE_GOVERNANCE_DIR).sort((a, b) => a.localeCompare(b))).toEqual([
      'README.md',
    ]);
  });

  test('project-local graph readiness artifacts are ignored, not source truth', () => {
    const gitignore = read(GITIGNORE_PATH);

    expect(gitignore).toContain('.spec-first/config/*.json');
    expect(gitignore).toContain('.spec-first/graph/');
    expect(gitignore).toContain('.spec-first/providers/');
    expect(gitignore).toContain('.spec-first/impact/');
  });

  test('release governance smoke forbids docs-side machine-readable assets from tarball payload', () => {
    const releaseSmoke = read(RELEASE_SMOKE_PATH);

    expect(releaseSmoke).toContain('package/docs/contracts/dual-host-governance/skills-governance.json');
    expect(releaseSmoke).toContain('package/docs/contracts/dual-host-governance/skills-governance.schema.json');
    expect(releaseSmoke).toContain('tar -tf "$TARBALL_PATH" | grep -q');
    expect(releaseSmoke).toContain('if tar -tf "$TARBALL_PATH" | grep -q');
  });

  test('Codex-facing docs use $spec-* instead of /spec:*', () => {
    const readme = read(README_PATH);
    const readmeZh = read(README_ZH_PATH);
    const mcpSetup = read(MCP_SETUP_SKILL_PATH);

    expect(readme).toContain('$spec-mcp-setup');
    expect(readme).toContain('$spec-graph-bootstrap');
    expect(readme).toContain('standalone `spec-write-tasks` skill');
    expect(readme).not.toContain('$spec-write-tasks');
    expect(readmeZh).toContain('standalone `spec-write-tasks` skill');
    expect(readmeZh).not.toContain('$spec-write-tasks');
    expect(readme).not.toContain(RETIRED_CODEX_ENTRYPOINT);
    expect(readme).not.toContain('$setup');
    expect(readme).not.toContain('Codex now also receives shared `/spec:*` command files under `.codex/commands/spec/`');

    expect(mcpSetup).toContain('**Codex entry point:** `$spec-mcp-setup`');
    expect(mcpSetup).not.toContain('**Codex entry point:** `/spec:mcp-setup`');
  });

  test('active source-of-truth surfaces use external graph bootstrap without retired CRG CLI', () => {
    const activeSurfaces = [
      README_PATH,
      README_ZH_PATH,
      MCP_SETUP_SKILL_PATH,
      MCP_SETUP_TOOLS_PATH,
      MCP_SETUP_VERIFY_SH_PATH,
      MCP_SETUP_VERIFY_PS1_PATH,
      DOCS_MCP_SETUP_SKILL_PATH,
      DOCS_MCP_SETUP_FLOW_PATH,
      DOCS_GRAPH_BOOTSTRAP_SKILL_PATH,
      GRAPH_BOOTSTRAP_SKILL_PATH,
    ];

    for (const surface of activeSurfaces.filter((filePath) => fs.existsSync(filePath))) {
      const content = read(surface);

      expect(content).not.toContain(RETIRED_BOOTSTRAP_NAME);
      expect(content).not.toContain(RETIRED_CLAUDE_ENTRYPOINT);
      expect(content).not.toContain(RETIRED_CODEX_ENTRYPOINT);
      expect(content).not.toContain(RETIRED_WORKFLOW_PATH);
      expect(content).not.toContain(RETIRED_SKILL_PATH);
      expect(content).not.toContain('spec-first ' + 'crg');
    }

    expect(read(GRAPH_BOOTSTRAP_SKILL_PATH)).toContain('npx -y gitnexus@latest analyze');
    expect(read(GRAPH_BOOTSTRAP_SKILL_PATH)).toContain('uvx code-review-graph build');
  });

  test('README runtime counts stay aligned with current bundled assets', () => {
    const readme = read(README_PATH);
    const readmeZh = read(README_ZH_PATH);
    const claudeAssets = buildFilteredAssetSet('claude');
    const codexAssets = buildFilteredAssetSet('codex');
    const bundledSkillCount = listBundledSkills().length;
    const bundledAgentCount = listBundledAgents().length;
    const bundledSupportCount = listBundledAgentSupportFiles().length;

    expect(readme).toContain(
      `| **Capability layer** | Bundled source assets ship with \`${bundledSkillCount}\` skills, \`${bundledAgentCount}\` agents and no agent support files. Runtime delivery is host-filtered by governance: the current bundle installs \`${claudeAssets.commands.length}\` commands + \`${claudeAssets.skills.length}\` standalone skills + \`${claudeAssets.internalSkills.length}\` agent-facing internal skills on Claude, and \`${codexAssets.workflowSkills.length}\` workflow skills + \`${codexAssets.skills.length}\` standalone skills + \`${codexAssets.internalSkills.length}\` agent-facing internal skills on Codex, with \`${bundledAgentCount}\` agents on both hosts |`,
    );
    expect(readmeZh).toContain(
      `| **能力层资产** | 仓库内置源码资产共 \`${bundledSkillCount}\` 个 skills、\`${bundledAgentCount}\` 个 agents、\`${bundledSupportCount}\` 个 agent support files。运行时交付会按双宿主治理过滤：当前版本在 Claude 侧安装 \`${claudeAssets.commands.length}\` 个 commands + \`${claudeAssets.skills.length}\` 个 standalone skills + \`${claudeAssets.internalSkills.length}\` 个 agent-facing internal skills，在 Codex 侧安装 \`${codexAssets.workflowSkills.length}\` 个 workflow skills + \`${codexAssets.skills.length}\` 个 standalone skills + \`${codexAssets.internalSkills.length}\` 个 agent-facing internal skills；两侧都会安装 \`${bundledAgentCount}\` 个 agents |`,
    );
    expect(readme).toContain(`📦 Generated ${claudeAssets.commands.length} command file(s) in .claude/commands/spec`);
    expect(readme).toContain(`🧩 Generated ${claudeAssets.skills.length + claudeAssets.internalSkills.length} skill directory(ies) in .claude/skills`);
    expect(readme).toContain(`🤖 Generated ${claudeAssets.agents.length} agent file(s) in .claude/agents`);
    expect(readme).not.toContain('agent support file(s) in .claude/agents');
    expect(readmeZh).toContain(`📦 Generated ${claudeAssets.commands.length} command file(s) in .claude/commands/spec`);
    expect(readmeZh).toContain(`🧩 Generated ${claudeAssets.skills.length + claudeAssets.internalSkills.length} skill directory(ies) in .claude/skills`);
    expect(readmeZh).toContain(`🤖 Generated ${claudeAssets.agents.length} agent file(s) in .claude/agents`);
    expect(readmeZh).not.toContain('agent support file(s) in .claude/agents');
    expect(readme).not.toContain('spec-first ' + 'crg');
    expect(readmeZh).not.toContain('spec-first ' + 'crg');
    expect(readme).toContain('/spec:' + 'graph' + '-bootstrap');
    expect(readme).toContain('$spec-' + 'graph' + '-bootstrap');
    expect(readmeZh).toContain('/spec:' + 'graph' + '-bootstrap');
    expect(readmeZh).toContain('$spec-' + 'graph' + '-bootstrap');
  });

  test('graph bootstrap prompt mirror tracks readiness compiler contract', () => {
    const mirror = read(DOCS_GRAPH_BOOTSTRAP_SKILL_PATH);

    expect(mirror).toContain('project graph readiness');
    expect(mirror).toContain('runtime-capabilities.json');
    expect(mirror).toContain('provider-artifacts.json');
    expect(mirror).toContain('host_ledger_pointer');
    expect(mirror).toContain('provider-status.json');
    expect(mirror).toContain('graph-facts.json');
    expect(mirror).toContain('bootstrap-impact-capabilities.json');
    expect(mirror).toContain('query-unverified');
    expect(mirror).toContain('unsupported-provider-command');
    expect(mirror).toContain('## Graph Readiness');
    expect(mirror).toContain('bounded direct repo reads');
    expect(mirror).not.toContain('只要 provider setup 仍 ready，重复 `spec-mcp-setup` 不应删除这些 readiness facts');
  });
});
