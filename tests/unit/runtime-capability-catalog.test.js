'use strict';

const fs = require('node:fs');
const {
  DEFAULT_OUTPUT_PATH,
  buildRuntimeCapabilityCatalog,
  listPlannedRuntimeContracts,
  listWorkflowRuntimeContracts,
} = require('../../scripts/generate-runtime-capability-catalog');
const {
  buildFilteredAssetSet,
  listBundledAgents,
  listBundledSkills,
} = require('../../src/cli/plugin');

describe('runtime capability catalog', () => {
  test('generated catalog is checked in and derived from current governance', () => {
    const catalog = fs.readFileSync(DEFAULT_OUTPUT_PATH, 'utf8');
    const expected = buildRuntimeCapabilityCatalog();
    const claudeAssets = buildFilteredAssetSet('claude');
    const codexAssets = buildFilteredAssetSet('codex');

    expect(catalog).toBe(expected);
    expect(catalog).toContain('不是第二套 source of truth');
    expect(catalog).toContain('src/cli/plugin.js');
    expect(catalog).toContain('src/cli/contracts/dual-host-governance/skills-governance.json');
    expect(catalog).toContain('docs/contracts/workflows/*.schema.json');
    expect(catalog).toContain(`| Bundled source skills | ${listBundledSkills().length} |`);
    expect(catalog).toContain(`| Bundled source agents | ${listBundledAgents().length} |`);
    expect(catalog).toContain(`| Workflow runtime contracts | ${listWorkflowRuntimeContracts().length} |`);
    expect(catalog).toContain(`| Planned runtime contracts | ${listPlannedRuntimeContracts().length} |`);
    expect(catalog).toContain(`| Claude runtime delivery | ${claudeAssets.commands.length} commands, ${claudeAssets.workflowSkills.length} workflow skills, ${claudeAssets.skills.length} standalone skills, ${claudeAssets.internalSkills.length} agent-facing internal skills, ${claudeAssets.agents.length} agents, ${claudeAssets.agentSupportFiles.length} agent support files |`);
    expect(catalog).toContain(`| Codex runtime delivery | ${codexAssets.commands.length} commands, ${codexAssets.workflowSkills.length} workflow skills, ${codexAssets.skills.length} standalone skills, ${codexAssets.internalSkills.length} agent-facing internal skills, ${codexAssets.agents.length} agents, ${codexAssets.agentSupportFiles.length} agent support files |`);
  });

  test('catalog exposes public, standalone, internal, beta, and host delivery boundaries', () => {
    const catalog = buildRuntimeCapabilityCatalog();

    expect(catalog).toContain('| work | spec-work | /spec:work | $spec-work | claude=command; codex=skill | no |');
    expect(catalog).not.toContain('spec-work-beta');
    expect(catalog).not.toContain('/spec:work-beta');
    expect(catalog).toContain('| polish-beta | spec-polish-beta | /spec:polish-beta | $spec-polish-beta | claude=command; codex=skill | yes |');
    expect(catalog).not.toContain('spec-' + 'standards');
    expect(catalog).not.toContain('/spec:' + 'standards');
    expect(catalog).not.toContain('$spec-' + 'standards');
    expect(catalog).toContain('| spec-write-tasks | standalone skill: spec-write-tasks | standalone skill: spec-write-tasks |');
    expect(catalog).toContain('| Delivered agent-facing internal skills | git-worktree |');
    expect(catalog).not.toContain('spec-session-extract');
    expect(catalog).not.toContain('spec-session-inventory');
    expect(catalog).toContain('| Governance-only internal records |');
    expect(catalog).toContain('provider readiness 由 `spec-mcp-setup` 和 `spec-graph-bootstrap` 产物表达');
    expect(catalog).toContain('## Readiness Meaning');
    expect(catalog).toContain('| CLI/runtime health | `spec-first doctor` |');
    expect(catalog).toContain('| Harness setup | `/spec:mcp-setup` or `$spec-mcp-setup` |');
    expect(catalog).toContain('| Graph readiness | `/spec:graph-bootstrap` or `$spec-graph-bootstrap` |');
    expect(catalog).toContain('It does not mean MCP helpers or graph providers are query-ready.');
    expect(catalog).toContain('## Quality Gate Evidence');
    expect(catalog).toContain('npm run test:ai-dev:benchmarks');
    expect(catalog).toContain('.spec-first/workflows/quality-gates/ai-dev-benchmark-fixtures/benchmark-fixtures-result.json');
    expect(catalog).toContain('advisory_failures[]');
    expect(catalog).toContain('does not run agents or workflows');
    expect(catalog).toContain('## Release Package Evidence');
    expect(catalog).toContain('package-content-manifest.json');
    expect(catalog).toContain('init-claude-dry-run.log');
    expect(catalog).toContain('init-codex-dry-run.log');
    expect(catalog).toContain('release-artifact-summary.json');
    expect(catalog).toContain('no dashboard, history store, GitHub Release automation, or release decision engine');
  });

  test('catalog exposes workflow artifact contracts without claiming workflow integration', () => {
    const catalog = buildRuntimeCapabilityCatalog();
    const workflowContracts = listWorkflowRuntimeContracts();

    expect(workflowContracts).toEqual(expect.arrayContaining([
      {
        title: 'spec-first spec-work run artifact producer-available contract',
        contractPath: 'docs/contracts/workflows/spec-work-run-artifact.schema.json',
        status: 'producer_available',
        producer: 'internal spec-work-run-artifact write',
        producerAvailable: true,
        workflowIntegrated: false,
        runtimePath: '.spec-first/workflows/spec-work/<workspace-slug>/<run-id>/run.json',
        boundary: 'source-owned write-side producer; workflow integration false until spec-work closeout calls it with fixture/fresh-source evidence',
      },
    ]));
    expect(catalog).toContain('## Workflow Runtime Contracts');
    expect(catalog).toContain('`producer_available=true` only means a source-owned writer exists');
    expect(catalog).toContain('| spec-first spec-work run artifact producer-available contract<br>docs/contracts/workflows/spec-work-run-artifact.schema.json | producer_available | internal spec-work-run-artifact write | true | false | .spec-first/workflows/spec-work/<workspace-slug>/<run-id>/run.json | source-owned write-side producer; workflow integration false until spec-work closeout calls it with fixture/fresh-source evidence |');
    expect(catalog).toContain('Workflow runtime contracts 必须由 `docs/contracts/workflows/*.schema.json` 的 `x-spec-first-*` metadata 派生');
  });
});
