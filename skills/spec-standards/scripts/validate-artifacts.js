#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RESULT_SCHEMA = 'spec-first.standards-validation-result.v1';
const STANDARDS_PLAN_SCHEMA = 'spec-first.standards-plan.v1';
const SYNTHESIS_CONTRACT_SCHEMA = 'spec-first.standards-synthesis-contract.v1';
const CANDIDATES_SCHEMA = 'spec-first.standards-candidates.v1';
const NEXT_ACTION_CANDIDATES_SCHEMA = 'spec-first.standards-next-action-candidates.v1';
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
const NEXT_ACTION_CANDIDATE_KINDS = new Set([
  'standards_baseline_ready',
  'missing_graph_readiness',
  'workspace_advisory_only',
  'absent_tests',
  'missing_package_scripts',
  'stale_validation',
  'child_repo_ambiguity',
]);
const NEXT_ACTION_AUTHORITY_LEVELS = new Set(['facts_only', 'advisory']);
const NEXT_ACTION_PROVENANCE = new Set(['script_confirmed', 'provider_untrusted', 'llm_asserted']);
const NEXT_ACTION_READINESS = new Set(['ready', 'degraded', 'missing', 'stale', 'unknown']);
const NEXT_ACTION_REDACTION = new Set(['none-required', 'redacted']);
const FORBIDDEN_NEXT_ACTION_DECISION_FIELDS = [
  'target_entrypoint',
  'recommended_entrypoint',
  'workflow_recommendation',
  'recommendation',
  'ranking',
  'rank',
  'score',
  'blocking_policy',
  'blocking',
  'mode_matrix',
];
const PUBLIC_ENTRYPOINTS = new Set([
  '/spec:brainstorm', '$spec-brainstorm',
  '/spec:plan', '$spec-plan',
  '/spec:work', '$spec-work',
  '/spec:code-review', '$spec-code-review',
  '/spec:doc-review', '$spec-doc-review',
  '/spec:graph-bootstrap', '$spec-graph-bootstrap',
  '/spec:mcp-setup', '$spec-mcp-setup',
  '/spec:standards', '$spec-standards',
]);
const NEXT_ACTION_ARTIFACT_NAMES = new Set([
  'project-shape.json',
  'standards-plan.json',
  'glue-map.json',
  'next-action-candidates.json',
]);

