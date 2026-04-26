'use strict';

const fs = require('node:fs');
const path = require('node:path');

const AGENT_PATH = path.join(__dirname, '..', '..', 'agents', 'spec-pr-comment-resolver.agent.md');

describe('spec-pr-comment-resolver declined verdict contract', () => {
  test('classifies harmful suggested fixes separately from factually wrong feedback', () => {
    const text = fs.readFileSync(AGENT_PATH, 'utf8');

    expect(text).toContain('suggested fix would actively make the code worse');
    expect(text).toContain('violates a project rule in CLAUDE.md/AGENTS.md');
    expect(text).toContain('verdict: `declined` with the specific harm cited');
    expect(text).toContain('"the reviewer is factually wrong about the code" (`not-addressing`)');
    expect(text).toContain('"the suggested fix would actively make the code worse" (`declined`)');
    expect(text).toContain('Declined: [specific harm cited');
    expect(text).toContain('verdict: [fixed | fixed-differently | replied | not-addressing | declined | needs-human]');
  });
});
