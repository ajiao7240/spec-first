'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DOC_REVIEW_FILES = [
  path.join(__dirname, '..', '..', 'skills', 'spec-doc-review', 'SKILL.md'),
  path.join(__dirname, '..', '..', 'skills', 'spec-doc-review', 'references', 'bulk-preview.md'),
  path.join(__dirname, '..', '..', 'skills', 'spec-doc-review', 'references', 'open-questions-defer.md'),
  path.join(__dirname, '..', '..', 'skills', 'spec-doc-review', 'references', 'synthesis-and-presentation.md'),
  path.join(__dirname, '..', '..', 'skills', 'spec-doc-review', 'references', 'walkthrough.md'),
];
const SUBAGENT_TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-doc-review',
  'references',
  'subagent-template.md',
);

describe('spec-doc-review best-judgment wording contract', () => {
  test('user-visible doc review paths no longer expose LFG wording', () => {
    const combined = DOC_REVIEW_FILES.map((filePath) => fs.readFileSync(filePath, 'utf8')).join('\n');

    expect(combined).toContain('Auto-resolve with best judgment');
    expect(combined).toContain('Auto-resolve with best judgment on the rest');
    expect(combined).not.toContain('LFG');
    expect(combined).not.toContain('best-judgment-the-rest');
  });

  test('doc review keeps bulk-preview execution model instead of code-review option-C-only model', () => {
    const bulkPreview = fs.readFileSync(
      path.join(__dirname, '..', '..', 'skills', 'spec-doc-review', 'references', 'bulk-preview.md'),
      'utf8',
    );

    expect(bulkPreview).toContain('Routing option B');
    expect(bulkPreview).toContain('Routing option C');
    expect(bulkPreview).toContain('Walk-through `Auto-resolve with best judgment on the rest`');
    expect(bulkPreview).not.toContain('One call site');
    expect(bulkPreview).not.toContain('Best-judgment fix paths do **not** use this preview.');
  });

  test('doc review can classify and review derived task packs without making them a second plan', () => {
    const skill = fs.readFileSync(path.join(__dirname, '..', '..', 'skills', 'spec-doc-review', 'SKILL.md'), 'utf8');

    expect(skill).toContain('requirements, plan, or task-pack documents');
    expect(skill).toContain('frontmatter `type: task-pack`');
    expect(skill).toContain('derived rather than a second plan');
    expect(skill).toContain('Task Pack Contract');
    expect(skill).toContain('spec-first tasks validate --json');
  });

  test('subagent template requires committed suggested fixes and consequence-first rationale', () => {
    const template = fs.readFileSync(SUBAGENT_TEMPLATE_PATH, 'utf8');

    expect(template).toContain('Classify your `suggested_fix` by what\'s written');
    expect(template).toContain('`suggested_fix` commits to one recommendation');
    expect(template).toContain('no menus of alternatives');
    expect(template).toContain('quote sandwich');
    expect(template).toContain('Cap embedded quotes at roughly 30 words combined');
    expect(template).toContain('"suggested_fix": "Require Units 1-4 to land in a single atomic PR."');
    expect(template).not.toContain('Require Units 1-4 to land in a single atomic PR, or define the sequence explicitly.');
  });
});
