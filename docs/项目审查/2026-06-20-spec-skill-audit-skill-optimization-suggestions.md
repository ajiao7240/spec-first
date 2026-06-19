---
date: 2026-06-20
topic: spec-skill-audit-skill-optimization-suggestions
source_skill: skills/spec-skill-audit
review_method: yao-meta-skill
review_pass: yao-gate adversarial (8 gate / 28 verified finding，源码逐条回源核对)
status: advisory
---

# spec-skill-audit Skill 优化建议文档（yao-meta-skill gate 复审）

## 结论

`spec-skill-audit` 是一个**工程质量很高的 Library 级 meta-audit skill**——它是全仓最重的脚本型 skill（20 个脚本约 4,400 LOC + lib 层、10 个 reference、4 套 eval fixture、4 个 example），而且把 yao 的核心纪律**写进了代码**：`lib/finding.js` 让每条脚本产出的 finding 默认 `counter_evidence.checked=false / decision=tentative`，附带字面注释 “Deterministic scripts do not decide semantic counter-evidence”；JSON finding shape 完整实现 `signal → evidence → counter-evidence → decision` 链；scores 是 signals-not-gates（`overall_score` 从不作为下游分支）；31 条脚本测试压在真实高危路径上（路径穿越、run-id 校验、source byte-identical 不变量）。

**但本次复审的头号发现是 DOGFOODING（自食其言）**：这个项目的"质量良心"工具，在好几条它对别人强制执行的规则上**自己违反**，而且它**自己的确定性自审（92/A-，P0=P1=P2=0）对这些违规结构性失明**——这正是为什么只有一次外部复审才能把它们翻出来。

以 yao skill-engineering 8 个 gate 为 rubric：本文保留 **12 个执行聚合 finding**（P1-1 到 P2-9），下游优化以这 12 个聚合项为准；原始复审中的 raw finding 数与 reviewer 数只作为 provenance，不作为可机械复核的 gate。签名级（dogfooding）问题按优先级：

1. **入口自违反渐进式披露**：SKILL.md 把 5 个契约 section（When To Use / When Not To Use / Inputs / Outputs / Failure Modes）在 `### Workflow Contract Summary` 里写一遍、又作为顶层 `##` section 重写一遍——正是它自己 `SKILL.md:85` 要求 reviewer 去 flag 的 "duplicate rubrics … that should live in references/" 模式；**全仓 5 个同族 skill 里只有它这么做**（4 个兄弟该计数均为 0）。
2. **无行/体量上限测试**守护 258 行入口（兄弟 spec-prd 硬上限 170 行），而它**自己的 `progressive_disclosure` 打分器阈值（>3000 token 才扣分）比它审计所依据的 yao library tier（1300 token）宽 ~2.3×**，所以永远抓不到自己。
3. **promise-implementation checker 是单向的**（只查 documented-but-unimplemented），所以它**查不到自己 2 个未文档化的 CLI flag**（`--no-governance`、`--run-id`），自报 findings=0。
4. **security scanner 重复 flag 自己的 regex 目录源** `security-patterns.js`，产生自指 P3 噪声，且无 detector-self-exclusion 测试。
5. **eval 是 positive-only 单 case fixture、无可执行 runner**，却凭"存在即得分"自评 eval_readiness 4/5；也无 output eval 证明审计报告优于无指引复审。
6. **consumer 侧 summary/plan 渲染丢掉了 JSON 已携带的 trust framing**：裸 `P3=14` 计数、P3 整层被排除在唯一可执行的 improvement plan 之外、`6-vs-4` promise delta 紧挨 `findings=0` 未解读。

**所有建议都不需要** per-skill `manifest.json`、第二套 artifact topology、改 `.claude/.codex/.agents` mirror、或让脚本编造语义裁决——每个修复都是**删除、下沉、加 contract test、或加确定性对称检查**，符合 scripts-prepare/LLM-decides 与 smallest-durable-surface。

> **源码已逐条回源核对的 4 个 spine claim**（本文档的脊梁，全部精确命中）
> - 同族 outlier：`grep '^## (When To Use|When Not To Use|Inputs|Outputs|Failure Modes)$'` → spec-skill-audit=**5**，spec-prd / spec-code-review / spec-debug / spec-doc-review=**0**。
> - `scoring.js:436-439` `scoreProgressiveDisclosure`：`>6000→2`、`>3000→4/3`、else `5`（3000 floor 实锤）。
> - `scoring.js:442-444` `scoreEvalReadiness`：`has_evals ? 4 : 2`（完全忽略 case 数/近邻覆盖）。
> - `check-promise-implementation.js:178-181` `findMissingOptions`：`documentedOptions.filter(o => !implemented.has(o))`（单向）；`write-audit-artifacts.js:418-431` 实现 6 flag，`SKILL.md` 仅文档化 4 个，缺 `--no-governance` / `--run-id`。

## 审查范围

源资产（source-of-truth，未读取/修改 `.claude/`、`.codex/`、`.agents/` generated mirror；`.spec-first/audits/` 为 gitignored 运行产物，非 source）：

- `skills/spec-skill-audit/SKILL.md`（258 行入口，无上限测试）
- `skills/spec-skill-audit/references/`（10 个：expert-audit-rubric、report-format、security-threat-model、source-vs-runtime-contract、eval-readiness-rubric、boundary-discipline-rubric、generic-skill-audit-rubric、spec-first-skill-audit-rubric、spec-first-skill-boundary-map、trigger-routing-rubric）
- `skills/spec-skill-audit/scripts/`（20 个脚本含 lib/，约 4,400 LOC；orchestrator `write-audit-artifacts.js` 470 行、`collect-skill-facts.js` 449、`lib/scoring.js` 552、`eval-fixture-normalizer.js` 353、`lib/report-writer.js` 314）
- `skills/spec-skill-audit/evals/`（4 套 fixture，**每套 1 case**）
- `skills/spec-skill-audit/examples/`（4 个 example skill fixture）
- `tests/unit/spec-skill-audit-contracts.test.js`（**仅 1 test**，守 progressive-disclosure prose 字符串）
- `tests/unit/skill-audit-scripts.test.js`（31 test，真实脚本覆盖）
- `src/cli/contracts/dual-host-governance/skills-governance.json`（spec-skill-audit entry 仅描述 host delivery）

**Dogfood 事实**（本次实跑 `node scripts/write-audit-artifacts.js --repo . --target skills/spec-skill-audit`）：自审分 92（A-），确定性 P0=P1=P2=0；eval_readiness=4/5；security P3=14（其中含自指 fixture 假阳性）；promise documented=4 / implemented=6 但 findings=0。

