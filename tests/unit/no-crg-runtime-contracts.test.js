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

describe('retired graph runtime removal contract', () => {
  test('runtime and source surfaces do not reference retired internal graph entrypoints', () => {
    const targets = [
      'bin',
      'src',
      'skills',
      'templates',
      'tests',
      'scripts',
      '.github',
      'package.json',
      'package-lock.json',
      '.claude-plugin',
    ];
    const patterns = [
      ['src/', 'crg'].join(''),
      ['spec-first ', 'crg'].join(''),
      ['spec-', 'graph', '-bootstrap'].join(''),
      ['graph', '-bootstrap'].join(''),
      ['graph', '\\.db'].join(''),
      ['crg', '\\.native_modules_status'].join(''),
      ['crg', '\\.cli_status'].join(''),
    ];

    expect(findMatches(targets, patterns)).toEqual([]);
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
});
