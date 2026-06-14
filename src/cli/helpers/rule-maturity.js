'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { validateAgainstSchema } = require('../../contracts/schema-validator');
const { writeFileAtomic } = require('../atomic-write');

const RECORD_SCHEMA_VERSION = 'rule-maturity.v1';
const LIST_SCHEMA_VERSION = 'rule-maturity-list.v1';
const PHASE1_GATE_FACTS_SCHEMA_VERSION = 'rule-maturity-phase1-gate-facts.v1';
const STORE_RELATIVE_PATH = '.spec-first/governance/rule-maturity.json';
const SCHEMA_PATH = path.join(__dirname, '..', '..', '..', 'docs', 'contracts', 'governance', 'rule-maturity.schema.json');
const DEFAULT_PHASE1_GATE_WINDOW_DAYS = 14;
const OWNER_CADENCE_REQUIRED_FIELDS = [
  'reviewer',
  'cadence',
  'trigger',
  'minimum_sample',
  'fallback',
];
const SHADOW_ROLLBACK = {
  available: true,
  notes: 'shadow observation only; nothing to roll back',
};

let cachedSchema = null;

function runCli(argv, io = {}) {
  const parsed = parseArgs(Array.isArray(argv) ? argv : []);
  const output = io.stdout || process.stdout;
  if (parsed.errors.length > 0) {
    writeJson({
      schema_version: parsed.action === 'list' ? LIST_SCHEMA_VERSION : 'rule-maturity-command-result.v1',
      status: 'rejected',
      reason_code: 'invalid-arguments',
      errors: parsed.errors,
    }, output);
    return 2;
  }

  if (parsed.action === 'record') {
    const result = recordShadowHit(parsed.options);
    writeJson(result, output);
    return result.status === 'ok' ? 0 : 2;
  }

  if (parsed.action === 'list') {
    writeJson(buildRuleMaturityList(parsed.options), output);
    return 0;
  }

  writeJson({
    schema_version: 'rule-maturity-command-result.v1',
    status: 'rejected',
    reason_code: 'invalid-action',
    errors: [`unknown rule-maturity action: ${parsed.action || '<missing>'}`],
  }, output);
  return 2;
}

function parseArgs(args) {
  const action = args[0] || '';
  const parsed = {
    action,
    options: {
      repo: process.cwd(),
      ruleId: '',
      workflow: '',
      evidenceRef: '',
      reasonCode: '',
    },
    errors: [],
  };

  if (!['record', 'list'].includes(action)) {
    parsed.errors.push('action must be record or list');
    return parsed;
  }

  const takeValue = (flag, index) => {
    const value = args[index + 1];
    if (value === undefined || value.startsWith('--')) {
      parsed.errors.push(`${flag} requires a value`);
      return null;
    }
    return value;
  };

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') continue;
    if (arg === '--repo') {
      const value = takeValue('--repo', index);
      if (value !== null) {
        parsed.options.repo = value;
        index += 1;
      }
      continue;
    }
    if (action === 'record' && arg === '--rule-id') {
      const value = takeValue('--rule-id', index);
      if (value !== null) {
        parsed.options.ruleId = value;
        index += 1;
      }
      continue;
    }
    if (action === 'record' && arg === '--workflow') {
      const value = takeValue('--workflow', index);
      if (value !== null) {
        parsed.options.workflow = value;
        index += 1;
      }
      continue;
    }
    if (action === 'record' && arg === '--evidence-ref') {
      const value = takeValue('--evidence-ref', index);
      if (value !== null) {
        parsed.options.evidenceRef = value;
        index += 1;
      }
      continue;
    }
    if (action === 'record' && arg === '--reason-code') {
      const value = takeValue('--reason-code', index);
      if (value !== null) {
        parsed.options.reasonCode = value;
        index += 1;
      }
      continue;
    }
    parsed.errors.push(`unknown argument: ${arg}`);
  }

  if (action === 'record') {
    if (!parsed.options.ruleId) parsed.errors.push('--rule-id is required');
    if (!parsed.options.workflow) parsed.errors.push('--workflow is required');
    if (!parsed.options.evidenceRef) parsed.errors.push('--evidence-ref is required');
    if (!parsed.options.reasonCode) parsed.errors.push('--reason-code is required');
  }

  return parsed;
}

