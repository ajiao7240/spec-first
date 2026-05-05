#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RESULT_SCHEMA = 'spec-first.standards-validation-result.v1';
const DEFAULT_ALLOWED_STATUSES = [
  'confirmed',
  'imported',
  'observed',
  'suggested',
  'conflict',
  'unknown',
  'deprecated',
  'drifted',
];
const DEFAULT_ALLOWED_SOURCE_TYPES = [
  'user_input',
  'repo_profile_confirmed',
  'shared_standard_imported',
  'graph_observed',
  'code_observed',
  'config_observed',
  'docs_observed',
  'llm_suggested',
];
const DEFAULT_REQUIRED_FIELDS = [
  'id',
  'domain',
  'type',
  'status',
  'confidence',
  'rule_candidate',
  'source_type',
  'evidence',
  'suggested_action',
  'downstream_usage',
];
const CONSUMPTION_MODES = {
  confirmed: 'hard',
  imported: 'advisory',
  observed: 'advisory',
  suggested: 'advisory',
  conflict: 'risk',
  unknown: 'question',
  deprecated: 'risk',
  drifted: 'risk',
};
const VALID_CONFIRMATION_TYPES = new Set(['user_input', 'human_confirmed']);

function parseArgs(argv) {
  const args = {
    standardsDir: null,
    candidates: null,
    preview: null,
    plan: null,
    projectShape: null,
    glueMap: null,
    patch: null,
    confirmations: null,
    json: false,
    allowFallbackVocabulary: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--standards-dir') {
      args.standardsDir = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--candidates') {
      args.candidates = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--preview') {
      args.preview = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--plan') {
      args.plan = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--project-shape') {
      args.projectShape = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--glue-map') {
      args.glueMap = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--patch') {
      args.patch = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--confirmations') {
      args.confirmations = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (arg === '--allow-fallback-vocabulary') {
      args.allowFallbackVocabulary = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    throw usageError(`Unknown argument: ${arg}`);
  }

  if (args.help) return args;

  if (!args.standardsDir && (!args.candidates || !args.preview)) {
    throw usageError('Either --standards-dir or both --candidates and --preview are required.');
  }
  if (args.standardsDir && (args.candidates || args.preview || args.plan || args.projectShape || args.glueMap)) {
    throw usageError('--standards-dir cannot be combined with explicit artifact paths.');
  }

  return args;
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw usageError(`${flag} requires a value.`);
  }
  return value;
}

function usageError(message) {
  const error = new Error(message);
  error.exitCode = 2;
  return error;
}

function resolveInputs(args, cwd = process.cwd()) {
  if (args.standardsDir) {
    const standardsDir = path.resolve(cwd, args.standardsDir);
    return {
      standardsDir,
      candidates: path.join(standardsDir, 'standards-candidates.json'),
      preview: path.join(standardsDir, 'standards-preview.md'),
      plan: path.join(standardsDir, 'standards-plan.json'),
      projectShape: path.join(standardsDir, 'project-shape.json'),
      glueMap: path.join(standardsDir, 'glue-map.json'),
      patch: args.patch ? path.resolve(cwd, args.patch) : path.join(standardsDir, 'repo-profile.patch.yaml'),
      confirmations: args.confirmations ? path.resolve(cwd, args.confirmations) : path.join(standardsDir, 'confirmations.json'),
    };
  }

  const candidates = path.resolve(cwd, args.candidates);
  const preview = path.resolve(cwd, args.preview);
  const standardsDir = path.dirname(candidates);
  return {
    standardsDir,
    candidates,
    preview,
    plan: args.plan ? path.resolve(cwd, args.plan) : path.join(standardsDir, 'standards-plan.json'),
    projectShape: args.projectShape ? path.resolve(cwd, args.projectShape) : path.join(standardsDir, 'project-shape.json'),
    glueMap: args.glueMap ? path.resolve(cwd, args.glueMap) : path.join(standardsDir, 'glue-map.json'),
    patch: args.patch ? path.resolve(cwd, args.patch) : path.join(standardsDir, 'repo-profile.patch.yaml'),
    confirmations: args.confirmations ? path.resolve(cwd, args.confirmations) : path.join(standardsDir, 'confirmations.json'),
  };
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      printHelp();
      process.exit(0);
    }
    const result = validateArtifacts(args);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status === 'fail') {
      process.exit(1);
    }
    process.exit(result.trust_level === 'degraded' ? 4 : 0);
  } catch (error) {
    if (error.exitCode === 2) {
      process.stderr.write(`${error.message}\n`);
      process.exit(2);
    }
    process.stderr.write(`${error.message}\n`);
    process.exit(3);
  }
}

