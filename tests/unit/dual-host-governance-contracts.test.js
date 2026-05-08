'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');
const {
  buildFilteredAssetSet,
  listBundledAgents,
  listBundledAgentSupportFiles,
  listBundledSkills,
  loadPluginManifest,
  syncBundledAssets,
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
const AGENTS_PATH = path.join(REPO_ROOT, 'AGENTS.md');
const CLAUDE_PATH = path.join(REPO_ROOT, 'CLAUDE.md');
const ROLE_CONTRACT_PATH = path.join(REPO_ROOT, 'docs', '10-prompt', '结构化项目角色契约.md');
const USER_MANUAL_QUICKSTART_PATH = path.join(REPO_ROOT, 'docs/05-用户手册/01-快速开始.md');
const USER_MANUAL_FAQ_PATH = path.join(REPO_ROOT, 'docs/05-用户手册/04-常见问题.md');
const USER_MANUAL_LOCAL_INSTALL_PATH = path.join(REPO_ROOT, 'docs/05-用户手册/06-本地源码安装.md');
const RELEASE_NOTES_PATH = path.join(REPO_ROOT, 'docs/08-版本更新/README.md');
const GITIGNORE_PATH = path.join(REPO_ROOT, '.gitignore');
const RELEASE_SMOKE_PATH = path.join(REPO_ROOT, 'tests/smoke/release-dual-host-governance.sh');
const MCP_SETUP_SKILL_PATH = path.join(REPO_ROOT, 'skills/spec-mcp-setup/SKILL.md');
const MCP_SETUP_TOOLS_PATH = path.join(REPO_ROOT, 'skills/spec-mcp-setup/mcp-tools.json');
const MCP_SETUP_VERIFY_SH_PATH = path.join(REPO_ROOT, 'skills/spec-mcp-setup/scripts/verify-tools.sh');
const MCP_SETUP_VERIFY_PS1_PATH = path.join(REPO_ROOT, 'skills/spec-mcp-setup/scripts/verify-tools.ps1');
const DOCS_PROMPT_SKILLS_DIR = path.join(REPO_ROOT, 'docs/10-prompt/skills');
const RETIRED_MCP_SETUP_FLOW_PATH = path.join(REPO_ROOT, 'docs/10-prompt/skills/spec-mcp-setup/execution-flow.md');
const RETIRED_GRAPH_BOOTSTRAP_PROMPT_MIRROR_PATH = path.join(
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
    expect(contract).toContain('`docs/10-prompt/skills/` 不再是 active contract surface');
    expect(contract).toContain('不得要求随 `skills/` source 改动同步更新或重新创建');
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
    const standards = manifest.commands.find((command) => command.name === 'standards');
    const skillAudit = manifest.commands.find((command) => command.name === 'skill-audit');

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
    expect(standards).toMatchObject({
      filename: 'standards.md',
      description: 'Compile project standards and glue capability baseline artifacts',
      argumentHint: '[--baseline|--quick|--refresh|--deep] [--repo <child>|--workspace|--target-kind <auto|repo|workspace>] [--import-source <git-or-path>]',
      skill: 'spec-standards',
    });
    expect(skillAudit).toMatchObject({
      filename: 'skill-audit.md',
      description: 'Run the Spec-First skill audit workflow',
      argumentHint: '[target skill path or audit options]',
      skill: 'spec-skill-audit',
    });
  });

  test('skill audit is delivered as a Claude command and Codex workflow skill', () => {
    const claudeAssets = buildFilteredAssetSet('claude');
    const codexAssets = buildFilteredAssetSet('codex');

    expect(claudeAssets.commands.map((command) => command.name)).toContain('skill-audit');
    expect(claudeAssets.workflowSkills).toContain('spec-skill-audit');
    expect(codexAssets.workflowSkills).toContain('spec-skill-audit');
    expect(codexAssets.commands.map((command) => command.name)).not.toContain('skill-audit');
  });

  test('skill audit runtime delivery writes Claude command and Codex workflow skill only', () => {
    const claudeProject = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-claude-runtime-'));
    const codexProject = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-codex-runtime-'));

    try {
      syncBundledAssets(claudeProject, new ClaudeAdapter());
      syncBundledAssets(codexProject, new CodexAdapter());

      const claudeCommandPath = path.join(claudeProject, '.claude', 'commands', 'spec', 'skill-audit.md');
      const claudeWorkflowSkillPath = path.join(
        claudeProject,
        '.claude',
        'spec-first',
        'workflows',
        'spec-skill-audit',
        'SKILL.md',
      );
      const codexWorkflowSkillPath = path.join(
        codexProject,
        '.agents',
        'skills',
        'spec-skill-audit',
        'SKILL.md',
      );
      const codexCommandPath = path.join(codexProject, '.codex', 'commands', 'spec', 'skill-audit.md');

      expect(fs.existsSync(claudeCommandPath)).toBe(true);
      expect(read(claudeCommandPath)).toContain('# Skill Audit');
      expect(read(claudeCommandPath)).toContain('Audit agent skills as engineering protocols');
      expect(fs.existsSync(claudeWorkflowSkillPath)).toBe(true);
      expect(fs.existsSync(codexWorkflowSkillPath)).toBe(true);
      expect(fs.existsSync(codexCommandPath)).toBe(false);
    } finally {
      fs.rmSync(claudeProject, { recursive: true, force: true });
      fs.rmSync(codexProject, { recursive: true, force: true });
    }
  });

  test('mcp setup final response preserves the full readiness table contract', () => {
    const mcpSetup = read(MCP_SETUP_SKILL_PATH);

    expect(mcpSetup).toContain("the assistant's final response must restate the complete readiness status sourced from readiness ledger v2");
    expect(mcpSetup).toContain('Do not rely on prior command output as the only place where the status appears.');
    expect(mcpSetup).toContain('Required Harness Runtime status (grouped):');
    expect(mcpSetup).toContain('grouped status blocks rendered inside fenced code blocks');
    expect(mcpSetup).toContain('MCP servers:');
    expect(mcpSetup).toContain('Graph providers:');
    expect(mcpSetup).toContain('Helper tools:');
    expect(mcpSetup).toContain('Project setup facts:');
    expect(mcpSetup).toMatch(/\|\s*Name\s*\|\s*Role\s*\|\s*Dependency\s*\|\s*Host\s*\|\s*Project\s*\|\s*Next\s*\|/);
    expect(mcpSetup).toMatch(/\|\s*Name\s*\|\s*Role\s*\|\s*Dependency\s*\|\s*Host\s*\|\s*Query\s*\|\s*Bootstrap\s*\|\s*Next\s*\|/);
    expect(mcpSetup).toMatch(/\|\s*Name\s*\|\s*Type\s*\|\s*Result\s*\|\s*Dependency\s*\|\s*Install\s*\|\s*Skill\s*\|\s*Next\s*\|/);
    expect(mcpSetup).toMatch(/\|\s*Artifact\s*\|\s*Project\s*\|\s*Next\s*\|/);
    expect(mcpSetup).toContain('下一步:');
    expect(mcpSetup).toContain('/spec:standards 或 $spec-standards');
    expect(mcpSetup).toContain('When graph readiness is already ready');
  });

  test('mcp setup keeps Serena language selection with the agent and out of interactive CLI flows', () => {
    const mcpSetup = read(MCP_SETUP_SKILL_PATH);

    expect(fs.existsSync(RETIRED_MCP_SETUP_FLOW_PATH)).toBe(false);
    expect(mcpSetup).toContain('Serena project language selection is semantic and belongs to the LLM');
    expect(mcpSetup).toContain('Do not ask the user to choose a language when the evidence is clear');
    expect(mcpSetup).toContain('use Serena language `typescript`');
    expect(mcpSetup).toContain('reason_code=serena_language_required');
    expect(mcpSetup).toContain('first-time setup without existing language facts must fail fast before invoking Serena');
    expect(mcpSetup).not.toContain("Serena's own project creation may infer languages");
  });

  test('docs prompt skills mirror directory is retired from active contract surfaces', () => {
    const contract = read(GOVERNANCE_CONTRACT_PATH);
    const lintConfig = readJson(path.join(REPO_ROOT, 'scripts/lint-skill-entrypoints.config.json'));

    expect(fs.existsSync(DOCS_PROMPT_SKILLS_DIR)).toBe(false);
    expect(lintConfig.scanRoots).not.toContain('docs/10-prompt/skills');
    expect(contract).toContain('`docs/10-prompt/skills/` 不再是 active contract surface');
    expect(contract).toContain('不得要求随 `skills/` source 改动同步更新或重新创建');
  });

  test('docs-side governance directory keeps only the human-readable contract', () => {
    expect(fs.readdirSync(DOCS_SIDE_GOVERNANCE_DIR).sort((a, b) => a.localeCompare(b))).toEqual([
      'README.md',
    ]);
  });

  test('project source-truth docs use dynamic manifest sources instead of retired plugin manifest', () => {
    for (const sourcePath of [AGENTS_PATH, CLAUDE_PATH, ROLE_CONTRACT_PATH]) {
      const content = read(sourcePath);

      expect(content).not.toContain('.claude-plugin/plugin.json');
      expect(content).toContain('src/cli/plugin.js');
      expect(content).toContain('src/cli/contracts/dual-host-governance/**');
      expect(content).toContain('templates/claude/commands/spec/*.md');
    }
  });

  test('project-local runtime artifacts are ignored, not source truth', () => {
    const gitignore = read(GITIGNORE_PATH);

    expect(gitignore).toContain('.spec-first/config/*.json');
    expect(gitignore).toContain('.spec-first/audits/');
    expect(gitignore).toContain('.spec-first/app-audit/');
    expect(gitignore).toContain('.spec-first/graph/');
    expect(gitignore).toContain('.spec-first/providers/');
    expect(gitignore).toContain('.spec-first/impact/');
    expect(gitignore).toContain('.spec-first/workflows/');
    expect(gitignore).toContain('.spec-first/workspace/');
    expect(gitignore).toContain('.spec-first/standards/');
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
    const quickstart = read(USER_MANUAL_QUICKSTART_PATH);
    const faq = read(USER_MANUAL_FAQ_PATH);
    const localInstall = read(USER_MANUAL_LOCAL_INSTALL_PATH);
    const releaseNotes = read(RELEASE_NOTES_PATH);

    expect(readme).toContain('$spec-mcp-setup');
    expect(readme).toContain('$spec-graph-bootstrap');
    expect(readme).toContain('$spec-standards');
    expect(readme).toContain('Run the init command for each host you actually use.');
    expect(readme).toContain('only `--claude` for Claude Code-only projects');
    expect(readme).toContain('only `--codex` for Codex-only projects');
    expect(readme).toContain("Required harness runtime setup through the current host's setup workflow");
    expect(readme).toContain("External graph readiness compilation through the current host's graph bootstrap workflow");
    expect(readme).toContain("Use the current host's setup workflow");
    expect(readme).toContain("Use the current host's graph bootstrap workflow");
    expect(readme).toContain("Use the current host's plan workflow");
    expect(readme).toContain('workspace-graph-targets.v1');
    expect(readme).toContain('GitNexus-first evidence');
    expect(readme).toContain('explicit `target_repo` / per-child scope');
    expect(readme).toContain('advisory `.spec-first/workspace/*summary.json`');
    expect(readme).toContain('Use the installed standalone `write-tasks` skill');
    expect(readme).not.toContain('Required harness runtime setup through `$spec-mcp-setup`');
    expect(readme).not.toContain('External graph readiness compilation through `$spec-graph-bootstrap`');
    expect(readme).not.toContain('Use standalone `spec-write-tasks`');
    expect(readme).toContain(
      '| Compile task pack | use installed standalone `write-tasks` skill | use installed standalone `write-tasks` skill |',
    );
    expect(readme).not.toContain('$spec-write-tasks');
    expect(readmeZh).toContain('通过当前宿主的 setup workflow 管理');
    expect(readmeZh).toContain('按实际使用的宿主运行 init');
    expect(readmeZh).toContain('只用 Claude Code 就只跑 `--claude`');
    expect(readmeZh).toContain('只用 Codex 就只跑 `--codex`');
    expect(readmeZh).toContain('通过当前宿主的 graph bootstrap workflow 编译');
    expect(readmeZh).toContain('$spec-standards');
    expect(readmeZh).toContain('用当前宿主的 setup workflow');
    expect(readmeZh).toContain('当前宿主的 plan workflow');
    expect(readmeZh).toContain('workspace-graph-targets.v1');
    expect(readmeZh).toContain('GitNexus-first evidence');
    expect(readmeZh).toContain('明确 `target_repo` / per-child scope');
    expect(readmeZh).toContain('advisory `.spec-first/workspace/*summary.json`');
    expect(readmeZh).toContain('用已安装的 standalone `write-tasks` skill');
    expect(readmeZh).not.toContain('通过 `$spec-mcp-setup` 管理');
    expect(readmeZh).not.toContain('通过 `$spec-graph-bootstrap` 编译');
    expect(readmeZh).not.toContain('用 standalone `spec-write-tasks`');
    expect(readmeZh).toContain(
      '| 编译 task pack | 使用已安装的 standalone `write-tasks` skill | 使用已安装的 standalone `write-tasks` skill |',
    );
    expect(readmeZh).not.toContain('$spec-write-tasks');
    expect(readme).not.toContain(RETIRED_CODEX_ENTRYPOINT);
    expect(readme).not.toContain('$setup');
    expect(readme).not.toContain('Codex now also receives shared `/spec:*` command files under `.codex/commands/spec/`');

    expect(mcpSetup).toContain('**Codex entry point:** `$spec-mcp-setup`');
    expect(mcpSetup).not.toContain('**Codex entry point:** `/spec:mcp-setup`');

    expect(quickstart).toContain('Codex 的 `.agents/skills`、`.codex/agents` 都通过检查');
    expect(quickstart).not.toContain('Codex 的 `.codex/commands/spec`');
    expect(faq).toContain('Claude 的 `/spec:*` 或 Codex 的 `$spec-*` 入口');
    expect(faq).toContain('Claude 的 `/spec:*` 或 Codex 的 `$spec-*` 不生效');
    expect(localInstall).not.toContain('ls .codex/commands/spec');
    expect(releaseNotes).toContain('当前 Codex 正式入口以 `$spec-*` skills 为准');
    expect(releaseNotes).toContain('只作为旧版本遗留清理目标');
    expect(releaseNotes).not.toContain('Codex init 现在也会生成 `/spec:*` command files');
  });

  test('active source-of-truth surfaces use external graph bootstrap without retired CRG CLI', () => {
    const activeSurfaces = [
      README_PATH,
      README_ZH_PATH,
      MCP_SETUP_SKILL_PATH,
      MCP_SETUP_TOOLS_PATH,
      MCP_SETUP_VERIFY_SH_PATH,
      MCP_SETUP_VERIFY_PS1_PATH,
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

    expect(read(GRAPH_BOOTSTRAP_SKILL_PATH)).toContain(
      '<configured-gitnexus-package>", "analyze", "--force"',
    );
    expect(read(GRAPH_BOOTSTRAP_SKILL_PATH)).toContain('uvx --upgrade code-review-graph build');
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

  test('graph bootstrap source skill owns the readiness compiler contract', () => {
    const skill = read(GRAPH_BOOTSTRAP_SKILL_PATH);

    expect(fs.existsSync(RETIRED_GRAPH_BOOTSTRAP_PROMPT_MIRROR_PATH)).toBe(false);
    expect(skill).toContain('project graph readiness');
    expect(skill).toContain('runtime-capabilities.json');
    expect(skill).toContain('provider-artifacts.json');
    expect(skill).toContain('host_ledger_pointer');
    expect(skill).toContain('provider-status.json');
    expect(skill).toContain('graph-facts.json');
    expect(skill).toContain('bootstrap-impact-capabilities.json');
    expect(skill).toContain('workspace-graph-targets.v1');
    expect(skill).toContain('bounded candidate repos');
    expect(skill).toContain('GitNexus-first evidence');
    expect(skill).toContain('`--all-repos` / `-AllRepos`');
    expect(skill).toContain('.spec-first/workspace/graph-bootstrap-summary.json');
    expect(skill).toContain('canonical artifacts');
    expect(skill).toContain('When run from a parent workspace without `--repo`');
    expect(skill).toContain('query-unverified');
    expect(skill).toContain('unsupported-provider-command');
    expect(skill).toContain('## Readiness Evidence');
    expect(skill).toContain('bounded direct repo reads');
    expect(skill).not.toContain('只要 provider setup 仍 ready，重复 `spec-mcp-setup` 不应删除这些 readiness facts');
  });
});
