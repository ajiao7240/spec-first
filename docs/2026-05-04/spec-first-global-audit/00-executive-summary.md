# spec-first 全局一致性深度审查总览

审查日期：2026-05-04

审查对象：当前本地 worktree `/Users/kuang/xiaobu/spec-first`。

审查基线：`docs/10-prompt/结构化项目角色契约.md`，尤其是 `Light contract`、`Explicit boundaries`、`Scripts prepare, LLM decides`，以及主链路 `Codebase -> Graph -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge`。

## 总体结论

`spec-first` 当前已经形成了一个真实的 workflow-first AI Coding System，而不是 prompt pack 或普通 agent marketplace。这个判断有代码事实支撑：

- CLI 面保持克制，只有 `doctor/init/clean/tasks/startup-reminder` 等工具命令，见 `src/cli/index.js:28-55`。
- workflow 入口由 host runtime 承载，不是 shell CLI 子命令，见 `src/cli/index.js:142-188`。
- 双宿主 runtime adapter 明确分离：Claude 写 `.claude/commands/spec`、`.claude/spec-first/workflows`、`.claude/skills`、`.claude/agents`，Codex 写 `.agents/skills`、`.codex/agents`、`.codex/spec-first`，见 `src/cli/adapters/claude.js:18-47` 与 `src/cli/adapters/codex.js:12-57`。
- runtime asset manifest 从 `src/cli/contracts/dual-host-governance/skills-governance.json`、command templates、`skills/` 和 `agents/` 动态生成，见 `src/cli/plugin.js:115-156`。
- 当前 source bundle 为 `21` 个 workflow command、`42` 个 skills、`51` 个 agents；运行时按 host 过滤为 Claude `21 commands + 2 standalone + 2 agent-facing internal skills`，Codex `21 workflow skills + 2 standalone + 2 agent-facing internal skills`，本轮通过 `node` 调用 `loadPluginManifest/buildFilteredAssetSet` 验证。

系统健康度判断：**可控 beta / 接近可推广试点，但尚未达到“无维护者陪跑即可稳定落地”的成熟度**。

## 当前最大优势

最大优势是核心边界已经被真实代码和测试钉住：setup 不直接跑 graph provider build，graph-bootstrap 负责编译 readiness facts，plan/work/review 只消费 canonical artifacts 或 session-local MCP evidence，并在 degraded/stale/unavailable 时回退 bounded direct repo reads。证据见：

- `skills/spec-mcp-setup/SKILL.md:36` 区分 GitNexus required host MCP 与 code-review-graph CLI provider。
- `skills/spec-mcp-setup/SKILL.md:206-414` 明确 graph readiness 属于 `spec-graph-bootstrap`，setup 只写 setup-owned config/projection。
- `skills/spec-graph-bootstrap/SKILL.md:11-50` 明确 Graph Readiness Compiler 职责。
- `skills/spec-plan/SKILL.md:200-233` 规定 Graph Readiness block、degraded 回退和 live MCP evidence 只是 session-local。
- `skills/spec-work/SKILL.md:17-21` 规定 graph/MCP 证据不能扩展 plan/task scope。

## 当前最大风险

最大风险不是单个 bug，而是 **source truth、runtime facts、文档叙事和 durable artifacts 之间仍有几处不一致**。这些不一致会直接降低用户信任：

- `AGENTS.md:84`、`CLAUDE.md:84`、`docs/10-prompt/结构化项目角色契约.md:193` 仍把 `.claude-plugin/plugin.json` 列为 source-of-truth，但仓库没有该文件；真实机制是 `src/cli/plugin.js` 动态 manifest，且 `package.json:27-39` 不发布 `.claude-plugin/`。
- 用户手册说 `.spec-first/app-audit/`、`.spec-first/workspace/`、`.spec-first/workflows/` 默认不进 Git，见 `docs/05-用户手册/04-workflows-artifacts-map.md:280`，但 `.gitignore:42-56` 没有覆盖这些目录。本轮 `git check-ignore` 对这三类路径均无输出。
- `spec-work` 已有 `docs/contracts/workflows/spec-work-run-artifact.schema.json`，但 `tests/unit/spec-work-run-artifact-contract.test.js:59-62` 明确承认 runtime 尚未真正写出 `run.json`。
- `spec-code-review` 的 run artifact 写在 `/tmp/spec-first/spec-code-review/<run-id>/`，见 `skills/spec-code-review/SKILL.md:54-72`、`:810-827`，这对临时 handoff 有用，但不属于 repo-local durable artifact。

