#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const CANONICAL_SCHEMA_VERSION = 'spec-first.workflow-eval-fixtures.v1';
const SOURCE_REF_AUTHORITIES = new Set(['source', 'historical', 'advisory']);
const REQUIRED_BUCKETS = ['trigger', 'boundary'];
const OPTIONAL_BUCKETS = ['failure', 'expected'];
const BUCKETS = [...REQUIRED_BUCKETS, ...OPTIONAL_BUCKETS];
const GENERATED_OR_HISTORICAL_SOURCE_PATTERNS = [
  /^\.claude\//,
  /^\.codex\//,
  /^\.agents\/skills\//,
  /^docs\/plans\//,
  /^docs\/validation\//,
];

function normalizeFixtureFile(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || process.cwd());
  const filePath = path.resolve(repoRoot, options.filePath || '');
  const payload = readJson(filePath);
  return normalizeFixturePayload(payload, {
    repoRoot,
    filePath,
    skillId: options.skillId,
  });
}

function normalizeFixturePayload(payload, context = {}) {
  const repoRoot = path.resolve(context.repoRoot || process.cwd());
  const filePath = context.filePath ? path.resolve(repoRoot, context.filePath) : null;
  const relativeFile = filePath ? toRepoRelative(repoRoot, filePath) : null;
  const cases = Array.isArray(payload.cases)
    ? payload.cases
    : Array.isArray(payload.examples)
    ? payload.examples
    : [];
  const skill = payload.skill || context.skillId || inferSkillId(relativeFile);
  const fileSourceRefs = stringArray(payload.source_refs);
  const fileCoverageTags = stringArray(payload.coverage_tags);
  const fileAuthority = payload.source_ref_authority || 'source';

  return cases.map((entry, index) => {
    const sourceRefAuthority = entry.source_ref_authority || fileAuthority || 'source';
    const sourceRefs = unique([
      ...fileSourceRefs,
      ...stringArray(entry.source_refs),
    ]);
    const coverageTags = unique([
      ...fileCoverageTags,
      ...stringArray(entry.coverage_tags),
    ]);
    const forbiddenSignals = unique([
      ...stringArray(entry.forbidden_signals),
      ...stringArray(entry.negative_signal === undefined ? [] : entry.negative_signal),
    ]);

    return {
      schema_version: CANONICAL_SCHEMA_VERSION,
      skill,
      id: normalizeCaseId(entry, index),
      input: firstPresentString([
        entry.input,
        entry.user_intent,
        entry.input_shape,
        entry.intent,
      ]),
      expected_outcome: normalizeExpectedOutcome(entry),
      coverage_tags: coverageTags,
      source_refs: sourceRefs,
      source_ref_authority: sourceRefAuthority,
      boundary_note: firstPresentString([entry.boundary_note]),
      forbidden_signals: forbiddenSignals,
      source_file: relativeFile,
      source_schema_version: payload.schema_version || null,
      normalized_from: payload.schema_version === CANONICAL_SCHEMA_VERSION ? 'canonical' : 'legacy_adapter',
      coverage_basis: coverageTags.length > 0 ? 'declared_coverage_tags' : 'missing_coverage_tags',
      extensions: normalizeExtensions(entry),
    };
  });
}

