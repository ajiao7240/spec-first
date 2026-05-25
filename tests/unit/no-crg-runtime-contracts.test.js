'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const {
  getSpecFirstGitignorePatternMetadata,
  getSpecFirstGitignorePatterns,
} = require('../../src/cli/gitignore-policy');
const packageJson = require('../../package.json');
const HISTORICAL_USER_MANUAL_DOCS = new Set([
  'docs/05-用户手册/15-code-review-graph-全流程执行分析.md',
  'docs/05-用户手册/17-GitNexus-刷新策略与Provider收敛决策.md',
  'docs/05-用户手册/18-CodeGraph-GitNexus-CRG-平替评估.md',
]);

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

function compareSemver(left, right) {
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < 3; index += 1) {
    const delta = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (delta !== 0) return delta;
  }
  return 0;
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

    const matches = findMatches(targets, patterns);
    const allowedPackageEvidenceDenylist = 'scripts/npm-install-matrix-smoke.js';
    const smokeScript = read(allowedPackageEvidenceDenylist);

    expect(matches).toEqual([allowedPackageEvidenceDenylist]);
    expect(smokeScript).toContain("{ pattern: 'src/crg/', kind: 'prefix' }");
    expect(smokeScript).toContain('forbidden-package-path-present');
  });

  test('external graph bootstrap is allowed without restoring internal CRG source', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, 'src', 'crg'))).toBe(false);
    expect(fs.existsSync(path.join(REPO_ROOT, 'skills', 'spec-graph-bootstrap', 'SKILL.md'))).toBe(true);
    expect(fs.readFileSync(path.join(REPO_ROOT, 'skills', 'spec-graph-bootstrap', 'SKILL.md'), 'utf8')).toContain(
      'external graph-provider',
    );
  });

  test('benchmark anchor extraction helper uses active GitNexus providers only', () => {
    const helper = read('tests/benchmark/extract-graph-anchors.sh');
    const retiredProvider = ['code', 'review', 'graph'].join('-');

    expect(helper).toContain('[--provider all|gitnexus]');
    expect(helper).not.toContain(retiredProvider);
    expect(helper).not.toContain(`.${retiredProvider}/graph.db`);
    expect(helper).not.toContain(['extract', 'code', 'review', 'graph'].join('_'));
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
    const matches = findMatches(targets, patterns);
    const activeMatches = matches.filter((relativePath) => !HISTORICAL_USER_MANUAL_DOCS.has(relativePath));

    expect(activeMatches).toEqual([]);
    for (const historicalPath of matches.filter((relativePath) => HISTORICAL_USER_MANUAL_DOCS.has(relativePath))) {
      expect(read(historicalPath)).toContain('Retired / historical archive');
    }
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

    const matches = findMatches(targets, patterns);
    const activeMatches = matches.filter((relativePath) => !HISTORICAL_USER_MANUAL_DOCS.has(relativePath));

    expect(activeMatches).toEqual([]);
    for (const historicalPath of matches.filter((relativePath) => HISTORICAL_USER_MANUAL_DOCS.has(relativePath))) {
      expect(read(historicalPath)).toContain('Retired / historical archive');
    }
  });

  test('retired CRG residual gitignore expires at the next minor release', () => {
    const residualPattern = '.code-review-graph/';
    const metadata = getSpecFirstGitignorePatternMetadata()[residualPattern];

    expect(getSpecFirstGitignorePatterns()).toContain(residualPattern);
    expect(metadata).toMatchObject({
      reason: 'retired-crg-residual-ignore',
      'residual-ignore-expiry': '1.9.0',
    });
    expect(compareSemver(packageJson.version, metadata['residual-ignore-expiry'])).toBeLessThan(0);
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

    const matches = findMatches(targets, patterns);
    const activeMatches = matches.filter((relativePath) => !HISTORICAL_USER_MANUAL_DOCS.has(relativePath));

    expect(activeMatches).toEqual(['docs/05-用户手册/04-常见问题.md']);
    for (const historicalPath of matches.filter((relativePath) => HISTORICAL_USER_MANUAL_DOCS.has(relativePath))) {
      expect(read(historicalPath)).toContain('Retired / historical archive');
    }
    expect(faq).toContain('退役旧内置图运行时');
    expect(faq).toContain('不应再编译这些 native modules');
    expect(faq).toContain('不代表 package CLI 安装失败');
  });
});
