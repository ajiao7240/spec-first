'use strict';

const { normalizeStage } = require('./profiles');

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function buildEvidenceIndex(verificationEvidence = {}) {
  const index = new Map();

  for (const item of verificationEvidence.evidence_items || []) {
    if (!item || item.status !== 'captured') continue;
    for (const gateId of item.gate_ids || []) {
      const existing = index.get(gateId) || [];
      existing.push(item.evidence_ref);
      index.set(gateId, unique(existing));
    }
  }

  return index;
}

function requirementListsForStage(summary = {}) {
  const stage = normalizeStage(summary.stage);
  if (stage === 'review') {
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

function expectedEvidenceForGate(gateId, candidate) {
  if (candidate && Array.isArray(candidate.evidence_outputs) && candidate.evidence_outputs.length > 0) {
    return unique(candidate.evidence_outputs);
  }

  const normalizedGateId = String(gateId || '').toLowerCase();
  if (normalizedGateId.includes('evidence')) return ['artifact-reference'];
  return ['command-output'];
}

function buildBlockerIndex(dispatchPosture = {}) {
  const index = new Map();

  for (const blocker of dispatchPosture.dispatch_blockers || []) {
    const targetVerifications = blocker.target_verifications || [];
    for (const gateId of targetVerifications) {
      const existing = index.get(gateId) || [];
      existing.push({
        verifier: blocker.verifier || null,
        prerequisite: blocker.prerequisite || null,
        kind: blocker.kind || null,
        reason: blocker.reason || null,
        detail: blocker.detail || null,
        setup_hint: blocker.setup_hint || null,
      });
      index.set(gateId, existing);
    }
  }

  return index;
}

function buildCandidateIndex(dispatchPosture = {}) {
  const index = new Map();

  for (const candidate of dispatchPosture.dispatch_candidates || []) {
    for (const gateId of candidate.target_required_verifications || []) {
      index.set(gateId, candidate);
    }
    for (const gateId of candidate.target_optional_verifications || []) {
      index.set(gateId, candidate);
    }
  }

  return index;
}

function fulfillmentModeFor(stage, gateId, candidate, dispatchPosture) {
  if (candidate) return 'verifier-skill';
  if (stage === 'review' && (dispatchPosture.manual_required_verifications || []).includes(gateId)) {
    return 'manual-confirmation';
  }
  return 'repo-command';
}

function statusForGate(stage, gateId, candidate, blockers = [], evidenceLocations = []) {
  if (stage === 'plan') return 'planned';
  if (evidenceLocations.length > 0) return 'satisfied';
  if (blockers.length > 0) return 'blocked';
  if (candidate && candidate.posture === 'dispatch-ready') return 'pending';
  if (candidate && candidate.posture === 'manual-handoff') return 'pending';
  return 'pending';
}

function ciGateStatus(stage, requiredGates, blockedRequiredCount, satisfiedRequiredCount) {
  if (stage === 'plan') return 'planned';
  if (requiredGates.length === 0) return 'not-needed';
  if (blockedRequiredCount > 0) return 'blocked';
  if (satisfiedRequiredCount === requiredGates.length) return 'satisfied';
  return 'pending';
}

function overallStatus(stage, requiredGates, optionalGates, blockedRequiredCount, satisfiedRequiredCount) {
  if (stage === 'plan') return requiredGates.length === 0 && optionalGates.length === 0 ? 'not-needed' : 'planned';
  if (requiredGates.length === 0 && optionalGates.length === 0) return 'not-needed';
  if (blockedRequiredCount > 0) return 'blocked';
  if (
    requiredGates.length > 0
    && satisfiedRequiredCount === requiredGates.length
  ) {
    return 'satisfied';
  }
  if (
    requiredGates.length === 0
    && optionalGates.length > 0
    && optionalGates.every((gate) => gate.status === 'satisfied')
  ) {
    return 'satisfied';
  }
  return 'pending';
}

function buildVerificationGateState({ stage, verificationSummary, verifierDispatch, verificationEvidence } = {}) {
  const normalizedStage = normalizeStage(stage || (verificationSummary && verificationSummary.stage));
  const summary = verificationSummary || {};
  const dispatchPosture = verifierDispatch || {
    dispatch_candidates: [],
    manual_required_verifications: [],
    manual_optional_verifications: [],
    dispatch_blockers: [],
  };
  const { required, optional } = requirementListsForStage(summary);
  const candidateIndex = buildCandidateIndex(dispatchPosture);
  const blockerIndex = buildBlockerIndex(dispatchPosture);
  const evidenceIndex = normalizedStage === 'plan'
    ? new Map()
    : buildEvidenceIndex(verificationEvidence);

  const requiredGates = required.map((gateId) => {
    const candidate = candidateIndex.get(gateId) || null;
    const blockers = blockerIndex.get(gateId) || [];
    const evidenceLocations = evidenceIndex.get(gateId) || [];
    return {
      gate_id: gateId,
      status: statusForGate(normalizedStage, gateId, candidate, blockers, evidenceLocations),
      fulfillment_mode: fulfillmentModeFor(normalizedStage, gateId, candidate, dispatchPosture),
      verifier: candidate ? candidate.verifier : null,
      expected_evidence: expectedEvidenceForGate(gateId, candidate),
      evidence_locations: evidenceLocations,
      blockers,
    };
  });

  const optionalEvidence = optional.map((gateId) => {
    const candidate = candidateIndex.get(gateId) || null;
    const blockers = blockerIndex.get(gateId) || [];
    const evidenceLocations = evidenceIndex.get(gateId) || [];
    return {
      gate_id: gateId,
      status: statusForGate(normalizedStage, gateId, candidate, blockers, evidenceLocations),
      fulfillment_mode: fulfillmentModeFor(normalizedStage, gateId, candidate, dispatchPosture),
      verifier: candidate ? candidate.verifier : null,
      expected_evidence: expectedEvidenceForGate(gateId, candidate),
      evidence_locations: evidenceLocations,
      blockers,
    };
  });

  const blockedRequiredCount = requiredGates.filter((gate) => gate.status === 'blocked').length;
  const satisfiedRequiredCount = requiredGates.filter((gate) => gate.status === 'satisfied').length;
  const evidenceLocations = unique([
    ...requiredGates.flatMap((gate) => gate.evidence_locations || []),
    ...optionalEvidence.flatMap((gate) => gate.evidence_locations || []),
  ]);

  return {
    schema_version: 'v1',
    stage: normalizedStage,
    state_source: 'runtime-inferred',
    overall_status: overallStatus(
      normalizedStage,
      requiredGates,
      optionalEvidence,
      blockedRequiredCount,
      satisfiedRequiredCount
    ),
    required_gates: requiredGates,
    optional_evidence: optionalEvidence,
    blockers: unique((dispatchPosture.dispatch_blockers || []).map((item) => JSON.stringify(item))).map((item) =>
      JSON.parse(item)
    ),
    evidence_locations: evidenceLocations,
    ci_gate: {
      status: ciGateStatus(normalizedStage, requiredGates, blockedRequiredCount, satisfiedRequiredCount),
      required_gate_count: requiredGates.length,
      blocked_required_gate_count: blockedRequiredCount,
      satisfied_required_gate_count: satisfiedRequiredCount,
    },
  };
}

module.exports = {
  buildVerificationGateState,
};