function parseArgs(argv) {
  const args = {
    standardsDir: null,
    candidates: null,
    preview: null,
    plan: null,
    projectShape: null,
    glueMap: null,
    nextActionCandidates: null,
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
    if (arg === '--next-action-candidates') {
      args.nextActionCandidates = requireValue(argv, index, arg);
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

  if (!args.standardsDir && !args.nextActionCandidates && (!args.candidates || !args.preview)) {
    throw usageError('Either --standards-dir, --next-action-candidates, or both --candidates and --preview are required.');
  }
  if (args.standardsDir && (args.candidates || args.preview || args.plan || args.projectShape || args.glueMap || args.nextActionCandidates)) {
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
      cwd,
      standardsDir,
      candidates: path.join(standardsDir, 'standards-candidates.json'),
      preview: path.join(standardsDir, 'standards-preview.md'),
      plan: path.join(standardsDir, 'standards-plan.json'),
      projectShape: path.join(standardsDir, 'project-shape.json'),
      glueMap: path.join(standardsDir, 'glue-map.json'),
      nextActionCandidates: path.join(standardsDir, 'next-action-candidates.json'),
      patch: args.patch ? path.resolve(cwd, args.patch) : path.join(standardsDir, 'repo-profile.patch.yaml'),
      confirmations: args.confirmations ? path.resolve(cwd, args.confirmations) : path.join(standardsDir, 'confirmations.json'),
    };
  }

  const nextActionCandidates = args.nextActionCandidates ? path.resolve(cwd, args.nextActionCandidates) : null;
  const candidates = args.candidates ? path.resolve(cwd, args.candidates) : null;
  const preview = args.preview ? path.resolve(cwd, args.preview) : null;
  const standardsDir = candidates ? path.dirname(candidates) : path.dirname(nextActionCandidates);
  return {
    cwd,
    standardsDir,
    candidates,
    preview,
    plan: args.plan ? path.resolve(cwd, args.plan) : path.join(standardsDir, 'standards-plan.json'),
    projectShape: args.projectShape ? path.resolve(cwd, args.projectShape) : path.join(standardsDir, 'project-shape.json'),
    glueMap: args.glueMap ? path.resolve(cwd, args.glueMap) : path.join(standardsDir, 'glue-map.json'),
    nextActionCandidates: nextActionCandidates || path.join(standardsDir, 'next-action-candidates.json'),
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
  node skills/spec-standards/scripts/validate-artifacts.js --next-action-candidates <path> --json

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
      candidates: inputs.candidates ? relativePath(cwd, inputs.candidates) : null,
      preview: inputs.preview ? relativePath(cwd, inputs.preview) : null,
      plan: inputs.plan ? relativePath(cwd, inputs.plan) : null,
      project_shape: inputs.projectShape && fs.existsSync(inputs.projectShape) ? relativePath(cwd, inputs.projectShape) : null,
      glue_map: inputs.glueMap && fs.existsSync(inputs.glueMap) ? relativePath(cwd, inputs.glueMap) : null,
      next_action_candidates: inputs.nextActionCandidates && fs.existsSync(inputs.nextActionCandidates) ? relativePath(cwd, inputs.nextActionCandidates) : null,
      patch: inputs.patch && fs.existsSync(inputs.patch) ? relativePath(cwd, inputs.patch) : null,
      confirmations: inputs.confirmations && fs.existsSync(inputs.confirmations) ? relativePath(cwd, inputs.confirmations) : null,
    },
    scope: null,
    consumption_boundary: 'trusted_baseline',
    errors: [],
    warnings: [],
  };

  if (args.nextActionCandidates && !fs.existsSync(inputs.nextActionCandidates)) {
    addIssue(result.errors, 'file-not-found', inputs.nextActionCandidates, 'Required artifact was not found.');
    return finalize(result);
  }
  if (inputs.nextActionCandidates && fs.existsSync(inputs.nextActionCandidates)) {
    const nextActionCandidates = readJsonArtifact(inputs.nextActionCandidates, result);
    validateNextActionCandidates(nextActionCandidates, inputs, result);
  }

  if (!inputs.candidates || !inputs.preview) {
    return finalize(result);
  }

  const plan = readPlan(inputs.plan, args, result);
  const contract = buildContract(plan);
  applyConsumptionBoundary(contract, result);
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
    const plan = readJsonArtifact(planPath, result);
    validatePlanContract(plan, result);
    return plan;
  }
  if (!args.allowFallbackVocabulary) {
    result.trust_level = 'degraded';
    addIssue(result.errors, 'missing-standards-plan', planPath, 'standards-plan.json is required for trusted validation.');
    return null;
  }
  result.trust_level = 'degraded';
  addIssue(result.warnings, 'missing-standards-plan', planPath, 'Fallback vocabulary was used; result is not a trusted baseline.');
  return null;
}

function validatePlanContract(plan, result) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    addPlanContractIssue(result, 'missing-required-field', 'Standards plan document must be an object.');
    return;
  }
  if (!('schema_version' in plan)) {
    addPlanContractIssue(result, 'missing-required-field', 'Top-level field is required: schema_version', {
      field: 'schema_version',
    });
  } else if (plan.schema_version !== STANDARDS_PLAN_SCHEMA) {
    addPlanContractIssue(result, 'invalid-schema-version', `schema_version must be ${STANDARDS_PLAN_SCHEMA}.`, {
      field: 'schema_version',
      expected: STANDARDS_PLAN_SCHEMA,
      actual: plan.schema_version,
    });
  }
  if ('scope' in plan && (!plan.scope || typeof plan.scope !== 'object' || Array.isArray(plan.scope) || !hasText(plan.scope.type))) {
    addPlanContractIssue(result, 'missing-required-field', 'scope.type must be a non-empty string when scope is present.', {
      field: 'scope.type',
    });
  }

  const synthesisContract = plan.synthesis_contract;
  if (!synthesisContract || typeof synthesisContract !== 'object' || Array.isArray(synthesisContract)) {
    addPlanContractIssue(result, 'missing-required-field', 'synthesis_contract object is required.', {
      field: 'synthesis_contract',
    });
    return;
  }
  if (!('schema_version' in synthesisContract)) {
    addPlanContractIssue(result, 'missing-required-field', 'synthesis_contract.schema_version is required.', {
      field: 'synthesis_contract.schema_version',
    });
  } else if (synthesisContract.schema_version !== SYNTHESIS_CONTRACT_SCHEMA) {
    addPlanContractIssue(result, 'invalid-schema-version', `synthesis_contract.schema_version must be ${SYNTHESIS_CONTRACT_SCHEMA}.`, {
      field: 'synthesis_contract.schema_version',
      expected: SYNTHESIS_CONTRACT_SCHEMA,
      actual: synthesisContract.schema_version,
    });
  }
  validateNonEmptyStringArray(synthesisContract, 'candidate_required_fields', result);
  validateNonEmptyStringArray(synthesisContract, 'allowed_statuses', result);
  validateNonEmptyStringArray(synthesisContract, 'allowed_source_types', result);
}

