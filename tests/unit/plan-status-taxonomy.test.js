'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const PLANS_DIR = path.join(REPO_ROOT, 'docs', 'plans');
const PLAN_TYPES = new Set(['feat', 'fix', 'refactor']);
const PLAN_STATUSES = new Set(['active', 'partially-shipped', 'completed', 'superseded']);
// 规则来源(单一来源):docs/contracts/workflows/review-closure-traceability.md
// 弱校验:role: origin + scope: in 的 referenced_reviews entry 必须带非空 finding id。
// 法不溯及既往:约定 2026-06-14 确立,只对当天及之后的 plan 强制;更早的 plan 放行。
const REVIEW_CLOSURE_EFFECTIVE_DATE = '2026-06-14';

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

// 解析 referenced_reviews 嵌套对象列表。每个 entry 以 `- key: value` 起头,
// 后续 `  key: value` / `  key: [a, b]` 为同一 entry 的子字段(更深缩进)。
// 对畸形输入降级为跳过该行,不崩溃。
function parseReferencedReviews(frontmatter) {
  const lines = frontmatter.split(/\r?\n/);
  const start = lines.findIndex((line) => /^referenced_reviews:\s*$/.test(line));
  if (start === -1) return [];

  const entries = [];
  let current = null;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[A-Za-z_][A-Za-z0-9_-]*:/.test(line)) break; // 回到顶层字段,列表结束
    if (line.trim() === '') continue;

    const itemStart = /^\s*-\s+(.*)$/.exec(line);
    if (itemStart) {
      current = {};
      entries.push(current);
      const inlineField = /^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/.exec(itemStart[1]);
      if (inlineField) assignReviewField(current, inlineField[1], inlineField[2]);
      continue;
    }
    if (!current) continue;
    const field = /^\s+([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
    if (field) assignReviewField(current, field[1], field[2]);
  }
  return entries;
}

function assignReviewField(entry, key, rawValue) {
  const value = rawValue.trim();
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    entry[key] = inner ? inner.split(',').map(unquote).filter(Boolean) : [];
    return;
  }
  entry[key] = unquote(value);
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

  // 弱校验:referenced_reviews 中 role: origin + scope: in 的 entry 必须带非空
  // finding id(addresses_findings 或 deferred_findings)。防「引了审查报告却不标
  // finding id」的静默断链。规则来源:docs/contracts/workflows/review-closure-traceability.md
  // legacy 放行:无 referenced_reviews 字段、或 date 早于约定确立日的 plan 不进入此校验。
  const planDate = scalarField(frontmatter, 'date');
  const enforceReviewClosure = !planDate || planDate >= REVIEW_CLOSURE_EFFECTIVE_DATE;
  for (const review of (enforceReviewClosure ? parseReferencedReviews(frontmatter) : [])) {
    if (review.role !== 'origin' || review.scope !== 'in') continue;
    const addresses = Array.isArray(review.addresses_findings) ? review.addresses_findings : [];
    const deferred = Array.isArray(review.deferred_findings) ? review.deferred_findings : [];
    if (addresses.length === 0 && deferred.length === 0) {
      const target = review.path || '(unnamed review)';
      errors.push(`${relativePath}: referenced_reviews entry "${target}" has role: origin / scope: in but no addresses_findings or deferred_findings; declare the finding ids it handles (see docs/contracts/workflows/review-closure-traceability.md) [referenced-review-missing-finding-ids]`);
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

describe('referenced_reviews closure traceability (weak check)', () => {
  function planWith(reviewBlock) {
    return [
      '---',
      'title: Example',
      'type: feat',
      'status: active',
      'date: 2026-06-14',
      'spec_id: 2026-06-14-999-example',
      reviewBlock,
      '---',
      '',
      '# Example',
    ].join('\n');
  }

  test('origin/scope:in entry with addresses_findings passes', () => {
    const plan = planWith([
      'referenced_reviews:',
      '  - path: docs/项目审查/2026-06-14-达成度与闭环审查报告.md',
      '    role: origin',
      '    scope: in',
      '    addresses_findings: ["META-closure-break"]',
    ].join('\n'));

    const result = validatePlanStatusTaxonomy(path.join(REPO_ROOT, 'docs', 'plans', 'example.md'), plan);
    expect(result.errors).toEqual([]);
  });

  test('origin/scope:in entry without finding ids fails with the silent-break error', () => {
    const plan = planWith([
      'referenced_reviews:',
      '  - path: docs/项目审查/2026-06-10-全项目综合审查报告.md',
      '    role: origin',
      '    scope: in',
    ].join('\n'));

    const result = validatePlanStatusTaxonomy(path.join(REPO_ROOT, 'docs', 'plans', 'example.md'), plan);
    expect(result.errors).toEqual([
      'docs/plans/example.md: referenced_reviews entry "docs/项目审查/2026-06-10-全项目综合审查报告.md" has role: origin / scope: in but no addresses_findings or deferred_findings; declare the finding ids it handles (see docs/contracts/workflows/review-closure-traceability.md) [referenced-review-missing-finding-ids]',
    ]);
  });

  test('plans without referenced_reviews are not failed (legacy pass-through)', () => {
    const plan = planWith('scope: Phase A');
    const result = validatePlanStatusTaxonomy(path.join(REPO_ROOT, 'docs', 'plans', 'example.md'), plan);
    expect(result.errors).toEqual([]);
  });

  test('cross-reference / deferred entries satisfy the check via deferred_findings', () => {
    const plan = planWith([
      'referenced_reviews:',
      '  - path: docs/项目审查/2026-06-14-达成度与闭环审查报告.md',
      '    role: origin',
      '    scope: in',
      '    addresses_findings: ["META-closure-break"]',
      '  - path: docs/项目审查/2026-06-10-全项目综合审查报告.md',
      '    role: cross-reference',
      '    scope: deferred',
      '    deferred_findings: ["P1-9", "P1-11"]',
      '    followup_plan: docs/plans/2026-06-99-001-followup-plan.md',
    ].join('\n'));

    const result = validatePlanStatusTaxonomy(path.join(REPO_ROOT, 'docs', 'plans', 'example.md'), plan);
    expect(result.errors).toEqual([]);
  });

  test('plans dated before the effective date are grandfathered even with a bare origin entry', () => {
    const legacyPlan = [
      '---',
      'title: Legacy',
      'type: feat',
      'status: completed',
      'date: 2026-05-07',
      'spec_id: 2026-05-07-001-legacy',
      'referenced_reviews:',
      '  - path: docs/项目审查/2026-05-07-skill-agent-prompt-expert-review.md',
      '    role: origin',
      '    scope: in',
      '---',
      '',
      '# Legacy',
    ].join('\n');

    const result = validatePlanStatusTaxonomy(path.join(REPO_ROOT, 'docs', 'plans', 'legacy.md'), legacyPlan);
    expect(result.errors).toEqual([]);
  });

  test('cross-reference entry with no finding ids is not failed (only origin/scope:in is enforced)', () => {
    const plan = planWith([
      'referenced_reviews:',
      '  - path: docs/项目审查/2026-06-10-全项目综合审查报告.md',
      '    role: cross-reference',
      '    scope: adjudicated',
    ].join('\n'));

    const result = validatePlanStatusTaxonomy(path.join(REPO_ROOT, 'docs', 'plans', 'example.md'), plan);
    expect(result.errors).toEqual([]);
  });
});