rubric：yao-meta-skill `references/` 的 skill-engineering-method、resource-boundaries、output-eval-method、review-studio-method、prompt-engineering-doctrine、authoring-discipline、artifact-design-doctrine、skillops-decision-policy。

## 当前执行校准（2026-06-20）

本文写成后，`spec-skill-audit` source 已开始按 BATCH 1/2 落地部分改动。继续执行前按当前磁盘 source 校准：

- P1-1 已基本落地：`SKILL.md` 已删除 5 个重复顶层契约 section，入口约 155 行；输出清单、context-governance exception 与 failure reason code 已下沉到 `references/report-format.md`。
- P1-2 已部分落地：`tests/unit/spec-skill-audit-contracts.test.js` 已新增 duplicate heading 与入口行数/字符上限守护；仍需通过聚焦 Jest 与 `node --check` 收口。
- P2-1 已部分落地：`--no-governance` 与 `--run-id` 已在 `SKILL.md` Advanced Options 文档化，`check-promise-implementation.js` 已加入 implemented-but-undocumented 方向；仍需验证 exact/allowlist 断言是否足够防回退。
- P2-2 原建议需收窄：现有测试刻意断言“其他 skill 中同名 `scripts/lib/security-patterns.js` 的真实可执行危险内容仍应被报出”，不能泛化跳过所有同名文件。正确优化是只处理 `spec-skill-audit` 审计器自己的 regex catalog 自噪声，或给 pattern-definition 行降级/标注。
- P1-3/P2-7 已部分落地：`renderImprovementPlan` 已增加 P3/tentative residual triage 段，`renderSecuritySummary`/`renderPromiseSummary` 已补 trust framing 与 option delta 解读；仍需聚焦测试与实际 self-audit 输出核对。

## Goals

- 让这个"质量良心"工具**自己先达标**——不再自违反它对别人强制的渐进式披露、契约对称、证据三段式纪律。
- 让它的**确定性自审能看见自己的债**（修掉产生 92/A- 干净分的结构性盲点）。
- 让 consumer 侧 artifact 不掩盖 JSON 已携带的 trust state。
- 保持脚本只产确定性事实、LLM 做语义裁决；保持 smallest-durable-surface。

## Non-Goals

- 不给 `skills/spec-skill-audit/` 加 per-skill `manifest.json` / `interface.yaml` / lifecycle 元数据，不建第二套 artifact topology。
- 不让确定性脚本编造 `counter_evidence` 或语义裁决（不反转 scripts-prepare/LLM-decides）。
- 不全局把 `scoring.js` progressive_disclosure 硬调到 1300 token（会在全仓合理的脚本重 skill 上误报）。
- 不为这个无凭证内部 Library 级 skill 投机性地建完整 eval runner 或 blind-A/B LLM promotion gate。
- 不改 `.claude/.codex/.agents` runtime mirror，不改 JSON artifact 层（consumer 修复只动 render* 函数）。

## 当前强项（必须守住，不得回退）

| # | 强项 | source 证据 |
| --- | --- | --- |
| S1 | **scripts/LLM 边界写进代码**：每条脚本 finding 默认 `counter_evidence.checked=false / result=unknown / decision=tentative`，附字面注释"Deterministic scripts do not decide semantic counter-evidence"——脚本自标未裁决、把 verdict 让给 LLM | `lib/finding.js:47-72` |
| S2 | **JSON finding shape 是核心资产**：完整 `signal → evidence(file/section/excerpt) → counter_evidence{checked,result,note} → completeness → decision → reason → recommendation → confidence`，干净分离 script-填充 与 LLM-裁决字段 | `references/report-format.md:26-56` |
| S3 | **scores 是 signals-not-gates 且代码层兑现**：`score_is_signal_not_gate:true` + `requires_llm_review:true`，`overall_score` 从不作下游阈值分支（只用于显示/排序）；eval_readiness、security 维度诚实带 `whyNot5` caveat | `lib/scoring.js`（含 `:253` whyNot5"fixtures are review inputs only"） |
| S4 | **security scanner 已做上下文分级**：`classifyFileContext` 把 `/references/`、`/evals/`、`/examples/` 下命中降级 P3，`classifyPatternContext` 识别 prohibition cue 与定义行——这正是自审没误报 P0 的原因。降级保留，缺口只在它没覆盖到 detector 自己的源 + 无测试 | `scan-instruction-security.js:69-83` |
| S5 | **31 条脚本测试压真实高危路径**：path-escape/realpath 穿越拒绝、run-id 校验（`..`、`latest`、`CON`/`COM1`、尾点）、Windows 保留名、executable-exception 把真危险保在 P0、以及 source 文件运行前后 byte-identical 不变量 | `tests/unit/skill-audit-scripts.test.js` |
| S6 | **frontmatter description 是 trigger-first 范本**：recurring job + spec-first scope + 显式 exclusion（"Do not use for installing third-party skills, creating new skills, or general code review"）；与 spec-code-review（代码 diff）、spec-doc-review（需求/计划/任务文档）边界干净——三个不碰撞的 target 家族 | `SKILL.md:3` |
| S7 | **治理注册正确且最小**：`skills-governance.json` 给它与 spec-prd 同样的 delivery-only 形态（无 per-skill lifecycle）。符合 yao "smallest durable surface"——**不要**在这里加 manifest/lifecycle theater | `skills-governance.json:325` |
| S8 | **Required-Files 契约已被强制**：`check-promise-implementation.js findMissingFiles` 把 report-format.md 的 Required Files 与 writer 对比，由 `skill-audit-scripts.test.js:788-801` 钉住——artifact 契约不是纯文档摆设 | — |

## 经验证缺口（按 yao gate 分组）

> 标注 🔁 = **dogfooding 违规**（它对别人强制、自己却违反的规则）——这是本 skill 的签名级问题，应优先。

### 🔁 P1-1 · dogfooding-progressive-disclosure · 入口重复 5 个契约 section——正是它 flag 别人的反模式