function printHelp() {
  process.stdout.write(`Usage:
  node skills/spec-standards/scripts/validate-artifacts.js --standards-dir .spec-first/standards --json
  node skills/spec-standards/scripts/validate-artifacts.js --candidates <path> --preview <path> --plan <path> --json

Validate generated spec-standards candidates and preview artifacts. This checks artifact contracts only; it does not judge standards semantics.
Optional --patch and --confirmations may point to external non-LLM-authored attestation files.
`);
}

function validateArtifacts(args, cwd = process.cwd()) {
  const inputs = resolveInputs(args, cwd);
  const result = {
    schema_version: RESULT_SCHEMA,
    status: 'pass',
    trust_level: 'trusted',
    checked: {
      candidates: relativePath(cwd, inputs.candidates),
      preview: relativePath(cwd, inputs.preview),
      plan: relativePath(cwd, inputs.plan),
      project_shape: fs.existsSync(inputs.projectShape) ? relativePath(cwd, inputs.projectShape) : null,
      glue_map: fs.existsSync(inputs.glueMap) ? relativePath(cwd, inputs.glueMap) : null,
      patch: fs.existsSync(inputs.patch) ? relativePath(cwd, inputs.patch) : null,
      confirmations: fs.existsSync(inputs.confirmations) ? relativePath(cwd, inputs.confirmations) : null,
    },
    errors: [],
    warnings: [],
  };

  const plan = readPlan(inputs.plan, args, result);
  const contract = buildContract(plan);
  validateConsumptionMapping(contract, result);

  const candidatesDoc = readJsonArtifact(inputs.candidates, result);
  const preview = readTextArtifact(inputs.preview, result);
  if (!candidatesDoc || preview === null) {
    return finalize(result);
  }

  const patchIds = readPatchConfirmedCandidateIds(inputs.patch, result);
  const confirmationIds = readConfirmationIds(inputs.confirmations, result);
  const context = {
    contract,
    patchIds,
    confirmationIds,
  };

  validateCandidates(candidatesDoc, context, result);
  validatePreview(preview, candidatesDoc, inputs, result);
  validatePatch(patchIds, candidatesDoc, result);
  return finalize(result);
}

function readPlan(planPath, args, result) {
  if (fs.existsSync(planPath)) {
    return readJsonArtifact(planPath, result);
  }
  if (!args.allowFallbackVocabulary) {
    addIssue(result.errors, 'missing-standards-plan', planPath, 'standards-plan.json is required for trusted validation.');
    return null;
  }
  result.trust_level = 'degraded';
  addIssue(result.warnings, 'missing-standards-plan', planPath, 'Fallback vocabulary was used; result is not a trusted baseline.');
  return null;
}

function buildContract(plan) {
  const synthesisContract = plan && plan.synthesis_contract ? plan.synthesis_contract : {};
  return {
    allowedStatuses: arrayOrDefault(synthesisContract.allowed_statuses, DEFAULT_ALLOWED_STATUSES),
    allowedSourceTypes: arrayOrDefault(synthesisContract.allowed_source_types, DEFAULT_ALLOWED_SOURCE_TYPES),
    candidateRequiredFields: arrayOrDefault(synthesisContract.candidate_required_fields, DEFAULT_REQUIRED_FIELDS),
    consumptionModes: { ...CONSUMPTION_MODES },
  };
}

function validateConsumptionMapping(contract, result) {
  for (const status of contract.allowedStatuses) {
    if (!contract.consumptionModes[status]) {
      addIssue(result.errors, 'invalid-candidate-status', 'standards-plan.json', `Allowed status is missing an explicit consumption mapping: ${status}`);
    }
  }
}

function arrayOrDefault(value, fallback) {
  return Array.isArray(value) && value.length > 0 ? value : fallback;
}

function readJsonArtifact(filePath, result) {
  if (!fs.existsSync(filePath)) {
    addIssue(result.errors, 'file-not-found', filePath, 'Required artifact was not found.');
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    addIssue(result.errors, 'invalid-json', filePath, error.message);
    return null;
  }
}

function readTextArtifact(filePath, result) {
  if (!fs.existsSync(filePath)) {
    addIssue(result.errors, 'file-not-found', filePath, 'Required artifact was not found.');
    return null;
  }
  return fs.readFileSync(filePath, 'utf8');
}

