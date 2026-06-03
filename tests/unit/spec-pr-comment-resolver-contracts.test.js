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

  test('defaults to fixing via tripwire-based evaluation without cluster mode', () => {
    const text = fs.readFileSync(AGENT_PATH, 'utf8');

    expect(text).toContain('You receive one review thread, PR comment, or review body at a time.');
    expect(text).toContain('Most review feedback -- across severities and nitpicks included -- is correct and worth fixing.');
    expect(text).toContain('The checks below are tripwires you notice during that read, not a gate to deliberate on per item.');
    expect(text).toContain('When no tripwire fires, fix it and move on');
    expect(text).toContain('don\'t manufacture doubt or risk to avoid work');
    expect(text).toContain('Small real improvements still get fixed');
    expect(text).toContain('Stay focused on the specific feedback item.');

    expect(text).not.toContain('<cluster-brief>');
    expect(text).not.toContain('Cluster Mode Workflow');
    expect(text).not.toContain('cluster_assessment');
  });
});
