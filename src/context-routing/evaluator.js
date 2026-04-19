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

function normalizeDataQuality(manifest) {
  return typeof (manifest && manifest.data_quality) === 'string' && manifest.data_quality.length > 0
    ? manifest.data_quality
    : 'unknown';
}

function qualityFallbackFor(dataQuality) {
  if (dataQuality === 'fact-backed') {
    return { sufficient: true, level: null, reason: null };
  }

  if (dataQuality === 'partial' || dataQuality === 'mixed') {
    return { sufficient: false, level: 'L1', reason: `data_quality_${dataQuality.replace(/-/g, '_')}` };
  }

  if (dataQuality === 'unknown') {
    return { sufficient: false, level: 'L1', reason: 'legacy_manifest_missing_quality_fields' };
  }

  if (dataQuality === 'empty') {
    return { sufficient: false, level: 'L2', reason: 'empty_fact_inventory' };
  }

  if (dataQuality === 'sample-backed' || dataQuality === 'skeletal') {
    return { sufficient: false, level: 'L2', reason: `data_quality_${dataQuality.replace(/-/g, '_')}` };
  }

  return { sufficient: false, level: 'L1', reason: `data_quality_${dataQuality.replace(/-/g, '_')}` };
}

function readMinimalContextMeta(minimalContextInfo) {
  if (!minimalContextInfo || !minimalContextInfo.exists) {
    return {
      confidence: 'unknown',
      provenance: 'unknown',
      coverage_gaps: [],
    };
  }

  const minimalContext = safeReadJson(minimalContextInfo.absolutePath);
  return {
    confidence: typeof (minimalContext && minimalContext.confidence) === 'string'
      ? minimalContext.confidence
      : 'unknown',
    provenance: typeof (minimalContext && minimalContext.provenance) === 'string'
      ? minimalContext.provenance
      : 'unknown',
    coverage_gaps: Array.isArray(minimalContext && minimalContext.coverage_gaps)
      ? minimalContext.coverage_gaps
      : [],
  };
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
  let minimalContextInfo = null;
  if (minimalContextPath) {
    minimalContextInfo = findExistingAsset(minimalContextPath, runtimePaths);
    if (minimalContextInfo.exists) {
      assets.unshift(minimalContextPath);
    } else {
      minimalContextMissing = true;
    }
  }

  assets = unique(assets).filter((assetPath) => findExistingAsset(assetPath, runtimePaths).exists);

  const { selectedAssets, estimatedTokens } = trimAssetsToBudget(assets, maxTokens);
  const freshnessStatus = freshness && freshness.status ? freshness.status : 'unknown';
  const dataQuality = normalizeDataQuality(manifest);
  const quality = qualityFallbackFor(dataQuality);
  const minimalContextMeta = readMinimalContextMeta(minimalContextInfo);
  let level = quality.sufficient ? 'L0' : quality.level;
  let fallbackReason = quality.reason || (minimalContextMissing ? 'minimal_context_missing' : null);
  if (minimalContextMissing && quality.sufficient) {
    level = 'L1';
  }
  if (!fallbackReason && freshnessStatus === 'stale') {
    fallbackReason = 'freshness_stale';
    level = level === 'L0' ? 'L1' : level;
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
    data_quality: dataQuality,
    confidence: minimalContextMeta.confidence,
    provenance: minimalContextMeta.provenance,
    coverage_gaps: minimalContextMeta.coverage_gaps,
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
