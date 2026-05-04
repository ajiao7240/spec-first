# 过度设计与简化审查

审查日期：2026-05-04

## 结论

`spec-first` 不是整体过度设计。它的复杂度来自真实目标：把 AI coding 从一次性对话变成可规划、可执行、可审查、可沉淀的工程闭环。

但项目存在 **局部过厚、入口过多、成本信号不足** 的问题。当前 42 个 skills、51 个 agents、21 个 workflow command 对维护者是可治理的，对首次用户则需要更强的 progressive disclosure。复杂能力应继续存在，但必须通过公开入口、beta 标记、cost note、headless runner 和 durable artifacts 收敛使用成本。

## 过度设计矩阵

| 疑似过度设计点 | 当前表现 | 为什么可能过度 | 是否保留 | 简化建议 |
|---|---|---|---|---|
| Skill 数量 | source 有 `42` 个 skill，runtime 过滤后仍向 Codex 投递 `21` 个 workflow skills | 用户很难判断何时用 brainstorm、ideate、standards、plan、work、debug、optimize、polish | 保留，但分层 | 建 public workflow / standalone / internal / beta catalog；README 只展示主路径 |
| Agent 数量 | source 与 runtime 都有 `51` 个 agents | 维护成本和上下文选择成本高；用户会误以为需要显式选择 agent | 保留核心，治理长尾 | 每个 agent 标 owner workflow、trigger、cost、stability；skill-local 专家不要上升为 global agent |
| `spec-app-consistency-audit` | 一个 skill 下有大量 prompts、schemas、rule-packs、scripts，但没有单一 top-level headless runner | 产物 spine 完整，但用户/下游很难“一条命令”稳定复现 | 保留，补 runner | 增 `scripts/run-audit.js` 或 `headless.js`，把现有 preflight/extract/merge/validate 串起来 |
| `spec-code-review` 多 reviewer pipeline | 默认评审语义很强，包含 dispatch、合成、autofix、headless、tracker handoff | 高质量但 token 成本高；小改动用完整 pipeline 可能不划算 | 保留，但加 low-cost path | README/skill 中明确 small diff report-only 或 single reviewer fallback |
| `spec-ideate` 多 agent idea generation | ideation 面向主动生成选项，可能调用大量视角 | 对“我只是想要 3 个想法”的用户过重 | 保留为 optional | 标为主动探索入口；普通模糊需求仍优先 brainstorm |
| `spec-optimize` 实验循环 | 支持 metric-driven loops、parallel experiments、LLM judge | 很强但容易误用为默认“帮我改好”入口 | 保留为 advanced | 强制 measurable goal、预算和 stop condition；README 放到 advanced 区 |
| `spec-standards` 模式 | quick/refresh/deep/import-source 以及 project-shape/glue baselines | 对新用户可能像第二套配置系统 | 保留，限制入口 | `mcp-setup` 完成后只推荐 quick/deep 其中一个；把 import-source 作为 advanced |
| `.spec-first` 产物层 | config/providers/graph/impact/standards/app-audit/workflows/workspace 多目录 | 目录多，commit policy 难记，且当前 `.gitignore` 与文档不一致 | 保留，但统一政策 | 建一张 artifact policy 表并由测试锁住 |
| `compound-refresh` | 支持刷新/合并/删除 stale learning docs | 自动删除知识文档有团队治理风险 | 保留，但 preview-first | 删除/合并必须 preview，默认只提出 patch plan |
| 历史 docs 层 | docs 中保留大量旧 CRG/ECC/迁移方案 | 搜索噪音高，维护者容易误读 | 保留历史，不进入主导航 | 加 archive banner；docs index 只让 current docs 出现在主路径 |

## token 与维护成本风险

| 成本来源 | 当前风险 | 降低方式 |
|---|---|---|
| 多 agent review | 一次 code-review 可能启动多个 reviewer，长 diff 成本高 | 提供 small/medium/high risk review presets |
| 多 workflow 串联 | 用户可能把 ideate -> brainstorm -> doc-review -> plan -> write-tasks 全跑一遍 | README 明确“按需要进入，不自动串联” |
| 大 skill 文档 | 若 skill 主文档承载过多 reference，会占用上下文 | 核心 contract 放 SKILL.md，长表和示例下沉 references |
| app-audit schemas/prompts | 产物全面但执行链复杂 | runner 固化 deterministic steps，LLM 只消费摘要 facts |
| historical docs | 搜索结果污染当前判断 | archive banner 与 lifecycle lint |

## 是否目标偏移

没有出现根本性目标偏移。项目没有变成 prompt library，也没有变成普通 agent marketplace。真正的风险是 **workflow-first 的实现层过于丰富，用户第一路径不够短**。

正确方向不是删掉能力，而是把入口重新压成三层：

1. **MVP path**：`init -> mcp-setup -> graph-bootstrap -> standards -> brainstorm/plan -> work -> code-review -> compound`
2. **Specialized path**：`debug`、`optimize`、`polish`、`app-consistency-audit`、`doc-review`
3. **Governance path**：`sessions`、`slack-research`、`skill-audit`、`compound-refresh`

## 简化路线

| 优先级 | 简化动作 | 预期收益 |
|---|---|---|
| P1 | 修 README 和 `init` next steps，形成 first-run decision tree | 新用户不再卡在 setup 后 |
| P1 | 修 `.spec-first` commit policy 和 `.gitignore` | 避免 runtime facts 污染 repo |
| P1 | 为 `spec-work`/`spec-code-review` 区分 durable artifact 与 tmp artifact | 下游 handoff 更可信 |
| P2 | 增 runtime capability catalog | 用户不用理解 42 skills/51 agents 全量细节 |
| P2 | 为重 workflow 增 low-cost path | 降 token 成本 |
| P2 | app-audit 增 headless runner | 降执行复杂度 |
| P3 | 增 agent/skill eval dashboard | 长期治理质量与成本 |

## 保留标准

一个复杂设计应保留，当且仅当它满足至少两条：

- 明显提升研发质量。
- 降低跨会话上下文丢失。
- 产物被下游稳定消费。
- 失败模式可解释且可降级。
- 用户能在 2-3 步内理解何时使用。
- 维护成本被测试、schema 或 runtime catalog 约束。

不满足这些条件的能力，应降为 optional、beta、internal，或迁入 reference。