function readPatchConfirmedCandidateIds(filePath, result) {
  if (!fs.existsSync(filePath)) return new Set();
  const text = fs.readFileSync(filePath, 'utf8');
  const ids = new Set();
  let hasConfirmedCandidateIds = false;
  let inConfirmedList = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*confirmed_candidate_ids\s*:\s*$/.test(line)) {
      hasConfirmedCandidateIds = true;
      inConfirmedList = true;
      continue;
    }
    if (inConfirmedList) {
      const item = line.match(/^\s*-\s*['"]?([^'"\s]+)['"]?\s*$/);
      if (item) {
        ids.add(item[1]);
        continue;
      }
      if (/^\S/.test(line)) {
        inConfirmedList = false;
      }
    }
    const inline = line.match(/confirmed_candidate_ids\s*:\s*\[([^\]]*)\]/);
    if (inline) {
      hasConfirmedCandidateIds = true;
      for (const rawId of inline[1].split(',')) {
        const id = rawId.trim().replace(/^['"]|['"]$/g, '');
        if (id) ids.add(id);
      }
    }
  }
  if (!hasConfirmedCandidateIds || ids.size === 0) {
    addIssue(result.errors, 'patch-missing-confirmed-candidate-ids', filePath, 'Patch file exists but lacks non-empty confirmed_candidate_ids; writeback safety cannot be verified.');
  }
  return ids;
}

function readConfirmationIds(filePath, result) {
  if (!fs.existsSync(filePath)) return new Set();
  const doc = readJsonArtifact(filePath, result);
  if (!doc) return new Set();
  const ids = new Set();
  for (const id of doc.confirmed_candidate_ids || []) {
    ids.add(String(id));
  }
  for (const confirmation of doc.confirmations || []) {
    const id = confirmation.candidate_id || confirmation.id;
    if (id) ids.add(String(id));
  }
  return ids;
}

function validateCandidates(doc, context, result) {
  if (!Array.isArray(doc.candidates)) {
    addIssue(result.errors, 'missing-required-field', 'standards-candidates.json', 'Top-level candidates[] is required.', { field: 'candidates' });
    return;
  }
  if (!doc.status_counts || typeof doc.status_counts !== 'object' || Array.isArray(doc.status_counts)) {
    addIssue(result.errors, 'missing-required-field', 'standards-candidates.json', 'Top-level status_counts is required.', { field: 'status_counts' });
  }
  if (!Array.isArray(doc.conflicts)) {
    addIssue(result.errors, 'missing-required-field', 'standards-candidates.json', 'Top-level conflicts[] is required.', { field: 'conflicts' });
  }
  if (!Array.isArray(doc.unknowns)) {
    addIssue(result.errors, 'missing-required-field', 'standards-candidates.json', 'Top-level unknowns[] is required.', { field: 'unknowns' });
  }

  const candidateById = new Map();
  const seenCandidateIds = new Set();
  const actualCounts = {};
  for (const candidate of doc.candidates) {
    if (candidate && candidate.id) {
      const candidateId = String(candidate.id);
      if (seenCandidateIds.has(candidateId)) {
        addIssue(result.errors, 'duplicate-candidate-id', 'standards-candidates.json', 'Candidate id must be unique because downstream references and writeback safety use it as a stable key.', {
          candidate_id: candidateId,
        });
      } else {
        seenCandidateIds.add(candidateId);
      }
      candidateById.set(candidateId, candidate);
    }
    validateCandidate(candidate, context, result);
    if (candidate && candidate.status) {
      actualCounts[candidate.status] = (actualCounts[candidate.status] || 0) + 1;
    }
  }

  validateStatusCounts(doc.status_counts || {}, actualCounts, result);
  validateReferenceList(doc.conflicts || [], candidateById, 'conflict', 'conflict-reference-mismatch', result);
  validateReferenceList(doc.unknowns || [], candidateById, 'unknown', 'unknown-reference-mismatch', result);
  validateRequiredReferenceForStatus(doc.candidates, collectRefs(doc.conflicts || []), 'conflict', 'conflict-reference-mismatch', result);
  validateRequiredReferenceForStatus(doc.candidates, collectRefs(doc.unknowns || []), 'unknown', 'unknown-reference-mismatch', result);
}

