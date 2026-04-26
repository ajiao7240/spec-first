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

function buildQualityFeedbackTopics({
  generatedAt = new Date().toISOString(),
  aiDevQualityGateResult = null,
  gateArtifactPath = null,
} = {}) {
  const candidateTopics = [];
  for (const check of aiDevQualityGateResult && Array.isArray(aiDevQualityGateResult.checks)
    ? aiDevQualityGateResult.checks
    : []) {
    const topic = normalizeFailedCheckTopic(check);
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