function validateNonEmptyStringArray(contract, field, result) {
  if (!(field in contract)) {
    addPlanContractIssue(result, 'missing-required-field', `synthesis_contract.${field} is required.`, {
      field: `synthesis_contract.${field}`,
    });
    return;
  }
  if (!Array.isArray(contract[field]) || contract[field].length === 0 || contract[field].some((item) => !hasText(item))) {
    addPlanContractIssue(result, 'missing-required-field', `synthesis_contract.${field} must be a non-empty string array.`, {
      field: `synthesis_contract.${field}`,
    });
  }
}

function addPlanContractIssue(result, reasonCode, message, extra = {}) {
  result.trust_level = 'degraded';
  addIssue(result.errors, reasonCode, 'standards-plan.json', message, extra);
}

function buildContract(plan) {
  const synthesisContract = plan && plan.synthesis_contract ? plan.synthesis_contract : {};
  const scope = plan && plan.scope && typeof plan.scope === 'object' && !Array.isArray(plan.scope)
    ? plan.scope
    : null;
  const workspacePolicy = synthesisContract.workspace_policy
    && typeof synthesisContract.workspace_policy === 'object'
    && !Array.isArray(synthesisContract.workspace_policy)
      ? synthesisContract.workspace_policy
      : { active: false, artifacts_are_advisory: false };
  return {
    allowedStatuses: arrayOrDefault(synthesisContract.allowed_statuses, DEFAULT_ALLOWED_STATUSES),
    allowedSourceTypes: arrayOrDefault(synthesisContract.allowed_source_types, DEFAULT_ALLOWED_SOURCE_TYPES),
    candidateRequiredFields: arrayOrDefault(synthesisContract.candidate_required_fields, DEFAULT_REQUIRED_FIELDS),
    consumptionModes: { ...CONSUMPTION_MODES },
    scope,
    workspacePolicy,
  };
}

function applyConsumptionBoundary(contract, result) {
  result.scope = contract.scope;
  const workspaceAdvisory = contract.workspacePolicy.active === true
    || contract.workspacePolicy.artifacts_are_advisory === true
    || (contract.scope && contract.scope.type === 'workspace');
  if (!workspaceAdvisory) return;

  result.trust_level = 'degraded';
  result.consumption_boundary = 'advisory_only';
  addIssue(
    result.warnings,
    'workspace-advisory-only',
    'standards-plan.json',
    'Workspace standards artifacts are advisory-only and must not be consumed as a trusted child repo standards baseline.',
  );
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
  if ('confirmed_candidate_ids' in doc) {
    if (!Array.isArray(doc.confirmed_candidate_ids)) {
      addIssue(result.errors, 'invalid-confirmations-shape', filePath, 'confirmed_candidate_ids must be an array.');
    } else {
      for (const id of doc.confirmed_candidate_ids) {
        ids.add(String(id));
      }
    }
  }
  if ('confirmations' in doc) {
    if (!Array.isArray(doc.confirmations)) {
      addIssue(result.errors, 'invalid-confirmations-shape', filePath, 'confirmations must be an array.');
    } else {
      for (const confirmation of doc.confirmations) {
        if (!confirmation || typeof confirmation !== 'object' || Array.isArray(confirmation)) {
          addIssue(result.errors, 'invalid-confirmations-shape', filePath, 'Each confirmation must be an object.');
          continue;
        }
        const id = confirmation.candidate_id || confirmation.id;
        if (id) ids.add(String(id));
      }
    }
  }
  return ids;
}

