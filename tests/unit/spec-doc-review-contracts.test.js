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
});
