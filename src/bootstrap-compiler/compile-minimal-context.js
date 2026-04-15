'use strict';

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function collectRiskPaths(riskSignals, limit = 3) {
  const signals = Array.isArray(riskSignals && riskSignals.signals) ? riskSignals.signals : [];
  return unique(signals.slice(0, limit).map((signal) => signal.path));
}

function collectCandidateTests(testSurface, limit = 5) {
  const testFiles = Array.isArray(testSurface && testSurface.test_files) ? testSurface.test_files : [];
  return unique(testFiles.slice(0, limit).map((item) => item.path));
}

function collectEntrypoints(factInventory, limit = 4) {
  const entrypoints = Array.isArray(factInventory && factInventory.entrypoints)
    ? factInventory.entrypoints
    : [];
  return unique(entrypoints.slice(0, limit).map((item) => item.path));
}

function collectModules(factInventory, limit = 4) {
  const modules = Array.isArray(factInventory && factInventory.modules) ? factInventory.modules : [];
  return unique(modules.slice(0, limit).map((item) => item.path));
}

function collectIntegrations(factInventory, limit = 4) {
  const integrations = Array.isArray(factInventory && factInventory.integrations)
    ? factInventory.integrations
    : [];
  return unique(integrations.slice(0, limit).map((item) => item.symbol || item.path));
}

function buildReviewMinimalContext({
  generatedAt = '2026-04-15T00:00:00.000Z',
  riskSignals,
  testSurface,
} = {}) {
  return {
    schema_version: 'v1',
    generated_at: generatedAt,
    stage: 'review',
    profile: 'review-default',
    selected_assets: [
      'minimal-context/review.json',
      'code-facts/high-risk-modules.md',
      'code-facts/test-map.md',
      'context-packs/review-change.md',
    ],
    priority_assets: [
      'code-facts/high-risk-modules.md',
      'code-facts/test-map.md',
      'context-packs/review-change.md',
    ],
    risk_focus: collectRiskPaths(riskSignals),
    candidate_tests: collectCandidateTests(testSurface),
    fallback_reason: null,
    advice: '优先 review card、high-risk-modules、test-map 和 review-change，先建立风险面再决定抽样深度。',
  };
}

function buildPlanMinimalContext({
  generatedAt = '2026-04-15T00:00:00.000Z',
  factInventory,
} = {}) {
  return {
    schema_version: 'v1',
    generated_at: generatedAt,
    stage: 'plan',
    profile: 'plan-default',
    selected_assets: [
      'minimal-context/plan.json',
      'architecture/module-map.md',
      'code-facts/public-entrypoints.md',
      '00-summary.md',
    ],
    priority_assets: [
      'architecture/module-map.md',
      'code-facts/public-entrypoints.md',
      '00-summary.md',
    ],
    entrypoint_focus: collectEntrypoints(factInventory),
    module_focus: collectModules(factInventory),
    integration_focus: collectIntegrations(factInventory),
    fallback_reason: null,
    advice: '优先 plan card、module-map、public-entrypoints 与 summary，先建立模块边界、入口链路和外部依赖。',
  };
}

function buildWorkMinimalContext({
  generatedAt = '2026-04-15T00:00:00.000Z',
  factInventory,
  riskSignals,
  testSurface,
} = {}) {
  const testedTargets = Array.isArray(factInventory && factInventory.testing_surface)
    ? factInventory.testing_surface.slice(0, 5).map((item) => item.target_path)
    : [];

  return {
    schema_version: 'v1',
    generated_at: generatedAt,
    stage: 'work',
    profile: 'work-default',
    selected_assets: [
      'minimal-context/work.json',
      'code-facts/test-map.md',
      'context-packs/review-change.md',
      'code-facts/high-risk-modules.md',
    ],
    priority_assets: [
      'code-facts/test-map.md',
      'context-packs/review-change.md',
      'code-facts/high-risk-modules.md',
    ],
    impacted_modules: unique([
      ...collectModules(factInventory, 3),
      ...collectRiskPaths(riskSignals, 2),
    ]),
    candidate_tests: unique([
      ...collectCandidateTests(testSurface),
      ...testedTargets,
    ]).slice(0, 6),
    fallback_reason: null,
    advice: '优先 work card、test-map、review-change 与 high-risk-modules，先收敛改动面、验证面和回归热点。',
  };
}

function compileMinimalContexts(input = {}) {
  return {
    review: buildReviewMinimalContext(input),
    plan: buildPlanMinimalContext(input),
    work: buildWorkMinimalContext(input),
  };
}

module.exports = {
  buildPlanMinimalContext,
  buildReviewMinimalContext,
  buildWorkMinimalContext,
  compileMinimalContexts,
};
