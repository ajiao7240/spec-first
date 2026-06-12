'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { validateAgainstSchema } = require('../../contracts/schema-validator');
const { writeFileAtomic } = require('../atomic-write');

const RECORD_SCHEMA_VERSION = 'rule-maturity.v1';
const LIST_SCHEMA_VERSION = 'rule-maturity-list.v1';
const STORE_RELATIVE_PATH = '.spec-first/governance/rule-maturity.json';
const SCHEMA_PATH = path.join(__dirname, '..', '..', '..', 'docs', 'contracts', 'governance', 'rule-maturity.schema.json');
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

function writeJson(value, output) {
  output.write(`${JSON.stringify(value, null, 2)}\n`);
}

if (require.main === module) {
  process.exitCode = runCli(process.argv.slice(2));
}

module.exports = {
  LIST_SCHEMA_VERSION,
  RECORD_SCHEMA_VERSION,
  STORE_RELATIVE_PATH,
  buildRuleMaturityList,
  getRuleMaturityStorePath,
  readRuleMaturityRecords,
  recordShadowHit,
  runCli,
  summarizeRuleMaturityRecords,
};
