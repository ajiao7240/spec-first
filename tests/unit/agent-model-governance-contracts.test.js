'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const GOVERNANCE_CONTRACT_PATH = path.join(
  REPO_ROOT,
  'docs/contracts/dual-host-governance/README.md'
);
const DOCUMENT_REVIEW_SKILL_PATH = path.join(
  REPO_ROOT,
  'skills/document-review/SKILL.md'
);
const LINT_AGENT_PATH = path.join(
  REPO_ROOT,
  'agents/workflow/lint.md'
);

const INHERITED_MODEL_AGENTS = [
  'agents/document-review/design-lens-reviewer.md',
  'agents/document-review/scope-guardian-reviewer.md',
  'agents/document-review/security-lens-reviewer.md',
  'agents/research/slack-researcher.md'
];

const FIXED_MODEL_EXCEPTIONS = [
  {
    relativePath: 'agents/document-review/coherence-reviewer.md',
    modelFrontmatter: 'model: haiku'
  },
  {
    relativePath: 'agents/workflow/lint.md',
    modelFrontmatter: 'model: haiku'
  }
];

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('agent model governance contracts', () => {
  test('dual-host governance contract defines inherit-as-default policy and explicit pinning bar', () => {
    const contract = read(GOVERNANCE_CONTRACT_PATH);

    expect(contract).toContain('Agent 模型选择 Contract');
    expect(contract).toContain('默认使用 `model: inherit`');
    expect(contract).toContain('只有在存在明确代码事实时才允许固定模型');
    expect(contract).toContain('固定模型必须在最近的 contract、测试或分析文档中给出理由');
    expect(contract).toContain('design-lens-reviewer');
    expect(contract).toContain('scope-guardian-reviewer');
    expect(contract).toContain('security-lens-reviewer');
    expect(contract).toContain('slack-researcher');
  });

  test.each(INHERITED_MODEL_AGENTS)('%s remains on model: inherit', (relativePath) => {
    const agent = read(path.join(REPO_ROOT, relativePath));

    expect(agent).toContain('model: inherit');
    expect(agent).not.toContain('model: sonnet');
  });

  test('dual-host governance contract records evidence-backed fixed-model exceptions', () => {
    const contract = read(GOVERNANCE_CONTRACT_PATH);
    const documentReviewSkill = read(DOCUMENT_REVIEW_SKILL_PATH);
    const lintAgent = read(LINT_AGENT_PATH);

    expect(contract).toContain('当前已被治理并允许固定模型的例外');
    expect(contract).toContain('coherence-reviewer');
    expect(contract).toContain('workflow/lint');
    expect(contract).toContain('always-on reviewer');
    expect(contract).toContain('standardrb');
    expect(documentReviewSkill).toContain('coherence-reviewer (always-on)');
    expect(lintAgent).toContain('bundle exec standardrb');
    expect(lintAgent).toContain('bundle exec erblint --lint-all');
    expect(lintAgent).toContain('bin/brakeman');
  });

  test.each(FIXED_MODEL_EXCEPTIONS)('%s keeps its evidence-backed fixed model', ({ relativePath, modelFrontmatter }) => {
    const agent = read(path.join(REPO_ROOT, relativePath));

    expect(agent).toContain(modelFrontmatter);
    expect(agent).not.toContain('model: inherit');
  });
});
