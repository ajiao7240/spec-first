'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { resolveGitCommit, sha256File } = require('./derive-bootstrap-facts');

function commandExists(commandName, env = process.env) {
  const pathValue = env && env.PATH ? env.PATH : '';
  if (!pathValue) return false;
  const suffixes = process.platform === 'win32' ? ['', '.exe', '.cmd', '.bat'] : [''];
  return pathValue.split(path.delimiter).some((directory) => suffixes.some((suffix) => {
    if (!directory) return false;
    try {
      return fs.existsSync(path.join(directory, `${commandName}${suffix}`));
    } catch (_error) {
      return false;
    }
  }));
}

function hasResolvedKey(resolvedKeys, pattern) {
  return resolvedKeys.some((key) => pattern.test(key));
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function getReadonlyRouteAvailability(route, { env = process.env, tooling = {} } = {}) {
  if (route === 'mysql-cli') {
    const available = Object.prototype.hasOwnProperty.call(tooling, 'hasMysqlCli')
      ? Boolean(tooling.hasMysqlCli)
      : commandExists('mysql', env);
    return {
      route,
      available,
      reason: available ? 'tool-present' : 'tool-missing',
    };
  }

  return null;
}

function buildDatabaseRouting({
  generatedAt = '2026-04-15T00:00:00.000Z',
  factInventory,
  env = process.env,
  tooling = {},
} = {}) {
  const databaseCandidates = Array.isArray(factInventory && factInventory.database)
    ? factInventory.database
    : [];
  const databaseSchemaSources = Array.isArray(factInventory && factInventory.database_schema)
    ? factInventory.database_schema
    : [];
  const envKeyHints = unique(databaseCandidates.flatMap((candidate) => (
    Array.isArray(candidate && candidate.credential_keys) ? candidate.credential_keys : []
  ))).sort();
  const resolvedEnvKeys = envKeyHints.filter((key) => Boolean(env[key]));
  const missingEnvKeys = envKeyHints.filter((key) => !env[key]);
  const hintedReadonlyRoutes = unique(databaseCandidates.flatMap((candidate) => (
    Array.isArray(candidate && candidate.static_access_hints) ? candidate.static_access_hints : []
  ))).sort();
  const availableReadonlyRoutes = hintedReadonlyRoutes
    .map((route) => getReadonlyRouteAvailability(route, { env, tooling }))
    .filter(Boolean);
  const dbTypeHints = unique(
    databaseCandidates
      .map((candidate) => candidate && candidate.db_type)
      .filter((dbType) => dbType && dbType !== 'unknown')
  ).sort();
  const configSources = unique(databaseCandidates.map((candidate) => candidate && candidate.config_source).filter(Boolean)).sort();
  const schemaSources = unique(databaseSchemaSources.map((source) => source && source.path).filter(Boolean)).sort();
  const hasHints = databaseCandidates.length > 0 || databaseSchemaSources.length > 0;
  const hasReadonlyRouteHints = availableReadonlyRoutes.length > 0;
  const hasReadonlyTool = availableReadonlyRoutes.some((route) => route.available);
  const hasCompleteEnvHints = envKeyHints.length > 0 && missingEnvKeys.length === 0;
  const recommendedAction = !hasHints
    ? 'not-needed'
    : hasReadonlyTool && hasCompleteEnvHints
      ? 'llm-readonly-introspect'
      : 'llm-inspect-repo';
  const blockers = [];

  if (hasHints && !hasReadonlyRouteHints) {
    blockers.push({
      kind: 'runtime-capability',
      reason: 'no-supported-readonly-route-hints',
    });
  }
  if (hasHints && hasReadonlyRouteHints && !hasReadonlyTool) {
    blockers.push({
      kind: 'runtime-capability',
      reason: 'no-supported-readonly-database-tool-available',
    });
  }
  if (hasHints && envKeyHints.length === 0) {
    blockers.push({
      kind: 'env-availability',
      reason: 'no-env-key-hints',
    });
  }
  if (hasHints && envKeyHints.length > 0 && missingEnvKeys.length > 0) {
    blockers.push({
      kind: 'env-availability',
      reason: resolvedEnvKeys.length === 0 ? 'all-env-key-hints-missing' : 'env-key-hints-incomplete',
    });
  }

  return {
    schema_version: 'v1',
    generated_at: generatedAt,
    discovery_strategy: 'llm-led',
    hint_summary: {
      database_hint_count: databaseCandidates.length,
      schema_hint_count: databaseSchemaSources.length,
      db_type_hints: dbTypeHints,
      config_sources: configSources,
      schema_sources: schemaSources,
      env_key_hints: envKeyHints,
    },
    runtime_capabilities: {
      available_readonly_routes: availableReadonlyRoutes,
      resolved_env_keys: resolvedEnvKeys,
      missing_env_keys: missingEnvKeys,
    },
    recommended_action: recommendedAction,
    blockers,
  };
}

function buildContextRouting({ generatedAt = '2026-04-15T00:00:00.000Z' } = {}) {
  return {
    schema_version: 'v1',
    generated_at: generatedAt,
    always: [
      '00-summary.md',
      'README.md',
      'freshness.json',
    ],
    stages: {
      plan: [
        'architecture/module-map.md',
      ],
      work: [
        'code-facts/test-map.md',
        'context-packs/review-change.md',
        'lint-report.json',
      ],
      review: [
        'minimal-context/review.json',
        'code-facts/high-risk-modules.md',
        'pitfalls/index.md',
        'context-packs/review-change.md',
        'code-facts/test-map.md',
        'lint-report.json',
        'contradictions.json',
      ],
      unknown: [
        'README.md',
      ],
    },
    selection_rules: [
      {
        condition: 'output_exists.code_facts_public_entrypoints',
        inject: ['code-facts/public-entrypoints.md'],
      },
      {
        condition: 'output_exists.code_facts_high_risk_modules',
        inject: ['code-facts/high-risk-modules.md'],
      },
      {
        condition: 'output_exists.context_packs_review_change',
        inject: ['context-packs/review-change.md'],
      },
    ],
    advice: {
      review: '优先 machine context 与 risk signals，再回读 narrative summary。',
      work: '优先 test-map 与 review-change，定位改动风险和验证面。',
      plan: '优先 module-map 与 public-entrypoints，先建立模块边界与入口心智。',
    },
  };
}

function buildInjectionIndex() {
  return {
    always: [
      '00-summary.md',
      'README.md',
    ],
    stages: {
      plan: [
        'architecture/module-map.md',
        '00-summary.md',
      ],
      work: [
        'code-facts/test-map.md',
        'context-packs/review-change.md',
        'code-facts/high-risk-modules.md',
      ],
      review: [
        'code-facts/high-risk-modules.md',
        'pitfalls/index.md',
        'code-facts/test-map.md',
        'context-packs/review-change.md',
      ],
      unknown: [
        'README.md',
      ],
    },
    selection_rules: [
      {
        condition: 'output_exists.code_facts_public_entrypoints',
        inject: ['code-facts/public-entrypoints.md'],
      },
      {
        condition: 'output_exists.code_facts_high_risk_modules',
        inject: ['code-facts/high-risk-modules.md'],
      },
      {
        condition: 'output_exists.context_packs_review_change',
        inject: ['context-packs/review-change.md'],
      },
    ],
    advice: {
      review: '优先 code-facts 与 risk signals，再回读 narrative summary。',
      work: '优先 test-map 与 review-change，定位改动风险和验证面。',
      plan: '优先 module-map 与 public-entrypoints，先建立模块边界与入口心智。',
    },
  };
}

function buildOutputMap() {
  return {
    'fact-inventory.json': {
      plane: 'control',
      status: 'required',
      depends_on: ['filesystem-scan'],
    },
    'risk-signals.json': {
      plane: 'control',
      status: 'required',
      depends_on: ['filesystem-scan'],
    },
    'test-surface.json': {
      plane: 'control',
      status: 'required',
      depends_on: ['filesystem-scan'],
    },
    'database-routing.json': {
      plane: 'control',
      status: 'required',
      depends_on: [
        'schema:fact_inventory@v1',
        'runtime:capability-check',
      ],
    },
    'context-routing.json': {
      plane: 'control',
      status: 'required',
      depends_on: [
        'schema:fact_inventory@v1',
        'schema:risk_signals@v1',
        'schema:test_surface@v1',
      ],
    },
    'minimal-context/review.json': {
      plane: 'control',
      status: 'required',
      depends_on: [
        'schema:risk_signals@v1',
        'schema:test_surface@v1',
        'schema:fact_inventory@v1',
      ],
    },
    'minimal-context/plan.json': {
      plane: 'control',
      status: 'required',
      depends_on: ['schema:fact_inventory@v1'],
    },
    'minimal-context/work.json': {
      plane: 'control',
      status: 'required',
      depends_on: [
        'schema:risk_signals@v1',
        'schema:test_surface@v1',
        'schema:fact_inventory@v1',
      ],
    },
    'verification-profile.json': {
      plane: 'control',
      status: 'required',
      depends_on: [
        'schema:fact_inventory@v1',
        'schema:test_surface@v1',
      ],
    },
    'freshness.json': {
      plane: 'control',
      status: 'required',
      depends_on: [
        'schema:fact_inventory@v1',
        'schema:risk_signals@v1',
        'schema:test_surface@v1',
      ],
    },
    'lint-report.json': {
      plane: 'control',
      status: 'required',
      depends_on: [
        'schema:fact_inventory@v1',
        'schema:risk_signals@v1',
        'schema:test_surface@v1',
      ],
    },
    'contradictions.json': {
      plane: 'control',
      status: 'required',
      depends_on: [
        'schema:fact_inventory@v1',
        'schema:risk_signals@v1',
        'schema:test_surface@v1',
      ],
    },
    'ownership.json': {
      plane: 'control',
      status: 'optional',
      depends_on: [
        'schema:fact_inventory@v1',
        'schema:risk_signals@v1',
      ],
    },
    'review-queue.json': {
      plane: 'control',
      status: 'optional',
      depends_on: [
        'ownership.json',
        'freshness.json',
        'contradictions.json',
      ],
    },
    '00-summary.md': {
      depends_on: ['schema:fact_inventory@v1'],
    },
    'README.md': {
      depends_on: [
        'schema:fact_inventory@v1',
        'schema:risk_signals@v1',
        'schema:test_surface@v1',
      ],
    },
    'architecture/module-map.md': {
      depends_on: [
        'schema:fact_inventory@v1',
      ],
    },
    'pitfalls/index.md': {
      depends_on: [
        'schema:risk_signals@v1',
      ],
    },
    'code-facts/public-entrypoints.md': {
      depends_on: [
        'schema:fact_inventory@v1',
      ],
    },
    'code-facts/test-map.md': {
      depends_on: [
        'schema:fact_inventory@v1',
        'schema:test_surface@v1',
      ],
    },
    'code-facts/high-risk-modules.md': {
      depends_on: ['schema:risk_signals@v1'],
    },
    'context-packs/review-change.md': {
      depends_on: [
        'schema:risk_signals@v1',
        'schema:test_surface@v1',
        'schema:fact_inventory@v1',
      ],
    },
    'injection-index.yaml': {
      depends_on: [
        'schema:fact_inventory@v1',
        'schema:risk_signals@v1',
        'schema:test_surface@v1',
      ],
    },
  };
}

function computeDataQuality({ modules, entrypoints, analyzerMode }) {
  const hasData = modules.length > 0 || entrypoints.length > 0;
  // fact-backed 仅允许 full（CRG 图索引）模式；enhanced/basic 数据来自静态分析，最高 partial
  if (analyzerMode === 'full') {
    return modules.length > 0 && entrypoints.length > 0 ? 'fact-backed' :
           hasData ? 'partial' : 'empty';
  }
  if (analyzerMode === 'enhanced') {
    return hasData ? 'partial' : 'skeletal';
  }
  if (analyzerMode === 'basic') {
    return hasData ? 'skeletal' : 'empty';
  }
  // analyzerMode 未知时保守计算，不产生 fact-backed
  return hasData ? 'partial' : 'empty';
}

function buildArtifactManifest({
  generatedAt = '2026-04-15T00:00:00.000Z',
  repoRoot,
  factInventory,
  riskSignals,
  testSurface,
  actualAssets = [],
} = {}) {
  const pkgPath = repoRoot ? path.join(repoRoot, 'package.json') : null;
  const packageSha = pkgPath ? sha256File(pkgPath) : null;
  const modules = Array.isArray(factInventory && factInventory.modules) ? factInventory.modules : [];
  const entrypoints = Array.isArray(factInventory && factInventory.entrypoints) ? factInventory.entrypoints : [];
  const signals = Array.isArray(riskSignals && riskSignals.signals) ? riskSignals.signals : [];
  const testFiles = Array.isArray(testSurface && testSurface.test_files) ? testSurface.test_files : [];
  const analyzerMode = typeof (factInventory && factInventory.analyzer_mode) === 'string'
    ? factInventory.analyzer_mode
    : null;

  const dataQuality = computeDataQuality({ modules, entrypoints, analyzerMode });

  const outputs = buildOutputMap();
  const requiredAssets = Object.entries(outputs)
    .filter(([, metadata]) => metadata && metadata.status === 'required')
    .map(([assetPath]) => assetPath);
  const actualAssetSet = new Set((actualAssets || []).map((assetPath) => String(assetPath).replace(/\\/g, '/')));
  const hasObservedAssets = actualAssetSet.size > 0;
  const status = (!hasObservedAssets || requiredAssets.every((assetPath) => actualAssetSet.has(assetPath)))
    ? 'complete'
    : 'incomplete';

  return {
    schema_version: 'v1',
    generated_at: generatedAt,
    updated_at: generatedAt,
    status,
    data_quality: dataQuality,
    inputs: {
      crg: {
        graph_last_built: generatedAt,
        node_count: modules.length + entrypoints.length + signals.length + testFiles.length,
        edge_count: 0,
        last_build_commit: repoRoot ? resolveGitCommit(repoRoot) : null,
      },
      files: packageSha ? { 'package.json': packageSha } : {},
      analyzer_versions: {
        fact_inventory: 'v1',
        risk_signals: 'v1',
        test_surface: 'v1',
        routing: 'v1',
      },
      schema_versions: {
        fact_inventory: 'v1',
        database_routing: 'v1',
        risk_signals: 'v1',
        test_surface: 'v1',
      },
    },
    outputs,
  };
}

function compileRouting({
  generatedAt = '2026-04-15T00:00:00.000Z',
  repoRoot,
  factInventory,
  riskSignals,
  testSurface,
  env,
  tooling,
  actualAssets,
} = {}) {
  return {
    database_routing: buildDatabaseRouting({
      generatedAt,
      factInventory,
      env,
      tooling,
    }),
    context_routing: buildContextRouting({ generatedAt }),
    artifact_manifest: buildArtifactManifest({
      generatedAt,
      repoRoot,
      factInventory,
      riskSignals,
      testSurface,
      actualAssets,
    }),
    injection_index: buildInjectionIndex(),
  };
}

module.exports = {
  buildArtifactManifest,
  buildContextRouting,
  buildDatabaseRouting,
  buildInjectionIndex,
  compileRouting,
};
