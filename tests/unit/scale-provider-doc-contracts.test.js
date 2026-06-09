'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SCALE_DOC_ROOT = path.join(REPO_ROOT, 'docs', '01-需求分析', '13.scale-integration');
const CODEGRAPH_DOC = path.join(SCALE_DOC_ROOT, 'CodeGraph技术方案.md');
const README_DOC = path.join(SCALE_DOC_ROOT, 'README.md');
const RUNTIME_SETUP_TARGET_DOC = path.join(SCALE_DOC_ROOT, 'Runtime-Setup目标.md');
const RUNTIME_SETUP_PLAN_DOC = path.join(
  REPO_ROOT,
  'docs',
  'plans',
  '2026-06-08-004-refactor-provider-native-runtime-setup-plan.md',
);
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
    const runtimeSetupTarget = fs.readFileSync(RUNTIME_SETUP_TARGET_DOC, 'utf8');
    const runtimeSetupPlan = fs.readFileSync(RUNTIME_SETUP_PLAN_DOC, 'utf8');
    const projectScaffold = fs.readFileSync(PROJECT_SCAFFOLD_DOC, 'utf8');
    const combined = [codegraph, parent, readme, runtimeSetupTarget, runtimeSetupPlan, projectScaffold].join('\n');

    expect(combined).toContain('CodeGraph 这类 MCP provider 走 `mcp-tools.json`');
    expect(combined).toContain('Graphify 这类 CLI provider 走 `provider-tools.json`');
    expect(combined).toContain('CodeGraph 走 `mcp-tools.json` + `install-mcp`');
    expect(combined).toContain('Graphify 走 `provider-tools.json` + `install-helpers`');
    expect(readme).toContain('| v1.16 | Capability-aware 协同');
    expect(readme).toContain('父 plan：`docs/plans/2026-06-06-001-feat-capability-aware-provider-coordination-plan.md`');
    expect(readme).toContain('当前 provider-native Runtime Setup 开发主方案：`docs/plans/2026-06-08-004-refactor-provider-native-runtime-setup-plan.md`');
    expect(codegraph).toContain('最佳版本不是 `源码 -> CodeGraph -> Graphify` 的硬线性 pipeline');
    expect(codegraph).toContain('直接 source read / rg / ast-grep = confirmed evidence lane');
    expect(codegraph).toContain('CodeGraph = tactical index，用来缩小源码读取面、给出调用链/影响面/受影响测试/ownership 候选');
    expect(codegraph).toContain('Graphify  = strategic project map，综合源码证据 + 可选 CodeGraph candidates');
    expect(codegraph).toContain('CodeGraph 服务于更快找到该读的源码');
    expect(codegraph).toContain('源码始终服务于验证结论是否成立');
    expect(codegraph).toContain('workflow 优先调用 Graphify MCP/CLI 工具接口获取结果');
    expect(codegraph).toContain('只有无工具接口但已有 project-root `GRAPH_REPORT.md` 时，才有界读取这三段作 fallback');
    expect(codegraph).toContain('workflow 通过 provider-native MCP/CLI 工具接口获取 advisory candidates');
    expect(codegraph).toContain('Graphify  = project-graph 能力工具：setup 里帮装 CLI 和 project skill');
    expect(codegraph).toContain('产物默认是项目根 `graphify-out/`');
    expect(runtimeSetupTarget).toContain('Runtime Setup = 安装 + 配置 + 首次初始化/首次生成 + 输出工具说明');
    expect(runtimeSetupTarget).toContain('外部 agent、skill、MCP 工具、CLI helper、provider 等能力应该集中到少数 registry/config 文件中');
    expect(runtimeSetupTarget).toContain('脚本只能执行受控 case，不执行 registry 内的任意 shell 字符串');
    expect(runtimeSetupTarget).toContain('新增工具的理想路径是 **configuration-first**，但不是所有工具都能只改配置');
    expect(runtimeSetupTarget).toContain('如果不是，必须补最小脚本 case 和验证');
    expect(runtimeSetupTarget).toContain('下游 `spec-plan` / `spec-work` / `spec-review` / `spec-debug` 只能读取说明并调用已有工具接口');
    expect(runtimeSetupTarget).toContain('canonical machine consumer surface 是既有 `.spec-first/config/tool-facts.json` 内的 `provider_readiness[]`');
    expect(runtimeSetupTarget).toContain('`runtime-tooling-summary.md` 只是从同一组 deterministic facts 派生的人类可读视图');
    expect(runtimeSetupTarget).toContain('缺失本身不触发 degraded');
    expect(runtimeSetupTarget).toContain('`team` / `user` 不是当前 registry enum');
    expect(runtimeSetupTarget).toContain('也不在本批实现');
    expect(runtimeSetupTarget).toContain('registry 将两者降为 `profile: optional`');
    expect(runtimeSetupPlan).toContain('@colbymchenry/codegraph@0.9.9');
    expect(runtimeSetupPlan).toContain('codegraph init');
    expect(runtimeSetupPlan).toContain('codegraph status');
    expect(runtimeSetupPlan).toContain('codegraph sync');
    expect(runtimeSetupPlan).toContain('Pending Changes');
    expect(runtimeSetupPlan).toContain('.codegraph/codegraph.db');
    expect(runtimeSetupPlan).toContain('codegraph serve --mcp');
    expect(runtimeSetupPlan).toContain('Auto-Sync watcher');
    expect(runtimeSetupPlan).toContain('graphifyy==0.8.36');
    expect(runtimeSetupPlan).toContain('graphify install --project --platform codex');
    expect(runtimeSetupPlan).toContain('graphify extract .');
    expect(runtimeSetupPlan).toContain('graphify update .');
    expect(runtimeSetupPlan).toContain('graphify-code-only-fallback-used');
    expect(runtimeSetupPlan).toContain('graphify-out/graph.json');
    expect(runtimeSetupPlan).toContain('graphify hook install');
    expect(runtimeSetupPlan).toContain('Graphify project skill is installed after confirmation; Graphify MCP extra/watch remains optional.');
    expect(runtimeSetupPlan).toContain('.spec-first/workspace/providers/graphify/graphify-out` returns as the default Graphify artifact root');
    expect(runtimeSetupPlan).toContain('old `.spec-first/workspace/providers/graphify` Graphify default as superseded');
    expect(runtimeSetupTarget).toContain('让后续代码 AST 刷新由 provider hook 触发');
    expect(runtimeSetupTarget).toContain('执行项目级 `graphify hook install`');
    expect(runtimeSetupTarget).toContain('graphify update .');
    expect(runtimeSetupTarget).toContain('执行当前 host 的 project-scoped skill install');
    expect(runtimeSetupTarget).toContain('Graphify MCP server 是可选 extra，不默认安装');
    expect(runtimeSetupTarget).toContain('`graphify watch` 是长运行进程，不作为默认 setup 动作');
    expect(runtimeSetupPlan).toContain('Graphify hooks are part of the confirmed provider pack');
    expect(runtimeSetupPlan).toContain('run `graphify hook install` in git repos');
    expect(runtimeSetupPlan).toContain('Runtime mirror compatibility is required');
    expect(runtimeSetupPlan).toContain('current shell PATH/env overrides');
    expect(runtimeSetupTarget).toContain('缺少 `--requirement-workspace` 时 input scope 默认是 resolved project workspace');
    expect(runtimeSetupTarget).toContain('Graphify 生成物默认写入 provider-native 项目根目录 `graphify-out/`');
    expect(runtimeSetupTarget).toContain('生成物默认是本地 provider-owned 上下文');
    expect(codegraph).toContain('已源码核实（本地 `src/bin/codegraph.ts:420-448`）');
    expect(codegraph).toContain('`-i/--index` 为 deprecated no-op');
    expect(codegraph).toContain('v0.9.9');

    // 2026-06-08 provider-native Graphify 本地源码校准
    expect(runtimeSetupTarget).toContain('graphify extract .');
    expect(runtimeSetupPlan).toContain('Graphify `extract <path>` writes `<path>/graphify-out/` by default');
    expect(runtimeSetupPlan).toContain('graphify extract');
    expect(runtimeSetupPlan).toContain('code-only `graphify update .`');
    expect(runtimeSetupPlan).toContain('$graphify .');

    // 当前 machine surface 仍是 provider_readiness[]，不新增独立 provider manifest。
    expect(runtimeSetupTarget).toContain('canonical machine consumer surface 是既有 `.spec-first/config/tool-facts.json` 内的 `provider_readiness[]`');
    expect(runtimeSetupTarget).toContain('"schema_version": "provider-readiness.v2"');
    expect(runtimeSetupTarget).toContain('"profile": "optional"');
    expect(runtimeSetupPlan).toContain('Any install/apply summary is derived output for the user and should not become a second durable truth source.');
    // B3: §5.1 准入门槛回溯校验存量 recommended
    expect(runtimeSetupTarget).toContain('这道门槛也必须回溯校验存量');
    expect(runtimeSetupTarget).toContain('不进 `recommended` baseline');
    expect(runtimeSetupTarget).toContain('不生成校验脚本、不进 CI gate');
    // 形态分档主轴 + setup-only 不变量(A2/A3)
    expect(runtimeSetupTarget).toContain('主轴是「steady-state 刷新由谁拥有」');
    expect(runtimeSetupTarget).toContain('绝不下放成下游分支键');
    expect(runtimeSetupTarget).toContain('不新增 `provider_form` registry enum');

    // 2026-06-08 deep-research 收敛:刷新归属按 provider 形态分档(daemon 代管 / 快照按需重跑)
    expect(runtimeSetupTarget).toContain('### 2.1 刷新归属按 provider 形态分档');
    expect(runtimeSetupTarget).toContain('“后续刷新交还 provider” 不是一刀切，必须按 provider 形态分档');
    expect(runtimeSetupTarget).toContain('不要用“provider watcher 代管刷新”框架硬套快照式工具');
    expect(runtimeSetupPlan).toContain('CodeGraph owns MCP watcher refresh');
    expect(runtimeSetupPlan).toContain('Graphify owns `$graphify` usage and git-hook refresh');
    // manifest 是 application-layer,不宣称 MCP 协议原生
    expect(runtimeSetupTarget).toContain('不对标也不宣称等同 MCP 原生 capability negotiation');
    expect(runtimeSetupTarget).toContain('不得包装成协议原生能力');
    // Provider 准入门槛(抗膨胀)
    expect(runtimeSetupTarget).toContain('### 5.1 Provider 准入门槛');
    expect(runtimeSetupTarget).toContain('“快速集成优秀能力”会退化成“快速膨胀”');
    expect(runtimeSetupTarget).toContain('不进 `recommended` baseline');
    // 证据基线:外部一手来源钉入文档
    expect(runtimeSetupTarget).toContain('## 10. 证据基线');
    expect(runtimeSetupTarget).toContain('https://sourcegraph.com/docs/code-search/code-navigation/auto_indexing');
    expect(runtimeSetupTarget).toContain('https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/');
    expect(runtimeSetupPlan).toContain('provider-owned behavior with providers');

    expect(combined).not.toContain('CodeGraph / Graphify entry');
    expect(combined).not.toContain('CodeGraph/Graphify）的 install + configure MCP + 首次 index');
    expect(combined).not.toContain('CLI+配 MCP+首次 index');
    expect(codegraph).not.toContain('产物当普通 doc 读');
    expect(codegraph).not.toContain('并 check-in');
    expect(codegraph).not.toContain('workflow 只消费已有 advisory capability/artifact');
    expect(runtimeSetupTarget).not.toContain('Runtime Setup 只安装不初始化');
    expect(runtimeSetupTarget).not.toContain('Graphify SKILL/MCP 仍不默认安装');
    expect(runtimeSetupTarget).not.toContain('不能退回 repo-root `graphify-out/`');
  });
});