function validateCandidate(candidate, context, result) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    addIssue(result.errors, 'missing-required-field', 'standards-candidates.json', 'Candidate must be an object.');
    return;
  }
  const candidateId = candidate.id || '<missing-id>';

  for (const field of context.contract.candidateRequiredFields) {
    if (!(field in candidate)) {
      addIssue(result.errors, 'missing-required-field', 'standards-candidates.json', `Candidate is missing required field: ${field}`, {
        candidate_id: candidateId,
        field,
      });
    }
  }

  if (!context.contract.allowedStatuses.includes(candidate.status)) {
    addIssue(result.errors, 'invalid-candidate-status', 'standards-candidates.json', `Invalid candidate status: ${candidate.status}`, {
      candidate_id: candidateId,
      status: candidate.status,
    });
  }
  if (!context.contract.allowedSourceTypes.includes(candidate.source_type)) {
    addIssue(result.errors, 'invalid-source-type', 'standards-candidates.json', `Invalid candidate source_type: ${candidate.source_type}`, {
      candidate_id: candidateId,
      source_type: candidate.source_type,
    });
  }

  if ('evidence' in candidate) {
    validateEvidence(candidate, result);
  }
  validateStatusSupport(candidate, context, result);
}

function validateEvidence(candidate, result) {
  const evidence = candidate.evidence;
  if (!Array.isArray(evidence) || evidence.length === 0) {
    if (candidate.status === 'observed') {
      addIssue(result.errors, 'empty-evidence', 'standards-candidates.json', 'Observed candidate evidence is empty.', {
        candidate_id: candidate.id,
      });
    }
    return;
  }
  for (const item of evidence) {
    if (typeof item === 'string') {
      if (item.trim().length < 8) {
        addIssue(result.errors, 'invalid-evidence-shape', 'standards-candidates.json', 'Evidence string is too short or empty.', {
          candidate_id: candidate.id,
        });
      }
      continue;
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const source = typeof item.source === 'string' ? item.source.trim() : '';
      const quote = typeof item.quote === 'string' ? item.quote.trim() : '';
      const pathValue = typeof item.path === 'string' ? item.path.trim() : '';
      const reason = typeof item.reason === 'string' ? item.reason.trim() : '';
      if ((source && quote) || (pathValue && (reason || source))) {
        continue;
      }
    }
    addIssue(result.errors, 'invalid-evidence-shape', 'standards-candidates.json', 'Evidence item must be a meaningful string or an object with source/quote or path/reason.', {
      candidate_id: candidate.id,
    });
  }
}

function validateStatusSupport(candidate, context, result) {
  const status = candidate.status;
  if (status === 'confirmed') {
    validateConfirmedCandidate(candidate, context, result);
    return;
  }
  if (status === 'observed') {
    if (!('evidence' in candidate)) {
      addIssue(result.errors, 'missing-support', 'standards-candidates.json', 'Observed candidate requires evidence.', {
        candidate_id: candidate.id,
      });
    }
    return;
  }
  if (status === 'imported') {
    if (!hasImportedSource(candidate)) {
      addIssue(result.errors, 'missing-source', 'standards-candidates.json', 'Imported candidate requires a source document reference.', {
        candidate_id: candidate.id,
      });
    }
    return;
  }
  if (status === 'suggested') {
    if (!hasText(candidate.rationale)) {
      addIssue(result.errors, 'missing-rationale', 'standards-candidates.json', 'Suggested candidate requires rationale.', {
        candidate_id: candidate.id,
      });
    }
    return;
  }
  if (status === 'conflict') {
    if (!nonEmptyArray(candidate.conflict_refs) && !nonEmptyArray(candidate.conflicting_evidence)) {
      addIssue(result.errors, 'missing-conflict-reference', 'standards-candidates.json', 'Conflict candidate requires conflict references.', {
        candidate_id: candidate.id,
      });
    }
    return;
  }
  if (status === 'unknown') {
    if (!hasText(candidate.question) && !hasText(candidate.reason) && !hasText(candidate.missing_evidence)) {
      addIssue(result.errors, 'missing-unknown-question', 'standards-candidates.json', 'Unknown candidate requires question, reason, or missing_evidence.', {
        candidate_id: candidate.id,
      });
    }
  }
}

