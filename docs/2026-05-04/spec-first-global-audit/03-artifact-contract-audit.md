# 产物协议与 Graph/MCP/Provider 架构审查

## 结论

`spec-first` 的 repo-local artifact 思路是成立的，但当前产物层有三类不一致：

1. 文档声称默认不提交的 `.spec-first/app-audit/`、`.spec-first/workspace/`、`.spec-first/workflows/` 没有被 `.gitignore` 覆盖。
2. `spec-work` run artifact schema 已存在，但 runtime 写盘尚未实现。
3. `spec-code-review` 把完整 run artifact 放在 `/tmp`，与 “repo-local artifacts” 主价值叙事存在张力。

## 重要产物审查

| 产物 | 当前路径 | 生成者 | 消费者 | Schema/格式 | 一致性问题 | 风险 | 建议 |
|---|---|---|---|---|---|---|---|
| Requirements brief | `docs/brainstorms/*-requirements.md` | `spec-brainstorm` | `spec-plan`、`spec-doc-review` | Markdown + frontmatter | 基本一致 | P3 | 增 linked plan/freshness 字段即可 |
| Implementation plan | `docs/plans/*-plan.md` | `spec-plan` | `spec-work`、`spec-write-tasks`、`spec-code-review` | Markdown + frontmatter | 历史 plans 未统一 status | P2 | 增 active/superseded lifecycle |
| Task pack | `docs/tasks/*-tasks.md` | `spec-write-tasks` | `spec-work` | Markdown + machine-readable `Task Pack Contract` JSON | CLI validator 只校验 identity/freshness/structure，不能证明语义质量 | P2 | 文档持续强调 semantic review 由 LLM/人负责 |
| Ideation artifact | `docs/ideation/*` | `spec-ideate` | `spec-brainstorm` | Markdown | `docs/05-用户手册/10-产物目录.md` 未列入主表 | P2 | 加入 artifact catalog |
| Learning docs | `docs/solutions/**/*` | `spec-compound`、`spec-compound-refresh` | future brainstorm/plan/work/debug/review | YAML frontmatter + Markdown，schema 在 `skills/spec-compound/references/schema.yaml` | 需要 stale lifecycle | P2 | 引入 `status`/`last_refreshed` 规则 |
| Setup config facts | `.spec-first/config/*.json` | `spec-mcp-setup` scripts | `spec-graph-bootstrap`、verify | `runtime-capabilities.v1`、`graph-providers.v1`、`provider-artifacts.v1` | `.gitignore:46` 已覆盖 | P3 | 保持 setup-owned，不手改 |
| Provider evidence | `.spec-first/providers/<provider>/` | `spec-graph-bootstrap` | bootstrap report、维护者诊断 | raw logs + `status.json` + normalized envelopes | `.gitignore:49` 已覆盖 | P3 | 下游不直接耦合 raw logs |
| Canonical graph facts | `.spec-first/graph/*` | `spec-graph-bootstrap` | plan/work/review | `provider-status.json`、`graph-facts.json`、`bootstrap-report.md` | `.gitignore:48` 已覆盖 | P3 | 保持 canonical runtime facts |
| Impact capabilities | `.spec-first/impact/*` | `spec-graph-bootstrap` | plan/work/review/app audit | `bootstrap-impact-capabilities.json` | `.gitignore:50` 已覆盖 | P3 | 增 consumer examples |
| Workspace advisory facts | `.spec-first/workspace/*` | mcp-setup / graph-bootstrap parent workspace resolver | read-only repo targeting | `workspace-graph-targets.v1` 等 advisory JSON | 文档说默认不进 Git，但 `.gitignore` 未覆盖 | P1 | 加 `.spec-first/workspace/` 到 `.gitignore` |
| App audit run | `.spec-first/app-audit/runs/<run-id>/` | `spec-app-consistency-audit` | work/review/maintainer | 多 schema：metadata、manifest、preflight、issues、report | 文档说默认不进 Git，但 `.gitignore` 未覆盖 | P1 | 加 `.spec-first/app-audit/` 到 `.gitignore`，或修正文档为可提交 |
| Verification evidence | `.spec-first/workflows/verification/<slug>/verification-evidence.json` | verification/gate | `doctor` | `docs/contracts/verifiers/verification-evidence.schema.json` | 文档说 `.spec-first/workflows/` 默认不进 Git，但 `.gitignore` 未覆盖 | P1 | 加 `.spec-first/workflows/` 到 `.gitignore`，或细分可提交策略 |
| Quality gate facts | `.spec-first/workflows/quality-gates/ai-dev-quality-gate/` | `npm run test:ai-dev:gate` | diagnostics/knowledge | JSON + JUnit | 未被 `.gitignore` 覆盖 | P1 | 同上 |
| Optimize run | `.spec-first/workflows/spec-optimize/<spec-name>/` | `spec-optimize` | optimize resume | YAML/Markdown | skill 文档说 ignored by git，但 `.gitignore` 未覆盖 workflows | P1 | 同上 |
| Skill audit facts | `.spec-first/audits/skill-audit/latest/` | `spec-skill-audit` | maintainers | JSON/Markdown reports | `.gitignore:47` 已覆盖 | P3 | 保持可重建 |
| Claude runtime copies | `.claude/commands/spec/`、`.claude/skills/`、`.claude/spec-first/workflows/`、`.claude/agents/` | `spec-first init --claude` | Claude Code host | managed state | `.gitignore:31-35` 已覆盖 | P3 | 不手改 |
| Codex runtime copies | `.agents/skills/`、`.codex/agents/`、`.codex/spec-first/` | `spec-first init --codex` | Codex host | managed state | `.gitignore:37-39` 已覆盖 | P3 | 不手改 |
| Code review artifact | `/tmp/spec-first/spec-code-review/<run-id>/` | `spec-code-review` | `spec-work`/orchestrator | reviewer JSON、metadata、summary | 不是 repo-local durable artifact | P1/P2 | 提供 repo-local summary 或明确 tmp-only transient contract |
| Work run artifact | 计划为 `.spec-first/workflows/spec-work/<run-id>/run.json` 或等价 | 未实现 | code-review/resume/maintainer | `docs/contracts/workflows/spec-work-run-artifact.schema.json` | schema 有，runtime 未写 | P1 | 实现写盘或撤销/降级 schema |

