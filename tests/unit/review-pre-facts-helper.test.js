'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  LIMITS,
  currentRepoSnapshot,
  renderFactsBlock,
  resolveTargets,
  runReviewPreFacts,
  validateProviderResults,
  validateQueryPlan,
  validateRawResult,
} = require('../../src/cli/helpers/review-pre-facts');

const REPO_ROOT = path.join(__dirname, '..', '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'review-pre-facts');

function tempRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-review-pre-facts-repo-'));
  spawnSync('git', ['init'], { cwd: repo, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.name', 'Test User'], { cwd: repo, encoding: 'utf8' });
  write(repo, 'src/cli/index.js', [
    'function runCli(argv) {',
    '  return argv.length;',
    '}',
    'module.exports = { runCli };',
    '',
  ].join('\n'));
  write(repo, 'skills/spec-doc-review/SKILL.md', [
    '# Document Review',
    '',
    '## Phase 1',
    'Read the document.',
    '',
  ].join('\n'));
  write(repo, 'docs/plans/plan.md', [
    '---',
    'title: fixture',
    '---',
    '',
    '## Sources & References',
    '- `skills/spec-doc-review/SKILL.md`',
    '- `../outside.md`',
    '- `/absolute/outside.md`',
    '- `missing.md`',
    '',
    '## Implementation Units',
    '**文件：** `src/cli/index.js`',
    '',
  ].join('\n'));
  write(repo, '.gitignore', '.spec-first/\n');
  spawnSync('git', ['add', '.'], { cwd: repo, encoding: 'utf8' });
  spawnSync('git', ['-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'test: init'], { cwd: repo, encoding: 'utf8' });
  writeGraphArtifacts(repo);
  return repo;
}

function write(repo, relativePath, contents) {
  const filePath = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf8');
}

function writeJson(repo, relativePath, value) {
  write(repo, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeGraphArtifacts(repo) {
  const snapshot = currentRepoSnapshot(repo);
  writeJson(repo, '.spec-first/providers/gitnexus/normalized/architecture-facts.json', {
    schema_version: 'provider-normalized-envelope.v1',
    provider: 'gitnexus',
    available_query_surfaces: ['query', 'context'],
    capabilities: ['query_global_graph'],
  });
  writeJson(repo, '.spec-first/providers/gitnexus/normalized/impact-capabilities.json', {
    schema_version: 'provider-normalized-envelope.v1',
    provider: 'gitnexus',
    available_query_surfaces: ['query', 'impact', 'detect_changes'],
    related_tests: 'candidate-only',
    limitations: ['related_tests_unverified'],
  });
  writeJson(repo, '.spec-first/graph/provider-status.json', {
    schema_version: 'graph-provider-status.v1',
    workflow_mode: 'primary',
    ready_primary_providers: ['gitnexus'],
    providers: [
      {
        provider: 'gitnexus',
        status: 'ready',
        graph_ready: true,
        query_ready: true,
        normalized_artifacts: {
          architecture_facts: '.spec-first/providers/gitnexus/normalized/architecture-facts.json',
          impact_capabilities: '.spec-first/providers/gitnexus/normalized/impact-capabilities.json',
        },
      },
    ],
  });
  writeJson(repo, '.spec-first/graph/graph-facts.json', {
    schema_version: 'graph-facts.v1',
    workflow_mode: 'primary',
    capabilities: {
      query_global_graph: true,
      impact_context: false,
      impact_context_status: 'limited',
      impact_context_limitations: ['related_tests_unverified'],
    },
    source_revision: snapshot.source_revision,
    worktree_dirty: snapshot.worktree_dirty,
    worktree_status_hash: snapshot.worktree_status_hash,
    staleness_hints: {
      worktree_status_hash: snapshot.worktree_status_hash,
    },
    canonical_artifacts: {
      provider_status: '.spec-first/graph/provider-status.json',
      impact_capabilities: '.spec-first/impact/bootstrap-impact-capabilities.json',
    },
  });
  writeJson(repo, '.spec-first/impact/bootstrap-impact-capabilities.json', {
    schema_version: 'bootstrap-impact-capabilities.v1',
    workflow_mode: 'primary',
    capabilities: {
      review_support: {
        support_level: 'partial',
        primary_providers: ['gitnexus'],
        related_tests_status: 'candidate-only',
        limitations: ['related_tests_unverified'],
      },
    },
  });
}

function tempRun(runId = `run-${Date.now()}-${Math.random().toString(16).slice(2)}`) {
  const dir = path.join(os.tmpdir(), 'spec-first', 'review-pre-facts', runId);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return { runId, dir };
}

function captureRun(args, cwd) {
  let stdout = '';
  let stderr = '';
  const code = runReviewPreFacts(args, {
    cwd,
    stdout: { write: (chunk) => { stdout += String(chunk); } },
    stderr: { write: (chunk) => { stderr += String(chunk); } },
  });
  return { code, stdout, stderr, json: JSON.parse(stdout) };
}

function providerFact(index, overrides = {}) {
  return {
    source_path: 'src/cli/index.js',
    anchor: `runCli-${index}`,
    excerpt: `fact ${index}`,
    provenance: {
      source: 'live-mcp',
      query_plan_id: 'qplan-fixture',
      tool_name: 'gitnexus.query',
    },
    ...overrides,
  };
}

function normalizedProviderFact(index, overrides = {}) {
  return {
    provider: 'gitnexus',
    query_id: 'q1',
    operation: 'query',
    fact_kind: 'query_symbol',
    repo_scope: 'spec-first',
    target_refs: ['src/cli/index.js'],
    source_path: 'src/cli/index.js',
    line_window: { start: index + 1, end: index + 1 },
    readiness: 'graph-fresh',
    tier: 'graph-fresh',
    reason_code: 'provider_fact',
    limitations: [],
    redaction_status: 'none-required',
    summary: [`query pointer runCli-${index}`, `source src/cli/index.js:${index + 1}-${index + 1}`],
    source_reads_required: ['src/cli/index.js'],
    provenance: {
      source: 'live-mcp',
      query_plan_id: 'qplan-fixture',
      tool_name: 'gitnexus.query',
      operation: 'query',
    },
    ...overrides,
  };
}

function providerResultsEnvelope(repo, facts, overrides = {}) {
  return {
    schema_version: 'review-pre-facts-provider-results.v1',
    workflow: 'doc-review',
    target_repo: repo,
    source: 'live-mcp',
    query_plan_id: 'qplan-fixture',
    readiness: 'graph-fresh',
    tier: 'graph-fresh',
    snapshot: currentRepoSnapshot(repo),
    reason_code: 'provider_results_normalized',
    facts,
    ...overrides,
  };
}

describe('review-pre-facts fixtures', () => {
  test('JSON fixtures satisfy required schema fields', () => {
    const queryPlan = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'query-plan.valid.json'), 'utf8'));
    const multiOperationPlan = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'query-plan.multi-operation.json'), 'utf8'));
    const raw = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'provider-raw-result.valid.json'), 'utf8'));
    const contextRaw = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'provider-raw-result.context.json'), 'utf8'));
    const impactRaw = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'provider-raw-result.impact.json'), 'utf8'));
    const detectChangesRaw = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'provider-raw-result.detect-changes.json'), 'utf8'));
    const invalidRaw = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'provider-raw-result.invalid.json'), 'utf8'));
    const providerResults = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'provider-results.valid.json'), 'utf8'));
    const multiOperationResults = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'provider-results.multi-operation.json'), 'utf8'));
    const missingProvenance = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'provider-results.missing-provenance.json'), 'utf8'));
    const runSummary = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'run-summary.valid.json'), 'utf8'));
    providerResults.target_repo = REPO_ROOT;
    multiOperationResults.target_repo = REPO_ROOT;
    missingProvenance.target_repo = REPO_ROOT;

    expect(validateQueryPlan(queryPlan).ok).toBe(true);
    expect(validateQueryPlan(multiOperationPlan).ok).toBe(true);
    expect(validateRawResult(raw, queryPlan).ok).toBe(true);
    expect(validateRawResult(contextRaw, multiOperationPlan).ok).toBe(true);
    expect(validateRawResult(impactRaw, multiOperationPlan).ok).toBe(true);
    expect(validateRawResult(detectChangesRaw, multiOperationPlan).ok).toBe(true);
    expect(validateRawResult(invalidRaw, queryPlan).reason_code).toBe('provider_raw_result_query_mismatch');
    expect(validateProviderResults(providerResults).ok).toBe(true);
    expect(validateProviderResults(multiOperationResults).ok).toBe(true);
    expect(validateProviderResults(missingProvenance).reason_code).toBe('provider_result_missing_provenance');
    expect(runSummary.schema_version).toBe('review-pre-facts-run-summary.v1');
    expect(runSummary.invocation_events.length).toBeGreaterThan(0);
  });
});

