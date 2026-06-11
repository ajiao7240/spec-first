'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { applyInitPlan, buildInitPlan } = require('../../src/cli/init-plan');
const { useIsolatedDeveloperHome } = require('./helpers/init-plan');

// applyInitPlan 会写全局 developer profile(~/.spec-first/.developer);隔离 HOME 避免污染运行机器。
useIsolatedDeveloperHome();

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-init-plan-'));
}

function snapshotTree(rootDir) {
  const results = [];

  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, absolutePath);
      if (entry.isDirectory()) {
        results.push(`${relativePath}/`);
        walk(absolutePath);
        continue;
      }

      results.push(`${relativePath}:${fs.readFileSync(absolutePath, 'utf8')}`);
    }
  }

  walk(rootDir);
  return results.sort();
}

function writeLegacyClaudeState(projectRoot) {
  const statePath = path.join(projectRoot, '.claude', 'spec-first', 'state.json');
  const oldSkillPath = path.join(projectRoot, '.claude', 'skills', 'old-skill', 'SKILL.md');
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.mkdirSync(path.dirname(oldSkillPath), { recursive: true });
  fs.writeFileSync(oldSkillPath, 'legacy runtime skill\n', 'utf8');
  fs.writeFileSync(
    statePath,
    `${JSON.stringify({
      manifestVersion: '0.0.0-old',
      platform: 'claude',
      commands: {},
      skills: ['old-skill'],
    }, null, 2)}\n`,
    'utf8',
  );
}

describe('init plan API', () => {
  test('buildInitPlan materializes a single-repo plan without writing files', () => {
    const projectRoot = makeTempDir();

    try {
      const before = snapshotTree(projectRoot);
      const plan = buildInitPlan({
        projectRoot,
        platform: 'codex',
        name: 'reviewer',
        lang: 'zh',
      });
      const after = snapshotTree(projectRoot);

      expect(plan).toMatchObject({
        schema_version: 'spec-first-init-plan.v1',
        mode: 'single-repo',
        platform: 'codex',
        projectRoot: fs.realpathSync.native(projectRoot),
        errors: [],
      });
      expect(after).toEqual(before);
      expect(plan.summary.write_file + (plan.summary.update_file || 0)).toBeGreaterThan(0);
      expect(plan.operationPlan.operations.map((operation) => operation.path)).toContain('AGENTS.md');
      expect(plan.operationPlan.operations.map((operation) => operation.path)).toContain('.codex/spec-first/state.json');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('applyInitPlan writes the materialized plan contents', () => {
    const projectRoot = makeTempDir();

    try {
      const plan = buildInitPlan({
        projectRoot,
        platform: 'claude',
        name: 'reviewer',
        lang: 'zh',
      });
      const result = applyInitPlan(projectRoot, plan);

      expect(result.exit_code).toBe(0);
      expect(fs.existsSync(path.join(projectRoot, 'CLAUDE.md'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, '.claude', 'commands', 'spec', 'work.md'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, '.claude', 'hooks', 'session-start'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, '.claude', 'hooks', 'spec-plan-guard'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, '.claude', 'spec-first', 'state.json'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, '.claude', 'spec-first', '.developer'))).toBe(false);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('legacy managed state is represented as destructive plan diagnostics before apply', () => {
    const projectRoot = makeTempDir();

    try {
      writeLegacyClaudeState(projectRoot);
      const plan = buildInitPlan({
        projectRoot,
        platform: 'claude',
        name: 'reviewer',
        lang: 'zh',
      });

      expect(plan.errors).toEqual([]);
      expect(plan.legacyStateDetected).toBe(true);
      expect(plan.destructiveResetReason).toBe('legacy_state_detected');
      expect(plan.destructiveResetPlan.summary.remove_dir).toBeGreaterThan(0);
      expect(plan.diagnostics.map((diagnostic) => diagnostic.code)).toContain('legacy_state_detected');

      const result = applyInitPlan(projectRoot, plan);
      expect(result.exit_code).toBe(0);
      expect(fs.existsSync(path.join(projectRoot, '.claude', 'skills', 'old-skill'))).toBe(false);
      expect(fs.existsSync(path.join(projectRoot, '.claude', 'commands', 'spec', 'work.md'))).toBe(true);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