**mechanism**：SKILL.md 同时拥有 `### Workflow Contract Summary` 一行式子节——When To Use(`L19`)、When Not To Use(`L23`)、Inputs(`L27`)、Outputs(`L31`)、Failure Modes(`L40`)——**又**把每一个作为顶层 `##` section 重写一遍——When To Use(`L89`)、When Not To Use(`L104`)、Inputs(`L118`)、Outputs(`L132`)、Failure Modes(`L220`)。每个 concern 有两个"家"= 双真相源，任何后续编辑都得在两处同步。**准确措辞是"重复契约字段"而非"逐字重复"**（summary 是一行、`##` 版是展开 bullet）。`## Workflow`（`L44` summary vs `L167` 过程）是合法的 summary+detail，不属缺陷。**漂移已实际发生**：install/create/mine exclusion 被三处不同措辞表达（description `L3` "creating new skills"；summary `L25`；顶层 `L106-114`），两份 Inputs 拷贝部分且互不重叠。
**🔁 why_meta_matters**：整个职责就是 flag 别人入口里 duplicate-rubric bloat 的 skill（自己的规则 `SKILL.md:85`："Flag source skills whose main SKILL.md entrypoint carries … duplicate rubrics … that should live in references/"），自己出货了这个反模式的标准范例。作为质量良心，**它对别人强制、自己却违反的规则，直接削弱它发出的每一条 duplicate-rubric finding 的权威性**——而它纯 token 体量的打分器对结构性重复失明，所以违规在 92/A- 自审里静默通过。
**yao_principle**：resource-boundaries.md "Move detail out of SKILL.md as soon as it stops helping routing" + Anti-Patterns "storing long policy text directly in SKILL.md"；skill-engineering Design Principle "if a new check makes the skill heavier without making it more reliable, remove or relocate it"。
**recommendation**：收敛到每个 concern 单一真相源。**保留** `###` Workflow Contract Summary 子节（全同族共用的 house convention），**删除**冗余的顶层 `## When To Use`(`L89-102`)、`## When Not To Use`(`L104-114`)、`## Inputs`(`L118-130`)、`## Outputs`(`L132-165`)、`## Failure Modes`(`L220-249`)。把真正独有的运营材料下沉到 references/：Outputs 的 artifact 文件清单(`L142-162`)入 `references/report-format.md`（已有 Required Files 概念），Failure Modes 的 reason_code 处理（`NO_SKILLS_FOUND`、runtime `not_initialized`、governance-validation-fails）入 `references/report-format.md` 或新建小 `references/failure-modes.md`。保留 `## Workflow`（过程）、`## Governance`、`## Progressive Disclosure Checks`。净删 ~90 行，消除一整类双真相。
**smallest_surface**：删 SKILL.md 5 个重复 `##` section + artifact 清单/reason_code 下沉 references。入口 + references move，无脚本改动。

### 🔁 P1-2 · dogfooding-progressive-disclosure · 无行/体量上限测试，且自己的打分阈值比所依据的 doctrine 宽 ~2.3×

**mechanism**：兄弟 spec-prd 由 `spec-prd-contracts.test.js:137-138` 守护（≤170 行 **且** ≤15000 字符）。spec-skill-audit 唯一的 contract test（`spec-skill-audit-contracts.test.js`，25 行）只用 `text.toContain(...)` 断言渐进式披露 prose 字符串——**无任何长度/行数断言**。入口 258 行 / ~2528 est. token（`markdown.js estimateTokens=ceil(chars/4)` over ~10110 字符）≈ yao library tier 1300 token 的 1.9×。它自己的 `scoreProgressiveDisclosure`(`scoring.js:436-439`) 只在 `>3000` token 才扣到 5 以下，所以 2528-token 入口稳得 5 分。**这个测量缺口正是 dogfood 自审 progressive_disclosure 通过、返回 92/A- 的原因——干净分是测量伪影，不是精简入口的证据。**
**🔁 why_meta_matters**：一个 pass-floor（3000 token）比所审依据的 doctrine 宽 2.3× 的工具，无法在它所监管的同一维度上可信地自评 5/5。无上限则入口无约束上行（已经翻倍了兄弟的上限），且 dogfood 自跑永远翻不到——唯一能抓的是外部复审。
**yao_principle**：resource-boundaries.md:17 Context Budget Tiers：library = 1300 token（`:20` 允许 per-tier override）；skill-engineering Phase 7 "library skills: packaging checks" + Design Principle "rigor grows faster than context cost"。
**recommendation**：**先做 P1-1 collapse**（最小耐久机制）；之后给 `spec-skill-audit-contracts.test.js` 加行/字符上限测试，镜像 spec-prd（如 de-dup 后 ≤180 行 + 字符上限），让入口不能再静默回涨。**第二步当 advisory，不要硬调**：要么文档化"脚本重 library skill 的 token floor 故意更高"，要么在 ~1300-1600 est. token 上加 soft-flag——**不要**把 `scoring.js` 全局调到 1300（会在全仓合理脚本重 skill 上误报；yao 允许 per-tier override）。兄弟已带上限测试，所以"对齐"就是最小机制，不是新脚手架。
**smallest_surface**：给 `spec-skill-audit-contracts.test.js` 加一条（collapse 后）`text.split(/\r?\n/).length <= 180` + 字符上限。可选文档化/soft-flag `scoring.js >3000` 分支——但**上限测试是承重修复**。

### 🔁 P1-3 · artifact-design-report · improvement plan 排除整个 P3 层——干净的 plan 掩盖 14 条未分诊 tentative 信号

**mechanism**：`renderImprovementPlan`(`report-writer.js:132-160`) 把 finding 分成 Phase 1(P0)、Phase 2(P1)、Phase 3(P2，切片 30)、Phase 4(通用 boilerplate)。**P3 被结构性排除——从不被引用**。所以 14 条 security P3 在唯一可执行的 artifact 里**无处出现**；当审计本来干净时，plan 退化成四个标题 + "No P0/P1/P2 issues found" + 三条通用提醒、零 target-specific 内容（在实跑自审 plan 里逐字确认）。每条 P3 finding 对象**都带有**已填充的 recommendation 字段 + `counter_evidence.checked=false` / `decision=tentative`——正是它自己 `expert-audit-rubric.md:58-66` 要求每条都给出显式 decision(accepted/tentative/unresolved/rejected) 的 tentative 信号——可执行 plan 却不给它们 decision 槽。（细节：Phase 1-3 finding **确实**渲染 per-finding Recommendations，所以 plan 对 P0-P2 不是无行动；缺陷专指被丢的 P3 层 + 空 plan boilerplate。）
**🔁 why_meta_matters**：一份看起来干净的 improvement plan 告诉人类"无事可做"，而 14 条未复核信号 + 2 个未文档化 option 还躺在 JSON 里。可执行 artifact **主动低报工作量**——与良心工具的职责相反——而良心对别人强制"分诊每条 tentative 信号"、却静默丢掉自己的。
**yao_principle**：review-studio-method.md:53-55 "every non-pass gate must produce a review_actions entry"；artifact-design-doctrine "extract facts, claims, numbers, actions before formatting"。
**recommendation**：加一节 "Phase 3b: Triage Tentative Signals (P3/unverified)"，列出 self-fixture vs real P3 及 LLM 应做的 dismiss-vs-fix 决定；**或**在 plan 里显式说明为何排除 P3 及去哪找。当 plan 本来为空时，把通用 Phase 4 boilerplate 换成真实 residual-signal 清单（如"14 条 tentative security 信号待验证；2 个未文档化 CLI option"），让空 plan 不再暗示无事可审。**丢掉 yao 字面 `verification_command` 字段要求**（对 Library 级 skill 属打包件 overreach）；residual-signal 清单是精简修复。
**smallest_surface**：`renderImprovementPlan` 加 P3/unverified 分支(~10 行) + 一条 contract test 断言 tentative finding 被列出、非静默丢弃。