## Git 边界验证

本轮执行的 `git check-ignore` 事实：

| 路径 | 预期 | 当前结果 | 结论 |
|---|---|---|---|
| `.spec-first/audits/skill-audit/latest/skill-audit-summary.md` | ignore | `.gitignore:47` 命中 | 正确 |
| `.spec-first/graph/graph-facts.json` | ignore | `.gitignore:48` 命中 | 正确 |
| `.spec-first/app-audit/runs/example/metadata.json` | ignore | 无输出 | 不一致 |
| `.spec-first/workspace/graph-targets.json` | ignore | 无输出 | 不一致 |
| `.spec-first/workflows/verification/spec-first/verification-evidence.json` | ignore | 无输出 | 不一致 |
| `.spec-first/standards/project-shape.json` | 可按团队需要提交 | 无输出 | 符合文档中 “reviewable standards artifacts 可提交” 的例外策略 |

## Graph/MCP/Provider 架构审查

| 模块 | 当前职责 | 当前实现 | 主要问题 | 是否阻塞主流程 | 建议 |
|---|---|---|---|---|---|
| `mcp-tools.json` | MCP 和 graph-provider package/version registry | `skills/spec-mcp-setup/SKILL.md:23` 要求它是唯一 machine registry | 需持续防止 `graph-providers.json` 变第二版本注册表 | 否 | contract test 保持 package source 单一 |
| `spec-mcp-setup` | 安装、检测、配置、能力声明 | `skills/spec-mcp-setup/SKILL.md:36-62`；tests 验证不跑 provider build | setup projection heuristic 较复杂 | 否 | 把 projection helper 拆小，加 query_probe fixtures |
| `runtime-capabilities.json` | host ledger pointer、baseline、fallback tool 能力 | `docs/05-用户手册/04-workflows-artifacts-map.md:66` | `doctor` 不深查 MCP/graph，只读 runtime asset | 否 | 文档明确 doctor 不等于 graph readiness |
| `graph-providers.json` | provider command arrays 与 readiness projection | `skills/spec-graph-bootstrap/SKILL.md:63-68` | command array 安全已较强，但 provider heuristic 需 eval | 否 | 添加 bad-json/exit0-invalid/query-only fixtures |
| `provider-artifacts.json` | raw/status/normalized/canonical path contract | `skills/spec-graph-bootstrap/SKILL.md:66-68` | 消费者说明不够多 | 否 | 在 artifact map 中加 example |
| `spec-graph-bootstrap` | Graph readiness compiler | `skills/spec-graph-bootstrap/SKILL.md:48-51`；`bootstrap-providers.sh:498-555` 有 timeout | 历史 docs 仍描述 retired `src/crg` | 否 | docs lifecycle/archive |
| GitNexus | 全局代码知识图谱和 impact evidence | `skills/spec-graph-bootstrap/SKILL.md:186-192` 强制 query_ready 不能只看 build/status | query probe 仍可能被 repo 命名影响 | 否 | 增跨栈 golden repo fixture |
| code-review-graph | CLI artifact provider，host MCP optional | `skills/spec-mcp-setup/SKILL.md:36`、`:479` | 职责清楚，但用户可能误以为必须配置 MCP server | 否 | README 加 “CLI provider vs live MCP” 图 |
| Serena | host MCP/LSP 辅助 | setup 支持 `--serena-language`、all-repos language map | 多仓首次语言选择成本高 | 否 | first-run failure hint 保持具体 |
| Context7 / Sequential Thinking | docs/reasoning support | required harness runtime 一部分 | 不是 graph source，需避免下游混用 | 否 | 下游只作为 auxiliary evidence |
| ast-grep | 结构搜索工具 | setup helper 安装 | optional，不应阻塞 graph | 否 | 保持 degraded |
| agent-browser | browser/runtime validation | setup helper 能力 | 只在 polish/app audit runtime use | 否 | 不纳入 required graph readiness |

