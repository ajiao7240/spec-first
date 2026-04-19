'use strict';

const { safeReadJson } = require('./loader');
const { resolveWorkflowArtifactDir } = require('../crg/artifact-paths');
const { normalizeStage } = require('./profiles');

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function normalizeEvidenceItem(item) {
  if (!item || typeof item !== 'object') return null;

  const gateIds = unique(item.gate_ids || []);
  if (!item.evidence_ref || !item.verifier || gateIds.length === 0 || !item.evidence_type) {
    return null;
  }

  return {
    evidence_ref: String(item.evidence_ref),
    verifier: String(item.verifier),
    gate_ids: gateIds,
    evidence_type: String(item.evidence_type),
    status: item.status === 'failed' ? 'failed' : 'captured',
    artifact_path: item.artifact_path ? String(item.artifact_path) : null,
    captured_at: item.captured_at ? String(item.captured_at) : null,
    stage: item.stage ? normalizeStage(item.stage) : 'unknown',
  };
}

function relevantGateIdsForSummary(stage, verificationSummary = {}) {
  const normalizedStage = normalizeStage(stage || verificationSummary.stage);
  if (normalizedStage === 'review') {
    return unique([
      ...(verificationSummary.recommended_required_verifications || []),
      ...(verificationSummary.recommended_optional_verifications || []),
    ]);
  }

  return unique([
    ...(verificationSummary.required_verifications || []),
    ...(verificationSummary.optional_verifications || []),
  ]);
}

function loadVerificationEvidence({
  repoRoot,
  slug,
  artifactAnchorRoot = repoRoot,
  stage,
  verificationSummary = {},
} = {}) {
  const artifactDir = resolveWorkflowArtifactDir(repoRoot, 'verification', slug, { artifactAnchorRoot });
  const manifest = safeReadJson(`${artifactDir}/verification-evidence.json`) || {};
  const relevantGateIds = relevantGateIdsForSummary(stage, verificationSummary);
  const wantedGateIds = new Set(relevantGateIds);
  const rawItems = Array.isArray(manifest.evidence_items) ? manifest.evidence_items : [];
  const evidenceItems = rawItems
    .map(normalizeEvidenceItem)
    .filter(Boolean)
    .filter((item) => {
      if (wantedGateIds.size === 0) return false;
      return item.gate_ids.some((gateId) => wantedGateIds.has(gateId));
    });

  return {
    schema_version: 'v1',
    evidence_source: 'workflow-artifacts',
    evidence_items: evidenceItems,
  };
}

function mergeVerificationEvidence(contracts = []) {
  const merged = new Map();

  for (const contract of contracts.filter(Boolean)) {
    for (const item of contract.evidence_items || []) {
      if (!item || !item.evidence_ref) continue;
      const existing = merged.get(item.evidence_ref);
      if (!existing) {
        merged.set(item.evidence_ref, {
          ...item,
          gate_ids: [...item.gate_ids],
        });
        continue;
      }

      existing.gate_ids = unique([...existing.gate_ids, ...(item.gate_ids || [])]);
      if (!existing.artifact_path && item.artifact_path) existing.artifact_path = item.artifact_path;
      if (!existing.captured_at && item.captured_at) existing.captured_at = item.captured_at;
      if (existing.status !== 'captured' && item.status === 'captured') existing.status = 'captured';
    }
  }

  return {
    schema_version: 'v1',
    evidence_source: 'workflow-artifacts',
    evidence_items: [...merged.values()],
  };
}

module.exports = {
  loadVerificationEvidence,
  mergeVerificationEvidence,
};
