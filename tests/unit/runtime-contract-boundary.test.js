'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const CLI_ROOT = path.join(REPO_ROOT, 'src', 'cli');
const README_EN_PATH = path.join(REPO_ROOT, 'README.md');
const README_ZH_PATH = path.join(REPO_ROOT, 'README.zh-CN.md');
const RUNTIME_CATALOG_PATH = path.join(REPO_ROOT, 'docs', 'catalog', 'runtime-capabilities.md');
const SOURCE_RUNTIME_BOUNDARY_PATH = path.join(REPO_ROOT, 'docs', 'contracts', 'source-runtime-customization-boundary.md');
const ALLOWED_RUNTIME_GOVERNANCE_OWNERS = new Set([
  path.join('src', 'cli', 'plugin.js'),
]);
const RUNTIME_GOVERNANCE_MARKERS = [
  'skills-governance.json',
  'skills-governance.schema.json',
  'dual-host-governance',
];
const FORBIDDEN_DOCS_SIDE_GOVERNANCE_PATHS = [
  'docs/contracts/dual-host-governance/skills-governance.json',
  'docs/contracts/dual-host-governance/skills-governance.schema.json',
];
const FORBIDDEN_DOCS_SIDE_WORKFLOW_CONTRACT_PATHS = [
  'docs/contracts/workflows/spec-work-run-artifact.schema.json',
];

function collectJsFiles(currentPath) {
  const files = [];

  for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
    const nextPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsFiles(nextPath));
      continue;
    }

    if (entry.isFile() && path.extname(entry.name) === '.js') {
      files.push(nextPath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

describe('runtime contract boundary', () => {
  test('source/runtime customization contract rejects generated mirrors as source and classifies provider evidence', () => {
    const contract = fs.readFileSync(SOURCE_RUNTIME_BOUNDARY_PATH, 'utf8');
    const catalog = fs.readFileSync(RUNTIME_CATALOG_PATH, 'utf8');

    for (const content of [contract, catalog]) {
      expect(content).toContain('.claude/');
      expect(content).toContain('.codex/');
      expect(content).toContain('.agents/skills/');
      expect(content).toContain('source');
      expect(content).toContain('GitNexus');
      expect(content).not.toContain('code-review-graph');
      expect(content).toContain('evidence');
      expect(content).toContain('untrusted quoted data');
      expect(content).toContain('schema');
      expect(content).toContain('target-repo');
      expect(content).toContain('excerpt');
      expect(content).toContain('provenance');
      expect(content).toContain('readiness');
      expect(content).toContain('credentials');
    }

    expect(contract).toContain('spec-first init');
    expect(contract).toContain('Choose the target host when prompted');
    expect(contract).toContain('spec-first doctor --claude|--codex');
    expect(contract).toContain('prompt-injection boundary');
    expect(contract).toContain('docs/contracts/workflows/review-pre-facts-extraction.md');
    expect(contract).toContain('src/cli/helpers/review-pre-facts/');
    expect(contract).toContain('Do not create a parallel reviewer facts pipeline');
    expect(contract).toContain('environment variables, host secret managers, or provider-native credential stores');
    expect(contract).toContain('Rotate immediately after suspected exposure');

    expect(catalog).toContain('Source Runtime Customization Boundary');
    expect(catalog).toContain('docs/contracts/source-runtime-customization-boundary.md');
  });

  test('README links expose the source/runtime customization boundary in both languages', () => {
    const english = fs.readFileSync(README_EN_PATH, 'utf8');
    const chinese = fs.readFileSync(README_ZH_PATH, 'utf8');

    for (const content of [english, chinese]) {
      expect(content).toContain('docs/contracts/source-runtime-customization-boundary.md');
    }
    expect(english).toContain('provider credentials belong in environment variables');
    expect(chinese).toContain('provider credentials 应来自环境变量');
  });

  test('setup capability discovery remains setup-owned and outside generated runtime catalog scope', () => {
    const english = fs.readFileSync(README_EN_PATH, 'utf8');
    const chinese = fs.readFileSync(README_ZH_PATH, 'utf8');
    const catalog = fs.readFileSync(RUNTIME_CATALOG_PATH, 'utf8');

    expect(english).toContain('`gitnexus_capability_discovery`');
    expect(chinese).toContain('`gitnexus_capability_discovery`');
    expect(english).toContain('not query-ready graph evidence');
    expect(chinese).toContain('不是 query-ready graph evidence');
    expect(catalog).not.toContain('gitnexus_capability_discovery');
  });

  test('src/cli runtime code does not reference docs-side machine-readable governance path', () => {
    const offenders = collectJsFiles(CLI_ROOT)
      .filter((filePath) => {
        const content = fs.readFileSync(filePath, 'utf8');
        return FORBIDDEN_DOCS_SIDE_GOVERNANCE_PATHS.some((forbiddenPath) => content.includes(forbiddenPath));
      })
      .map((filePath) => path.relative(REPO_ROOT, filePath));

    expect(offenders).toEqual([]);
  });

  test('runtime governance path ownership stays centralized in plugin.js', () => {
    const owners = collectJsFiles(CLI_ROOT)
      .filter((filePath) => {
        const content = fs.readFileSync(filePath, 'utf8');
        return RUNTIME_GOVERNANCE_MARKERS.some((marker) => content.includes(marker));
      })
      .map((filePath) => path.relative(REPO_ROOT, filePath))
      .sort((a, b) => a.localeCompare(b));

    expect(owners).toEqual([...ALLOWED_RUNTIME_GOVERNANCE_OWNERS].sort((a, b) => a.localeCompare(b)));
  });

  test('src/cli runtime code does not implicitly adopt docs-side spec-work run artifact schema', () => {
    const offenders = collectJsFiles(CLI_ROOT)
      .filter((filePath) => {
        const content = fs.readFileSync(filePath, 'utf8');
        return FORBIDDEN_DOCS_SIDE_WORKFLOW_CONTRACT_PATHS.some((forbiddenPath) => content.includes(forbiddenPath));
      })
      .map((filePath) => path.relative(REPO_ROOT, filePath));

    expect(offenders).toEqual([]);
  });
});
