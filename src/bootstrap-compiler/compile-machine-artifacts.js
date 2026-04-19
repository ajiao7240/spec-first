'use strict';

const { compileMinimalContexts } = require('./compile-minimal-context');
const { buildVerificationProfile } = require('./compile-verification-profile');
const { buildFreshnessReport } = require('./freshness');
const { buildLintReport } = require('./lint');
const { buildContradictionsReport } = require('./contradictions');
const { buildArtifactManifest } = require('./compile-routing');
const { deriveBootstrapInputs } = require('./derive-bootstrap-facts');

function compileMachineArtifacts({
  generatedAt = '2026-04-15T00:00:00.000Z',
  repoRoot,
  factInventory,
  riskSignals,
  testSurface,
  manifest,
  actualAssets = [],
  contextAssets = [],
  contradictionAssets = [],
} = {}) {
  const derived = deriveBootstrapInputs({
    repoRoot,
    factInventory,
    riskSignals,
    testSurface,
  });
  const effectiveFactInventory = derived.factInventory;
  const effectiveRiskSignals = derived.riskSignals;
  const effectiveTestSurface = derived.testSurface;
  const effectiveManifest = manifest || buildArtifactManifest({
    generatedAt,
    repoRoot,
    factInventory: effectiveFactInventory,
    riskSignals: effectiveRiskSignals,
    testSurface: effectiveTestSurface,
    actualAssets,
  });

  const verificationProfile = buildVerificationProfile({
    generatedAt,
    repoRoot,
    factInventory: effectiveFactInventory,
    testSurface: effectiveTestSurface,
  });

  return {
    fact_inventory: effectiveFactInventory,
    risk_signals: effectiveRiskSignals,
    test_surface: effectiveTestSurface,
    verification_profile: verificationProfile,
    minimal_context: compileMinimalContexts({
      generatedAt,
      factInventory: effectiveFactInventory,
      riskSignals: effectiveRiskSignals,
      testSurface: effectiveTestSurface,
      verificationProfile,
    }),
    freshness: buildFreshnessReport({
      generatedAt,
      graphLastBuilt: effectiveManifest && effectiveManifest.inputs && effectiveManifest.inputs.crg
        ? effectiveManifest.inputs.crg.graph_last_built
        : generatedAt,
      outputUpdatedAt: effectiveManifest ? effectiveManifest.updated_at : generatedAt,
      inputs: effectiveManifest ? effectiveManifest.inputs : {},
    }),
    lint_report: buildLintReport({
      generatedAt,
      manifest: effectiveManifest,
      actualAssets,
      contextAssets,
      requiredAssets: [
        'fact-inventory.json',
        'risk-signals.json',
        'test-surface.json',
        'database-routing.json',
        'context-routing.json',
        'artifact-manifest.json',
        'freshness.json',
        'minimal-context/plan.json',
        'minimal-context/work.json',
        'minimal-context/review.json',
        'verification-profile.json',
      ],
    }),
    contradictions: buildContradictionsReport({
      generatedAt,
      assets: contradictionAssets,
    }),
  };
}

module.exports = {
  compileMachineArtifacts,
};
