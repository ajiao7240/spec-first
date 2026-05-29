'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const PLANS_DIR = path.join(REPO_ROOT, 'docs', 'plans');
const PLAN_TYPES = new Set(['feat', 'fix', 'refactor']);
const PLAN_STATUSES = new Set(['active', 'partially-shipped', 'completed', 'superseded']);

function splitFrontmatter(content) {
  if (!content.startsWith('---\n')) return null;
  const end = content.indexOf('\n---', 4);
  if (end === -1) return null;
  return content.slice(4, end);
}

function stripInlineComment(value) {
  const trimmed = String(value || '').trim();
  if (/^['"]/.test(trimmed)) return trimmed;
  return trimmed.replace(/\s+#.*$/, '').trim();
}

function unquote(value) {
  return stripInlineComment(value).replace(/^['"]|['"]$/g, '').trim();
}

function scalarField(frontmatter, key) {
  const match = new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm').exec(frontmatter);
  return match ? unquote(match[1]) : null;
}

function parseListField(frontmatter, key) {
  const lines = frontmatter.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^${key}:`).test(line));
  if (start === -1) return [];

  const firstValue = lines[start].replace(new RegExp(`^${key}:\\s*`), '').trim();
  if (firstValue.startsWith('[') && firstValue.endsWith(']')) {
    const inner = firstValue.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map(unquote).filter(Boolean);
  }
  if (firstValue && firstValue !== '[]') {
    return [unquote(firstValue)];
  }

  const values = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[A-Za-z_][A-Za-z0-9_-]*:/.test(line)) break;
    const item = /^\s*-\s*(.+?)\s*$/.exec(line);
    if (item) values.push(unquote(item[1]));
  }
  return values;
}

function isRepoRelativeSchemaPath(value) {
  return (
    typeof value === 'string'
    && value.endsWith('.schema.json')
    && !value.startsWith('/')
    && !/^[A-Za-z]:[\\/]/.test(value)
    && !value.includes('\\')
    && !value.split('/').includes('..')
  );
}

function readWorkflowIntegratedFlag(schemaPath) {
  const absolutePath = path.join(REPO_ROOT, schemaPath);
  const schema = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  return schema['x-spec-first-workflow-integrated'];
}

function validatePlanStatusTaxonomy(filePath, content, readSchemaFlag = readWorkflowIntegratedFlag) {
  const errors = [];
  const warnings = [];
  const frontmatter = splitFrontmatter(content);
  const relativePath = path.relative(REPO_ROOT, filePath);
  if (!frontmatter) {
    warnings.push(`${relativePath}: missing frontmatter`);
    return { errors, warnings };
  }

  const type = scalarField(frontmatter, 'type');
  if (!PLAN_TYPES.has(type)) return { errors, warnings };

  const status = scalarField(frontmatter, 'status');
  if (!status) {
    warnings.push(`${relativePath}: missing legacy status`);
    return { errors, warnings };
  }
  if (!PLAN_STATUSES.has(status)) {
    errors.push(`${relativePath}: status must be one of ${Array.from(PLAN_STATUSES).join(', ')}, got ${status}`);
    return { errors, warnings };
  }

  const implementsSchemas = parseListField(frontmatter, 'implements_schemas');
  for (const schemaPath of implementsSchemas) {
    if (!isRepoRelativeSchemaPath(schemaPath)) {
      errors.push(`${relativePath}: implements_schemas entry must be a repo-relative schema path: ${schemaPath}`);
      continue;
    }
    if (status !== 'completed') continue;
    let integrated;
    try {
      integrated = readSchemaFlag(schemaPath);
    } catch (error) {
      errors.push(`${relativePath}: implements_schemas entry is not readable: ${schemaPath}`);
      continue;
    }
    if (integrated === false) {
      errors.push(`${relativePath}: completed plan implements ${schemaPath}, but x-spec-first-workflow-integrated=false; use status: partially-shipped or finish integration first`);
    }
  }

  return { errors, warnings };
}

describe('plan status taxonomy', () => {
  test('current plan frontmatter uses the completion taxonomy for plan documents', () => {
    const errors = [];
    for (const fileName of fs.readdirSync(PLANS_DIR).filter((name) => name.endsWith('.md')).sort()) {
      const filePath = path.join(PLANS_DIR, fileName);
      const result = validatePlanStatusTaxonomy(filePath, fs.readFileSync(filePath, 'utf8'));
      errors.push(...result.errors);
    }

    expect(errors).toEqual([]);
  });

  test('completed plans cannot claim schemas whose workflow integration flag is false', () => {
    const plan = [
      '---',
      'title: Example',
      'type: feat',
      'status: completed',
      'date: 2026-05-29',
      'spec_id: 2026-05-29-999-example',
      "implements_schemas: ['docs/contracts/workflows/pending.schema.json']",
      '---',
      '',
      '# Example',
    ].join('\n');

    const result = validatePlanStatusTaxonomy(
      path.join(REPO_ROOT, 'docs', 'plans', 'example.md'),
      plan,
      () => false,
    );

    expect(result.errors).toEqual([
      'docs/plans/example.md: completed plan implements docs/contracts/workflows/pending.schema.json, but x-spec-first-workflow-integrated=false; use status: partially-shipped or finish integration first',
    ]);
  });

  test('legacy missing status and non-plan documents do not fail the plan taxonomy lint', () => {
    const missingStatus = [
      '---',
      'title: Legacy',
      'type: feat',
      'date: 2026-05-29',
      'spec_id: 2026-05-29-998-legacy',
      '---',
    ].join('\n');
    const tracker = [
      '---',
      'title: Tracker',
      'type: tracker',
      'status: closed',
      'date: 2026-05-29',
      '---',
    ].join('\n');

    expect(validatePlanStatusTaxonomy(path.join(REPO_ROOT, 'docs', 'plans', 'legacy.md'), missingStatus).errors).toEqual([]);
    expect(validatePlanStatusTaxonomy(path.join(REPO_ROOT, 'docs', 'plans', 'tracker.md'), tracker).errors).toEqual([]);
  });
});
