# 2026-05-04 spec-standards 100 轮审查与修订记录

## 总结

- 目标：完成一个架构边界清晰、可验证、可团队共享、可导入团队规范、可支持多项目模式、可被后续 skill 消费的 `spec-standards` 实现。
- 执行角色：Spec-First Evolution Architect。
- 工作目录：`/Users/kuang/xiaobu/spec-first-standards-2026-05-04-loop`。
- 分支：`audit/spec-standards-2026-05-04-loop`。
- 入口判断：按 `$spec-work` 执行具体改造，同时以 `spec-standards` workflow contract 作为审查基线。
- 核心边界：scripts prepare facts；LLM decides standards；preview-first；source-first；confirmed-only hard constraints。

## 已执行验证

- `npx gitnexus analyze`：刷新隔离 worktree 的 GitNexus 索引；工具写入的 worktree-local `AGENTS.md` / `CLAUDE.md` repo 名称噪声已恢复，不进入本次变更。
- GitNexus impact：`prepareBaseline`、`buildProjectShape`、`buildStandardsPlan`、`buildGlueMap`、`buildInventory`、`parseArgs`、`buildPlanArtifacts`、`buildUpdateDecision`、`buildImportArtifacts`、`buildGraphQueryIndex`、`normalizePrepareOptions`、`buildScope`、`normalizePlanOptions`、`inspectImportSource`、`resolveLocalImportPath` 均为 LOW。
- `npm test -- --runInBand tests/unit/spec-standards-contracts.test.js`：误触发完整 `npm test` 链路，unit、smoke、integration/e2e 均通过，作为改动前 baseline。
- `npx jest tests/unit/spec-standards-contracts.test.js --runInBand`：通过，15 tests。
- `npx jest tests/unit/spec-standards-contracts.test.js tests/unit/user-manual-contracts.test.js tests/unit/spec-code-review-contracts.test.js tests/unit/spec-plan-contracts.test.js tests/unit/spec-work-contracts.test.js tests/unit/spec-work-beta-contracts.test.js --runInBand`：通过，6 suites / 45 tests。
- `npm run lint:skill-entrypoints`：通过，165 files scanned。
- `npm run typecheck`：通过，35 files checked。
- `node --check skills/spec-standards/scripts/prepare-baseline.js`：通过。
- `for f in skills/spec-standards/examples/*.json; do node -e "JSON.parse(...)" "$f"; done`：通过。
- 临时 child repo smoke：`--root <workspace> --repo packages/app --baseline --import-source shared` 正确写入 child `.spec-first/standards/`，父级 `.spec-first/standards/` 未创建。
- `git diff --check`：通过。
- `npm test`：通过；unit 82 suites / 434 tests，smoke install-local / CLI，通过 integration verification gate 与五步闭环 e2e。
- GitNexus detect_changes（repo `spec-first-standards-2026-05-04-loop`）：`changed_count=68`、`affected_count=14`、`changed_files=19`、`risk_level=HIGH`。HIGH 来自跨 workflow、agent、skill prose、docs、tests 的横向 contract 接入，非单个被修改函数的高 blast radius；已用逐符号 LOW impact、聚焦 contract tests、entrypoint lint、typecheck、child repo smoke、完整 `npm test` 缓解。

## 100 轮记录

