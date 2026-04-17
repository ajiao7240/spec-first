'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_DIR = path.join(REPO_ROOT, 'skills/onboarding');
const SKILL_PATH = path.join(SKILL_DIR, 'SKILL.md');
const SCRIPT_PATH = path.join(SKILL_DIR, 'scripts/inventory.mjs');

describe('onboarding skill contracts', () => {
  test('SKILL.md 存在且包含正确 front matter', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');
    expect(skill).toContain('name: onboarding');
  });

  test('scripts/inventory.mjs 存在', () => {
    expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
  });

  test('目录文件列表为全量预期（防悄悄增删）', () => {
    const files = fs.readdirSync(SKILL_DIR)
      .filter(f => !fs.statSync(path.join(SKILL_DIR, f)).isDirectory())
      .sort();
    const subDirs = fs.readdirSync(SKILL_DIR)
      .filter(f => fs.statSync(path.join(SKILL_DIR, f)).isDirectory())
      .sort();
    expect(files).toEqual(['SKILL.md']);
    expect(subDirs).toEqual(['scripts']);
    const scripts = fs.readdirSync(path.join(SKILL_DIR, 'scripts')).sort();
    expect(scripts).toEqual(['inventory.mjs']);
  });
});
