'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills', 'spec-write-tasks', 'SKILL.md');
const SCHEMA_PATH = path.join(REPO_ROOT, 'skills', 'spec-write-tasks', 'references', 'task-pack-schema.md');
const GUIDE_PATH = path.join(REPO_ROOT, 'skills', 'spec-write-tasks', 'references', 'task-quality-guide.md');
const OPENAI_PATH = path.join(REPO_ROOT, 'skills', 'spec-write-tasks', 'agents', 'openai.yaml');
const SPEC_WORK_PATH = path.join(REPO_ROOT, 'skills', 'spec-work', 'SKILL.md');
const SPEC_WORK_BETA_PATH = path.join(REPO_ROOT, 'skills', 'spec-work-beta', 'SKILL.md');
const PLAN_HANDOFF_PATH = path.join(REPO_ROOT, 'skills', 'spec-plan', 'references', 'plan-handoff.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('spec-write-tasks contracts', () => {
  test('source skill preserves derived-task-pack boundaries and task-ready flow', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('name: spec-write-tasks');
    expect(skill).toContain('optional derived layer between `spec-plan` and `spec-work`');
    expect(skill).toContain('`spec-plan` is always the single source of truth');
    expect(skill).toContain('A task pack is a derived artifact; it must not become a second plan.');
    expect(skill).toContain('Task-Ready Check');
    expect(skill).toContain('`compile`: the plan is clear enough');
    expect(skill).toContain('`skip`: the plan is small');
    expect(skill).toContain('`return-to-plan`: key scope');
    expect(skill).toContain('`draft-only`: a non-executable draft');
    expect(skill).toContain('Compilation Algorithm');
    expect(skill).toContain('not a script state machine');
    expect(skill).toContain('Quality Pass Before Output');
    expect(skill).toContain('Source Summary');
    expect(skill).toContain('Traceability Matrix');
    expect(skill).toContain('Task Quality Guide');
    expect(skill).toContain('If deterministic hash tooling is unavailable, report the task pack as unverifiable handoff');
  });

  test('task pack schema requires executable handoff metadata and quality structures', () => {
    const schema = read(SCHEMA_PATH);

    expect(schema).toContain('source_plan_hash: "sha256:<64-hex>"');
    expect(schema).toContain('Executable handoff must be `derived`');
    expect(schema).toContain('transient slices are not stable `spec-work` input');
    expect(schema).toContain('do not write an executable handoff');
    expect(schema).toContain('Traceability Matrix');
    expect(schema).toContain('Every task card must include these fields');
    expect(schema).toContain('Optional Task Fields');
    expect(schema).toContain('Granularity Guide');
    expect(schema).toContain('Scripts must not judge task splitting quality');
  });

  test('quality guide owns quality examples without redefining schema fields', () => {
    const guide = read(GUIDE_PATH);

    expect(guide).toContain('Task Quality Guide');
    expect(guide).toContain('`task-pack-schema.md` remains the source of truth for required fields');
    expect(guide).toContain('The quality bar is not whether every field is filled');
    expect(guide).toContain('Bad Smells');
    expect(guide).toContain('### Good');
    expect(guide).toContain('### Bad');
  });

  test('spec-work variants validate task packs before creating execution tasks', () => {
    for (const filePath of [SPEC_WORK_PATH, SPEC_WORK_BETA_PATH]) {
      const skill = read(filePath);

      expect(skill).toContain('If the work document is a task pack, validate it before creating execution tasks');
      expect(skill).toContain('read its frontmatter and confirm `type: task-pack`, `generated_by: spec-write-tasks`, `status: derived`, and `mode: derived`');
      expect(skill).toContain('treat that plan as the single source of truth');
      expect(skill).toContain('`sha256:<64-hex>`');
      expect(skill).toContain('compare the task pack hash against the current source plan using deterministic hash tooling');
      expect(skill).toContain('if that tooling is unavailable, treat the task pack as unverifiable and stop');
      expect(skill).toContain('reject draft, transient, missing-source, missing-hash, unavailable-hash-tooling, unverifiable-hash, or hash-mismatch task packs before implementation');
      expect(skill).toContain('do not silently fall back to executing stale task cards');
      expect(skill).toContain("honor each task's `stop_if`");
      expect(skill).toContain('do not create execution tasks until the task-pack validation checks above have passed');
    }
  });

  test('openai metadata keeps task compilation optional and host-neutral', () => {
    const metadata = read(OPENAI_PATH);

    expect(metadata).toContain('Compile settled plans into optional derived task packs');
    expect(metadata).toContain('first decide whether task compilation is warranted');
    expect(metadata).toContain('the appropriate spec-work workflow');
    expect(metadata).not.toContain('$spec-work');
    expect(metadata).not.toContain('/spec:work');
  });

  test('spec-plan handoff only offers task-pack execution for executable task packs', () => {
    const handoff = read(PLAN_HANDOFF_PATH);

    expect(handoff).toContain('Load the standalone `spec-write-tasks` skill with the plan path');
    expect(handoff).toContain('If it writes an executable task pack with verifiable `source_plan_hash`');
    expect(handoff).toContain('offer to proceed to `/spec:work <task-pack-path>`');
    expect(handoff).toContain('If it returns `skip`, `return-to-plan`, `draft-only`, or a non-executable task pack');
    expect(handoff).toContain('do not offer task-pack execution');
  });
});
