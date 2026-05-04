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

  test('README shows proof and success path before runtime reference details', () => {
    const englishReadme = read(README_EN_PATH);
    const chineseReadme = read(README_ZH_PATH);

    expectOrderedSections(englishReadme, [
      '## See It In 90 Seconds',
      '## A Tiny Example',
      '## Why spec-first?',
      '## Quickstart',
      '### You are done when',
      '## What You Get',
      '## How It Works',
      '## Choose Your Path',
      '## Core Workflows',
      '## Trust Model',
      '## Use spec-first when',
      '## Documentation',
      '## Full Workflow Reference',
      '## Runtime Reference',
      '## Development & Contributing',
    ]);

    expectOrderedSections(chineseReadme, [
      '## 90 秒看懂',
      '## 一个小例子',
      '## 为什么使用 spec-first？',
      '## 快速开始',
      '### 完成标志',
      '## 你会得到什么',
      '## 工作方式',
      '## 选择你的路径',
      '## 核心 workflows',
      '## Trust Model',
      '## 适合使用 spec-first 的情况',
      '## 相关文档',
      '## 完整 Workflow Reference',
      '## Runtime Reference',
      '## 开发与贡献',
    ]);
  });

  test('README embeds a maintainable animated SVG workflow diagram', () => {
    const englishReadme = read(README_EN_PATH);
    const chineseReadme = read(README_ZH_PATH);
    const svg = read(README_FLOW_SVG_PATH);

    for (const readme of [englishReadme, chineseReadme]) {
      expect(readme).toContain(`![spec-first workflow flow](${README_FLOW_SVG_URL})`);
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

  test('README names first-run artifacts and does not imply every workflow emits every artifact', () => {
    const englishReadme = read(README_EN_PATH);

    expect(englishReadme).toContain('docs/brainstorms/YYYY-MM-DD-NNN-topic-requirements.md');
    expect(englishReadme).toContain('docs/plans/');
    expect(englishReadme).toContain('docs/tasks/');
    expect(englishReadme).toContain('Not every workflow writes every artifact');
    expect(englishReadme).not.toContain('Every workflow writes all of these artifacts');
  });

  test('README explains the first workflow chain with a tiny example and path chooser', () => {
    const englishReadme = read(README_EN_PATH);
    const chineseReadme = read(README_ZH_PATH);

    expect(englishReadme).toContain('## A Tiny Example');
    expect(englishReadme).toContain('$spec-brainstorm "Improve onboarding for first-time CLI users"');
    expect(englishReadme).toContain('docs/brainstorms/2026-05-01-001-cli-onboarding-requirements.md');
    expect(englishReadme).toContain('docs/plans/2026-05-01-001-feat-cli-onboarding-plan.md');
    expect(englishReadme).toContain('docs/tasks/2026-05-01-001-feat-cli-onboarding-tasks.md');
    expect(englishReadme).toContain('The first brainstorm run usually creates only the requirements brief.');
    expect(englishReadme).toContain('If you are not sure which workflow to use');
    expect(englishReadme).toContain('## Choose Your Path');
    expect(englishReadme).toContain('A rough idea or product problem');
    expect(englishReadme).toContain('/spec:debug');
    expect(englishReadme).toContain('$spec-code-review');
    expect(englishReadme).toContain(`${GITHUB_BLOB_ROOT}/docs/05-%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/09-%E9%A6%96%E6%AC%A1%E5%B7%A5%E4%BD%9C%E6%B5%81%E8%B5%B0%E6%9F%A5.md`);
    expect(englishReadme).toContain(`${GITHUB_BLOB_ROOT}/docs/05-%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/10-%E4%BA%A7%E7%89%A9%E7%9B%AE%E5%BD%95.md`);

    expect(chineseReadme).toContain('## 一个小例子');
    expect(chineseReadme).toContain('第一次 brainstorm 通常只生成 requirements brief');
    expect(chineseReadme).toContain('如果不确定该用哪个 workflow');
    expect(chineseReadme).toContain('## 选择你的路径');
    expect(chineseReadme).toContain('只有模糊想法或产品问题');
    expect(chineseReadme).toContain('$spec-debug');
  });

  test('README distinguishes ideate, brainstorm, doc-review, and beta work entrypoints', () => {
    const englishReadme = read(README_EN_PATH);
    const chineseReadme = read(README_ZH_PATH);

    expect(englishReadme).toContain('Use `ideate` when you want options, critiques, or surprising directions');
    expect(englishReadme).toContain('Use `brainstorm` when you already have a rough problem or feature');
    expect(englishReadme).toContain('Use `doc-review` when a requirements, plan, or task document already exists');
    expect(englishReadme).toContain('Do not make `brainstorm` the default entrypoint for every unclear request.');
    expect(englishReadme).toContain('| "What should we improve?" or "give me ideas" | `ideate` |');
    expect(englishReadme).toContain('| "I have this rough product problem; shape it" | `brainstorm` |');
    expect(englishReadme).toContain('| "This requirements or plan document has gaps" | `doc-review` |');
    expect(englishReadme).toContain('| Trial Codex delegation beta (explicit opt-in) | `/spec:work-beta` | `$spec-work-beta` |');

    expect(chineseReadme).toContain('想要选项、批判或意外方向，还没确定问题框架时，用 `ideate`。');
    expect(chineseReadme).toContain('已经有粗略产品问题或功能想法，需要整理 actors、flows、边界和验收样例时，用 `brainstorm`。');
    expect(chineseReadme).toContain('已有 requirements、plan 或 task 文档，需要找缺口时，用 `doc-review`。');
    expect(chineseReadme).toContain('不要把 `brainstorm` 当作所有不清楚请求的默认入口。');
    expect(chineseReadme).toContain('| “我们该改进什么？”或“给我一些想法” | `ideate` |');
    expect(chineseReadme).toContain('| “我有一个粗略产品问题，帮我成型” | `brainstorm` |');
    expect(chineseReadme).toContain('| “这份 requirements 或 plan 文档可能有缺口” | `doc-review` |');
    expect(chineseReadme).toContain('| 试用 Codex delegation beta（显式 opt-in） | `/spec:work-beta` | `$spec-work-beta` |');
  });

  test('user manual adds first workflow walkthrough and artifact catalog', () => {
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