function validateConfirmedCandidate(candidate, context, result) {
  if (candidate.source_type === 'repo_profile_confirmed' || candidate.source_type === 'user_input') {
    return;
  }

  const confirmationType = candidate.confirmation && candidate.confirmation.type;
  if (VALID_CONFIRMATION_TYPES.has(confirmationType)) {
    if (!context.patchIds.has(candidate.id) && !context.confirmationIds.has(candidate.id)) {
      addIssue(result.errors, 'confirmation-not-externally-attested', 'standards-candidates.json', 'Confirmed candidate relies on confirmation.type but lacks external attestation.', {
        candidate_id: candidate.id,
      });
    }
    return;
  }

  if (candidate.source_type === 'shared_standard_imported') {
    addIssue(result.errors, 'unsafe-confirmed-without-confirmation', 'standards-candidates.json', 'Imported candidate cannot become confirmed without explicit confirmation.', {
      candidate_id: candidate.id,
    });
    return;
  }

  addIssue(result.errors, 'unsafe-confirmed-source', 'standards-candidates.json', 'Observed or suggested evidence cannot directly create confirmed status.', {
    candidate_id: candidate.id,
  });
}

function hasImportedSource(candidate) {
  return hasText(candidate.source_document)
    || hasText(candidate.source_path)
    || hasText(candidate.imported_standard_id)
    || hasText(candidate.source_id)
    || (candidate.source && typeof candidate.source === 'object' && (hasText(candidate.source.path) || hasText(candidate.source.document)));
}

function validateStatusCounts(expectedCounts, actualCounts, result) {
  const statuses = new Set([...Object.keys(expectedCounts || {}), ...Object.keys(actualCounts)]);
  for (const status of statuses) {
    const expected = Number(expectedCounts[status] || 0);
    const actual = Number(actualCounts[status] || 0);
    if (expected !== actual) {
      addIssue(result.errors, 'status-count-mismatch', 'standards-candidates.json', `status_counts.${status} expected ${expected} but actual count is ${actual}.`, {
        status,
        expected,
        actual,
      });
    }
  }
}

function validateReferenceList(list, candidateById, expectedStatus, reasonCode, result) {
  for (const ref of collectRefs(list)) {
    const candidate = candidateById.get(ref);
    if (!candidate || candidate.status !== expectedStatus) {
      addIssue(result.errors, reasonCode, 'standards-candidates.json', `Reference does not point to a ${expectedStatus} candidate: ${ref}`, {
        candidate_id: ref,
      });
    }
  }
}

function validateRequiredReferenceForStatus(candidates, refs, status, reasonCode, result) {
  for (const candidate of candidates || []) {
    if (candidate && candidate.status === status && !refs.has(candidate.id)) {
      addIssue(result.errors, reasonCode, 'standards-candidates.json', `${status} candidate is not listed in top-level ${status === 'conflict' ? 'conflicts' : 'unknowns'}[].`, {
        candidate_id: candidate.id,
      });
    }
  }
}

function collectRefs(list) {
  const refs = new Set();
  for (const item of list) {
    if (typeof item === 'string') {
      refs.add(item);
      continue;
    }
    if (item && typeof item === 'object') {
      const id = item.candidate_id || item.id || item.ref || item.candidate;
      if (id) refs.add(String(id));
    }
  }
  return refs;
}

function validatePatch(patchIds, candidatesDoc, result) {
  if (patchIds.size === 0 || !Array.isArray(candidatesDoc.candidates)) return;
  const byId = new Map(candidatesDoc.candidates.map((candidate) => [candidate.id, candidate]));
  for (const id of patchIds) {
    const candidate = byId.get(id);
    if (!candidate || candidate.status !== 'confirmed') {
      addIssue(result.errors, 'patch-references-non-confirmed-candidate', 'repo-profile.patch.yaml', 'Patch references a candidate that is not confirmed.', {
        candidate_id: id,
      });
    }
  }
}

