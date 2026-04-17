'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_DIR  = path.join(REPO_ROOT, 'skills/every-style-editor');
const SKILL_PATH = path.join(SKILL_DIR, 'SKILL.md');
const REF_PATH   = path.join(SKILL_DIR, 'references/EVERY_WRITE_STYLE.md');

describe('every-style-editor skill contracts', () => {
  test('SKILL.md 存在且包含正确 front matter', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');
    expect(skill).toContain('name: every-style-editor');
  });

  test('references/EVERY_WRITE_STYLE.md 存在且包含核心内容', () => {
    const ref = fs.readFileSync(REF_PATH, 'utf8');
    expect(ref).toContain('Oxford comma');
    expect(ref).toContain('em dash');
  });

  test('目录文件列表为全量预期（防悄悄增删）', () => {
    const topFiles = fs.readdirSync(SKILL_DIR)
      .filter(f => !fs.statSync(path.join(SKILL_DIR, f)).isDirectory())
      .sort();
    const subDirs = fs.readdirSync(SKILL_DIR)
      .filter(f => fs.statSync(path.join(SKILL_DIR, f)).isDirectory())
      .sort();
    expect(topFiles).toEqual(['SKILL.md']);
    expect(subDirs).toEqual(['references']);
    const refFiles = fs.readdirSync(path.join(SKILL_DIR, 'references')).sort();
    expect(refFiles).toEqual(['EVERY_WRITE_STYLE.md']);
  });
});
