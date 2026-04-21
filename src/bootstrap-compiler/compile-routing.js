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

function buildDatabaseRouting({
  generatedAt = '2026-04-15T00:00:00.000Z',
  factInventory,
  env = process.env,
  tooling = {},
} = {}) {
  const databaseCandidates = Array.isArray(factInventory && factInventory.database)
    ? factInventory.database
    : [];
  const hasMysqlCli = Object.prototype.hasOwnProperty.call(tooling, 'hasMysqlCli')
    ? Boolean(tooling.hasMysqlCli)
    : commandExists('mysql', env);
  const hasMysqlMcp = Boolean(tooling.hasMysqlMcp);

  const routing = {
    schema_version: 'v1',
    generated_at: generatedAt,
    candidate_connections: [],
    secret_resolution: [],
    probe_attempts: [],
    route_decisions: [],
    selected_connections: [],
    generation_blockers: [],
  };

  for (const candidate of databaseCandidates) {
    const connectionName = candidate.connection_name || 'default';
    const credentialKeys = Array.isArray(candidate.credential_keys) ? candidate.credential_keys : [];
    const resolvedCredentialKeys = credentialKeys.filter((key) => Boolean(env[key]));
    const missingCredentialKeys = credentialKeys.filter((key) => !env[key]);
    const secretStatus = credentialKeys.length === 0
      ? 'not-required'
      : missingCredentialKeys.length === 0
        ? 'resolved'
        : resolvedCredentialKeys.length > 0
          ? 'partial'
          : 'missing';

    routing.candidate_connections.push({
      connection_name: connectionName,
      db_type: candidate.db_type || 'unknown',
      config_source: candidate.config_source || 'unknown',
      database_name_guess: Object.prototype.hasOwnProperty.call(candidate, 'database_name_guess')
        ? candidate.database_name_guess
        : null,
      credential_keys: credentialKeys,
      static_access_hints: Array.isArray(candidate.static_access_hints) ? candidate.static_access_hints : [],
      confidence: candidate.confidence || 'low',
      inference_reason: candidate.inference_reason || 'database-config-pattern',
      evidence: Array.isArray(candidate.evidence) ? candidate.evidence : [],
    });

    routing.secret_resolution.push({
      connection_name: connectionName,
      status: secretStatus,
      required_credential_keys: credentialKeys,
      resolved_credential_keys: resolvedCredentialKeys,
      missing_credential_keys: missingCredentialKeys,
      provenance: 'process.env',
    });

    const resolvedHasHost = hasResolvedKey(
      resolvedCredentialKeys,
      /(?:^|_)(DB_HOST|MYSQL_HOST)$/
    );
    const resolvedHasUser = hasResolvedKey(
      resolvedCredentialKeys,
      /(?:^|_)(DB_USER|DB_USERNAME|MYSQL_USER|MYSQL_USERNAME)$/
    );
    const cliReady = candidate.db_type === 'mysql' && hasMysqlCli && resolvedHasHost && resolvedHasUser;
    const mcpReady = candidate.db_type === 'mysql' && hasMysqlMcp;

    routing.probe_attempts.push({
      connection_name: connectionName,
      route: 'mcp',
      status: candidate.db_type !== 'mysql'
        ? 'skipped'
        : mcpReady
          ? 'ready'
          : 'unavailable',
      reason: candidate.db_type !== 'mysql'
        ? 'unsupported-db-type'
        : mcpReady
          ? 'ready'
          : 'bootstrap-runtime-mcp-probe-unavailable',
    });

    const cliReason = candidate.db_type !== 'mysql'
      ? 'unsupported-db-type'
      : !resolvedHasHost || !resolvedHasUser
        ? 'discrete-credential-keys-missing'
        : hasMysqlCli
          ? 'ready'
          : 'mysql-cli-not-found';

    routing.probe_attempts.push({
      connection_name: connectionName,
      route: 'cli',
      status: candidate.db_type !== 'mysql'
        ? 'skipped'
        : cliReady
          ? 'ready'
          : !resolvedHasHost || !resolvedHasUser
            ? 'blocked'
            : 'unavailable',
      reason: cliReason,
    });

    let selectedRoute = null;
    let decision = 'blocked';
    let fallbackReason = null;

    if (candidate.db_type !== 'mysql') {
      fallbackReason = 'unsupported-db-type';
    } else if (mcpReady) {
      selectedRoute = 'mcp';
      decision = 'selected';
    } else if (cliReady) {
      selectedRoute = 'cli';
      decision = 'selected';
      fallbackReason = 'mcp-probe-unavailable-in-bootstrap-runtime';
    } else if (secretStatus !== 'resolved') {
      fallbackReason = 'credential-keys-missing';
    } else if (!resolvedHasHost || !resolvedHasUser) {
      fallbackReason = 'cli-discrete-credentials-unavailable';
    } else if (!hasMysqlCli) {
      fallbackReason = 'mysql-cli-not-found';
    } else {
      fallbackReason = 'no-supported-route';
    }

    routing.route_decisions.push({
      connection_name: connectionName,
      selected_route: selectedRoute,
      decision,
      fallback_reason: fallbackReason,
      provenance: [
        `candidate:${connectionName}`,
        `secret_resolution:${connectionName}`,
        ...(selectedRoute ? [`probe_attempt:${connectionName}:${selectedRoute}`] : []),
      ],
    });

    if (selectedRoute) {
      routing.selected_connections.push({
        connection_name: connectionName,
        route: selectedRoute,
        db_type: candidate.db_type || 'unknown',
        config_source: candidate.config_source || 'unknown',
      });
    } else {
      routing.generation_blockers.push({
        connection_name: connectionName,
        stage: 'route-selection',
        reason: fallbackReason || 'no-supported-route',
      });
    }
  }

  return routing;
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
        'runtime:secret-resolution',
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
