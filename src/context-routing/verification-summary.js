'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadBootstrapRuntimeState, safeReadJson } = require('./loader');
const { preferredMinimalContext, normalizeStage } = require('./profiles');
const { summarizeChangeSurface } = require('./change-surface');
const { buildVerifierDispatchPosture } = require('./verifier-registry');

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function mergePlatformFocus(summaries = []) {
  const merged = unique(summaries.flatMap((item) => item.platform_focus || []));
  if (merged.length > 1 && merged.includes('unknown')) {
    return merged.filter((item) => item !== 'unknown');
  }
  return merged;
}

function normalizePath(filePath) {
  return String(filePath || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
}

function canonicalAbsolutePath(filePath) {
  if (!filePath) return null;
  const resolved = path.resolve(filePath);
  try {
    return fs.realpathSync.native ? fs.realpathSync.native(resolved) : fs.realpathSync(resolved);
  } catch (_error) {
    let probe = resolved;
    while (probe && !fs.existsSync(probe)) {
      const parent = path.dirname(probe);
      if (parent === probe) break;
      probe = parent;
    }

    if (!probe || !fs.existsSync(probe)) {
      return resolved;
    }

    try {
      const canonicalProbe = fs.realpathSync.native ? fs.realpathSync.native(probe) : fs.realpathSync(probe);
      return path.join(canonicalProbe, path.relative(probe, resolved));
    } catch (_innerError) {
      return resolved;
    }
  }
}

function repoRelativeChangedFiles({
  changedFiles = [],
  repoRoot,
  workspaceRoot = null,
  childRelativePath = null,
} = {}) {
  const normalizedCanonicalRepoRoot = repoRoot ? canonicalAbsolutePath(repoRoot) : null;
  const normalizedWorkspaceRoot = workspaceRoot ? canonicalAbsolutePath(workspaceRoot) : null;
  const normalizedChildPrefix = childRelativePath
    ? normalizePath(childRelativePath).replace(/\/+$/g, '')
    : null;

  return unique((changedFiles || []).map((filePath) => {
    if (typeof filePath !== 'string' || filePath.trim() === '') return null;

    if (path.isAbsolute(filePath)) {
      const absolutePath = canonicalAbsolutePath(filePath);
      if (
        normalizedCanonicalRepoRoot
        && (absolutePath === normalizedCanonicalRepoRoot || absolutePath.startsWith(`${normalizedCanonicalRepoRoot}${path.sep}`))
      ) {
        return normalizePath(path.relative(normalizedCanonicalRepoRoot, absolutePath));
      }
      return null;
    }

    const normalized = normalizePath(filePath);
    if (!normalized) return null;

    if (
      normalizedWorkspaceRoot
      && normalizedChildPrefix
      && (normalized === normalizedChildPrefix || normalized.startsWith(`${normalizedChildPrefix}/`))
    ) {
      const sliced = normalized.slice(normalizedChildPrefix.length).replace(/^\/+/, '');
      return sliced || null;
    }

    return normalized;
  }));
}

function loadMinimalContext({ repoRoot, slug, stage, artifactAnchorRoot = repoRoot } = {}) {
  const normalizedStage = normalizeStage(stage);
  const minimalContextPath = preferredMinimalContext(normalizedStage);
  if (!minimalContextPath) return null;
  const state = loadBootstrapRuntimeState({ repoRoot, slug, artifactAnchorRoot });
  return safeReadJson(path.join(state.controlPlaneDir, minimalContextPath));
}

function fallbackConfidence(minimalContext) {
  const platformFocus = Array.isArray(minimalContext && minimalContext.platform_focus)
    ? minimalContext.platform_focus
    : [];
  return platformFocus.length > 0 ? 'medium' : 'low';
}

function buildGateCatalog(verificationProfile) {
  const gates = [
    ...(Array.isArray(verificationProfile && verificationProfile.required_gates)
      ? verificationProfile.required_gates
      : []),
    ...(Array.isArray(verificationProfile && verificationProfile.optional_gates)
      ? verificationProfile.optional_gates
      : []),
  ];

  return gates.reduce((catalog, gate) => {
    if (!gate || !gate.id) return catalog;
    catalog[gate.id] = {
      id: gate.id,
      kind: gate.kind || null,
      scope: gate.scope || null,
      evidence_type: gate.evidence_type || null,
      suggested_commands: Array.isArray(gate.suggested_commands) ? gate.suggested_commands : [],
    };
    return catalog;
  }, {});
}

function mergeDispatchCandidates(candidates = []) {
  const merged = new Map();

  for (const candidate of candidates) {
    if (!candidate || !candidate.verifier) continue;
    const key = `${candidate.verifier}:${candidate.posture || 'unknown'}`;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        ...candidate,
        platforms: unique(candidate.platforms || []),
        target_required_verifications: unique(candidate.target_required_verifications || []),
        target_optional_verifications: unique(candidate.target_optional_verifications || []),
        prerequisites: unique(candidate.prerequisites || []),
        evidence_outputs: unique(candidate.evidence_outputs || []),
        blockers: (candidate.blockers || []).map((blocker) => ({ ...blocker })),
      });
      continue;
    }

    existing.platforms = unique([...existing.platforms, ...(candidate.platforms || [])]);
    existing.target_required_verifications = unique([
      ...existing.target_required_verifications,
      ...(candidate.target_required_verifications || []),
    ]);
    existing.target_optional_verifications = unique([
      ...existing.target_optional_verifications,
      ...(candidate.target_optional_verifications || []),
    ]);
    existing.prerequisites = unique([...existing.prerequisites, ...(candidate.prerequisites || [])]);
    existing.evidence_outputs = unique([...existing.evidence_outputs, ...(candidate.evidence_outputs || [])]);
    existing.blockers = unique([
      ...existing.blockers.map((blocker) => JSON.stringify(blocker)),
      ...(candidate.blockers || []).map((blocker) => JSON.stringify(blocker)),
    ]).map((item) => JSON.parse(item));
  }

  return [...merged.values()];
}

