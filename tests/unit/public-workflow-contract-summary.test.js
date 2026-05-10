'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

const HIGH_FREQUENCY_WORKFLOWS = [
  'spec-code-review',
  'spec-plan',
  'spec-work',
  'spec-doc-review',
];

describe('public workflow contract summary', () => {
  test('high-frequency public workflows expose a compact I/O and failure summary near the entrypoint', () => {
    for (const workflow of HIGH_FREQUENCY_WORKFLOWS) {
      const skillPath = path.join(ROOT, 'skills', workflow, 'SKILL.md');
      const text = fs.readFileSync(skillPath, 'utf8');
      const firstHundredLines = text.split(/\r?\n/).slice(0, 100).join('\n');

      expect(firstHundredLines).toContain('## Workflow Contract Summary');
      expect(firstHundredLines).toContain('### When To Use');
      expect(firstHundredLines).toContain('### When Not To Use');
      expect(firstHundredLines).toContain('### Inputs');
      expect(firstHundredLines).toContain('### Outputs');
      expect(firstHundredLines).toContain('### Artifacts');
      expect(firstHundredLines).toContain('### Failure Modes');
      expect(firstHundredLines).toContain('### Workflow');
      expect(firstHundredLines).toContain('### Downstream Consumers');
    }
  });

  test('summaries preserve source/runtime and script/LLM boundaries', () => {
    const codeReview = fs.readFileSync(
      path.join(ROOT, 'skills', 'spec-code-review', 'SKILL.md'),
      'utf8',
    );
    const plan = fs.readFileSync(path.join(ROOT, 'skills', 'spec-plan', 'SKILL.md'), 'utf8');
    const work = fs.readFileSync(path.join(ROOT, 'skills', 'spec-work', 'SKILL.md'), 'utf8');
    const docReview = fs.readFileSync(
      path.join(ROOT, 'skills', 'spec-doc-review', 'SKILL.md'),
      'utf8',
    );

    expect(codeReview).toContain('graph/MCP evidence as advisory review context');
    expect(codeReview).toContain('treating graph/provider startup failure as a reviewer failure');
    expect(plan).toContain('degraded standards/graph facts stay advisory');
    expect(plan).toContain('implementation-dependent questions are deferred to `spec-work`');
    expect(work).toContain('planned spec-work run JSON schema is not current runtime truth');
    expect(work).toContain('hand-editing generated runtime mirrors as source fixes');
    expect(docReview).toContain('No repo-local JSON run artifact is promised');
    expect(docReview).toContain('treating a task pack as an independent source plan');
  });
});
