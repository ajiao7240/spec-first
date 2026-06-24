'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-skill-audit', 'SKILL.md');

describe('spec-skill-audit contract', () => {
  test('audits progressive-disclosure drift without becoming an auto-rewriter', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Progressive Disclosure Checks');
    expect(text).toContain('deterministic release/governance guard results');
    expect(text).toContain('Treat skill entry prompts as progressive-disclosure surfaces.');
    expect(text).toContain('Flag source skills whose main `SKILL.md` entrypoint carries long examples, duplicate rubrics, provider-specific details, large checklists, or operational reference material');
    expect(text).toContain('should live in `references/`, `scripts/`, `assets/`, or eval files');
    expect(text).toContain('The finding is an optimization/risk signal, not an automatic rewrite order.');
    expect(text).toContain('references/skill-authoring-quality.md');
    expect(text).toContain('description-as-trigger, entry surface fit, information hierarchy, completion criteria, pruning, leading words, and failure modes');
    expect(text).toContain('scripts only report deterministic evidence');
    expect(text).toContain('The LLM explains whether the drift affects governance, catalog, README/user-doc visibility, or source/runtime boundaries.');
    expect(text).toContain('Hard dependency gaps should point to setup/doctor/init repair commands; soft context gaps only lower confidence.');
    expect(text).not.toContain('automatically rewrite source skills when progressive disclosure drift is found');
    expect(text).not.toContain('token budget engine');
    expect(text).not.toContain('durable replay index');
  });

  test('entrypoint stays lean: no duplicate contract sections and within size cap', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');
    const lines = text.split(/\r?\n/);

    // 契约字段只允许在 Workflow Contract Summary 中出现一次。
    const duplicateContractHeadings = lines.filter((line) => (
      /^## (When To Use|When Not To Use|Inputs|Outputs|Failure Modes)\s*$/.test(line)
    ));
    expect(duplicateContractHeadings).toEqual([]);

    // 去重后锁住入口体量，防止静默回涨；字符上限为 contract 固定的 context-governance 文案留余量。
    expect(lines.length).toBeLessThanOrEqual(180);
    expect(text.length).toBeLessThanOrEqual(9500);
  });

  test('expert rubric applies authoring-quality vocabulary as semantic review signals', () => {
    const rubric = fs.readFileSync(
      path.join(__dirname, '..', '..', 'skills', 'spec-skill-audit', 'references', 'expert-audit-rubric.md'),
      'utf8',
    );
    const authoringRubric = fs.readFileSync(
      path.join(__dirname, '..', '..', 'skills', 'spec-skill-audit', 'references', 'skill-authoring-quality.md'),
      'utf8',
    );

    expect(rubric).toContain('Skill Authoring Quality Rule');
    expect(rubric).toContain('description-as-trigger');
    expect(rubric).toContain('not deterministic gates or automatic rewrite orders');
    expect(authoringRubric).toContain('Use this lens when a finding is about how a skill is written, migrated, or refactored.');
    expect(authoringRubric).toContain('P1 Candidates');
    expect(authoringRubric).toContain('P2 Candidates');
    expect(authoringRubric).toContain('qualification step');
    expect(authoringRubric).toContain('one-off, explain-only, document-export, or future-outline');
    expect(authoringRubric).toContain('quality tier or gate selection is vague');
    expect(authoringRubric).toContain('Progressive disclosure drift is an optimization/risk signal');
  });
});
