'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runInit } = require('../../src/cli/commands/init');
const { getAdapter } = require('../../src/cli/adapters');
const {
  getStateFilePath,
  hardResetManagedAssets,
  isLegacyManagedState,
  readState,
  removeManagedAssets,
  removeObsoleteManagedAssets,
} = require('../../src/cli/state');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-state-'));
}

describe('managed state contracts', () => {
  test('readState rejects malformed managed state missing required tracked arrays', () => {
    const projectRoot = makeTempDir();
    const adapter = getAdapter('claude');

    try {
      const statePath = getStateFilePath(projectRoot, adapter);
      fs.mkdirSync(path.dirname(statePath), { recursive: true });
      fs.writeFileSync(statePath, JSON.stringify({
        manifestVersion: '1.6.0',
        commands: [],
        skills: [],
        agents: [],
        agentSupportFiles: [],
      }, null, 2));

      expect(() => readState(projectRoot, adapter)).toThrow('missing required array field "workflowSkills"');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('isLegacyManagedState identifies missing tracked arrays as legacy shape', () => {
    expect(isLegacyManagedState({
      manifestVersion: '1.6.0',
      commands: [],
      skills: [],
      agents: [],
      agentSupportFiles: [],
    })).toBe(true);

    expect(isLegacyManagedState({
      manifestVersion: '1.6.0',
      commands: [],
      skills: [],
      workflowSkills: [],
      agents: [],
      agentSupportFiles: [],
    })).toBe(false);
  });

  test('Claude clean only removes explicitly tracked workflow-backed skills', () => {
    const projectRoot = makeTempDir();
    const adapter = getAdapter('claude');

    try {
      const trackedWorkflow = path.join(projectRoot, '.claude/spec-first/workflows/spec-review/SKILL.md');
      const untrackedWorkflow = path.join(projectRoot, '.claude/spec-first/workflows/custom-workflow/SKILL.md');
      fs.mkdirSync(path.dirname(trackedWorkflow), { recursive: true });
      fs.mkdirSync(path.dirname(untrackedWorkflow), { recursive: true });
      fs.writeFileSync(trackedWorkflow, 'name: spec-review\n', 'utf8');
      fs.writeFileSync(untrackedWorkflow, 'name: custom-workflow\n', 'utf8');

      removeManagedAssets(projectRoot, {
        commands: [],
        skills: [],
        workflowSkills: [],
        agents: [],
        agentSupportFiles: [],
      }, adapter);

      expect(fs.existsSync(trackedWorkflow)).toBe(true);
      expect(fs.existsSync(untrackedWorkflow)).toBe(true);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Claude hard reset removes legacy workflow root before re-init', () => {
    const projectRoot = makeTempDir();
    const adapter = getAdapter('claude');

    try {
      const managedWorkflow = path.join(projectRoot, '.claude/spec-first/workflows/spec-review/SKILL.md');
      const staleWorkflow = path.join(projectRoot, '.claude/spec-first/workflows/obsolete-workflow/SKILL.md');
      const customSkill = path.join(projectRoot, '.claude/skills/custom-skill/SKILL.md');
      fs.mkdirSync(path.dirname(managedWorkflow), { recursive: true });
      fs.mkdirSync(path.dirname(staleWorkflow), { recursive: true });
      fs.mkdirSync(path.dirname(customSkill), { recursive: true });
      fs.writeFileSync(managedWorkflow, 'name: spec-review\n', 'utf8');
      fs.writeFileSync(staleWorkflow, 'name: obsolete-workflow\n', 'utf8');
      fs.writeFileSync(customSkill, 'name: custom-skill\n', 'utf8');

      hardResetManagedAssets(projectRoot, {
        commands: [],
        skills: ['spec-review'],
        workflowSkills: ['spec-review'],
        agents: [],
        agentSupportFiles: [],
      }, adapter);

      expect(fs.existsSync(path.join(projectRoot, '.claude/spec-first/workflows'))).toBe(false);
      expect(fs.existsSync(customSkill)).toBe(true);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Codex clean preserves custom skills outside the managed set', () => {
    const projectRoot = makeTempDir();
    const adapter = getAdapter('codex');

    try {
      const managedSkill = path.join(projectRoot, '.agents/skills/spec-review/SKILL.md');
      const customSkill = path.join(projectRoot, '.agents/skills/custom-skill/SKILL.md');
      fs.mkdirSync(path.dirname(managedSkill), { recursive: true });
      fs.mkdirSync(path.dirname(customSkill), { recursive: true });
      fs.writeFileSync(managedSkill, 'name: spec-review\n', 'utf8');
      fs.writeFileSync(customSkill, 'name: custom-skill\n', 'utf8');

      removeManagedAssets(projectRoot, {
        commands: [],
        skills: [],
        workflowSkills: ['spec-review'],
        agents: [],
        agentSupportFiles: [],
      }, adapter);

      expect(fs.existsSync(managedSkill)).toBe(false);
      expect(fs.existsSync(customSkill)).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, '.agents/skills'))).toBe(true);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Codex init hard reset removes legacy-only managed skills while preserving custom skills', () => {
    const projectRoot = makeTempDir();
    const adapter = getAdapter('codex');
    const previousCwd = process.cwd();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const legacyStatePath = getStateFilePath(projectRoot, adapter);
      const removedManagedSkill = path.join(projectRoot, '.agents/skills/removed-managed-skill/SKILL.md');
      const customSkill = path.join(projectRoot, '.agents/skills/custom-skill/SKILL.md');
      fs.mkdirSync(path.dirname(legacyStatePath), { recursive: true });
      fs.mkdirSync(path.dirname(removedManagedSkill), { recursive: true });
      fs.mkdirSync(path.dirname(customSkill), { recursive: true });
      fs.writeFileSync(removedManagedSkill, 'name: removed-managed-skill\n', 'utf8');
      fs.writeFileSync(customSkill, 'name: custom-skill\n', 'utf8');
      fs.writeFileSync(legacyStatePath, JSON.stringify({
        manifestVersion: 'legacy-review-fixture',
        platform: 'codex',
        commands: [],
        skills: ['removed-managed-skill'],
        agents: [],
        agentSupportFiles: [],
        developer: {
          path: '.codex/spec-first/.developer',
          name: 'legacy-user',
          lang: 'en',
          initializedAt: '2026-04-17T00:00:00.000Z',
          version: 'legacy-review-fixture',
        },
      }, null, 2));

      process.chdir(projectRoot);
      expect(runInit(['--codex', '-u', 'reviewer', '--lang', 'en'])).toBe(0);

      expect(fs.existsSync(path.join(projectRoot, '.agents/skills/removed-managed-skill'))).toBe(false);
      expect(fs.existsSync(customSkill)).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, '.agents/skills/spec-work/SKILL.md'))).toBe(true);
    } finally {
      warnSpy.mockRestore();
      logSpy.mockRestore();
      process.chdir(previousCwd);
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Claude init prunes stale workflow-backed skill directories tracked in state', () => {
    const projectRoot = makeTempDir();
    const adapter = getAdapter('claude');

    try {
      const staleWorkflow = path.join(projectRoot, '.claude/spec-first/workflows/obsolete-workflow/SKILL.md');
      const retainedWorkflow = path.join(projectRoot, '.claude/spec-first/workflows/spec-review/SKILL.md');
      fs.mkdirSync(path.dirname(staleWorkflow), { recursive: true });
      fs.mkdirSync(path.dirname(retainedWorkflow), { recursive: true });
      fs.writeFileSync(staleWorkflow, 'name: obsolete-workflow\n', 'utf8');
      fs.writeFileSync(retainedWorkflow, 'name: spec-review\n', 'utf8');

      removeObsoleteManagedAssets(projectRoot, {
        commands: [],
        skills: [],
        workflowSkills: ['obsolete-workflow', 'spec-review'],
        agents: [],
        agentSupportFiles: [],
      }, {
        commands: [],
        skills: [],
        workflowSkills: ['spec-review'],
        agents: [],
        agentSupportFiles: [],
      }, adapter);

      expect(fs.existsSync(staleWorkflow)).toBe(false);
      expect(fs.existsSync(retainedWorkflow)).toBe(true);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
