# CRG Workspace Topology 后续扩展说明

> Lifecycle: historical-input / external-reference. 本文保留旧架构、方案、迁移或研究记录；当前 source of truth 以 `docs/README.md`、根目录 README、`docs/05-用户手册/`、`docs/contracts/`、`skills/`、`src/cli/` 和 `CHANGELOG.md` 为准。

## 背景

当前 CRG workspace topology 已经完成三类开发模式的基础支持：

| 场景 | 当前支持方式 | 当前边界 |
|------|--------------|----------|
| 父目录下多个独立 git 工程 | workspace preflight + child repo-local CRG | 父目录只保存 `.spec-first/workspace/*`，不生成混合 `graph.db` |
| 单个 git 工程下多个 module | 单 repo graph + `repo-topology.json` | 当前 detector MVP 支持 Maven `<modules>` |
| 单个 git 工程单项目 | 原 repo-local CRG | 新增 `single_repo` advisory topology，不改变原 graph 生命周期 |

后续扩展的目标不是把脚本做成语义 router，而是继续提升事实层输入质量。必须继续遵守：

- Scripts prepare, LLM decides
- Workspace facts are advisory, not final selection
- Child repos own their graph lifecycle
- Modules are repo-local topology units, not fake child repos
- Cross-repo work must keep repo boundary explicit

---

## 扩展项总览

| 扩展项 | 类型 | 优先级 | 核心价值 |
|--------|------|--------|----------|
| JavaScript workspace detector | Repo-local topology | P1 | 覆盖 npm / pnpm / yarn monorepo 主流场景 |
| workspace stale/freshness 增强 | Workspace control plane | P1 | 防止 stale index 误导 plan/work/review |
| schema / reason-code registry | Contract hardening | P1 | 稳定 workflow 与 LLM 消费字段 |
| submodule / worktree 深化支持 | Git topology | P1 | 避免误把特殊 git root 当普通 sibling repo |
| golden contract tests | Verification | P1 | 防止 public JSON contract 漂移 |
| `workspace build --all` | Maintenance command | P2 | 降低大型 workspace 初始化成本 |
| workspace diagnostics / explain | Observability | P2 | 帮用户理解 workspace 被如何识别 |
| workspace config polish | Scope control | P2 | 降低父目录扫描噪声 |
| multi-child review support | Review workflow | P2 | 提升多 repo PR / branch 审查质量 |
| cross-repo dependency facts | Cross-repo facts | P3 | 提升跨 repo 影响判断质量 |
| cross-child task orchestration | Workflow composition | P3 | 支持显式多 repo work-run 汇总 |
| workspace visualization | Human-readable view | P3 | 让大 workspace topology 更直观 |
| runtime artifact hygiene | Dev ergonomics | P3 | 降低本地验证后的工作区噪声 |

---

## P1：优先扩展

### 1. JavaScript Workspace Detector

**待开发内容**

- 读取 npm `package.json` 的 `workspaces`
- 读取 pnpm `pnpm-workspace.yaml`
- 读取 yarn workspace 声明
- 将 package units 写入 repo-local `.spec-first/graph/repo-topology.json`
- 输出 stable signals 和 limitations，例如：
  - `module_declaration_detected`
  - `module_path_missing`
  - `module_config_malformed`

**挑战**

- npm / pnpm / yarn 的 workspace 声明格式不同。
- pnpm workspace glob 支持 negation，不能用过于随意的字符串切分替代结构化解析。
- package 是 repo-local topology unit，不应生成独立 graph，也不应被 workspace 层当 child repo。
- malformed config 必须降级为 limitation，不能静默回落为 `single_repo`。

**价值**

- Node / frontend / full-stack monorepo 是高频使用场景。
- LLM 在 plan/work/review 时能看到 package 边界，减少读错 module、漏改 package 的风险。
- 继续强化“一个 git repo 一个 graph，module 只是 advisory topology”的核心模型。

**成功信号**

- npm / pnpm / yarn fixtures 能生成 `monorepo_multi_module`。
- missing package / malformed config 产生 limitations。
- package units 不创建自己的 `.spec-first/graph/`。

---

### 2. Workspace Stale / Freshness 增强

**待开发内容**

- 更准确识别 child repo 删除、重命名、不可读、失效、graph 过期。
- 在 `workspace status/context` 中稳定输出 stale / freshness reason codes。
- 对 `root_fingerprint` 增加更可解释的变化来源。

**挑战**

- 文件系统状态、Git root 状态、graph generation 状态会独立变化。
- renamed child repo 很难仅靠路径可靠判断，需要避免过度推断。
- 不能让 stale index 成为第二真相源；当前 scan/status/context 仍应以实时验证为准。

