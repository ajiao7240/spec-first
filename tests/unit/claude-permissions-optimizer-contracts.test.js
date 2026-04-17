'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/claude-permissions-optimizer/SKILL.md');
const EXTRACT_SCRIPT_PATH = path.join(REPO_ROOT, 'skills/claude-permissions-optimizer/scripts/extract-commands.mjs');
const NORMALIZE_SCRIPT_PATH = path.join(REPO_ROOT, 'skills/claude-permissions-optimizer/scripts/normalize.mjs');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('claude-permissions-optimizer contracts', () => {
  test('skill keeps cross-agent precheck and spec-first reporting contracts', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('Determine whether you are currently running inside Claude Code or a different coding agent');
    expect(skill).toContain('You\'re currently in [agent name], but I can still optimize your Claude Code permissions from here');
    expect(skill).toContain('## Analysis (spec-first-plugin)');
    expect(skill).toContain('Use `greenRawCount`');
    expect(skill).toContain('alreadyCovered / totalExtracted * 100');
    expect(skill).toContain('(alreadyCovered + greenRawCount) / totalExtracted * 100');

    expect(skill).not.toContain('## Analysis (compound-engineering-plugin)');
  });

  test('extract script preserves bounded scan defaults and safety classification output', () => {
    const script = read(EXTRACT_SCRIPT_PATH);

    expect(script).toContain('const days = parseInt(flag("days", "30"), 10);');
    expect(script).toContain('const maxSessions = parseInt(flag("max-sessions", "500"), 10);');
    expect(script).toContain('const minCount = parseInt(flag("min-count", "5"), 10);');
    expect(script).toContain('settings.local.json');
    expect(script).toContain('Irreversible file deletion');
    expect(script).toContain('Force push overwrites remote history');
    expect(script).toContain('Arbitrary code execution');
    expect(script).toContain('redExamples: redBlocked.slice(0, 5)');
    expect(script).toContain('yellowFootnote: yellowNames.length > 0');
  });

  test('normalize script preserves risk-aware normalization for sed/find/ast-grep', () => {
    const normalizeScript = read(NORMALIZE_SCRIPT_PATH);

    expect(normalizeScript).toContain('if (/^sed\\s/.test(command))');
    expect(normalizeScript).toContain('if (/^find\\s/.test(command))');
    expect(normalizeScript).toContain('if (/^(ast-grep|sg)\\s/.test(command))');
    expect(normalizeScript).toContain('if (isRiskFlag(parts[i], base))');
  });
});