function requirementListsForStage(stage, summary = {}) {
  const normalizedStage = normalizeStage(stage || summary.stage);
  if (normalizedStage === 'review') {
    return {
      required: unique(summary.recommended_required_verifications || []),
      optional: unique(summary.recommended_optional_verifications || []),
    };
  }

  return {
    required: unique(summary.required_verifications || []),
    optional: unique(summary.optional_verifications || []),
  };
}

function impactedPlatformsForSummary(summary = {}) {
  const impactedPlatforms = Array.isArray(summary.impacted_platforms) ? summary.impacted_platforms : [];
  if (impactedPlatforms.length > 0) return unique(impactedPlatforms);
  return unique(summary.platform_focus || []);
}

function buildVerifierDispatchForSummary({
  stage,
  verificationSummary,
  gateCatalog = {},
} = {}) {
  if (!verificationSummary) return null;
  const normalizedStage = normalizeStage(stage || verificationSummary.stage);
  const { required, optional } = requirementListsForStage(normalizedStage, verificationSummary);
  return buildVerifierDispatchPosture({
    stage: normalizedStage,
    requiredVerifications: required,
    optionalVerifications: optional,
    gateCatalog,
    platformFocus: Array.isArray(verificationSummary.platform_focus) ? verificationSummary.platform_focus : [],
    impactedPlatforms: impactedPlatformsForSummary(verificationSummary),
  });
}