| 轮次 | 问题描述 | 具体修复细节 | 修复结论 | 修复效果 |
| --- | --- | --- | --- | --- |
| 001 | 任务属于 spec-first 自身演化，可能绕过角色基线 | 先阅读 `docs/10-prompt/结构化项目角色契约.md` 和相关 skill | 按 Spec-First Evolution Architect 基线执行 | 决策回到 workflow、contract、artifact 和 source/runtime 边界 |
| 002 | 用户要求新建 worktree，主 worktree 已有未提交改动 | 创建 `audit/spec-standards-2026-05-04-loop` 隔离 worktree | 不触碰主 worktree 现有改动 | 降低并行工作冲突和误提交风险 |
| 003 | GitNexus 索引落后且找不到 `spec-standards` 符号 | 运行 `npx gitnexus analyze` 刷新 worktree 索引 | 后续 impact 可定位目标脚本函数 | impact evidence 从 stale 降级恢复为可用 |
| 004 | GitNexus analyze 修改了 host 入口文档的 repo 名称 | 恢复 `AGENTS.md` 和 `CLAUDE.md` 中 worktree-local GitNexus 文案 | 临时索引噪声不进入 source change | 保持 checked-in host 入口文档稳定 |
| 005 | 现有 `spec-standards` 只强调 preview-first，缺少后续消费强弱边界 | 在 skill 中明确 hard constraints 与 soft context 的区分 | confirmed-only 成为下游硬约束 | 避免 observed/imported 被误当团队规范 |
| 006 | 父 workspace 下 `--repo <child>` 语义只出现在文档，脚本仍扫描父级 | 修改 `normalizePrepareOptions`，将 `repo` 解析为 child target root | child repo 成为实际扫描和写入根 | 多项目模式不再污染父级 `.spec-first/standards/` |
| 007 | `parseArgs` 已 normalize 后再进入 `prepareBaseline` 会重复拼接 repo | 增加 `alreadyNormalized` 处理，保留 normalized root | CLI 与单测直调路径同时成立 | 修复 `missing-child/missing-child` 双拼接错误 |
| 008 | `--repo` 可传绝对路径或上跳路径，破坏 workspace 边界 | 新增 `normalizeRepoSelector`，拒绝 absolute 和 `..` segment | repo selector fail closed | 避免写入 workspace 外路径 |
| 009 | result 只返回 target-root 相对 artifacts，父 workspace 调用者难定位 | 增加 `workspace_root`、`target_repo`、`workspace_artifacts` | 同时保留 child-local 与 workspace-relative 视图 | 多仓 orchestrator 更容易汇总 artifact 路径 |
| 010 | `project-shape.json` 缺少 run scope | 在 `buildProjectShape` 输出 `scope` | project shape 自带 repo/child repo 上下文 | 下游无需从聊天历史推断目标 repo |
| 011 | `standards-plan.json` 缺少统一 scope 字段 | 保留并强化 `scope` 输出 | plan artifact 自描述目标范围 | downstream skill 能用 machine-readable scope |
| 012 | `glue-map.json` scope 固定为 repo | 让 `buildGlueMap` 接收 options 并使用 `buildScope` | child repo glue map 能表达 workspace_child | reuse capability 不再隐式绑定父 repo |
| 013 | `standards-plan.json` 只列 tasks，缺少 LLM 合成输入契约 | 新增 `synthesis_contract` | LLM 合成候选规范有稳定 handoff | 降低现场 prompt 随机性 |
| 014 | 候选规范 required fields 只存在 prose 中 | 将 required fields 写入 `synthesis_contract.candidate_required_fields` | JSON 形状可被测试和下游读取 | 后续工具可做 schema-like 校验 |
| 015 | status vocabulary 容易漂移 | 增加 `allowed_statuses` 常量并写入 synthesis contract | confirmed/imported/observed/suggested/conflict/unknown/deprecated/drifted 集中管理 | 减少不同 skill 对状态解释不一致 |
| 016 | source_type vocabulary 容易漂移 | 增加 `allowed_source_types` 常量并写入 synthesis contract | evidence 来源类型明确 | 候选规范能区分 user、repo profile、shared standard、graph、code、config、docs、LLM |
| 017 | evidence budget 只在 mode budget 中，不直接约束 LLM 合成 | 在 synthesis contract 加 `evidence_policy` | LLM 合成有 bounded evidence 限制 | 避免 raw graph dump 或过量证据进入 durable artifacts |
| 018 | repo-profile 写回策略只在 prose 中 | 在 synthesis contract 加 `writeback_policy` | 默认不写 repo-profile、confirmed-only、requires confirmation 机器可读 | 下游 apply 阶段有明确 guardrail |
| 019 | 下游 workflow 消费方式散落在 prose 中 | 新增 `buildDownstreamConsumers` 并写入 plan/glue map | brainstorm/plan/tasks/work/review 消费边界集中输出 | 后续 skill 可以直接读取同一份消费 contract |
| 020 | `spec-brainstorm` 应避免 off-target，但不能把 observed 变 scope | 在 downstream consumers 中给 brainstorm 定义 hard/soft context | brainstorm 只硬消费 confirmed | 避免项目观察项污染需求定义 |
| 021 | `spec-plan` 需要 reuse-first 边界 | 在 downstream consumers 中定义 plan 消费 project-shape、candidates、glue-map | plan 可用 glue capability 选择实现边界 | 减少重复实现已有能力 |
| 022 | `spec-write-tasks` 需要 context refs，但不能改变 source plan | 在 downstream consumers 中定义 task-pack consumption boundary | task pack 只能携带约束，不扩 scope | 保持 plan 是 single source of truth |
| 023 | `spec-work` 需要 confirmed standards 和 glue map | 在 downstream consumers 中定义 work 消费边界 | work 遵守 confirmed，soft candidates advisory | 执行更一致，且不过度机械化 |
| 024 | `spec-code-review` 容易把软候选当 finding | 在 downstream consumers 中定义 review 只能用 confirmed 报硬违规 | soft candidates 只做上下文或问题 | 降低 false positive |
| 025 | import-source local path 解析只相对 target repo，不适合父 workspace | `resolveLocalImportPath` 先尝试 workspaceRoot，再尝试 repoRoot | 从父 workspace 导入 shared standards 更自然 | 团队规范导入适配多项目工作区 |
| 026 | import source id 使用 absolute local path，团队共享不稳定 | source id 改用 git remote/commit 或 workspace-relative identity | import lock 更少机器路径耦合 | artifacts 更适合团队共享 |
| 027 | import lock 缺少 workspace-relative path | 在 sourceSummary 加 `workspace_path` | 父 workspace 和 child repo 都能定位 source | 提升 import audit 可读性 |
| 028 | imported standards 可能被误判为可写回 repo-profile | `imported-standards.json` 加 `alignment_required` 和 `eligible_for_repo_profile_writeback: false` | imported-only 不可直接写回 | 保护项目确认边界 |
| 029 | 远程 git import 不应静默 fetch | 保留 remote unavailable 和 `remote-fetch-not-performed` | deterministic script 不联网拉取 | 遵守 scripts prepare facts 边界 |
| 030 | `standards-candidates.json` 顶层形状不足 | skill contract 增加 schema_version、generated_at、scope、source_artifacts、status_counts、confirmation_policy | 候选 artifact 更可验证 | 后续 validator 有稳定目标 |
| 031 | conflicts/unknowns 容易被 prose 淹没 | skill contract 要求冲突和未知保持显式数组 | 不隐藏待决问题 | 提升团队 review 质量 |
| 032 | preview 缺少 downstream consumption summary | preview 目录新增第 12 节 | 用户能看到哪些 workflow 会消费 artifacts | 降低误用风险 |
| 033 | preview 写回状态编号漂移 | 将 Writeback Status 调整为第 13 节 | 输出结构与新增消费摘要兼容 | preview 完整表达边界 |
| 034 | skill README 未说明 synthesis contract | README 增加 plan/glue map 消费契约说明 | source skill 文档对齐脚本输出 | 维护者能快速理解新增 contract |
| 035 | 用户手册未说明 child repo 写入 | 用户手册 `--refresh` 段补充父 workspace/child repo 写入规则 | 用户知道 artifacts 写在哪里 | 多项目使用路径更清晰 |
| 036 | 用户手册未说明 downstream consumers | 用户手册产物边界补充 synthesis_contract 和 downstream_consumers | 用户知道 confirmed-only 的消费规则 | 后续 workflow 使用更可解释 |
| 037 | artifacts map 中 standards-plan 描述过窄 | 更新为包含 synthesis contract 与 downstream consumers | 手册 artifact map 与实际输出一致 | 减少文档漂移 |
| 038 | artifacts map 中 glue-map 描述过窄 | 更新为包含 downstream consumption boundaries | glue map 不只是能力列表 | 提升下游 reuse 语义 |
| 039 | 产物目录未说明 `--repo` child-local 写入 | 在产物目录补充 child repo artifacts 边界 | 父 workspace 和 child repo 产物分层清楚 | 支持多项目模式 |
| 040 | `spec-plan` 不读取 standards baseline | 更新 context orientation anchor | plan 可读取 project-shape、candidates、glue-map | 让 standards baseline 进入 HOW 决策 |
| 041 | `spec-plan` 未区分 confirmed 与 soft candidates | context anchor 明确 confirmed hard，其他 advisory | plan-time 冲突需要显式解决 | 不把导入或观察项偷渡为规范 |
| 042 | `spec-work` 只提 AGENTS/CLAUDE | 更新 Follow Existing Patterns | work 读取 confirmed standards 和 glue-map | 执行时复用已有能力 |
| 043 | `spec-work-beta` 与 stable work 语义漂移 | 同步 stable work 的 standards/glue 说明 | beta 与稳定入口对齐 | 降低 beta 分叉行为 |
| 044 | `spec-write-tasks` 不携带 standards context refs | 更新 bounded source orientation | task pack 可引用 candidates/glue-map | 任务拆分能保留规范和复用边界 |
| 045 | `spec-code-review` 只发现 AGENTS/CLAUDE | Stage 3b 增加 standards baseline path discovery | code review 可读 standards artifacts | 项目规范审查更完整 |
| 046 | project-standards reviewer 不知道 baseline artifacts | agent 增加 `<standards-baseline-paths>` 处理规则 | confirmed candidates 可作为硬标准 | soft candidates 不产生硬 finding |
| 047 | code-review prompt 可能膨胀 | 只传路径，不传内容 | reviewer 自行读取相关文件 | 控制 orchestrator prompt 成本 |
| 048 | `standards-plan.example.json` 与新 contract 不一致 | 更新 example 增加 scope 和 synthesis_contract | 示例与脚本输出方向一致 | 降低新贡献者误解 |
| 049 | `glue-map.example.json` 缺少 downstream_consumers | 更新 example | 示例展示下游消费边界 | 让 glue map 的用途更明确 |
| 050 | `project-shape.example.json` 缺少 scope/evidence | 更新 example | 示例更贴近真实 artifact | 支持 schema-like 文档阅读 |
| 051 | `standards-candidates.example.json` 顶层不完整 | 更新 example 增加 generated_at、scope、source_artifacts、status_counts、confirmation_policy | 示例表达候选规范生命周期 | 支持后续 validator |
| 052 | import examples 缺少 workspace_path | 更新 import-lock 和 standards-sources examples | 示例覆盖父 workspace 视角 | 团队导入路径更清楚 |
| 053 | imported examples 缺少 writeback guard | 更新 imported-standards example | 示例标明 alignment_required 与不可直接写回 | 强化 import confirmation boundary |
| 054 | standards preview example 缺少 synthesis contract 说明 | 更新 Artifact Plan | preview 与新 standards-plan contract 对齐 | 用户能看到合成来源 |
| 055 | standards preview example 缺少 downstream 消费说明 | 新增 Downstream Consumption section | 用户能区分 hard/soft consumption | 降低下游误读 |
| 056 | 单测未覆盖 synthesis_contract | baseline test 增加 candidate fields、statuses、source types、writeback policy 断言 | contract 有回归保护 | 防止将来删掉机器可读 handoff |
| 057 | 单测未覆盖 glue downstream consumers | baseline test 增加 downstream workflows 断言 | glue-map consumption 有回归保护 | 下游消费 contract 不易漂移 |
| 058 | 单测未覆盖 child repo 写入 | 新增 child repo test | 确认 child artifacts 写入 child `.spec-first/standards/` | 多项目模式可验证 |
| 059 | 单测未覆盖父级不写 child-local artifacts | child repo test 检查父 `.spec-first/standards/project-shape.json` 不存在 | 父 workspace 保持 advisory launcher | 防止污染父目录 |
| 060 | 单测未覆盖 workspace_artifacts | child repo test 断言 workspace-relative paths | parent orchestrator 可用路径有保护 | 多仓汇总更稳定 |
| 061 | 单测未覆盖 imported writeback guard | import-source test 增加 alignment/writeback 断言 | imported-only 不可写回有测试 | 团队规范导入更安全 |
| 062 | 单测未覆盖 `--repo ..` | malformed args test 增加 traversal case | repo selector fail-closed 有测试 | 防止路径逃逸回归 |
| 063 | CLI dry-run 仍需保持只读 | 保留 dry-run no-write 测试 | 新字段不影响 dry-run 行为 | 预览优先不回退 |
| 064 | quick mode 不能合成候选 | 保留 quick 只写 update decision | synthesis contract 不进入 quick writes | 快速检查成本保持低 |
| 065 | baseline script 不能写 standards candidates | 保留 baseline 只写 fact artifacts | LLM 仍负责候选和 preview | 不让脚本替代语义判断 |
| 066 | repo-profile 不应被脚本创建 | 保留测试检查 repo-profile 不存在 | writeback 仍需 explicit confirmation | source of truth 不被污染 |
| 067 | generated standards artifacts 不应影响 project-shape | 保留 inventory ignore test | `.spec-first/standards/` 不反向污染事实 | freshness hash 更可信 |
| 068 | docs/agents/parser fixtures 不能误激活产品 domain | 保留 negative domain test | domain lens selection 不被文档和 fixture 误导 | 减少无关标准生成 |
| 069 | generic CLI 不能获得 spec-first runtime-sync glue | 保留 generic CLI test | runtime-sync capability 只属于 spec-first 项目形态 | 避免误导普通 CLI 项目 |
| 070 | `buildScope` 被多个 artifacts 共用，风险需确认 | GitNexus impact LOW | 修改面主要为脚本和 tests | 影响可控 |
| 071 | `normalizePlanOptions` 影响 standards plan | GitNexus impact LOW | 直接影响 `buildStandardsPlan` | 测试覆盖可收口 |
| 072 | import source helper 影响 import chain | GitNexus impact LOW | 影响 `buildImportArtifacts` 和 `prepareBaseline` | import tests 覆盖可收口 |
| 073 | result artifact paths 可能破坏现有消费者 | 保留 `artifacts` target-root 相对路径，新增 `workspace_artifacts` 而非替换 | 兼容旧消费者 | 新消费者获得 workspace path |
| 074 | scope root 在 child artifact 中可能混淆 | 使用 `root: "."` 加 `workspace_child` | artifact 内路径仍 target-root 相对 | 保持 portability |
| 075 | output override 是否要禁止写父级 | 仅默认 output child-local，显式 `--output` 保留用户控制 | 不新增过度规则 | 保持 light contract |
| 076 | synthesis contract 可能变成规则引擎 | 只输出 vocabulary、字段、policy、consumer hints，不做语义判断 | script 仍只准备事实和边界 | 遵守 Scripts prepare, LLM decides |
| 077 | downstream consumers 可能强编排 workflow | 仅声明消费边界，不增加状态机或自动调用 | 无中心化 orchestration | 保持 workflow 轻契约 |
| 078 | `confirmed` 生成条件可能被脚本推断 | skill 明确 confirmed 只能来自 user input 或 repo profile evidence | 脚本不自动确认标准 | 保护团队确认权 |
| 079 | `imported` 与 `observed` 可能被 review 当硬规则 | code-review 和 reviewer 双处明确 soft-only | soft 候选不产生硬 finding | 降低 review 噪声 |
| 080 | `conflict` 和 `unknown` 容易被忽略 | candidate top-level 要求显式 arrays | 待决事项可被用户 review | 提升规范收敛质量 |
| 081 | graph evidence 缺失时可能伪装 graph-backed | synthesis contract evidence policy 标记 degraded confidence | 缺图谱不编造证据 | 可信证据优先 |
| 082 | deep mode raw graph path 可能被提交 | contract 保留 raw graph session-local 规则 | raw query dump 不进入 confirmed standards | 降低 artifact 体积和隐私风险 |
| 083 | source/runtime 边界可能被 runtime patch 破坏 | 全部修改 source paths，未手改 `.claude/`、`.codex/`、`.agents/skills/` | runtime 由 init 再生成 | 遵守 source-first |
| 084 | Claude command template 应保持 metadata-only | 未修改 command template 行为 | behavior 仍在 skill source | 双宿主入口边界稳定 |
| 085 | README 与用户手册可能不同步 | 更新 skill README 和用户手册 standards 页 | source 和 user-facing docs 对齐 | 用户可理解新增行为 |
| 086 | artifacts map 可能与新 artifact contract 漂移 | 更新 artifacts map 和产物目录 | 文档索引同步 | 团队知识更一致 |
| 087 | Changelog 治理要求所有 source change 记录 | 读取主项目 Codex developer profile，按 leokuang 写入 CHANGELOG | 变更有版本线记录 | 符合项目级治理 |
| 088 | 当前 worktree 没有 `.codex/spec-first/.developer` | 使用同项目主 worktree 的 Codex developer profile | author 取 `leokuang` | 避免运行 init 生成 runtime 噪声 |
| 089 | 意外完整测试触发成本较高 | 记录为 baseline，后续使用聚焦验证 | 不把误跑结果浪费 | 提供改动前健康基线 |
| 090 | 聚焦验证需覆盖脚本、docs、skills、examples | 跑 Jest contract、lint、typecheck、JSON parse、node check | 多层验证通过 | 改动收口可重复 |
| 091 | child repo behavior 需要真实 smoke | 用临时 workspace 执行 `--repo packages/app --import-source shared` | childArtifacts true，parentArtifacts false | 多项目写入边界被实际验证 |
| 092 | import-source 与 child repo 组合需验证 | smoke 中从 parent shared source 导入 child repo | importedWriteback false | 团队规范导入与 child scope 兼容 |
| 093 | examples JSON 容易因为手改变成无效 JSON | 对所有 examples JSON 做 JSON.parse | 全部解析通过 | 示例可被工具读取 |
| 094 | JS 语法可能因大 patch 出错 | 先修复 duplicate function，再跑 `node --check` | 语法通过 | 防止运行时失败 |
| 095 | patch 可能引入尾随空白 | 运行 `git diff --check` | 无 whitespace error | 保持提交质量 |
| 096 | downstream skill 文案不能变成命令入口误导 | 跑 `lint:skill-entrypoints` | 入口治理 lint 通过 | 不暴露错误 standalone command |
| 097 | project-standards reviewer 应仍只审项目标准 | agent 明确 baseline confirmed-only，soft candidates 不报 finding | reviewer 不变成 best-practice 生成器 | 保持 review 精准 |
| 098 | spec-standards 不应替代 graph-bootstrap | skill non-goal 和 evidence policy 保持上游 graph facts provider 边界 | graph readiness 仍是上游 | 避免重复全仓扫描 |
| 099 | spec-standards 不应替代 plan/work/review | downstream consumers 只提供上下文，不自动执行后续 workflow | 后续 workflow 仍各自判断 | 保持系统松耦合 |
| 100 | 最终变更需可团队共享和后续审查 | 新增本审查日志、测试、CHANGELOG 和 artifact contract 更新 | 100 轮审查形成可追踪记录 | 让改动从一次性对话沉淀为团队知识 |

## 最终结论

本轮修订将 `spec-standards` 从“能生成 project facts 的 preview-first workflow”推进为“能稳定交付 project standards synthesis contract 和 downstream consumption boundary 的 workflow 节点”。脚本仍只准备确定性事实和轻契约，不确认规范、不写 repo-profile、不替代 LLM 判断；LLM 通过 `standards-plan.json` 的 `synthesis_contract` 完成语义合成；后续 `spec-plan`、`spec-write-tasks`、`spec-work`、`spec-code-review` 可读取同一组 artifacts，并且只能把 confirmed standards 当作硬约束。