function recordShadowHit(options = {}) {
  const target = resolveRepoRoot(options);
  if (!target.ok) {
    return commandError('repo-not-found', target.errors, { store_path: STORE_RELATIVE_PATH });
  }
  const repoRoot = target.root;
  const store = readRuleMaturityRecords(repoRoot);
  if (store.status === 'degraded') {
    return commandError(store.reason_code, store.errors, { store_path: STORE_RELATIVE_PATH });
  }

  const records = store.records.map((record) => ({ ...record, shadow_hits: [...record.shadow_hits] }));
  const existingIndex = records.findIndex((record) => record.rule_id === options.ruleId);
  const hit = {
    observed_at: new Date().toISOString(),
    workflow: options.workflow,
    evidence_ref: options.evidenceRef,
    reason_code: options.reasonCode,
  };

  let nextRecord;
  if (existingIndex === -1) {
    nextRecord = {
      schema_version: RECORD_SCHEMA_VERSION,
      rule_id: options.ruleId,
      stage: 'shadow',
      shadow_hits: [hit],
      defect_evidence_refs: [],
      false_positive_refs: [],
      rollback: { ...SHADOW_ROLLBACK },
      evidence_refs: [options.evidenceRef],
      reason_code: 'shadow-observation',
    };
    records.push(nextRecord);
  } else {
    nextRecord = {
      ...records[existingIndex],
      shadow_hits: [...records[existingIndex].shadow_hits, hit],
      reason_code: 'shadow-observation',
    };
    if (nextRecord.stage !== 'shadow') {
      return commandError('stage-not-recordable', [`record only appends shadow observations; rule ${options.ruleId} is ${nextRecord.stage}`], {
        rule_id: options.ruleId,
      });
    }
    nextRecord.evidence_refs = unique(nextRecord.shadow_hits.map((entry) => entry.evidence_ref));
    records[existingIndex] = nextRecord;
  }

  const validation = validateRecords(records);
  if (validation.errors.length > 0) {
    return commandError('schema-invalid', validation.errors, { rule_id: options.ruleId });
  }

  try {
    writeRuleMaturityRecords(repoRoot, records);
  } catch (error) {
    return commandError('write-failed', [error.message], { store_path: STORE_RELATIVE_PATH });
  }

  return {
    schema_version: 'rule-maturity-command-result.v1',
    status: 'ok',
    reason_code: 'shadow-hit-recorded',
    store_path: STORE_RELATIVE_PATH,
    rule_id: nextRecord.rule_id,
    stage: nextRecord.stage,
    shadow_hit_count: nextRecord.shadow_hits.length,
    evidence_refs: nextRecord.evidence_refs,
  };
}

function buildRuleMaturityList(options = {}) {
  const target = resolveRepoRoot(options);
  if (!target.ok) {
    return {
      schema_version: LIST_SCHEMA_VERSION,
      status: 'degraded',
      reason_code: 'repo-not-found',
      errors: target.errors,
      rules: [],
    };
  }
  const repoRoot = target.root;
  const store = readRuleMaturityRecords(repoRoot);
  if (store.status === 'empty') {
    return {
      schema_version: LIST_SCHEMA_VERSION,
      status: 'empty',
      reason_code: 'rule-maturity-store-empty',
      rules: [],
    };
  }
  if (store.status === 'degraded') {
    return {
      schema_version: LIST_SCHEMA_VERSION,
      status: 'degraded',
      reason_code: store.reason_code,
      errors: store.errors,
      rules: [],
    };
  }

  return summarizeRuleMaturityRecords(store.records);
}

