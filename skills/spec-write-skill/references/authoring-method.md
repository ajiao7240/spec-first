# Authoring Method

本文件把 `yao-meta-skill` 中最适合 spec-first 的部分收敛为轻量 authoring method：资格判断、意图澄清、短参考扫描和反模式防线。它不是完整 SkillOps 平台，不引入全量 IR、registry、reports 或 cross-packager。

## 1. Qualification

先判断是否值得写成 skill。至少满足一项，才继续进入 source authoring：

- 会被重复使用，且重复场景能被一句 recurring job 描述。
- 近邻请求容易误触发，需要可维护的 trigger/boundary contract。
- 确定性脚本、eval 或 package-local reference 能减少重复劳动。
- 双宿主、治理、可移植或 source/runtime 边界很重要。

以下请求默认不创建 skill：

- 一次性回答、一次性 prompt、单次文案或单次解释。
- 只要求解释、总结、翻译、整理当前材料含义。
- 只要求把内容导出为文档、README、报告、幻灯片或 release note。
- 只是在构思未来可能的 skill，明确说“不创建文件”或“先讨论”。
- 普通代码 review、debug、plan/work 执行、安装第三方 skill。

输出姿态：

- `do-not-create-skill`：明确不应写 skill，并说明更小的 durable surface 或直接回答方式。
- `near-neighbor`：推荐 `spec-skill-audit`、`spec-doc-review`、`spec-work` 等更合适入口。
- `authoring-brief`：只有重复任务、目标输出和排除边界足够清晰时才进入写作。

## 2. Intent Dialogue

用户目标模糊时，只问会改变 package 设计的 2-3 个问题。不要用长表单开场。

优先澄清：

- 这个 skill 要接住哪类重复工作？
- 用户实际会给它什么输入？
- 它完成后必须交回什么输出？
- 哪些近邻请求不应该触发？
- 更看重速度、一致性、审计性、可移植、治理，还是本地风格适配？

意图澄清完成后，应得到：

- one-sentence capability
- real inputs
- required outputs
- exclusions
- at least one should-trigger example prompt
- at least one near-neighbor or should-not-trigger example prompt
- suggested mode: `new-skill` / `revise-skill` / `migrate-skill` / `audit-remediation` / `package-readiness`
- quality tier: `scaffold` / `production` / `library` / `governed`
- first eval target

如果重复任务、目标输出或排除边界仍不清，不要用更多 references/scripts 弥补；继续问最小 follow-up。

## 2.5 Skill Creator Compatibility

把官方 `skill-creator` 规则改写成 spec-first source 规则：

- skill 名称使用 kebab-case，目录名、frontmatter `name`、治理记录和 runtime catalog 必须一致。
- `SKILL.md` frontmatter 只放 `name` 和 `description`；触发条件必须写在 `description`，不要把 “when to use” 只放进正文。
- 不创建 README、安装指南、历史说明或空资源目录来显得完整；只有当前 recurring job 需要的 `references/`、`scripts/`、`assets/`、`evals/` 才进入 package。
- 在 spec-first repo 中新增 skill 时，source 位置是 `skills/<name>/`，不是默认写入个人 `$CODEX_HOME/skills`；全局安装只属于明确的分发/安装任务。
- `scripts/` 只承接确定性、重复、容易手写错的逻辑；新增脚本必须有实际运行证据。
- 复杂或高风险 skill 需要 forward-testing 时，只传 raw artifact 和用户形态请求，不泄漏预期答案、诊断或 intended fix。

## 3. Reference Scan

需要借鉴时，按顺序短扫：

1. external benchmark：公开高质量 skill、官方文档或已验证方法。
2. user source：用户给的历史 prompt、workflow、transcript、docs、notes。
3. local fit：当前仓库相邻 skill、治理记录、tests、runtime catalog。

只借鉴满足以下条件的 pattern：

- recurrence：能覆盖重复任务，不是一次性技巧。
- generativity：能帮助生成新的正确行为，而不是复制固定措辞。
- distinctiveness：与当前 skill 已有能力不同。
- boundary clarity：能减少误触发、越权或 source/runtime 混淆。

明确记录不借鉴什么：完整 SkillOps 平台、装饰性 reports、未请求 adapters、未验证 public claims、照搬外部 wording。

## 4. Authoring Discipline

每个新增指令、文件、脚本、eval 或治理规则，都必须追溯到用户真实 recurring job。

- 不基于猜测目标扩大 package。
- 不添加 speculative feature、通用配置旋钮或空目录。
- 改现有 skill 时只动直接服务本次目标的文件。
- 每个 meaningful change 绑定一种检查：route evidence、sample run、resource-boundary check、governance check、package smoke 或 reviewer note。
- 暂不可验证的想法进入 next-step candidate，不进 baseline。

## 5. Anti-Pattern Families

维护 eval 时优先覆盖这些失败族：

- `one-off-vs-reusable`：把一次性回答误做成 skill package。
- `explain-not-package`：把解释/总结请求误当成 skill 创建。
- `document-export-vs-agent-skill`：把文档导出/整理误当成 agent skill。
- `future-outline-vs-build`：用户只要未来构思，却提前写 source。
- `audit-not-authoring`：只要审计 finding，却直接改 source。
- `runtime-mirror-patch`：把 generated runtime mirror 当 source 修。
