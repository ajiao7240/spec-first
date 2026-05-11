#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  buildFilteredAssetSet,
  listBundledAgentSupportFiles,
  listBundledAgents,
  listBundledSkills,
  loadPluginManifest,
  loadSkillsGovernance,
} = require('../src/cli/plugin');

const REPO_ROOT = path.join(__dirname, '..');
const DEFAULT_OUTPUT_PATH = path.join(REPO_ROOT, 'docs', 'catalog', 'runtime-capabilities.md');
const WORKFLOW_CONTRACTS_DIR = path.join(REPO_ROOT, 'docs', 'contracts', 'workflows');

function readSkillDescription(skillName) {
  const skillPath = path.join(REPO_ROOT, 'skills', skillName, 'SKILL.md');
  if (!fs.existsSync(skillPath)) return '';

  const content = fs.readFileSync(skillPath, 'utf8');
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) return '';

  const description = frontmatter[1].match(/^description:\s*"?(.+?)"?\s*$/m);
  return description ? description[1].trim() : '';
}

function entrypointFor(record, host) {
  const delivery = record.host_delivery[host];
  if (record.entry_surface === 'workflow_command') {
    if (host === 'claude' && delivery === 'command') {
      return `/spec:${record.command_name}`;
    }
    if (host === 'codex' && delivery === 'skill') {
      return `$${record.skill_name}`;
    }
  }

  if (record.entry_surface === 'standalone_skill' && delivery === 'skill') {
    return `standalone skill: ${record.skill_name}`;
  }

  if (record.entry_surface === 'internal_only' && delivery === 'internal') {
    return 'internal governance record';
  }

  return 'not delivered';
}

function deliverySummary(assetSet) {
  return [
    `${assetSet.commands.length} commands`,
    `${assetSet.workflowSkills.length} workflow skills`,
    `${assetSet.skills.length} standalone skills`,
    `${assetSet.internalSkills.length} agent-facing internal skills`,
    `${assetSet.agents.length} agents`,
    `${assetSet.agentSupportFiles.length} agent support files`,
  ].join(', ');
}

function tableRow(values) {
  return `| ${values.map((value) => String(value || '').replace(/\n/g, '<br>')).join(' | ')} |`;
}

function countBy(records, key) {
  return records.reduce((counts, record) => {
    const value = record[key] || 'unknown';
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function formatCounts(counts) {
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `${key}: ${count}`)
    .join(', ');
}

function listPlannedRuntimeContracts() {
  if (!fs.existsSync(WORKFLOW_CONTRACTS_DIR)) return [];

  return fs.readdirSync(WORKFLOW_CONTRACTS_DIR)
    .filter((fileName) => fileName.endsWith('.schema.json'))
    .map((fileName) => {
      const absolutePath = path.join(WORKFLOW_CONTRACTS_DIR, fileName);
      const schema = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));

      return {
        title: schema.title || fileName,
        contractPath: path.relative(REPO_ROOT, absolutePath),
        status: schema['x-spec-first-contract-status'] || '',
        producer: schema['x-spec-first-producer'] || '',
        runtimePath: schema['x-spec-first-runtime-path'] || '',
        boundary: schema['x-spec-first-boundary'] || '',
      };
    })
    .filter((contract) => contract.status === 'planned')
    .sort((a, b) => a.contractPath.localeCompare(b.contractPath));
}