function readRuleMaturityRecords(repoRoot) {
  const target = resolveRepoRoot({ repo: repoRoot });
  if (!target.ok) {
    return {
      status: 'degraded',
      reason_code: 'repo-not-found',
      errors: target.errors,
      records: [],
    };
  }
  const storePath = getRuleMaturityStorePath(target.root);
  if (!fs.existsSync(storePath)) {
    return { status: 'empty', reason_code: 'rule-maturity-store-empty', records: [] };
  }

  let records;
  try {
    records = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  } catch (error) {
    return {
      status: 'degraded',
      reason_code: 'evidence-store-corrupt',
      errors: [error.message],
      records: [],
    };
  }
  if (!Array.isArray(records)) {
    return {
      status: 'degraded',
      reason_code: 'evidence-store-invalid',
      errors: ['rule-maturity store must be an array of rule records'],
      records: [],
    };
  }

  const validation = validateRecords(records);
  if (validation.errors.length > 0) {
    return {
      status: 'degraded',
      reason_code: validation.schemaUnavailable ? 'schema-unavailable' : 'schema-invalid',
      errors: validation.errors,
      records: [],
    };
  }

  return { status: 'ok', reason_code: 'rule-maturity-store-read', records };
}

function summarizeRuleMaturityRecords(records) {
  const rules = [];
  const errors = [];
  for (const record of records) {
    const observed = lastObservedAt(record.shadow_hits || []);
    if (observed.error) {
      errors.push(`rule ${record.rule_id}: invalid observed_at ${observed.value}`);
    }
    rules.push({
      rule_id: record.rule_id,
      stage: record.stage,
      shadow_hit_count: (record.shadow_hits || []).length,
      last_observed_at: observed.error ? null : observed.value,
      workflows: unique((record.shadow_hits || []).map((hit) => hit.workflow)).sort(),
      reason_codes: unique((record.shadow_hits || []).map((hit) => hit.reason_code)).sort(),
      evidence_refs: unique((record.shadow_hits || []).map((hit) => hit.evidence_ref)),
    });
  }

  return {
    schema_version: LIST_SCHEMA_VERSION,
    status: errors.length > 0 ? 'degraded' : 'ok',
    reason_code: errors.length > 0 ? 'invalid-observed-at' : 'rule-maturity-collected',
    rules: rules.sort((left, right) => left.rule_id.localeCompare(right.rule_id)),
    ...(errors.length > 0 ? { errors } : {}),
  };
}

function buildRuleMaturityPhase1GateFacts(options = {}) {
  const list = options.list && typeof options.list === 'object' ? options.list : {};
  const observations = options.observations && typeof options.observations === 'object' ? options.observations : null;
  const asOf = normalizeAsOf(options.asOf);
  const ruleCount = countRules(list, observations);
  const shadowHitCount = countShadowHits(list, observations);
  const workflowDistribution = normalizeWorkflowDistribution(observations, list);
  const ownerCadenceDecision = normalizeOwnerCadenceDecision(options.ownerCadenceDecision);
  const windowDays = normalizePositiveNumber(options.windowDays, DEFAULT_PHASE1_GATE_WINDOW_DAYS);
  const storeStatus = list.status || 'unknown';
  const consumerStatus = observations ? (observations.status || 'unknown') : 'missing';
  const statusClass = phase1StatusClass({
    storeStatus,
    consumerStatus,
    shadowHitCount,
    workflowDistribution,
  });
  const recommended = phase1RecommendedNextAction({
    statusClass,
    ownerCadenceDecision,
    shadowHitCount,
  });

  return {
    schema_version: PHASE1_GATE_FACTS_SCHEMA_VERSION,
    as_of: asOf,
    source_refs: normalizeSourceRefs(options.sourceRefs),
    status_class: statusClass,
    rule_count: ruleCount,
    shadow_hit_count: shadowHitCount,
    candidate_density: {
      window_days: windowDays,
      shadow_hits_per_week: Number(((shadowHitCount / windowDays) * 7).toFixed(2)),
      rule_count: ruleCount,
      workflow_count: Object.keys(workflowDistribution).length,
    },
    workflow_distribution: workflowDistribution,
    consumer_status: consumerStatus,
    store_status: storeStatus,
    owner_cadence_decision: ownerCadenceDecision,
    recommended_next_action: recommended.action,
    reason_codes: recommended.reason_codes,
  };
}

