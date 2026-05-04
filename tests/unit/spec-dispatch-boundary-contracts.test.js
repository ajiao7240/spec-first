'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { getAdapter } = require('../../src/cli/adapters');

const REPO_ROOT = path.join(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

describe('CE-lineage dispatch boundary contracts', () => {
  test('audit matrix covers required dispatch-bearing skills with actions', () => {
    const matrix = read('docs/validation/2026-05-05-ce-dispatch-boundary-audit-matrix.md');
    const requiredSkills = [
      'spec-doc-review',
      'spec-code-review',
      'spec-plan',
      'spec-ideate',
      'spec-debug',
      'spec-optimize',
      'resolve-pr-feedback',
      'spec-work',
      'spec-work-beta',
      'agent-native-audit',
      'spec-compound',
      'spec-compound-refresh',
      'spec-brainstorm',
      'spec-slack-research',
    ];

    expect(matrix).toContain('CE Dispatch Boundary Audit Matrix');
    expect(matrix).toContain('CE is lineage evidence only');
    expect(matrix).toContain('Fixed Reference Quadrants');
    expect(matrix).toContain('repair_priority');
    expect(matrix).toContain('action');

    for (const skill of requiredSkills) {
      expect(matrix).toContain(skill);
    }
  });

  test('high-risk skills do not retain stale Codex anti-dispatch assumptions', () => {
    const combined = [
      'skills/spec-doc-review/SKILL.md',
      'skills/spec-code-review/SKILL.md',
      'skills/spec-plan/SKILL.md',
      'skills/spec-ideate/SKILL.md',
      'skills/resolve-pr-feedback/SKILL.md',
      'skills/spec-work/SKILL.md',
      'skills/spec-work-beta/SKILL.md',
      'skills/spec-optimize/SKILL.md',
      'skills/agent-native-audit/SKILL.md',
    ].map(read).join('\n');

    expect(combined).not.toMatch(/Codex cannot dispatch/i);
    expect(combined).not.toMatch(/Codex does not support agents/i);
    expect(combined).not.toContain('do not call `spawn_agent` merely because this skill mentions reviewer personas');
    expect(combined).not.toMatch(/Codex should inline reviewer personas/i);
  });

  test('Codex runtime never silently rewrites legacy Task dispatch to inline-only profile application', () => {
    const adapter = getAdapter('codex');
    const rendered = adapter.transformSkillContent(
      '- Task spec-repo-research-analyst(Scope: technology, architecture, patterns.)',
      {
        skillName: 'spec-plan',
        isWorkflowSkill: true,
      },
    );

    expect(rendered).toContain('Dispatch `.codex/agents/spec-repo-research-analyst.agent.md` with `spawn_agent`');
    expect(rendered).toContain('fallback: read the profile and apply it inline in the current agent only when `spawn_agent` is unavailable or disallowed');
    expect(rendered).not.toContain('Read `.codex/agents/spec-repo-research-analyst.agent.md` and apply that agent profile to');
  });

  test('mutating dispatch skills state isolation, serialization, and orchestrator ownership', () => {
    const resolveFeedback = read('skills/resolve-pr-feedback/SKILL.md');
    const work = read('skills/spec-work/SKILL.md');
    const workBeta = read('skills/spec-work-beta/SKILL.md');
    const optimize = read('skills/spec-optimize/SKILL.md');

    expect(resolveFeedback).toContain('Mutating resolver dispatch boundary');
    expect(resolveFeedback).toContain('The orchestrator owns final integration');
    expect(resolveFeedback).toContain('serialize the affected units or stop for orchestration');

    expect(work).toContain('Parallel Safety Check');
    expect(work).toContain('Codex `spawn_agent` / forked workspace');
    expect(work).toContain('The orchestrator owns final integration, staging, commits, and project-level verification.');
    expect(work).toContain('Shared-directory fallback constraints');

    expect(workBeta).toContain('Codex delegation (`codex exec`)');
    expect(workBeta).toContain('Codex `spawn_agent` / forked workspace');
    expect(workBeta).toContain('The orchestrator owns final integration, staging, commits, and project-level verification.');
    expect(workBeta).toContain('Shared-directory fallback constraints');

    expect(optimize).toContain('Dispatch And Backend Boundary');
    expect(optimize).toContain('Serial local/worktree execution remains the safe fallback');
    expect(optimize).toContain('The orchestrator owns final integration');
  });

  test('internal helper audit is capability-gated with sequential fallback', () => {
    const text = read('skills/agent-native-audit/SKILL.md');

    expect(text).toContain('internal helper skill');
    expect(text).toContain('not a public `spec-*` workflow entrypoint');
    expect(text).toContain('only when the host exposes a dispatch primitive and current session policy authorizes helper dispatch');
    expect(text).toContain('run the eight principle audits sequentially in the current agent');
    expect(text).toContain('Sub-agents are read-only explorers.');
    expect(text).toContain('Keep parallelism bounded to these eight principles');
  });
});
