'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { getAdapter } = require('../../src/cli/adapters');
const {
  buildFilteredAssetSet,
  getSkillsGovernancePath,
  inspectInstalledAssets,
  listBundledCommands,
  listBundledSkills,
  loadPluginManifest,
  loadSkillsGovernance,
  syncBundledAssets,
  validateSkillsGovernance,
} = require('../../src/cli/plugin');

const REPO_ROOT = path.join(__dirname, '..', '..');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-governance-'));
}

describe('skills governance contracts', () => {
  test('machine-readable governance truth source covers every bundled skill exactly once', () => {
    const governancePath = getSkillsGovernancePath();
    const governance = loadSkillsGovernance();
    const manifest = loadPluginManifest();
    const bundledSkills = listBundledSkills();
    const workflowSkills = manifest.commands.map((command) => command.skill).sort((a, b) => a.localeCompare(b));
    const governedSkills = governance.skills.map((record) => record.skill_name).sort((a, b) => a.localeCompare(b));
    const governedWorkflowSkills = governance.skills
      .filter((record) => record.entry_surface === 'workflow_command')
      .map((record) => record.skill_name)
      .sort((a, b) => a.localeCompare(b));

    expect(fs.existsSync(governancePath)).toBe(true);
    expect(path.relative(REPO_ROOT, governancePath)).toBe(
      path.join('src', 'cli', 'contracts', 'dual-host-governance', 'skills-governance.json'),
    );
    expect(governedSkills).toEqual(bundledSkills);
    expect(governedWorkflowSkills).toEqual(workflowSkills);

    expect(governance.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skill_name: 'orchestrating-swarms',
          entry_surface: 'standalone_skill',
          host_scope: 'host_exclusive',
          owner_host: 'claude',
          host_delivery: {
            claude: 'skill',
            codex: 'none',
          },
        }),
        expect.objectContaining({
          skill_name: 'claude-permissions-optimizer',
          entry_surface: 'standalone_skill',
          host_scope: 'target_host_maintenance',
          owner_host: 'claude',
          host_delivery: {
            claude: 'skill',
            codex: 'skill',
          },
        }),
        expect.objectContaining({
          skill_name: 'spec-work-beta',
          entry_surface: 'standalone_skill',
          host_scope: 'dual_host',
          command_name: null,
          owner_host: null,
          host_delivery: {
            claude: 'skill',
            codex: 'skill',
          },
        }),
      ]),
    );
  });

  test('filtered asset set respects dual-host governance for workflow and standalone skills', () => {
    const manifest = loadPluginManifest();
    const claudeAssets = buildFilteredAssetSet('claude');
    const codexAssets = buildFilteredAssetSet('codex');
    const workflowSkillNames = manifest.commands.map((command) => command.skill).sort((a, b) => a.localeCompare(b));

    expect(claudeAssets.commands).toHaveLength(manifest.commands.length);
    expect(codexAssets.commands).toEqual([]);

    expect(claudeAssets.workflowSkills).toEqual(workflowSkillNames);
    expect(codexAssets.workflowSkills).toEqual(workflowSkillNames);

    expect(claudeAssets.skills).toContain('orchestrating-swarms');
    expect(codexAssets.skills).not.toContain('orchestrating-swarms');
    expect(claudeAssets.skills).toContain('claude-permissions-optimizer');
    expect(codexAssets.skills).toContain('claude-permissions-optimizer');
    expect(codexAssets.skills).toContain('spec-work-beta');

    expect(codexAssets.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillName: 'orchestrating-swarms',
          platform: 'codex',
          reason: expect.stringContaining('host_delivery.codex=none'),
        }),
      ]),
    );
  });

  test('target_host_maintenance requires delivery on a non-owner host', () => {
    const governance = loadSkillsGovernance();
    const brokenGovernance = {
      schemaVersion: governance.schemaVersion,
      skills: governance.skills.map((record) => (
        record.skill_name === 'claude-permissions-optimizer'
          ? {
            ...record,
            host_delivery: {
              claude: 'skill',
              codex: 'none',
            },
          }
          : { ...record }
      )),
    };

    expect(() => validateSkillsGovernance(brokenGovernance)).toThrow(
      'must also deliver target_host_maintenance skill "claude-permissions-optimizer" on at least one non-owner host',
    );
  });

  test('codex sync and inspection use the governed filtered asset set', () => {
    const projectRoot = makeTempDir();
    const adapter = getAdapter('codex');

    try {
      const synced = syncBundledAssets(projectRoot, adapter);
      const installed = inspectInstalledAssets(projectRoot, adapter);
      const workflowCommands = listBundledCommands().map((command) => command.skill);

      expect(synced.commands).toEqual([]);
      expect(synced.workflowSkills).toEqual(workflowCommands.sort((a, b) => a.localeCompare(b)));
      expect(synced.skills).not.toContain('orchestrating-swarms');
      expect(synced.skills).toContain('claude-permissions-optimizer');

      expect(fs.existsSync(path.join(projectRoot, '.agents/skills/spec-work/SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, '.agents/skills/claude-permissions-optimizer/SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, '.agents/skills/orchestrating-swarms/SKILL.md'))).toBe(false);

      expect(installed.skills.entries).not.toContain('orchestrating-swarms');
      expect(installed.skills.missing).toEqual([]);
      expect(installed.commands.entries).toEqual([]);
      expect(installed.commands.missing).toEqual([]);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