function validateCandidates(doc, context, result) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    addIssue(result.errors, 'missing-required-field', 'standards-candidates.json', 'Candidate document must be an object.');
    return;
  }
  validateCandidateDocumentContract(doc, result);
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

  validateCandidateDocumentScope(doc, context, result);
  validateStatusCounts(doc.status_counts || {}, actualCounts, result);
  validateReferenceList(doc.conflicts || [], candidateById, 'conflict', 'conflict-reference-mismatch', result);
  validateReferenceList(doc.unknowns || [], candidateById, 'unknown', 'unknown-reference-mismatch', result);
  validateRequiredReferenceForStatus(doc.candidates, collectRefs(doc.conflicts || []), 'conflict', 'conflict-reference-mismatch', result);
  validateRequiredReferenceForStatus(doc.candidates, collectRefs(doc.unknowns || []), 'unknown', 'unknown-reference-mismatch', result);
}

function validateCandidateDocumentContract(doc, result) {
  const requiredFields = [
    'schema_version',
    'generated_at',
    'scope',
    'source_artifacts',
    'candidates',
    'status_counts',
    'conflicts',
    'unknowns',
    'confirmation_policy',
  ];
  for (const field of requiredFields) {
    if (!(field in doc)) {
      addIssue(result.errors, 'missing-required-field', 'standards-candidates.json', `Top-level field is required: ${field}`, { field });
    }
  }
  if ('schema_version' in doc && doc.schema_version !== CANDIDATES_SCHEMA) {
    addIssue(result.errors, 'invalid-schema-version', 'standards-candidates.json', `schema_version must be ${CANDIDATES_SCHEMA}.`, {
      field: 'schema_version',
      expected: CANDIDATES_SCHEMA,
      actual: doc.schema_version,
    });
  }
  if ('generated_at' in doc && !hasText(doc.generated_at)) {
    addIssue(result.errors, 'missing-required-field', 'standards-candidates.json', 'generated_at must be a non-empty string.', { field: 'generated_at' });
  }
  if ('scope' in doc && (!doc.scope || typeof doc.scope !== 'object' || Array.isArray(doc.scope) || !hasText(doc.scope.type))) {
    addIssue(result.errors, 'missing-required-field', 'standards-candidates.json', 'scope.type is required.', { field: 'scope.type' });
  }
  if ('source_artifacts' in doc && !Array.isArray(doc.source_artifacts)) {
    addIssue(result.errors, 'missing-required-field', 'standards-candidates.json', 'source_artifacts[] is required.', { field: 'source_artifacts' });
  }
  if ('confirmation_policy' in doc && (!doc.confirmation_policy || typeof doc.confirmation_policy !== 'object' || Array.isArray(doc.confirmation_policy))) {
    addIssue(result.errors, 'missing-required-field', 'standards-candidates.json', 'confirmation_policy object is required.', { field: 'confirmation_policy' });
  }
}

