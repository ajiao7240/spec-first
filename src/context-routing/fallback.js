'use strict';

const { preferredMinimalContext, resolveProfile } = require('./profiles');
const { trimAssetsToBudget } = require('./priority');

const DEFAULT_STAGE_ASSETS = {
  plan: [
    '00-summary.md',
    'code-facts/public-entrypoints.md',
    'architecture/module-map.md',
    'README.md',
  ],
  work: [
    '00-summary.md',
    'pitfalls/index.md',
    'code-facts/public-entrypoints.md',
    'code-facts/test-map.md',
  ],
  review: [
    '00-summary.md',
    'pitfalls/index.md',
    'code-facts/public-entrypoints.md',
    'code-facts/test-map.md',
  ],
  unknown: [
    '00-summary.md',
    'README.md',
  ],
};

function fallbackAssetsForStage(stage) {
  return DEFAULT_STAGE_ASSETS[stage] || DEFAULT_STAGE_ASSETS.unknown;
}

function buildFallbackResult({
  stage,
  level,
  fallbackReason,
  selectedAssets,
  advice = '',
  maxTokens = Infinity,
  skippedRules = [],
  freshnessStatus = 'unknown',
}) {
  const { selectedAssets: trimmedAssets, estimatedTokens } = trimAssetsToBudget(selectedAssets, maxTokens);
  return {
    stage,
    profile: resolveProfile(stage),
    level,
    selected_assets: trimmedAssets,
    estimated_tokens: estimatedTokens,
    fallback_reason: fallbackReason,
    skipped_rules: skippedRules,
    freshness_status: freshnessStatus,
    advice,
    expected_minimal_context: preferredMinimalContext(stage),
  };
}

module.exports = {
  buildFallbackResult,
  fallbackAssetsForStage,
};
