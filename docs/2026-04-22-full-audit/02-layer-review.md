# 分层审查结果

## 第一层：哲学与治理基线

### 事实层

- `docs/10-prompt/项目角色.md` 已明确设定：
  - `Light contract`
  - `Explicit boundaries`
  - `Let the LLM decide`
  - `Scripts prepare, LLM decides`
- `AGENTS.md` 也把这套原则写成仓库级工程准则。
- `项目治理-agent.md` 与这套哲学同向，但当前是未跟踪草案。

### 判断层

- 哲学方向正确且一致。
- 当前缺的不是新哲学，而是“如何把哲学落实成可检查的治理清单”。

### 建议动作

- `应保留`：哲学基线
- `应强化`：治理真源前提与检查清单
- `应重构`：文档定位

## 第二层：CLI / control-plane

### 事实层

- 包级 CLI 很薄，只暴露 `doctor/init/clean/stage0-context`。
- 双宿主差异主要由 adapter 层和 `plugin.js` 驱动。
- marker-based 注入与保守 clean 策略边界清晰。
- 已发现：
  - `skills.js` / `agents.js` 与实际 adapter-aware 接口脱节
  - `init` 解析 `--force` 但不消费
  - `plugin.js` 对 prompt prose anchor 的依赖偏重

### 判断层

- CLI 总体符合“脚本做确定性流程”的预期。
- 主要风险不是流程太重，而是少数 helper 与语义检查出现边界漂移。

### 建议动作

- `应保留`：薄 CLI、state operation plan、dry-run、rollback、保守 clean
- `应重构`：失配 helper
- `应删除`：ghost `--force`
- `应轻量化`：prompt prose anchor 检查

## 第三层：bootstrap-compiler / context-routing

### 事实层

- verification 已拆成 `summary / dispatch / evidence / gate-state`，方向清楚。
- `selection_subject / selected_contexts` 能显式回答“命中了谁”。
- 已发现：
  - `artifact-manifest.json` 同名双语义
  - `ownership.json` / `review-queue.json` 由 sample 伪造发布
  - `workspace-readiness-summary` 发布即可能陈旧
  - `schema-loader` 只支持 JSON Schema 子集
  - sample/live drift
  - `cross-module` 命中条件过宽

### 判断层

- 这是当前“哲学没错，但 contract 落地不够干净”的最典型区域。
- 最大问题不是 gate 太强，而是多真相源与 freshness 失真。

### 建议动作

- `应保留`：verification 四拆分、fallback、selection subject
- `应重构`：manifest 双语义、ownership/review-queue 发布路径
- `应强化`：freshness 与 derivation 边界
- `应轻量化`：cross-module scope 命中

## 第四层：CRG

### 事实层

- `input-convergence / parser / graph / incremental / generations / retrieval` 的基本边界清楚。
- 结果显式标注 `Observed/Inferred/evidence/inference_reason`。
- 已发现：
  - `review-context` 跨层拼装 `review_guidance` 与 verification recommendation
  - `query.inheritors_of` 无事实生产链
  - deterministic helper 在多个命令中重复
  - `build.js` 职责偏重

### 判断层

- CRG 内核是“对齐哲学”的。
- 命令层开始局部向“小编排器”方向滑动，需要及时收口。

### 建议动作

- `应保留`：CRG 核心内核
- `应重构`：`review-context`
- `应删除` 或 `应修正`：`query.inheritors_of` 的无事实 surface
- `应轻量化`：命令层重复 helper

## 第五层：workflow assets / dual-host governance

### 事实层

- `setup` 的 Codex 入口写成 `$setup`，与 contract 不符。
- `using-spec-first` 错把 MCP setup 路由到 `setup`，而不是 `spec-mcp-setup`。
- 48 个 skill 中有 11 个目录名 / contract 名 / frontmatter name 不一致。
- `docs/10-prompt/skills` 与 source 已出现内容级 drift。
- 57 个 agent 中仅 34 个能从 skill 侧找到直接 reachability evidence。

### 判断层

- 这是最直接、最用户可见的治理 drift。
- 该区域必须进入 `项目治理-agent.md` 的显式检查清单，否则文档会错过当前最真实的治理风险。

### 建议动作

- `应强化`：dual-host governance checklist
- `应重构`：命名一致性与镜像同步策略
- `应强化`：agent reachability contract

## 第六层：测试、发布与工程成熟度

### 事实层

- `npm test` 全链通过。
- 测试层真实存在：unit、smoke、integration、e2e、release。
- 已发现：
  - `doctor.workflow_runnability=verified` 仍属推断
  - `tests/contracts` 未接线
  - tarball smoke 对未知 `tree-sitter-*` 只 warning
  - `integration/e2e` 命名边界漂移
  - destructive rollback 缺故障注入测试

### 判断层

- 工程成熟度整体偏高。
- 但文档如果要宣称“关键链路可验证”，就必须把这些空白明确写进去。

### 建议动作

- `应保留`：现有多层测试组合
- `应强化`：真实 runnable probe、rollback 测试、tests/contracts 接线、release 白名单
- `应轻量化`：integration/e2e 命名整理

## 第七层：被审文档自身

### 事实层

- 文档为未跟踪草案。
- 仓库没有与其一一对应的 workflow command / schema / checker。
- 它目前没有把 dual-host governance、mirror drift、agent reachability、sample/live drift、review-context 越界写成显式检查项。

### 判断层

- 该文档当前最大问题是“身份错位”，不是“方向错误”。

### 建议动作

- `应重构`：定位为草案 / 操作手册
- `应强化`：治理清单
- `应删除`：任何把自己写成现行真源的既成事实语气
