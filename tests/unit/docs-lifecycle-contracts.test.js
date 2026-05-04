'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const DOCS_INDEX_PATH = path.join(REPO_ROOT, 'docs', 'README.md');

describe('docs lifecycle contracts', () => {
  test('documents current, artifact, historical, archived, and external-reference states', () => {
    const source = fs.readFileSync(DOCS_INDEX_PATH, 'utf8');

    for (const state of ['current', 'active-artifact', 'historical-input', 'archived', 'external-reference']) {
      expect(source).toContain(state);
    }
  });

  test('marks historical architecture docs as background rather than source of truth', () => {
    const source = fs.readFileSync(DOCS_INDEX_PATH, 'utf8');

    expect(source).toContain('| `docs/02-架构设计/` | historical-input |');
    expect(source).toContain('引用前必须核对当前代码和角色契约');
    expect(source).toContain('代码、`skills/`、`src/cli/`、`docs/contracts/` 与 `CHANGELOG.md` 的事实优先级高于历史设计文档');
  });
});
