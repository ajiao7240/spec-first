'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const { planBundledAssetSync } = require('../../src/cli/plugin');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-compound', 'SKILL.md');
const COMPOUND_REFRESH_SKILL_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-compound-refresh',
  'SKILL.md',
);
const COMPOUND_REFRESH_PER_ACTION_FLOWS_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-compound-refresh',
  'references',
  'per-action-flows.md',
);

function plannedRuntimeContent(adapter, targetPath) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-compound-runtime-'));

  try {
    const { plan } = planBundledAssetSync(projectRoot, adapter);
    const operation = plan.operations.find((entry) => entry.path === targetPath);
    if (!operation) {
      throw new Error(`Missing planned runtime operation for ${targetPath}`);
    }
    return operation.contents;
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
}

describe('spec-compound host entrypoint contract', () => {
  test('usage and follow-up guidance use current-host entrypoint wording', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('current host\'s compound entrypoint');
    expect(text).toContain('current host\'s compound entrypoint with brief context');
    expect(text).toContain('current host\'s compound entrypoint');
    expect(text).not.toContain('Use /spec:compound [context]');
    expect(text).not.toContain('re-run /spec:compound in a fresh session');
    expect(text).not.toContain('- `/spec:plan` - Planning workflow');
    expect(text).not.toContain('/spec:compound` on Claude Code');
    expect(text).not.toContain('$spec-compound` on Codex');
    expect(text).not.toContain('/spec:plan` on Claude Code');
    expect(text).not.toContain('$spec-plan` on Codex');
  });

  test('compound-refresh checks inbound links before deleting solution docs', () => {
    const text = [
      fs.readFileSync(COMPOUND_REFRESH_SKILL_PATH, 'utf8'),
      fs.readFileSync(COMPOUND_REFRESH_PER_ACTION_FLOWS_PATH, 'utf8'),
    ].join('\n');

    expect(text).toContain('Delete when the code is gone, and only after checking for inbound links');
    expect(text).toContain('Inbound links inform classification, not cleanup');
    expect(text).toContain('decorative');
    expect(text).toContain('substantive');
    expect(text).toContain('Search the filename slug (without `.md`)');
    expect(text).toContain('Auto-delete only when all three hold');
    expect(text).toContain('Inbound links are absent or unambiguously decorative');
    expect(text).toContain('Before unlinking the file, run a final inbound-link check');
    expect(text).not.toContain('Auto-delete only when both the implementation AND the problem domain are gone');
  });

  test('compound-refresh routes action execution to per-action reference without inline flow bloat', () => {
    const skill = fs.readFileSync(COMPOUND_REFRESH_SKILL_PATH, 'utf8');
    const reference = fs.readFileSync(COMPOUND_REFRESH_PER_ACTION_FLOWS_PATH, 'utf8');

    expect(skill).toContain('Load `skills/spec-compound-refresh/references/per-action-flows.md`');
    expect(skill).toContain('Replace still runs `python3 scripts/validate-frontmatter.py <new-learning-path>`');
    expect(skill).toContain('Delete still performs the final inbound-link check');
    expect(skill).not.toContain('### Keep Flow');
    expect(skill).not.toContain('### Update Flow');
    expect(skill).not.toContain('### Consolidate Flow');
    expect(skill).not.toContain('### Replace Flow');
    expect(skill).not.toContain('### Delete Flow');

    expect(reference).toContain('## Keep Flow');
    expect(reference).toContain('## Update Flow');
    expect(reference).toContain('## Consolidate Flow');
    expect(reference).toContain('## Replace Flow');
    expect(reference).toContain('## Delete Flow');
    expect(reference).toContain('python3 scripts/validate-frontmatter.py <new-learning-path>');
    expect(reference).toContain('Before unlinking the file, run a final inbound-link check');
  });

  test('Claude command projection points compound-refresh action flow reference at the workflow runtime copy', () => {
    const command = plannedRuntimeContent(new ClaudeAdapter(), '.claude/commands/spec/compound-refresh.md');

    expect(command).toContain('Load `.claude/spec-first/workflows/spec-compound-refresh/references/per-action-flows.md`');
    expect(command).not.toContain('Load `references/per-action-flows.md`');
    expect(command).not.toContain('Load `skills/spec-compound-refresh/references/per-action-flows.md`');
  });
});
