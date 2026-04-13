# spec-graph-bootstrap 阶段 3B 测试报告

- 日期：2026-04-13
- 目标方案：`docs/plans/2026-04-13-005-feat-spec-graph-bootstrap-stage3b-consumption-plan.md`
- 测试结论：`pass`
- 测试人：Codex（隔离 worktree 自动化验证）

## 1. 测试目标

验证阶段 3B 方案在当前仓库中的可自动证明部分是否成立，覆盖：

- 方案文档状态与验收项是否闭环
- `spec-plan` / `spec-work` / `spec-review` source skill 是否已接入 Stage-0 预载块
- `spec-first init --claude` / `spec-first init --codex` 后运行时副本是否同步到位
- `injection-index.yaml` 正常路由、Level 2、Level 3 三类降级行为是否符合方案

## 2. 测试范围

本报告只验证阶段 3B 方案文档覆盖的范围，不扩展到：

- LLM 在真实 Claude / Codex 会话中是否严格按预载块逐文件读取
- 其他未纳入阶段 3B 的 workflow
- command 层或 CLI 行为变更

## 3. 测试环境

- 仓库：`/Users/kuang/xiaobu/spec-first`
- 基线提交：`bc2c4a11 feat(spec-graph-bootstrap): 接入阶段3B Stage-0 消费 [FSREQ-GRAPH-3B]`
- 执行方式：从基线提交创建隔离 worktree，在临时目录中完成测试后清理

## 4. 测试方法

### 4.1 静态契约校验

验证对象：

- 方案文档 frontmatter `status`
- 文档中 3A gate / 实施清单 / 验收标准 checkbox
- `docs/contexts/spec-first/injection-index.yaml`
- `skills/spec-plan/SKILL.md`
- `skills/spec-work/SKILL.md`
- `skills/spec-review/SKILL.md`
- `skills/spec-graph-bootstrap/SKILL.md`
- `docs/validation/graph-bootstrap-3a-logs/*.md`

校验点：

- 方案文档为 `status: completed`
- 文档内不存在未勾选 checkbox
- `injection-index.yaml` 结构为 `always + stages + selection_rules + advice`
- `injection-index.yaml` 不包含 `task_types`
- 三个消费型 skill 都包含：
  - `## Stage-0 上下文预载`
  - `output_exists.*` 说明
  - `fact.*` v1 跳过说明
  - `Level 2 固定最小集合`
- `skills/spec-graph-bootstrap/SKILL.md` 的 yaml 生成模板不再生成 `task_types`
- 3 份 3A 记录齐全，且都包含 `allow_enter_3b: yes`

结果：

- `STATIC_CONTRACT_OK`

### 4.2 运行时同步校验

执行：

- `node bin/spec-first.js init --claude`
- `node bin/spec-first.js init --codex`

验证对象：

- `.claude/spec-first/workflows/spec-plan/SKILL.md`
- `.claude/spec-first/workflows/spec-work/SKILL.md`
- `.claude/spec-first/workflows/spec-review/SKILL.md`
- `.agents/skills/spec-plan/SKILL.md`
- `.agents/skills/spec-work/SKILL.md`
- `.agents/skills/spec-review/SKILL.md`

校验点：

- 运行时文件存在
- 均已同步 Stage-0 预载块
- 均包含 `output_exists.*`、`fact.*` 跳过说明、`Level 2 固定最小集合`

结果：

- `RUNTIME_SYNC_OK`

### 4.3 降级模拟校验

模拟方式：

1. 正常路由：保留 `docs/contexts/spec-first/injection-index.yaml`
2. Level 2：临时移走 `injection-index.yaml`
3. Level 3：临时移走整个 `docs/contexts/spec-first/`

按方案中的 v1 规则求值：

- `always[]`
- `stages.<stage>[]`
- `selection_rules` 中的 `output_exists.*`
- `fact.*` 跳过

校验点：

- 正常路由：
  - `plan` 命中 `architecture/module-map.md`
  - `work` 命中 `code-facts/test-map.md`
  - `review` 命中 `context-packs/review-change.md`
  - `output_exists.*` 能追加 `code-facts/public-entrypoints.md`
- Level 2：
  - 三个 stage 都进入固定 4 文件 fallback
- Level 3：
  - 三个 stage 都直接跳过预载，不加载文件

结果：

- `DEGRADE_SIM_OK`

正常路由求值结果：

```text
plan:
  00-summary.md
  README.md
  architecture/module-map.md
  code-facts/public-entrypoints.md
  code-facts/public-entrypoints.md

work:
  00-summary.md
  README.md
  code-facts/public-entrypoints.md
  code-facts/test-map.md
  code-facts/public-entrypoints.md

review:
  00-summary.md
  README.md
  code-facts/high-risk-modules.md
  pitfalls/index.md
  context-packs/review-change.md
  code-facts/test-map.md
  code-facts/public-entrypoints.md
```

说明：

- `public-entrypoints.md` 在 `plan/work` 中出现重复，是因为它同时来自 `stages.<stage>[]` 和 `output_exists.*`。这不会破坏 v1 契约，但消费端若要优化，可在未来做去重。

## 5. 测试发现

### 5.1 通过项

- 阶段 3B 方案文档本身已闭环，状态与 checkbox 一致
- 3A 准入证据齐全
- source skill 与运行时副本都已经接入 Stage-0 预载块
- yaml 路由、Level 2、Level 3 的自动化可验证部分都符合设计

### 5.2 重要背景事实

- `docs/contexts/spec-first/` 当前不是 git 跟踪资产，而是本地上下文现状的一部分
- 因此测试时在隔离 worktree 中额外复制了这套 Stage-0 产物，再进行路由和降级模拟
- 这不构成 3B 方案缺陷，但说明后续做 CI 化时需要显式准备测试上下文资产

### 5.3 未覆盖项

- 未在真实 Claude / Codex 交互会话中验证 LLM 是否严格按预载块逐文件读取
- 未验证用户在宿主中实际调用 `spec-plan` / `spec-work` / `spec-review` 时的自然语言降级提示文案

## 6. 最终结论

在当前仓库与基线提交 `bc2c4a11` 上，阶段 3B 方案的自动化可验证部分全部通过，可以认为：

- 文档契约已落地
- 运行时同步链路已打通
- 降级行为与方案一致

若要把验证提升到“宿主行为级验收”，下一步应在真实 Claude / Codex 会话中各执行一次 `spec-plan`、`spec-work`、`spec-review` 的人工验证。
