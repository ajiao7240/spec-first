'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const CONTRACT_PATH = path.join(
  REPO_ROOT,
  'docs',
  'contracts',
  'workflows',
  'self-reflection-capability-upgrade.md',
);

describe('self-reflection capability upgrade contract', () => {
  test('anchors the required report set and report frontmatter fields', () => {
    const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
    const requiredReports = [
      '00-summary.md',
      '01-composition-baseline.md',
      '02-capability-gaps.md',
      '03-industry-github-best-practices.md',
      '04-capability-upgrade-decisions.md',
      '05-prioritized-roadmap.md',
      '06-next-self-reflection-input.md',
      '07-continuous-iteration-loop.md',
    ];
    const requiredFrontmatter = [
      'generated_at:',
      'source_commit:',
      'branch:',
      'dirty_state:',
      'reviewed_inputs:',
    ];

    expect(contract).toContain('docs/<YYYY-MM-DD>-self-reflection-upgrade/');
    for (const fileName of requiredReports) {
      expect(contract).toContain(fileName);
    }
    for (const field of requiredFrontmatter) {
      expect(contract).toContain(field);
    }
    expect(contract).toContain('If a cycle intentionally writes fewer files, `00-summary.md` must explain why');
  });

  test('keeps external-tool freshness vocabulary stable and bounded', () => {
    const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
    const statuses = [
      'current',
      'stale',
      'partial',
      'unavailable',
      'not-used',
    ];

    expect(contract).toContain('## External-Tool Freshness Classification');
    for (const status of statuses) {
      expect(contract).toContain(`| \`${status}\``);
    }
    expect(contract).toContain('fallback evidence used');
    expect(contract).toContain('confidence and limitations');
  });

  test('draws the structural-check versus semantic-judgment boundary', () => {
    const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');

    expect(contract).toContain('Scripts/tools may prepare:');
    expect(contract).toContain('LLM/reviewers decide:');
    expect(contract).toContain('Structural checks may fail a report for missing required fields.');
    expect(contract).toContain('They must not decide semantic quality or upgrade priority.');
    expect(contract).toContain('Do not add scripts that decide capability gaps, CUD status, priority, or semantic effectiveness.');
  });

  test('does not require spec-evolve, a new agent, or runtime rewrite behavior', () => {
    const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');

    expect(contract).toContain('它不是新 workflow、command、skill、agent、runtime state machine 或自动 rewrite 系统。');
    expect(contract).toContain('Do not add `spec-evolve` by default.');
    expect(contract).toContain('Do not add a self-reflection agent profile without a named repeated gap.');
    expect(contract).toContain('Do not build auto-rewrite or auto-upgrade behavior.');
    expect(contract).toContain('CUD-006 `spec-evolve`: skipped.');
    expect(contract).toContain('CUD-007 self-reflection agent profile: skipped.');
    expect(contract).not.toContain('spec-evolve is required');
    expect(contract).not.toContain('must add `spec-evolve`');
  });
});
