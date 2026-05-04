# 可执行任务清单

审查日期：2026-05-04

本清单可直接进入下一轮开发。每个任务都必须按仓库规则更新 `CHANGELOG.md`；如果任务修改 skill/agent prose，需考虑 fresh-source eval 或记录未执行原因。

| task id | 目标 | 涉及文件 | 修改建议 | 验收标准 | 测试命令 | 是否需要更新 CHANGELOG |
|---|---|---|---|---|---|---|
| AUDIT-P1-001 | 移除 retired `.claude-plugin/plugin.json` source truth | `AGENTS.md`、`CLAUDE.md`、`docs/10-prompt/结构化项目角色契约.md`、`tests/unit/contributor-guides-contracts.test.js` | 把 source-of-truth 列表中的 `.claude-plugin/plugin.json` 替换为动态 manifest 真源：`src/cli/plugin.js`、`src/cli/contracts/dual-host-governance/skills-governance.json`、`templates/claude/commands/spec/*.md` | current source truth 不再让维护者寻找不存在文件；历史 changelog 可保留 | `rg "\\.claude-plugin/plugin.json" AGENTS.md CLAUDE.md docs/10-prompt`; `npm run lint:skill-entrypoints`; `npm run typecheck`; targeted Jest | 是 |
| AUDIT-P1-002 | 对齐 `.spec-first` artifact Git 边界 | `.gitignore`、`docs/05-用户手册/04-workflows-artifacts-map.md`、tests | 为 `.spec-first/workspace/`、`.spec-first/app-audit/`、`.spec-first/workflows/` 增 ignore 或调整文档；保留可提交 standards exceptions | `git check-ignore` 结果与用户手册一致；不会误挡 `docs/*` durable artifacts | `git check-ignore .spec-first/app-audit/runs/example/metadata.json`; `git check-ignore .spec-first/workspace/graph-targets.json`; `git check-ignore .spec-first/workflows/verification/spec-first/verification-evidence.json`; targeted Jest | 是 |
| AUDIT-P1-003 | 补强 init 与 README 的下一步引导 | `src/cli/commands/init.js`、`README.md`、`README.zh-CN.md`、CLI tests | 在 restart、mcp-setup、graph-bootstrap pending 后补 standards handoff；中文/英文同义且不冗长 | `spec-first init --codex --dry-run` / `--claude --dry-run` 输出包含 clear next steps；README expected output 同步 | `npm run typecheck`; `npm run test:smoke` 或 targeted CLI test | 是 |
| AUDIT-P1-004 | 落地或降级 `spec-work` run artifact | `skills/spec-work/SKILL.md`、`docs/contracts/workflows/spec-work-run-artifact.schema.json`、`tests/unit/spec-work-run-artifact-contract.test.js`、可能新增 helper script | 若落地，写 `.spec-first/workflows/spec-work/<run-id>/run.json`；若不落地，明确 schema 是 planned/experimental 并撤下当前承诺 | consumer 不再把未实现 contract 当成 runtime truth | `npx jest tests/unit/spec-work-run-artifact-contract.test.js --runInBand`; `npm run lint:skill-entrypoints`; fresh-source eval if prose semantics changed | 是 |
| AUDIT-P1-005 | 澄清 code-review `/tmp` artifact 与 repo-local durable summary | `skills/spec-code-review/SKILL.md`、`docs/05-用户手册/04-workflows-artifacts-map.md`、可能新增 `docs/reviews/` template | 把 `/tmp/spec-first/spec-code-review/<run-id>/` 标为 session handoff；如需要长期复用，交互式生成 repo-local markdown summary | 用户知道哪些 review 产物可提交、哪些只是临时 handoff | `npm run lint:skill-entrypoints`; targeted docs/link checks; fresh-source eval if skill prose changed | 是 |
| AUDIT-P2-001 | 为 app-audit 增 headless runner | `skills/spec-app-consistency-audit/scripts/`、`skills/spec-app-consistency-audit/SKILL.md`、schemas/tests | 新增单一 runner 串 preflight、contract extraction、merge、validation、metadata/manifest；LLM 仍负责 verdict | fixture 可一条命令生成完整 run artifacts 并校验 schema | targeted app-audit Jest/tests; `npm run typecheck`; `node skills/spec-app-consistency-audit/scripts/run-audit.js --help` | 是 |
| AUDIT-P2-002 | 强化历史 docs lifecycle | `docs/README.md`、`docs/validation/*`、`docs/spec-graph-bootstrap-flow.md`、历史 CRG/ECC docs | 不急着移动文件；先给 old architecture docs 加 banner 或 index warning | 搜索旧 `src/crg` 时能看到 historical/superseded 边界 | docs lifecycle targeted test; `rg "src/crg|spec-first crg"` 人工抽查 top hits | 是 |
| AUDIT-P2-003 | 把 ideation artifacts 纳入用户手册 catalog | `docs/05-用户手册/04-workflows-artifacts-map.md`、`skills/spec-ideate/SKILL.md`、README workflow table | 增 `docs/ideation/` 路径、producer/consumer、与 brainstorm 的区别 | 用户知道 ideate 是主动探索，brainstorm 是需求澄清 | docs contract/link check; `npm run lint:skill-entrypoints` | 是 |
| AUDIT-P2-004 | 修 npm package README 链接体验 | `package.json`、`README.md`、`README.zh-CN.md`、`tests/smoke/install-tarball.sh` | 选择：纳入 README.zh-CN/docs/assets/readme/用户手册，或把 npm README 链接改 GitHub absolute | `npm pack --dry-run` 包内链接可达，npm 用户不遇到破图/死链 | `npm run build`; `npm run test:smoke`; optional tarball link check | 是 |
| AUDIT-P2-005 | 增 doctor/readiness 状态解释 | `docs/05-用户手册/`、`src/cli/commands/doctor.js` help、contracts docs | 用用户语言解释 ready/pending/degraded/stale/blocked、reason_code、next action | 用户能根据 doctor/setup 输出决定下一步，不读脚本源码 | `npm run typecheck`; targeted doctor tests; docs lint | 是 |
| AUDIT-P2-006 | 生成 runtime capability catalog | `src/cli/plugin.js`、`src/cli/contracts/dual-host-governance/*`、可能新增 docs/catalog | 从现有 governance JSON 生成只读 catalog，列 public workflow、standalone、internal、beta、host delivery | catalog 不成为第二套真源；counts 与 README runtime summary 一致 | dual-host governance Jest; `npm run lint:skill-entrypoints`; `npm run typecheck` | 是 |
| AUDIT-P3-001 | 建立官网同步检查 | website source 或 `docs/contracts/website-content-checklist.md`、README | 若官网源不在 repo，至少新增 release checklist | 发布前能核对官网与 README/CLI 的 workflow 数量和命令 | docs/link check; release checklist review | 是 |
| AUDIT-P3-002 | 为重 workflow 建 cost/eval baseline | `skills/spec-code-review/`、`skills/spec-app-consistency-audit/`、`skills/spec-optimize/`、`docs/contracts/workflows/` | 增 qualitative cost bands、low-cost mode、最小 eval case | 用户能选择低成本路径，维护者能回归核心 prose 能力 | fresh-source eval; targeted skill tests; skill-audit | 是 |

## 推荐下一轮 task pack

优先组合如下，适合拆成一个中型 PR：

1. `AUDIT-P1-001`
2. `AUDIT-P1-002`
3. `AUDIT-P1-003`

这组三项共同修复 first-run 和 source/runtime 的信任问题，影响面清晰，测试边界也窄。完成后再进入 `AUDIT-P1-004` 和 `AUDIT-P1-005`，收口 work/review artifact contract。
