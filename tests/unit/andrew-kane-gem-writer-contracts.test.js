'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/andrew-kane-gem-writer/SKILL.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('andrew-kane-gem-writer contracts', () => {
  test('source skill preserves identity and core gem authoring patterns', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('name: andrew-kane-gem-writer');
    expect(skill).toContain('Simplicity over cleverness.');
    expect(skill).toContain('Every gem follows this exact pattern in `lib/gemname.rb`:');
    expect(skill).toContain('require_relative "gemname/railtie" if defined?(Rails)');
    expect(skill).toContain('class << self');
    expect(skill).toContain('self.timeout = 10');
  });

  test('source skill preserves rails integration, testing, and anti-pattern guardrails', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('Always use `ActiveSupport.on_load`');
    expect(skill).toContain('never require Rails gems directly');
    expect(skill).toContain('RSpec (use Minitest)');
    expect(skill).toContain('NO add_dependency lines - dev deps go in Gemfile');
    expect(skill).toContain('Committing Gemfile.lock in gems');
    expect(skill).toContain('method_missing');
  });

  test('runtime transforms preserve host-specific naming and avoid stale upstream namespace', () => {
    const sourceSkill = read(SKILL_PATH);
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();
    const claudeRuntime = claude.transformSkillContent(sourceSkill);
    const codexRuntime = codex.transformSkillContent(sourceSkill, {
      skillName: 'andrew-kane-gem-writer',
    });

    expect(claudeRuntime).toContain('name: andrew-kane-gem-writer');
    expect(codexRuntime).toContain('name: andrew-kane-gem-writer');
    expect(claudeRuntime).toContain('**Simplicity over cleverness.**');
    expect(codexRuntime).toContain('**Simplicity over cleverness.**');
    expect(claudeRuntime).not.toContain('compound-engineering');
    expect(codexRuntime).not.toContain('compound-engineering');
  });
});
