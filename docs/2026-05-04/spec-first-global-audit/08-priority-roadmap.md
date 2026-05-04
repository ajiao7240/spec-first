# 优先级路线图

审查日期：2026-05-04

## 总览

本路线图只列当前代码事实支持的修复项，不把未来愿景当作当前缺陷。优先级判断依据是：是否影响用户 first-run 成功、是否破坏 source/runtime 边界、是否导致下游 workflow 消费错误事实、是否显著增加维护和 token 成本。

## P0 必修

| 任务 | 背景 | 问题 | 修改范围 | 验收标准 | 风险 |
|---|---|---|---|---|---|
| P0-0 本轮未发现全链路阻断项 | 当前 `init -> mcp-setup -> graph-bootstrap -> plan/work/review` 主链路有实现和测试支撑 | 没有发现会让主流程整体不可用的立即阻断 | 无 | 无需本轮 P0 hotfix | 不能因此忽略 P1 source truth 和 artifact contract 问题 |

## P1 高优先级

| 任务 | 背景 | 问题 | 修改范围 | 验收标准 | 风险 |
|---|---|---|---|---|---|
| P1-1 移除 retired `.claude-plugin/plugin.json` source truth | 动态 manifest 已由 `src/cli/plugin.js:115-156` 从 governance JSON、templates、skills、agents 生成 | `AGENTS.md:84`、`CLAUDE.md:84`、`docs/10-prompt/结构化项目角色契约.md:193` 仍列不存在文件；现有 `tests/unit/contributor-guides-contracts.test.js` 只覆盖 3 个历史 guide，不覆盖这些 source-truth 入口 | `AGENTS.md`、`CLAUDE.md`、`docs/10-prompt/结构化项目角色契约.md`、新增或扩展 source-truth contract tests | `rg "\\.claude-plugin/plugin.json" AGENTS.md CLAUDE.md docs/10-prompt` 无 current source truth 命中；README/用户手册仍说明“不再作为真源”；targeted test 直接覆盖 AGENTS/CLAUDE/角色契约 | 误删历史 changelog 记录会丢失演进背景，历史目录只加边界不强删 |
| P1-2 对齐 `.spec-first` Git 边界 | 文档称 `.spec-first/workspace/`、`.spec-first/app-audit/`、`.spec-first/workflows/` 默认不进 Git | `.gitignore:42-56` 未覆盖这些目录；`git check-ignore` 对示例路径无输出 | `.gitignore`、`docs/05-用户手册/04-workflows-artifacts-map.md`、unit contract | `git check-ignore` 覆盖 runtime facts；reviewable standards artifacts 保持可提交例外 | 过宽 ignore 可能误挡团队想提交的 standards/verification summaries，需要明确例外 |
| P1-3 补强 first-run next steps | `mcp-setup` 已要求 ready 后推荐 standards；`init` 仍只到 graph-bootstrap | 用户完成 setup 后不知道进入 standards，和 README expected output 不一致 | `src/cli/commands/init.js`、`README.md`、`README.zh-CN.md`、CLI tests | init 输出中包含 restart、mcp-setup、graph-bootstrap pending、standards handoff 的清晰顺序；中英文一致 | 输出过长会降低首次体验，应保持 3-5 行 |
| P1-4 落地或降级 `spec-work` run artifact | 已有 schema `docs/contracts/workflows/spec-work-run-artifact.schema.json`；`tests/unit/workflow-artifact-paths.test.js:17-20` 已钉住 `.spec-first/workflows/spec-work/<slug>` 路径 | 测试样例 `tests/unit/spec-work-run-artifact-contract.test.js:59-62` 承认 runtime 未真正写 `run.json`；`tests/unit/runtime-contract-boundary.test.js:66-75` 还明确阻止 `src/cli` 隐式采用 docs-side schema | `skills/spec-work/SKILL.md`、可能的 spec-work helper script、schema/tests、downstream review docs；若改 CLI，必须同步 runtime boundary ownership tests | 先明确 producer owner：由 `spec-work` skill/helper 写，或由 CLI verification layer 写；实际生成 `.spec-first/workflows/spec-work/<run-id>/run.json`，或 schema 明确标 planned 且 README 不承诺当前可用 | 写盘实现若过早，会把 LLM session state 错误机器化；不能让 `src/cli` 暗中消费 docs-side schema 成为第二套 runtime contract |
| P1-5 调整 code-review run artifact durable 边界（P1/P2） | `spec-code-review` 明确写 `/tmp/spec-first/spec-code-review/<run-id>/`，这是当前 session/orchestrator handoff 设计 | 临时 artifact 对 orchestrator 有用，但 README 又承诺 AI coding 留下 review findings；它不是主流程阻断，只有当 README/下游 workflow 承诺 durable review summary 时才升级为必须写 repo-local | `skills/spec-code-review/SKILL.md`、`docs/05-用户手册/04-workflows-artifacts-map.md`、README/用户手册 review artifact 表；可选新增 `docs/reviews/` summary policy | 第一阶段先明确 `/tmp` 是 session handoff，不是长期 repo-local truth；如需要长期沉淀，再以 interactive opt-in 或 summary-only 方式生成 `docs/reviews/<date>-<slug>.md` 或 `.spec-first/audits` manifest | 强制每次 review 写 repo-local 文件会增加噪音；不要把 full-detail reviewer JSON 直接 durable 化 |