### 🔁 P2-1 · promise-implementation-contract · 自己少文档化 CLI、且 promise-checker 单向所以查不到

**mechanism**：`write-audit-artifacts.js` parseArgs 实现 6 个 flag（`--repo`、`--target`、`--runtime`、`--no-governance`、`--patch-preview`、`--run-id`），但 SKILL.md 只文档化 4 个——`--no-governance` 与 `--run-id` 在 SKILL.md 与 references 里**全无出现**。掩盖根因：`check-promise-implementation.js findMissingOptions`(`L178-194`) 只算 `documentedOptions.filter(o => !implemented.has(o))`——只查 documented-but-unimplemented，对 implemented-but-undocumented **结构性失明**（即便 `documented_options` 与 `implemented_options` 都已序列化进报告）。所以少文档化产出 findings=0，**这正是自审拿 92/A- 的原因之一**。测试加固了盲点：`skill-audit-scripts.test.js:799-800` 用 `expect.arrayContaining([...4 个 documented])`——子集断言，不管有没有额外 implemented option 都通过。`--no-governance` 是承重的：它翻转 `includeGovernance` 跳过 governance drift 审计（spec-first 价值主张的基石）。**纠正**：`--no-governance` 并不省略 `governance-drift-report.json`（无条件写出），它让 body 成为 `skippedReport`。
**🔁 why_meta_matters**：一个安全相关 flag（`--no-governance`）可调用却在契约里隐形，而工具自己的 promise check 认证 findings=0——所以它同样会放过别的 skill 隐藏的 flag。一个在一个方向上对隐藏输入面失明的审计器，低报了它本该抓的契约债。
**yao_principle**：prompt-engineering-doctrine Quality Matrix completeness + consistency；authoring-discipline Verification Discipline（工具的质量主张必须对称）。
**recommendation**：两部分。**(1) 源修复**：在 SKILL.md Inputs 文档化 `--run-id`（run 目录名覆盖）与 `--no-governance`——准确描述 `--no-governance` 为"跳过 governance-drift 检查；`governance-drift-report.json` 仍写出但记 skipped 状态"，**不是**"不写该文件"；若 `--run-id` 是编排内部用，显式说明而非留空。**(2) checker 修复**：加一个对称 `findUndocumentedOptions` pass，发 P2 "Implemented CLI option is not documented" finding，**用 allowlist / doc-marker 门控**让有意内部的 flag 不自生噪声；把 `test:799-800` 的 `arrayContaining` 子集断言换成 exact-set/allowlist 比较。让审计器契约自洽，把测试变成双向守护。
**smallest_surface**：SKILL.md Inputs 两条 bullet；`check-promise-implementation.js` 加 `findUndocumentedOptions`(P2) + 内部 flag allowlist(~10-15 行)；`skill-audit-scripts.test.js` 一处断言改动（arrayContaining→exact/allowlist）。

### 🔁 P2-2 · false-positive-precision · security scanner 重复 flag 自己的 regex 定义字面量，缺 pattern-definition 自噪声测试

**mechanism**：`scanInstructionSecurity` 遍历 skill 下每个 `.md`/`.js`，**包括 detector 自己的 `scripts/lib/security-patterns.js`**。重跑确认自审 14 条 P3 里 **7 条（50%）命中 scanner 自己的 regex 定义字面量**（curl|bash 行触发 `SUDO_USAGE`/`REMOTE_SCRIPT_PIPE`，bypass-governance regex 触发 `IGNORE_GOVERNANCE`）。`classifyFileContext`(`scan-instruction-security.js:69-83`) 只降级 `/references/`、`/evals/`、`/examples/`——**不含 `scripts/lib/`**——那 7 条只是被行级 field-prefix 启发式（`code:`/`regex:`/`title:` 前缀）**偶然**降级；任何**非** field-prefix 的 detector-own pattern-definition 行可能以满级 P0/P1 浮出。重要校准：现有 `skill-audit-scripts.test.js` 已刻意构造 `scripts/lib/security-patterns.js` 中的真实可执行危险字符串并断言应报 P1，所以不能整文件 skip；缺的是“pattern-definition literal 自噪声”这一更窄场景的回归测试。**已 REFUTE 掉原 finding 的一半**：原建议"设 `counter_evidence={checked:true,result:scope_limited}`"**不产出非-tentative decision**（`finding.js:70` 把 scope_limited 映射为 tentative），且会让确定性脚本裁决语义 counter-evidence、**反转**该 skill 硬编码的 scripts-prepare/LLM-decides 边界——故此半丢弃。
**🔁 why_meta_matters**：一个 IS-regex-目录的文件命中自己的字面量，携带零安全信号。一个 self-run 在自己 detector 源上产噪声的安全审计器，训练 reviewer 跳读 security 段——这是安全工具最危险的失败模式，因为真实 finding 在噪声里丢了信号。相比之下 `/evals//examples//references/` fixture 命中被正确处理（降级 advisory P3、裁决交 LLM），应保持不动。
**yao_principle**：output-eval anti-overfitting——precision 工具必须 discount 它能证明零意义的信号；authoring-discipline output-self-repair——已知输出错误在抵达 consumer 前命名——**但不反转 scripts/LLM 边界**。
**recommendation**：**只保留 pattern-definition 自噪声修复**：不要泛化 skip 所有同名 `scripts/lib/security-patterns.js`；可以只跳过 `skills/spec-skill-audit/scripts/lib/security-patterns.js` 这个审计器自己的 catalog，或在 `classifyPatternContext` / `scanFile` 中识别 regex/pattern-definition 行，把 detector 自己的 regex 字面量降级为 documented-pattern P3 或直接过滤为 non-signal。必须保留其他 audited skill 中同名文件真实可执行危险字符串的 P1/P0 检测。加一条测试同时断言两件事：审计器自身 catalog 不产生 self-referential finding；另一个 skill 的同名文件仍会被扫描。**丢掉 auto-set `counter_evidence=scope_limited` 建议**（自败目标 + 反转边界）。`/evals//examples//references/` 降级 P3 保持原样——那是预期的 degraded-to-LLM 路径，非缺陷。
**smallest_surface**：`scan-instruction-security.js` 增加 exact tool-owned catalog exclusion 或 pattern-definition classifier + 一条回归测试；不改 schema、不跳过任意 audited skill 的同名 detector 源、不反转 scripts/LLM 边界。

