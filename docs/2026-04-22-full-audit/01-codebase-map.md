# 全量代码地图

## 审计覆盖证明

本次不是抽查。覆盖方式如下：

- 主线程：
  - 读取 `项目角色.md`、`项目治理-agent.md`
  - 枚举 `src/`、`skills/`、`agents/`、`tests/`、`docs/` 全量文件统计
  - 读取关键入口代码与 contract
  - 实跑 `npm test`
- Agent A：全量覆盖 `src/cli`、`bin/`、`package.json`、`.claude-plugin/plugin.json`、`AGENTS.md`、`CHANGELOG.md`
- Agent B：全量覆盖 `src/bootstrap-compiler`、`src/context-routing`、直接相关 schema/contract
- Agent C：全量覆盖 `src/crg`
- Agent D：全量覆盖 `skills/`、`agents/`、dual-host governance contract、`docs/10-prompt/skills` mirror
- Agent E：全量覆盖 `tests/` 与测试接线、发布验证链路
- 主裁决 Agent：只做归并，不新增事实采集

## 顶层文件规模

| 目录 | 文件数 | 角色 |
| --- | ---: | --- |
| `src` | 110 | 核心源码 |
| `src/cli` | 27 | 包级 CLI、注入、host 适配、state |
| `src/bootstrap-compiler` | 21 | bootstrap/control-plane 编译 |
| `src/context-routing` | 16 | Stage-0 选择、verification read model |
| `src/crg` | 46 | 图谱、检索、分析与 CRG CLI |
| `skills` | 175 | workflow/skill 真源 |
| `agents` | 61 | agent 真源 |
| `tests` | 191 | unit/smoke/integration/e2e/contracts |
| `docs` | 710 | 文档、契约、镜像、历史审计、知识资产 |
| `vendor` | 34 | 第三方 / vendored 内容 |

## 按职责层分组

### 1. 核心源码

- `src/cli`
  - `commands/`：`init`、`clean`、`doctor`、`stage0-context`
  - `adapters/`：Claude/Codex host 差异
  - `plugin.js`：filtered asset set、manifest、governance contract 消费
  - `state.js`：受管状态与 operation plan
  - `lang-policy.js` / `instruction-bootstrap.js` / `coding-guidelines.js`：根指令注入
- `src/bootstrap-compiler`
  - control-plane 机器产物与 human assets 编译
- `src/context-routing`
  - Stage-0 解释层、verification summary、dispatch posture、gate state、telemetry
- `src/crg`
  - parser、graph、incremental、retrieval、generation、命令层

### 2. 工作流资产真源

- `skills/`
  - 48 个 source skill/workflow 目录
  - 其中 `spec-review`、`document-review`、`using-spec-first`、`setup`、`spec-mcp-setup` 与本次审计直接相关
- `agents/`
  - review、research、document-review、workflow 等 agent 资产

### 3. 运行时模板与契约

- `.claude-plugin/plugin.json`
- `src/cli/contracts/dual-host-governance/*`
- `src/cli/contracts/quality-gates/*`
- `docs/contracts/*`

### 4. 测试

- `tests/unit`
- `tests/smoke`
- `tests/integration`
- `tests/e2e`
- `tests/contracts`

### 5. 文档与知识资产

- `docs/10-prompt`
  - prompt/role/governance
  - `skills` 与 `agents` 的镜像
- `docs/contracts`
  - machine-readable 对应的人类说明与 schema
- `docs/solutions`
  - 历史问题与经验沉淀

### 6. 第三方与 vendored

- `vendor/`
  - 不作为仓库哲学优劣的主审对象
  - 只纳入边界说明

## 关键真相源

| 主题 | 真相源 |
| --- | --- |
| 宿主命令真源 | `.claude-plugin/plugin.json` |
| skill 宿主治理真源 | `src/cli/contracts/dual-host-governance/skills-governance.json` |
| skill 内容真源 | `skills/` |
| agent 内容真源 | `agents/` |
| prompt 基线哲学 | `docs/10-prompt/项目角色.md` |
| 被审草案 | `docs/10-prompt/项目治理-agent.md` |

## 重要边界观察

### 事实层

- `skills/` 才是 skill 内容真源，`docs/10-prompt/skills` 只是镜像，不应反客为主。
- `项目治理-agent.md` 不是已提交文档，不能自动获得“治理真源”身份。
- `tests/contracts` 目录存在，但当前未接入 `package.json` 测试脚本。

### 判断层

- 仓库整体已经具备“多层代码事实 + contract + 测试”的真实治理基础。
- 但“治理文档自身是不是现行真源”与“仓库是否有治理哲学”是两件事，不能混淆。

## 结论

本次审计的覆盖证明成立：

- 目录层：全量枚举
- 代码层：按职责分治，不依赖抽样
- 测试层：包含实际执行结果
- 文档层：只作为辅助证据，并额外记录与代码冲突处
