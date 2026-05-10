'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const DOCS_INDEX_PATH = path.join(REPO_ROOT, 'docs', 'README.md');
const ARCHIVE_INDEX_PATH = path.join(REPO_ROOT, 'docs', 'archive-index.md');
const LEGACY_ENGINEERING_AUDIT_PATH = path.join(
  REPO_ROOT,
  'docs',
  'validation',
  '2026-04-26-spec-first-engineering-deep-audit-report.md',
);
const GRAPH_BOOTSTRAP_FLOW_PATH = path.join(REPO_ROOT, 'docs', 'spec-graph-bootstrap-flow.md');
const LEGACY_CRG_STAGE0_PATH = path.join(
  REPO_ROOT,
  'docs',
  '02-架构设计',
  '04-crg-阶段0-构建流水线.md',
);
const LEGACY_PROJECT_INTRO_PATH = path.join(REPO_ROOT, 'docs', '项目介绍', 'README.md');
const HISTORICAL_SEARCH_ROOTS = [
  path.join(REPO_ROOT, 'docs', '项目介绍'),
  path.join(REPO_ROOT, 'docs', '业界分析'),
];
const RISKY_LEGACY_PATTERNS = [
  'src/crg',
  'spec-first crg',
  'graph.db',
  'better-sqlite3',
  '.claude-plugin',
  'CRG Stage-0',
  'ECC',
  'compound-engineering-plugin',
];

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function listMarkdownFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];

  return fs.readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(dirPath, entry.name);
    if (entry.isDirectory()) return listMarkdownFiles(child);
    if (entry.isFile() && entry.name.endsWith('.md')) return [child];
    return [];
  });
}

describe('docs lifecycle contracts', () => {
  test('documents current, artifact, historical, archived, and external-reference states', () => {
    const source = read(DOCS_INDEX_PATH);

    for (const state of ['current', 'active-artifact', 'historical-input', 'archived', 'external-reference']) {
      expect(source).toContain(state);
    }
  });

  test('marks historical architecture docs as background rather than source of truth', () => {
    const source = read(DOCS_INDEX_PATH);

    expect(source).toContain('| `docs/02-架构设计/` | historical-input |');
    expect(source).toContain('引用前必须核对当前代码和角色契约');
    expect(source).toContain('代码、`skills/`、`src/cli/`、`docs/contracts/` 与 `CHANGELOG.md` 的事实优先级高于历史设计文档');
  });

  test('documents legacy CRG and ECC search boundaries', () => {
    const source = read(DOCS_INDEX_PATH);
    const archiveIndex = read(ARCHIVE_INDEX_PATH);

    expect(source).toContain('## Legacy CRG / ECC 搜索边界');
    expect(source).toContain('docs/archive-index.md');
    expect(source).toContain('`src/crg`');
    expect(source).toContain('`spec-first crg`');
    expect(source).toContain('`graph.db`');
    expect(source).toContain('默认先按 `historical-input` 处理');
    expect(source).toContain('skills/spec-graph-bootstrap/scripts/bootstrap-providers.*');
    expect(source).toContain('`ECC` 相关 App audit 文档');
    expect(archiveIndex).toContain('## Current Source Of Truth');
    expect(archiveIndex).toContain('## Risky Historical Tokens');
    expect(archiveIndex).toContain('历史材料保留的价值是解释演化背景');
  });

  test('high-hit legacy CRG docs carry historical lifecycle banners', () => {
    const engineeringAudit = read(LEGACY_ENGINEERING_AUDIT_PATH);
    const graphBootstrapFlow = read(GRAPH_BOOTSTRAP_FLOW_PATH);
    const crgStage0 = read(LEGACY_CRG_STAGE0_PATH);
    const projectIntro = read(LEGACY_PROJECT_INTRO_PATH);

    for (const content of [engineeringAudit, graphBootstrapFlow, crgStage0, projectIntro]) {
      const head = content.slice(0, 700);

      expect(head).toContain('Lifecycle: historical-input');
      expect(head).toContain('spec-mcp-setup');
      expect(head).toContain('spec-graph-bootstrap');
    }

    expect(engineeringAudit.slice(0, 700)).toContain('external graph-provider readiness');
    expect(graphBootstrapFlow.slice(0, 900)).toContain('下游 workflow 应读取 canonical readiness artifacts');
  });

  test('risky legacy search hits carry stale-result banners at the file entrypoint', () => {
    const riskyFiles = HISTORICAL_SEARCH_ROOTS
      .flatMap(listMarkdownFiles)
      .filter((filePath) => {
        const content = read(filePath);
        return RISKY_LEGACY_PATTERNS.some((pattern) => content.includes(pattern));
      })
      .map((filePath) => path.relative(REPO_ROOT, filePath))
      .sort();

    expect(riskyFiles.length).toBeGreaterThan(0);

    for (const relativePath of riskyFiles) {
      const head = read(path.join(REPO_ROOT, relativePath)).slice(0, 900);

      expect(head).toContain('Lifecycle: historical-input / external-reference');
      expect(head).toContain('当前 source of truth');
      expect(head).toContain('docs/archive-index.md');
    }
  });
});