### 🔁 P2-3 · false-positive-precision · counter-evidence 解析循环只覆盖 P0/P1，而既有 fixture-噪声指引不在 reviewer 路由路径上

**mechanism**：`SKILL.md:197` 指示"For each P0/P1 finding you surface to the user, include signal, file/section evidence, counter-evidence status, decision…"。因为所有自指 fixture/定义命中都被降级 P3（`classifyFileContext`，不设 counter_evidence；`finding.js:68` 默认 `checked=false`），**这类噪声 100% 落在 resolution prose 唯一不覆盖的 severity 段**。discount 指令**确实存在**（`security-threat-model.md:23` "Documented threat examples are not automatically vulnerabilities. The reviewer must inspect context"），但 Workflow step 7 只把 reviewer 路由到 `expert-audit-rubric.md`——threat-model.md 列在 References "use only when needed" 下，所以既有指引**不在 reviewer 实际路径上**。**纠正**：原 finding 杜撰了不存在的规则标签 "PREC-01" 并夸大"无指引"——两者均丢；真实缺口是路由/作用域，不是缺失。
**🔁 why_meta_matters**：无 on-path 指引时，P3 簇的正确处理依赖 LLM 每次独立重新推导 fixture 命中是有意的——非确定性，且正是 scripts-prepare/LLM-decides 分工本该预解析的高频可预测情形。良心工具一边对别人强制 counter-evidence、一边对自己发出 14 条未解析的自指 P3。
**yao_principle**：prompt-engineering-doctrine practicality/completeness——入口必须告诉 agent 如何读自己的确定性输出而无隐藏假设；一条在 P0/P1 解析噪声、却在 P3（噪声实际累积处）沉默的规则是不完整契约。
**recommendation**：在 Workflow step 7（或 security/reporting 步骤）加一句："Security matches inside an audited skill's own evals/, examples/, or references/ are expected scope_limited fixtures (see references/security-threat-model.md); treat them as counter-evidenced P3 noise and do not surface them as review items unless an executable code path performs the action." 把既有指引放到 reviewer 路由路径上。Prose-only，Library 级精简。**不要**引用任何 "PREC-01"（不存在）。
**smallest_surface**：`SKILL.md:197`/Workflow step 7 附近加一句。Prose-only，无脚本改动。

### P2-4 · eval-readiness · 🔁 eval_readiness 凭"存在即得分"自评 4/5，而 fixture 是 positive-only 单 case

**mechanism**：`scoreEvalReadiness`(`scoring.js:442-445`) 是二元：`if (skill.has_evals) return 4; return 2;`——case 数、近邻覆盖、runner 存在全被忽略，所以 1-case fixture 与稳健 holdout 同分。4 套 fixture（trigger/boundary/security/audit-quality）各解析为恰好 1 case，且每个都是 positive/should-trigger（无 negative case 可在回归时翻转）。诚实的 whyNot5 注释（`scoring.js:253` "fixtures are review inputs only"）正确，但**数字 4/5 跑赢了 prose**：分数不反映真实可辩护性。
**🔁 why_meta_matters**：直接违反它自己的 `eval-readiness-rubric.md`（"Eval readiness means the workflow has examples that can catch routing and boundary regressions"）——单个 positive-only case 抓不到回归。良心在它监管的同一维度上对自己宽松评分，所以 consumer（spec-work、release governance）会过度信任它的路由/质量裁决。
**yao_principle**：output-eval-method 质量主张应可复现（但 yao `:62` + "scaffold can start with one smoke case" 意味着**不**要求完整 runner）；resource-boundaries.md:45-50 evals 在路由/质量主张需辩护时存在。
**recommendation**：**优先 scoring-honesty 修复**（最小改动）：调整 `scoreEvalReadiness` 让它在 fixture 为 positive-only / 单 case 时**不给 4**（直到至少有一个 negative/近邻 case 才到 4），让分数匹配已发出的诚实注释。可选给 trigger 与 boundary fixture 加 2-3 个近邻/negative case（skill-audit vs code-review/doc-review/skill-creator）。**不要**投机性建完整 eval runner。security 近邻（curl|bash vs 注释里的 curl）兼作 P2-2 自指假阳性守护。
**smallest_surface**：`scoring.js` ~5 行让 `scoreEvalReadiness` 反映 case 形态；**或**给现有 JSON fixture 加几个近邻 case（无新文件，coverage_tags 已驱动 normalizer）。

### P2-5 · eval-readiness · 无 output eval（with-skill vs baseline）证明审计 finding 优于无指引复审

**mechanism**：spec-skill-audit 出货**零**条 with-skill-vs-baseline case。4 套 eval fixture 全是 review **输入**（`{input, expected_signal}` 形态）；无一对比审计器报告 vs baseline（无指引）复审，无一断言跑审计器产出期望 finding。grep 确认**无脚本把它们当 case 跑**——scripts 里唯一 `/evals/` 引用是 `scan-instruction-security.js:73`（path 排除）；`eval-fixture-normalizer.js` 只校验 schema/bucket，从不执行审计器。**已 AMEND（P1→P2）**：该 skill **不**对被审 skill 强制 output-eval（其 rubric 把 eval readiness 窄定义为 trigger+boundary 结构覆盖），所以 dogfooding 角度是较窄的"在名为 eval_readiness 的维度上自评 4/5 却无证据其报告优于 baseline"，而非 enforce-on-others/violate-on-self。
**why_meta_matters**：为每个别的 skill 决定 remediation 优先级的工具，没有证据其优先级是对的。一次静默劣化 finding 质量的回归（如停止检测 broad trigger）会绿灯通过——31 条 mechanics 测试全过而审计有用性下降。
**yao_principle**：output-eval-method:3,7,45——governed/library skill 晋升前 with-skill vs baseline。
**recommendation**：**只做确定性那半**作为按比例的第一步：对现有 `examples/` fixture（可在 fixture 邻近处用现有字段风格或 test-local table 记录 planted defects，如 weak-skill 有 `[broad-trigger, missing-failure-mode]`、dangerous-skill 有 `[REMOTE_SCRIPT_PIPE]`）跑 `write-audit-artifacts.js`，在 `skill-audit-scripts.test.js` 断言每个 planted defect 被抓且无 ledger-absent finding（确定性 finding 的 precision/recall）。**语义 blind-A/B-vs-baseline LLM 层保持 OPTIONAL/advisory，非 promotion gate**（无凭证内部 Library 级）。复用 `write-audit-artifacts.js --target`；不要引入 production schema、不要新增第二 artifact topology。
**smallest_surface**：优先在测试里维护 expected-defects table；只有复用压力出现时才考虑 fixture-local JSON，且仍作为测试输入而非 runtime artifact。

