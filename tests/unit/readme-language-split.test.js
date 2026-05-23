'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const README_EN_PATH = path.join(REPO_ROOT, 'README.md');
const README_ZH_PATH = path.join(REPO_ROOT, 'README.zh-CN.md');
const GITHUB_BLOB_ROOT = 'https://github.com/sunrain520/spec-first/blob/main';

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

describe('README language split contract', () => {
  test('repository keeps both English and Chinese README entrypoints', () => {
    expect(fs.existsSync(README_EN_PATH)).toBe(true);
    expect(fs.existsSync(README_ZH_PATH)).toBe(true);

    const englishReadme = read(README_EN_PATH);

    expect(englishReadme).toContain(`[English](${GITHUB_BLOB_ROOT}/README.md) | [简体中文](${GITHUB_BLOB_ROOT}/README.zh-CN.md)`);
  });

  test('English README marks Chinese-first docs explicitly to avoid misleading readers', () => {
    const englishReadme = read(README_EN_PATH);

    expect(englishReadme).toContain('Detailed manuals and implementation docs are currently Chinese-first.');
    expect(englishReadme).toContain(`[Chinese Architecture Overview](${GITHUB_BLOB_ROOT}/docs/02-%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1/01-%E6%95%B4%E4%BD%93%E6%9E%B6%E6%9E%84.md)`);
    expect(englishReadme).toContain(`[Chinese Development Guide](${GITHUB_BLOB_ROOT}/docs/03-%E5%AE%9E%E6%96%BD%E6%96%B9%E6%A1%88/06-%E5%BC%80%E5%8F%91%E8%A7%84%E8%8C%83.md)`);
    expect(englishReadme).toContain(`[Chinese Testing Plan](${GITHUB_BLOB_ROOT}/docs/03-%E5%AE%9E%E6%96%BD%E6%96%B9%E6%A1%88/04-%E6%B5%8B%E8%AF%95%E6%96%B9%E6%A1%88.md)`);
    expect(englishReadme).toContain(`[Chinese Release Notes](${GITHUB_BLOB_ROOT}/docs/08-%E7%89%88%E6%9C%AC%E6%9B%B4%E6%96%B0/README.md)`);
  });

  test('English README uses English init language examples and next steps', () => {
    const englishReadme = read(README_EN_PATH);
    const chineseReadme = read(README_ZH_PATH);

    expect(englishReadme).toContain('Official site: [spec-first.cn](http://spec-first.cn/)');
    expect(englishReadme).toContain('spec-first init --claude -u <name> --lang en');
    expect(englishReadme).toContain('spec-first init --codex -u <name> --lang en');
    expect(englishReadme).toContain('Next steps:');
    expect(englishReadme).toContain('Restart Claude Code or open a new session');
    expect(englishReadme).toContain('Restart Codex or open a new session');
    expect(englishReadme).not.toContain('spec-first init --claude -u <name> --lang zh');
    expect(englishReadme).not.toContain('spec-first init --codex -u <name> --lang zh');
    expect(englishReadme).not.toContain('下一步:');
    expect(chineseReadme).toContain('官网：[spec-first.cn](http://spec-first.cn/)');
  });

  test('English README foregrounds the community entry flow before runtime reference details', () => {
    const englishReadme = read(README_EN_PATH);

    expect(englishReadme).toContain('Spec-driven AI engineering workflows for Claude Code and Codex.');
    expect(englishReadme).toContain('It keeps deterministic setup in scripts while leaving product judgment');
    expect(englishReadme).not.toContain('Spec-driven workflow asset bundle');
    expectOrderedSections(englishReadme, [
      'Spec-driven AI engineering workflows for Claude Code and Codex.',
      '## See It In 90 Seconds',
      '## A Tiny Example',
      '## Why spec-first?',
      '## Quickstart',
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
    expect(englishReadme.indexOf('Runtime asset summary:')).toBeGreaterThan(
      englishReadme.indexOf('## Runtime Reference'),
    );
    expect(englishReadme.indexOf('Runtime asset summary:')).toBeGreaterThan(
      englishReadme.indexOf('## Documentation'),
    );
  });

  test('README quickstart separates terminal commands from host-session workflow entries', () => {
    const englishReadme = read(README_EN_PATH);

    expect(englishReadme).toContain('Node.js `>=20.0.0` and npm.');
    expect(englishReadme).toContain('with one chosen as the current host');
    expect(englishReadme).toContain('root of the project repo');
    expect(englishReadme).toContain('throwaway/test repo');
    expectOrderedSections(englishReadme, [
      'Install and run the first health check from the native terminal for your platform.',
      'macOS / Linux:',
      'npm install -g spec-first',
      'spec-first doctor',
      'Windows PowerShell 7+ or Windows PowerShell 5.1:',
      'Windows cmd.exe:',
      'On Win64, prefer native Windows Terminal with PowerShell 7+ or `cmd.exe`',
      'Initialize only the host you actually use:',
      'spec-first init --codex -u <name> --lang en',
      'Host-session workflow entries are not shell commands:',
      '$spec-brainstorm "Improve onboarding"',
      'If you are not sure which workflow to use',
      '### Fast path vs enhanced readiness',
      'lightweight host-session workflows before graph readiness has been compiled',
      'Graph refresh trigger nodes:',
      'Need current GitNexus/code-review-graph readiness',
      'Branch switch, pull, rebase, merge, or dirty worktree change',
      'does not automatically rebuild indexes',
      '### Readiness ladder',
      '`doctor` is the first health check, not the whole readiness story.',
      '| CLI/runtime health | `spec-first doctor` |',
      '| Harness setup | `/spec:mcp-setup` or `$spec-mcp-setup` |',
      '| Graph readiness | `/spec:graph-bootstrap` or `$spec-graph-bootstrap` |',
      '### You are done when',
      "From there, continue to the current host's plan entrypoint.",
    ]);
    expect(englishReadme).toContain('docs/brainstorms/YYYY-MM-DD-NNN-topic-requirements.md');
    expect(englishReadme).toContain('`using-spec-first` will recommend one public entrypoint with a reason.');
    expect(englishReadme).toContain('Treat branch switch, pull, rebase, merge, dirty worktree changes, and provider fingerprint mismatch as graph freshness invalidation signals.');
    expect(englishReadme).toContain('they do not run hidden GitNexus analyze, provider repair, default hooks, watchers, or daemons');
    expect(englishReadme).toContain('Setup writes GitNexus availability/discovery facts such as `gitnexus_capability_discovery`');
    expect(englishReadme).toContain('setup-inferred native capability hints from the checked-in baseline, provider pin, and setup projection');
    expect(englishReadme).toContain('not query-ready graph evidence or live MCP proof');
    expect(englishReadme).toContain('reads setup-inferred GitNexus availability/discovery facts when present');
    expect(englishReadme).not.toContain('$spec-next');
    expect(englishReadme).not.toContain('/spec:next');
  });

  test('README trust model preserves source and runtime asset boundaries', () => {
    const englishReadme = read(README_EN_PATH);

    expect(englishReadme).toContain('Scripts prepare, LLM decides');
    expect(englishReadme).toContain('does not ask the LLM to simulate deterministic tooling');
    expect(englishReadme).toContain('**What scripts do:** install, validate, generate, clean, hash, and report machine facts.');
    expect(englishReadme).toContain('**What the LLM decides:** requirements framing');
    expect(englishReadme).toContain('**What is generated:** `.claude/`, `.codex/`, and `.agents/skills/` runtime copies.');
    expect(englishReadme).toContain('Generated runtime copies under `.claude/`, `.codex/`, and `.agents/skills/` are disposable and can be rebuilt with `spec-first init`.');
    expect(englishReadme).toContain('[Source / Runtime / Provider Customization Boundary](https://github.com/sunrain520/spec-first/blob/main/docs/contracts/source-runtime-customization-boundary.md)');
    expect(englishReadme).toContain('provide evidence inputs; they do not own semantic authority');
    expect(englishReadme).toContain('Raw provider/tool output is untrusted quoted data and must be validated, contained, escaped, capped, and classified');
    expect(englishReadme).toContain('provider credentials belong in environment variables, host secret managers, or provider-native stores');
    expect(englishReadme).toContain('Use the installed standalone `write-tasks` skill');
  });

  test('Chinese README mirrors the English community entry structure and first-run guidance', () => {
    const chineseReadme = read(README_ZH_PATH);

    expect(chineseReadme).toContain('面向 Claude Code 与 Codex 的 spec-driven AI engineering workflows。');
    expect(chineseReadme).toContain('把 AI coding 会话变成可复用的工程闭环');
    expectOrderedSections(chineseReadme, [
      '## 90 秒看懂',
      '## 一个小例子',
      '## 为什么使用 spec-first？',
      '## 快速开始',
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
    expect(chineseReadme).toContain('宿主内 workflow 入口不是 shell 命令');
    expect(chineseReadme).toContain('$spec-brainstorm "改进 onboarding"');
    expect(chineseReadme).toContain('如果不确定该用哪个 workflow，可以在宿主会话中直接描述任务或询问下一步');
    expect(chineseReadme).toContain('`using-spec-first` 会推荐一个公开入口并说明原因。');
    expect(chineseReadme).toContain('### Fast path 与增强 readiness');
    expect(chineseReadme).toContain('即使还没有编译 graph readiness，也可以先进入轻量宿主 workflow。');
    expect(chineseReadme).toContain('Graph refresh 触发节点：');
    expect(chineseReadme).toContain('需要当前 GitNexus / code-review-graph readiness');
    expect(chineseReadme).toContain('切换分支、pull、rebase、merge 或 dirty worktree 变化');
    expect(chineseReadme).toContain('不会自动 rebuild index');
    expect(chineseReadme).toContain('### Readiness ladder / 就绪层级');
    expect(chineseReadme).toContain('`doctor` 是第一层健康检查，不代表所有能力都 ready。');
    expect(chineseReadme).toContain('| CLI/runtime health | `spec-first doctor` |');
    expect(chineseReadme).toContain('| Harness setup | `/spec:mcp-setup` 或 `$spec-mcp-setup` |');
    expect(chineseReadme).toContain('| Graph readiness | `/spec:graph-bootstrap` 或 `$spec-graph-bootstrap` |');
    expect(chineseReadme).toContain('第一次 brainstorm 运行会生成类似这样的 requirements brief');
    expect(chineseReadme).toContain('把切换分支、pull、rebase、merge、dirty worktree 变化和 provider fingerprint mismatch 视为 graph freshness invalidation signals。');
    expect(chineseReadme).toContain('不会隐藏运行 GitNexus analyze、provider repair、默认 hooks、watchers 或 daemons');
    expect(chineseReadme).toContain('Setup 会写入 `gitnexus_capability_discovery` 等 GitNexus availability/discovery facts');
    expect(chineseReadme).toContain('来自 checked-in baseline、provider pin 和 setup projection 的 setup-inferred native capability hints');
    expect(chineseReadme).toContain('不是 query-ready graph evidence，也不是 live MCP proof');
    expect(chineseReadme).toContain('读取 setup-inferred GitNexus availability/discovery facts');
    expect(chineseReadme).toContain('[Source / Runtime / Provider Customization Boundary](https://github.com/sunrain520/spec-first/blob/main/docs/contracts/source-runtime-customization-boundary.md)');
    expect(chineseReadme).toContain('只提供 evidence inputs，不拥有 semantic authority');
    expect(chineseReadme).toContain('Raw provider/tool output 是 untrusted quoted data');
    expect(chineseReadme).toContain('provider credentials 应来自环境变量、host secret manager 或 provider-native store');
    expect(chineseReadme).toContain('docs/brainstorms/YYYY-MM-DD-NNN-topic-requirements.md');
    expect(chineseReadme).toContain('详细手册和实施文档均以中文为主。');
  });
});