function validateCandidateDocumentScope(doc, context, result) {
  const planScope = context.contract.scope;
  if (!planScope || !planScope.type || !doc.scope || !doc.scope.type) return;
  if (doc.scope.type !== planScope.type) {
    addIssue(result.errors, 'scope-mismatch', 'standards-candidates.json', `Candidate scope ${doc.scope.type} does not match standards-plan scope ${planScope.type}.`, {
      expected_scope: planScope.type,
      actual_scope: doc.scope.type,
    });
  }
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

function validateNextActionCandidates(doc, inputs, result) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    addIssue(result.errors, 'missing-required-field', 'next-action-candidates.json', 'Next-action candidates document must be an object.');
    return;
  }
  if (doc.schema_version !== NEXT_ACTION_CANDIDATES_SCHEMA) {
    addIssue(result.errors, 'invalid-next-action-schema-version', 'next-action-candidates.json', `schema_version must be ${NEXT_ACTION_CANDIDATES_SCHEMA}.`, {
      expected: NEXT_ACTION_CANDIDATES_SCHEMA,
      actual: doc.schema_version,
    });
  }
  if (doc.producer !== 'spec-standards.prepare-baseline') {
    addIssue(result.errors, 'invalid-next-action-producer', 'next-action-candidates.json', 'producer must be spec-standards.prepare-baseline.');
  }
  if (!doc.scope || typeof doc.scope !== 'object' || Array.isArray(doc.scope) || !hasText(doc.scope.type)) {
    addIssue(result.errors, 'missing-required-field', 'next-action-candidates.json', 'scope.type is required.');
  }
  validateForbiddenNextActionDecisionFields(doc, 'next-action-candidates.json', result);
  if (!Array.isArray(doc.candidates)) {
    addIssue(result.errors, 'missing-required-field', 'next-action-candidates.json', 'candidates[] is required.');
    return;
  }
  validateNextActionSourceArtifacts(doc.source_artifacts, inputs, result);
  const seen = new Set();
  for (const candidate of doc.candidates) {
    validateNextActionCandidate(candidate, seen, inputs, result);
  }
}

function validateNextActionSourceArtifacts(sourceArtifacts, inputs, result) {
  if (!Array.isArray(sourceArtifacts) || sourceArtifacts.length === 0) {
    addIssue(result.errors, 'invalid-next-action-source-artifacts', 'next-action-candidates.json', 'source_artifacts must be a non-empty array.');
    return;
  }
  for (const sourceArtifact of sourceArtifacts) {
    if (!isSafeStandardsArtifactPath(sourceArtifact, inputs)) {
      addIssue(result.errors, 'invalid-next-action-source-artifact', 'next-action-candidates.json', 'source_artifacts entries must match the actual standards artifact root.', {
        path: sourceArtifact,
      });
    }
  }
}

function validateNextActionCandidate(candidate, seen, inputs, result) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    addIssue(result.errors, 'invalid-next-action-candidate', 'next-action-candidates.json', 'Candidate must be an object.');
    return;
  }
  validateForbiddenNextActionDecisionFields(candidate, 'next-action-candidates.json', result);
  for (const field of [
    'candidate_id',
    'candidate_kind',
    'reason_code',
    'source_fact_refs',
    'evidence_paths',
    'possible_entrypoints',
    'target_repo_scope',
    'authority_level',
    'provenance_classification',
    'readiness_status',
    'redaction_status',
  ]) {
    if (!(field in candidate)) {
      addIssue(result.errors, 'missing-next-action-field', 'next-action-candidates.json', `Candidate is missing required field: ${field}`, { field });
    }
  }
  if (hasText(candidate.candidate_id)) {
    if (seen.has(candidate.candidate_id)) {
      addIssue(result.errors, 'duplicate-next-action-candidate-id', 'next-action-candidates.json', 'candidate_id must be unique.', {
        candidate_id: candidate.candidate_id,
      });
    }
    seen.add(candidate.candidate_id);
  }
  if (!NEXT_ACTION_CANDIDATE_KINDS.has(candidate.candidate_kind)) {
    addIssue(result.errors, 'invalid-next-action-kind', 'next-action-candidates.json', `Invalid candidate_kind: ${candidate.candidate_kind}`);
  }
  if (!NEXT_ACTION_AUTHORITY_LEVELS.has(candidate.authority_level)) {
    addIssue(result.errors, 'invalid-next-action-authority', 'next-action-candidates.json', `Invalid authority_level: ${candidate.authority_level}`);
  }
  if (!NEXT_ACTION_PROVENANCE.has(candidate.provenance_classification)) {
    addIssue(result.errors, 'invalid-next-action-provenance', 'next-action-candidates.json', `Invalid provenance_classification: ${candidate.provenance_classification}`);
  }
  if (!NEXT_ACTION_READINESS.has(candidate.readiness_status)) {
    addIssue(result.errors, 'invalid-next-action-readiness', 'next-action-candidates.json', `Invalid readiness_status: ${candidate.readiness_status}`);
  }
  if (!NEXT_ACTION_REDACTION.has(candidate.redaction_status)) {
    addIssue(result.errors, 'invalid-next-action-redaction', 'next-action-candidates.json', `Invalid redaction_status: ${candidate.redaction_status}`);
  }
  validateNextActionSourceFactRefs(candidate.source_fact_refs, inputs, result);
  validateNextActionEvidencePaths(candidate.evidence_paths, inputs, result);
  validateNextActionEntrypoints(candidate.possible_entrypoints, result);
}

