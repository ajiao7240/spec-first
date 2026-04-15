'use strict';

const fs = require('node:fs');

const { resolveGenerationDir, readGraphPointer } = require('./paths');
const { GRAPH_CURRENT_FILE } = require('../artifact-paths');

function discardFailedGeneration(repoRoot, generationId) {
  const generationDir = resolveGenerationDir(repoRoot, generationId);
  if (fs.existsSync(generationDir)) {
    fs.rmSync(generationDir, { recursive: true, force: true });
  }
}

function readCurrentGeneration(repoRoot) {
  return readGraphPointer(repoRoot, GRAPH_CURRENT_FILE);
}

module.exports = {
  discardFailedGeneration,
  readCurrentGeneration,
};