function buildRuntimeCapabilityCatalog() {
  const governance = loadSkillsGovernance();
  const manifest = loadPluginManifest();
  const claudeAssets = buildFilteredAssetSet('claude');
  const codexAssets = buildFilteredAssetSet('codex');
  const bundledSkillCount = listBundledSkills().length;
  const bundledAgentCount = listBundledAgents().length;
  const bundledSupportCount = listBundledAgentSupportFiles().length;
  const records = [...governance.skills].sort((a, b) =>
    a.skill_name.localeCompare(b.skill_name),
  );
  const commandBySkill = new Map(manifest.commands.map((command) => [command.skill, command]));
  const workflowRecords = records.filter((record) => record.entry_surface === 'workflow_command');
  const standaloneRecords = records.filter((record) => record.entry_surface === 'standalone_skill');
  const internalRecords = records.filter((record) => record.entry_surface === 'internal_only');
  const deliveredInternal = internalRecords.filter((record) =>
    claudeAssets.internalSkills.includes(record.skill_name) || codexAssets.internalSkills.includes(record.skill_name),
  );
  const betaRecords = workflowRecords.filter((record) => /-beta$/.test(record.skill_name));
  const plannedRuntimeContracts = listPlannedRuntimeContracts();

  const lines = [
    '# Runtime Capability Catalog',
    '',
    '> 本文件由 `scripts/generate-runtime-capability-catalog.js` 从 `src/cli/plugin.js`、`src/cli/contracts/dual-host-governance/skills-governance.json`、`docs/contracts/workflows/*.schema.json` 和当前 `skills/` / `agents/` source 资产派生生成。',
    '> 它是只读 catalog，不是第二套 source of truth；修改 runtime 能力时应先改 source/governance，再重新生成本文件。',
    '',
    '## Source Truth',
    '',
    '| Source | 职责 |',
    '|---|---|',
    '| `src/cli/plugin.js` | 构建 plugin manifest、filtered asset set、runtime sync 与 drift 检查的实现真相源 |',
    '| `src/cli/contracts/dual-host-governance/skills-governance.json` | workflow / standalone / internal skill 的 host delivery 治理真相源 |',
    '| `templates/claude/commands/spec/*.md` | Claude `/spec:*` command source templates |',
    '| `skills/*/SKILL.md` | workflow、standalone、agent-facing internal skill source |',
    '| `agents/**/*.agent.md` | Claude/Codex 双宿主 agent source |',
    '| `docs/contracts/workflows/*.schema.json` | docs-side workflow artifact contracts；planned contract 不等于 runtime producer 已实现 |',
    '',
    '## Summary',
    '',
    '| 范围 | 当前值 |',
    '|---|---|',
    `| Bundled source skills | ${bundledSkillCount} |`,
    `| Bundled source agents | ${bundledAgentCount} |`,
    `| Bundled agent support files | ${bundledSupportCount} |`,
    `| Governance records by entry surface | ${formatCounts(countBy(records, 'entry_surface'))} |`,
    `| Claude runtime delivery | ${deliverySummary(claudeAssets)} |`,
    `| Codex runtime delivery | ${deliverySummary(codexAssets)} |`,
    `| Beta workflow entries | ${betaRecords.map((record) => record.skill_name).join(', ') || 'none'} |`,
    `| Planned runtime contracts | ${plannedRuntimeContracts.length} |`,
    '',
    '## Public Workflows',
    '',
    '| Workflow | Skill | Claude Entry | Codex Entry | Host Delivery | Beta | Description |',
    '|---|---|---|---|---|---|---|',
    ...workflowRecords
      .sort((a, b) => a.command_name.localeCompare(b.command_name))
      .map((record) => {
        const command = commandBySkill.get(record.skill_name);
        return tableRow([
          record.command_name,
          record.skill_name,
          entrypointFor(record, 'claude'),
          entrypointFor(record, 'codex'),
          `claude=${record.host_delivery.claude}; codex=${record.host_delivery.codex}`,
          /-beta$/.test(record.skill_name) ? 'yes' : 'no',
          command ? command.description : readSkillDescription(record.skill_name),
        ]);
      }),
    '',
    '## Standalone Skills',
    '',
    'Standalone skills 会安装为宿主可发现的 skills，不是 command-backed workflows。',
    '',
    '| Skill | Claude Delivery | Codex Delivery | Description |',
    '|---|---|---|---|',
    ...standaloneRecords.map((record) => tableRow([
      record.skill_name,
      entrypointFor(record, 'claude'),
      entrypointFor(record, 'codex'),
      readSkillDescription(record.skill_name),
    ])),
    '',
    '## Internal Skill Governance',
    '',
    'Most `internal_only` governance records are source governance entries and are not copied into the user-facing runtime skill set. Current runtime delivery only installs agent-facing internal skills that subagents need directly.',
    '',
    '| Category | Skills |',
    '|---|---|',
    `| Delivered agent-facing internal skills | ${deliveredInternal.map((record) => record.skill_name).join(', ') || 'none'} |`,
    `| Governance-only internal records | ${internalRecords.filter((record) => !deliveredInternal.includes(record)).map((record) => record.skill_name).join(', ') || 'none'} |`,
    '',
    '## Runtime Paths',
    '',
    '| Host | Runtime surface | Generated path |',
    '|---|---|---|',
    '| Claude Code | `/spec:*` commands | `.claude/commands/spec/` |',
    '| Claude Code | standalone and agent-facing internal skills | `.claude/skills/` |',
    '| Claude Code | workflow skill mirrors for command-backed workflows | `.claude/spec-first/workflows/` |',
    '| Claude Code | agents | `.claude/agents/` |',
    '| Codex | workflow, standalone, and agent-facing internal skills | `.agents/skills/` |',
    '| Codex | agents | `.codex/agents/` |',
    '',
    '## Planned Runtime Contracts',
    '',
    'These contracts are docs-side visibility records for future artifacts. They do not prove that the current runtime emits the artifact; consumers must check the `Producer` and boundary before treating any path as current runtime truth.',
    '',
    '| Contract | Status | Producer | Planned runtime path | Boundary |',
    '|---|---|---|---|---|',
    ...(plannedRuntimeContracts.length > 0
      ? plannedRuntimeContracts.map((contract) => tableRow([
        `${contract.title}<br>${contract.contractPath}`,
        contract.status,
        contract.producer,
        contract.runtimePath,
        contract.boundary,
      ]))
      : [tableRow(['none', 'none', 'none', 'none', 'none'])]),
    '',
    '## Readiness Meaning',
    '',
    'Runtime delivery describes what commands, skills, and agents were generated. It does not mean MCP helpers or graph providers are query-ready. Downstream workflows should read the layer-specific artifacts below instead of treating one pass/fail value as global readiness.',
    '',
    '| Layer | Entry | Canonical artifacts | Means | Does not mean |',
    '|---|---|---|---|---|',
    '| CLI/runtime health | `spec-first doctor` | doctor text/JSON report | Node/Git/package checks, generated host runtime assets, workflow surface, and stale verification evidence were inspected. | MCP/helper setup is complete, graph provider indexes exist, or graph `query_ready` facts are true. |',
    '| Harness setup | `/spec:mcp-setup` or `$spec-mcp-setup` | `.spec-first/config/tool-facts.json`, `.spec-first/config/graph-providers.json`, `.spec-first/config/runtime-capabilities.json`, `.spec-first/config/provider-artifacts.json` | Required MCP/helper runtime facts and provider config inputs were prepared. | Graph bootstrap has run, provider probes succeeded, or downstream graph evidence is fresh. |',
    '| Graph readiness | `/spec:graph-bootstrap` or `$spec-graph-bootstrap` | `.spec-first/graph/provider-status.json`, `.spec-first/graph/graph-facts.json`, `.spec-first/impact/bootstrap-impact-capabilities.json`, `.spec-first/providers/*/status.json` | Provider probes produced canonical graph and impact readiness facts for downstream workflows. | Any specific graph result is semantically relevant; the LLM still decides how to use evidence. |',
    '',
    '## Maintenance Contract',
    '',
    '- 不手改 `.claude/`、`.codex/` 或 `.agents/skills/` 作为 source fix；需要刷新 runtime 时运行 `spec-first init --claude|--codex`。',
    '- 不在本 catalog 中手写能力数量；能力数量必须由 generator 从 source/governance 推导。',
    '- Planned runtime contracts 必须由 `docs/contracts/workflows/*.schema.json` 的 `x-spec-first-*` metadata 派生；不能在 catalog 手写 planned/implemented 状态。',
    '- 新增、删除或改变 host delivery 时，同步更新 governance/source，运行 `npm run docs:runtime-catalog`，再运行 targeted governance tests。',
    '- 该 catalog 只描述 delivery surface，不判断某个 MCP/provider 当前是否 ready；provider readiness 由 `spec-mcp-setup` 和 `spec-graph-bootstrap` 产物表达。',
  ];

  return `${lines.join('\n')}\n`;
}

function writeRuntimeCapabilityCatalog(outputPath = DEFAULT_OUTPUT_PATH) {
  const catalog = buildRuntimeCapabilityCatalog();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, catalog, 'utf8');
  return outputPath;
}

if (require.main === module) {
  const outputPath = writeRuntimeCapabilityCatalog();
  console.log(`Generated ${path.relative(REPO_ROOT, outputPath)}`);
}

module.exports = {
  DEFAULT_OUTPUT_PATH,
  buildRuntimeCapabilityCatalog,
  listPlannedRuntimeContracts,
  writeRuntimeCapabilityCatalog,
};
