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
    expect(doc).toContain('`providers[].readiness_source`');
    expect(doc).toContain('`providers[].refresh_mode`');
    expect(doc).toContain('`providers[].fallback_from_incremental`');
    expect(doc).toContain('`providers[].last_indexed_commit`');
    expect(doc).toContain('`providers[].requires_clean_full_refresh`');
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

    expect(doc).toContain('`.spec-first/providers/<provider>/status.json`');
    expect(doc).toContain('`command_results[].refresh_mode`');
    expect(doc).toContain('`command_results[].attempt_role`');
    expect(doc).toContain('`last_indexed_commit` 来自 provider status，不来自 aggregate graph-facts');
  });

  test('forbids legacy graph artifact paths and graph-facts pseudo-fields', () => {
    const doc = read(CONSUMPTION_DOC_PATH);

    expect(doc).toContain('`.spec-first/graph/bootstrap-impact-capabilities.json`');
    expect(doc).toContain('`.spec-first/graph/architecture-facts.json`');
    expect(doc).toContain('`.spec-first/graph/reuse-candidates.json`');
    expect(doc).toContain('顶层 `query_ready`');
    expect(doc).toContain('顶层 `ready_primary_providers`');
    expect(doc).toContain('顶层 `refresh_mode`');
    expect(doc).toContain('顶层 `refresh_modes_by_provider`');
    expect(doc).toContain('顶层 `refresh_mode_summary`');
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
    expect(evidencePolicy).toContain('$spec-graph-bootstrap --incremental');
    expect(evidencePolicy).toContain('显式 `--all-repos --incremental`');
    expect(evidencePolicy).toContain('父级 workspace 隐式 all-repos `--incremental` 都 unsupported');
    expect(evidencePolicy).toContain('dirty worktree 会在 provider command 前 blocked');

    expect(doc).toContain('## Refresh Ownership');
    expect(doc).toContain('consumer freshness-check');
    expect(doc).toContain('branch switch / pull / rebase / merge 后的下一次 consumer check');
    expect(doc).toContain('stale + graph-heavy work');
    expect(doc).toContain('`$spec-graph-bootstrap` | reuse 或 rebuild provider readiness');
    expect(doc).toContain('Graph-heavy 至少包括 shared helper/API/route/provider contract/core workflow/cross-module changes');
    expect(doc).toContain('docs-only、窄 typo、小型本地 bug 和首次试用属于 lightweight counterexamples');
  });

  test('keeps failed speed-gate incremental path out of public onboarding docs', () => {
    const publicDocs = [
      'README.md',
      'README.zh-CN.md',
      'docs/05-用户手册/02-核心概念.md',
      'docs/05-用户手册/04-workflows-artifacts-map.md',
      'docs/05-用户手册/05-最佳实践.md',
    ];

    for (const filePath of publicDocs) {
      expect(read(filePath)).not.toContain('$spec-graph-bootstrap --incremental');
    }
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

  test('documents incremental refresh fields, enums, and graph-facts non-surface', () => {
    const doc = read(CONSUMPTION_DOC_PATH);

    expect(doc).toContain('## Refresh Mode Truth Table');
    for (const readinessSource of [
      'cold-run',
      'skipped',
      'preflight-blocked',
      'incremental-update',
      'incremental-fallback-full',
    ]) {
      expect(doc).toContain(readinessSource);
    }
    for (const refreshMode of ['full', 'incremental', 'incremental-fallback-full', 'failed']) {
      expect(doc).toContain(refreshMode);
    }
    for (const reasonCode of [
      'incremental-command-unavailable',
      'fingerprint-spec-first-changed',
      'fingerprint-projection-changed',
      'fingerprint-provider-changed',
      'clean-full-refresh-required',
      'incremental-base-ref-unset',
      'incremental-base-ref-invalid-format',
      'incremental-base-status-untrusted',
      'incremental-base-ref-missing',
      'incremental-base-ref-not-ancestor',
      'incremental-refresh-failed-fallback-full',
      'incremental-and-full-failed',
      'dirty-refresh-non-canonical',
      'incremental-all-repos-unsupported',
    ]) {
      expect(doc).toContain(reasonCode);
    }

    expect(doc).toContain('`readiness_source` 是命令来源事实，不是 readiness success');
    expect(doc).toContain('`graph-facts.v1.source_revision` 不是 incremental base truth source');
    expect(doc).toContain('父级 workspace 默认 all-repos 路径下只传 `--incremental`');
    expect(doc).toContain('Tracked docs、README、用户手册、issue 或 PR 描述不得粘贴 provider raw stdout/stderr');
    expect(doc).toContain('不要从 `graph-facts.v1` 推断 refresh mode');
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
          readiness_source: 'incremental-update',
          refresh_mode: 'incremental',
          fallback_from_incremental: false,
          last_indexed_commit: '0'.repeat(40),
          requires_clean_full_refresh: false,
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
    expect(graphFacts.refresh_mode).toBeUndefined();
    expect(graphFacts.refresh_modes_by_provider).toBeUndefined();
    expect(graphFacts.refresh_mode_summary).toBeUndefined();
    expect(graphFacts.provider_summary.ready_primary_providers).toContain('gitnexus');
    expect(graphFacts.canonical_artifacts.impact_capabilities).toBe('.spec-first/impact/bootstrap-impact-capabilities.json');
    expect(impactCapabilities.capabilities.review_support.support_level).toBe('partial');
  });
});
