'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-plan', 'SKILL.md');
const REQUIREMENTS_CAPTURE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-brainstorm',
  'references',
  'requirements-capture.md',
);
const DEEPENING_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-plan',
  'references',
  'deepening-workflow.md',
);

describe('spec-plan context orientation contract', () => {
  test('uses direct repo context and preserves LLM decision boundary', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');
    expect(text).toContain('Context Orientation Anchor');
    expect(text).toContain('current user request or requirement');
    expect(text).toContain('package manifests and command registries');
    expect(text).toContain('nearby implementation files');
    expect(text).toContain('nearby tests');
    expect(text).toContain('External tools may prioritize inspection, but they do not define scope authority');
    expect(text).toContain('The LLM still chooses the candidate change surface');
    expect(text).toContain('explicit repo context and source-plan constraints');
    expect(text).toContain('target_repo');
    expect(text).toContain('do not let scripts or graph facts choose semantically between child repos');
    expect(text).toContain('A cross-repo plan must name `target_repo` per implementation unit');
    expect(text).not.toContain('spec-first ' + 'crg hook');
    expect(text).not.toContain('$spec-' + 'graph' + '-bootstrap');
    expect(text).not.toContain('/spec:' + 'graph' + '-bootstrap');
    expect(text).not.toContain('stage0-context');
    expect(text).not.toContain('selected_assets');
  });

  test('consumes canonical graph readiness facts without making them a planning gate', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('.spec-first/graph/graph-facts.json');
    expect(text).toContain('.spec-first/impact/bootstrap-impact-capabilities.json');
    expect((text.match(/## Graph Readiness/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(text).toContain(
      'status: primary | degraded-fallback | stale | blocked | setup-not-ready | unavailable',
    );
    for (const field of [
      '- source_revision:',
      '- current_revision:',
      '- stale:',
      '- primary_providers:',
      '- degraded_providers:',
      '- fallback_capabilities:',
      '- runtime_mcp_evidence:',
      '- confidence:',
      '- limitations:',
    ]) {
      expect(text).toContain(field);
    }
    expect(text).toContain('status: unavailable');
    expect(text).toContain('try live MCP evidence');
    expect(text).toContain('successful response as session-local evidence');
    expect(text).toContain('does not change compiled `query_ready`');
    expect(text).toContain('bounded direct repo reads');
    expect(text).toContain('graph readiness is evidence context, not a planning gate');
    expect(text).toContain('Do not expand this into context selection, impact analysis, review evidence');
  });
});

describe('spec_id planning contract', () => {
  test('requirements capture creates a local spec chain identity without a registry', () => {
    const text = fs.readFileSync(REQUIREMENTS_CAPTURE_PATH, 'utf8');

    expect(text).toContain('spec_id: YYYY-MM-DD-NNN-<kebab-case-topic>');
    expect(text).toContain('docs/brainstorms/YYYY-MM-DD-NNN-<slug>-requirements.md');
    expect(text).toContain('Ignore legacy non-sequenced files when choosing the next number');
    expect(text).toContain('not a central registry');
    expect(text).toContain('frontmatter is the machine-readable contract');
  });

  test('plan inherits spec_id, handles legacy origins, and preserves chain boundaries', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Preserve it exactly in the plan frontmatter');
    expect(text).toContain('Generate a new plan-local `spec_id`');
    expect(text).toContain('origin identity was not inherited');
    expect(text).toContain('scan `docs/brainstorms/`, `docs/plans/`, and `docs/tasks/` frontmatter');
    expect(text).toContain('If the same `spec_id` already exists');
    expect(text).toContain('alternative implementation plans, independent delivery chains, or abandon-and-replace work');
    expect(text).toContain('spec_id: YYYY-MM-DD-NNN-<slug>');
    expect(text).toContain('origin: docs/brainstorms/YYYY-MM-DD-NNN-<slug>-requirements.md');
  });

  test('deepening preserves spec_id rather than creating a new chain', () => {
    const text = fs.readFileSync(DEEPENING_PATH, 'utf8');

    expect(text).toContain('deepening strengthens the same plan and must preserve it');
    expect(text).toContain('Preserve the existing `spec_id` frontmatter value');
    expect(text).toContain('Use a new `spec_id` only when deliberately creating a new spec chain outside the deepening path');
  });
});