function validateNormalizedCase(entry, options = {}) {
  const repoRoot = path.resolve(options.repoRoot || process.cwd());
  const errors = [];

  if (!isNonEmptyString(entry.skill)) {
    errors.push(error('missing_skill', entry, 'case skill must be a non-empty string'));
  }
  if (!isNonEmptyString(entry.id)) {
    errors.push(error('missing_id', entry, 'case id must be a non-empty string'));
  }
  if (!isNonEmptyString(entry.input)) {
    errors.push(error('missing_input', entry, 'case input must be a non-empty string'));
  }
  if (!Array.isArray(entry.coverage_tags) || entry.coverage_tags.length === 0) {
    errors.push(error('missing_coverage_tags', entry, 'case coverage_tags must be a non-empty array'));
  } else {
    for (const tag of entry.coverage_tags) {
      if (!isNonEmptyString(tag) || !/^[a-z0-9][a-z0-9-]*$/.test(tag)) {
        errors.push(error('invalid_coverage_tag', entry, `invalid coverage tag: ${String(tag)}`));
      }
    }
  }
  if (!Array.isArray(entry.source_refs) || entry.source_refs.length === 0) {
    errors.push(error('missing_source_refs', entry, 'case source_refs must be a non-empty array'));
  }
  if (!SOURCE_REF_AUTHORITIES.has(entry.source_ref_authority)) {
    errors.push(error('invalid_source_ref_authority', entry, `invalid source_ref_authority: ${entry.source_ref_authority}`));
  }
  validateSourceRefs(entry, repoRoot, errors);

  if (hasBucketTag(entry, 'trigger') && !hasExpectedOutcome(entry)) {
    errors.push(error('missing_expected_outcome', entry, 'trigger cases require expected_outcome'));
  }
  if (hasBucketTag(entry, 'expected') && !hasExpectedOutcome(entry)) {
    errors.push(error('missing_expected_outcome', entry, 'expected cases require expected_outcome'));
  }
  if (
    hasBucketTag(entry, 'boundary')
    && !hasExpectedOutcome(entry)
    && !isNonEmptyString(entry.boundary_note)
    && (!Array.isArray(entry.forbidden_signals) || entry.forbidden_signals.length === 0)
  ) {
    errors.push(error(
      'missing_boundary_evidence',
      entry,
      'boundary cases require expected_outcome, boundary_note, or forbidden_signals',
    ));
  }

  return errors;
}

function validateNormalizedCases(cases, options = {}) {
  const errors = [];
  const idsBySkill = new Map();

  for (const entry of cases) {
    errors.push(...validateNormalizedCase(entry, options));
    const key = `${entry.skill}:${entry.id}`;
    const previous = idsBySkill.get(key);
    if (previous) {
      errors.push(error(
        'duplicate_case_id',
        entry,
        `duplicate case id for ${entry.skill}: ${entry.id}`,
        { previous_source_file: previous.source_file },
      ));
    } else {
      idsBySkill.set(key, entry);
    }
  }

  return errors;
}

function caseHasBucketCoverage(entry, bucket, options = {}) {
  if (!BUCKETS.includes(bucket)) return false;
  const repoRoot = path.resolve(options.repoRoot || process.cwd());
  const strictEntry = hasBucketTag(entry, bucket)
    ? entry
    : options.allowLegacyFilenameFallback && fileNameMatchesBucket(entry.source_file, bucket)
    ? {
      ...entry,
      coverage_tags: unique([...(entry.coverage_tags || []), bucket]),
      coverage_basis: 'legacy_filename_fallback',
    }
    : null;

  if (!strictEntry) return false;

  const relevantErrors = validateNormalizedCase(strictEntry, { repoRoot })
    .filter((entryError) => !(
      options.allowLegacyFilenameFallback
      && entryError.reason_code === 'missing_coverage_tags'
    ));

  return relevantErrors.length === 0;
}

function bucketCoverageBasis(entry, bucket) {
  if (hasBucketTag(entry, bucket)) return 'declared_coverage_tags';
  if (fileNameMatchesBucket(entry.source_file, bucket)) return 'legacy_filename_fallback';
  return null;
}

