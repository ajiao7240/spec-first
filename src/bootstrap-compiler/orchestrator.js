'use strict';

const { compileMachineArtifacts } = require('./compile-machine-artifacts');
const { compileHumanAssets } = require('./compile-human-assets');
const { compileRouting } = require('./compile-routing');

function buildStageResult(name, status) {
  return { name, status };
}

function defaultCompilers() {
  return {
    machine: compileMachineArtifacts,
    human: compileHumanAssets,
    routing: compileRouting,
  };
}

function compileBootstrapArtifacts({
  generatedAt = '2026-04-15T00:00:00.000Z',
  repoRoot,
  factInventory,
  riskSignals,
  testSurface,
  actualAssets = [],
  contextAssets = [],
  contradictionAssets = [],
  compilers = {},
} = {}) {
  const stageResults = [];
  const pipeline = { ...defaultCompilers(), ...compilers };

  try {
    const machineArtifacts = pipeline.machine({
      generatedAt,
      repoRoot,
      factInventory,
      riskSignals,
      testSurface,
      actualAssets,
      contextAssets,
      contradictionAssets,
    });
    stageResults.push(buildStageResult('machine-artifacts', 'success'));

    const humanAssets = pipeline.human({
      generatedAt,
      factInventory: machineArtifacts.fact_inventory,
      riskSignals: machineArtifacts.risk_signals,
      testSurface: machineArtifacts.test_surface,
      verificationProfile: machineArtifacts.verification_profile,
      contextAssets,
    });
    stageResults.push(buildStageResult('human-assets', 'success'));

    const routing = pipeline.routing({
      generatedAt,
      repoRoot,
      factInventory: machineArtifacts.fact_inventory,
      riskSignals: machineArtifacts.risk_signals,
      testSurface: machineArtifacts.test_surface,
      actualAssets,
      generatedAssets: humanAssets.generated_assets,
    });
    stageResults.push(buildStageResult('routing', 'success'));

    return {
      status: 'complete',
      generated_at: generatedAt,
      stages: stageResults,
      machine_artifacts: machineArtifacts,
      human_assets: humanAssets,
      routing,
    };
  } catch (error) {
    const failedStage = stageResults.length === 2
      ? 'routing'
      : stageResults.length === 1
        ? 'human-assets'
        : 'machine-artifacts';
    stageResults.push(buildStageResult(failedStage, 'failed'));

    return {
      status: 'failed',
      generated_at: generatedAt,
      stages: stageResults,
      error: {
        stage: failedStage,
        message: error.message,
      },
    };
  }
}

module.exports = {
  compileBootstrapArtifacts,
};