### P2-6 · eval-readiness · 自 eval 覆盖每 bucket 仅 1 个 positive-only case，太薄盖不住它保护的 ~4,400 LOC（非 dogfooding）

**mechanism**：4 套 fixture 各含恰好 1 case（trigger=broad-description、boundary=plan-work-overlap、security=remote-script-pipe、audit-quality=missing-governance-entry），全 positive。`eval-readiness-rubric.md:9-10` 只要求每 bucket "at least one structurally valid case"，所以审计器自报 "ready" 却每维度只跑单条 happy-path 字符串——无近邻、无 holdout。`dogfooding=false` 准确：它满足自己（弱）的 ≥1-case 门槛；它不对别人强制 ≥3/holdout/近邻。
**why_meta_matters**："ready" 对审计器自己是空洞信号：单 case 仍匹配时，一次破坏所有真实 boundary 分类的 scanner 回归仍能通过它自己的 readiness gate。
**yao_principle**：output-eval-method Anti-Overfitting——保留小 public smoke set + 独立 holdout set；boundary 不清时加近邻 case（`:112-113`）。
**recommendation**：把每个自 eval bucket 从 1 扩到 3-5 case，每 bucket 含至少一个近邻/negative case（trigger：应 flag 的真宽 description + 不该 flag 的表面宽实则具体；security：curl|bash + 注释里 curl 不该 flag）。每 bucket 留一个作 public smoke、其余作 holdout。**追加进现有 JSON 文件**——无新文件、无 schema 改动。不为凑数建缺失的 eval runner。
**smallest_surface**：每个现有 fixture 加 2-4 case 含一个 negative/近邻。无新文件；coverage_tags 已驱动 normalizer。

### 🔁 P2-7 · artifact-design-report · consumer summary 丢掉 JSON 已携带的 trust framing

**mechanism**：两处相关 summary-renderer 缺口。**(a)** `renderSecuritySummary`(`report-writer.js:230-234`) 把 security 报告塌成一行裸句 "Security signals: P0=0, P1=0, P2=0, P3=14."，只读 `report.summary` 计数——从不碰每条 finding 上都有的 `counter_evidence.checked=false` / `decision=tentative` / self-fixture 证据路径，而 sibling `renderScoreExplanation`(`181-194`) **确实**为分数渲染 per-dimension "Reliability: partial" framing。这个不对称就是缺陷。**(b)** `renderPromiseSummary`(`236-240`) 打印 "findings=0; documented options=4; implemented options=6"——可见的 6-vs-4 delta 未解读地紧挨无限定的 findings=0；扫读的 reviewer 抓住 findings=0、从不算那个 gap。**已 AMEND（P0/P1→P2）**：summary 已带强 GLOBAL trust framing（"Scorecards are signals, not gates: yes"、"conclusion ceiling: tentative"、"LLM review decides semantic quality"），且 consumer 是 scripts-prepare/LLM-decides 契约下的 LLM，故危害有界——这些是呈现精修、非数据损坏（JSON 层正确、无需改）。
**🔁 why_meta_matters**：良心工具的内部呈现不一致：唯一省略 per-finding trust state 的 summary 段（security），以及一处非零 delta 读作 pass 的 promise 行。一份看起来精致却让可见 gap 读作"无事"的报告经不起复审（artifact-design Reviewer Rule）。
**yao_principle**：artifact-design-doctrine.md:7,33 "compact metrics, visible deltas, short explanations"；review-studio 以 decision 领先、非裸计数。
**recommendation**：**(a)** `renderSecuritySummary` 在有 finding 但全部 `checked=false/tentative` 时，先渲染验证状态、再计数、再链接，如 "Security: 14 tentative pattern matches, 0 LLM-confirmed — review security-risk-report.json before acting; matches include the audit tool's own test fixtures."，并把自指路径（`evals/`、`examples/*-skill.example.md`）tag 为 "self-fixture"。**(b)** `renderPromiseSummary` 在 implemented>documented 时显式呈现少文档化（"Promise: 2 implemented options undocumented (--no-governance, --run-id); 0 documented-but-missing"）或说明少文档化超出 checker 作用域，让非零 delta 不再读作无限定 findings=0。**不改 JSON 层**。与 P2-1 promise-checker 对称修复配对。
**smallest_surface**：`renderSecuritySummary` ~5 行读 finding 级 counter_evidence/self-fixture 路径；`renderPromiseSummary` ~4 行渲染集合差。加一条 contract test 断言 tentative security 信号被标 unverified。

### P2-8 · artifact-design-report · summary 渲染固定 11-section 模板不论相关性；skipped section 成 boilerplate 噪声（非 dogfooding）

**mechanism**：`renderSummaryMarkdown`(`report-writer.js:74-129`) 每次返回静态 11-section 数组；`renderGovernanceSummary`/`renderRuntimeSummary` 发 "skipped" 串而非 caller 省略标题。单 skill 非自审时人类拿到完整 "## Governance: skipped" 与 "## Runtime Drift: skipped" 标题段、零信息。**已 AMEND 为窄修复**：ordering 批评基本已满足（Executive Summary 居 section 1、P0/P1 Findings 居 section 3、skipped 段在 review-studio:12 所置的 supporting zone），且原建议"把 tentative/security 信号提到 findings 之上"**有害**——P3 是自指假阳性，把已知噪声提到 fold 之上是放大它。`dogfooding=false`：工具不对别人强制"无 skipped-section boilerplate"，故属普通装饰打磨。
**why_meta_matters**：reviewer 学会 summary 多是骨架就跳读，那个需要注意的段得到与空段同样的轻视读法。比 dogfooding finding 价值低，但对项目最常读的 artifact 面是廉价的 purpose-led-density 改进。
**yao_principle**：artifact-design-doctrine 按 artifact 类型/purpose-led density 路由；review-studio:12 summary first（lead order 已遵守）。
**recommendation**：把 skipped/空段塌成单行 "Not in scope this run: governance, runtime-drift" 而非完整标题段。**丢掉原"把 security 信号提到 findings 之上"那半**（会放大已知自指 P3 噪声）。保留 lead order 不变。纯装饰精修。
**smallest_surface**：`renderSummaryMarkdown` 过滤 section 数组、把 skipped 塌成一行(~8 行)。用既有 progressive-disclosure contract test 覆盖。