function fileNameMatchesBucket(filePath, bucket) {
  if (!filePath) return false;
  const baseName = path.basename(filePath);
  if (bucket === 'expected') return /expected/i.test(baseName);
  return new RegExp(bucket, 'i').test(baseName);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeCaseId(entry, index) {
  if (isNonEmptyString(entry.id)) return entry.id;
  if (isNonEmptyString(entry.name)) return slugify(entry.name);
  return `case-${index + 1}`;
}

function normalizeExpectedOutcome(entry) {
  if (entry.expected_outcome !== undefined) return entry.expected_outcome;
  if (entry.expected !== undefined) return entry.expected;
  if (entry.expected_posture !== undefined) return entry.expected_posture;
  if (entry.expected_signal !== undefined) return entry.expected_signal;
  if (entry.expected_decision !== undefined || entry.expected_failure !== undefined || entry.expected_output !== undefined) {
    const outcome = {};
    for (const key of ['expected_decision', 'expected_failure', 'expected_output', 'expected_next_action']) {
      if (entry[key] !== undefined) outcome[key] = entry[key];
    }
    return outcome;
  }
  return null;
}

function normalizeExtensions(entry) {
  const extensionKeys = [
    'name',
    'context',
    'context_snippets',
    'source_note',
    'intent',
    'input_shape',
    'public_workflow_required',
    'expected_entrypoint',
    'graphify_required',
    'artifact_expected',
    'dispatch_decision',
    'fallback_reason',
  ];
  const extensions = { ...(entry.extensions || {}) };

  for (const key of extensionKeys) {
    if (entry[key] !== undefined) extensions[key] = entry[key];
  }

  return extensions;
}

function validateSourceRefs(entry, repoRoot, errors) {
  if (!Array.isArray(entry.source_refs)) return;

  for (const sourceRef of entry.source_refs) {
    if (!isNonEmptyString(sourceRef)) {
      errors.push(error('invalid_source_ref', entry, 'source_ref must be a non-empty string'));
      continue;
    }
    const sourcePath = sourceRef.split('#')[0];
    if (!sourcePath || /^https?:\/\//.test(sourcePath) || path.isAbsolute(sourcePath) || sourcePath.includes('\\')) {
      errors.push(error('invalid_source_ref', entry, `source_ref must be repo-relative POSIX path: ${sourceRef}`));
      continue;
    }
    if (entry.source_ref_authority === 'source') {
      for (const pattern of GENERATED_OR_HISTORICAL_SOURCE_PATTERNS) {
        if (pattern.test(sourcePath)) {
          errors.push(error(
            'source_ref_not_source_authority',
            entry,
            `source_ref requires historical/advisory authority: ${sourceRef}`,
          ));
        }
      }
      if (!fs.existsSync(path.join(repoRoot, sourcePath))) {
        errors.push(error('source_ref_missing', entry, `source_ref path does not exist: ${sourceRef}`));
      }
    }
  }
}

function hasBucketTag(entry, bucket) {
  return Array.isArray(entry.coverage_tags) && entry.coverage_tags.includes(bucket);
}

function hasExpectedOutcome(entry) {
  return isNonEmptyExpected(entry.expected_outcome);
}

function isNonEmptyExpected(value) {
  if (isNonEmptyString(value)) return true;
  if (Array.isArray(value)) return value.some((item) => isNonEmptyExpected(item));
  if (value && typeof value === 'object') {
    return Object.values(value).some((item) => isNonEmptyExpected(item));
  }
  return false;
}

function firstPresentString(values) {
  for (const value of values) {
    if (isNonEmptyString(value)) return value;
  }
  return '';
}

function stringArray(value) {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.filter(isNonEmptyString);
  return isNonEmptyString(value) ? [value] : [];
}

function unique(values) {
  return [...new Set(values)];
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function inferSkillId(relativeFile) {
  const match = relativeFile && relativeFile.match(/^skills\/([^/]+)\//);
  return match ? match[1] : null;
}

function toRepoRelative(repoRoot, absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join('/');
}

function error(reasonCode, entry, message, extra = {}) {
  return {
    reason_code: reasonCode,
    message,
    skill: entry.skill || null,
    id: entry.id || null,
    source_file: entry.source_file || null,
    ...extra,
  };
}

module.exports = {
  BUCKETS,
  CANONICAL_SCHEMA_VERSION,
  OPTIONAL_BUCKETS,
  REQUIRED_BUCKETS,
  bucketCoverageBasis,
  caseHasBucketCoverage,
  normalizeFixtureFile,
  normalizeFixturePayload,
  validateNormalizedCase,
  validateNormalizedCases,
};
