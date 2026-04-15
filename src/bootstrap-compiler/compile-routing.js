'use strict';

const {
  buildArtifactManifestSample,
  buildContextRoutingSample,
  buildInjectionIndexSample,
} = require('./sample-generator');

function compileRouting({ generatedAt = '2026-04-15T00:00:00.000Z' } = {}) {
  return {
    context_routing: buildContextRoutingSample({ generatedAt }),
    artifact_manifest: buildArtifactManifestSample({ generatedAt, updatedAt: generatedAt }),
    injection_index: buildInjectionIndexSample(),
  };
}

module.exports = {
  compileRouting,
};