**价值**

- 长期使用 workspace 时，候选 repo 不会因为旧 index 误导 workflow。
- 让 LLM 明确知道哪些 child 是 ready、missing、degraded、stale。
- 提升 `spec-graph-bootstrap` 在父目录打开时的可信度。

**成功信号**

- 删除 child 后不再作为 ready candidate 出现。
- 不可读 child 不影响健康 sibling。
- status/context 推荐命令只指向仍可验证的 child repo。

---

### 3. Schema / Reason-Code Registry

**待开发内容**

- 抽象最小 shared limitation shape：`code` + `message`。
- 统一 workspace index/status/context/topology 的 stable signal 和 limitation code。
- 为 public JSON contract 增加真实输出校验。

**挑战**

- contract 太松保护不了消费者；太重会违背 light contract。
- reason-code registry 不能膨胀成规则引擎。
- schema 只应保护结构边界，不应承担语义裁决。

**价值**

- workflow skills 和 LLM 可以稳定消费 machine-readable facts，不需要解析 prose。
- 减少字段漂移导致的 prompt 失效。
- 让后续 detector / diagnostics / review 支持有统一事实语言。

**成功信号**

- 所有 limitations 至少含 `code` / `message`。
- workspace context/status/topology 的真实 CLI 输出能通过 contract。
- 新增 reason code 时有测试覆盖。

---

### 4. Submodule / Worktree 深化支持

**待开发内容**

- 增加真实 git submodule fixture。
- 增加真实 git worktree fixture。
- 明确 fallback scan 下它们默认是 advisory non-candidate。
- 明确 explicit scope / explicit selection 时如何允许进入 repo-local CRG。

**挑战**

- submodule / worktree 都可能通过 `git rev-parse --show-toplevel`，但语义不是普通 sibling repo。
- 默认自动候选会误导，完全禁止又会损害高级用户场景。
- 需要同时描述 relationship、candidate、limitations 和 recommended commands。

**价值**

- 避免 workspace 扫描把 submodule/worktree 当独立工程误用。
- 对使用 Git worktree 的高级开发者更友好。
- 强化 “relationship first, LLM/user chooses” 的边界。

**成功信号**

- fallback scan 下 submodule/worktree 有 relationship label。
- 默认不作为普通 candidate。
- explicit include 或 explicit build 能清晰选择它们。

---

### 5. Golden Contract Tests

**待开发内容**

- 对 `crg workspace scan/status/context/build` 的真实 CLI 输出做 golden 或 normalized snapshot。
- 对 `repo-topology.json` 做真实 artifact schema validation。
- 稳定化时间戳、绝对路径、排序等易变字段。

**挑战**

- golden tests 容易脆弱。
- 路径、时间、generation id、warnings 都需要 normalization。
- 不能把 golden 变成阻碍合理演化的重型 contract。

**价值**

- 防止 public JSON contract 被无意改坏。
- 对 workflow skill 消费方更稳定。
- 能捕获单元测试未覆盖的 CLI envelope 形状漂移。

**成功信号**

- 真实 CLI 输出经过 normalization 后稳定通过。
- 新增字段不会误伤，删除关键字段会失败。
- workspace context 不出现 `selected_repo` / `target_repo` / `final_repo`。

---

## P2：中期扩展

### 6. `workspace build --all`

**待开发内容**

- 一次构建 workspace 下多个 child repo。
- 输出 per-child build result。
- 汇总 partial success / partial failure。

**挑战**

- 需要定义 aggregate exit semantics。
- 一个 child build 失败不能遮盖其他 child 的成功。
- 不能误构建 unrelated repo。
- 需要控制耗时和输出规模。

**价值**

- 大 workspace 初始化更省事。
- 适合维护型命令，不适合默认 workflow 自动执行。

**边界**

- `--all` 只能是显式维护动作。
- 不应成为 plan/work/review 默认入口。

---

### 7. Workspace Diagnostics / Explain

**待开发内容**

- 增加 `workspace explain` 或 `workspace tree` 类命令。
- 汇总 root、children、relationship、readiness、limitations、recommended next commands。

**挑战**

- 不能只是重复 JSON。
- 需要面向人类解释“为什么这个 repo 是候选 / 不是候选”。
- 输出仍应基于事实，不做 semantic final decision。

**价值**

- 用户能快速检查 workspace 配置和扫描结果。
- 降低“为什么 agent 选不到 repo”的排障成本。

---

### 8. Workspace Config Polish

**待开发内容**

- 明确 include/exclude/max_depth 优先级。
- 增加 explicit promotion 语义，例如允许 submodule/worktree 成为 candidate。
- 增加 config contract examples。

