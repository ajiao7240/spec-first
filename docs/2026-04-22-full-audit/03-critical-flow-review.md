# 关键链路全流程审查

## 1. 包级入口到宿主入口

### 事实层

- `bin/spec-first.js` 将 `crg` 单独路由，其余走 `src/cli/index.js`。
- `src/cli/index.js` 只暴露 `doctor/init/clean/stage0-context`。
- 帮助文案明确 `/spec:*` 与 `$spec-*` 是宿主入口，不是 package 子命令。

### 判断层

- 这条链路边界清楚，符合“包级 CLI 管运行时资产，宿主负责 workflow surface”的设计。

### 建议动作

- `应保留`

## 2. `init` -> runtime 资产 -> managed state

### 事实层

- `init` 会：
  - 解析 host
  - 读取旧 state
  - 识别 legacy state / runtime drift
  - 生成 filtered asset set
  - 生成 operation plan
  - 在必要时做 hard reset + rollback 保护
- 还会顺带写 repo profile / README seeds。

### 判断层

- `init` 的 runtime 资产同步链路成熟度较高。
- 但它开始兼任 repo seed bootstrap，边界表达不够显式。

### 建议动作

- `应保留`：hard reset、rollback、dry-run、保守 state 驱动
- `应强化`：init 与 repo seed bootstrap 的职责说明
- `应删除`：ghost `--force`

## 3. `doctor` -> 诊断报告 -> workflow runnability

### 事实层

- `doctor` 会诊断：
  - install/runtime/host readiness
  - managed state
  - verification evidence
  - workflow surface
  - workflow runnability
- 但 `workflow_runnability=verified` 的成立条件仍然是 runtime 资产 + evidence 文件，不是真实宿主 probe。

### 判断层

- `doctor` 已是强诊断工具。
- 但“verified”语义过强，容易被误解为真实可运行验证。

### 建议动作

- `应强化`：增加可选 runnable probe
- `应轻量化`：调整文档与输出术语，区分推断与真实探测

## 4. `stage0-context` -> bootstrap/control-plane -> context-routing

### 事实层

- `stage0-context` 输出 `selection_subject / selected_contexts / fallback_reason / verification_summary / verifier_dispatch / verification_gate_state`。
- `context-routing` 负责 read-model 投影，不直接执行 verifier。
- 但 `artifact-manifest.json` 存在 repo-root 与 workspace-root 双语义。
- `workspace-readiness-summary` 发布时效可能失真。

### 判断层

- 这条链路方向正确，但存在“同名 contract 双语义”和 freshness 失真。

### 建议动作

- `应重构`：manifest 语义
- `应强化`：workspace readiness freshness

## 5. `using-spec-first` -> workflow 路由

### 事实层

- `using-spec-first` 把 review/audit 正确路由到 `$spec-review` 语义。
- 但它把 MCP setup 也混入 `setup` 路由，而 contract 明确存在 `spec-mcp-setup`。
- `setup` 自身的 Codex 入口文案也与 contract 不一致。

### 判断层

- 当前 workflow 入口治理最明显的问题不在设计，而在文案和 route drift。

### 建议动作

- `应强化`：dual-host / route checklist
- `应重构`：setup / spec-mcp-setup 的入口与路由文案

## 6. `spec-review` / `document-review` -> agent 触达

### 事实层

- `document-review` 的 skill/agent 集合对齐较好。
- `spec-review` 的 agent 集合本身引用完整，但自身命名与 frontmatter 漂移。
- agent 层整体 reachability evidence 不完整。

### 判断层

- “workflow 是否能稳定触达对应 agent” 需要从隐式事实提升为显式治理项。

### 建议动作

- `应强化`：agent reachability contract

## 7. `crg build/query/review-context`

### 事实层

- 核心 build -> parser -> graph -> postprocess -> generations 链路清楚。
- retrieval 管线可解释。
- `review-context` 已跨层输出 `review_guidance` 与 verification recommendation。
- `query.inheritors_of` 无事实生产链支撑。

### 判断层

- CRG 核心链路健康。
- review-context 是当前最需要及时收边界的关键链路。

### 建议动作

- `应重构`：review-context
- `应删除` 或 `应修正`：无事实支撑的 query surface

## 8. 发布链：`test:release` -> `npm pack` -> `npm publish`

### 事实层

- 发布脚本要求先执行 release 测试，再打包，再发布。
- tarball 安装 smoke 已验证 shim、postinstall、Swift parser 加载。
- 但未知 `tree-sitter-*` 依赖目前只 warning。

### 判断层

- 发布链是可信的。
- 但白名单策略还不够硬。

### 建议动作

- `应保留`：当前发布链主结构
- `应强化`：未知依赖 fail-fast