### P2-9 · governance-lifecycle-contract-test · source topology 未锁：无 contract test 断言自己的文件清单（非 dogfooding，optional hardening）

**mechanism**：兄弟 spec-prd 有 topology-lock 测试（`spec-prd-contracts.test.js listCurrentFiles` 断言其精确 source 文件清单）。spec-skill-audit **无对应**：唯一的 SKILL.md contract test 守 prose 字符串，31 条脚本测试用合成 `mkdtempSync` fixture、从不枚举自己的目录。所以贡献者可加第 21 个脚本、第 11 个 reference、第 5 个 example 而零测试失败（当前 scripts=20/references=10/evals=4/examples=4）。**已 AMEND（P1→P2 + dogfooding 改为 false）**：原"它 flag 别人的同款失败"框架**错了**——spec-skill-audit 的 Progressive Disclosure Checks flag 的是 SKILL.md 入口**内部**的 drift，**不是**目录文件数上限；`detect-skill-layout.js` 只发 mode+skill_dirs、无 file-count/bloat reason_code，所以工具不对任何人强制 topology cap。spec-prd 是全仓唯一有此测试的 skill，故属 optional hardening（与单个兄弟的 convention 对齐），非违反的规则。目录未臃肿（自审 92/A-）。
**why_meta_matters**：良心工具自己 surface 的增长无人复核；但因工具不审目录 topology，这是 hardening 不是 dogfooding 失败——当 optional 处理、非 release gate。
**yao_principle**：skillops-decision-policy.md:8 "Prefer the smallest durable surface"；authoring-discipline.md:76（"governance to a scaffold with no reuse pressure" 本身是失败模式——故保持 optional 且非脆性）。
**recommendation**：**OPTIONAL hardening**：给 `spec-skill-audit-contracts.test.js` 加一条 `listCurrentFiles` 断言枚举当前 scripts/lib、references(10)、evals(4)、examples(4)，像 spec-prd 那样分 source vs evals，让新文件需要一次有意的复核测试编辑。**不要**加 per-file schema 或 lifecycle 元数据。丢掉错误的 dogfooding 框架。优先级低于真 dogfooding finding。
**smallest_surface**：在既有 `spec-skill-audit-contracts.test.js` 加一个 `test('source topology stays bounded')` 用 `fs.readdirSync`(~25 行)。无新文件、无新脚本。

## 建议落地顺序

1. **BATCH 1（入口 dogfooding，权威成本最高，仅 source+test）**：collapse SKILL.md 5 个重复 `##` 契约 section 到每 concern 单源、把 artifact 清单与 reason_code 下沉 references [P1-1]；再加行/字符上限 contract test 镜像 spec-prd 让精简入口不能回涨 [P1-2]。当前 source 已基本落地，继续工作只需验证与必要微调。
2. **BATCH 2（确定性对称修复，让自审能看见自己的债）**：给 `check-promise-implementation.js` 加 allowlist 门控的 `findUndocumentedOptions`(P2) + 收紧 `arrayContaining` 测试为 exact/allowlist，并在 SKILL.md Advanced Options 准确文档化 `--no-governance`/`--run-id` [P2-1]；给 security scanner 增加 detector pattern-definition literal 自噪声分类/测试，但保留同文件真实危险代码的 P1/P0 检测 [P2-2]。这些移除产生 92/A- 干净自分的结构性盲点。
3. **BATCH 3（consumer 面 trust framing，不改 JSON）**：给 `renderImprovementPlan` 加 Phase 3b residual-signal 段 / 空 plan 清单 [P1-3]；给 `renderSecuritySummary` 加 per-finding trust framing + 在 `renderPromiseSummary` 解读 promise delta [P2-7]；在 `SKILL.md:197`/Workflow step 7 附近加一行 on-path fixture-噪声指引 [P2-3]。P2-8 塌缩 skipped 段可随行。
4. **BATCH 4（eval 诚实 + optional hardening，最低紧迫度）**：让 `scoreEvalReadiness` 反映 case 形态，positive-only/单 case 压到 4 以下 [P2-4]；加确定性 planted-defects 账本 + 对 `examples/` 的 precision/recall 测试 [P2-5]；给 fixture 加近邻/negative case [P2-6]；可选加 topology-lock 测试 [P2-9]。

## 反模式（明确不要做）

- **不要**加 per-skill `manifest.json`/`interface.yaml`/`agents/` 或任何第二套 artifact topology——delivery-only 治理 entry（与 spec-prd 一致）对本项目模型正确；per-skill lifecycle 元数据正是 yao "smallest durable surface" 警告的 manifest theater。
- **不要**让确定性 scanner 自动盖 `counter_evidence={checked:true,result:scope_limited}` 到 fixture 命中：自败目标（`finding.js:70` scope_limited 仍→tentative）且反转该 skill 硬编码的 scripts-prepare/LLM-decides 边界（`finding.js:55-59`）。用一个边界违规换另一个不是修复。
- **不要**全局把 `scoring.js` progressive_disclosure 硬调到 ~1300 token：会在全仓合理的脚本重 library workflow skill 上误报。yao 允许 per-tier override——文档化故意更高的 floor 或 soft-flag。
- **不要**把 P3 security 信号提到 summary 里 P0/P1 Findings 之上：那些是自指假阳性，提到 fold 之上放大当前 placement 正确弱化的噪声。
- **不要**为这个无凭证内部 Library 级 skill 投机性建完整 eval runner 或 blind-A/B LLM promotion gate——yao 反模式"为一次性结构加 eval"。先做对 `examples/` 的确定性 precision/recall 那半；语义层保持 optional/advisory。
- **不要**改 `.claude/.codex/.agents` runtime mirror "修复"任何项——每个改动都在 SKILL.md / scripts / references / evals / examples / tests source；source 改后用 `spec-first init` 重生 runtime。
- **不要**为 consumer 面 finding 改 JSON artifact 层——JSON 已正确携带完整 counter_evidence/decision 链；修复只在 render* summary/plan 函数。
- **不要**把 topology-lock 或 output-eval 项框架成 dogfooding 违规或 release gate——工具不对被审 skill 强制目录文件数或 output-eval，故属 optional hardening。

