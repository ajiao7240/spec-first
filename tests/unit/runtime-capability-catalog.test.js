'use strict';

const fs = require('node:fs');
const {
  DEFAULT_OUTPUT_PATH,
  buildRuntimeCapabilityCatalog,
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
    expect(catalog).toContain(`| Bundled source skills | ${listBundledSkills().length} |`);
    expect(catalog).toContain(`| Bundled source agents | ${listBundledAgents().length} |`);
    expect(catalog).toContain(`| Claude runtime delivery | ${claudeAssets.commands.length} commands, ${claudeAssets.workflowSkills.length} workflow skills, ${claudeAssets.skills.length} standalone skills, ${claudeAssets.internalSkills.length} agent-facing internal skills, ${claudeAssets.agents.length} agents, ${claudeAssets.agentSupportFiles.length} agent support files |`);
    expect(catalog).toContain(`| Codex runtime delivery | ${codexAssets.commands.length} commands, ${codexAssets.workflowSkills.length} workflow skills, ${codexAssets.skills.length} standalone skills, ${codexAssets.internalSkills.length} agent-facing internal skills, ${codexAssets.agents.length} agents, ${codexAssets.agentSupportFiles.length} agent support files |`);
  });

  test('catalog exposes public, standalone, internal, beta, and host delivery boundaries', () => {
    const catalog = buildRuntimeCapabilityCatalog();

    expect(catalog).toContain('| work | spec-work | /spec:work | $spec-work | claude=command; codex=skill | no |');
    expect(catalog).toContain('| work-beta | spec-work-beta | /spec:work-beta | $spec-work-beta | claude=command; codex=skill | yes |');
    expect(catalog).toContain('| polish-beta | spec-polish-beta | /spec:polish-beta | $spec-polish-beta | claude=command; codex=skill | yes |');
    expect(catalog).toContain('| spec-write-tasks | standalone skill: spec-write-tasks | standalone skill: spec-write-tasks |');
    expect(catalog).toContain('| Delivered agent-facing internal skills | git-worktree |');
    expect(catalog).not.toContain('spec-session-extract');
    expect(catalog).not.toContain('spec-session-inventory');
    expect(catalog).toContain('| Governance-only internal records |');
    expect(catalog).toContain('provider readiness 由 `spec-mcp-setup` 和 `spec-graph-bootstrap` 产物表达');
  });
});
