'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/spec-work/SKILL.md');
const SHIPPING_WORKFLOW_PATH = path.join(
  REPO_ROOT,
  'skills/spec-work/references/shipping-workflow.md',
);

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('spec-work contracts', () => {
  test('source skill preserves work-workflow name, Stage-0 block, local enhancements, and input boundary redirect', () => {
    const skill = read(SKILL_PATH);

    // Source naming — Claude adapter will strip the skill prefix; Codex will rename to spec-work
    expect(skill).toContain('name: work-workflow');

    // Stage-0 preload block (local enhancement, not in upstream ce-work)
    expect(skill).toContain('context-routing.json');
    expect(skill).toContain('artifact-manifest.json');
    expect(skill).toContain('minimal-context/work.json');
    expect(skill).toContain('selected_assets / fallback_reason / level / skipped_rules');

    // Local execution governance enhancements
    expect(skill).toContain('Swarm Mode with Agent Teams');
    expect(skill).toContain('When to Use Reviewer Agents');
    expect(skill).toContain('bypassPermissions');

    // Input boundary redirect (B.3 Phase 1 — explicit, not implicit)
    expect(skill).toContain('/spec:plan');

    // Bare prompt triage must not exist (spec-work is plan-driven only)
    expect(skill).not.toContain('Phase 0: Input Triage');
    expect(skill).not.toContain('bare prompt');

    // No stale upstream references
    expect(skill).not.toContain('Compound Engineered badge');
    expect(skill).not.toContain('ce-demo-reel');
    expect(skill).not.toContain('ce:review');

    // Review contract coherence — skipping review is a pitfall
    expect(skill).toContain('Skipping review');
    expect(skill).not.toContain('Over-reviewing simple changes');

    // No duplicate quality checklist in SKILL.md (shipping-workflow.md is the single source)
    expect(skill).not.toContain('## Quality Checklist');
    expect(skill).toContain('simplify skill or equivalent capability');
    expect(skill).not.toContain('/simplify');
  });

  test('shipping-workflow preserves spec-review reference, Spec First badge, and no ce-demo-reel invocation', () => {
    const shipping = read(SHIPPING_WORKFLOW_PATH);

    // Review skill reference
    expect(shipping).toContain('spec-review');
    expect(shipping).not.toContain('ce:review');

    // Badge migration
    expect(shipping).toContain('Spec First badge');
    expect(shipping).not.toContain('Compound Engineered badge');

    // Evidence capture — no direct ce-demo-reel invocation
    expect(shipping).not.toContain('ce-demo-reel');

    // Mandatory review contract — tier determines depth, not whether review happens
    expect(shipping).toContain('review itself is never skipped');
  });

  test('runtime transforms preserve host-specific naming', () => {
    const sourceSkill = read(SKILL_PATH);
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();
    const claudeRuntime = claude.transformSkillContent(sourceSkill);
    const codexRuntime = codex.transformSkillContent(sourceSkill, { skillName: 'spec-work' });

    // Claude adapter: preserves source name (work-workflow is the skill name for Claude)
    expect(claudeRuntime).toContain('name: work-workflow');

    // Codex adapter: renames to directory name (spec-work) for Codex skill discovery
    expect(codexRuntime).toContain('name: spec-work');

    // Neither runtime should have stale upstream names
    expect(claudeRuntime).not.toContain('ce:work');
    expect(codexRuntime).not.toContain('ce:work');
  });
});
