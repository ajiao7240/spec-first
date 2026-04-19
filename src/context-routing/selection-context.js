'use strict';

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function toSelectedContext({
  scope,
  slug,
  repoRoot = null,
  unitId = null,
  assetPath,
  reason,
  priority,
} = {}) {
  const result = {
    scope,
    slug,
    asset_path: assetPath,
    reason,
    priority,
  };
  if (repoRoot) result.repo_root = repoRoot;
  if (unitId) result.unit_id = unitId;
  return result;
}

function buildSelectedContextsFromAssets({
  scope,
  slug,
  repoRoot = null,
  unitId = null,
  selectedAssets = [],
  reason = 'stage-default',
  startPriority = 100,
} = {}) {
  return unique(selectedAssets).map((assetPath, index) =>
    toSelectedContext({
      scope,
      slug,
      repoRoot,
      unitId,
      assetPath,
      reason,
      priority: startPriority + index,
    }));
}

function buildSelectionSubject({
  kind,
  ownerSlug = null,
  subjectSlug = null,
  unitId = null,
  targetPath = null,
  matchReason = null,
  provenance = null,
} = {}) {
  if (!kind) return null;
  const result = { kind };
  if (ownerSlug) result.owner_slug = ownerSlug;
  if (subjectSlug) result.subject_slug = subjectSlug;
  if (unitId) result.unit_id = unitId;
  if (targetPath) result.path = targetPath;
  if (matchReason) result.match_reason = matchReason;
  if (provenance) result.provenance = provenance;
  return result;
}

module.exports = {
  buildSelectedContextsFromAssets,
  buildSelectionSubject,
  toSelectedContext,
};
