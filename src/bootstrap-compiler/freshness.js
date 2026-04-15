'use strict';

function resolveFreshnessStatus({ graphAgeMs, outputAgeMs, maxGraphAgeMs, maxOutputAgeMs }) {
  if (graphAgeMs > maxGraphAgeMs) return 'stale';
  if (outputAgeMs > maxOutputAgeMs) return 'stale';
  return 'healthy';
}

function buildFreshnessReport({
  generatedAt = new Date().toISOString(),
  graphLastBuilt,
  outputUpdatedAt,
  inputs = {},
  maxGraphAgeMs = 1000 * 60 * 60 * 24,
  maxOutputAgeMs = 1000 * 60 * 60 * 12,
} = {}) {
  const generatedMs = Date.parse(generatedAt);
  const graphMs = Date.parse(graphLastBuilt || generatedAt);
  const outputMs = Date.parse(outputUpdatedAt || generatedAt);
  const graphAgeMs = Number.isFinite(generatedMs - graphMs) ? generatedMs - graphMs : Number.MAX_SAFE_INTEGER;
  const outputAgeMs = Number.isFinite(generatedMs - outputMs) ? generatedMs - outputMs : Number.MAX_SAFE_INTEGER;

  return {
    schema_version: 'v1',
    generated_at: generatedAt,
    graph_last_built: graphLastBuilt || null,
    output_updated_at: outputUpdatedAt || null,
    status: resolveFreshnessStatus({
      graphAgeMs,
      outputAgeMs,
      maxGraphAgeMs,
      maxOutputAgeMs,
    }),
    stale_reasons: [
      ...(graphAgeMs > maxGraphAgeMs ? ['graph_stale'] : []),
      ...(outputAgeMs > maxOutputAgeMs ? ['output_stale'] : []),
    ],
    input_snapshot: inputs,
  };
}

module.exports = {
  buildFreshnessReport,
  resolveFreshnessStatus,
};
