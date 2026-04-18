'use strict';

function deriveContextMeta(factInventory, testSurface) {
  const moduleCount = Array.isArray(factInventory && factInventory.modules)
    ? factInventory.modules.length : 0;
  const testCount = Array.isArray(testSurface && testSurface.test_files)
    ? testSurface.test_files.length : 0;
  return {
    provenance: moduleCount > 0 ? 'fact-inventory' : 'empty-fallback',
    confidence: moduleCount > 0 && testCount > 0 ? 'high'   :
                moduleCount > 0                  ? 'medium' : 'low',
  };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function collectPlatformFocus(verificationProfile, limit = 4) {
  const platforms = Array.isArray(verificationProfile && verificationProfile.platforms)
    ? verificationProfile.platforms
    : [];
  return unique(platforms.slice(0, limit));
}

function collectVerificationIds(verificationProfile, fieldName, limit = 5) {
  const gates = Array.isArray(verificationProfile && verificationProfile[fieldName])
    ? verificationProfile[fieldName]
    : [];
  return unique(gates.slice(0, limit).map((item) => item && item.id));
}

function collectVerificationGapChecks(verificationProfile, limit = 5) {
  return collectVerificationIds(verificationProfile, 'required_gates', limit)
    .map((id) => `confirm ${id}`);
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
  factInventory,
  riskSignals,
  testSurface,
  verificationProfile,
} = {}) {
  return {
    ...deriveContextMeta(factInventory, testSurface),
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
    platform_focus: collectPlatformFocus(verificationProfile),
    risk_focus: collectRiskPaths(riskSignals),
    candidate_tests: collectCandidateTests(testSurface),
    verification_gaps_to_check: collectVerificationGapChecks(verificationProfile),
    fallback_reason: null,
    advice: '优先 review card、high-risk-modules、test-map、review-change 与 verification summary，先建立风险面，再检查必需验证是否缺失。',
  };
}

function buildPlanMinimalContext({
  generatedAt = '2026-04-15T00:00:00.000Z',
  factInventory,
  testSurface,
  verificationProfile,
} = {}) {
  return {
    ...deriveContextMeta(factInventory, testSurface),
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
    platform_focus: collectPlatformFocus(verificationProfile),
    entrypoint_focus: collectEntrypoints(factInventory),
    module_focus: collectModules(factInventory),
    integration_focus: collectIntegrations(factInventory),
    required_verifications: collectVerificationIds(verificationProfile, 'required_gates'),
    fallback_reason: null,
    advice: '优先 plan card、module-map、public-entrypoints、summary 与 verification summary，先建立模块边界、入口链路和默认验证矩阵。',
  };
}

function buildWorkMinimalContext({
  generatedAt = '2026-04-15T00:00:00.000Z',
  factInventory,
  riskSignals,
  testSurface,
  verificationProfile,
} = {}) {
  const testedTargets = Array.isArray(factInventory && factInventory.testing_surface)
    ? factInventory.testing_surface.slice(0, 5).map((item) => item.target_path)
    : [];

  return {
    ...deriveContextMeta(factInventory, testSurface),
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
    platform_focus: collectPlatformFocus(verificationProfile),
    impacted_modules: unique([
      ...collectModules(factInventory, 3),
      ...collectRiskPaths(riskSignals, 2),
    ]),
    candidate_tests: unique([
      ...collectCandidateTests(testSurface),
      ...testedTargets,
    ]).slice(0, 6),
    required_verifications: collectVerificationIds(verificationProfile, 'required_gates'),
    optional_verifications: collectVerificationIds(verificationProfile, 'optional_gates'),
    fallback_reason: null,
    advice: '优先 work card、test-map、review-change、high-risk-modules 与 verification summary，先收敛改动面、必跑验证和补充证据。',
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