function mergeVerifierDispatches(stage, dispatches = []) {
  const available = dispatches.filter(Boolean);
  if (available.length === 0) return null;
  if (available.length === 1) return available[0];

  const normalizedStage = normalizeStage(stage);
  const manualRequiredVerifications = unique(available.flatMap((item) => item.manual_required_verifications || []));
  const manualOptionalVerifications = unique(available.flatMap((item) => item.manual_optional_verifications || []));
  const dispatchCandidates = mergeDispatchCandidates(available.flatMap((item) => item.dispatch_candidates || []));
  const dispatchBlockers = unique(available.flatMap((item) =>
    (item.dispatch_blockers || []).map((blocker) => JSON.stringify(blocker))
  )).map((item) => JSON.parse(item));

  const hasReadyCandidate = dispatchCandidates.some((candidate) => candidate.posture === 'dispatch-ready');
  const hasManualCandidate = dispatchCandidates.some((candidate) => candidate.posture === 'manual-handoff');
  const hasManualWork = manualRequiredVerifications.length > 0 || manualOptionalVerifications.length > 0;

  let handoffPosture = 'not-needed';
  if (normalizedStage === 'plan') {
    handoffPosture = dispatchCandidates.length > 0 || hasManualWork ? 'plan-matrix' : 'not-needed';
  } else if (dispatchBlockers.length > 0 && !hasReadyCandidate && !hasManualCandidate && !hasManualWork) {
    handoffPosture = 'blocked';
  } else if (hasReadyCandidate && hasManualWork) {
    handoffPosture = 'dispatch-and-manual';
  } else if (hasReadyCandidate) {
    handoffPosture = 'dispatch-ready';
  } else if (hasManualCandidate || hasManualWork) {
    handoffPosture = dispatchBlockers.length > 0 ? 'blocked' : 'manual-only';
  } else if (dispatchBlockers.length > 0) {
    handoffPosture = 'blocked';
  }

  return {
    stage: normalizedStage,
    handoff_posture: handoffPosture,
    dispatch_candidates: dispatchCandidates,
    manual_required_verifications: manualRequiredVerifications,
    manual_optional_verifications: manualOptionalVerifications,
    dispatch_blockers: dispatchBlockers,
  };
}

function buildPlanSummary(minimalContext) {
  const requiredVerifications = Array.isArray(minimalContext && minimalContext.required_verifications)
    ? minimalContext.required_verifications
    : [];
  const optionalVerifications = Array.isArray(minimalContext && minimalContext.optional_verifications)
    ? minimalContext.optional_verifications
    : [];

  return {
    stage: 'plan',
    source: 'minimal-context',
    platform_focus: Array.isArray(minimalContext && minimalContext.platform_focus)
      ? minimalContext.platform_focus
      : [],
    required_verifications: requiredVerifications,
    optional_verifications: optionalVerifications,
    repo_required_verifications: requiredVerifications,
    repo_optional_verifications: optionalVerifications,
    impacted_modules: [],
    impacted_languages: [],
    impacted_platforms: [],
    recommended_required_verifications: [],
    recommended_optional_verifications: [],
    confidence: fallbackConfidence(minimalContext),
    fallback_reason: minimalContext ? minimalContext.fallback_reason || null : null,
  };
}

function buildWorkSummary({ minimalContext, changeSurface, useChangeSurface }) {
  const repoRequired = Array.isArray(minimalContext && minimalContext.required_verifications)
    ? minimalContext.required_verifications
    : [];
  const repoOptional = Array.isArray(minimalContext && minimalContext.optional_verifications)
    ? minimalContext.optional_verifications
    : [];

  if (useChangeSurface) {
    return {
      stage: 'work',
      source: 'change-surface',
      platform_focus: changeSurface.impacted_platforms,
      impacted_modules: changeSurface.impacted_modules,
      impacted_languages: changeSurface.impacted_languages,
      impacted_platforms: changeSurface.impacted_platforms,
      required_verifications: changeSurface.recommended_required_verifications,
      optional_verifications: changeSurface.recommended_optional_verifications,
      recommended_required_verifications: changeSurface.recommended_required_verifications,
      recommended_optional_verifications: changeSurface.recommended_optional_verifications,
      repo_required_verifications: repoRequired,
      repo_optional_verifications: repoOptional,
      confidence: changeSurface.confidence,
      fallback_reason: minimalContext ? minimalContext.fallback_reason || null : null,
    };
  }

  const platformFocus = Array.isArray(minimalContext && minimalContext.platform_focus)
    ? minimalContext.platform_focus
    : [];
  return {
    stage: 'work',
    source: 'minimal-context',
    platform_focus: platformFocus,
    impacted_modules: [],
    impacted_languages: [],
    impacted_platforms: [],
    required_verifications: repoRequired,
    optional_verifications: repoOptional,
    recommended_required_verifications: [],
    recommended_optional_verifications: [],
    repo_required_verifications: repoRequired,
    repo_optional_verifications: repoOptional,
    confidence: fallbackConfidence(minimalContext),
    fallback_reason: minimalContext ? minimalContext.fallback_reason || null : null,
  };
}

