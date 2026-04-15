'use strict';

const { compileMinimalContexts } = require('./compile-minimal-context');
const { buildFreshnessReport } = require('./freshness');
const { buildLintReport } = require('./lint');
const { buildContradictionsReport } = require('./contradictions');
const { buildArtifactManifestSample } = require('./sample-generator');

function compileMachineArtifacts({
  generatedAt = '2026-04-15T00:00:00.000Z',
  factInventory,
  riskSignals,
  testSurface,
  manifest = buildArtifactManifestSample({
    generatedAt,
    updatedAt: generatedAt,
    graphLastBuilt: generatedAt,
  }),
  actualAssets = [],
  contextAssets = [],
  contradictionAssets = [],
} = {}) {
  return {
    minimal_context: compileMinimalContexts({
      generatedAt,
      factInventory,
      riskSignals,
      testSurface,
    }),
    freshness: buildFreshnessReport({
      generatedAt,
      graphLastBuilt: manifest && manifest.inputs && manifest.inputs.crg
        ? manifest.inputs.crg.graph_last_built
        : generatedAt,
      outputUpdatedAt: manifest ? manifest.updated_at : generatedAt,
      inputs: manifest ? manifest.inputs : {},
    }),
    lint_report: buildLintReport({
      generatedAt,
      manifest,
      actualAssets,
      contextAssets,
      requiredAssets: [
        'context-routing.json',
        'artifact-manifest.json',
        'minimal-context/review.json',
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
