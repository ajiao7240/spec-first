'use strict';

const fs = require('node:fs');
const path = require('node:path');

const POST_IDEATION_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-ideate',
  'references',
  'post-ideation-workflow.md',
);
const UNIVERSAL_IDEATION_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-ideate',
  'references',
  'universal-ideation.md',
);
const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-ideate', 'SKILL.md');
const WEB_RESEARCH_CACHE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-ideate',
  'references',
  'web-research-cache.md',
);

describe('spec-ideate host entrypoint contract', () => {
  test('Proof handoff recommends the current host brainstorm entrypoint', () => {
    const text = fs.readFileSync(POST_IDEATION_PATH, 'utf8');

    expect(text).toContain('current host\'s brainstorm entrypoint');
    expect(text).not.toContain('**recommended next step:** `/spec:brainstorm`');
    expect(text).not.toContain('/spec:brainstorm` on Claude Code');
    expect(text).not.toContain('$spec-brainstorm` on Codex');
  });

  test('scratch paths use OS temp root and avoid colon-bearing workflow names', () => {
    const combined = [
      fs.readFileSync(SKILL_PATH, 'utf8'),
      fs.readFileSync(WEB_RESEARCH_CACHE_PATH, 'utf8'),
    ].join('\n');

    expect(combined).toContain('os.tmpdir()');
    expect(combined).toContain("path.join(os.tmpdir(),'spec-first','spec-ideate',runId)");
    expect(combined).toContain('"<scratch-root>"');
    expect(combined).not.toContain('SCRATCH_ROOT="/tmp/spec-first/spec-ideate"');
    expect(combined).not.toContain('/tmp/spec-first/spec-ideate/<run-id>');
    expect(combined).not.toContain('/tmp/spec-first/spec:ideate');
  });

  test('ideation dispatch is optional, read-only, and has sequential fallback', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Dispatch Boundary');
    expect(text).toContain('Ideation dispatch is optional and read-only.');
    expect(text).toContain('Direct invocation of the current host\'s ideation workflow authorizes the documented grounding and ideation sub-agent phases when host capability exists');
    expect(text).toContain('do not ask for a second subagent confirmation');
    expect(text).toContain('keep dispatch bounded to the counts computed in Phase 0.6');
    expect(text).toContain('run grounding and ideation sequentially or inline in the current agent');
    expect(text).toContain('workflow must still produce an ideation artifact when dispatch is unavailable');
    expect(text).toContain('The orchestrator owns scratch checkpoints, merged candidates, critique, and final artifact writes.');
  });

  test('per-idea artifact contract uses basis instead of the retired field name', () => {
    const combined = [
      fs.readFileSync(SKILL_PATH, 'utf8'),
      fs.readFileSync(POST_IDEATION_PATH, 'utf8'),
      fs.readFileSync(UNIVERSAL_IDEATION_PATH, 'utf8'),
    ].join('\n');
    const retiredField = 'war' + 'rant';

    expect(combined).toContain('**basis** (required, tagged)');
    expect(combined).toContain('**Basis:** [`direct:` / `external:` / `reasoned:`');
    expect(combined).toContain('Basis-integrity check');
    expect(combined).toContain('basis strength');
    expect(combined).not.toMatch(new RegExp(`\\*\\*${retiredField}\\*\\*`));
    expect(combined).not.toContain(`${retiredField} strength`);
    expect(combined).not.toContain(`${retiredField}-integrity`);
  });

  test('topic axes and bounded recovery are explicit but skipped for atomic and surprise-me subjects', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Phase 1.5: Topic Axes');
    expect(text).toContain('Skip axis decomposition for surprise-me mode');
    expect(text).toContain('atomic subject');
    expect(text).toContain('3-5 topic axes');
    expect(text).toContain('Axis coverage check');
    expect(text).toContain('dispatch at most 2 recovery agents');
    expect(text).toContain('Do not keep expanding axes');
  });

  test('user-named root markdown is a constraint without making all root markdown mandatory', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Root Markdown handling');
    expect(text).toContain('If the user explicitly names a repo-root `.md` file');
    expect(text).toContain('read that file completely as a constraint');
    expect(text).toContain('Other repo-root Markdown files are background only');
    expect(text).toContain('Do not reintroduce `STRATEGY.md` as a mandatory anchor');
  });
});