function validatePreview(preview, candidatesDoc, inputs, result) {
  const requiredSections = [
    ['Summary', headingPattern('Summary', '摘要')],
    ['Candidates By Status', headingPattern('Candidates By Status', '候选.*状态', '按状态.*候选')],
    ['Conflicts', headingPattern('Conflicts', '冲突')],
    ['Unknowns / Requires User Decision', headingPattern('Unknowns', 'Requires User Decision', '未知', '待决', '需要用户决策')],
    ['Downstream Consumption', headingPattern('Downstream Consumption', '下游.*消费', '下游.*消费.*摘要')],
    ['Writeback Status', headingPattern('Writeback Status', '写回.*状态')],
  ];
  const conditionalSections = [];
  if (fs.existsSync(inputs.projectShape)) {
    conditionalSections.push(
      ['Detected Project Mode', headingPattern('Detected Project Mode', '项目模式')],
      ['Detected Project Shape', headingPattern('Detected Project Shape', '项目形态')],
    );
  }
  if (fs.existsSync(inputs.plan)) {
    conditionalSections.push(['Artifact Plan', headingPattern('Artifact Plan', '产物计划')]);
  }
  const hasCandidateEvidence = (candidatesDoc.candidates || []).some((candidate) => (
    Array.isArray(candidate.evidence) && candidate.evidence.length > 0
  ));
  if (fs.existsSync(path.join(path.dirname(inputs.candidates), 'graph-query-index.json')) || hasCandidateEvidence) {
    conditionalSections.push(['Evidence Quality', headingPattern('Evidence Quality', 'Graph-Backed', '证据质量', '图谱证据')]);
  }
  if (fs.existsSync(inputs.glueMap)) {
    conditionalSections.push(['Glue Capability Map Summary', headingPattern('Glue Capability Map Summary', 'Glue.*Summary', '胶水.*摘要', '能力.*摘要')]);
  }

  for (const [section, pattern] of [...requiredSections, ...conditionalSections]) {
    if (!pattern.test(preview)) {
      const reasonCode = section === 'Writeback Status'
        ? 'preview-missing-writeback-status'
        : 'preview-missing-section';
      addIssue(result.errors, reasonCode, 'standards-preview.md', `Preview is missing section: ${section}`, { section });
    }
  }

  if (!/repo-profile\.yaml/i.test(preview) || !/(not modified|was not modified|未被修改|未修改)/i.test(preview)) {
    addIssue(result.errors, 'preview-missing-repo-profile-unchanged-statement', 'standards-preview.md', 'Preview must state repo-profile.yaml was not modified.');
  }

  const counts = candidatesDoc.status_counts || {};
  validatePreviewVisibility(preview, candidatesDoc, counts, 'conflict', 'preview-hides-conflict', result);
  validatePreviewVisibility(preview, candidatesDoc, counts, 'unknown', 'preview-hides-unknown', result);
  validatePreviewCount(preview, counts, 'conflict', result);
  validatePreviewCount(preview, counts, 'unknown', result);
}

function headingPattern(...alternatives) {
  return new RegExp(`(^|\\n)#{1,4}\\s*(\\d+\\.\\s*)?(${alternatives.join('|')})(?=\\s|$|[:：])`, 'iu');
}

function validatePreviewVisibility(preview, candidatesDoc, counts, status, reasonCode, result) {
  const count = Number(counts[status] || 0);
  if (count <= 0) return;
  const matchingCandidates = (candidatesDoc.candidates || []).filter((candidate) => candidate.status === status);
  const hasId = matchingCandidates.some((candidate) => candidate.id && preview.includes(candidate.id));
  const hasCount = findPreviewCounts(preview, status).includes(count);
  if (!hasId && !hasCount) {
    addIssue(result.errors, reasonCode, 'standards-preview.md', `Preview hides ${status} candidates.`, {
      status,
      expected_count: count,
    });
  }
}

function validatePreviewCount(preview, counts, status, result) {
  const actual = Number(counts[status] || 0);
  const previewCounts = findPreviewCounts(preview, status);
  const mismatchedCount = previewCounts.find((previewCount) => previewCount !== actual);
  if (mismatchedCount !== undefined) {
    addIssue(result.errors, 'preview-count-mismatch', 'standards-preview.md', `Preview count for ${status} does not match status_counts.`, {
      status,
      expected: actual,
      preview_count: mismatchedCount,
    });
  }
}

function findPreviewCounts(preview, status) {
  const labels = status === 'conflict'
    ? ['conflicts?', '冲突']
    : ['unknowns?', '未知', '待决'];
  const counts = [];
  for (const label of labels) {
    const pattern = new RegExp(`${label}[^\\n\\d]{0,24}(\\d+)`, 'gi');
    let match = pattern.exec(preview);
    while (match) {
      counts.push(Number(match[1]));
      match = pattern.exec(preview);
    }
  }
  return counts;
}

function finalize(result) {
  if (result.errors.length > 0) {
    result.status = 'fail';
  }
  return result;
}

function addIssue(list, reasonCode, filePath, message, extra = {}) {
  list.push({
    reason_code: reasonCode,
    file: normalizePath(filePath),
    message,
    ...extra,
  });
}

function nonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizePath(filePath) {
  return String(filePath).replace(/\\/g, '/');
}

function relativePath(root, filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  validateArtifacts,
};
