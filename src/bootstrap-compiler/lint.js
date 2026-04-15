'use strict';

function normalizeOutputs(manifest) {
  if (!manifest || !manifest.outputs || typeof manifest.outputs !== 'object') {
    return [];
  }
  return Object.keys(manifest.outputs);
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map((value) => value.replace(/\\/g, '/')))];
}

function buildLintReport({
  generatedAt = new Date().toISOString(),
  manifest,
  actualAssets = [],
  contextAssets = [],
  requiredAssets = [],
  schemaDrift = [],
} = {}) {
  const expectedAssets = normalizeOutputs(manifest);
  const actual = new Set(actualAssets);
  const missingAssets = expectedAssets.filter((assetPath) => !actual.has(assetPath));
  const orphanPages = contextAssets.filter(
    (assetPath) => assetPath.endsWith('.md') && !expectedAssets.includes(assetPath)
  );

  return {
    schema_version: 'v1',
    generated_at: generatedAt,
    status: missingAssets.length === 0 && schemaDrift.length === 0 ? 'ok' : 'error',
    schema_drift: schemaDrift,
    missing_assets: unique([...requiredAssets.filter((assetPath) => !actual.has(assetPath)), ...missingAssets]),
    orphan_pages: orphanPages,
  };
}

module.exports = {
  buildLintReport,
  normalizeOutputs,
};