function validateForbiddenNextActionDecisionFields(value, filePath, result) {
  scanForbiddenDecisionField(value, filePath, result, '', new WeakSet());
}

function scanForbiddenDecisionField(value, filePath, result, pointer, seen) {
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForbiddenDecisionField(entry, filePath, result, `${pointer}[${index}]`, seen));
    return;
  }
  for (const field of FORBIDDEN_NEXT_ACTION_DECISION_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(value, field)) {
      const reportedPointer = pointer ? `${pointer}.${field}` : field;
      addIssue(result.errors, 'next-action-decision-field-forbidden', filePath, `${reportedPointer} is forbidden; scripts may only emit possible_entrypoints[] facts for LLM judgment.`, {
        field: reportedPointer,
      });
    }
  }
  for (const [key, child] of Object.entries(value)) {
    scanForbiddenDecisionField(child, filePath, result, pointer ? `${pointer}.${key}` : key, seen);
  }
}

function validateNextActionSourceFactRefs(refs, inputs, result) {
  if (!Array.isArray(refs) || refs.length === 0) {
    addIssue(result.errors, 'invalid-source-fact-refs', 'next-action-candidates.json', 'source_fact_refs must be a non-empty array.');
    return;
  }
  for (const ref of refs) {
    if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
      addIssue(result.errors, 'invalid-source-fact-refs', 'next-action-candidates.json', 'source_fact_refs entries must be objects.');
      continue;
    }
    if (!isSafeStandardsArtifactPath(ref.artifact_path, inputs)) {
      addIssue(result.errors, 'invalid-source-fact-ref-path', 'next-action-candidates.json', 'source_fact_refs[].artifact_path must be a repo-relative standards artifact path.');
    }
    if (!hasText(ref.pointer)) {
      addIssue(result.errors, 'invalid-source-fact-ref-pointer', 'next-action-candidates.json', 'source_fact_refs[].pointer is required.');
    }
    if (!['script_confirmed', 'provider_untrusted', 'llm_asserted'].includes(ref.classification)) {
      addIssue(result.errors, 'invalid-source-fact-ref-classification', 'next-action-candidates.json', 'source_fact_refs[].classification is invalid.');
    }
    if ('raw_excerpt' in ref || 'raw_provider_output' in ref) {
      addIssue(result.errors, 'raw-provider-excerpt-forbidden', 'next-action-candidates.json', 'source_fact_refs must not inline raw provider excerpts.');
    }
  }
}