## Runtime state 污染风险

| 风险 | 当前状态 | 建议 |
|---|---|---|
| runtime state 写入 `repo-profile.yaml` | `spec-standards` 明确不自动写 `repo-profile.yaml`，见 `skills/spec-standards/SKILL.md:11-58`、`:185` | 保持 preview-first |
| code facts 与 standards 混合 | `.spec-first/graph/*` 与 `.spec-first/standards/*` 已分层 | 在 standards docs 中继续强调 observed/suggested 不是 confirmed |
| provider raw logs 被当成决策事实 | artifact map 说 raw logs 只服务诊断，见 `docs/05-用户手册/04-workflows-artifacts-map.md:112` | 下游只读 canonical facts |
| session-local MCP evidence 写回 graph readiness | `spec-plan` 明确 successful MCP call 不改变 compiled `query_ready`，见 `skills/spec-plan/SKILL.md:213` | 保持 |

## Preview-first / Silent write 审查

| 产物域 | 当前策略 | 问题 | 建议 |
|---|---|---|---|
| Runtime init/clean | 明确命令授权，`--dry-run` 可 preview | 成功后 next steps 不够完整 | 更新 init 文案 |
| Standards | preview-first，不自动写 repo-profile | 策略复杂 | 提供 “commit or ignore” 决策表 |
| App audit | default/headless 写 run artifacts；report-only no-write | `.gitignore` 不覆盖 | 修 Git 边界 |
| Code-review | report-only no-write；autofix/headless 写 `/tmp` | 不是 repo-local | 增 durable summary option |
| Compound-refresh | interactive 问，autofix 可更新/删除 | 删除风险 | 要求 scope、报告、selective staging |