**挑战**

- 配置规则不能复杂到像规则引擎。
- include/exclude 冲突必须可解释。
- 配置只控制 deterministic scope，不能表达语义任务路由。

**价值**

- 用户可控地缩小父目录扫描范围。
- 降低无关 repo 噪声。
- 让 workspace preflight 更可预测。

---

### 9. Multi-Child Review Support

**待开发内容**

- 支持审查一个显式 multi-child 变更集合。
- 每个 child repo 独立收集 diff、graph evidence、candidate tests。
- workspace 层只汇总报告，不合并 graph。

**挑战**

- review scope 很容易混乱。
- 必须保留每个 child 的 base、diff、graph readiness。
- 不能把 multi-child review 变成隐式 multi-child work-run。

**价值**

- 多 repo PR / branch 的审查质量更高。
- 减少跨 repo 变更漏审。

---

## P3：后期扩展

### 10. Cross-Repo Dependency Facts

**待开发内容**

- 收集 child repo 之间的轻量依赖事实，例如 package name、API client、配置引用。
- 区分 observed / inferred / user-provided。

**挑战**

- 跨 repo dependency 很容易误推断。
- 不能把弱相关当强依赖。
- 需要避免生成中心化 cross-repo truth。

**价值**

- 提高跨 repo plan/review 的影响判断质量。
- 帮 LLM 更快发现“可能还要看另一个 repo”。

**边界**

- 只提供 dependency facts。
- 最终是否涉及另一个 repo，仍由 LLM/user 判断。

---

### 11. Cross-Child Task Orchestration

**待开发内容**

- 支持一个任务显式拆成多个 repo-local work-runs。
- 生成 workspace-level summary。

**挑战**

- 容易滑向强编排。
- 需要保持每个 child work-run 独立。
- 脚本不能自动决定任务涉及哪些 repo。

**价值**

- 多 repo 改动更容易追踪。
- 可以明确记录 repo-a / repo-b 各自完成了什么。

**边界**

- 用户或 LLM 明确选择 child repos 后，脚本才执行 deterministic orchestration。
- 不支持隐式“一个任务自动跑所有相关 repo”。

---

### 12. Workspace Visualization

**待开发内容**

- 生成人类可读 workspace topology / readiness 视图。
- 可选输出 Mermaid / markdown tree。

**挑战**

- 不能引入额外复杂 UI 依赖。
- 视图必须与 CLI JSON contract 同步。

**价值**

- 大 workspace 更容易理解。
- 适合计划和审查时作为 overview。

---

### 13. Runtime Generated Artifact Hygiene

**待开发内容**

- 明确 `.spec-first/graph` 下 WAL/SHM、generations、work-runs 的清理或忽略策略。
- 提供安全 dry-run cleanup。

**挑战**

- 不能误删有效 generation。
- 不能破坏 last-known-good / current pointer。
- 需要区分测试噪声和用户有意保留的运行产物。

**价值**

- 降低本地验证后的工作区噪声。
- 让 review / commit 更干净。

---

## 推荐路线

### 第一阶段：稳事实层

优先做：

1. JavaScript workspace detector
2. workspace stale/freshness 增强
3. schema / reason-code registry
4. submodule / worktree 真实 fixture
5. golden contract tests

这一阶段的目标是提升 LLM 决策输入质量，而不是增加流程控制。

### 第二阶段：提升可用性

再做：

1. `workspace build --all`
2. workspace diagnostics / explain
3. workspace config polish
4. multi-child review support

这一阶段主要提升效率、可观测性和用户掌控感。

### 第三阶段：跨 repo 能力

最后再考虑：

1. cross-repo dependency facts
2. cross-child task orchestration
3. workspace visualization

这一阶段风险最高，必须防止脚本替代 LLM 做语义判断。

---

## 不应做的方向

- 不应创建父目录混合 `graph.db` 作为默认路径。
- 不应让 `workspace context` 输出 `selected_repo`、`target_repo`、`final_repo`。
- 不应把 module 伪装成 child repo。
- 不应把 `workspace build --all` 变成 workflow 默认动作。
- 不应引入复杂规则引擎来替代 LLM 判断。
- 不应把 stale index 当成事实真源。

---

## 结论

当前已完成的 workspace topology 基础能力解决的是边界问题：

- workspace root 只做 preflight facts
- child repo 独立拥有 graph
- module 是 repo-local advisory topology
- LLM/user 做最终语义选择

后续扩展应继续沿着这个方向演进：增加更稳定、更准确、更可解释的事实输入，而不是增加隐藏路由、强编排或状态机。
