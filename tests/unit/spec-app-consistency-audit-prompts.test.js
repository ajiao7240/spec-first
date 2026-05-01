'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const PROMPT_ROOT = path.join(REPO_ROOT, 'skills/spec-app-consistency-audit/prompts');
const SOURCE_LOCK_PATH = path.join(REPO_ROOT, 'skills/spec-app-consistency-audit/references/ecc-source-lock.json');

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

function readPrompt(name) {
  return fs.readFileSync(path.join(PROMPT_ROOT, name), 'utf8');
}

describe('spec-app-consistency-audit prompt contracts', () => {
  const prompts = fs.readdirSync(PROMPT_ROOT)
    .filter((entry) => entry.endsWith('.md'))
    .sort();

  test('all app-audit expert prompts keep read-only evidence-first boundaries', () => {
    for (const prompt of prompts) {
      const text = readPrompt(prompt);

      expect(text).toContain('## ECC 来源');
      expect(text).toContain('## 共同协议');
      expect(text).toContain('只读');
      expect(text).toContain('No evidence, no issue.');
      expect(text).toContain('generated runtime');
      expect(text).toMatch(/final verdict|最终 verdict/);
      expect(text).toMatch(/evidence|证据/);
      expect(text).toMatch(/provenance|source_inputs|来源/);
      expect(text).toMatch(/confidence|置信/);
      expect(text).toMatch(/contract_status|confirmed issue|confirmed/);
    }
  });

  test('ECC source lock records source hashes, removed capabilities, and skill-local targets', () => {
    const sourceLock = JSON.parse(fs.readFileSync(SOURCE_LOCK_PATH, 'utf8'));

    expect(sourceLock.schema_version).toBe('ecc-source-lock.v1');
    expect(sourceLock.source_repo.path).toBeUndefined();
    expect(sourceLock.integration_policy).toEqual(expect.objectContaining({
      mode: 'skill-local-read-only-lens',
      target_root: 'skills/spec-app-consistency-audit/prompts',
      do_not_copy_to_agents: true,
    }));
    expect(sourceLock.integration_policy.forbidden_capabilities).toEqual(expect.arrayContaining([
      'write',
      'edit',
      'repair',
      'build',
      'cleanup',
      'final_verdict',
    ]));
    expect(sourceLock.sources.map((entry) => entry.agent)).toEqual(expect.arrayContaining([
      'kotlin-reviewer',
      'a11y-architect',
      'silent-failure-hunter',
      'type-design-analyzer',
      'code-explorer',
      'code-architect',
      'pr-test-analyzer',
      'security-reviewer',
      'code-reviewer',
      'doc-updater',
    ]));

    for (const source of sourceLock.sources) {
      expect(source.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(source.removed_capabilities.length).toBeGreaterThan(0);
      expect(source.target_prompt_paths.length).toBeGreaterThan(0);
      for (const target of source.target_prompt_paths) {
        expect(target.startsWith('skills/spec-app-consistency-audit/prompts/')).toBe(true);
        expect(fs.existsSync(path.join(REPO_ROOT, target))).toBe(true);
      }
    }
  });

  test('skill and technical plan keep ECC-derived lenses out of global agents', () => {
    const skill = read('skills/spec-app-consistency-audit/SKILL.md');
    const plan = read('docs/02-架构设计/spec_app_consistency_audit_技术方案.md');

    expect(skill).toContain('Do not copy app-audit-specific experts or ECC-derived lenses into `agents/`');
    expect(skill).toContain('ECC-derived content may be used only as read-only lens');
    expect(plan).toContain('ECC 派生能力的落点先是 `skills/spec-app-consistency-audit/prompts/*.md`');
    expect(plan).toContain('不把 ECC commands、hooks 或原样 agent 文件导入 `spec-first/agents/`');
    expect(plan).toContain('ecc-source-lock.json');
    expect(plan).toContain('pilot-validation.md');
    expect(read('skills/spec-app-consistency-audit/references/pilot-validation.md')).toContain('ready_for_v0_2');
  });

  test('app-audit source assets avoid host-local provenance paths', () => {
    const files = [
      'skills/spec-app-consistency-audit/references/ecc-source-lock.json',
      'docs/02-架构设计/SPEC-APP-CONSISTENCY-AUDIT-ECC-AGENTS-INTEGRATION.md',
    ];

    for (const file of files) {
      const text = read(file);

      expect(text).not.toContain('/Users/');
      expect(text).not.toContain('file://');
    }
  });
});
