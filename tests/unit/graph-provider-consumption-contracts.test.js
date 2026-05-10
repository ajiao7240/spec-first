'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const CONSUMPTION_DOC_PATH = path.join(REPO_ROOT, 'docs', 'contracts', 'graph-provider-consumption.md');
const EVIDENCE_POLICY_PATH = path.join(REPO_ROOT, 'docs', 'contracts', 'graph-evidence-policy.md');

function read(relativeOrAbsolutePath) {
  const filePath = path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.join(REPO_ROOT, relativeOrAbsolutePath);
  return fs.readFileSync(filePath, 'utf8');
}

describe('graph provider consumption contract', () => {
  test('documents canonical graph and impact artifacts with field-level reads', () => {
    const doc = read(CONSUMPTION_DOC_PATH);
    const evidencePolicy = read(EVIDENCE_POLICY_PATH);

    expect(evidencePolicy).toContain('docs/contracts/graph-provider-consumption.md');
    expect(doc).toContain('`.spec-first/graph/provider-status.json`');
    expect(doc).toContain('`schema_version=graph-provider-status.v1`');
    expect(doc).toContain('`workflow_mode`');
    expect(doc).toContain('`ready_primary_providers[]`');
    expect(doc).toContain('`providers[].query_ready`');
    expect(doc).toContain('`providers[].normalized_artifacts`');

    expect(doc).toContain('`.spec-first/graph/graph-facts.json`');
    expect(doc).toContain('`schema_version=graph-facts.v1`');
    expect(doc).toContain('`provider_summary.ready_primary_providers[]`');
    expect(doc).toContain('`capabilities.query_global_graph`');
    expect(doc).toContain('`capabilities.impact_context`');
    expect(doc).toContain('`worktree_status_hash`');
    expect(doc).toContain('`canonical_artifacts.impact_capabilities`');

    expect(doc).toContain('`.spec-first/impact/bootstrap-impact-capabilities.json`');
    expect(doc).toContain('`schema_version=bootstrap-impact-capabilities.v1`');
    expect(doc).toContain('`capabilities.context_selection.support_level`');
    expect(doc).toContain('`capabilities.impact_radius.*`');
    expect(doc).toContain('`capabilities.review_support.*`');
    expect(doc).toContain('`downstream_guidance.limitations_required`');
  });

  test('forbids legacy graph artifact paths and graph-facts pseudo-fields', () => {
    const doc = read(CONSUMPTION_DOC_PATH);

    expect(doc).toContain('`.spec-first/graph/bootstrap-impact-capabilities.json`');
    expect(doc).toContain('`.spec-first/graph/architecture-facts.json`');
    expect(doc).toContain('`.spec-first/graph/reuse-candidates.json`');
    expect(doc).toContain('顶层 `query_ready`');
    expect(doc).toContain('顶层 `ready_primary_providers`');
    expect(doc).toContain('单纯用 `.spec-first/providers/<provider>/status.json` 是否存在判断 provider 可用');
  });

  test('representative fixtures keep aggregate readiness out of graph-facts top-level', () => {
    const providerStatus = {
      schema_version: 'graph-provider-status.v1',
      workflow_mode: 'primary',
      ready_primary_providers: ['gitnexus', 'code-review-graph'],
      failed_primary_providers: [],
      not_applicable_providers: [],
      skipped_primary_providers: [],
      partial_primary_available: true,
      providers: [
        {
          provider: 'gitnexus',
          status: 'ready',
          graph_ready: true,
          query_ready: true,
          normalized_artifacts: {
            architecture_facts: '.spec-first/providers/gitnexus/normalized/architecture-facts.json',
            reuse_candidates: '.spec-first/providers/gitnexus/normalized/reuse-candidates.json',
          },
        },
      ],
    };
    const graphFacts = {
      schema_version: 'graph-facts.v1',
      workflow_mode: 'primary',
      source_revision: '0'.repeat(40),
      worktree_dirty: false,
      worktree_status_hash: `sha256:${'0'.repeat(64)}`,
      provider_summary: {
        ready_primary_providers: ['gitnexus', 'code-review-graph'],
        degraded_providers: [],
        not_applicable_providers: [],
        skipped_primary_providers: [],
        partial_primary_available: true,
      },
      canonical_artifacts: {
        provider_status: '.spec-first/graph/provider-status.json',
        impact_capabilities: '.spec-first/impact/bootstrap-impact-capabilities.json',
      },
      capabilities: {
        query_global_graph: true,
        impact_context: true,
      },
      staleness_hints: {
        compare_source_revision: true,
        compare_worktree_dirty: true,
        worktree_status_hash: `sha256:${'0'.repeat(64)}`,
      },
    };
    const impactCapabilities = {
      schema_version: 'bootstrap-impact-capabilities.v1',
      workflow_mode: 'primary',
      capabilities: {
        context_selection: { support_level: 'full', primary_providers: ['gitnexus'], confidence: 'high' },
        impact_radius: { support_level: 'full', primary_providers: ['code-review-graph'], confidence: 'high' },
        review_support: { support_level: 'partial', primary_providers: ['code-review-graph'], confidence: 'medium' },
      },
      downstream_guidance: {
        canonical_graph_facts: '.spec-first/graph/graph-facts.json',
        provider_status: '.spec-first/graph/provider-status.json',
        limitations_required: false,
      },
    };

    expect(providerStatus.providers.every((provider) => provider.query_ready === true)).toBe(true);
    expect(graphFacts.query_ready).toBeUndefined();
    expect(graphFacts.ready_primary_providers).toBeUndefined();
    expect(graphFacts.provider_summary.ready_primary_providers).toContain('gitnexus');
    expect(graphFacts.canonical_artifacts.impact_capabilities).toBe('.spec-first/impact/bootstrap-impact-capabilities.json');
    expect(impactCapabilities.capabilities.review_support.support_level).toBe('partial');
  });
});
