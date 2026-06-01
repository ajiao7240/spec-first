'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const README_EN_PATH = path.join(REPO_ROOT, 'README.md');
const README_ZH_PATH = path.join(REPO_ROOT, 'README.zh-CN.md');
const CONTRIBUTING_PATH = path.join(REPO_ROOT, 'CONTRIBUTING.md');
const SECURITY_PATH = path.join(REPO_ROOT, 'SECURITY.md');
const README_FLOW_SVG_PATH = path.join(REPO_ROOT, 'docs/assets/readme/spec-first-flow.svg');
const README_FLOW_SVG_URL = 'https://raw.githubusercontent.com/sunrain520/spec-first/main/docs/assets/readme/spec-first-flow.svg';
const GITHUB_BLOB_ROOT = 'https://github.com/sunrain520/spec-first/blob/main';
const USER_MANUAL_INDEX_PATH = path.join(REPO_ROOT, 'docs/05-用户手册/README.md');
const FIRST_WORKFLOW_WALKTHROUGH_PATH = path.join(
  REPO_ROOT,
  'docs/05-用户手册/09-首次工作流走查.md',
);
const ARTIFACT_CATALOG_PATH = path.join(REPO_ROOT, 'docs/05-用户手册/10-产物目录.md');

const PUBLIC_WORKFLOW_ENTRIES = [
  ['mcp-setup', '/spec:mcp-setup', '$spec-mcp-setup'],
  ['graph-bootstrap', '/spec:graph-bootstrap', '$spec-graph-bootstrap'],
  ['update', '/spec:update', '$spec-update'],
  ['sessions', '/spec:sessions', '$spec-sessions'],
  ['slack-research', '/spec:slack-research', '$spec-slack-research'],
  ['skill-audit', '/spec:skill-audit', '$spec-skill-audit'],
  ['ideate', '/spec:ideate', '$spec-ideate'],
  ['brainstorm', '/spec:brainstorm', '$spec-brainstorm'],
  ['prd', '/spec:prd', '$spec-prd'],
  ['doc-review', '/spec:doc-review', '$spec-doc-review'],
  ['plan', '/spec:plan', '$spec-plan'],
  ['write-tasks', 'write-tasks', 'write-tasks'],
  ['app-consistency-audit', '/spec:app-consistency-audit', '$spec-app-consistency-audit'],
  ['debug', '/spec:debug', '$spec-debug'],
  ['work', '/spec:work', '$spec-work'],
  ['optimize', '/spec:optimize', '$spec-optimize'],
  ['polish-beta', '/spec:polish-beta', '$spec-polish-beta'],
  ['code-review', '/spec:code-review', '$spec-code-review'],
  ['compound', '/spec:compound', '$spec-compound'],
  ['compound-refresh', '/spec:compound-refresh', '$spec-compound-refresh'],
  ['release-notes', '/spec:release-notes', '$spec-release-notes'],
];

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function expectOrderedSections(content, sections) {
  let previousIndex = -1;

  for (const section of sections) {
    const currentIndex = content.indexOf(section);

    expect(currentIndex).toBeGreaterThan(previousIndex);
    previousIndex = currentIndex;
  }
}