function validateNextActionEvidencePaths(paths, inputs, result) {
  if (!Array.isArray(paths) || paths.length === 0) {
    addIssue(result.errors, 'invalid-next-action-evidence-paths', 'next-action-candidates.json', 'evidence_paths must be a non-empty array.');
    return;
  }
  for (const evidencePath of paths) {
    if (!isSafeStandardsArtifactPath(evidencePath, inputs)) {
      addIssue(result.errors, 'invalid-next-action-evidence-path', 'next-action-candidates.json', 'evidence_paths entries must be repo-relative standards artifact paths.', {
        path: evidencePath,
      });
      continue;
    }
    const absolutePath = resolveStandardsArtifactPath(evidencePath, inputs);
    if (!isPathWithin(inputs.standardsDir, absolutePath)) {
      addIssue(result.errors, 'invalid-next-action-evidence-path', 'next-action-candidates.json', 'evidence path escapes standards dir.', {
        path: evidencePath,
      });
      continue;
    }
    let lstat;
    try {
      lstat = fs.lstatSync(absolutePath);
    } catch (_error) {
      addIssue(result.errors, 'missing-next-action-evidence-path', 'next-action-candidates.json', 'evidence path must point at a readable standards artifact.', {
        path: evidencePath,
      });
      continue;
    }
    if (lstat.isSymbolicLink()) {
      addIssue(result.errors, 'invalid-next-action-evidence-path', 'next-action-candidates.json', 'evidence path must not be a symlink.', {
        path: evidencePath,
      });
      continue;
    }
    if (!lstat.isFile()) {
      addIssue(result.errors, 'missing-next-action-evidence-path', 'next-action-candidates.json', 'evidence path must point at a readable standards artifact.', {
        path: evidencePath,
      });
      continue;
    }
    let realStandardsDir;
    let realArtifactPath;
    try {
      realStandardsDir = realpathSync(inputs.standardsDir);
      realArtifactPath = realpathSync(absolutePath);
    } catch (_error) {
      addIssue(result.errors, 'missing-next-action-evidence-path', 'next-action-candidates.json', 'evidence path must point at a readable standards artifact.', {
        path: evidencePath,
      });
      continue;
    }
    if (!isPathWithin(realStandardsDir, realArtifactPath)) {
      addIssue(result.errors, 'invalid-next-action-evidence-path', 'next-action-candidates.json', 'evidence path realpath escapes standards dir.', {
        path: evidencePath,
      });
      continue;
    }
    try {
      fs.accessSync(absolutePath, fs.constants.R_OK);
    } catch (_error) {
      addIssue(result.errors, 'unreadable-next-action-evidence-path', 'next-action-candidates.json', 'evidence path must point at a readable standards artifact.', {
        path: evidencePath,
      });
    }
  }
}

function validateNextActionEntrypoints(entrypoints, result) {
  if (!Array.isArray(entrypoints)) {
    addIssue(result.errors, 'invalid-possible-entrypoints', 'next-action-candidates.json', 'possible_entrypoints must be an array.');
    return;
  }
  for (const entrypoint of entrypoints) {
    if (!PUBLIC_ENTRYPOINTS.has(entrypoint)) {
      addIssue(result.errors, 'invalid-possible-entrypoint', 'next-action-candidates.json', `Unknown possible entrypoint: ${entrypoint}`);
    }
  }
}

function isSafeStandardsArtifactPath(value, inputs = {}) {
  if (!hasText(value)) return false;
  if (String(value).includes('\\')) return false;
  const normalized = normalizePath(value);
  if (path.isAbsolute(normalized)) return false;
  if (normalized.includes('//')) return false;
  if (normalized.split('/').includes('..')) return false;
  if (normalized.startsWith('.claude/') || normalized.startsWith('.codex/') || normalized.startsWith('.agents/skills/')) return false;
  if (normalized.startsWith('.spec-first/graph/') || normalized.startsWith('.spec-first/providers/')) return false;
  if (!inputs.cwd || !inputs.standardsDir) return false;
  const artifactName = path.posix.basename(normalized);
  if (!NEXT_ACTION_ARTIFACT_NAMES.has(artifactName)) return false;
  const absolutePath = path.resolve(inputs.cwd, normalized);
  return isPathWithin(inputs.standardsDir, absolutePath)
    && path.relative(path.resolve(inputs.standardsDir), absolutePath) === artifactName;
}

function resolveStandardsArtifactPath(value, inputs) {
  return path.resolve(inputs.cwd || process.cwd(), normalizePath(value));
}

function realpathSync(filePath) {
  return fs.realpathSync.native
    ? fs.realpathSync.native(filePath)
    : fs.realpathSync(filePath);
}

function isPathWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
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
  const byId = new Map(candidateObjects(candidatesDoc.candidates).map((candidate) => [candidate.id, candidate]));
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
  const hasCandidateEvidence = candidateObjects(candidatesDoc.candidates).some((candidate) => (
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
  const matchingCandidates = candidateObjects(candidatesDoc.candidates).filter((candidate) => candidate.status === status);
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

function candidateObjects(candidates) {
  return (Array.isArray(candidates) ? candidates : [])
    .filter((candidate) => candidate && typeof candidate === 'object' && !Array.isArray(candidate));
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