function buildReviewSummary({ minimalContext, changeSurface, useChangeSurface }) {
  const repoGaps = Array.isArray(minimalContext && minimalContext.verification_gaps_to_check)
    ? minimalContext.verification_gaps_to_check
    : [];

  if (useChangeSurface) {
    return {
      stage: 'review',
      source: 'change-surface',
      platform_focus: changeSurface.impacted_platforms,
      impacted_modules: changeSurface.impacted_modules,
      impacted_languages: changeSurface.impacted_languages,
      impacted_platforms: changeSurface.impacted_platforms,
      recommended_required_verifications: changeSurface.recommended_required_verifications,
      recommended_optional_verifications: changeSurface.recommended_optional_verifications,
      verification_gaps_to_check: changeSurface.recommended_required_verifications.map((id) => `confirm ${id}`),
      repo_verification_gaps_to_check: repoGaps,
      confidence: changeSurface.confidence,
      fallback_reason: minimalContext ? minimalContext.fallback_reason || null : null,
    };
  }

  const platformFocus = Array.isArray(minimalContext && minimalContext.platform_focus)
    ? minimalContext.platform_focus
    : [];
  return {
    stage: 'review',
    source: 'minimal-context',
    platform_focus: platformFocus,
    impacted_modules: [],
    impacted_languages: [],
    impacted_platforms: [],
    recommended_required_verifications: [],
    recommended_optional_verifications: [],
    verification_gaps_to_check: repoGaps,
    repo_verification_gaps_to_check: repoGaps,
    confidence: fallbackConfidence(minimalContext),
    fallback_reason: minimalContext ? minimalContext.fallback_reason || null : null,
  };
}

function buildRuntimeVerificationBundleForRepo({
  repoRoot,
  slug,
  stage,
  changedFiles = [],
  artifactAnchorRoot = repoRoot,
  workspaceRoot = null,
  childRelativePath = null,
} = {}) {
  const normalizedStage = normalizeStage(stage);
  const minimalContext = loadMinimalContext({
    repoRoot,
    slug,
    stage: normalizedStage,
    artifactAnchorRoot,
  });
  const runtimeState = loadBootstrapRuntimeState({ repoRoot, slug, artifactAnchorRoot });
  const verificationProfile = runtimeState.verificationProfile || null;
  const gateCatalog = buildGateCatalog(verificationProfile);

  if (normalizedStage === 'unknown') {
    return {
      verificationSummary: null,
      verifierDispatch: null,
    };
  }

  const repoChangedFiles = repoRelativeChangedFiles({
    changedFiles,
    repoRoot,
    workspaceRoot,
    childRelativePath,
  });
  const useChangeSurface = repoChangedFiles.length > 0 && (normalizedStage === 'work' || normalizedStage === 'review');
  const changeSurface = useChangeSurface
    ? summarizeChangeSurface({
      repoRoot,
      slug,
      changedFiles: repoChangedFiles,
      artifactAnchorRoot,
    })
    : null;

  let verificationSummary = null;
  if (normalizedStage === 'plan') {
    verificationSummary = buildPlanSummary(minimalContext);
  } else if (normalizedStage === 'work') {
    verificationSummary = buildWorkSummary({ minimalContext, changeSurface, useChangeSurface });
  } else if (normalizedStage === 'review') {
    verificationSummary = buildReviewSummary({ minimalContext, changeSurface, useChangeSurface });
  } else {
    verificationSummary = {
      stage: normalizedStage,
      source: 'minimal-context',
      platform_focus: [],
      impacted_modules: [],
      impacted_languages: [],
      impacted_platforms: [],
      recommended_required_verifications: [],
      recommended_optional_verifications: [],
      confidence: 'low',
      fallback_reason: minimalContext ? minimalContext.fallback_reason || null : null,
    };
  }

  return {
    verificationSummary,
    verifierDispatch: buildVerifierDispatchForSummary({
      stage: normalizedStage,
      verificationSummary,
      gateCatalog,
    }),
  };
}

