'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const BENCHMARK_CONTRACT_VERSION = 'v1';

const CONTEXT_ROUTING_ANALYZER_FILES = [
  'src/context-routing/evaluator.js',
  'src/context-routing/fallback.js',
  'src/context-routing/loader.js',
  'src/context-routing/priority.js',
  'src/context-routing/profiles.js',
];

function digestBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function digestFile(filePath) {
  return digestBuffer(fs.readFileSync(filePath));
}

function digestFiles(repoRoot, relativePaths) {
  const hash = crypto.createHash('sha256');
  for (const relativePath of [...relativePaths].sort()) {
    const absolutePath = path.join(repoRoot, relativePath);
    hash.update(relativePath);
    hash.update('\0');
    hash.update(fs.readFileSync(absolutePath));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function buildContextRoutingAnalyzerRevision(repoRoot) {
  return `context-routing-evaluator:${digestFiles(repoRoot, CONTEXT_ROUTING_ANALYZER_FILES).slice(0, 16)}`;
}

module.exports = {
  BENCHMARK_CONTRACT_VERSION,
  CONTEXT_ROUTING_ANALYZER_FILES,
  buildContextRoutingAnalyzerRevision,
  digestFile,
  digestFiles,
};
