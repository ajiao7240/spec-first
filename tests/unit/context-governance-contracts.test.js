'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { buildBootstrapBlock } = require('../../src/cli/instruction-bootstrap');

const REPO_ROOT = path.join(__dirname, '..', '..');
const CONTRACT_PATH = path.join(REPO_ROOT, 'docs', 'contracts', 'context-governance.md');

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

describe('context governance runtime exclusion contract', () => {
  test('defines default runtime and generated mirror exclusions without becoming a router engine', () => {
    const contract = read('docs/contracts/context-governance.md');

    expect(contract).toContain('Default Exclusions');
    expect(contract).toContain('`.spec-first/audits/**`');
    expect(contract).toContain('`.claude/**`');
    expect(contract).toContain('`.codex/**`');
    expect(contract).toContain('`.agents/skills/**`');
    expect(contract).toContain('`runtime_audit_artifact_excluded`');
    expect(contract).toContain('`generated_runtime_mirror_excluded`');
    expect(contract).toContain('`outside_repo_context_excluded`');
    expect(contract).toContain('普通 workflow 仍可读取 checked-in source truth');
    expect(contract).toContain('禁止把 `.spec-first/audits/**`、`.claude/**`、`.codex/**`、`.agents/skills/**` 纳入默认');
    expect(contract).toContain('repo-relative canonical path');
    expect(contract).toContain('Allowed Exceptions');
    expect(contract).toContain('`spec-update` / `spec-mcp-setup`');
    expect(contract).toContain('`spec-skill-audit`');
    expect(contract).toContain('changelog author resolution');
    expect(contract).toContain('`.codex/spec-first/.developer`');
    expect(contract).toContain('user-explicit path request');
    expect(contract).toContain('不实现中心化 context router');
    expect(contract).toContain('不把 `.gitignore` 当作 LLM context policy 的唯一来源');
  });

  test('host bootstrap surfaces runtime exclusion to generated instruction files', () => {
    for (const [host, lang] of [
      ['codex', 'zh'],
      ['claude', 'zh'],
      ['codex', 'en'],
      ['claude', 'en'],
    ]) {
      const block = buildBootstrapBlock(host, lang);
      expect(block).toContain('.spec-first/audits/**');
      expect(block).toContain('.claude/**');
      expect(block).toContain('.codex/**');
      expect(block).toContain('.agents/skills/**');
    }

    expect(read('AGENTS.md')).toContain('Runtime context 默认排除 `.spec-first/audits/**`');
    expect(read('CLAUDE.md')).toContain('Runtime context 默认排除 `.spec-first/audits/**`');
  });

  test('high-frequency ordinary workflows carry the runtime exclusion rule', () => {
    const workflowPaths = [
      'skills/using-spec-first/SKILL.md',
      'skills/spec-work/SKILL.md',
      'skills/spec-work-beta/SKILL.md',
      'skills/spec-plan/SKILL.md',
      'skills/spec-code-review/SKILL.md',
      'skills/spec-doc-review/SKILL.md',
      'skills/spec-debug/SKILL.md',
      'skills/spec-compound/SKILL.md',
      'skills/spec-sessions/SKILL.md',
      'skills/spec-optimize/SKILL.md',
    ];

    for (const relativePath of workflowPaths) {
      const content = read(relativePath);
      expect(content).toContain('docs/contracts/context-governance.md');
      expect(content).toContain('.spec-first/audits/**');
      expect(content).toContain('.claude/**');
      expect(content).toContain('.codex/**');
      expect(content).toContain('.agents/skills/**');
    }
  });

  test('skill-audit documents its bounded audit-artifact exception', () => {
    const skillAudit = read('skills/spec-skill-audit/SKILL.md');

    expect(skillAudit).toContain('explicit exception to the ordinary runtime context exclusion');
    expect(skillAudit).toContain('.spec-first/audits/skill-audit/**');
    expect(skillAudit).toContain('Other workflows should treat `.spec-first/audits/**` as excluded runtime audit artifacts');
  });

  test('user-facing docs explain context exclusion separately from gitignore', () => {
    expect(fs.existsSync(CONTRACT_PATH)).toBe(true);
    expect(read('README.md')).toContain('What is excluded from ordinary context');
    expect(read('README.zh-CN.md')).toContain('普通上下文默认排除什么');
    expect(read('docs/05-用户手册/05-最佳实践.md')).toContain('普通 plan/work/debug/review/compound context 默认排除');
    expect(read('docs/05-用户手册/12-gitignore参考.md')).toContain('不应作为普通 LLM 上下文扫描源');
  });
});
