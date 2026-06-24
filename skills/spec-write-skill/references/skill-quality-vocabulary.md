# Skill Quality Vocabulary

本文件把 `writing-great-skills` 的思想改写成 spec-first 可执行的 skill 写作词表，供 `spec-write-skill` 和 `spec-skill-audit` 共享语义。目标不是复刻原文，也不是引入完整 SkillOps 平台，而是提升 skill 在不同 agent run 中的过程可预测性。

## 核心目标

**Predictability** 指 agent 每次都走相同类型的过程，而不是产出完全相同的文字。好 skill 会把随机推理约束到稳定流程：何时触发、读什么、写什么、何时完成、何时交给别的 workflow。

## Entry Surface And Invocation

spec-first 先选择 entry surface：

- `workflow_command`：公开 workflow，Claude 是 `/spec:*` command，Codex 是 `$spec-*` skill；必须有完整 I/O、artifacts、failure modes、downstream consumers。
- `standalone_skill`：用户或 agent 可直接加载的方法能力，不是 command-backed workflow；适合 authoring、task pack、standards governance 等横向方法。
- `internal_only`：只能由公开 workflow 或 agent 内部消费，不作为用户入口。

不要直接迁移外部 skill 的 invocation 假设。spec-first 的关键不是“是否有 description”，而是治理记录、host delivery、source/runtime 边界和触发描述是否一致。

## Description As Trigger Contract

frontmatter `description` 是触发合同，不是简介。它应该说明：

- 正向意图：用户什么时候需要这个 skill。
- 触发分支：不同输入路径是否真的不同。
- 负向边界：哪些近邻请求不该触发。
- 入口面：它是 public workflow、standalone skill 还是 internal helper。

删掉同义重复。一个分支只写一次；“create a skill”和“new skill authoring”如果指同一行为，就合并成一个触发。

## Information Hierarchy

把内容按 agent 需要的即时性放置：

1. `SKILL.md` steps：所有分支都必须执行的顺序、边界和 completion criterion。
2. `SKILL.md` reference：短规则、关键定义、不可延迟的决策表。
3. `references/`：条件细节、长 rubric、示例、schema 说明、模式差异。
4. `scripts/`：容易写错、可重复、确定性的检查或生成。
5. `assets/`：输出中会复制/改造的模板或素材。
6. `evals/`：维护者验证样例；默认不是 runtime 必读依赖。

如果某段文字只服务某个分支，把它放到 reference，并在 `SKILL.md` 写清楚何时读取。指针的 wording 比文件名更重要。

## Completion Criteria

每个高风险步骤都要有可检查完成条件。好的 completion criterion 同时满足：

- 清晰：agent 能判断 done / not done。
- 有要求：不是“看一下”，而是“每个新增 source skill 都有治理记录和测试锚点”。
- 与风险匹配：读-only skill 可以轻；写文件、shell、runtime、handoff、delegation 要更硬。

模糊完成条件会导致 premature completion：agent 过早认为完成，然后跳到后续步骤。

## Granularity

按两个理由拆 skill：

- 按 invocation 拆：有独立触发词、独立用户意图或需要独立治理记录。
- 按 sequence 拆：后续步骤会诱导 agent 跳过当前步骤的 legwork。

不要为“看起来更模块化”拆。每拆一个公开或 standalone skill，都会增加治理面、上下文面或用户认知成本。

## Pruning And Co-location

每个意思只保留一个 source of truth。删除三类内容：

- duplication：同一语义在多处重复。
- sediment：历史层残留，已不服务当前 skill。
- no-op：模型默认会做、写出来不改变行为的句子。

同一概念的定义、规则和例外放在同一小节，避免 agent 读到半个规则。

## Leading Words

leading word 是能稳定牵引行为的高密度词，例如 `source-first`、`preview-first`、`single source of truth`、`completion criterion`。优先使用项目已有词，而不是发明新口号。弱词如“be careful / be thorough”通常是 no-op。

## Failure Modes

写作和审查时优先找这些失败模式：

- no-skill overbuild：把一次性回答、解释、文档导出或未来构思误做成 skill。
- mis-trigger：description 太宽，近邻请求会误触发。
- boundary takeover：skill 接管上游需求、下游实现或别的 workflow。
- premature completion：步骤完成条件太虚。
- sprawl：`SKILL.md` 太长，reference 没有渐进披露。
- stale runtime dependency：把 `.claude/`、`.codex/`、`.agents/skills/` 当 source。
- package leak：运行时依赖 README、历史计划、维护者 eval 或 repo-local 脚本。
- auto-rewrite audit：把审计信号当成必须自动改写的命令。

## Spec-First Closeout Checklist

- 新 skill 名称使用 kebab-case，并与 `name:`、目录名、治理记录一致。
- 新增 user-visible skill 更新 `skills-governance.json`，并重新生成 runtime catalog。
- 不为 standalone skill 发明 `/spec:*` 或 `$spec-*` 命令入口。
- `SKILL.md` 指向所有 runtime 必读 references；维护者-only 资产明确标注。
- 变更包含 `CHANGELOG.md`、聚焦 contract tests、最窄验证命令和 generated runtime mirror 状态。