## P0/P1/P2 摘要

| 优先级 | 结论 | 问题 |
|---|---|---|
| P0 | 当前未发现立即阻断主流程的 P0 | 本轮没有发现会让 `init -> mcp-setup -> graph-bootstrap -> plan/work/review` 全链路不可用的事实。 |
| P1 | 需要下一轮优先修复 | source-of-truth 中 `.claude-plugin/plugin.json` 残留；`.gitignore` 与 `.spec-first` 产物边界不一致；`init` 下一步引导未纳入 `standards` durable handoff；`spec-work` run artifact contract 未实现写盘；code-review 临时 artifact 与 repo-local 叙事不一致。 |
| P2 | 中期优化 | App audit orchestration 过厚且缺少单一 headless runner；历史 CRG/ECC 文档污染 current docs；`docs/ideation/` durable artifact 在 artifact catalog 中不够显眼；npm package README 链接的中文 README、用户手册和 SVG 资产不在 `package.json:files` 中。 |

## 是否具备高质量辅助研发基础

具备，但前提是使用者理解它是 **workflow harness + project intelligence layer**，不是自动化万能工具。

当前系统可以帮助研发团队获得更清晰需求、更可靠计划、更可审查执行、更强知识沉淀。最有价值的闭环是：

1. `mcp-setup/graph-bootstrap` 准备工具与 graph facts。
2. `standards` 编译项目规范和 glue baseline。
3. `brainstorm/plan/write-tasks` 形成可审查 spec/plan/task handoff。
4. `work/debug/optimize/polish` 执行或诊断。
5. `code-review/app-consistency-audit/doc-review` 回收质量信号。
6. `compound/compound-refresh/sessions/slack-research/skill-audit` 把经验和组织上下文沉淀回下一轮。

但它还不够“低摩擦”。新用户最容易卡在三个地方：

- 不知道 `doctor/init` 是 CLI，`$spec-*` 是 host session 入口。
- 不知道 setup 完成后，graph pending、graph ready、standards handoff、restart/new session 的先后关系。
- 不知道哪些 `.spec-first` artifacts 是本地 runtime facts，哪些 `docs/*` 是团队可提交的 durable knowledge。

## 下一阶段优先级

| 顺序 | 主题 | 原因 | 首要产出 |
|---:|---|---|---|
| 1 | 修复 source truth 残留 | `.claude-plugin/plugin.json` 是已退休概念，继续出现在角色契约和 host guidance 会误导维护者 | 更新 `AGENTS.md`、`CLAUDE.md`、`docs/10-prompt/结构化项目角色契约.md` 或生成逻辑 |
| 2 | 修复 `.spec-first` Git 边界 | 当前文档与 `.gitignore` 冲突，可能把 runtime facts 意外提交 | 更新 `.gitignore`、用户手册和契约测试 |
| 3 | 对齐 first-run next steps | `mcp-setup` 已补 standards 引导，`init` 仍停在 graph-bootstrap | 更新 `src/cli/commands/init.js`、README expected output、tests |
| 4 | 落地 `spec-work` run artifact | work 执行闭环需要稳定 machine-readable handoff | 写 `.spec-first/workflows/spec-work/<run-id>/run.json` 或明确撤销 contract |
| 5 | 降低 workflow/agent 成本 | 42 skills/51 agents 需要更清楚的公开/内部/可选边界 | 增 runtime catalog、agent cost note、skill-audit 定期报告 |

## 审查产物

本目录包含 10 份审查文件：

- `00-executive-summary.md`
- `01-positioning-and-goals-audit.md`
- `02-workflow-consistency-audit.md`
- `03-artifact-contract-audit.md`
- `04-code-quality-audit.md`
- `05-skill-agent-boundary-audit.md`
- `06-docs-and-website-consistency-audit.md`
- `07-overengineering-and-simplification.md`
- `08-priority-roadmap.md`
- `09-actionable-task-list.md`
