'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SCALE_DOC_ROOT = path.join(REPO_ROOT, 'docs', '01-需求分析', '13.scale集成');
const CODEGRAPH_DOC = path.join(SCALE_DOC_ROOT, 'CodeGraph技术方案.md');
const README_DOC = path.join(SCALE_DOC_ROOT, 'README.md');
const PARENT_DOC = path.join(
  SCALE_DOC_ROOT,
  'spec-first内化集成scale-project-scaffold技术方案.md',
);
const PROJECT_SCAFFOLD_DOC = path.join(
  SCALE_DOC_ROOT,
  'project-scaffold依赖安装流程与spec-first-setup优化技术方案.md',
);

describe('SCALE provider documentation contracts', () => {
  test('CodeGraph provider examples keep readiness and evidence trust as separate axes', () => {
    const codegraph = fs.readFileSync(CODEGRAPH_DOC, 'utf8');
    const parent = fs.readFileSync(PARENT_DOC, 'utf8');

    expect(parent).toContain('轴 A — Provider Readiness');
    expect(parent).toContain('轴 B — Evidence Trust');
    expect(parent).toContain('readiness 字段只接受现有 5 值 enum');
    expect(parent).toContain('provider readiness=`fresh` 不得单独产生 `confirmed_context`');

    expect(codegraph).toContain('"readiness_status": "fresh|stale|degraded|not-run|unknown"');
    expect(codegraph).toContain('Evidence Trust');
    expect(codegraph).toContain('workflow 语义晋升判断');
    // capability-aware 重定位后无 adapter 概念,外部能力输出只写机械 readiness + 候选
    expect(codegraph).toContain('外部能力的输出只写机械 readiness 和候选证据要求');
    expect(codegraph).toContain('不得回填进 readiness 字段');
    expect(codegraph).not.toContain('"candidate_trust"');
    expect(codegraph).not.toContain('"confirmed_context"');
    expect(codegraph).not.toContain('"status": "unavailable|stale|advisory|evidence_candidate"');
    expect(codegraph).not.toContain('"status": "evidence_candidate"');
    expect(codegraph).not.toContain('"status": "advisory"');
  });

  test('SCALE integration docs keep v1.16 convergence gates explicit', () => {
    const codegraph = fs.readFileSync(CODEGRAPH_DOC, 'utf8');
    const parent = fs.readFileSync(PARENT_DOC, 'utf8');
    const readme = fs.readFileSync(README_DOC, 'utf8');

    expect(parent).toContain('## Phase E：Capability-aware 协同（code-intelligence 能力工具）');
    expect(parent).toContain('direct consumer：`doctor.decision_input_health`');
    expect(parent).toContain('workflow consuming Phase：v1.16');
    expect(parent).toContain('`rule-maturity.v1` 是 v1.14 schema/docs-only shadow 例外');

    expect(codegraph).toContain('prose capability class');
    expect(codegraph).toContain('CodeGraph entry 的 `kind` 必须写 `code-structure`');
    expect(codegraph).toContain('不要在 registry 里写 `kind:"code-graph"`');

    expect(readme).toContain('进入 v1.16 前的评审收敛 gate');
    expect(readme).toContain('provider-readiness.kind`：`code-structure`');
    expect(readme).toContain('runtime-without-FSM 能力确认');
    expect(readme).toContain('默认重定义为 OPT-B');
  });

  test('SCALE integration docs lock CodeGraph MCP route and Graphify CLI route', () => {
    const codegraph = fs.readFileSync(CODEGRAPH_DOC, 'utf8');
    const parent = fs.readFileSync(PARENT_DOC, 'utf8');
    const readme = fs.readFileSync(README_DOC, 'utf8');
    const projectScaffold = fs.readFileSync(PROJECT_SCAFFOLD_DOC, 'utf8');
    const combined = [codegraph, parent, readme, projectScaffold].join('\n');

    expect(combined).toContain('CodeGraph 这类 MCP provider 走 `mcp-tools.json`');
    expect(combined).toContain('Graphify 这类 CLI provider 走 `provider-tools.json`');
    expect(combined).toContain('CodeGraph 走 `mcp-tools.json` + `install-mcp`');
    expect(combined).toContain('Graphify 走 `provider-tools.json` + `install-helpers`');
    expect(codegraph).toContain('`codegraph init -i` 已弃用');
    expect(codegraph).toContain('v0.9.9');

    expect(combined).not.toContain('CodeGraph / Graphify entry');
    expect(combined).not.toContain('CodeGraph/Graphify）的 install + configure MCP + 首次 index');
    expect(combined).not.toContain('CLI+配 MCP+首次 index');
  });
});