## P2 中期优化

| 任务 | 背景 | 问题 | 修改范围 | 验收标准 | 风险 |
|---|---|---|---|---|---|
| P2-1 app-audit 增单一 headless runner | `skills/spec-app-consistency-audit/` 已有 schemas/prompts/scripts spine；`tests/unit/spec-app-consistency-audit-cli-e2e.test.js` 已用测试代码手动串联 metadata/preflight/impact/extract/merge/report/validate/headless | 缺一条稳定 public runner 复用这条 recipe，用户或下游仍需要 LLM/测试代码帮忙拼脚本 | `skills/spec-app-consistency-audit/scripts/`、`SKILL.md`、`tests/unit/spec-app-consistency-audit-cli-e2e.test.js` | `node skills/spec-app-consistency-audit/scripts/run-audit.js --help` 可用；runner 复用现有 e2e recipe，fixture 能跑完整 artifact validation | runner 可能变成流程引擎；必须只串 deterministic steps，不替 LLM 下最终结论 |
| P2-2 历史文档 lifecycle 强化 | `docs/README.md` 已有 lifecycle，但旧 CRG/ECC 搜索仍污染 | 维护者搜索时容易引用 retired architecture | `docs/README.md`、历史目录 banner、docs lint | historical-input 文件顶部有清晰 banner；current docs 搜索优先 | 移动历史文件会破坏旧链接，应优先 banner |
| P2-3 ideation artifact 纳入 catalog | `docs/ideation/` 是 `spec-ideate` durable artifact | 主 artifacts map 不够突出，用户不知道它和 brainstorm 的区别 | `docs/05-用户手册/04-workflows-artifacts-map.md`、README workflow table | ideate/brainstorm 两条入口与产物差异清楚 | 过度强调 ideate 会让 brainstorm 不再是默认需求澄清入口 |
| P2-4 修 npm package 文档链接 payload | README 相对链接指向未发布的 `README.zh-CN.md`、docs、SVG | npm 包内相对链接可能不可达 | `package.json:files`、README 链接策略、build test | `npm pack --dry-run` 包含链接目标，或 README 改 absolute links | 增加 docs payload 会增包体积，应只纳入用户入口必要文件 |
| P2-5 doctor JSON/status 字段解释 | 用户手册已多处解释 graph degraded/stale/fallback，但 `doctor --json`、`workflow_runnability`、`verification_evidence_stale` 等字段仍需要用户层说明 | 用户可能把 doctor 的 runtime/verification evidence 结果误解为 MCP/graph provider 完整 readiness | `docs/05-用户手册/`、`src/cli/commands/doctor.js` help、doctor evidence contract docs | 说明 `ready/pending/degraded/stale/blocked`、`reason_code`、`next action` 在 doctor/setup/graph-bootstrap 中的差异；特别解释 doctor 不等价于 mcp-setup/graph-bootstrap | 写太细会变成内部协议暴露；保留用户层解释，不复制完整 JSON schema |
| P2-6 runtime capability catalog | source 42 skills/51 agents，runtime host filtered | 用户不知哪些入口公开、哪些 internal | 新增 docs catalog 或 `spec-first doctor --capabilities` | catalog 列 public workflow、standalone、internal、beta、host delivery | 自动生成 catalog 需避免成为第二套 source truth |

## P3 长期演进

| 任务 | 背景 | 问题 | 修改范围 | 验收标准 | 风险 |
|---|---|---|---|---|---|
| P3-1 官网同步机制 | README 暴露 `spec-first.cn`，repo 没官网源 | 官网无法被本轮 code-truth 审查 | website source 或 docs sync checklist | 发布前能核对官网与 README/CLI/workflow 数量 | 官网外置时难以强约束，只能 checklist |
| P3-2 skill/agent eval readiness | prose 资产是核心竞争力 | 当前治理主要靠 lint、contract 和 human review | eval fixtures、fresh-source eval reports、skill-audit cadence | 重 workflow 有最小 eval case 和 regression checklist | eval 成本高，优先覆盖 high-value workflows |
| P3-3 workflow cost telemetry | 多 agent/long workflow token 成本不可见 | 用户无法判断收益是否大于成本 | runtime reports、manual cost bands、review presets | 每个重 workflow 有 cost band 和 low-cost mode | 不能依赖精确 token 计费，先用 qualitative bands |
| P3-4 多团队协作 governance | docs/solutions、standards、reviews 可团队沉淀 | 缺少 team policy 示例 | docs templates、example repo | 团队能决定哪些 artifacts commit、哪些 ignore | 过多流程政策会提高 adoption 成本 |

## 推荐执行顺序

1. 先做 P1-1、P1-2、P1-3，修复会直接误导用户和维护者的事实冲突。
2. 再做 P1-4，并先对 P1-5 做边界澄清；只有确认 README/下游需要 durable review summary 时，再实现 repo-local review summary。
3. 然后做 P2-4，避免 npm README 链接体验破损。
4. 接着做 P2-1、P2-2、P2-3，降低复杂 workflow 与历史文档成本。
5. 最后做 P3 eval/cost/website，支撑长期治理。
