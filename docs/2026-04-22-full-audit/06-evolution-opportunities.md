# 演化机会清单

## 机会 1：把文档定位从“现行真源”收回到“治理草案/审计手册”

### 事实层

- 被审文档未提交、无 git 历史。
- 仓内没有配套 checker / schema / workflow command。

### 判断层

- 这是最大前提问题。

### 分类

- `应重构`

## 机会 2：补齐 dual-host governance 审计清单

### 事实层

- `setup` Codex 入口 drift
- `using-spec-first` 错路由 `spec-mcp-setup`
- 11 个 skill 命名漂移
- mirror drift
- agent reachability evidence 不完整

### 判断层

- 这是最贴近用户面的治理风险。

### 分类

- `应强化`

## 机会 3：收口 single source of truth 与 freshness

### 事实层

- `artifact-manifest.json` 双语义
- `ownership/review-queue` sample 发布
- `workspace-readiness-summary` 陈旧
- sample/live drift

### 判断层

- 这是 control-plane 可信度的关键缺口。

### 分类

- `应重构`

## 机会 4：把 `review-context` 从决策拼装层拉回事实层

### 事实层

- 已输出 `review_guidance`、verification recommendation，并依赖 `context-routing/change-surface`。

### 判断层

- 这与“scripts prepare, LLM decides”存在真实张力。

### 分类

- `应重构`

## 机会 5：把“推断性验证”和“真实 probe 验证”拆开

### 事实层

- `doctor verified` 仍是推断。

### 判断层

- 术语不清会误导治理判断。

### 分类

- `应强化`

## 机会 6：清理 ghost surface 与假接口

### 事实层

- `init --force` 未实际消费
- `skills.js` / `agents.js` 与当前控制面脱节

### 判断层

- 这是最小方案被历史兼容侵蚀的信号。

### 分类

- `应删除`
- `应重构`

## 机会 7：减少对 prompt 正文锚点的 CLI 级硬编码

### 事实层

- `plugin.js` 当前已经持有较多关键 workflow 的正文锚点检查。

### 判断层

- 价值存在，但容易演化成脚本持有语义判断。

### 分类

- `应轻量化`
- `应实验化`

## 机会 8：完善测试治理闭环

### 事实层

- `tests/contracts` 未接线
- rollback 缺故障注入测试
- release tarball 白名单偏松
- integration/e2e 命名漂移

### 判断层

- 这是工程成熟度继续上台阶的明显抓手。

### 分类

- `应强化`
- `应轻量化`

## 机会 9：为 agent 补 reachability contract

### 事实层

- 57 个 agent 中 23 个缺少 skill 侧直接 reachability evidence。

### 判断层

- 这会让 agent 资产逐步变成“存在但不可验证是否可触达”的灰区。

### 分类

- `应强化`

## 机会 10：将高成本 full-audit workflow 只用于高价值场景

### 事实层

- 多 Agent full audit 成本高，且当前无配套 workflow 强制执行。

### 判断层

- 适合用于架构治理、prompt/workflow/contract 重大演进，不适合成为所有审计的默认前置。

### 分类

- `应实验化`
