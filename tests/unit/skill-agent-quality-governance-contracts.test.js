'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const CONTRACT_PATH = path.join(REPO_ROOT, 'docs', 'contracts', 'workflows', 'skill-agent-quality-governance.md');
const DOCS_README_PATH = path.join(REPO_ROOT, 'docs', 'README.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('skill/agent quality governance thin contract', () => {
  test('contract document exists with required contract sections and non-goals', () => {
    const contract = read(CONTRACT_PATH);

    expect(contract).toContain('# Skill/Agent Quality Governance Thin Contract');
    expect(contract).toContain('## 0. Non-goals');
    expect(contract).toContain('Not a state machine');
    expect(contract).toContain('Not a hard gate platform');
    expect(contract).toContain('Not a universal JSON schema');
    expect(contract).toContain('Not a runtime mirror source');
    expect(contract).toContain('Not an eval platform');
    expect(contract).toContain('Skill Minimum Contract v1');
    expect(contract).toContain('High-risk Execution Safety Contract v1');
    expect(contract).toContain('Agent Output Contract Registry v1');
    expect(contract).toContain('Research Evidence Contract v1');
  });

  test('contract preserves source/runtime and existing exception boundaries', () => {
    const contract = read(CONTRACT_PATH);

    expect(contract).toContain('generated runtime mirrors such as `.claude/`, `.codex/`, and `.agents/skills/` are not source of truth');
    expect(contract).toContain('`spec-doc-review` personas receive output schema from `skills/spec-doc-review/references/subagent-template.md`');
    expect(contract).toContain('orchestrator dispatch');
    expect(contract).toContain('optional/internal skills do not need examples until they become high-risk, high-traffic, or downstream-consumed');
    expect(contract).toContain('they must not pretend to judge semantic quality');
  });

  test('docs index lists the contract as current source-of-truth documentation', () => {
    const readme = read(DOCS_README_PATH);

    expect(readme).toContain('docs/contracts/workflows/skill-agent-quality-governance.md');
    expect(readme).toContain('skill / agent 质量治理的薄契约、执行边界语言和例外说明');
  });
});