describe('review-pre-facts helper modes', () => {
  test('prepare emits an executable bounded query plan without executing live MCP', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      const output = path.join(dir, 'query-plan.json');
      const result = captureRun([
        '--mode', 'prepare',
        '--workflow', 'doc-review',
        '--document', 'docs/plans/plan.md',
        '--repo', repo,
        '--run-id', runId,
        '--summary-dir', dir,
        '--output', output,
      ], repo);

      expect(result.code).toBe(0);
      const plan = JSON.parse(fs.readFileSync(output, 'utf8'));
      expect(plan.schema_version).toBe('review-pre-facts-query-plan.v1');
      expect(plan.readiness).toBe('graph-fresh');
      expect(plan.queries[0]).toEqual(expect.objectContaining({
        query_id: 'q1',
        provider: 'gitnexus',
        tool_name: 'gitnexus.query',
        operation: 'query',
        max_results: 3,
        reason_code: 'provider_query_surface_available',
        fallback_reason_code: 'provider_query_unavailable',
      }));
      expect(plan.queries[0].arguments).toEqual(expect.objectContaining({ limit: 3 }));
      expect(fs.existsSync(path.join(dir, 'provider-results.json'))).toBe(false);
      const summary = JSON.parse(fs.readFileSync(path.join(dir, 'run-summary.json'), 'utf8'));
      expect(summary.invocation_events).toEqual([
        expect.objectContaining({ mode: 'prepare', status: 'completed' }),
      ]);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('prepare treats branch switch pull rebase equivalent HEAD changes as graph-stale', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      write(repo, 'src/cli/after-branch-switch.js', 'module.exports = {};\n');
      spawnSync('git', ['add', 'src/cli/after-branch-switch.js'], { cwd: repo, encoding: 'utf8' });
      spawnSync('git', ['-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'test: branch equivalent change'], {
        cwd: repo,
        encoding: 'utf8',
      });

      const output = path.join(dir, 'query-plan.json');
      const result = captureRun([
        '--mode', 'prepare',
        '--workflow', 'doc-review',
        '--document', 'docs/plans/plan.md',
        '--repo', repo,
        '--run-id', runId,
        '--summary-dir', dir,
        '--output', output,
      ], repo);

      expect(result.code).toBe(0);
      const plan = JSON.parse(fs.readFileSync(output, 'utf8'));
      expect(plan.readiness).toBe('graph-stale');
      expect(plan.tier).toBe('bounded-reads');
      expect(plan.reason_code).toBe('graph_stale_bounded_reads');
      expect(plan.queries).toEqual([]);
      expect(plan.recorded_snapshot.source_revision).not.toBe(plan.snapshot.source_revision);
      expect(plan.recorded_snapshot.worktree_status_hash).toBe(plan.snapshot.worktree_status_hash);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('prepare treats dirty worktree status hash changes as graph-stale', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      write(repo, 'src/cli/dirty-change.js', 'module.exports = { dirty: true };\n');

      const output = path.join(dir, 'query-plan.json');
      const result = captureRun([
        '--mode', 'prepare',
        '--workflow', 'doc-review',
        '--document', 'docs/plans/plan.md',
        '--repo', repo,
        '--run-id', runId,
        '--summary-dir', dir,
        '--output', output,
      ], repo);

      expect(result.code).toBe(0);
      const plan = JSON.parse(fs.readFileSync(output, 'utf8'));
      expect(plan.readiness).toBe('graph-stale');
      expect(plan.tier).toBe('bounded-reads');
      expect(plan.reason_code).toBe('graph_stale_bounded_reads');
      expect(plan.queries).toEqual([]);
      expect(plan.recorded_snapshot.source_revision).toBe(plan.snapshot.source_revision);
      expect(plan.recorded_snapshot.worktree_dirty).toBe(false);
      expect(plan.snapshot.worktree_dirty).toBe(true);
      expect(plan.recorded_snapshot.worktree_status_hash).not.toBe(plan.snapshot.worktree_status_hash);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('prepare emits no-targets query plan when document has no extraction targets', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      write(repo, 'docs/plans/no-targets.md', '# No Targets\n\nOnly prose.\n');
      const output = path.join(dir, 'query-plan.json');
      const result = captureRun([
        '--mode', 'prepare',
        '--workflow', 'doc-review',
        '--document', 'docs/plans/no-targets.md',
        '--repo', repo,
        '--run-id', runId,
        '--summary-dir', dir,
        '--output', output,
      ], repo);

      expect(result.code).toBe(0);
      const plan = JSON.parse(fs.readFileSync(output, 'utf8'));
      expect(plan.readiness).toBe('no-targets');
      expect(plan.tier).toBe('no-targets');
      expect(plan.reason_code).toBe('no_extraction_targets');
      expect(plan.queries).toEqual([]);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('prepare emits bounded context and impact entries for explicit symbol targets', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      write(repo, 'docs/plans/symbol-plan.md', [
        '# Symbol Plan',
        '',
        'Symbol target: name=runCli file_path=src/cli/index.js kind=Function direction=upstream',
        '',
      ].join('\n'));
      writeGraphArtifacts(repo);
      const output = path.join(dir, 'query-plan.json');
      const result = captureRun([
        '--mode', 'prepare',
        '--workflow', 'plan',
        '--document', 'docs/plans/symbol-plan.md',
        '--repo', repo,
        '--run-id', runId,
        '--summary-dir', dir,
        '--output', output,
      ], repo);

      expect(result.code).toBe(0);
      const plan = JSON.parse(fs.readFileSync(output, 'utf8'));
      expect(plan.workflow).toBe('plan');
      expect(plan.operation_profiles).toEqual(['query', 'context', 'impact', 'detect_changes']);
      expect(plan.queries.map((query) => query.operation)).toEqual(expect.arrayContaining(['query', 'context', 'impact']));
      const contextQuery = plan.queries.find((query) => query.operation === 'context');
      expect(contextQuery.tool_name).toBe('gitnexus.context');
      expect(contextQuery.arguments).toEqual(expect.objectContaining({
        name: 'runCli',
        file_path: 'src/cli/index.js',
        kind: 'Function',
        include_content: false,
      }));
      const impactQuery = plan.queries.find((query) => query.operation === 'impact');
      expect(impactQuery.arguments).toEqual(expect.objectContaining({
        target: 'runCli',
        direction: 'upstream',
        maxDepth: 2,
        timeoutMs: 10000,
      }));
      expect(validateQueryPlan(plan).ok).toBe(true);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('prepare records context ambiguity and compare scope degradation without inventing targets', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      write(repo, 'docs/plans/ambiguous-symbol.md', [
        '# Ambiguous Symbol',
        '',
        'Symbol target: name=runCli',
        'Files: `src/cli/index.js`',
        '',
      ].join('\n'));
      writeGraphArtifacts(repo);
      const output = path.join(dir, 'query-plan.json');
      const result = captureRun([
        '--mode', 'prepare',
        '--workflow', 'plan',
        '--document', 'docs/plans/ambiguous-symbol.md',
        '--change-scope', 'compare',
        '--repo', repo,
        '--run-id', runId,
        '--summary-dir', dir,
        '--output', output,
      ], repo);

      expect(result.code).toBe(0);
      const plan = JSON.parse(fs.readFileSync(output, 'utf8'));
      expect(plan.queries.map((query) => query.operation)).not.toContain('context');
      expect(plan.queries.map((query) => query.operation)).not.toContain('detect_changes');
      expect(plan.limitations).toEqual(expect.arrayContaining([
        expect.objectContaining({ operation: 'context', reason_code: 'context_target_ambiguous' }),
        expect.objectContaining({ operation: 'detect_changes', reason_code: 'detect_changes_scope_missing' }),
      ]));
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('prepare emits explicit detect_changes and bounded impact for code-review changed files', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      const output = path.join(dir, 'query-plan.json');
      const result = captureRun([
        '--mode', 'prepare',
        '--workflow', 'code-review',
        '--changed-files', 'src/cli/index.js',
        '--change-scope', 'all',
        '--impact-direction', 'upstream',
        '--repo', repo,
        '--run-id', runId,
        '--summary-dir', dir,
        '--output', output,
      ], repo);

      expect(result.code).toBe(0);
      const plan = JSON.parse(fs.readFileSync(output, 'utf8'));
      const detectChanges = plan.queries.find((query) => query.operation === 'detect_changes');
      expect(detectChanges).toEqual(expect.objectContaining({
        tool_name: 'gitnexus.detect_changes',
        arguments: expect.objectContaining({ scope: 'all' }),
      }));
      const impact = plan.queries.find((query) => query.operation === 'impact');
      expect(impact.arguments).toEqual(expect.objectContaining({
        target: 'src/cli/index.js',
        direction: 'upstream',
      }));
      expect(validateQueryPlan(plan).ok).toBe(true);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('prepare emits detect_changes for explicit change scope even without file targets', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      const output = path.join(dir, 'query-plan.json');
      const result = captureRun([
        '--mode', 'prepare',
        '--workflow', 'code-review',
        '--change-scope', 'all',
        '--repo', repo,
        '--run-id', runId,
        '--summary-dir', dir,
        '--output', output,
      ], repo);

      expect(result.code).toBe(0);
      const plan = JSON.parse(fs.readFileSync(output, 'utf8'));
      expect(plan.readiness).toBe('graph-fresh');
      expect(plan.direct_read_candidates).toEqual([]);
      expect(plan.queries).toContainEqual(expect.objectContaining({
        tool_name: 'gitnexus.detect_changes',
        operation: 'detect_changes',
        arguments: expect.objectContaining({ scope: 'all' }),
      }));
      expect(validateQueryPlan(plan).ok).toBe(true);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('prepare emits impact for explicit impact target even without file targets', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      const output = path.join(dir, 'query-plan.json');
      const result = captureRun([
        '--mode', 'prepare',
        '--workflow', 'plan',
        '--impact-target', 'runCli',
        '--impact-direction', 'upstream',
        '--repo', repo,
        '--run-id', runId,
        '--summary-dir', dir,
        '--output', output,
      ], repo);

      expect(result.code).toBe(0);
      const plan = JSON.parse(fs.readFileSync(output, 'utf8'));
      expect(plan.readiness).toBe('graph-fresh');
      expect(plan.direct_read_candidates).toEqual([]);
      expect(plan.queries).toContainEqual(expect.objectContaining({
        tool_name: 'gitnexus.impact',
        operation: 'impact',
        target_refs: ['runCli'],
        arguments: expect.objectContaining({
          target: 'runCli',
          direction: 'upstream',
        }),
      }));
      expect(validateQueryPlan(plan).ok).toBe(true);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('normalize-provider-results consumes raw live MCP output and render validates provenance', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      const queryPlanPath = path.join(dir, 'query-plan.json');
      const rawPath = path.join(dir, 'provider-raw-result.json');
      const providerResultsPath = path.join(dir, 'provider-results.json');
      const blockPath = path.join(dir, 'codebase-facts.txt');
      const fixturePlan = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'query-plan.valid.json'), 'utf8'));
      const fixtureRaw = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'provider-raw-result.valid.json'), 'utf8'));
      fixturePlan.target_repo = repo;
      fixturePlan.snapshot = currentRepoSnapshot(repo);
      fixtureRaw.target_repo = repo;
      fs.writeFileSync(queryPlanPath, `${JSON.stringify(fixturePlan, null, 2)}\n`, 'utf8');
      fs.writeFileSync(rawPath, `${JSON.stringify(fixtureRaw, null, 2)}\n`, 'utf8');

      const normalized = captureRun([
        '--mode', 'normalize-provider-results',
        '--workflow', 'doc-review',
        '--repo', repo,
        '--query-plan', queryPlanPath,
        '--raw-result', rawPath,
        '--source', 'live-mcp',
        '--output', providerResultsPath,
        '--run-id', runId,
        '--summary-dir', dir,
      ], repo);
      expect(normalized.code).toBe(0);
      const providerResults = JSON.parse(fs.readFileSync(providerResultsPath, 'utf8'));
      expect(providerResults.schema_version).toBe('review-pre-facts-provider-results.v1');
      expect(providerResults.snapshot).toEqual(fixturePlan.snapshot);
      expect(providerResults.facts[0]).toEqual(expect.objectContaining({
        query_id: 'q1',
        fact_kind: 'query_symbol',
        source_path: 'src/cli/index.js',
        summary: expect.arrayContaining(['query pointer runCli']),
        source_reads_required: ['src/cli/index.js'],
      }));
      expect(JSON.stringify(providerResults)).not.toContain('runCli (Cli)');
      expect(JSON.stringify(providerResults)).not.toContain('"excerpt"');

      const rendered = captureRun([
        '--mode', 'render',
        '--workflow', 'doc-review',
        '--repo', repo,
        '--provider-results', providerResultsPath,
        '--output', blockPath,
        '--run-id', runId,
        '--summary-dir', dir,
      ], repo);
      expect(rendered.code).toBe(0);
      const block = fs.readFileSync(blockPath, 'utf8');
      expect(block).toContain('<codebase-facts readiness="graph-fresh" tier="graph-fresh"');
      expect(block).toContain('<source-reads-required>');
      expect(block).toContain('- src/cli/index.js');
      expect(block).not.toContain('<excerpt>');
      const summary = JSON.parse(fs.readFileSync(path.join(dir, 'run-summary.json'), 'utf8'));
      expect(summary.modes_attempted).toEqual(['normalize-provider-results', 'render']);
      expect(summary.selected_tier).toBe('graph-fresh');
      expect(summary.normalization_result.status).toBe('completed');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('normalize-provider-results supports context impact and detect_changes summary facts', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      const queryPlanPath = path.join(dir, 'query-plan.json');
      const rawPath = path.join(dir, 'provider-raw-result.json');
      const providerResultsPath = path.join(dir, 'provider-results.json');
      const blockPath = path.join(dir, 'codebase-facts.txt');
      const queryPlan = {
        schema_version: 'review-pre-facts-query-plan.v1',
        workflow: 'plan',
        target_repo: repo,
        query_plan_id: 'qplan-multi-operation',
        readiness: 'graph-fresh',
        tier: 'graph-fresh',
        reason_code: 'provider_query_plan_rendered',
        snapshot: currentRepoSnapshot(repo),
        targets: [],
        queries: [
          {
            query_id: 'q1',
            provider: 'gitnexus',
            tool_name: 'gitnexus.context',
            operation: 'context',
            arguments: {
              repo: path.basename(repo),
              name: 'runCli',
              file_path: 'src/cli/index.js',
              kind: 'Function',
              include_content: false,
            },
            target_refs: ['src/cli/index.js'],
            max_results: 1,
            reason_code: 'provider_context_surface_available',
            fallback_reason_code: 'context_target_ambiguous',
          },
          {
            query_id: 'q2',
            provider: 'gitnexus',
            tool_name: 'gitnexus.impact',
            operation: 'impact',
            arguments: {
              repo: path.basename(repo),
              target: 'runCli',
              direction: 'upstream',
              file_path: 'src/cli/index.js',
              kind: 'Function',
              maxDepth: 2,
              includeTests: true,
              relationTypes: ['CALLS', 'IMPORTS'],
              timeoutMs: 10000,
            },
            target_refs: ['src/cli/index.js'],
            max_results: 1,
            reason_code: 'provider_impact_surface_available',
            fallback_reason_code: 'impact_target_unavailable',
          },
          {
            query_id: 'q3',
            provider: 'gitnexus',
            tool_name: 'gitnexus.detect_changes',
            operation: 'detect_changes',
            arguments: {
              repo: path.basename(repo),
              scope: 'all',
            },
            target_refs: ['scope:all'],
            max_results: 1,
            reason_code: 'provider_detect_changes_surface_available',
            fallback_reason_code: 'detect_changes_scope_missing',
          },
        ],
        direct_read_candidates: [],
      };
      fs.writeFileSync(queryPlanPath, `${JSON.stringify(queryPlan, null, 2)}\n`, 'utf8');
      fs.writeFileSync(rawPath, `${JSON.stringify({
        schema_version: 'review-pre-facts-provider-raw-result.v1',
        workflow: 'plan',
        target_repo: repo,
        source: 'live-mcp',
        query_plan_id: queryPlan.query_plan_id,
        raw_results: [
          {
            query_id: 'q1',
            tool_name: 'gitnexus.context',
            operation: 'context',
            arguments: queryPlan.queries[0].arguments,
            status: 'ok',
            response: {
              status: 'found',
              symbol: {
                uid: 'Function:src/cli/index.js:runCli',
                name: 'runCli',
                kind: 'Function',
                filePath: 'src/cli/index.js',
                startLine: 1,
                endLine: 3,
              },
              incoming: { calls: [{ name: 'main', filePath: 'src/cli/index.js' }] },
              outgoing: { calls: [] },
              processes: [],
            },
          },
          {
            query_id: 'q2',
            tool_name: 'gitnexus.impact',
            operation: 'impact',
            arguments: queryPlan.queries[1].arguments,
            status: 'ok',
            response: {
              risk: 'LOW',
              summary: { direct: 1, processes_affected: 1, modules_affected: 1 },
              affected_processes: [
                { name: 'runPrepare', filePath: 'src/cli/index.js', earliest_broken_step: 1 },
              ],
              affected_modules: [
                { name: 'Cli', hits: 1, impact: 'direct' },
              ],
              byDepth: {
                1: [{ name: 'runPrepare', filePath: 'src/cli/index.js' }],
                2: [{ name: 'runReviewPreFacts', filePath: 'src/cli/index.js' }],
              },
            },
          },
          {
            query_id: 'q3',
            tool_name: 'gitnexus.detect_changes',
            operation: 'detect_changes',
            arguments: queryPlan.queries[2].arguments,
            status: 'ok',
            response: {
              summary: { changed_count: 1, affected_count: 1, risk_level: 'medium' },
              changed_symbols: [
                { name: 'runCli', kind: 'Function', filePath: 'src/cli/index.js' },
              ],
              affected_processes: [
                { name: 'runPrepare', filePath: 'src/cli/index.js' },
              ],
              raw_diff: '@@ -1 +1 @@\n-secret\n+secret',
            },
          },
        ],
      }, null, 2)}\n`, 'utf8');

      const normalized = captureRun([
        '--mode', 'normalize-provider-results',
        '--workflow', 'plan',
        '--repo', repo,
        '--query-plan', queryPlanPath,
        '--raw-result', rawPath,
        '--source', 'live-mcp',
        '--output', providerResultsPath,
        '--run-id', runId,
        '--summary-dir', dir,
      ], repo);

      expect(normalized.code).toBe(0);
      expect(normalized.json.capabilities_used).toEqual(['context', 'detect_changes', 'impact']);
      const providerResults = JSON.parse(fs.readFileSync(providerResultsPath, 'utf8'));
      expect(providerResults.facts.map((fact) => fact.fact_kind)).toEqual([
        'context_symbol',
        'impact_summary',
        'detect_changes_summary',
      ]);
      expect(JSON.stringify(providerResults)).not.toContain('@@ -1 +1 @@');
      expect(providerResults.facts[1]).toEqual(expect.objectContaining({
        risk: 'LOW',
        by_depth_counts: { 1: 1, 2: 1 },
        omitted_detail_reason: 'impact_detail_summary_only',
      }));
      expect(providerResults.facts[2]).toEqual(expect.objectContaining({
        raw_diff_status: 'omitted',
        redaction_status: 'redacted',
      }));
      expect(validateProviderResults(providerResults).ok).toBe(true);

      const rendered = captureRun([
        '--mode', 'render',
        '--workflow', 'plan',
        '--repo', repo,
        '--provider-results', providerResultsPath,
        '--output', blockPath,
        '--run-id', runId,
        '--summary-dir', dir,
      ], repo);
      expect(rendered.code).toBe(0);
      const block = fs.readFileSync(blockPath, 'utf8');
      expect(block).toContain('workflow="plan"');
      expect(block).toContain('<capabilities-used>');
      expect(block).toContain('context_symbol');
      expect(block).toContain('source-reads-required');
      expect(block).not.toMatch(/Coverage|finding|reviewer|dispatch/i);
      const summary = JSON.parse(fs.readFileSync(path.join(dir, 'run-summary.json'), 'utf8'));
      expect(summary.graph_capability_usage).toEqual(expect.objectContaining({
        capabilities_used: ['context', 'detect_changes', 'impact'],
        redaction_status: 'redacted',
        source_reads_required_count: 1,
      }));
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('normalize-provider-results keeps explicit zero summaries and omits only empty operations', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      const queryPlanPath = path.join(dir, 'query-plan.json');
      const rawPath = path.join(dir, 'provider-raw-result.json');
      const providerResultsPath = path.join(dir, 'provider-results.json');
      const queryPlan = {
        schema_version: 'review-pre-facts-query-plan.v1',
        workflow: 'plan',
        target_repo: repo,
        query_plan_id: 'qplan-explicit-zero-results',
        readiness: 'graph-fresh',
        tier: 'graph-fresh',
        reason_code: 'provider_query_plan_rendered',
        snapshot: currentRepoSnapshot(repo),
        targets: [],
        queries: [
          {
            query_id: 'q1',
            provider: 'gitnexus',
            tool_name: 'gitnexus.impact',
            operation: 'impact',
            arguments: {
              repo: path.basename(repo),
              target: 'runCli',
              direction: 'upstream',
              file_path: 'src/cli/index.js',
              maxDepth: 2,
              timeoutMs: 10000,
            },
            target_refs: ['src/cli/index.js'],
            max_results: 1,
            reason_code: 'provider_impact_surface_available',
            fallback_reason_code: 'impact_target_unavailable',
          },
          {
            query_id: 'q2',
            provider: 'gitnexus',
            tool_name: 'gitnexus.detect_changes',
            operation: 'detect_changes',
            arguments: {
              repo: path.basename(repo),
              scope: 'all',
            },
            target_refs: ['scope:all'],
            max_results: 1,
            reason_code: 'provider_detect_changes_surface_available',
            fallback_reason_code: 'detect_changes_scope_missing',
          },
        ],
        direct_read_candidates: [],
      };
      fs.writeFileSync(queryPlanPath, `${JSON.stringify(queryPlan, null, 2)}\n`, 'utf8');
      fs.writeFileSync(rawPath, `${JSON.stringify({
        schema_version: 'review-pre-facts-provider-raw-result.v1',
        workflow: 'plan',
        target_repo: repo,
        source: 'live-mcp',
        query_plan_id: queryPlan.query_plan_id,
        raw_results: [
          {
            query_id: 'q1',
            tool_name: 'gitnexus.impact',
            operation: 'impact',
            arguments: queryPlan.queries[0].arguments,
            status: 'ok',
            response: {
              risk: 'LOW',
              summary: { direct: 0, processes_affected: 0 },
              byDepth: {},
            },
          },
          {
            query_id: 'q2',
            tool_name: 'gitnexus.detect_changes',
            operation: 'detect_changes',
            arguments: queryPlan.queries[1].arguments,
            status: 'ok',
            response: {},
          },
        ],
      }, null, 2)}\n`, 'utf8');

      const normalized = captureRun([
        '--mode', 'normalize-provider-results',
        '--workflow', 'plan',
        '--repo', repo,
        '--query-plan', queryPlanPath,
        '--raw-result', rawPath,
        '--source', 'live-mcp',
        '--output', providerResultsPath,
        '--run-id', runId,
        '--summary-dir', dir,
      ], repo);

      expect(normalized.code).toBe(0);
      const providerResults = JSON.parse(fs.readFileSync(providerResultsPath, 'utf8'));
      expect(providerResults.facts).toHaveLength(1);
      expect(providerResults.facts[0]).toEqual(expect.objectContaining({
        fact_kind: 'impact_summary',
        summary: expect.arrayContaining(['0 direct', '0 processes']),
      }));
      expect(providerResults.omitted_facts).toEqual(expect.arrayContaining([
        expect.objectContaining({ query_id: 'q2', reason_code: 'provider_result_no_usable_facts' }),
      ]));
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('normalize-provider-results does not invent zero counts for risk-only impact evidence', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      const queryPlanPath = path.join(dir, 'query-plan.json');
      const rawPath = path.join(dir, 'provider-raw-result.json');
      const providerResultsPath = path.join(dir, 'provider-results.json');
      const queryPlan = {
        schema_version: 'review-pre-facts-query-plan.v1',
        workflow: 'plan',
        target_repo: repo,
        query_plan_id: 'qplan-risk-only-impact',
        readiness: 'graph-fresh',
        tier: 'graph-fresh',
        reason_code: 'provider_query_plan_rendered',
        snapshot: currentRepoSnapshot(repo),
        targets: [],
        queries: [
          {
            query_id: 'q1',
            provider: 'gitnexus',
            tool_name: 'gitnexus.impact',
            operation: 'impact',
            arguments: {
              repo: path.basename(repo),
              target: 'runCli',
              direction: 'upstream',
              maxDepth: 2,
              timeoutMs: 10000,
            },
            target_refs: ['runCli'],
            max_results: 1,
            reason_code: 'provider_impact_surface_available',
            fallback_reason_code: 'impact_target_unavailable',
          },
        ],
        direct_read_candidates: [],
      };
      fs.writeFileSync(queryPlanPath, `${JSON.stringify(queryPlan, null, 2)}\n`, 'utf8');
      fs.writeFileSync(rawPath, `${JSON.stringify({
        schema_version: 'review-pre-facts-provider-raw-result.v1',
        source: 'live-mcp',
        query_plan_id: queryPlan.query_plan_id,
        raw_results: [
          {
            query_id: 'q1',
            tool_name: 'gitnexus.impact',
            operation: 'impact',
            arguments: queryPlan.queries[0].arguments,
            status: 'ok',
            response: {
              risk: 'LOW',
            },
          },
        ],
      }, null, 2)}\n`, 'utf8');

      const normalized = captureRun([
        '--mode', 'normalize-provider-results',
        '--workflow', 'plan',
        '--repo', repo,
        '--query-plan', queryPlanPath,
        '--raw-result', rawPath,
        '--source', 'live-mcp',
        '--output', providerResultsPath,
        '--run-id', runId,
        '--summary-dir', dir,
      ], repo);

      expect(normalized.code).toBe(0);
      const providerResults = JSON.parse(fs.readFileSync(providerResultsPath, 'utf8'));
      expect(providerResults.facts[0]).toEqual(expect.objectContaining({
        fact_kind: 'impact_summary',
        summary: ['impact risk LOW'],
      }));
      expect(providerResults.facts[0].summary).not.toEqual(expect.arrayContaining(['0 direct', '0 processes']));
      expect(validateProviderResults(providerResults).ok).toBe(true);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('normalize-provider-results accepts explicit zero detect_changes evidence and records worktree scope', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      const queryPlanPath = path.join(dir, 'query-plan.json');
      const rawPath = path.join(dir, 'provider-raw-result.json');
      const providerResultsPath = path.join(dir, 'provider-results.json');
      const queryPlan = {
        schema_version: 'review-pre-facts-query-plan.v1',
        workflow: 'plan',
        target_repo: repo,
        query_plan_id: 'qplan-zero-detect-changes',
        readiness: 'graph-fresh',
        tier: 'graph-fresh',
        reason_code: 'provider_query_plan_rendered',
        snapshot: currentRepoSnapshot(repo),
        targets: [],
        queries: [
          {
            query_id: 'q1',
            provider: 'gitnexus',
            tool_name: 'gitnexus.detect_changes',
            operation: 'detect_changes',
            arguments: {
              repo: path.basename(repo),
              scope: 'all',
            },
            target_refs: ['scope:all'],
            max_results: 1,
            reason_code: 'provider_detect_changes_surface_available',
            fallback_reason_code: 'detect_changes_scope_missing',
          },
        ],
        direct_read_candidates: [],
      };
      fs.writeFileSync(queryPlanPath, `${JSON.stringify(queryPlan, null, 2)}\n`, 'utf8');
      fs.writeFileSync(rawPath, `${JSON.stringify({
        schema_version: 'review-pre-facts-provider-raw-result.v1',
        source: 'live-mcp',
        query_plan_id: queryPlan.query_plan_id,
        raw_results: [
          {
            query_id: 'q1',
            tool_name: 'gitnexus.detect_changes',
            operation: 'detect_changes',
            arguments: queryPlan.queries[0].arguments,
            status: 'ok',
            response: {
              summary: { changed_count: 0, affected_count: 0 },
              changed_symbols: [],
              affected_processes: [],
            },
          },
        ],
      }, null, 2)}\n`, 'utf8');

      const normalized = captureRun([
        '--mode', 'normalize-provider-results',
        '--workflow', 'plan',
        '--repo', repo,
        '--query-plan', queryPlanPath,
        '--raw-result', rawPath,
        '--source', 'live-mcp',
        '--output', providerResultsPath,
        '--run-id', runId,
        '--summary-dir', dir,
      ], repo);

      expect(normalized.code).toBe(0);
      const providerResults = JSON.parse(fs.readFileSync(providerResultsPath, 'utf8'));
      expect(providerResults.facts[0]).toEqual(expect.objectContaining({
        fact_kind: 'detect_changes_summary',
        scope: expect.objectContaining({
          type: 'all',
          worktree: path.basename(repo),
        }),
        changed_symbols: [],
        affected_processes: [],
      }));
      expect(validateProviderResults(providerResults).ok).toBe(true);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('normalize-provider-results repairs missing query_plan_id and omits unsafe provider source paths', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      const queryPlanPath = path.join(dir, 'query-plan.json');
      const rawPath = path.join(dir, 'provider-raw-result.json');
      const providerResultsPath = path.join(dir, 'provider-results.json');
      const fixturePlan = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'query-plan.valid.json'), 'utf8'));
      fixturePlan.target_repo = repo;
      fixturePlan.snapshot = currentRepoSnapshot(repo);
      fs.writeFileSync(queryPlanPath, `${JSON.stringify(fixturePlan, null, 2)}\n`, 'utf8');
      fs.writeFileSync(rawPath, `${JSON.stringify({
        schema_version: 'review-pre-facts-provider-raw-result.v1',
        source: 'live-mcp',
        query_plan_id: fixturePlan.query_plan_id,
        raw_results: [
          {
            query_id: 'q1',
            tool_name: 'gitnexus.query',
            operation: 'query',
            status: 'ok',
            response: {
              facts: [
                {
                  provider: 'forged-provider',
                  query_id: 'forged-query',
                  source_path: 'src/cli/index.js',
                  anchor: 'runCli',
                  excerpt: 'runCli entrypoint',
                  provenance: {
                    source: 'forged-source',
                    query_plan_id: 'forged-plan',
                    tool_name: 'forged.tool',
                  },
                },
                {
                  source_path: '../outside.md',
                  anchor: 'outside',
                  excerpt: 'unsafe outside path',
                  provenance: {
                    source: 'live-mcp',
                    query_plan_id: fixturePlan.query_plan_id,
                    tool_name: 'gitnexus.query',
                  },
                },
              ],
            },
          },
        ],
      }, null, 2)}\n`, 'utf8');

      const normalized = captureRun([
        '--mode', 'normalize-provider-results',
        '--workflow', 'doc-review',
        '--repo', repo,
        '--query-plan', queryPlanPath,
        '--raw-result', rawPath,
        '--source', 'live-mcp',
        '--output', providerResultsPath,
        '--run-id', runId,
        '--summary-dir', dir,
      ], repo);

      expect(normalized.code).toBe(0);
      const providerResults = JSON.parse(fs.readFileSync(providerResultsPath, 'utf8'));
      expect(providerResults.facts).toHaveLength(1);
      expect(providerResults.facts[0]).toEqual(expect.objectContaining({
        provider: 'gitnexus',
        query_id: 'q1',
        source_path: 'src/cli/index.js',
        provenance: expect.objectContaining({
          source: 'live-mcp',
          query_plan_id: fixturePlan.query_plan_id,
          tool_name: 'gitnexus.query',
          operation: 'query',
        }),
      }));
      expect(validateProviderResults(providerResults).ok).toBe(true);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('normalize-provider-results redacts query_symbol durable facts and drops provider-supplied provenance', () => {
    const repo = tempRepo();
    try {
      const { runId, dir } = tempRun();
      const queryPlanPath = path.join(dir, 'query-plan.json');
      const rawPath = path.join(dir, 'provider-raw-result.json');
      const providerResultsPath = path.join(dir, 'provider-results.json');
      const fixturePlan = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'query-plan.valid.json'), 'utf8'));
      fixturePlan.target_repo = repo;
      fixturePlan.snapshot = currentRepoSnapshot(repo);
      fs.writeFileSync(queryPlanPath, `${JSON.stringify(fixturePlan, null, 2)}\n`, 'utf8');
      fs.writeFileSync(rawPath, `${JSON.stringify({
        schema_version: 'review-pre-facts-provider-raw-result.v1',
        source: 'live-mcp',
        query_plan_id: fixturePlan.query_plan_id,
        raw_results: [
          {
            query_id: 'q1',
            tool_name: 'gitnexus.query',
            operation: 'query',
            arguments: fixturePlan.queries[0].arguments,
            status: 'ok',
            response: {
              facts: [
                {
                  source_path: 'src/cli/index.js',
                  anchor: 'runCli',
                  excerpt: 'safe symbol pointer',
                  provenance: {
                    source: 'live-mcp',
                    query_plan_id: fixturePlan.query_plan_id,
                    tool_name: 'gitnexus.query',
                    note: 'api_key=should-not-persist',
                  },
                },
              ],
            },
          },
        ],
      }, null, 2)}\n`, 'utf8');

      const safe = captureRun([
        '--mode', 'normalize-provider-results',
        '--workflow', 'doc-review',
        '--repo', repo,
        '--query-plan', queryPlanPath,
        '--raw-result', rawPath,
        '--source', 'live-mcp',
        '--output', providerResultsPath,
        '--run-id', runId,
        '--summary-dir', dir,
      ], repo);

      expect(safe.code).toBe(0);
      const providerResultsText = fs.readFileSync(providerResultsPath, 'utf8');
      expect(providerResultsText).not.toContain('safe symbol pointer');
      expect(providerResultsText).not.toContain('should-not-persist');
      expect(providerResultsText).not.toContain('provider_metadata');
      const providerResults = JSON.parse(providerResultsText);
      expect(providerResults.facts[0]).toEqual(expect.objectContaining({
        summary: expect.arrayContaining(['query pointer runCli']),
        source_reads_required: ['src/cli/index.js'],
      }));
      expect(validateProviderResults(providerResults).ok).toBe(true);

      const { runId: noExcerptRunId, dir: noExcerptDir } = tempRun();
      const noExcerptQueryPlanPath = path.join(noExcerptDir, 'query-plan.json');
      const noExcerptRawPath = path.join(noExcerptDir, 'provider-raw-result.json');
      const noExcerptOutputPath = path.join(noExcerptDir, 'provider-results.json');
      fs.writeFileSync(noExcerptQueryPlanPath, `${JSON.stringify(fixturePlan, null, 2)}\n`, 'utf8');
      fs.writeFileSync(noExcerptRawPath, `${JSON.stringify({
        schema_version: 'review-pre-facts-provider-raw-result.v1',
        source: 'live-mcp',
        query_plan_id: fixturePlan.query_plan_id,
        raw_results: [
          {
            query_id: 'q1',
            tool_name: 'gitnexus.query',
            operation: 'query',
            arguments: fixturePlan.queries[0].arguments,
            status: 'ok',
            response: {
              facts: [
                {
                  source_path: 'src/cli/index.js',
                  anchor: 'runCli',
                  provenance: {
                    source: 'live-mcp',
                    query_plan_id: fixturePlan.query_plan_id,
                    tool_name: 'gitnexus.query',
                  },
                },
              ],
            },
          },
        ],
      }, null, 2)}\n`, 'utf8');
      const noExcerpt = captureRun([
        '--mode', 'normalize-provider-results',
        '--workflow', 'doc-review',
        '--repo', repo,
        '--query-plan', noExcerptQueryPlanPath,
        '--raw-result', noExcerptRawPath,
        '--source', 'live-mcp',
        '--output', noExcerptOutputPath,
        '--run-id', noExcerptRunId,
        '--summary-dir', noExcerptDir,
      ], repo);
      expect(noExcerpt.code).toBe(0);
      const noExcerptResults = JSON.parse(fs.readFileSync(noExcerptOutputPath, 'utf8'));
      expect(noExcerptResults.facts[0]).toEqual(expect.objectContaining({
        source_path: 'src/cli/index.js',
        summary: expect.arrayContaining(['query pointer runCli']),
      }));

      const { runId: unsafeRunId, dir: unsafeDir } = tempRun();
      const unsafeQueryPlanPath = path.join(unsafeDir, 'query-plan.json');
      const unsafeRawPath = path.join(unsafeDir, 'provider-raw-result.json');
      const unsafeOutputPath = path.join(unsafeDir, 'provider-results.json');
      fs.writeFileSync(unsafeQueryPlanPath, `${JSON.stringify(fixturePlan, null, 2)}\n`, 'utf8');
      fs.writeFileSync(unsafeRawPath, `${JSON.stringify({
        schema_version: 'review-pre-facts-provider-raw-result.v1',
        source: 'live-mcp',
        query_plan_id: fixturePlan.query_plan_id,
        raw_results: [
          {
            query_id: 'q1',
            tool_name: 'gitnexus.query',
            operation: 'query',
            arguments: fixturePlan.queries[0].arguments,
            status: 'ok',
            response: {
              facts: [
                {
                  source_path: 'src/cli/index.js',
                  anchor: 'runCli',
                  excerpt: 'api_key=secret-value',
                  provenance: {
                    source: 'live-mcp',
                    query_plan_id: fixturePlan.query_plan_id,
                    tool_name: 'gitnexus.query',
                  },
                },
              ],
            },
          },
        ],
      }, null, 2)}\n`, 'utf8');

      const unsafe = captureRun([
        '--mode', 'normalize-provider-results',
        '--workflow', 'doc-review',
        '--repo', repo,
        '--query-plan', unsafeQueryPlanPath,
        '--raw-result', unsafeRawPath,
        '--source', 'live-mcp',
        '--output', unsafeOutputPath,
        '--run-id', unsafeRunId,
        '--summary-dir', unsafeDir,
      ], repo);

      expect(unsafe.code).toBe(1);
      expect(unsafe.json.error.code).toBe('provider_fact_redaction_failed');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('normalize-provider-results validates generated graph and operation facts before writing durable output', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      write(repo, 'src/utils/tokenUtils.js', 'function tokenHelper() {\n  return true;\n}\n');
      const queryPlanPath = path.join(dir, 'query-plan.json');
      const rawPath = path.join(dir, 'provider-raw-result.json');
      const providerResultsPath = path.join(dir, 'provider-results.json');
      const queryPlan = {
        schema_version: 'review-pre-facts-query-plan.v1',
        workflow: 'plan',
        target_repo: repo,
        query_plan_id: 'qplan-normalize-stage-redaction',
        readiness: 'graph-fresh',
        tier: 'graph-fresh',
        reason_code: 'provider_query_plan_rendered',
        snapshot: currentRepoSnapshot(repo),
        targets: [],
        queries: [
          {
            query_id: 'q1',
            provider: 'gitnexus',
            tool_name: 'gitnexus.query',
            operation: 'query',
            arguments: {
              repo: path.basename(repo),
              query: 'token helper',
              include_content: false,
              limit: 3,
              max_symbols: 5,
            },
            target_refs: ['src/utils/tokenUtils.js'],
            max_results: 3,
            reason_code: 'provider_query_surface_available',
            fallback_reason_code: 'provider_query_unavailable',
          },
          {
            query_id: 'q2',
            provider: 'gitnexus',
            tool_name: 'gitnexus.query',
            operation: 'query',
            arguments: {
              repo: path.basename(repo),
              query: 'unsafe symbol',
              include_content: false,
              limit: 3,
              max_symbols: 5,
            },
            target_refs: ['src/cli/index.js'],
            max_results: 3,
            reason_code: 'provider_query_surface_available',
            fallback_reason_code: 'provider_query_unavailable',
          },
          {
            query_id: 'q3',
            provider: 'gitnexus',
            tool_name: 'gitnexus.context',
            operation: 'context',
            arguments: {
              repo: path.basename(repo),
              name: 'runCli',
              file_path: 'src/cli/index.js',
              include_content: false,
            },
            target_refs: ['src/cli/index.js'],
            max_results: 1,
            reason_code: 'provider_context_surface_available',
            fallback_reason_code: 'context_target_ambiguous',
          },
        ],
        direct_read_candidates: [],
      };
      fs.writeFileSync(queryPlanPath, `${JSON.stringify(queryPlan, null, 2)}\n`, 'utf8');
      fs.writeFileSync(rawPath, `${JSON.stringify({
        schema_version: 'review-pre-facts-provider-raw-result.v1',
        source: 'live-mcp',
        query_plan_id: queryPlan.query_plan_id,
        raw_results: [
          {
            query_id: 'q1',
            tool_name: 'gitnexus.query',
            operation: 'query',
            arguments: queryPlan.queries[0].arguments,
            status: 'ok',
            response: {
              definitions: [
                { name: 'tokenHelper', filePath: 'src/utils/tokenUtils.js', startLine: 1, endLine: 3 },
              ],
            },
          },
          {
            query_id: 'q2',
            tool_name: 'gitnexus.query',
            operation: 'query',
            arguments: queryPlan.queries[1].arguments,
            status: 'ok',
            response: {
              definitions: [
                { name: 'api_key=secret123', filePath: 'src/cli/index.js', startLine: 1, endLine: 1 },
              ],
            },
          },
          {
            query_id: 'q3',
            tool_name: 'gitnexus.context',
            operation: 'context',
            arguments: queryPlan.queries[2].arguments,
            status: 'ok',
            response: {
              symbol: {
                name: 'diff --git a/src/cli/index.js b/src/cli/index.js',
                filePath: 'src/cli/index.js',
                startLine: 1,
                endLine: 1,
              },
              incoming: { calls: [] },
              outgoing: { calls: [] },
              processes: [],
            },
          },
        ],
      }, null, 2)}\n`, 'utf8');

      const normalized = captureRun([
        '--mode', 'normalize-provider-results',
        '--workflow', 'plan',
        '--repo', repo,
        '--query-plan', queryPlanPath,
        '--raw-result', rawPath,
        '--source', 'live-mcp',
        '--output', providerResultsPath,
        '--run-id', runId,
        '--summary-dir', dir,
      ], repo);

      expect(normalized.code).toBe(0);
      const providerResultsText = fs.readFileSync(providerResultsPath, 'utf8');
      expect(providerResultsText).not.toContain('api_key=secret123');
      expect(providerResultsText).not.toContain('diff --git');
      const providerResults = JSON.parse(providerResultsText);
      expect(providerResults.facts).toHaveLength(1);
      expect(providerResults.facts[0]).toEqual(expect.objectContaining({
        fact_kind: 'query_symbol',
        source_path: 'src/utils/tokenUtils.js',
        source_reads_required: ['src/utils/tokenUtils.js'],
      }));
      expect(providerResults.omitted_facts).toEqual(expect.arrayContaining([
        expect.objectContaining({ query_id: 'q2', reason_code: 'provider_fact_redaction_failed' }),
        expect.objectContaining({ query_id: 'q3', reason_code: 'provider_fact_redaction_failed' }),
      ]));
      expect(validateProviderResults(providerResults).ok).toBe(true);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('render downgrades provider results that lack provenance', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      const providerResultsPath = path.join(dir, 'provider-results.json');
      const blockPath = path.join(dir, 'codebase-facts.txt');
      const providerResults = JSON.parse(fs.readFileSync(
        path.join(FIXTURE_DIR, 'provider-results.missing-provenance.json'),
        'utf8',
      ));
      providerResults.target_repo = repo;
      fs.writeFileSync(providerResultsPath, `${JSON.stringify(providerResults, null, 2)}\n`, 'utf8');

      const rendered = captureRun([
        '--mode', 'render',
        '--workflow', 'doc-review',
        '--repo', repo,
        '--provider-results', providerResultsPath,
        '--output', blockPath,
        '--run-id', runId,
        '--summary-dir', dir,
      ], repo);

      expect(rendered.code).toBe(0);
      expect(rendered.json.provider_results_valid).toBe(false);
      const block = fs.readFileSync(blockPath, 'utf8');
      expect(block).toContain('tier="unavailable"');
      expect(block).toContain('reason="provider_result_missing_provenance"');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('validateProviderResults rejects facts that violate the fact contract', () => {
    const repo = tempRepo();
    try {
      const invalidCases = [
        { line_window: 'bad' },
        { line_window: { start: 4, end: 3 } },
        { readiness: undefined },
        { tier: 'unknown-tier' },
        { excerpt: 'x'.repeat(LIMITS.perExcerptChars + 1) },
        { summary: [] },
        { source_reads_required: undefined },
        { source_path: 'src/cli/missing-provider-source.js' },
        { target: 'src/cli/missing-provider-target.js' },
      ];

      for (const overrides of invalidCases) {
        const fact = normalizedProviderFact(0, overrides);
        if (Object.prototype.hasOwnProperty.call(overrides, 'readiness') && overrides.readiness === undefined) {
          delete fact.readiness;
        }
        if (Object.prototype.hasOwnProperty.call(overrides, 'source_reads_required') && overrides.source_reads_required === undefined) {
          delete fact.source_reads_required;
        }
        const result = validateProviderResults(providerResultsEnvelope(repo, [fact]));
        expect(result).toEqual(expect.objectContaining({
          ok: false,
          reason_code: 'provider_results_schema_invalid',
        }));
      }
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('render downgrades provider results with malformed fact contract fields', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      const providerResultsPath = path.join(dir, 'provider-results.json');
      const blockPath = path.join(dir, 'codebase-facts.txt');
      fs.writeFileSync(providerResultsPath, `${JSON.stringify(providerResultsEnvelope(repo, [
        normalizedProviderFact(0, { line_window: 'bad' }),
      ]), null, 2)}\n`, 'utf8');

      const rendered = captureRun([
        '--mode', 'render',
        '--workflow', 'doc-review',
        '--repo', repo,
        '--provider-results', providerResultsPath,
        '--output', blockPath,
        '--run-id', runId,
        '--summary-dir', dir,
      ], repo);

      expect(rendered.code).toBe(0);
      expect(rendered.json.provider_results_valid).toBe(false);
      expect(rendered.json.reason_code).toBe('provider_results_schema_invalid');
      const block = fs.readFileSync(blockPath, 'utf8');
      expect(block).toContain('tier="unavailable"');
      expect(block).not.toContain('undefined-undefined');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('render downgrades malformed or unsafe provider results deterministically', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      const providerResultsPath = path.join(dir, 'provider-results.json');
      const blockPath = path.join(dir, 'codebase-facts.txt');
      fs.writeFileSync(providerResultsPath, '{not json\n', 'utf8');
      const malformed = captureRun([
        '--mode', 'render',
        '--workflow', 'doc-review',
        '--repo', repo,
        '--provider-results', providerResultsPath,
        '--output', blockPath,
        '--run-id', runId,
        '--summary-dir', dir,
      ], repo);

      expect(malformed.code).toBe(0);
      expect(malformed.json.reason_code).toBe('provider_results_schema_invalid');
      expect(malformed.json.provider_results_valid).toBe(false);
      expect(fs.readFileSync(blockPath, 'utf8')).toContain('tier="unavailable"');

      const { runId: nullRunId, dir: nullDir } = tempRun();
      const nullProviderResultsPath = path.join(nullDir, 'provider-results.json');
      const nullBlockPath = path.join(nullDir, 'codebase-facts.txt');
      fs.writeFileSync(nullProviderResultsPath, 'null\n', 'utf8');
      const nullResult = captureRun([
        '--mode', 'render',
        '--workflow', 'doc-review',
        '--repo', repo,
        '--provider-results', nullProviderResultsPath,
        '--output', nullBlockPath,
        '--run-id', nullRunId,
        '--summary-dir', nullDir,
      ], repo);

      expect(nullResult.code).toBe(0);
      expect(nullResult.json.reason_code).toBe('provider_results_schema_invalid');
      expect(nullResult.json.provider_results_valid).toBe(false);
      expect(fs.readFileSync(nullBlockPath, 'utf8')).toContain('tier="unavailable"');

      const { runId: unsafeRunId, dir: unsafeDir } = tempRun();
      const unsafeProviderResultsPath = path.join(unsafeDir, 'provider-results.json');
      const unsafeBlockPath = path.join(unsafeDir, 'codebase-facts.txt');
      fs.writeFileSync(unsafeProviderResultsPath, `${JSON.stringify({
        schema_version: 'review-pre-facts-provider-results.v1',
        workflow: 'doc-review',
        target_repo: repo,
        source: 'live-mcp',
        query_plan_id: 'qplan-fixture',
        readiness: 'graph-fresh',
        tier: 'graph-fresh',
        reason_code: 'provider_results_normalized',
        facts: [
          {
            provider: 'gitnexus',
            query_id: 'q1',
            source_path: '../outside.md',
            line_window: { start: 1, end: 1 },
            excerpt: 'unsafe path',
            readiness: 'graph-fresh',
            tier: 'graph-fresh',
            reason_code: 'provider_fact',
            provenance: {
              source: 'live-mcp',
              query_plan_id: 'qplan-fixture',
              tool_name: 'gitnexus.query',
            },
          },
        ],
      }, null, 2)}\n`, 'utf8');
      const unsafe = captureRun([
        '--mode', 'render',
        '--workflow', 'doc-review',
        '--repo', repo,
        '--provider-results', unsafeProviderResultsPath,
        '--output', unsafeBlockPath,
        '--run-id', unsafeRunId,
        '--summary-dir', unsafeDir,
      ], repo);

      expect(unsafe.code).toBe(0);
      expect(unsafe.json.reason_code).toBe('provider_results_schema_invalid');
      expect(fs.readFileSync(unsafeBlockPath, 'utf8')).toContain('tier="unavailable"');

      const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-review-pre-facts-outside-'));
      try {
        fs.writeFileSync(path.join(outside, 'secret.md'), '# Secret\n', 'utf8');
        try {
          fs.symlinkSync(path.join(outside, 'secret.md'), path.join(repo, 'provider-escape.md'));
        } catch (_error) {
          return;
        }
        const { runId: symlinkRunId, dir: symlinkDir } = tempRun();
        const symlinkProviderResultsPath = path.join(symlinkDir, 'provider-results.json');
        const symlinkBlockPath = path.join(symlinkDir, 'codebase-facts.txt');
        fs.writeFileSync(symlinkProviderResultsPath, `${JSON.stringify({
          schema_version: 'review-pre-facts-provider-results.v1',
          workflow: 'doc-review',
          target_repo: repo,
          source: 'live-mcp',
          query_plan_id: 'qplan-fixture',
          readiness: 'graph-fresh',
          tier: 'graph-fresh',
          snapshot: currentRepoSnapshot(repo),
          reason_code: 'provider_results_normalized',
          facts: [
            {
              provider: 'gitnexus',
              query_id: 'q1',
              source_path: 'provider-escape.md',
              line_window: { start: 1, end: 1 },
              excerpt: 'unsafe symlink path',
              readiness: 'graph-fresh',
              tier: 'graph-fresh',
              reason_code: 'provider_fact',
              provenance: {
                source: 'live-mcp',
                query_plan_id: 'qplan-fixture',
                tool_name: 'gitnexus.query',
              },
            },
          ],
        }, null, 2)}\n`, 'utf8');

        const symlink = captureRun([
          '--mode', 'render',
          '--workflow', 'doc-review',
          '--repo', repo,
          '--provider-results', symlinkProviderResultsPath,
          '--output', symlinkBlockPath,
          '--run-id', symlinkRunId,
          '--summary-dir', symlinkDir,
        ], repo);

        expect(symlink.code).toBe(0);
        expect(symlink.json.reason_code).toBe('provider_results_schema_invalid');
        expect(symlink.json.provider_results_valid).toBe(false);
        expect(fs.readFileSync(symlinkBlockPath, 'utf8')).toContain('tier="unavailable"');
      } finally {
        fs.rmSync(outside, { recursive: true, force: true });
      }
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('render caps provider-results facts by workflow budget', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      const providerResultsPath = path.join(dir, 'provider-results.json');
      const blockPath = path.join(dir, 'codebase-facts.txt');
      const limit = LIMITS.maxFacts['doc-review'];
      const facts = Array.from({ length: limit + 6 }, (_item, index) => normalizedProviderFact(index));
      fs.writeFileSync(providerResultsPath, `${JSON.stringify(providerResultsEnvelope(repo, facts), null, 2)}\n`, 'utf8');

      const rendered = captureRun([
        '--mode', 'render',
        '--workflow', 'doc-review',
        '--repo', repo,
        '--provider-results', providerResultsPath,
        '--output', blockPath,
        '--run-id', runId,
        '--summary-dir', dir,
      ], repo);

      expect(rendered.code).toBe(0);
      expect(rendered.json.provider_results_valid).toBe(true);
      expect(rendered.json.reason_code).toBe('provider_fact_budget_truncated');
      const block = fs.readFileSync(blockPath, 'utf8');
      expect((block.match(/^- provider=/gm) || [])).toHaveLength(limit);
      expect(block).toContain('&lt;facts&gt; (provider_fact_budget_truncated)');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('rendered excerpts stay within the per-excerpt hard cap including the truncation marker', () => {
    const rendered = renderFactsBlock({
      workflow: 'doc-review',
      target_repo: REPO_ROOT,
      readiness: 'graph-fresh',
      tier: 'graph-fresh',
      reason_code: 'provider_results_normalized',
      facts: [
        {
          provider: 'direct-read',
          target: 'src/cli/index.js',
          source_path: 'src/cli/index.js',
          line_window: { start: 1, end: 1 },
          excerpt: 'x'.repeat(LIMITS.perExcerptChars + 100),
          readiness: 'graph-fresh',
          tier: 'bounded-reads',
          reason_code: 'target_aware_direct_read',
          provenance: {
            source: 'bounded-direct-read',
            target_repo: REPO_ROOT,
          },
        },
      ],
      omitted_targets: [],
    });

    const excerpt = rendered.block.match(/<excerpt>\n([\s\S]*?)\n  <\/excerpt>/)[1].replace(/^  /gm, '');
    expect(excerpt.length).toBeLessThanOrEqual(LIMITS.perExcerptChars);
    expect(excerpt).toContain(`[truncated: excerpt exceeded ${LIMITS.perExcerptChars} chars]`);
  });

  test('render downgrades provider results when the repo snapshot changed after normalization', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      const queryPlanPath = path.join(dir, 'query-plan.json');
      const rawPath = path.join(dir, 'provider-raw-result.json');
      const providerResultsPath = path.join(dir, 'provider-results.json');
      const blockPath = path.join(dir, 'codebase-facts.txt');
      const fixturePlan = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'query-plan.valid.json'), 'utf8'));
      const fixtureRaw = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'provider-raw-result.valid.json'), 'utf8'));
      fixturePlan.target_repo = repo;
      fixturePlan.snapshot = currentRepoSnapshot(repo);
      fixtureRaw.target_repo = repo;
      fs.writeFileSync(queryPlanPath, `${JSON.stringify(fixturePlan, null, 2)}\n`, 'utf8');
      fs.writeFileSync(rawPath, `${JSON.stringify(fixtureRaw, null, 2)}\n`, 'utf8');

      const normalized = captureRun([
        '--mode', 'normalize-provider-results',
        '--workflow', 'doc-review',
        '--repo', repo,
        '--query-plan', queryPlanPath,
        '--raw-result', rawPath,
        '--source', 'live-mcp',
        '--output', providerResultsPath,
        '--run-id', runId,
        '--summary-dir', dir,
      ], repo);
      expect(normalized.code).toBe(0);

      write(repo, 'src/cli/changed.js', 'module.exports = true;\n');
      const rendered = captureRun([
        '--mode', 'render',
        '--workflow', 'doc-review',
        '--repo', repo,
        '--provider-results', providerResultsPath,
        '--output', blockPath,
        '--run-id', runId,
        '--summary-dir', dir,
      ], repo);

      expect(rendered.code).toBe(0);
      expect(rendered.json.provider_results_valid).toBe(false);
      expect(rendered.json.reason_code).toBe('snapshot_mismatch');
      expect(fs.readFileSync(blockPath, 'utf8')).toContain('tier="unavailable"');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('one-shot performs target-aware bounded reads and records unsafe target omission reasons', () => {
    const repo = tempRepo();
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-review-pre-facts-outside-'));
    const { runId, dir } = tempRun();
    try {
      fs.writeFileSync(path.join(outside, 'secret.md'), '# Secret\n', 'utf8');
      try {
        fs.symlinkSync(path.join(outside, 'secret.md'), path.join(repo, 'escape.md'));
      } catch (_error) {
        // Symlinks may be unavailable on some hosts; the other omission reasons still cover containment.
      }
      fs.appendFileSync(path.join(repo, 'docs/plans/plan.md'), '\n- `escape.md`\n');
      const output = path.join(dir, 'codebase-facts.txt');
      const result = captureRun([
        '--mode', 'one-shot',
        '--workflow', 'doc-review',
        '--document', 'docs/plans/plan.md',
        '--repo', repo,
        '--run-id', runId,
        '--summary-dir', dir,
        '--output', output,
      ], repo);

      expect(result.code).toBe(0);
      const block = fs.readFileSync(output, 'utf8');
      expect(block).toContain('tier="bounded-reads"');
      expect(block).toContain('skills/spec-doc-review/SKILL.md');
      expect(block).toContain('target_outside_repo');
      expect(block).toContain('target_not_readable');
      if (fs.existsSync(path.join(repo, 'escape.md'))) {
        expect(block).toContain('target_symlink_escape');
      }
      const summary = JSON.parse(fs.readFileSync(path.join(dir, 'run-summary.json'), 'utf8'));
      expect(summary.selected_tier).toBe('bounded-reads');
      expect(summary.targets_omitted.map((target) => target.reason_code)).toEqual(
        expect.arrayContaining(['target_outside_repo', 'target_not_readable']),
      );
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  test('one-shot rejects document symlink escapes before target extraction', () => {
    const repo = tempRepo();
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-review-pre-facts-outside-'));
    const { runId, dir } = tempRun();
    try {
      write(outside, 'outside-plan.md', [
        '# Outside Plan',
        '',
        '## Sources & References',
        '- `src/cli/index.js`',
        '',
      ].join('\n'));
      try {
        fs.symlinkSync(path.join(outside, 'outside-plan.md'), path.join(repo, 'docs/plans/symlink-plan.md'));
      } catch (_error) {
        return;
      }
      const output = path.join(dir, 'codebase-facts.txt');
      const result = captureRun([
        '--mode', 'one-shot',
        '--workflow', 'doc-review',
        '--document', 'docs/plans/symlink-plan.md',
        '--repo', repo,
        '--run-id', runId,
        '--summary-dir', dir,
        '--output', output,
      ], repo);

      expect(result.code).toBe(0);
      expect(result.json.reason_code).toBe('no_extraction_targets');
      const block = fs.readFileSync(output, 'utf8');
      expect(block).toContain('tier="no-targets"');
      expect(block).not.toContain('src/cli/index.js');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  test('one-shot omits oversized direct-read targets without reading them into the facts block', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      write(repo, 'docs/large-target.md', `${'x'.repeat(LIMITS.maxDirectReadBytes + 1)}\n`);
      write(repo, 'docs/plans/large-plan.md', [
        '# Large Target',
        '',
        '## Sources & References',
        '- `docs/large-target.md`',
        '',
      ].join('\n'));
      const output = path.join(dir, 'codebase-facts.txt');
      const result = captureRun([
        '--mode', 'one-shot',
        '--workflow', 'doc-review',
        '--document', 'docs/plans/large-plan.md',
        '--repo', repo,
        '--run-id', runId,
        '--summary-dir', dir,
        '--output', output,
      ], repo);

      expect(result.code).toBe(0);
      expect(result.json.tier).toBe('unavailable');
      const block = fs.readFileSync(output, 'utf8');
      expect(block).toContain('docs/large-target.md (target_too_large)');
      expect(block).not.toContain('x'.repeat(2000));
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('one-shot caps rendered omitted targets under the workflow prompt budget', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      const missingTargets = Array.from({ length: 600 }, (_item, index) => (
        `- \`docs/missing-${index}-${'x'.repeat(80)}.md\``
      ));
      write(repo, 'docs/plans/many-missing.md', [
        '# Many Missing',
        '',
        '## Sources & References',
        ...missingTargets,
        '',
      ].join('\n'));
      const output = path.join(dir, 'codebase-facts.txt');
      const result = captureRun([
        '--mode', 'one-shot',
        '--workflow', 'doc-review',
        '--document', 'docs/plans/many-missing.md',
        '--repo', repo,
        '--run-id', runId,
        '--summary-dir', dir,
        '--output', output,
      ], repo);

      expect(result.code).toBe(0);
      const block = fs.readFileSync(output, 'utf8');
      expect(block.length).toBeLessThanOrEqual(LIMITS.renderedBlockChars['doc-review']);
      expect(block).toContain('omitted_targets_budget_truncated');
      expect(result.json.reason_code).toBe('omitted_targets_budget_truncated');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('normalization fails closed for raw result size limits and query mismatch', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      const queryPlanPath = path.join(dir, 'query-plan.json');
      const rawPath = path.join(dir, 'provider-raw-result.json');
      const output = path.join(dir, 'provider-results.json');
      fs.copyFileSync(path.join(FIXTURE_DIR, 'query-plan.valid.json'), queryPlanPath);
      const raw = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'provider-raw-result.invalid.json'), 'utf8'));
      fs.writeFileSync(rawPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');

      const mismatch = captureRun([
        '--mode', 'normalize-provider-results',
        '--workflow', 'doc-review',
        '--repo', repo,
        '--query-plan', queryPlanPath,
        '--raw-result', rawPath,
        '--source', 'live-mcp',
        '--output', output,
        '--run-id', runId,
        '--summary-dir', dir,
      ], repo);
      expect(mismatch.code).toBe(1);
      expect(mismatch.json.error.code).toBe('provider_raw_result_query_mismatch');

      const { runId: argRunId, dir: argDir } = tempRun();
      const argQuery = path.join(argDir, 'query-plan.json');
      const argRaw = path.join(argDir, 'provider-raw-result.json');
      const argOutput = path.join(argDir, 'provider-results.json');
      fs.copyFileSync(path.join(FIXTURE_DIR, 'query-plan.valid.json'), argQuery);
      const validRaw = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'provider-raw-result.valid.json'), 'utf8'));
      validRaw.raw_results[0].arguments = { repo: 'wrong-repo' };
      fs.writeFileSync(argRaw, `${JSON.stringify(validRaw, null, 2)}\n`, 'utf8');
      const argMismatch = captureRun([
        '--mode', 'normalize-provider-results',
        '--workflow', 'doc-review',
        '--repo', repo,
        '--query-plan', argQuery,
        '--raw-result', argRaw,
        '--source', 'live-mcp',
        '--output', argOutput,
        '--run-id', argRunId,
        '--summary-dir', argDir,
      ], repo);
      expect(argMismatch.code).toBe(1);
      expect(argMismatch.json.error.code).toBe('provider_raw_result_query_mismatch');

      const fallbackOutput = path.join(dir, 'codebase-facts.txt');
      const fallback = captureRun([
        '--mode', 'one-shot',
        '--workflow', 'doc-review',
        '--document', 'docs/plans/plan.md',
        '--repo', repo,
        '--run-id', runId,
        '--summary-dir', dir,
        '--output', fallbackOutput,
      ], repo);
      expect(fallback.code).toBe(0);
      const summary = JSON.parse(fs.readFileSync(path.join(dir, 'run-summary.json'), 'utf8'));
      expect(summary.modes_attempted).toEqual(['normalize-provider-results', 'one-shot']);
      expect(summary.normalization_result).toEqual(expect.objectContaining({
        status: 'failed',
        reason_code: 'provider_raw_result_query_mismatch',
      }));
      expect(summary.selected_tier).toBe('bounded-reads');

      const { runId: bigRunId, dir: bigDir } = tempRun();
      const bigQuery = path.join(bigDir, 'query-plan.json');
      const bigRaw = path.join(bigDir, 'provider-raw-result.json');
      const bigOutput = path.join(bigDir, 'provider-results.json');
      fs.copyFileSync(path.join(FIXTURE_DIR, 'query-plan.valid.json'), bigQuery);
      fs.writeFileSync(bigRaw, JSON.stringify({
        schema_version: 'review-pre-facts-provider-raw-result.v1',
        source: 'live-mcp',
        query_plan_id: 'qplan-fixture',
        raw_results: [
          {
            query_id: 'q1',
            tool_name: 'gitnexus.query',
            operation: 'query',
            status: 'ok',
            response: { text: 'x'.repeat(1024 * 1024 + 1) },
          },
        ],
      }), 'utf8');
      const oversized = captureRun([
        '--mode', 'normalize-provider-results',
        '--workflow', 'doc-review',
        '--repo', repo,
        '--query-plan', bigQuery,
        '--raw-result', bigRaw,
        '--source', 'live-mcp',
        '--output', bigOutput,
        '--run-id', bigRunId,
        '--summary-dir', bigDir,
      ], repo);
      expect(oversized.code).toBe(1);
      expect(oversized.json.error.code).toBe('provider_raw_result_too_large');

      const { runId: malformedRunId, dir: malformedDir } = tempRun();
      const malformedQuery = path.join(malformedDir, 'query-plan.json');
      const malformedRaw = path.join(malformedDir, 'provider-raw-result.json');
      const malformedOutput = path.join(malformedDir, 'provider-results.json');
      fs.copyFileSync(path.join(FIXTURE_DIR, 'query-plan.valid.json'), malformedQuery);
      fs.writeFileSync(malformedRaw, '{not json\n', 'utf8');
      const malformed = captureRun([
        '--mode', 'normalize-provider-results',
        '--workflow', 'doc-review',
        '--repo', repo,
        '--query-plan', malformedQuery,
        '--raw-result', malformedRaw,
        '--source', 'live-mcp',
        '--output', malformedOutput,
        '--run-id', malformedRunId,
        '--summary-dir', malformedDir,
      ], repo);
      expect(malformed.code).toBe(1);
      expect(malformed.json.error.code).toBe('provider_raw_result_invalid');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('normalization fails closed when required tool annotation proof is missing or unsafe', () => {
    const repo = tempRepo();
    try {
      for (const rawResultOverride of [
        { require_tool_annotations: true },
        {
          raw_results: [{
            tool_annotations: { read_only: true, destructive: true },
          }],
        },
      ]) {
        const { runId, dir } = tempRun();
        const queryPlanPath = path.join(dir, 'query-plan.json');
        const rawPath = path.join(dir, 'provider-raw-result.json');
        const output = path.join(dir, 'provider-results.json');
        fs.copyFileSync(path.join(FIXTURE_DIR, 'query-plan.valid.json'), queryPlanPath);
        const raw = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'provider-raw-result.valid.json'), 'utf8'));
        const rawResultOverrides = rawResultOverride.raw_results;
        Object.assign(raw, { ...rawResultOverride, raw_results: raw.raw_results });
        if (rawResultOverrides) {
          raw.raw_results = raw.raw_results.map((result, index) => ({
            ...result,
            ...(rawResultOverrides[index] || {}),
          }));
        }
        fs.writeFileSync(rawPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');

        const result = captureRun([
          '--mode', 'normalize-provider-results',
          '--workflow', 'doc-review',
          '--repo', repo,
          '--query-plan', queryPlanPath,
          '--raw-result', rawPath,
          '--source', 'live-mcp',
          '--output', output,
          '--run-id', runId,
          '--summary-dir', dir,
        ], repo);

        expect(result.code).toBe(1);
        expect(result.json.error.code).toBe('tool_annotation_unverified');
        const summary = JSON.parse(fs.readFileSync(path.join(dir, 'run-summary.json'), 'utf8'));
        expect(summary.normalization_result.reason_code).toBe('tool_annotation_unverified');
      }
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('query-plan validation rejects unsupported operations and unsafe impact arguments', () => {
    const queryPlan = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'query-plan.valid.json'), 'utf8'));
    queryPlan.queries[0].operation = 'rename';
    queryPlan.queries[0].tool_name = 'gitnexus.rename';
    expect(validateQueryPlan(queryPlan)).toEqual(expect.objectContaining({
      ok: false,
      reason_code: 'operation_not_allowed',
    }));

    const impactPlan = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'query-plan.valid.json'), 'utf8'));
    impactPlan.queries[0] = {
      query_id: 'q1',
      provider: 'gitnexus',
      tool_name: 'gitnexus.impact',
      operation: 'impact',
      arguments: {
        repo: 'spec-first',
        target: 'runCli',
        direction: 'upstream',
        maxDepth: 2,
        timeoutMs: 10000,
        summaryOnly: true,
      },
      target_refs: ['src/cli/index.js'],
      max_results: 1,
      reason_code: 'provider_impact_surface_available',
      fallback_reason_code: 'impact_target_unavailable',
    };
    expect(validateQueryPlan(impactPlan)).toEqual(expect.objectContaining({
      ok: false,
      reason_code: 'operation_arguments_invalid',
    }));
  });

  test('normalization enforces workflow fact-count budgets', () => {
    const repo = tempRepo();
    try {
      for (const [workflow, factCount, expectedLimit] of [
        ['doc-review', LIMITS.maxFacts['doc-review'] + 6, LIMITS.maxFacts['doc-review']],
        ['code-review', LIMITS.maxFacts['code-review'] + 5, LIMITS.maxFacts['code-review']],
      ]) {
        const { runId, dir } = tempRun();
        const queryPlanPath = path.join(dir, 'query-plan.json');
        const rawPath = path.join(dir, 'provider-raw-result.json');
        const output = path.join(dir, 'provider-results.json');
        const queryPlan = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'query-plan.valid.json'), 'utf8'));
        queryPlan.workflow = workflow;
        queryPlan.target_repo = repo;
        queryPlan.snapshot = currentRepoSnapshot(repo);
        fs.writeFileSync(queryPlanPath, `${JSON.stringify(queryPlan, null, 2)}\n`, 'utf8');
        fs.writeFileSync(rawPath, `${JSON.stringify({
          schema_version: 'review-pre-facts-provider-raw-result.v1',
          workflow,
          target_repo: repo,
          source: 'live-mcp',
          query_plan_id: queryPlan.query_plan_id,
          raw_results: [
            {
              query_id: 'q1',
              tool_name: 'gitnexus.query',
              operation: 'query',
              status: 'ok',
              response: {
                facts: Array.from({ length: factCount }, (_item, index) => providerFact(index)),
              },
            },
          ],
        }, null, 2)}\n`, 'utf8');

        const result = captureRun([
          '--mode', 'normalize-provider-results',
          '--workflow', workflow,
          '--repo', repo,
          '--query-plan', queryPlanPath,
          '--raw-result', rawPath,
          '--source', 'live-mcp',
          '--output', output,
          '--run-id', runId,
          '--summary-dir', dir,
        ], repo);

        expect(result.code).toBe(0);
        expect(result.json.reason_code).toBe('provider_fact_budget_truncated');
        const providerResults = JSON.parse(fs.readFileSync(output, 'utf8'));
        expect(providerResults.facts).toHaveLength(expectedLimit);
        expect(providerResults.omitted_facts).toEqual(expect.arrayContaining([
          expect.objectContaining({ reason_code: 'provider_fact_budget_truncated' }),
        ]));
      }
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('prepare requires query surface on the selected target provider', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      writeJson(repo, '.spec-first/providers/gitnexus/normalized/architecture-facts.json', {
        schema_version: 'provider-normalized-envelope.v1',
        provider: 'gitnexus',
        available_query_surfaces: [],
        capabilities: [],
      });
      writeJson(repo, '.spec-first/providers/code-review-graph/normalized/architecture-facts.json', {
        schema_version: 'provider-normalized-envelope.v1',
        provider: 'code-review-graph',
        available_query_surfaces: ['query'],
        capabilities: ['query_global_graph'],
      });
      writeJson(repo, '.spec-first/graph/provider-status.json', {
        schema_version: 'graph-provider-status.v1',
        workflow_mode: 'primary',
        ready_primary_providers: ['gitnexus', 'code-review-graph'],
        providers: [
          {
            provider: 'gitnexus',
            status: 'ready',
            graph_ready: true,
            query_ready: true,
            normalized_artifacts: {
              architecture_facts: '.spec-first/providers/gitnexus/normalized/architecture-facts.json',
            },
          },
          {
            provider: 'code-review-graph',
            status: 'ready',
            graph_ready: true,
            query_ready: true,
            normalized_artifacts: {
              architecture_facts: '.spec-first/providers/code-review-graph/normalized/architecture-facts.json',
            },
          },
        ],
      });
      const output = path.join(dir, 'query-plan.json');
      const result = captureRun([
        '--mode', 'prepare',
        '--workflow', 'doc-review',
        '--document', 'docs/plans/plan.md',
        '--repo', repo,
        '--run-id', runId,
        '--summary-dir', dir,
        '--output', output,
      ], repo);

      expect(result.code).toBe(0);
      const plan = JSON.parse(fs.readFileSync(output, 'utf8'));
      expect(plan.readiness).toBe('graph-fresh');
      expect(plan.target_provider).toBe('gitnexus');
      expect(plan.queries).toEqual([]);
      expect(plan.tier).toBe('bounded-reads');
      expect(plan.reason_code).toBe('provider_query_unavailable');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('prepare treats CRG-only provider projection as unavailable', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      writeJson(repo, '.spec-first/providers/code-review-graph/normalized/architecture-facts.json', {
        schema_version: 'provider-normalized-envelope.v1',
        provider: 'code-review-graph',
        available_query_surfaces: ['query'],
        capabilities: ['query_global_graph'],
      });
      writeJson(repo, '.spec-first/graph/provider-status.json', {
        schema_version: 'graph-provider-status.v1',
        workflow_mode: 'primary',
        ready_primary_providers: ['code-review-graph'],
        providers: [
          {
            provider: 'code-review-graph',
            status: 'ready',
            graph_ready: true,
            query_ready: true,
            normalized_artifacts: {
              architecture_facts: '.spec-first/providers/code-review-graph/normalized/architecture-facts.json',
            },
          },
        ],
      });
      const output = path.join(dir, 'query-plan.json');
      const result = captureRun([
        '--mode', 'prepare',
        '--workflow', 'doc-review',
        '--document', 'docs/plans/plan.md',
        '--repo', repo,
        '--run-id', runId,
        '--summary-dir', dir,
        '--output', output,
      ], repo);

      expect(result.code).toBe(0);
      const plan = JSON.parse(fs.readFileSync(output, 'utf8'));
      expect(plan.readiness).toBe('provider-unavailable');
      expect(plan.target_provider).toBe(null);
      expect(plan.queries).toEqual([]);
      expect(plan.tier).toBe('bounded-reads');
      expect(plan.reason_code).toBe('provider_query_unavailable');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('output boundary rejects repo source and canonical graph paths', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      const repoOutput = path.join(repo, 'codebase-facts.txt');
      const result = captureRun([
        '--mode', 'one-shot',
        '--workflow', 'doc-review',
        '--document', 'docs/plans/plan.md',
        '--repo', repo,
        '--run-id', runId,
        '--summary-dir', dir,
        '--output', repoOutput,
      ], repo);
      expect(result.code).toBe(2);
      expect(result.json.error.code).toBe('output_outside_temp_run');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('output boundary rejects dot run IDs and temp symlink escapes', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      const dotResult = captureRun([
        '--mode', 'one-shot',
        '--workflow', 'doc-review',
        '--document', 'docs/plans/plan.md',
        '--repo', repo,
        '--run-id', '.',
        '--summary-dir', path.join(os.tmpdir(), 'spec-first', 'review-pre-facts'),
        '--output', path.join(os.tmpdir(), 'spec-first', 'review-pre-facts', 'codebase-facts.txt'),
      ], repo);
      expect(dotResult.code).toBe(2);
      expect(dotResult.json.error.code).toBe('invalid_run_id');

      const linkPath = path.join(dir, 'repo-link');
      try {
        fs.symlinkSync(repo, linkPath, 'dir');
      } catch (_error) {
        return;
      }
      const escaped = captureRun([
        '--mode', 'one-shot',
        '--workflow', 'doc-review',
        '--document', 'docs/plans/plan.md',
        '--repo', repo,
        '--run-id', runId,
        '--summary-dir', dir,
        '--output', path.join(linkPath, 'codebase-facts.txt'),
      ], repo);
      expect(escaped.code).toBe(2);
      expect(escaped.json.error.code).toBe('output_temp_symlink_escape');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('output boundary rejects symlinked temp artifact base before writing artifacts', () => {
    const repo = tempRepo();
    const controlled = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-review-pre-facts-tmp-root-'));
    const fakeTmp = path.join(controlled, 'fake-tmp');
    const outside = path.join(controlled, 'outside');
    const previousTmpdir = process.env.TMPDIR;
    const runId = 'symlink-root-probe';
    try {
      fs.mkdirSync(outside, { recursive: true });
      process.env.TMPDIR = fakeTmp;
      const activeTmp = os.tmpdir();
      fs.mkdirSync(path.join(activeTmp, 'spec-first'), { recursive: true });
      try {
        fs.symlinkSync(outside, path.join(activeTmp, 'spec-first', 'review-pre-facts'), 'dir');
      } catch (_error) {
        return;
      }
      const result = captureRun([
        '--mode', 'one-shot',
        '--workflow', 'doc-review',
        '--document', 'docs/plans/plan.md',
        '--repo', repo,
        '--run-id', runId,
        '--summary-dir', path.join(activeTmp, 'spec-first', 'review-pre-facts', runId),
        '--output', path.join(activeTmp, 'spec-first', 'review-pre-facts', runId, 'codebase-facts.txt'),
      ], repo);
      expect(result.code).toBe(2);
      expect(result.json.error.code).toBe('output_temp_symlink_escape');
      expect(fs.existsSync(path.join(outside, runId, 'codebase-facts.txt'))).toBe(false);
      expect(fs.existsSync(path.join(outside, runId, 'run-summary.json'))).toBe(false);
    } finally {
      if (previousTmpdir === undefined) {
        delete process.env.TMPDIR;
      } else {
        process.env.TMPDIR = previousTmpdir;
      }
      fs.rmSync(repo, { recursive: true, force: true });
      fs.rmSync(controlled, { recursive: true, force: true });
    }
  });

  test('resolveTargets rejects absolute paths, dot-dot escapes, symlink escapes, and missing files', () => {
    const repo = tempRepo();
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-review-pre-facts-outside-'));
    try {
      fs.writeFileSync(path.join(outside, 'secret.md'), '# Secret\n', 'utf8');
      try {
        fs.symlinkSync(path.join(outside, 'secret.md'), path.join(repo, 'escape.md'));
      } catch (_error) {
        // Skip symlink-specific assertion if the host disallows symlink creation.
      }
      const targets = resolveTargets(repo, [
        '/absolute.md',
        '../outside.md',
        'missing.md',
        'escape.md',
        'src/cli/index.js',
      ]);
      expect(targets).toEqual(expect.arrayContaining([
        expect.objectContaining({ original: '/absolute.md', reason_code: 'target_outside_repo' }),
        expect.objectContaining({ original: '../outside.md', reason_code: 'target_outside_repo' }),
        expect.objectContaining({ original: 'missing.md', reason_code: 'target_not_readable' }),
        expect.objectContaining({ path: 'src/cli/index.js', status: 'readable' }),
      ]));
      if (fs.existsSync(path.join(repo, 'escape.md'))) {
        expect(targets).toEqual(expect.arrayContaining([
          expect.objectContaining({ original: 'escape.md', reason_code: 'target_symlink_escape' }),
        ]));
      }
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });
});

describe('definitions-only gating (R11/R15d)', () => {
  const NORMALIZED_DEFINITIONS_ONLY_FIXTURE = path.join(
    __dirname,
    '..',
    'fixtures',
    'review-pre-facts',
    'providers',
    'gitnexus',
    'normalized',
    'impact-capabilities.definitions-only.json',
  );
  const NORMALIZED_PROCESS_RESULTS_FIXTURE = path.join(
    __dirname,
    '..',
    'fixtures',
    'review-pre-facts',
    'providers',
    'gitnexus',
    'normalized',
    'impact-capabilities.process-results.json',
  );

  function overrideNormalizedImpactCapabilities(repo, fixturePath) {
    const value = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    writeJson(repo, '.spec-first/providers/gitnexus/normalized/impact-capabilities.json', value);
  }

  test('definitions-only normalized artifact gates impact / detect_changes out of query_plan', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      overrideNormalizedImpactCapabilities(repo, NORMALIZED_DEFINITIONS_ONLY_FIXTURE);

      const output = path.join(dir, 'query-plan.json');
      // Pass --change-scope staged so detect_changes would be emitted IF the
      // normalized artifact allowed it. The gating must reject it anyway.
      const result = captureRun([
        '--mode', 'prepare',
        '--workflow', 'doc-review',
        '--document', 'docs/plans/plan.md',
        '--repo', repo,
        '--run-id', runId,
        '--summary-dir', dir,
        '--output', output,
        '--change-scope', 'staged',
      ], repo);

      expect(result.code).toBe(0);
      const plan = JSON.parse(fs.readFileSync(output, 'utf8'));
      const operations = plan.queries.map((q) => q.operation);

      // Core gating invariant: query_plan must not request impact / detect_changes
      // when the normalized artifact only exposes query/context surfaces -- even
      // when the user explicitly asks for a change scope.
      expect(operations).toContain('query');
      expect(operations).not.toContain('impact');
      expect(operations).not.toContain('detect_changes');

      const forbiddenOperations = ['route_map', 'api_impact', 'shape_check', 'tool_map', 'cypher', 'group_sync', 'rename'];
      for (const forbidden of forbiddenOperations) {
        expect(operations).not.toContain(forbidden);
      }

      const toolNames = plan.queries.map((q) => q.tool_name);
      expect(toolNames).not.toContain('gitnexus.impact');
      expect(toolNames).not.toContain('gitnexus.detect_changes');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('process-results normalized artifact lets query_plan emit detect_changes when scope is provided (reverse assertion)', () => {
    const repo = tempRepo();
    const { runId, dir } = tempRun();
    try {
      overrideNormalizedImpactCapabilities(repo, NORMALIZED_PROCESS_RESULTS_FIXTURE);

      const output = path.join(dir, 'query-plan.json');
      const result = captureRun([
        '--mode', 'prepare',
        '--workflow', 'doc-review',
        '--document', 'docs/plans/plan.md',
        '--repo', repo,
        '--run-id', runId,
        '--summary-dir', dir,
        '--output', output,
        '--change-scope', 'staged',
      ], repo);

      expect(result.code).toBe(0);
      const plan = JSON.parse(fs.readFileSync(output, 'utf8'));
      const operations = plan.queries.map((q) => q.operation);

      // detect_changes is emitted when the normalized artifact exposes the
      // surface AND the user supplied a change scope; this proves the gating
      // mechanism is real (not a blanket "always strip impact / detect_changes"
      // hack).
      expect(operations).toContain('query');
      expect(operations).toContain('detect_changes');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
