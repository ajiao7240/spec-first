'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-graph-bootstrap', 'SKILL.md');

describe('spec-graph-bootstrap workspace contract', () => {
  test('uses workspace preflight at parent roots and preserves repo-local graph ownership', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('spec-first crg workspace scan');
    expect(text).toContain('spec-first crg workspace status');
    expect(text).toContain('spec-first crg workspace context');
    expect(text).toContain('不得创建父目录 `.spec-first/graph/graph.db`');
    expect(text).toContain('LLM/user 选择 child repo');
    expect(text).toContain('repo-topology.json');
    expect(text).toContain('spec-first crg explain --repo=<target> --node="<node-or-file-id>"');
    expect(text).toContain('本地 CRG probe');
    expect(text).toContain('不需要再二次确认');
    expect(text).not.toContain('stage0-context');
    expect(text).not.toContain('minimal-context');
    expect(text).not.toContain('docs/contexts');
    expect(text).not.toContain('spec-first crg explain --repo=<target> --id="<node-or-file-id>"');
  });
});
