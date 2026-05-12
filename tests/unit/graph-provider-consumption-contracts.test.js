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

  test('defines explicit graph refresh trigger ownership and stale handoff boundaries', () => {
    const doc = read(CONSUMPTION_DOC_PATH);
    const evidencePolicy = read(EVIDENCE_POLICY_PATH);

    expect(evidencePolicy).toContain('## Refresh Trigger Policy');
    expect(evidencePolicy).toContain('`freshness-check`');
    expect(evidencePolicy).toContain('`refresh-handoff`');
    expect(evidencePolicy).toContain('`bootstrap-refresh`');
    expect(evidencePolicy).toContain('`repair-preview`');
    expect(evidencePolicy).toContain('automatic check, explicit refresh');
    expect(evidencePolicy).toContain('branch switch、pull、rebase、merge');
    expect(evidencePolicy).toContain('invalidation signals，不是自动 rebuild triggers');
    expect(evidencePolicy).toContain('consumer 不运行 provider analyze、build、repair 或 index rebuild');
    expect(evidencePolicy).toContain('`gitnexus_detect_changes` 和 impact 查询不触发 provider rebuild');

    expect(doc).toContain('## Refresh Ownership');
    expect(doc).toContain('consumer freshness-check');
    expect(doc).toContain('branch switch / pull / rebase / merge 后的下一次 consumer check');
    expect(doc).toContain('stale + graph-heavy work');
    expect(doc).toContain('`$spec-graph-bootstrap` | reuse 或 rebuild provider readiness');
    expect(doc).toContain('Graph-heavy 至少包括 shared helper/API/route/provider contract/core workflow/cross-module changes');
    expect(doc).toContain('docs-only、窄 typo、小型本地 bug 和首次试用属于 lightweight counterexamples');
  });

  test('keeps live MCP session-local and forbids consumer-side rebuilds', () => {
    const doc = read(CONSUMPTION_DOC_PATH);

    expect(doc).toContain('live MCP 查询成功只算 `session-local` evidence');
    expect(doc).toContain('不能回写 compiled readiness，也不能把 `query_ready` 改成 true');
    expect(doc).toContain('live MCP 成功是 session-local corroboration');
    expect(doc).toContain('不能把 `.spec-first/graph/graph-facts.json`');
    expect(doc).toContain('改写为 true');
    expect(doc).toContain('不自动运行 GitNexus analyze、provider build 或 index rebuild');
    expect(doc).toContain('provider fingerprint mismatch');
    expect(doc).toContain('consumer 可以推荐 `$spec-graph-bootstrap`');
    expect(doc).toContain('不得在 plan/work/debug/review 内部静默运行 GitNexus analyze');
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
