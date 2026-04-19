'use strict';

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function normalizeFailedCheckTopic(check) {
  if (!check || typeof check !== 'object' || check.passed !== false || !check.check_id) {
    return null;
  }

  return {
    topic_id: `gate-check:${check.check_id}`,
    kind: 'failed-check',
    topic_key: String(check.check_id),
    summary: `Latest AI Dev Quality Gate failed check "${check.check_id}".`,
    scope_hint: String(check.check_id),
    artifact_paths: unique([check.artifact_path]),
    evidence_refs: [],
    tags: unique(['quality-gate', String(check.check_id), check.kind]),
  };
}

function normalizeFailedEvidenceTopic(item) {
  if (!item || typeof item !== 'object' || item.status !== 'failed' || !item.evidence_ref) {
    return null;
  }

  const gateIds = unique(item.gate_ids || []);
  const scopeHint = gateIds[0] || item.verifier || 'verification-failure';

  return {
    topic_id: `failed-evidence:${item.evidence_ref}`,
    kind: 'failed-evidence',
    topic_key: String(scopeHint),
    summary: `Verification evidence "${item.evidence_ref}" recorded a failed verifier outcome.`,
    scope_hint: String(scopeHint),
    artifact_paths: unique([item.artifact_path]),
    evidence_refs: [String(item.evidence_ref)],
    tags: unique(['verification-evidence', item.verifier, ...gateIds]),
  };
}

function buildQualityFeedbackTopics({
  generatedAt = new Date().toISOString(),
  aiDevQualityGateResult = null,
  verificationEvidence = null,
  gateArtifactPath = null,
} = {}) {
  const candidateTopics = [];

  for (const check of aiDevQualityGateResult && Array.isArray(aiDevQualityGateResult.checks)
    ? aiDevQualityGateResult.checks
    : []) {
    const topic = normalizeFailedCheckTopic(check);
    if (topic) candidateTopics.push(topic);
  }

  for (const item of verificationEvidence && Array.isArray(verificationEvidence.evidence_items)
    ? verificationEvidence.evidence_items
    : []) {
    const topic = normalizeFailedEvidenceTopic(item);
    if (topic) candidateTopics.push(topic);
  }

  return {
    schema_version: 'v1',
    generated_at: generatedAt,
    source: 'passive-quality-feedback',
    latest_gate: aiDevQualityGateResult
      ? {
        gate_id: aiDevQualityGateResult.gate_id || null,
        passed: typeof aiDevQualityGateResult.passed === 'boolean' ? aiDevQualityGateResult.passed : null,
        generated_at: aiDevQualityGateResult.generated_at || null,
        artifact_path: gateArtifactPath || aiDevQualityGateResult.artifact_path || null,
      }
      : null,
    candidate_topics: candidateTopics,
  };
}

module.exports = {
  buildQualityFeedbackTopics,
};
