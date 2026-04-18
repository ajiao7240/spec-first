'use strict';

const path = require('node:path');
const { buildFallbackResult, fallbackAssetsForStage } = require('./fallback');
const { findExistingAsset, safeReadJson } = require('./loader');
const { normalizeStage, preferredMinimalContext, resolveProfile } = require('./profiles');
const { trimAssetsToBudget } = require('./priority');

function toOutputExistsKey(assetPath) {
  return assetPath
    .replace(/\.(md|json|yaml)$/i, '')
    .replace(/[/.-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildOutputExistsMap(manifest) {
  const result = Object.create(null);
  if (!manifest || !manifest.outputs || typeof manifest.outputs !== 'object') return result;
  for (const assetPath of Object.keys(manifest.outputs)) {
    result[toOutputExistsKey(assetPath)] = true;
  }
  return result;
}

function evaluateSelectionRule(rule, { outputExists, stage }) {
  if (!rule || typeof rule.condition !== 'string') {
    return { matched: false, skipped: null };
  }

  if (rule.condition.startsWith('output_exists.')) {
    const outputKey = rule.condition.slice('output_exists.'.length);
    return { matched: Boolean(outputExists[outputKey]), skipped: null };
  }

  if (rule.condition.startsWith('stage_is.')) {
    return { matched: stage === rule.condition.slice('stage_is.'.length), skipped: null };
  }

  if (rule.condition.startsWith('fact.')) {
    return { matched: false, skipped: rule.condition };
  }

  return { matched: false, skipped: rule.condition };
}

function unique(array) {
  return [...new Set(array)];
}

function evaluateContext({
  stage,
  contextDir,
  controlPlaneDir,
  routing,
  manifest,
  freshness,
  maxTokens = Infinity,
}) {
  const normalizedStage = normalizeStage(stage);
  const advice = routing && routing.advice ? (routing.advice[normalizedStage] || '') : '';
  const runtimePaths = { contextDir, controlPlaneDir };

  if (!contextDir || !controlPlaneDir) {
    return buildFallbackResult({
      stage: normalizedStage,
      level: 'L3',
      fallbackReason: 'context_dir_missing',
      selectedAssets: fallbackAssetsForStage('unknown'),
      advice,
      maxTokens,
    });
  }

  if (!manifest || manifest.status !== 'complete') {
    return buildFallbackResult({
      stage: normalizedStage,
      level: 'L3',
      fallbackReason: 'manifest_incomplete',
      selectedAssets: fallbackAssetsForStage('unknown'),
      advice,
      maxTokens,
    });
  }

  if (!routing) {
    return buildFallbackResult({
      stage: normalizedStage,
      level: 'L2',
      fallbackReason: 'routing_missing',
      selectedAssets: fallbackAssetsForStage(normalizedStage),
      advice,
      maxTokens,
      freshnessStatus: freshness && freshness.status ? freshness.status : 'unknown',
    });
  }

  const skippedRules = [];
  const outputExists = buildOutputExistsMap(manifest);
  let assets = [];
  assets.push(...(Array.isArray(routing.always) ? routing.always : []));
  const stageAssets = routing.stages && routing.stages[normalizedStage]
    ? routing.stages[normalizedStage]
    : (routing.stages && routing.stages.unknown) || [];
  assets.push(...stageAssets);

  for (const rule of Array.isArray(routing.selection_rules) ? routing.selection_rules : []) {
    const outcome = evaluateSelectionRule(rule, { outputExists, stage: normalizedStage });
    if (outcome.skipped) {
      skippedRules.push(outcome.skipped);
    }
    if (outcome.matched) {
      assets.push(...rule.inject);
    }
  }

  const minimalContextPath = preferredMinimalContext(normalizedStage);
  let minimalContextMissing = false;
  if (minimalContextPath) {
    const minimalContextInfo = findExistingAsset(minimalContextPath, runtimePaths);
    if (minimalContextInfo.exists) {
      assets.unshift(minimalContextPath);
    } else {
      minimalContextMissing = true;
    }
  }

  assets = unique(assets).filter((assetPath) => findExistingAsset(assetPath, runtimePaths).exists);

  const { selectedAssets, estimatedTokens } = trimAssetsToBudget(assets, maxTokens);
  const freshnessStatus = freshness && freshness.status ? freshness.status : 'unknown';

  const qualitySufficient = (manifest.data_quality ?? 'empty') !== 'empty';
  let level = minimalContextMissing ? 'L1' : !qualitySufficient ? 'L1' : 'L0';
  let fallbackReason = minimalContextMissing  ? 'minimal_context_missing' :
                       !qualitySufficient     ? 'empty_fact_inventory'    : null;
  if (!fallbackReason && freshnessStatus === 'stale') {
    fallbackReason = 'freshness_stale';
  }

  return {
    stage: normalizedStage,
    profile: resolveProfile(normalizedStage),
    level,
    selected_assets: selectedAssets,
    estimated_tokens: estimatedTokens,
    fallback_reason: fallbackReason,
    skipped_rules: skippedRules,
    freshness_status: freshnessStatus,
    advice,
  };
}

function evaluateContextForRepo({
  repoRoot,
  slug,
  stage,
  maxTokens = Infinity,
  artifactAnchorRoot = repoRoot,
} = {}) {
  const { loadBootstrapRuntimeState } = require('./loader');
  const state = loadBootstrapRuntimeState({ repoRoot, slug, artifactAnchorRoot });
  return evaluateContext({
    stage,
    contextDir: state.contextDir,
    controlPlaneDir: state.controlPlaneDir,
    routing: state.routing,
    manifest: state.manifest,
    freshness: state.freshness,
    maxTokens,
  });
}

module.exports = {
  buildOutputExistsMap,
  evaluateContext,
  evaluateContextForRepo,
  evaluateSelectionRule,
  toOutputExistsKey,
};
