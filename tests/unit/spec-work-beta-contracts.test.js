'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/spec-work-beta/SKILL.md');
const PROMPT_MIRROR_SKILL_PATH = path.join(REPO_ROOT, 'docs/10-prompt/skills/spec-work-beta/SKILL.md');
const DELEGATION_WORKFLOW_PATH = path.join(
  REPO_ROOT,
  'skills/spec-work-beta/references/codex-delegation-workflow.md',
);
const SHIPPING_WORKFLOW_PATH = path.join(
  REPO_ROOT,
  'skills/spec-work-beta/references/shipping-workflow.md',
);

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function countMatches(source, pattern) {
  return (source.match(pattern) || []).length;
}

describe('spec-work-beta contracts', () => {
  test('source skill preserves internal naming, delegate contract, Stage-0, and governance', () => {
    const skill = read(SKILL_PATH);

    // Source naming
    expect(skill).toContain('name: work-beta-workflow');

    // Headless mode prevents token burn on skill load
    expect(skill).toContain('disable-model-invocation: true');

    // Delegation argument token
    expect(skill).toContain('delegate:codex');
    expect(skill).toContain('argument-hint:');
    expect(skill).toContain('run `/spec:plan` first to produce one');

    // Stage-0 preload block
    expect(skill).toContain('context-routing.json');
    expect(skill).toContain('artifact-manifest.json');
    expect(skill).toContain('minimal-context/work.json');
    expect(skill).toContain('platform_focus');
    expect(skill).toContain('required_verifications');
    expect(skill).toContain('optional_verifications');
    expect(skill).toContain('recommended_required_verifications');
    expect(skill).toContain('repo_required_verifications');
    expect(skill).toContain('verifier_dispatch');
    expect(skill).toContain('handoff_posture');
    expect(skill).toContain('dispatch_candidates');
    expect(skill).toContain('manual_required_verifications');
    expect(skill).toContain('dispatch_blockers');
    expect(skill).toContain('ai_dev_quality_gate_result');
    expect(skill).toContain('verification_evidence');
    expect(skill).toContain('verification_gate_state');
    expect(skill).toContain('overall_status / required_gates / blockers');
    expect(skill).toContain('verification summary');
    expect(skill).toContain('effective checklist');
    expect(skill).toContain('change-surface');
    expect(skill).toContain('stage0-context --stage work --workflow spec-work-beta --format json');
    expect(skill).toContain('__SPEC_FIRST_STAGE0_CONTEXT_UNAVAILABLE__');
    expect(skill).toContain('selected_assets / fallback_reason / level / skipped_rules');
    expect(skill).toContain('`spec:work-beta` 当前有意复用 stable `work` Stage-0 产物与 telemetry 口径');
    expect(skill).toContain('default verification checklist');
    expect(skill).toContain('pending-vs-blocked-or-satisfied verification ledger');
    expect(countMatches(skill, /^## Stage-0 上下文预载（可选增强，不阻断主工作流）$/gm)).toBe(1);

    // Execution governance — bypassPermissions rationale
    expect(skill).toContain('bypassPermissions');

    // Swarm mode present
    expect(skill).toContain('Swarm Mode with Agent Teams');

    // Review governance
    expect(skill).toContain('When to Use Reviewer Agents');
    expect(skill).toContain('Skipping review');
    expect(skill).toContain('simplify skill or equivalent capability');
    expect(skill).not.toContain('/simplify');

    // No bare prompt triage (plan-driven only)
    // Note: skill may say "does not accept bare prompts" as a redirect — that is correct behavior.
    // Guard only against the old inline-triage phase header.
    expect(skill).not.toContain('Phase 0: Input Triage');

    // No stale upstream references
    expect(skill).not.toContain('Compound Engineered badge');
    expect(skill).not.toContain('ce-demo-reel');
    expect(skill).not.toContain('ce:review');
  });

  test('source skill consumes external-delegate as a deterministic routing contract', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('Treat the exact string `Execution target: external-delegate` as the canonical delegation signal.');
    expect(skill).toContain('delegation candidate');
    expect(skill).toContain('resolve `delegation_scope` for this invocation');
    expect(skill).toContain('temporarily enable Codex delegation for those candidate units only in this session');
    expect(skill).toContain('Do not write that temporary choice to `.spec-first/config.local.yaml`.');
    expect(skill).toContain('Set `delegation_scope = candidate-only` by default.');
    expect(skill).toContain('If `delegation_scope` covers the current task: branch to the Codex Delegation Execution Loop');
  });

  test('delegation workflow preserves run_in_background contract, spec-first paths, and consent invariants', () => {
    const delegation = read(DELEGATION_WORKFLOW_PATH);

    // Critical: run_in_background must be a Bash tool parameter, not shell &
    expect(delegation).toContain('run_in_background: true');
    expect(delegation).toContain('separate Bash tool calls');
    expect(delegation).toContain('separate Bash call');
    expect(delegation).toContain('timeout ceiling');

    // Scratch and config paths must point to .spec-first (not .compound-engineering)
    expect(delegation).toContain('.spec-first/workflows/work-beta/codex-delegation/');
    expect(delegation).toContain('.spec-first/config.local.yaml');
    expect(delegation).not.toContain('.compound-engineering/');

    // Consent acceptance path must include directory creation step
    expect(delegation).toContain('if file or directory does not exist, create');
    expect(delegation).toContain('.spec-first/');

    // Step B must instruct separate Bash calls per poll iteration (not looping inside one call)
    expect(delegation).toContain('another separate Bash call');

    // No stale upstream invocation names
    expect(delegation).not.toContain('ce:work-beta');
    expect(delegation).not.toContain('ce-work-beta');
  });

  test('shipping-workflow preserves spec-review reference, Spec First badge, and no ce-demo-reel', () => {
    const shipping = read(SHIPPING_WORKFLOW_PATH);

    // Review skill reference
    expect(shipping).toContain('spec-review');
    expect(shipping).not.toContain('ce:review');

    // Badge migration
    expect(shipping).toContain('Spec First badge');
    expect(shipping).not.toContain('Compound Engineered badge');

    // No direct ce-demo-reel invocation
    expect(shipping).not.toContain('ce-demo-reel');

    // Mandatory review contract
    expect(shipping).toContain('review itself is never skipped');
  });

  test('runtime transforms preserve host-specific naming', () => {
    const sourceSkill = read(SKILL_PATH);
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();
    const claudeRuntime = claude.transformSkillContent(sourceSkill);
    const codexRuntime = codex.transformSkillContent(sourceSkill, { skillName: 'spec-work-beta' });

    // Claude adapter: preserves source name (work-beta-workflow)
    expect(claudeRuntime).toContain('name: work-beta-workflow');

    // Codex adapter: renames to directory name (spec-work-beta)
    expect(codexRuntime).toContain('name: spec-work-beta');

    // Neither runtime should have stale upstream names
    expect(claudeRuntime).not.toContain('ce:work-beta');
    expect(codexRuntime).not.toContain('ce:work-beta');
  });

  test('docs mirror stays aligned on verification summary Stage-0 contract', () => {
    const mirror = read(PROMPT_MIRROR_SKILL_PATH);

    expect(mirror).toContain('platform_focus');
    expect(mirror).toContain('required_verifications');
    expect(mirror).toContain('optional_verifications');
    expect(mirror).toContain('recommended_required_verifications');
    expect(mirror).toContain('repo_required_verifications');
    expect(mirror).toContain('verifier_dispatch');
    expect(mirror).toContain('handoff_posture');
    expect(mirror).toContain('dispatch_candidates');
    expect(mirror).toContain('manual_required_verifications');
    expect(mirror).toContain('dispatch_blockers');
    expect(mirror).toContain('ai_dev_quality_gate_result');
    expect(mirror).toContain('verification_evidence');
    expect(mirror).toContain('verification_gate_state');
    expect(mirror).toContain('overall_status / required_gates / blockers');
    expect(mirror).toContain('verification summary');
    expect(mirror).toContain('effective checklist');
    expect(mirror).toContain('change-surface');
    expect(mirror).toContain('stage0-context --stage work --workflow spec-work-beta --format json');
    expect(mirror).toContain('__SPEC_FIRST_STAGE0_CONTEXT_UNAVAILABLE__');
    expect(mirror).toContain('default verification checklist');
    expect(mirror).toContain('pending-vs-blocked-or-satisfied verification ledger');
  });
});