function renderRuleMaturityPhase1GateMarkdown(facts) {
  const gate = facts && typeof facts === 'object' ? facts : buildRuleMaturityPhase1GateFacts();
  const owner = gate.owner_cadence_decision || {};
  const lines = [
    '# Rule Maturity Phase 1 Gate',
    '',
    `- as_of: ${gate.as_of || ''}`,
    '- source_refs:',
    ...(gate.source_refs || []).map((sourceRef) => `  - ${sourceRef}`),
    `- status_class: ${gate.status_class || ''}`,
    `- rule_count: ${numberOrZero(gate.rule_count)}`,
    `- shadow_hit_count: ${numberOrZero(gate.shadow_hit_count)}`,
    `- candidate_density: ${JSON.stringify(gate.candidate_density || {})}`,
    `- workflow_distribution: ${JSON.stringify(gate.workflow_distribution || {})}`,
    `- consumer_status: ${gate.consumer_status || ''}`,
    `- store_status: ${gate.store_status || ''}`,
    `- owner_cadence_decision: ${JSON.stringify(owner)}`,
    `- recommended_next_action: ${gate.recommended_next_action || ''}`,
    '',
  ];
  return `${lines.join('\n')}`;
}

function lastObservedAt(hits) {
  let maxTime = null;
  let maxValue = null;
  for (const hit of hits) {
    const value = hit && hit.observed_at;
    const time = Date.parse(value);
    if (!Number.isFinite(time)) {
      return { error: true, value };
    }
    if (maxTime === null || time > maxTime) {
      maxTime = time;
      maxValue = new Date(time).toISOString();
    }
  }
  return { error: false, value: maxValue };
}

function validateRecords(records) {
  const schema = loadSchema();
  if (!schema.ok) return { schemaUnavailable: true, errors: schema.errors };
  const errors = [];
  for (let index = 0; index < records.length; index += 1) {
    const result = validateAgainstSchema(schema.value, records[index], `records[${index}]`);
    errors.push(...result.errors);
  }
  return { schemaUnavailable: false, errors };
}

function loadSchema() {
  if (cachedSchema) return { ok: true, value: cachedSchema };
  try {
    cachedSchema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    return { ok: true, value: cachedSchema };
  } catch (error) {
    return { ok: false, errors: [`schema unavailable: ${error.message}`] };
  }
}

