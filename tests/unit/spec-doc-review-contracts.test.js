'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DOC_REVIEW_FILES = [
  path.join(__dirname, '..', '..', 'skills', 'spec-doc-review', 'SKILL.md'),
  path.join(__dirname, '..', '..', 'skills', 'spec-doc-review', 'references', 'bulk-preview.md'),
  path.join(__dirname, '..', '..', 'skills', 'spec-doc-review', 'references', 'decision-primer.md'),
  path.join(__dirname, '..', '..', 'skills', 'spec-doc-review', 'references', 'open-questions-defer.md'),
  path.join(__dirname, '..', '..', 'skills', 'spec-doc-review', 'references', 'synthesis-and-presentation.md'),
  path.join(__dirname, '..', '..', 'skills', 'spec-doc-review', 'references', 'walkthrough.md'),
];
const SUBAGENT_TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-doc-review',
  'references',
  'subagent-template.md',
);
const REVIEW_OUTPUT_TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-doc-review',
  'references',
  'review-output-template.md',
);

describe('spec-doc-review best-judgment wording contract', () => {
  test('user-visible doc review paths no longer expose LFG wording', () => {
    const combined = DOC_REVIEW_FILES.map((filePath) => fs.readFileSync(filePath, 'utf8')).join('\n');

    expect(combined).toContain('Auto-resolve with best judgment');
    expect(combined).toContain('Auto-resolve with best judgment on the rest');
    expect(combined).not.toContain('LFG');
    expect(combined).not.toContain('best-judgment-the-rest');
  });

  test('doc review keeps bulk-preview execution model instead of code-review option-C-only model', () => {
    const bulkPreview = fs.readFileSync(
      path.join(__dirname, '..', '..', 'skills', 'spec-doc-review', 'references', 'bulk-preview.md'),
      'utf8',
    );

    expect(bulkPreview).toContain('Routing option B');
    expect(bulkPreview).toContain('Routing option C');
    expect(bulkPreview).toContain('Walk-through `Auto-resolve with best judgment on the rest`');
    expect(bulkPreview).not.toContain('One call site');
    expect(bulkPreview).not.toContain('Best-judgment fix paths do **not** use this preview.');
  });

  test('doc review can classify and review derived task packs without making them a second plan', () => {
    const skill = fs.readFileSync(path.join(__dirname, '..', '..', 'skills', 'spec-doc-review', 'SKILL.md'), 'utf8');

    expect(skill).toContain('requirements, plan, or task-pack documents');
    expect(skill).toContain('frontmatter `type: task-pack`');
    expect(skill).toContain('derived rather than a second plan');
    expect(skill).toContain('Task Pack Contract');
    expect(skill).toContain('spec-first tasks validate --json');
  });

  test('doc review classifies by content shape and passes Origin to personas', () => {
    const skill = fs.readFileSync(path.join(__dirname, '..', '..', 'skills', 'spec-doc-review', 'SKILL.md'), 'utf8');
    const template = fs.readFileSync(SUBAGENT_TEMPLATE_PATH, 'utf8');

    expect(skill).toContain('classify the document by **content shape first**');
    expect(skill).toContain('Path is a hint, not the source of truth');
    expect(skill).toContain('Also extract the frontmatter `origin:` value when present.');
    expect(skill).toContain('| `{origin}` | Frontmatter `origin:` value when present, otherwise `none` |');
    expect(template).toContain('Origin: {origin}');
    expect(template).toContain('Use `Document type` and `Origin` to calibrate the review');
    expect(template).toContain('If `Origin` is not `none`, do not routinely re-litigate upstream WHAT/WHY');
  });

  test('doc review preserves visual aids and escapes table pipes', () => {
    const template = fs.readFileSync(SUBAGENT_TEMPLATE_PATH, 'utf8');
    const synthesis = fs.readFileSync(
      path.join(__dirname, '..', '..', 'skills', 'spec-doc-review', 'references', 'synthesis-and-presentation.md'),
      'utf8',
    );
    const outputTemplate = fs.readFileSync(REVIEW_OUTPUT_TEMPLATE_PATH, 'utf8');

    expect(template).toContain('Preserve useful diagrams and visual aids.');
    expect(synthesis).toContain('Visual aid preservation');
    for (const text of [synthesis, outputTemplate]) {
      expect(text.toLowerCase()).toContain('literal pipe');
      expect(text).toContain('`\\|`');
    }
  });

  test('walkthrough keeps normal best-judgment route and confines Acknowledge to no-fix cases', () => {
    const walkthrough = fs.readFileSync(
      path.join(__dirname, '..', '..', 'skills', 'spec-doc-review', 'references', 'walkthrough.md'),
      'utf8',
    );

    expect(walkthrough).toContain('D. Auto-resolve with best judgment on the rest');
    expect(walkthrough).toContain('Do not add an `Acknowledge` option to the normal per-finding menu.');
    expect(walkthrough).toContain('`Acknowledge` appears only in the no-fix sub-question');
    expect(walkthrough).toContain('Acknowledge without applying');
  });

  test('doc review uses bounded persona dispatch with Codex-capable report-only fallback', () => {
    const skill = fs.readFileSync(path.join(__dirname, '..', '..', 'skills', 'spec-doc-review', 'SKILL.md'), 'utf8');

    expect(skill).toContain('Dispatch Capability Gate');
    expect(skill).toContain('Dispatch capability is part of the runtime boundary, not a reviewer-selection preference.');
    expect(skill).toContain('authorizes this documented persona-reviewer phase; do not ask for a second "use subagents" confirmation');
    expect(skill).toContain('Default doc-review posture is multi-persona reviewer dispatch.');
    expect(skill).toContain('Do not interpret the absence of extra "use subagents" wording as report-only fallback');
    expect(skill).toContain('Codex supports reviewer dispatch through `spawn_agent`; do not downgrade solely because the host is Codex.');
    expect(skill).toContain('user explicitly requests report-only/no-agents mode');
    expect(skill).toContain('set `single_agent_report_only_fallback: true`');
    expect(skill).toContain('Treat the effective mode as report-only');
    expect(skill).toContain('Do not apply `safe_auto` fixes, append Open Questions, or edit the document.');
    expect(skill).toContain('single-agent report-only fallback: reviewer dispatch unavailable, explicitly disabled, or unsafe');
    expect(skill).toContain('Dispatch agents using **bounded parallelism**');
    expect(skill).toContain('active-agent/thread/concurrency-limit spawn errors as backpressure');
    expect(skill).not.toContain('Dispatch all agents in **parallel**');
    expect(skill).not.toContain('explicit user authorization');
  });

  test('doc review treats Summary as a framing-level section for chain roots', () => {
    const synthesis = fs.readFileSync(
      path.join(__dirname, '..', '..', 'skills', 'spec-doc-review', 'references', 'synthesis-and-presentation.md'),
      'utf8',
    );

    expect(synthesis).toContain('Problem Frame, Summary, Overview, Why, Motivation, Goals');
    expect(synthesis).toContain('`Summary` is the new spec-plan / spec-brainstorm template heading');
    expect(synthesis).toContain('`Overview` is retained as legacy');
  });

  test('doc review keeps multi-round decision-primer detail in a reference', () => {
    const skill = fs.readFileSync(path.join(__dirname, '..', '..', 'skills', 'spec-doc-review', 'SKILL.md'), 'utf8');
    const primer = fs.readFileSync(
      path.join(__dirname, '..', '..', 'skills', 'spec-doc-review', 'references', 'decision-primer.md'),
      'utf8',
    );
    const synthesis = fs.readFileSync(
      path.join(__dirname, '..', '..', 'skills', 'spec-doc-review', 'references', 'synthesis-and-presentation.md'),
      'utf8',
    );

    expect(skill).toContain('read `references/decision-primer.md`');
    expect(skill).toContain('The primer is the only cross-round memory for the current interactive invocation');
    expect(skill).not.toContain('Each entry carries an `Evidence:` line because synthesis R29');
    expect(primer).toContain('Each entry carries an `Evidence:` line because synthesis R29');
    expect(primer).toContain('R30 (fix-landed verification)');
    expect(primer).toContain('Cross-session persistence is out of scope');
    expect(synthesis).toContain('see `references/decision-primer.md`');
    expect(synthesis).not.toContain('see `SKILL.md` — Decision primer');
  });

  test('subagent template requires committed suggested fixes and consequence-first rationale', () => {
    const template = fs.readFileSync(SUBAGENT_TEMPLATE_PATH, 'utf8');

    expect(template).toContain('Classify your `suggested_fix` by what\'s written');
    expect(template).toContain('`suggested_fix` commits to one recommendation');
    expect(template).toContain('no menus of alternatives');
    expect(template).toContain('quote sandwich');
    expect(template).toContain('Cap embedded quotes at roughly 30 words combined');
    expect(template).toContain('"suggested_fix": "Require Units 1-4 to land in a single atomic PR."');
    expect(template).not.toContain('Require Units 1-4 to land in a single atomic PR, or define the sequence explicitly.');
  });
});
