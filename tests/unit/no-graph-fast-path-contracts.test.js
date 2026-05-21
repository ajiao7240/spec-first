'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');

const CONTRACT_FILES = [
  'README.md',
  'README.zh-CN.md',
  'docs/05-用户手册/01-快速开始.md',
  'docs/05-用户手册/README.md',
  'skills/using-spec-first/SKILL.md',
  'src/cli/commands/init.js',
];

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

describe('no-graph fast path contracts', () => {
  test('public docs distinguish lightweight fast path from enhanced readiness', () => {
    const readme = read('README.md');
    const readmeZh = read('README.zh-CN.md');
    const quickstart = read('docs/05-用户手册/01-快速开始.md');
    const manual = read('docs/05-用户手册/README.md');

    expect(readme).toContain('After `doctor`, `init`, and a host restart');
    expect(readme).toContain('lightweight host-session workflows before graph readiness has been compiled');
    expect(readme).toContain('Use the setup/bootstrap path when the task depends on MCP/helper tools, graph evidence, written project guidance, or cross-module/cross-repo impact analysis.');
    expect(readme).toContain('Missing or stale graph facts are degraded evidence to disclose');
    expect(readme).toContain('Graph refresh trigger nodes:');
    expect(readme).toContain('Need current GitNexus/code-review-graph readiness');
    expect(readme).toContain('does not automatically rebuild indexes');

    expect(readmeZh).toContain('完成 `doctor`、`init` 和宿主重启后');
    expect(readmeZh).toContain('即使还没有编译 graph readiness，也可以先进入轻量宿主 workflow。');
    expect(readmeZh).toContain('当任务依赖 MCP/helper tools、graph evidence、书面项目指导、跨模块或跨仓影响分析时');
    expect(readmeZh).toContain('不是所有 workflow 的硬前置');
    expect(readmeZh).toContain('Graph refresh 触发节点：');
    expect(readmeZh).toContain('不会自动 rebuild index');

    expect(quickstart).toContain('### 最小可用 fast path');
    expect(quickstart).toContain('不必等 graph readiness 编译完成');
    expect(quickstart).toContain('docs-only、小 bugfix、轻量 plan/work/review 和首次项目试用');
    expect(quickstart).toContain('不能包装成成功的 graph evidence，也不是所有 workflow 的硬前置');
    expect(quickstart).toContain('Graph refresh 触发节点可以按这张表理解');
    expect(quickstart).toContain('不会自动 rebuild index');

    expect(manual).toContain('轻量任务可以先走 no-graph fast path');
    expect(manual).toContain('bounded direct repo reads');
    expect(manual).toContain('不要把 setup/bootstrap 当成所有 workflow 的硬前置');
    expect(manual).toContain('自动 freshness check，显式 graph-bootstrap refresh');
    expect(manual).toContain('普通 plan/work/debug/review 不会自动运行 GitNexus analyze');
  });

  test('entry guidance routes clear lightweight goals without graph as a universal gate', () => {
    const usingSpecFirst = read('skills/using-spec-first/SKILL.md');
    const initCommand = read('src/cli/commands/init.js');

    expect(usingSpecFirst).toContain('After init, prefer setup/readiness guidance only when the user asks about setup/readiness');
    expect(usingSpecFirst).toContain('clear lightweight docs, small-code, plan, work, or review goal');
    expect(usingSpecFirst).toContain('route by that goal and require the selected workflow to disclose degraded graph/MCP evidence when relevant');

    expect(initCommand).toContain('For lightweight docs, small fixes, first trials, or lightweight plan/work/review');
    expect(initCommand).toContain('For enhanced readiness');
    expect(initCommand).toContain('Project guidance comes from AGENTS.md, CLAUDE.md, docs/contracts, direct source evidence, tests, and graph facts.');
    expect(initCommand).toContain('对 docs、小修复、首次试用或轻量 plan/work/review');
  });

  test('fast path does not introduce a quick workflow or CLI mode', () => {
    const combined = CONTRACT_FILES.map((relativePath) => read(relativePath)).join('\n');

    for (const banned of [
      '$spec-quick',
      '/spec:quick',
      'spec-first quick',
      '--quick-workflow',
      '--no-graph',
      'spec-first graph watch',
      'graph daemon',
      'default git hook',
    ]) {
      expect(combined).not.toContain(banned);
    }
  });
});
