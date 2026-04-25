'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { normalizeStage, resolveProfile } = require('./profiles');

function stageFromWorkflow(workflow) {
  if (typeof workflow !== 'string') return 'unknown';
  if (workflow === 'spec-code-review') return 'review';
  return normalizeStage(workflow.replace(/^spec-/, ''));
}

function buildTelemetryRecord({
  workflow,
  slug,
  evaluation,
  freshnessStatus,
  generatedAt = new Date().toISOString(),
} = {}) {
  const stage = evaluation.stage || stageFromWorkflow(workflow);
  return {
    schema_version: 'v1',
    generated_at: generatedAt,
    workflow,
    slug,
    mode: evaluation.mode || 'single-repo',
    workspace_slug: evaluation.workspace_slug || null,
    matched_child_slugs: evaluation.matched_child_slugs || [],
    selected_context_count: evaluation.selected_context_count || 0,
    stage,
    profile: evaluation.profile || resolveProfile(stage),
    level: evaluation.level || null,
    selected_assets: evaluation.selected_assets || [],
    skipped_rules: evaluation.skipped_rules || [],
    fallback_reason: evaluation.fallback_reason || null,
    freshness_status: freshnessStatus || evaluation.freshness_status || 'unknown',
    verification_summary: evaluation.verification_summary || null,
    verifier_dispatch: evaluation.verifier_dispatch || null,
    ai_dev_quality_gate_result: evaluation.ai_dev_quality_gate_result || null,
    verification_evidence: evaluation.verification_evidence || null,
    verification_gate_state: evaluation.verification_gate_state || null,
  };
}

function recordWorkflowTelemetry({
  repoRoot,
  workflow,
  slug,
  evaluation,
  freshnessStatus,
  generatedAt = new Date().toISOString(),
  artifactAnchorRoot = repoRoot,
} = {}) {
  const record = buildTelemetryRecord({
    workflow,
    slug,
    evaluation,
    freshnessStatus,
    generatedAt,
  });
  const telemetrySlug = record.mode.startsWith('workspace')
    ? (record.workspace_slug || slug)
    : slug;
  const dir = path.join(artifactAnchorRoot, '.spec-first', 'workflows', workflow, telemetrySlug);
  const filePath = path.join(dir, `${generatedAt.replace(/[:.]/g, '-')}.json`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
    return { filePath, record };
  } catch (err) {
    process.stderr.write(`[spec-first] telemetry write failed: ${err.message}\n`);
    return { filePath: null, record };
  }
}

module.exports = {
  buildTelemetryRecord,
  recordWorkflowTelemetry,
};
