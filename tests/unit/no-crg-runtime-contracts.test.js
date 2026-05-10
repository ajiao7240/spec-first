'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');

function listFiles(targets) {
  const files = [];

  function walk(absolutePath) {
    if (!fs.existsSync(absolutePath)) return;
    const stats = fs.lstatSync(absolutePath);
    if (stats.isSymbolicLink()) return;
    if (stats.isDirectory()) {
      for (const entry of fs.readdirSync(absolutePath)) {
        walk(path.join(absolutePath, entry));
      }
      return;
    }
    if (stats.isFile()) {
      files.push(absolutePath);
    }
  }

  for (const target of targets) {
    walk(path.join(REPO_ROOT, target));
  }

  return files;
}

function findMatches(targets, patterns) {
  const regexes = patterns.map((pattern) => new RegExp(pattern, 'i'));
  const matches = [];

  for (const filePath of listFiles(targets)) {
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch (_error) {
      continue;
    }
    for (const regex of regexes) {
      if (regex.test(content)) {
        matches.push(path.relative(REPO_ROOT, filePath).replace(/\\/g, '/'));
        break;
      }
    }
  }

  return [...new Set(matches)].sort();
}

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

describe('retired internal graph runtime removal contract', () => {
  test('runtime code does not reference retired internal graph entrypoints', () => {
    const targets = [
      'bin',
      'src',
      'scripts',
      '.github',
      'package.json',
      'package-lock.json',
      '.claude-plugin',
    ];
    const patterns = [
      ['src/', 'crg'].join(''),
      ['spec-first ', 'crg'].join(''),
      ['graph', '\\.db'].join(''),
      ['crg', '\\.native_modules_status'].join(''),
      ['crg', '\\.cli_status'].join(''),
    ];

    expect(findMatches(targets, patterns)).toEqual([]);
  });

  test('external graph bootstrap is allowed without restoring internal CRG source', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, 'src', 'crg'))).toBe(false);
    expect(fs.existsSync(path.join(REPO_ROOT, 'skills', 'spec-graph-bootstrap', 'SKILL.md'))).toBe(true);
    expect(fs.readFileSync(path.join(REPO_ROOT, 'skills', 'spec-graph-bootstrap', 'SKILL.md'), 'utf8')).toContain(
      'external graph-provider',
    );
  });

  test('package and install surfaces do not reference retired native graph dependencies', () => {
    const targets = [
      'package.json',
      'package-lock.json',
      'bin/postinstall.js',
      '.github',
      'tests/smoke',
    ];
    const patterns = [
      ['better', '-sqlite3'].join(''),
      ['tree', '-sitter'].join(''),
    ];

    expect(fs.existsSync(path.join(REPO_ROOT, 'bin', 'prune-native.js'))).toBe(false);
    expect(fs.existsSync(path.join(REPO_ROOT, 'vendor', 'tree-sitter-objc'))).toBe(false);
    expect(fs.existsSync(path.join(REPO_ROOT, 'vendor', 'tree-sitter-swift'))).toBe(false);
    expect(findMatches(targets, patterns)).toEqual([]);
  });

  test('current user-facing docs do not advertise retired internal graph runtime surfaces', () => {
    const targets = [
      'CLAUDE.md',
      'AGENTS.md',
      'README.md',
      'README.zh-CN.md',
      'docs/05-用户手册',
    ];
    const patterns = [
      ['src/', 'crg'].join(''),
      ['spec-first ', 'crg'].join(''),
      ['graph', '\\.db'].join(''),
      ['stage0', '-context'].join(''),
      ['src/', 'bootstrap-compiler'].join(''),
      ['src/', 'context-routing'].join(''),
      'CRG 图',
      'CRG runtime',
    ];

    expect(findMatches(targets, patterns)).toEqual([]);
  });

  test('FAQ may mention retired native dependencies only as troubleshooting context', () => {
    const targets = [
      'CLAUDE.md',
      'AGENTS.md',
      'README.md',
      'README.zh-CN.md',
      'docs/05-用户手册',
    ];
    const patterns = [
      ['tree', '-sitter'].join(''),
      ['better', '-sqlite3'].join(''),
    ];
    const faq = read('docs/05-用户手册/04-常见问题.md');

    expect(findMatches(targets, patterns)).toEqual(['docs/05-用户手册/04-常见问题.md']);
    expect(faq).toContain('退役旧内置图运行时');
    expect(faq).toContain('不应再编译这些 native modules');
    expect(faq).toContain('不代表 package CLI 安装失败');
  });
});
