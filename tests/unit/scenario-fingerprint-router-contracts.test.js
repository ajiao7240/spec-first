'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const USING_SPEC_FIRST = path.join(REPO_ROOT, 'skills', 'using-spec-first', 'SKILL.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function expectContainsAll(content, snippets) {
  for (const snippet of snippets) {
    expect(content).toContain(snippet);
  }
}

describe('scenario fingerprint router contract', () => {
  test('using-spec-first consumes scenario fingerprints as advisory routing facts', () => {
    const skill = read(USING_SPEC_FIRST);

    expectContainsAll(skill, [
      '## Scenario Fingerprint Routing',
      '.spec-first/workspace/scenario-fingerprint.json',
      '.spec-first/workspace/scenario-fingerprint-setup.json',
      'Prefer the bootstrap layer (`developer-scenario-fingerprint.v1`) over the setup layer (`developer-scenario-fingerprint-setup.v1`)',
      'Scenario fingerprints are not gates, approvals, or source scope authority.',
      'do not collapse them into a single risk score',
      'one entrypoint, one reason, and one next action',
      'Do not run setup, graph-bootstrap, clean, provider commands, or runtime regeneration just to create a fingerprint',
    ]);
  });

  test('router documents legacy graph artifact grace and no-artifact setup guidance', () => {
    const skill = read(USING_SPEC_FIRST);

    expectContainsAll(skill, [
      'If the fingerprint is missing and old graph artifacts exist',
      '.spec-first/graph/graph-facts.json',
      '.spec-first/providers/**',
      '.gitnexus/**',
      'rerunning `$spec-mcp-setup` / `/spec:mcp-setup` will upgrade the workspace with a scenario fingerprint',
      'then continue normal routing by user intent',
      'If the fingerprint is missing and no setup or graph artifacts exist',
      'recommend `$spec-mcp-setup` / `/spec:mcp-setup`',
      'For clearly lightweight work, route by intent',
    ]);
  });

  test('router keeps the six priority checks independent and advisory', () => {
    const skill = read(USING_SPEC_FIRST);

    expectContainsAll(skill, [
      'Apply these scenario-aware checks in priority order',
      '1. `state_class=foreign-residual-workspace` or non-empty `foreign_residual_indicators[]`',
      '2. `state_class=first-time-git-repo`',
      '3. `complexity_dimensions.git_alignment_broken=true`',
      '4. `providers_status_refs.gitnexus.query_ready=false`, `query_ready=null`',
      '5. `complexity_dimensions.worktree_dirty_graph_affecting=true`',
      '6. None of the above: route normally by the user\'s immediate intent.',
      'If `freshness.stale_setup_layer=true`',
    ]);
  });

  test('foreign residual repair guidance does not expose future clean command before U4 lands', () => {
    const skill = read(USING_SPEC_FIRST);

    expectContainsAll(skill, [
      'route to the current repair owner before downstream work',
      'Recommend `$spec-mcp-setup` / `/spec:mcp-setup` or `$spec-update` / `/spec:update`',
      'Do not name `spec-first clean --workspace-orphans` as an available action until the current source actually provides that clean surface.',
    ]);
  });
});
