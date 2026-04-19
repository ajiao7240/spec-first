'use strict';

const path = require('node:path');

const { safeReadJson } = require('./loader');
const { resolveWorkflowArtifactDir } = require('../crg/artifact-paths');

function loadAiDevQualityGateResult({
  repoRoot,
  artifactAnchorRoot = repoRoot,
} = {}) {
  const artifactDir = resolveWorkflowArtifactDir(repoRoot, 'quality-gates', 'ai-dev-quality-gate', {
    artifactAnchorRoot,
  });
  const result = safeReadJson(path.join(artifactDir, 'ai-dev-quality-gate-result.json'));

  if (!result || result.gate_id !== 'ai-dev-quality-gate' || typeof result.passed !== 'boolean') {
    return null;
  }

  return result;
}

module.exports = {
  loadAiDevQualityGateResult,
};
