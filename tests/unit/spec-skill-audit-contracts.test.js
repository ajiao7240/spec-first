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
    expect(text).toContain('scripts only report deterministic evidence');
    expect(text).toContain('The LLM explains whether the drift affects governance, catalog, README/user-doc visibility, or source/runtime boundaries.');
    expect(text).toContain('Hard dependency gaps should point to setup/doctor/init repair commands; soft context gaps only lower confidence.');
    expect(text).not.toContain('automatically rewrite source skills when progressive disclosure drift is found');
    expect(text).not.toContain('token budget engine');
    expect(text).not.toContain('durable replay index');
  });
});