function buildRuntimeVerificationSummaryForRepo(options = {}) {
  return buildRuntimeVerificationBundleForRepo(options).verificationSummary;
}

function buildRuntimeVerifierDispatchForRepo(options = {}) {
  return buildRuntimeVerificationBundleForRepo(options).verifierDispatch;
}

function mergeVerificationSummaries(stage, summaries = []) {
  const available = summaries.filter(Boolean);
  if (available.length === 0) return null;
  if (available.length === 1) return available[0];

  const normalizedStage = normalizeStage(stage);
  const hasChangeSurface = available.some((item) => item.source === 'change-surface');
  const effectiveSummaries = hasChangeSurface
    ? available.filter((item) => item.source === 'change-surface')
    : available;
  const confidenceOrder = ['low', 'medium', 'high'];
  const mergedConfidence = effectiveSummaries
    .map((item) => item.confidence || 'low')
    .sort((left, right) => confidenceOrder.indexOf(right) - confidenceOrder.indexOf(left))[0] || 'low';

  const base = {
    stage: normalizedStage,
    source: hasChangeSurface ? 'change-surface' : 'minimal-context',
    platform_focus: mergePlatformFocus(effectiveSummaries),
    impacted_modules: unique(effectiveSummaries.flatMap((item) => item.impacted_modules || [])),
    impacted_languages: unique(effectiveSummaries.flatMap((item) => item.impacted_languages || [])),
    impacted_platforms: unique(effectiveSummaries.flatMap((item) => item.impacted_platforms || [])),
    recommended_required_verifications: unique(effectiveSummaries.flatMap((item) => item.recommended_required_verifications || [])),
    recommended_optional_verifications: unique(effectiveSummaries.flatMap((item) => item.recommended_optional_verifications || [])),
    confidence: mergedConfidence,
    fallback_reason: effectiveSummaries.find((item) => item.fallback_reason)?.fallback_reason
      || available.find((item) => item.fallback_reason)?.fallback_reason
      || null,
  };

  if (normalizedStage === 'work') {
    return {
      ...base,
      required_verifications: unique(effectiveSummaries.flatMap((item) => item.required_verifications || [])),
      optional_verifications: unique(effectiveSummaries.flatMap((item) => item.optional_verifications || [])),
      repo_required_verifications: unique(available.flatMap((item) => item.repo_required_verifications || [])),
      repo_optional_verifications: unique(available.flatMap((item) => item.repo_optional_verifications || [])),
    };
  }

  if (normalizedStage === 'review') {
    return {
      ...base,
      verification_gaps_to_check: unique(effectiveSummaries.flatMap((item) => item.verification_gaps_to_check || [])),
      repo_verification_gaps_to_check: unique(available.flatMap((item) => item.repo_verification_gaps_to_check || [])),
    };
  }

  return {
    ...base,
    required_verifications: unique(effectiveSummaries.flatMap((item) => item.required_verifications || [])),
    optional_verifications: unique(effectiveSummaries.flatMap((item) => item.optional_verifications || [])),
    repo_required_verifications: unique(available.flatMap((item) => item.repo_required_verifications || [])),
    repo_optional_verifications: unique(available.flatMap((item) => item.repo_optional_verifications || [])),
  };
}

module.exports = {
  buildRuntimeVerificationBundleForRepo,
  buildRuntimeVerifierDispatchForRepo,
  buildRuntimeVerificationSummaryForRepo,
  mergeVerifierDispatches,
  mergeVerificationSummaries,
  repoRelativeChangedFiles,
};
