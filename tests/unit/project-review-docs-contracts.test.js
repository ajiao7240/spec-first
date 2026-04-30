'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const PROJECT_REVIEW_DOCS_ROOT = path.join(REPO_ROOT, 'docs', '项目审查');

function listMarkdownFiles(dirPath) {
  return fs.readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) return listMarkdownFiles(entryPath);
    if (entry.isFile() && entry.name.endsWith('.md')) return [entryPath];
    return [];
  });
}

describe('project review docs contracts', () => {
  test('project review docs avoid machine-local markdown links', () => {
    for (const docPath of listMarkdownFiles(PROJECT_REVIEW_DOCS_ROOT)) {
      const content = fs.readFileSync(docPath, 'utf8');
      const relativePath = path.relative(REPO_ROOT, docPath);

      if (content.includes('/Users/kuang')) {
        throw new Error(`${relativePath} contains a machine-local absolute repo path`);
      }
      if (content.includes('file://')) {
        throw new Error(`${relativePath} contains a file:// link`);
      }
    }
  });
});
