#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ARTIFACT_CONTRACT_STATUSES = new Set(['candidate', 'confirmed', 'rejected', 'degraded']);
const DATA_SENSITIVITY_VALUES = new Set(['public', 'internal', 'confidential', 'restricted']);
const RUNTIME_MODES = new Set(['static_only', 'runtime_suggested', 'real_device_suggested']);

function validateArtifact(artifact, options = {}) {
  const errors = [];
  const requireCandidate = options.requireCandidate !== false;

  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    return {
      valid: false,
      errors: [error('artifact', 'artifact_not_object', 'Artifact must be a JSON object.')],
    };
  }

  requireString(artifact, 'schema_version', errors);
  requireString(artifact, 'artifact_id', errors);
  requireString(artifact, 'generated_at', errors);
  if (typeof artifact.generated_at === 'string' && Number.isNaN(Date.parse(artifact.generated_at))) {
    errors.push(error('generated_at', 'invalid_timestamp', 'generated_at must be an ISO-compatible timestamp.'));
  }

  if (!Array.isArray(artifact.source_inputs) || artifact.source_inputs.length === 0) {
    errors.push(error('source_inputs', 'source_inputs_required', 'source_inputs must be a non-empty array.'));
  } else {
    artifact.source_inputs.forEach((source, index) => validateSourceInput(source, index, errors));
  }

  if (!Array.isArray(artifact.consumers) || artifact.consumers.length === 0) {
    errors.push(error('consumers', 'consumers_required', 'consumers must be a non-empty array.'));
  } else if (artifact.consumers.some((consumer) => typeof consumer !== 'string' || consumer.length === 0)) {
    errors.push(error('consumers', 'invalid_consumer', 'consumers must contain non-empty strings.'));
  }

  if (!ARTIFACT_CONTRACT_STATUSES.has(artifact.contract_status)) {
    errors.push(error('contract_status', 'invalid_contract_status', 'contract_status is invalid.'));
  }
  if (requireCandidate && artifact.contract_status !== 'candidate') {
    errors.push(error('contract_status', 'script_artifact_must_be_candidate', 'Script-produced artifacts must stay candidate.'));
  }

  if (!DATA_SENSITIVITY_VALUES.has(artifact.data_sensitivity)) {
    errors.push(error('data_sensitivity', 'invalid_data_sensitivity', 'data_sensitivity is invalid.'));
  }

  if (artifact.artifact_id === 'preflight' || artifact.schema_version === 'spec-app-consistency-audit-preflight.v1') {
    validatePreflightArtifact(artifact, errors);
  }
  if (artifact.artifact_id === 'audit-report' || artifact.schema_version === 'spec-app-consistency-audit-report.v1') {
    validateAuditReportArtifact(artifact, errors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateSourceInput(source, index, errors) {
  const prefix = `source_inputs[${index}]`;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    errors.push(error(prefix, 'source_input_not_object', 'source input must be an object.'));
    return;
  }
  requireString(source, 'type', errors, prefix);
  if (typeof source.path !== 'string' || source.path.length === 0) {
    errors.push(error(`${prefix}.path`, 'source_path_required', 'source input path is required.'));
  }
  const hasHash = typeof source.source_hash === 'string' && /^sha256:[a-f0-9]{64}$/.test(source.source_hash);
  const hasReason = typeof source.source_hash_unavailable_reason === 'string'
    && source.source_hash_unavailable_reason.length > 0;
  if (!hasHash && !hasReason) {
    errors.push(error(
      `${prefix}.source_hash`,
      'source_hash_or_reason_required',
      'source input must include source_hash or source_hash_unavailable_reason.',
    ));
  }
  requireString(source, 'freshness', errors, prefix);
}

function validatePreflightArtifact(artifact, errors) {
  if (artifact.schema_version !== 'spec-app-consistency-audit-preflight.v1') {
    errors.push(error('schema_version', 'invalid_preflight_schema', 'preflight schema_version is invalid.'));
  }
  if (artifact.artifact_id !== 'preflight') {
    errors.push(error('artifact_id', 'invalid_preflight_artifact_id', 'preflight artifact_id must be preflight.'));
  }
  requireString(artifact, 'project_type', errors);
  if (!Array.isArray(artifact.platforms)) {
    errors.push(error('platforms', 'platforms_array_required', 'platforms must be an array.'));
  }
  if (!Array.isArray(artifact.architecture_candidates)) {
    errors.push(error('architecture_candidates', 'architecture_candidates_array_required', 'architecture_candidates must be an array.'));
  }
  for (const field of [
    'has_prd',
    'has_figma_context',
    'has_analytics',
    'has_i18n',
    'has_component_system',
    'has_modular_structure',
    'has_testability_signals',
    'has_local_cache_or_storage',
    'has_security_sensitive_surfaces',
    'requires_device_by_default',
  ]) {
    if (typeof artifact[field] !== 'boolean') {
      errors.push(error(field, 'boolean_required', `${field} must be boolean.`));
    }
  }
  if (!RUNTIME_MODES.has(artifact.default_runtime_mode)) {
    errors.push(error('default_runtime_mode', 'invalid_runtime_mode', 'default_runtime_mode is invalid.'));
  }
  if (!Array.isArray(artifact.degraded_modes)) {
    errors.push(error('degraded_modes', 'degraded_modes_array_required', 'degraded_modes must be an array.'));
  } else {
    artifact.degraded_modes.forEach((mode, index) => {
      const prefix = `degraded_modes[${index}]`;
      if (!mode || typeof mode !== 'object' || Array.isArray(mode)) {
        errors.push(error(prefix, 'degraded_mode_not_object', 'degraded mode must be an object.'));
        return;
      }
      requireString(mode, 'code', errors, prefix);
      requireString(mode, 'severity', errors, prefix);
      requireString(mode, 'summary', errors, prefix);
    });
  }
}

function validateAuditReportArtifact(artifact, errors) {
  if (artifact.schema_version !== 'spec-app-consistency-audit-report.v1') {
    errors.push(error('schema_version', 'invalid_audit_report_schema', 'audit report schema_version is invalid.'));
  }
  if (artifact.artifact_id !== 'audit-report') {
    errors.push(error('artifact_id', 'invalid_audit_report_artifact_id', 'audit report artifact_id must be audit-report.'));
  }
  if (!artifact.summary || typeof artifact.summary !== 'object' || Array.isArray(artifact.summary)) {
    errors.push(error('summary', 'summary_object_required', 'audit report summary must be an object.'));
  }
  if (!Array.isArray(artifact.issues)) {
    errors.push(error('issues', 'issues_array_required', 'audit report issues must be an array.'));
  } else {
    artifact.issues.forEach((issue, index) => validateAuditIssue(issue, index, errors));
  }
  if (!Array.isArray(artifact.scope_and_degraded_modes)) {
    errors.push(error('scope_and_degraded_modes', 'scope_degraded_modes_required', 'audit report must expose scope_and_degraded_modes.'));
  }
}

function validateAuditIssue(issue, index, errors) {
  const prefix = `issues[${index}]`;
  if (!issue || typeof issue !== 'object' || Array.isArray(issue)) {
    errors.push(error(prefix, 'issue_not_object', 'audit report issue must be an object.'));
    return;
  }
  for (const field of ['id', 'title', 'severity', 'category', 'expert', 'contract_status', 'confidence', 'impact', 'recommendation', 'data_sensitivity']) {
    requireString(issue, field, errors, prefix);
  }
  for (const field of ['static_confirmed', 'requires_runtime_verification', 'requires_real_device']) {
    if (typeof issue[field] !== 'boolean') {
      errors.push(error(`${prefix}.${field}`, 'boolean_required', `${prefix}.${field} must be boolean.`));
    }
  }
  if (!Array.isArray(issue.provenance) || issue.provenance.length === 0) {
    errors.push(error(`${prefix}.provenance`, 'provenance_required', 'audit report issue must include non-empty provenance.'));
  }
  if (!hasIssueEvidence(issue.evidence)) {
    errors.push(error(`${prefix}.evidence`, 'evidence_required', 'audit report issue must include non-empty evidence.'));
  }
  if (!Array.isArray(issue.related_rule_packs)) {
    errors.push(error(`${prefix}.related_rule_packs`, 'related_rule_packs_array_required', 'related_rule_packs must be an array.'));
  }
  if (!issue.runtime_verification || typeof issue.runtime_verification !== 'object' || Array.isArray(issue.runtime_verification)) {
    errors.push(error(`${prefix}.runtime_verification`, 'runtime_verification_required', 'runtime_verification must be an object.'));
  }
}

function hasIssueEvidence(evidence) {
  if (Array.isArray(evidence)) return evidence.length > 0;
  if (!evidence || typeof evidence !== 'object') return false;
  return Object.values(evidence).some((value) => Array.isArray(value) && value.length > 0);
}

function validateArtifactFile(filePath, options = {}) {
  const absolutePath = path.resolve(filePath);
  const artifact = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  return {
    file: absolutePath,
    ...validateArtifact(artifact, options),
  };
}

function requireString(object, field, errors, prefix = '') {
  const key = prefix ? `${prefix}.${field}` : field;
  if (typeof object[field] !== 'string' || object[field].length === 0) {
    errors.push(error(key, 'string_required', `${key} must be a non-empty string.`));
  }
}

function error(pathExpression, code, message) {
  return { path: pathExpression, code, message };
}

function parseArgs(argv) {
  const options = { files: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--file') options.files.push(argv[++index]);
    else if (arg === '--allow-confirmed') options.requireCandidate = false;
    else if (!arg.startsWith('--')) options.files.push(arg);
  }
  return options;
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.files.length === 0) throw new Error('Usage: validate-artifacts.js <artifact.json> [...]');
    const results = options.files.map((filePath) => validateArtifactFile(filePath, options));
    const valid = results.every((result) => result.valid);
    process.stdout.write(`${JSON.stringify({ valid, results }, null, 2)}\n`);
    if (!valid) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  validateArtifact,
  validateArtifactFile,
  validateAuditReportArtifact,
  validatePreflightArtifact,
};
