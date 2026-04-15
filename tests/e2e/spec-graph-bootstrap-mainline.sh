#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

TMP_REPO="$(mktemp -d)"
trap 'rm -rf "$TMP_REPO"' EXIT

echo "=== E2E 测试：spec-graph-bootstrap 主链 ==="

export BOOTSTRAP_TEST_REPO="$TMP_REPO"

node <<'NODE'
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { runBootstrap } = require('./src/bootstrap-compiler/run-bootstrap');
const { evaluateContextForRepo } = require('./src/context-routing/evaluator');
const { recordWorkflowTelemetry } = require('./src/context-routing/telemetry');

const repoRoot = process.env.BOOTSTRAP_TEST_REPO;
const generatedAt = '2026-04-15T00:00:00.000Z';

const result = runBootstrap({ repoRoot, generatedAt });
if (result.status !== 'complete') {
  throw new Error('bootstrap mainline did not complete');
}

const evaluation = evaluateContextForRepo({
  repoRoot,
  slug: result.slug,
  stage: 'review',
});

if (evaluation.level !== 'L0') {
  throw new Error(`expected L0 evaluation, received ${evaluation.level}`);
}

if (evaluation.selected_assets[0] !== 'minimal-context/review.json') {
  throw new Error(`unexpected selected asset order: ${evaluation.selected_assets.join(',')}`);
}

const telemetry = recordWorkflowTelemetry({
  repoRoot,
  workflow: 'spec-review',
  slug: result.slug,
  evaluation,
  generatedAt,
});

if (!fs.existsSync(telemetry.filePath)) {
  throw new Error('telemetry file was not written');
}

const telemetryRecord = JSON.parse(fs.readFileSync(telemetry.filePath, 'utf8'));
if (telemetryRecord.stage !== 'review') {
  throw new Error(`unexpected telemetry stage: ${telemetryRecord.stage}`);
}

const requiredArtifacts = [
  path.join(result.controlPlaneDir, 'context-routing.json'),
  path.join(result.controlPlaneDir, 'artifact-manifest.json'),
  path.join(result.controlPlaneDir, 'freshness.json'),
  path.join(result.controlPlaneDir, 'minimal-context', 'review.json'),
  path.join(result.contextDir, 'architecture', 'module-map.md'),
];

for (const artifactPath of requiredArtifacts) {
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`missing artifact: ${artifactPath}`);
  }
}

console.log('bootstrap mainline verified');
NODE

echo "=== spec-graph-bootstrap 主链通过 ✓ ==="