## 第一批最小 surface

```
skills/spec-skill-audit/SKILL.md                         # P1-1 删 5 个重复 ## 段(净删~90行)；artifact清单/reason_code下沉references
skills/spec-skill-audit/references/report-format.md      # P1-1 接收下沉的 artifact 文件清单 / reason_code（或新建 references/failure-modes.md）
tests/unit/spec-skill-audit-contracts.test.js           # P1-2 加行/字符上限断言(镜像 spec-prd-contracts.test.js:137-138)
CHANGELOG.md                                             # source 变更必更
```

后续 BATCH 按设计触碰：

```
skills/spec-skill-audit/scripts/check-promise-implementation.js  # P2-1 findUndocumentedOptions + allowlist
skills/spec-skill-audit/scripts/scan-instruction-security.js     # P2-2 pattern-definition self-noise classifier
skills/spec-skill-audit/scripts/lib/report-writer.js             # P1-3/P2-7/P2-8 render* 修复
skills/spec-skill-audit/scripts/lib/scoring.js                   # P2-4 scoreEvalReadiness 反映 case 形态
skills/spec-skill-audit/evals/*.json                            # P2-6 近邻/negative case
skills/spec-skill-audit/examples/ + tests/unit/skill-audit-scripts.test.js  # P2-5 planted-defects 账本 + precision/recall
```

## 不要触碰

- `lib/finding.js` counter_evidence 默认（`checked=false`、`result=unknown`、`decision=tentative`、"Deterministic scripts do not decide semantic counter-evidence"）——这**就是** scripts-prepare/LLM-decides 契约；保留。
- `signal→evidence→counter_evidence→completeness→decision→reason→recommendation→confidence` JSON finding shape（`report-format.md:26-56`）——设计良好；consumer 面修复进 render* 函数、不动 schema。
- `score_is_signal_not_gate` / `requires_llm_review` 标志及 `overall_score` 从不作下游分支——诚实信号框架；保留。
- `classifyFileContext` 对 `/references//evals//examples/` 的降级 P3（`scan-instruction-security.js:69-83`）——documented-pattern fixture 的正确 degraded-to-LLM 路径；只有 detector 自己的 `security-patterns.js` 需额外排除。
- `skills-governance.json` spec-skill-audit entry（delivery-only，无 lifecycle）——对本项目正确；不加 per-skill maturity/lifecycle 字段。
- frontmatter description（`SKILL.md:3`）trigger + exclusion 及对 spec-code-review/spec-doc-review 的干净边界——保持原样。
- 31 条脚本测试的高危覆盖（path 穿越、run-id 校验、Windows 保留名、byte-identical source 不变量）与 Required-Files 强制（`findMissingFiles` + `skill-audit-scripts.test.js:788-801`）——保留并新增、不替换。
- `findMissingFiles`/`findMissingOptions` 的 documented-but-unimplemented 方向（promise-breaking 方向）——正确且被测；修复**增加**反向 pass、不改这个方向。
- `## Workflow` section（过程，`L167`）——相对 `### Workflow` summary（`L44`）是合法 summary+detail；**不要**当重复删（只有 5 个契约 section 是重复）。

## 验证记录

本审查阶段已执行（事实逐条回源核对，未改 spec-skill-audit source）：

```bash
# dogfood：在自身上跑审计工具
node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo . --target skills/spec-skill-audit   # exit 0；自审 92/A-

# spine claim 回源
grep -cE '^## (When To Use|When Not To Use|Inputs|Outputs|Failure Modes)$' skills/{spec-skill-audit,spec-prd,spec-code-review,spec-debug,spec-doc-review}/SKILL.md  # 5,0,0,0,0
grep -n '3000\|6000\|has_evals\|return 4\|return 2' skills/spec-skill-audit/scripts/lib/scoring.js          # scoreProgressiveDisclosure/scoreEvalReadiness 阈值
grep -n 'findMissingOptions\|documentedOptions.filter' skills/spec-skill-audit/scripts/check-promise-implementation.js  # 单向
grep -oE "'--[a-z-]+'" skills/spec-skill-audit/scripts/write-audit-artifacts.js   # 6 flag
grep -oE '\-\-[a-z-]+' skills/spec-skill-audit/SKILL.md                            # 4 flag(缺 --no-governance/--run-id)
```

结果（全部精确命中）：

- 自审 dogfood exit 0，92/A-，确定性 P0=P1=P2=0，eval_readiness=4/5，security P3=14（含自指假阳性），promise documented=4/implemented=6 但 findings=0。
- 同族 outlier：spec-skill-audit=5 个顶层 `##` 契约 section，4 个兄弟=0。
- `scoring.js:436-444`：progressive_disclosure `>3000` floor、eval_readiness 二元 `has_evals?4:2`。
- `check-promise-implementation.js:178-181` 单向；6 flag 实现 vs 4 flag 文档化，缺 `--no-governance`/`--run-id`。

**未执行**：本次未跑扩充后的 eval、未派 fresh-source reviewer、未实改 source——它们是被建议的落地工作（BATCH 1-4），需在实施阶段执行，不在本审查文档范围内。

工作流 provenance：原始 yao-gate 复审记录声称覆盖 8 gate / 28 raw finding / 37 subagent / 1 次 deep synthesis；本文未附 raw transcript 或逐条 raw→聚合映射，因此这些数字只作 advisory provenance，不作为下游执行 gate。本文可执行面以 12 个聚合 finding（P1-1 到 P2-9）、源码回源命令和当前执行校准为准。对抗式验证已修正多条原始 finding：把 2 条 dogfooding 误判改为 false（P2-6/P2-9）、把 2 条 P0/P1 降级为 P2（P2-7/P2-8）、丢弃 1 条会反转 scripts/LLM 边界的错误建议（P2-2 的 counter_evidence 自动盖章半）、删除 1 个杜撰规则标签（P2-3 "PREC-01"）。

## Changelog 判断

本文档是 repository source docs 新增（`docs/项目审查/2026-06-20-spec-skill-audit-skill-optimization-suggestions.md`），需更新根目录 `CHANGELOG.md`。本次只写优化建议，未改 `spec-skill-audit` skill source、CLI 或 generated runtime mirror。