function writeRuleMaturityRecords(repoRoot, records) {
  const storePath = getRuleMaturityStorePath(repoRoot);
  writeFileAtomic(storePath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
}

function getRuleMaturityStorePath(repoRoot) {
  const target = resolveRepoRoot({ repo: repoRoot });
  const root = target.ok ? target.root : path.resolve(repoRoot || process.cwd());
  return path.join(root, ...STORE_RELATIVE_PATH.split('/'));
}

function resolveRepoRoot(options = {}) {
  const root = path.resolve(options.repo || options.repoRoot || process.cwd());
  try {
    const stats = fs.statSync(root);
    if (!stats.isDirectory()) {
      return { ok: false, root, errors: [`repo root is not a directory: ${root}`] };
    }
    return { ok: true, root: resolveGitRoot(root) || root, errors: [] };
  } catch (error) {
    return { ok: false, root, errors: [`repo root is not readable: ${root}: ${error.message}`] };
  }
}

function resolveGitRoot(root) {
  try {
    const output = execFileSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return output ? path.resolve(output) : '';
  } catch (_error) {
    return '';
  }
}

function commandError(reasonCode, errors, extra = {}) {
  return {
    schema_version: 'rule-maturity-command-result.v1',
    status: 'rejected',
    reason_code: reasonCode,
    errors,
    ...extra,
  };
}

function unique(values) {
  return [...new Set((values || []).filter((value) => value !== undefined && value !== null && String(value).length > 0))];
}

function normalizeAsOf(value) {
  if (!value) return new Date().toISOString();
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : String(value);
}

function countRules(list, observations) {
  if (observations && Number.isFinite(observations.rule_count)) return observations.rule_count;
  if (Array.isArray(list.rules)) return list.rules.length;
  return 0;
}

function countShadowHits(list, observations) {
  if (observations && Number.isFinite(observations.shadow_hit_count)) return observations.shadow_hit_count;
  return (list.rules || []).reduce((total, rule) => total + numberOrZero(rule.shadow_hit_count), 0);
}

function normalizeWorkflowDistribution(observations, list) {
  if (observations && observations.workflow_distribution && typeof observations.workflow_distribution === 'object') {
    return sortObjectValues(observations.workflow_distribution);
  }
  const distribution = {};
  for (const rule of list.rules || []) {
    for (const workflow of rule.workflows || []) {
      distribution[workflow] = distribution[workflow] || 0;
    }
  }
  return sortObjectValues(distribution);
}

function sortObjectValues(input) {
  return Object.fromEntries(Object.entries(input || {})
    .filter(([key]) => key)
    .sort((left, right) => left[0].localeCompare(right[0])));
}

function normalizeOwnerCadenceDecision(decision) {
  if (!decision || typeof decision !== 'object') {
    return {
      status: decision ? 'prose-only' : 'missing',
      summary: typeof decision === 'string' ? decision : '',
      missing_fields: [...OWNER_CADENCE_REQUIRED_FIELDS],
    };
  }
  const normalized = {
    status: decision.status || 'pending',
    reviewer: decision.reviewer || '',
    cadence: decision.cadence || '',
    trigger: decision.trigger || '',
    minimum_sample: Number.isFinite(decision.minimum_sample) ? decision.minimum_sample : null,
    fallback: decision.fallback || '',
  };
  const missingFields = OWNER_CADENCE_REQUIRED_FIELDS.filter((field) => {
    if (field === 'minimum_sample') return !Number.isFinite(normalized.minimum_sample) || normalized.minimum_sample <= 0;
    return !normalized[field];
  });
  if (normalized.fallback && normalized.fallback !== 'continue-phase1') {
    missingFields.push('fallback:continue-phase1');
  }
  return {
    ...normalized,
    missing_fields: unique(missingFields),
  };
}

function phase1StatusClass({ storeStatus, consumerStatus, shadowHitCount, workflowDistribution }) {
  if (storeStatus === 'degraded' || consumerStatus === 'degraded') return 'degraded/corrupt';
  if (consumerStatus === 'missing') return 'consumer_missing';
  if (shadowHitCount === 0) return 'empty';
  if (Object.keys(workflowDistribution || {}).length === 0) return 'no_llm_adoption';
  return 'candidate_density';
}

function phase1RecommendedNextAction({ statusClass, ownerCadenceDecision, shadowHitCount }) {
  if (['degraded/corrupt', 'consumer_missing'].includes(statusClass)) {
    return {
      action: 'repair-producer-consumer',
      reason_codes: [statusClass === 'consumer_missing' ? 'phase1-consumer-missing' : 'phase1-evidence-degraded'],
    };
  }
  if (statusClass !== 'candidate_density') {
    return {
      action: 'continue-phase1',
      reason_codes: [statusClass === 'empty' ? 'phase1-no-shadow-observations' : 'phase1-no-workflow-distribution'],
    };
  }
  if (!ownerCadenceDecision || ownerCadenceDecision.status !== 'confirmed') {
    return {
      action: 'continue-phase1',
      reason_codes: ['phase1-owner-cadence-not-confirmed'],
    };
  }
  if ((ownerCadenceDecision.missing_fields || []).length > 0) {
    return {
      action: 'continue-phase1',
      reason_codes: ['phase1-owner-cadence-incomplete'],
    };
  }
  if (shadowHitCount < ownerCadenceDecision.minimum_sample) {
    return {
      action: 'continue-phase1',
      reason_codes: ['phase1-sample-below-minimum'],
    };
  }
  return {
    action: 'open-phase2-plan',
    reason_codes: ['phase1-ready-for-phase2-plan'],
  };
}

function normalizeSourceRefs(sourceRefs) {
  return Array.isArray(sourceRefs) ? unique(sourceRefs.map((sourceRef) => String(sourceRef))) : [];
}

function normalizePositiveNumber(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function numberOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

function writeJson(value, output) {
  output.write(`${JSON.stringify(value, null, 2)}\n`);
}

if (require.main === module) {
  process.exitCode = runCli(process.argv.slice(2));
}

module.exports = {
  LIST_SCHEMA_VERSION,
  PHASE1_GATE_FACTS_SCHEMA_VERSION,
  RECORD_SCHEMA_VERSION,
  STORE_RELATIVE_PATH,
  buildRuleMaturityPhase1GateFacts,
  buildRuleMaturityList,
  getRuleMaturityStorePath,
  readRuleMaturityRecords,
  recordShadowHit,
  renderRuleMaturityPhase1GateMarkdown,
  runCli,
  summarizeRuleMaturityRecords,
};