function h2Headings(markdown) {
  return [...markdown.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
}

function countOccurrences(content, needle) {
  return content.split(needle).length - 1;
}

function localMarkdownLinks(markdown) {
  const links = [];
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;

  for (const match of markdown.matchAll(linkPattern)) {
    if (markdown[match.index - 1] === '!') {
      continue;
    }

    const rawTarget = match[1].trim().replace(/^<|>$/g, '');

    if (
      rawTarget.startsWith('http://') ||
      rawTarget.startsWith('https://') ||
      rawTarget.startsWith('#') ||
      rawTarget.startsWith('mailto:')
    ) {
      continue;
    }

    const [targetPath] = rawTarget.split('#');

    if (targetPath) {
      links.push(targetPath);
    }
  }

  return links;
}

describe('README open-source entry contract', () => {
  test('README exposes mature open-source trust signals near the top', () => {
    const englishReadme = read(README_EN_PATH);
    const chineseReadme = read(README_ZH_PATH);

    for (const readme of [englishReadme, chineseReadme]) {
      expect(readme).toContain('[![npm version]');
      expect(readme).toContain('https://www.npmjs.com/package/spec-first');
      expect(readme).toContain('[![license]');
      expect(readme).toContain(`${GITHUB_BLOB_ROOT}/LICENSE`);
      expect(readme).toContain('[![node]');
      expect(readme).toContain(`${GITHUB_BLOB_ROOT}/package.json`);
      expect(readme).toContain('npm-install-matrix.yml');
      expect(readme).toContain('http://spec-first.cn/');
    }
  });

  test('README keeps mirrored streamlined information architecture', () => {
    const englishReadme = read(README_EN_PATH);
    const chineseReadme = read(README_ZH_PATH);

    expect(h2Headings(englishReadme)).toEqual([
      'See It In 90 Seconds',
      'A Tiny Example',
      'Why spec-first?',
      'Quickstart',
      'Workflow Entry Points',
      'Operating Model',
      'Trust Model',
      'Use spec-first when',
      'Documentation',
      'Runtime And CLI Reference',
      'Development & Contributing',
    ]);

    expect(h2Headings(chineseReadme)).toEqual([
      '90 秒看懂',
      '一个小例子',
      '为什么使用 spec-first？',
      '快速开始',
      'Workflow Entry Points',
      '产物与工作方式',
      'Trust Model',
      '适合使用 spec-first 的情况',
      '相关文档',
      'Runtime 与 CLI Reference',
      '开发与贡献',
    ]);

    expect(h2Headings(englishReadme)).toHaveLength(h2Headings(chineseReadme).length);
  });

  test('README uses one canonical workflow visual and one canonical entry table', () => {
    const englishReadme = read(README_EN_PATH);
    const chineseReadme = read(README_ZH_PATH);
    const svg = read(README_FLOW_SVG_PATH);

    for (const readme of [englishReadme, chineseReadme]) {
      expect(countOccurrences(readme, `![spec-first workflow flow](${README_FLOW_SVG_URL})`)).toBe(1);
      expect(countOccurrences(readme, '| Intent | Claude Code | Codex | Expected result |')).toBe(1);
      expect(readme).not.toContain('## End-To-End Development Flow');
      expect(readme).not.toContain('## Current Engineering Loop');
      expect(readme).not.toContain('## Choose Your Path');
      expect(readme).not.toContain('## Core Workflows');
      expect(readme).not.toContain('## Full Workflow Reference');
    }

    expect(svg).toContain('<svg');
    expect(svg).toContain('<title id="title">spec-first workflow flow</title>');
    expect(svg).toContain('@keyframes pulse');
    expect(svg).toContain('@keyframes travelOne');
    expect(svg).toContain('prefers-reduced-motion');
    expect(svg).toContain('Scripts prepare facts and runtime assets -> LLM decides scope');
    expect(svg).toContain('docs/brainstorms');
    expect(svg).toContain('docs/tasks');
  });

  test('canonical workflow table preserves every public entrypoint', () => {
    const englishReadme = read(README_EN_PATH);
    const chineseReadme = read(README_ZH_PATH);

    for (const [label, claudeEntry, codexEntry] of PUBLIC_WORKFLOW_ENTRIES) {
      for (const readme of [englishReadme, chineseReadme]) {
        expect(readme).toContain(label);
        expect(readme).toContain(claudeEntry);
        expect(readme).toContain(codexEntry);
      }
    }

    expect(englishReadme).toContain('use installed standalone `write-tasks` skill');
    expect(chineseReadme).toContain('use installed standalone `write-tasks` skill');
  });

  test('README distinguishes host-session entries from shell commands in Quickstart', () => {
    const englishReadme = read(README_EN_PATH);
    const chineseReadme = read(README_ZH_PATH);

    expectOrderedSections(englishReadme, [
      'Install and run the first health check from the native terminal for your platform.',
      'npm install -g spec-first',
      'spec-first doctor',
      'Initialize the host runtime you actually use:',
      'spec-first init',
      'Host-session workflow entries are not shell commands:',
      '# In a Claude Code session',
      '/spec:brainstorm "Improve onboarding"',
      '# In a Codex session',
      '$spec-brainstorm "Improve onboarding"',
      'You are done with the first pass when a requirements brief appears under `docs/brainstorms/`.',
    ]);

    expectOrderedSections(chineseReadme, [
      '请在当前平台的原生终端中安装并运行第一次健康检查。',
      'npm install -g spec-first',
      'spec-first doctor',
      '初始化实际使用的宿主 runtime：',
      'spec-first init',
      '宿主内 workflow 入口不是 shell 命令：',
      '# 在 Claude Code 会话中',
      '/spec:brainstorm "改进 onboarding"',
      '# 在 Codex 会话中',
      '$spec-brainstorm "改进 onboarding"',
      '当 `docs/brainstorms/` 下出现 requirements brief，第一次接入就完成了。',
    ]);

    for (const readme of [englishReadme, chineseReadme]) {
      expect(readme).toContain('Node.js `>=20.0.0`');
      expect(readme).toContain('throwaway/test repo');
      expect(readme).toContain('docs/brainstorms/YYYY-MM-DD-NNN-topic-requirements.md');
      expect(readme).not.toContain('must initialize both hosts');
      expect(readme).not.toContain('$spec-next');
      expect(readme).not.toContain('/spec:next');
    }
  });

  test('README foregrounds promotion fit and avoids hardcoded runtime counts', () => {
    const englishReadme = read(README_EN_PATH);
    const chineseReadme = read(README_ZH_PATH);

    expect(englishReadme).toContain('Spec-driven AI engineering workflows for Claude Code and Codex.');
    expect(englishReadme).toContain('one-off AI coding chats into a reusable engineering loop');
    expect(englishReadme).toContain('The point is not another prompt snippet or agent team.');
    expect(englishReadme).toContain('Use `spec-first` when:');
    expect(englishReadme).toContain('It may not fit when');

    expect(chineseReadme).toContain('面向 Claude Code 与 Codex 的 spec-driven AI engineering workflows。');
    expect(chineseReadme).toContain('把一次性的 AI coding 对话变成可复用的工程闭环');
    expect(chineseReadme).toContain('重点不是再提供一组 prompt 片段或 agent team');
    expect(chineseReadme).toContain('适合使用 `spec-first`');
    expect(chineseReadme).toContain('可能不是最合适的形态');

    for (const readme of [englishReadme, chineseReadme]) {
      expect(readme).not.toMatch(/Bundled source assets ship with `?\d+`? skills/);
      expect(readme).not.toMatch(/Generated \d+ command file/);
      expect(readme).not.toMatch(/Generated \d+ skill director/);
      expect(readme).not.toMatch(/Generated \d+ agent file/);
      expect(readme).not.toContain('Expected Claude init output includes:');
      expect(readme).not.toContain('Expected Codex init output includes:');
    }
  });

  test('README keeps runtime, graph, and source boundary links discoverable', () => {
    const englishReadme = read(README_EN_PATH);
    const chineseReadme = read(README_ZH_PATH);

    for (const readme of [englishReadme, chineseReadme]) {
      expect(readme).toContain('docs/contracts/source-runtime-customization-boundary.md');
      expect(readme).toContain('docs/catalog/runtime-capabilities.md');
      expect(readme).toContain('docs/contracts/gitnexus-capability-catalog.md');
      expect(readme).toContain('docs/contracts/graph-evidence-policy.md');
      expect(readme).toContain('docs/contracts/graph-provider-consumption.md');
      expect(readme).toContain('docs/contracts/workspace-gitnexus-consumption.md');
      expect(readme).toContain('Capability State Vocabulary');
      expect(readme).toContain('query_ready');
      expect(readme).toContain('definitions-only');
      expect(readme).toContain('dirty-advisory');
      expect(readme).toContain('session-local');
      expect(readme).toContain('setup-inferred');
      expect(readme).toContain('`gitnexus_capability_discovery`');
    }

    expect(englishReadme).toContain('not query-ready graph evidence');
    expect(chineseReadme).toContain('不是 query-ready graph evidence');
    expect(englishReadme).toContain('provider credentials belong in environment variables');
    expect(chineseReadme).toContain('provider credentials 应来自环境变量');
  });

  test('user manual keeps first workflow walkthrough and artifact catalog targets', () => {
    expect(fs.existsSync(USER_MANUAL_INDEX_PATH)).toBe(true);
    expect(fs.existsSync(FIRST_WORKFLOW_WALKTHROUGH_PATH)).toBe(true);
    expect(fs.existsSync(ARTIFACT_CATALOG_PATH)).toBe(true);

    const userManualIndex = read(USER_MANUAL_INDEX_PATH);
    const walkthrough = read(FIRST_WORKFLOW_WALKTHROUGH_PATH);
    const catalog = read(ARTIFACT_CATALOG_PATH);

    expect(userManualIndex).toContain('./09-首次工作流走查.md');
    expect(userManualIndex).toContain('./10-产物目录.md');
    expect(walkthrough).toContain('Improve onboarding for first-time CLI users');
    expect(walkthrough).toContain('$spec-brainstorm');
    expect(walkthrough).toContain('/spec:brainstorm');
    expect(walkthrough).toContain('第一次 brainstorm 通常只生成一个 requirements brief');
    expect(walkthrough).toContain('standalone `write-tasks` skill');
    expect(walkthrough).toContain('generated runtime assets');

    for (const expected of [
      'docs/brainstorms/*-requirements.md',
      'docs/ideation/*-ideation.md',
      'docs/plans/*-plan.md',
      'docs/tasks/*-tasks.md',
      'docs/solutions/**/*',
      '.claude/',
      '.codex/',
      '.agents/skills/',
      'standalone `write-tasks` skill',
      'source truth',
      'generated runtime assets',
    ]) {
      expect(catalog).toContain(expected);
    }
  });

  test('README community links resolve locally and avoid unsupported policy links', () => {
    for (const readmePath of [README_EN_PATH, README_ZH_PATH]) {
      const readme = read(readmePath);

      expect(readme).toContain(`${GITHUB_BLOB_ROOT}/CONTRIBUTING.md`);
      expect(readme).toContain(`${GITHUB_BLOB_ROOT}/SECURITY.md`);
      expect(readme).toContain(`${GITHUB_BLOB_ROOT}/LICENSE`);
      expect(readme).not.toContain('CODE_OF_CONDUCT.md');

      for (const target of localMarkdownLinks(readme)) {
        const resolvedPath = path.resolve(REPO_ROOT, target);

        expect(fs.existsSync(resolvedPath)).toBe(true);
      }
    }
  });

  test('community docs stay conservative about contribution and security policy', () => {
    expect(fs.existsSync(CONTRIBUTING_PATH)).toBe(true);
    expect(fs.existsSync(SECURITY_PATH)).toBe(true);

    const contributing = read(CONTRIBUTING_PATH);
    const security = read(SECURITY_PATH);

    expect(contributing).toContain('npm run typecheck');
    expect(contributing).toContain('npm test');
    expect(contributing).toContain('CHANGELOG.md');
    expect(contributing).toContain('Do not hand-edit generated runtime assets');
    expect(security).toContain('https://github.com/sunrain520/spec-first/issues');
    expect(security).toContain('No private security reporting channel is configured in this repository yet.');
    expect(security).not.toContain('guaranteed response time');
  });
});
