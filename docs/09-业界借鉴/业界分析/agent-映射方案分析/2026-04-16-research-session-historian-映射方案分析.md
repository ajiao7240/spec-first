# research/session-historian 映射方案分析

> Lifecycle: historical-input / external-reference. 本文保留历史 CRG/CE/ECC 方案、迁移或对比材料；其中 `src/crg`、`spec-first crg`、`graph.db`、`better-sqlite3`、`.claude-plugin`、`CRG Stage-0`、`ECC`、`compound-engineering-plugin`、命令数量和文件数量等旧口径可能已过期。当前 source of truth 以 `docs/archive-index.md`、`docs/README.md`、根目录 README、`docs/05-用户手册/`、`docs/contracts/`、`skills/`、`src/cli/`、`CHANGELOG.md`、`spec-mcp-setup` 和 `spec-graph-bootstrap` 为准。

## 1. 结论摘要

结论：当前版本已经正确承接上游能力，并把 compound 调用说明进一步收口为中性表述，不需要回退。

上下游差异只有两类：

- compound 调用说明从宿主命名迁移进一步收口为 “project compound workflow”
- 默认输出头的 fenced code block 从无 info string 改成了 ```text

这两处都不会缩减 `session-historian` 的核心能力；前者是当前仓库调用链适配，后者是输出格式卫生优化。

## 2. 代码事实

### 2.1 对比文件

- 上游文件：`/Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering/agents/research/session-historian.md`
- 当前文件：`/Users/kuang/xiaobu/spec-first/agents/research/session-historian.md`

### 2.2 实际差异

静态 diff 可归纳为 3 处：

1. `This agent serves two modes of use` 段
   - 上游：`/ce:compound`
   - 当前：`the project's compound workflow`

2. `Why this matters` 段
   - 上游：`Compound documentation (/ce:compound)`
   - 当前：`The project's compound documentation workflow`

3. `## Output` 的默认 header 示例
   - 上游：普通 fenced code block
   - 当前：```text fenced code block

其余内容保持一致，包括：

- Claude / Codex / Cursor 三类 session 源定义
- `discover-sessions.sh`、`extract-metadata.py`、`extract-skeleton.py`、`extract-errors.py` 的脚本合同
- 窗口扩大策略
- 选 session 的优先级
- 不得读取整份 session 文件、不得泄露 reasoning/tool input 的 guardrails

### 2.3 当前仓库中的消费链

当前仓库中，`session-historian` 有两条明确入口：

- `skills/spec-compound/SKILL.md`：Full 模式下可选 dispatch `spec-first:research:session-historian`
- `skills/spec-sessions/SKILL.md`：把它作为独立的 session 搜索入口

测试与打包链也把它当成正式资产：

- `tests/unit/spec-compound-contracts.test.js` 断言 `spec-compound` 恢复了 `spec-first:research:session-historian` 流程
- `tests/unit/agent-support-contracts.test.js` 覆盖 agent 资产去重支持
- `tests/smoke/cli.sh` 检查 `.claude` / `.codex` 运行态中存在 `session-historian.md`

## 3. 上游实现解读

上游版本的核心意图是建立一个“跨 Claude Code / Codex / Cursor 的会话知识桥”：

- 用脚本先做过滤和骨架提取
- 不直接把大 JSONL 塞进上下文
- 输出调查路径、失败尝试、决策依据和跨工具盲点

它的核心能力完全在 session source 解析与 guardrail 设计上，而不在产品命名。

## 4. 当前实现解读

当前版本保留了上游的完整方法论，并把 compound 调用入口说明进一步抽象成当前项目通用的中性表述。

同时把默认输出头的 fenced block 显式标成 `text`，让该片段在 markdown 渲染和后续复制时更稳定，不被误判成别的语法。

## 5. 差异细节与影响

### 5.1 宏观层面

宏观上，这仍然是一次宿主迁移后的中性化收口，不是能力漂移。

如果回退上游文本，问题不在 session 搜索逻辑，而在调用链说明会重新指向当前仓库已不存在的 `/ce:compound` 入口。

### 5.2 微观层面

微观上：

- 中性 compound workflow 对齐保证文档写法和当前 skill 链一致
- ```text 只影响默认展示格式，不改变结构化内容

因此，当前差异不会让 session historian 多搜或少搜任何历史数据。

## 6. 最优解判断

最优解是：**保留当前 `spec-first` 版本，不做回退。**

判断依据：

1. 当前仓库真实调用入口仍是 `spec-compound` 与 `spec-sessions`
2. 上下游主能力合同完全一致
3. 中性表述进一步降低了未来再次改名时的维护成本
4. `text` info string 属于低风险输出卫生优化
5. 当前测试和 smoke 链已经围绕现有命名建立契约

## 7. 吸收建议 / 保留分叉建议

### 建议保留

- 保留当前 “project compound workflow” 中性表述
- 保留 ```text 输出格式

### 当前结论

- 本轮高频命名硬编码优化已完成

### 审查边界

本文只基于静态代码、skill 调用链和测试契约做判断，未执行运行时测试。
