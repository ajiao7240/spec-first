'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');
const {
  buildFilteredAssetSet,
  loadPluginManifest,
  syncBundledAssets,
} = require('../../src/cli/plugin');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/spec-app-consistency-audit/SKILL.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('spec-app-consistency-audit entry contract', () => {
  test('source skill keeps static-first app-audit boundaries', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('name: spec-app-consistency-audit');
    expect(skill).toContain('Default to `static_only`.');
    expect(skill).toContain('## Mode Contract');
    expect(skill).toContain('mode:headless');
    expect(skill).toContain('mode:report-only');
    expect(skill).toContain('.spec-first/app-audit/runs/<run-id>/');
    expect(skill).toContain('report-only');
    expect(skill).toContain('Do not hand-edit generated runtime assets.');
    expect(skill).toContain('skills/spec-app-consistency-audit/prompts/');
    expect(skill).toContain('Do not copy app-audit-specific experts or ECC-derived lenses into `agents/`');
    expect(skill).toContain('No evidence, no issue.');
    expect(skill).toContain('Rule packs can explain risk and rationale, but they cannot be the only evidence');
    expect(skill).toContain('`provenance` and `evidence` entries must contain a traceable project field');
    expect(skill).toContain('`industry:<name>` is an explicit lens, not a confirmed industry profile');
    expect(skill).toContain('## Figma MCP Materialization');
    expect(skill).toContain('has_figma_reference');
    expect(skill).toContain('## Figma Redaction Policy');
    expect(skill).toContain('Default to `--redaction internal`.');
    expect(skill).toContain('.spec-first/app-audit/runs/<run-id>/writeback-preview/');
    expect(skill).toContain('skills/spec-app-consistency-audit/scripts/');
    expect(skill).toContain('build-impact-facts.js');
    expect(skill).toContain('Scripts produce structured candidate or preview artifacts');
    expect(skill).toContain('skills/spec-app-consistency-audit/rule-packs/');
  });

  test('plugin manifest exposes a Claude command mapped to the app-audit skill', () => {
    const manifest = loadPluginManifest();
    const command = manifest.commands.find((entry) => entry.name === 'app-consistency-audit');

    expect(command).toMatchObject({
      filename: 'app-consistency-audit.md',
      description: 'Run the Spec-First App consistency audit workflow',
      argumentHint: '[mode:headless|mode:report-only] [base:<ref>] [source:<path>] [prd:<path>] [figma-context:<path>|figma-ref:<id-or-url>] [industry:<name>] [depth:deep]',
      skill: 'spec-app-consistency-audit',
    });
  });

  test('dual-host governance delivers Claude command and Codex workflow skill only', () => {
    const claudeAssets = buildFilteredAssetSet('claude');
    const codexAssets = buildFilteredAssetSet('codex');

    expect(claudeAssets.commands.map((command) => command.name)).toContain('app-consistency-audit');
    expect(claudeAssets.workflowSkills).toContain('spec-app-consistency-audit');
    expect(codexAssets.workflowSkills).toContain('spec-app-consistency-audit');
    expect(codexAssets.commands.map((command) => command.name)).not.toContain('app-consistency-audit');
  });

  test('runtime sync writes generated assets from source without touching repo runtime', () => {
    const claudeProject = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-app-audit-claude-'));
    const codexProject = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-app-audit-codex-'));

    try {
      syncBundledAssets(claudeProject, new ClaudeAdapter());
      syncBundledAssets(codexProject, new CodexAdapter());

      const claudeCommandPath = path.join(
        claudeProject,
        '.claude',
        'commands',
        'spec',
        'app-consistency-audit.md',
      );
      const claudeWorkflowSkillPath = path.join(
        claudeProject,
        '.claude',
        'spec-first',
        'workflows',
        'spec-app-consistency-audit',
        'SKILL.md',
      );
      const codexWorkflowSkillPath = path.join(
        codexProject,
        '.agents',
        'skills',
        'spec-app-consistency-audit',
        'SKILL.md',
      );
      const codexCommandPath = path.join(
        codexProject,
        '.codex',
        'commands',
        'spec',
        'app-consistency-audit.md',
      );

      expect(fs.existsSync(claudeCommandPath)).toBe(true);
      const claudeCommand = read(claudeCommandPath);
      const codexWorkflowSkill = read(codexWorkflowSkillPath);

      expect(claudeCommand).toContain('# App Consistency Audit');
      expect(claudeCommand).toContain('No evidence, no issue.');
      expect(claudeCommand).toContain('mode:headless');
      expect(claudeCommand).toContain('.spec-first/app-audit/runs/<run-id>/');
      expect(claudeCommand).not.toContain('Source truth for this workflow lives under:');
      expect(claudeCommand).not.toContain('- `.claude/spec-first/workflows/spec-app-consistency-audit/`');
      expect(fs.existsSync(claudeWorkflowSkillPath)).toBe(true);
      expect(fs.existsSync(codexWorkflowSkillPath)).toBe(true);
      expect(codexWorkflowSkill).toContain('Default to `static_only`.');
      expect(codexWorkflowSkill).toContain('mode:report-only');
      expect(codexWorkflowSkill).not.toContain('Source truth for this workflow lives under:');
      expect(codexWorkflowSkill).not.toContain('- `.agents/skills/spec-app-consistency-audit/`');
      expect(codexWorkflowSkill).not.toContain('spec-first init --codex|--codex');
      expect(fs.existsSync(codexCommandPath)).toBe(false);
    } finally {
      fs.rmSync(claudeProject, { recursive: true, force: true });
      fs.rmSync(codexProject, { recursive: true, force: true });
    }
  });
});
