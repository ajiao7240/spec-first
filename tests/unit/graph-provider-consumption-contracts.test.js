'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const CONSUMPTION_DOC_PATH = path.join(REPO_ROOT, 'docs', 'contracts', 'graph-provider-consumption.md');
const EVIDENCE_POLICY_PATH = path.join(REPO_ROOT, 'docs', 'contracts', 'graph-evidence-policy.md');
const GITNEXUS_CAPABILITY_CATALOG_PATH = path.join(
  REPO_ROOT,
  'docs',
  'contracts',
  'gitnexus-capability-catalog.md',
);
const SOURCE_RUNTIME_BOUNDARY_PATH = path.join(
  REPO_ROOT,
  'docs',
  'contracts',
  'source-runtime-customization-boundary.md',
);

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
    expect(doc).toContain('`dirty_classification`');
    expect(doc).toContain('`dirty_paths_breakdown`');
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
    expect(evidencePolicy).toContain('graph-affecting dirty worktree refresh 会标记 `dirty-advisory`');
    expect(evidencePolicy).toContain('以 warn-and-continue 运行 provider commands');

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

  test('documents spec-plan GitNexus evidence envelope as a four-axis task envelope', () => {
    const doc = read(CONSUMPTION_DOC_PATH);
    const evidencePolicy = read(EVIDENCE_POLICY_PATH);

    expect(evidencePolicy).toContain('Plan evidence envelope');
    expect(evidencePolicy).toContain('`capability_status=available|partial|unavailable|mutation-gated`');
    expect(evidencePolicy).toContain('`evidence_grade=primary|session-local|advisory|stale`');
    expect(evidencePolicy).toContain('`evidence_posture=primary|fallback`');
    expect(evidencePolicy).toContain('`freshness_state=fresh|stale|dirty-advisory|query-unverified`');
    expect(evidencePolicy).toContain('`primary` 是 `confirmed` 的 Plan 层别名');
    expect(evidencePolicy).toContain('`fallback` 是 posture，不是 evidence grade');
    expect(evidencePolicy).toContain('`evidence_posture=fallback + evidence_grade=primary` 是合法组合');
    expect(evidencePolicy).toContain('`evidence_posture=primary` 与 `capability_status=unavailable` 互斥');
    expect(evidencePolicy).toContain('`freshness_state=stale` 或 `freshness_state=dirty-advisory` 时');
    expect(evidencePolicy).toContain('拒绝 `evidence_grade=primary`');
    expect(evidencePolicy).toContain('`freshness_state=query-unverified` 必须配合 `evidence_grade=advisory` 或 `stale`');
    expect(evidencePolicy).toContain('`source_tags[]`');
    expect(evidencePolicy).toContain('checked-in baseline、setup projection、provider pin、live MCP tool/resource');
    expect(evidencePolicy).toContain('`capability_status=mutation-gated` 表示 capability 需要 explicit user action / preview-first 路径');
    expect(evidencePolicy).toContain('不得自动产出 mutation implementation unit');

    expect(doc).toContain('## Plan Evidence Envelope Boundary');
    expect(doc).toContain('`## Graph / GitNexus Evidence`');
    expect(doc).toContain('不是新的 readiness artifact');
    expect(doc).toContain('四个独立 axis');
    expect(doc).toContain('`runtime-capabilities.json.project_graph_readiness`');
    expect(doc).toContain('`graph-providers.json.derived_readiness`');
    expect(doc).toContain('`graph-providers.json.providers.gitnexus.native_capabilities`');
    expect(doc).toContain('`runtime-capabilities.json.gitnexus_capability_discovery`');
    expect(doc).toContain('setup-inferred availability / pointer inputs');
    expect(doc).toContain('setup-owned projection pointers');
    expect(doc).toContain('当前会话 live MCP / CLI evidence');
    expect(doc).toContain('`live-mcp-tool`');
    expect(doc).toContain('`live-mcp-resource`');
    expect(doc).toContain('不要把 setup projection 与 live MCP evidence 合并成一个 `available` fact');
    expect(doc).toContain('不回写 compiled readiness');
    expect(doc).toContain('不得替代 `Graph Readiness.status`');
    expect(doc).toContain('provider `query_ready`');
    expect(doc).toContain('workspace `query_usability`');
    expect(doc).toContain('`definitions-only` 仍是 limitation / query-usability condition');
  });

  test('documents setup-inferred GitNexus capability discovery contract', () => {
    const doc = read(CONSUMPTION_DOC_PATH);

    expect(doc).toContain('## Setup-Inferred GitNexus Capability Discovery');
    expect(doc).toContain('.spec-first/config/graph-providers.json.providers.gitnexus.native_capabilities');
    expect(doc).toContain('.spec-first/config/runtime-capabilities.json.gitnexus_capability_discovery');
    expect(doc).toContain('只表达 setup-inferred availability');
    expect(doc).toContain('不得让 consumer 推断 `query_ready=true`');
    expect(doc).toContain('`runtime-capabilities.json.project_graph_readiness.status=not-bootstrapped` 可以同时成立');
    expect(doc).toContain('setup `unknown` -> `partial`');
    expect(doc).toContain('`setup-inferred unknown`');
    expect(doc).toContain('Plan 不得从 setup `unknown` 发明 `available`');
    expect(doc).toContain('`source_provenance=registry-only|configured-not-verified`');
    expect(doc).toContain('`configured-and-detected`');
    expect(doc).not.toContain('observed-this-run');
    expect(doc).not.toContain('inherited-prior-run');
    expect(doc).toContain('`mutation_boundary=policy-blocked` 是 setup/Plan 的硬边界');
    expect(doc).toContain('不得在当前 workflow 中请求批准后执行该 surface');
    expect(doc).toContain('不要新增 TTL、aging window 或 `capability_metadata_freshness` 字段');
    expect(doc).toContain('provider projection / fingerprint freshness');
    expect(doc).toContain('`native_tools[]` 与 `native_resources[]` 必须分开');
    expect(doc).toContain('`gitnexus://repo/{name}/schema`');
    expect(doc).toContain('setup-internal facts such as host config, dependency readiness');
  });

  test('links GitNexus capability catalog source tags and resource provenance', () => {
    const catalog = read(GITNEXUS_CAPABILITY_CATALOG_PATH);
    const evidencePolicy = read(EVIDENCE_POLICY_PATH);

    expect(catalog).toContain('checked-in baseline 只定义 capability 语义');
    for (const tag of [
      'checked-in-baseline',
      'setup-projection',
      'provider-pin',
      'live-mcp-tool',
      'live-mcp-resource',
      'session-local-inference',
      'user-decision',
    ]) {
      expect(catalog).toContain(tag);
    }
    expect(catalog).toContain('verification posture 是派生判断');
    expect(catalog).toContain('不是独立闭合 enum');
    expect(catalog).toContain('`native_tools[]`');
    expect(catalog).toContain('`native_resources[]`');
    expect(catalog).toContain('`gitnexus://repos`');
    expect(catalog).toContain('`gitnexus://group/{name}/status`');
    expect(catalog).toContain('不得包含 `query_ready`');
    expect(catalog).toContain('Setup 不得调用或读取 live MCP resources');
    expect(catalog).toContain('No-graph/no-MCP/no-setup-projection fast path 不枚举静态 catalog');
    expect(evidencePolicy).toContain('docs/contracts/gitnexus-capability-catalog.md');
  });

  test('keeps retired Serena wording out of active provider evidence contracts', () => {
    const evidencePolicy = read(EVIDENCE_POLICY_PATH);
    const sourceRuntimeBoundary = read(SOURCE_RUNTIME_BOUNDARY_PATH);

    expect(evidencePolicy).toContain('GitNexus、code-review-graph、ast-grep 和直接源码读取');
    expect(evidencePolicy).not.toContain('Serena');
    expect(sourceRuntimeBoundary).toContain('GitNexus, code-review-graph, ast-grep');
    expect(sourceRuntimeBoundary).not.toContain('Serena');
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
      'dirty-source-blocked',
      'dirty-refresh-non-canonical',      'incremental-all-repos-unsupported',
    ]) {
      expect(doc).toContain(reasonCode);
    }

    expect(doc).toContain('`readiness_source` 是命令来源事实，不是 readiness success');
    expect(doc).toContain('`graph-facts.v1.source_revision` 不是 incremental base truth source');
    expect(doc).toContain('父级 workspace 默认 all-repos 路径下只传 `--incremental`');
    expect(doc).toContain('Tracked docs、README、用户手册、issue 或 PR 描述不得粘贴 provider raw stdout/stderr');
    expect(doc).toContain('不要从 `graph-facts.v1` 推断 refresh mode');
  });

  test('documents setup-owned dirty classification and legacy fallback rules', () => {
    const doc = read(CONSUMPTION_DOC_PATH);

    expect(doc).toContain('## setup-owned-dirty-ignore.v1');
    for (const prefix of [
      '.spec-first/',
      '.gitnexus/',
      '.code-review-graph/',
      'AGENTS.md',
      'CLAUDE.md',
      '.gitignore',
      '.codex/spec-first/',
      '.claude/spec-first/',
      '.agents/skills/',
    ]) {
      expect(doc).toContain(`| \`${prefix}\` |`);
    }

    expect(doc).toContain('## non-graph-metadata-dirty-ignore.v1');
    expect(doc).toContain('| `CHANGELOG.md` |');
    expect(doc).toContain('| `docs/变更日志.md` |');
    expect(doc).toContain('dirty_classification=non-graph-only');
    expect(doc).toContain('dirty_paths_breakdown.non_graph_metadata_count');
    expect(doc).toContain('不得把该列表扩展为 `docs/**`');
    expect(doc).toContain('dirty_classification=setup-owned-only');
    expect(doc).toContain('dirty_classification=graph-affecting-blocked');
    expect(doc).toContain('freshness_state=dirty-advisory');
    expect(doc).toContain('ready-dirty-advisory');
    expect(doc).toContain('warn-and-continue');
    expect(doc).not.toContain('`graph-affecting-blocked` 只能来自本轮 command result');
    expect(doc).toContain('marker 外仅允许 blank-only 分隔行');
    expect(doc).toContain('缺失 `dirty_classification` 的旧 `graph-facts.v1` 必须回退');
    expect(doc).toContain('不得从字段缺失推断 clean');
    expect(doc).toContain('新逻辑不得再写出该 reason code');
    expect(doc).toContain('dirty-uncertain');
    expect(doc).toContain('不得复用到 `external_actor_fingerprint`');
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
      dirty_classification: 'clean',
      dirty_paths_breakdown: {
        setup_owned_count: 0,
        non_graph_metadata_count: 0,
        graph_affecting_count: 0,
        sample_paths: [],
        truncated: false,
      },
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
