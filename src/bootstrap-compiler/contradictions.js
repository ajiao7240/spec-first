'use strict';

function normalizeScalarFacts(assetPath, content) {
  const facts = [];
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    for (const [key, value] of Object.entries(content)) {
      if (value === null) continue;
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        facts.push({
          asset_path: assetPath,
          fact_key: key,
          fact_value: String(value),
        });
      }
    }
    return facts;
  }

  if (typeof content === 'string') {
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*([A-Za-z0-9_\-\u4e00-\u9fa5 ]+):\s+(.+?)\s*$/);
      if (!match) continue;
      facts.push({
        asset_path: assetPath,
        fact_key: match[1].trim().toLowerCase(),
        fact_value: match[2].trim(),
      });
    }
  }

  return facts;
}

function buildContradictionsReport({ generatedAt = new Date().toISOString(), assets = [] } = {}) {
  const factMap = new Map();

  for (const asset of assets) {
    for (const fact of normalizeScalarFacts(asset.asset_path, asset.content)) {
      if (!factMap.has(fact.fact_key)) {
        factMap.set(fact.fact_key, []);
      }
      factMap.get(fact.fact_key).push(fact);
    }
  }

  const contradictions = [];
  for (const [factKey, entries] of factMap.entries()) {
    const distinctValues = [...new Set(entries.map((entry) => entry.fact_value))];
    if (distinctValues.length <= 1) continue;
    contradictions.push({
      fact_key: factKey,
      values: distinctValues,
      assets: entries.map((entry) => entry.asset_path),
      severity: 'warning',
    });
  }

  return {
    schema_version: 'v1',
    generated_at: generatedAt,
    status: contradictions.length === 0 ? 'ok' : 'warning',
    contradictions,
  };
}

module.exports = {
  buildContradictionsReport,
  normalizeScalarFacts,
};
