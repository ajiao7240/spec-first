---
title: "feat: 审查→整改闭环 origin 追踪补账(第一批)"
type: feat
status: completed
date: 2026-06-14
target_repo: spec-first
spec_id: 2026-06-14-002-review-closure-traceability
origin: docs/项目审查/2026-06-14-达成度与闭环审查报告.md
referenced_reviews:
  - path: docs/项目审查/2026-06-14-达成度与闭环审查报告.md
    role: origin
    scope: in
    addresses_findings: ["META-closure-break"]
  - path: docs/项目审查/2026-06-10-全项目综合审查报告.md
    role: cross-reference
    scope: adjudicated
    note: 12 个 P1 的逐条闭环去向由本计划 U1 裁决文档承载
---

# feat: 审查→整改闭环 origin 追踪补账(第一批)

## Summary

把 2026-06-14 达成度与闭环审查报告第 7 章「第一批(元结论补账)」收敛为可执行变更。两个动作:

1. **U1(docs-only):** 给 2026-06-10 综合审查报告的 12 个 P1 补一份独立的显式闭环裁决文档,逐条标 RESOLVED / 继续修 / 裁剪 + 承接去向。裁决底稿已在 2026-06-14 报告第 3 章备好,本动作把它正式化为可被未来 plan 引用的独立 artifact。
2. **U2 + U3(轻量 source):** 把「引用审查报告的 plan 必须保留可追踪 finding id」这条目前的静默约定,升级为一条 **frontmatter 约定 + 弱校验 contract test**——只防「引了报告却不标 finding id」这类静默断链,不强制覆盖完整性。这是把角色契约 §4「响亮约定(loud convention)」用最小确定性 test 兑现,**不是新增硬 gate**。

本计划不修任何 P1 本身(那些走第二/三/四批),只修「为什么 P1 会被漏掉」的追踪机制。

---

## Decision Brief

- **Recommended approach:** 复用已存在的 `referenced_reviews:` frontmatter 先例(`docs/plans/2026-05-07-001-feat-skill-agent-quality-governance-plan.md` 已用过该结构),不发明新字段族;contract test 挂进已有的 `tests/unit/plan-status-taxonomy.test.js`(已遍历所有 plan、有 frontmatter helper、对 legacy 缺字段优雅放行),不新建测试文件。
- **Key decisions:**
  - 裁决文档为**独立 artifact**(放 `docs/项目审查/`),职责单一、可被 `referenced_reviews` 引用(用户选定)。
  - contract test 为**弱校验**:只断言「plan 若把某 `docs/项目审查/*报告*.md` 标为 `role: origin` 且 scope: in,则该 reference 必须带非空 `addresses_findings`(或 `deferred_findings`)」。不校验 finding id 真实存在、不校验覆盖完整性(用户选定,符合 light-contract)。
  - 约定写进新契约文档 `docs/contracts/workflows/review-closure-traceability.md`,作为单一来源,test 引用它而非各自硬编码规则。
- **Validation focus:** U2 的 test 自跑通过 + 对现有 30+ plan 零误报(尤其 legacy 无 referenced_reviews 的 plan 不得 fail);U3 约定文档落地后 `npm run test:unit` 相关测试绿。
- **Largest risks / boundaries:** 当前工作树 dirty(30 个无关改动),实施前每个切片重跑 `git status --short` 只处理 in-scope 文件;不把弱校验做成硬 gate;不回溯改写历史 plan 的 frontmatter(只对「引用审查报告」的新 plan 生效,历史 plan 缺字段走 legacy 放行)。

---

## Direct Evidence

- target_repo: spec-first
- source_refs:
  - docs/项目审查/2026-06-14-达成度与闭环审查报告.md（origin,第 3、7 章)
  - docs/项目审查/2026-06-10-全项目综合审查报告.md（12 P1 裁决底稿来源)
  - docs/plans/2026-05-07-001-feat-skill-agent-quality-governance-plan.md:12-21（referenced_reviews 先例 schema)
  - tests/unit/plan-status-taxonomy.test.js:1-178（测试宿主:splitFrontmatter/scalarField/parseListField helper + validatePlanStatusTaxonomy 遍历)
  - docs/contracts/workflows/spec-id-traceability.md（既有 plan 身份契约,新契约的姊妹文档)
- current_revision: 694bbefa
- worktree_dirty: true（30 文件,均为 06-14-001 plan 的无关整改;本计划文件不在其中)
- discovery_methods: rg/grep/sed/wc 直接读;无 external research(边界清晰、有现成先例)
- tests_or_logs: 未跑(规划阶段);U2/U3 验证命令已在各 unit 列出
- confidence: high（机制有现成先例 + 现成测试宿主;裁决底稿已备)
- limitations: 未实跑测试;finding id 真实性不在弱校验范围(有意取舍)

---

## Problem Frame

2026-06-14 审查的元结论:spec-first 对用户项目执行严密的「审查→整改」闭环纪律,却对自身审查 artifact 失守。具体断点(全部 confirmed):

- `grep -rln "2026-06-10-全项目综合审查" docs/plans/` 零命中——06-10 综合报告的 12 个 P1 无任何 plan 以其为 `origin`。
- 对照:05-07 两份审查都有 plan 承接;06-10 是唯一在 origin 链上「凭空消失」的高置信审查。
- 后果:12 个 P1 四天后实测 3 RESOLVED / 3 PARTIAL / 5 OPEN / 1 REGRESSED——半数以上从未真正落盘,且无任何机制报警(plan 可标 completed 而它不负责的 P1 照样留在 source)。

这不是某个 P1 没修的问题,是**追踪机制缺失**的问题。角色契约 §4 已承认:verification / handoff / knowledge-promotion gate 在缺 runtime 强制时降级为「响亮约定(loud convention——必须显式声明,不得静默放行)」。当前的问题是「响亮约定」实践中变成了「静默约定」:既无显式声明,也无最小事实记录证明被遵守。本计划补这两块。

---

## Requirements

- R1. 12 个 P1 必须有一份独立、可检索、可被引用的显式闭环裁决文档,逐条标状态 + 承接去向,溯源到 disk 实证。(origin §7 第一批动作1)
- R2. plan frontmatter 必须有一个可机器识别的字段,表达「本 plan 处理了某审查报告的哪些 finding id」,复用现有 `referenced_reviews` 先例而非新发明字段族。(origin §7 第一批动作2)
- R3. 必须有一条**弱校验** contract test:plan 若把某审查报告标为 `role: origin / scope: in`,则该 reference 必须带非空 finding id 列表;不校验完整性、不校验 id 真实存在。(origin §7 动作2,用户选定弱校验)
- R4. 约定必须写进单一来源契约文档,test 引用它,避免规则双份。(角色契约「多真相源必须重构」)
- R5. 机制对历史 plan 向后兼容:缺 `referenced_reviews` 的旧 plan 不得被 lint fail(legacy 放行,与 plan-status-taxonomy 现有 legacy 策略一致)。
- R6. 每个实施切片同步 `CHANGELOG.md`,声明是否影响用户可见行为与 runtime regeneration。(项目 CHANGELOG 治理)

---

## Scope Boundaries

**In scope:**
- 12 个 P1 闭环裁决独立文档(U1)
- `referenced_reviews.addresses_findings` 字段约定 + 契约文档(U2)
- 弱校验 contract test 接入 plan-status-taxonomy(U3)
- 本计划自身 frontmatter 作为新约定的首个范例(已在本文件 frontmatter 体现)

**Out of scope（非本计划,不在第一批):**
- 修任何 P1 本身(figma 脱敏走第二批;虚挂依赖/孤儿 skill 走第三批;prose gate 加固走第四批)
- 中/强校验(finding id 真实性、覆盖完整性)——用户选定弱校验,更严的留作未来按需
- 回溯改写历史 plan 的 frontmatter
- 把弱校验做成 PreToolUse/CI 阻断硬 gate
- spec-plan SKILL.md 正文增加该约定的 prose 指引(可作 follow-up,见下)

### Deferred to Follow-Up Work
- 在 `skills/spec-plan/SKILL.md` Phase 0.3 / 3.1 增加「引用审查报告时填 addresses_findings」的轻量 prose 指引——本计划先落机制与契约,SKILL prose 接入可作独立小切片,避免本批触碰大 SKILL 文件。
- 若未来确有需求,再评估中校验(id 真实存在性断言)。

---

## Assumptions

- A1. 用户选定:contract test 为弱校验(只防静默断链),裁决文档为独立 artifact。
- A2. `referenced_reviews` 先例结构(`path/role/scope/deferred_findings/followup_plan`)足以承载新增 `addresses_findings`,无需重构既有先例 plan。
- A3. `tests/unit/plan-status-taxonomy.test.js` 是正确的测试宿主:它已被 CI path trigger 接入(`.github/workflows/ai-dev-quality-gate.yml` 已含该测试,见 06-14-001 plan U3),新校验自动获得 CI 覆盖。
- A4. 实施时工作树仍 dirty;每切片只处理 in-scope 文件。

---

## Implementation Units

### U1. 06-10 P1 闭环裁决独立文档

**Goal:** 把 2026-06-14 报告第 3 章的 12 P1 裁决底稿正式化为独立、可引用的 artifact,消除「静默搁置」状态本身。

**Requirements:** R1。

**Dependencies:** 无(纯 docs,可先行)。

**Files:**
- `docs/项目审查/2026-06-14-06-10-P1-闭环裁决.md`（新建)

**Approach:**
- frontmatter:`doc_role: closure-adjudication`、`authority: review-evidence`、`status: current`、`date: 2026-06-14`、`relates_to:` 指向 06-10 报告与 2026-06-14 报告。
- 正文:一张 12 行总表,每行 = `P1-N | 标题 | 裁决(RESOLVED/继续修/裁剪) | 承接去向 | disk 实证(file:line)`。直接采用 2026-06-14 报告第 3 章总表(已对抗验证)。
- 「承接去向」列要具体:RESOLVED 标承载 plan;继续修标目标批次(如「第二批 figma 脱敏」);裁剪标显式理由。
- 结尾「裁决纪律」段:声明本文是 review-evidence 非硬决策,落地前回源核对;并说明这是对元结论 META-closure-break 的直接回应。

**Patterns to follow:** `docs/项目审查/` 现有报告的 frontmatter 风格(`doc_role`/`authority`/`status`/`relates_to`);2026-06-14 报告第 3 章总表格式。

**Test scenarios:** Test expectation: none — 纯 docs artifact,无行为变更。其可被 U3 的 test 间接保护(本计划 frontmatter 引用它的逻辑由 U3 校验)。

**Verification:** 文档存在;12 个 P1 全部在表中各占一行且三选一裁决无遗漏;每个 RESOLVED 行带 file:line 实证;裁剪行带理由。

---

### U2. referenced_reviews / addresses_findings 约定契约文档

**Goal:** 把「引用审查报告的 plan 必须保留可追踪 finding id」写成单一来源契约,作为 U3 test 的规则来源。

**Requirements:** R2, R4。

**Dependencies:** 无。

**Files:**
- `docs/contracts/workflows/review-closure-traceability.md`（新建)

**Approach:**
- 定义 `referenced_reviews[]` 的字段语义,复用并文档化既有先例:`path`(repo-relative 审查报告路径)、`role`(`origin` | `cross-reference`)、`scope`(`in` | `deferred` | `adjudicated`)、`addresses_findings[]`(本 plan 处理的 finding id)、可选 `deferred_findings[]` / `followup_plan` / `note`。
- 明确**弱校验边界**(Light contract):契约只要求「`role: origin` + `scope: in` 的 reference 带非空 finding id 列表」;明确声明不校验 id 真实存在、不校验覆盖完整性,这些属 LLM 语义判断。
- 明确这是「响亮约定」的机器化:引用角色契约 §4,声明这不是硬 gate,仅防静默断链。
- 列 consumer:`tests/unit/plan-status-taxonomy.test.js`(校验)、`skills/spec-plan`(未来 prose 接入,deferred)。
- 列 schema_version、producer、authority_level、reason_code 约定(对齐 ai-coding-harness.md 的 artifact 元数据要求)。

**Patterns to follow:** `docs/contracts/workflows/spec-id-traceability.md`(姊妹契约:轻量、声明 non-goal、声明 map-not-second-source);`docs/contracts/ai-coding-harness.md` 的边界规则段。

**Test scenarios:** Test expectation: none — 契约文档本身无行为;其规则由 U3 test 兑现。但 U3 的 test 应 import/引用本文档路径作为规则来源声明(注释或常量),避免规则双份。

**Verification:** 契约文档存在;字段语义与现有 `referenced_reviews` 先例(05-07-001 plan)兼容无冲突;明确标注弱校验边界与 non-goal;被 U3 test 引用为单一来源。

---

### U3. plan-status-taxonomy 弱校验 contract test

**Goal:** 加一条弱校验,机器化捕获「plan 引了审查报告却不标 finding id」的静默断链。

**Requirements:** R3, R5。

**Dependencies:** U2(规则来源契约需先定义)。

**Files:**
- `tests/unit/plan-status-taxonomy.test.js`（修改:新增 referenced_reviews 解析 + 一个 describe 块)

**Approach:**
- 新增 helper 解析 `referenced_reviews` 块(YAML 列表带嵌套字段);复用现有 `splitFrontmatter`;因现有 `parseListField` 只处理扁平列表,需新增一个解析嵌套对象列表的小 helper(限定本文件,不外溢)。
- 校验逻辑(弱):遍历所有 `docs/plans/*.md`,对每个含 `referenced_reviews` 的 plan,若某 entry 的 `role == origin` 且 `scope == in` 且 `path` 匹配 `docs/项目审查/.*报告.*\.md`(或更稳的 `docs/项目审查/` 前缀),则该 entry 必须有非空 `addresses_findings`(或非空 `deferred_findings`)。否则报错。
- **legacy 放行(R5):** plan 完全没有 `referenced_reviews` 字段 → 跳过,不报错(与现有 `legacy missing status` 测试同款宽容策略)。
- 在 test 顶部用常量注明规则来源 = `docs/contracts/workflows/review-closure-traceability.md`(单一来源,避免规则双份)。
- 新增 3 个用例:(a) 合法 plan(带 addresses_findings)通过;(b) 引报告但缺 finding id 的合成 plan 报精确错误信息;(c) legacy 无 referenced_reviews 的合成 plan 不 fail。沿用现有「合成 frontmatter 字符串 + 直接调 validate 函数」的测试风格,不写真实文件。

**Patterns to follow:** `tests/unit/plan-status-taxonomy.test.js` 现有三个 test 的结构(遍历真实 plan + 合成字符串单测 + legacy 放行用例);`validatePlanStatusTaxonomy` 的 `errors[]` 收集 + 精确错误信息风格。

**Test scenarios:**
- Covers R3. 合法路径:plan 含 `referenced_reviews` 且 `role:origin/scope:in` entry 带非空 `addresses_findings: ["META-closure-break"]` → 零 error。
- Covers R3. 静默断链:合成 plan 含 `role:origin/scope:in` 指向 `docs/项目审查/X报告.md` 但无 `addresses_findings` 且无 `deferred_findings` → 报错,信息含文件名 + 缺失字段名 + 规则来源契约路径。
- Covers R5. legacy 放行:合成 plan 无 `referenced_reviews` 字段 → 零 error。
- 边界:`scope: deferred` 的 cross-reference entry 带 `deferred_findings` 而无 `addresses_findings` → 零 error(deferred 用 deferred_findings 满足)。
- 边界:`role: cross-reference` 的 entry 无任何 finding id → 零 error(只对 origin/scope:in 强制)。
- 全量回归:对当前 `docs/plans/` 所有真实 plan(含本计划文件)运行遍历用例 → 零 error(本计划 frontmatter 已带 addresses_findings;历史 plan 走 legacy 放行)。

**Verification:** `npx jest tests/unit/plan-status-taxonomy.test.js` 全绿;对现有 30+ plan 零误报;合成断链用例报精确错误;`npm run test:unit` 相关链路绿。

---

## System-Wide Impact

- **双宿主:** 纯 source 治理(docs + test),不触碰 generated runtime mirror,不改 CLI 行为,Claude/Codex 投影无差异。无需 `spec-first init`。
- **CI:** U3 接入的 `plan-status-taxonomy.test.js` 已在 ai-dev-quality-gate CI path trigger 内(06-14-001 plan U3 已接),新校验自动获 CI 覆盖,无需改 workflow yml。
- **downstream consumer:** 新契约 `review-closure-traceability.md` 是新增单一来源;未来 `skills/spec-plan` prose 接入为 deferred follow-up,本批不动。
- **向后兼容:** 历史 plan 走 legacy 放行,无破坏性变更。

---

## Risks & Mitigations

- **风险:弱校验被误读为「闭环已保证」。** 缓解:契约文档 U2 显式声明弱校验边界与 non-goal(不保证覆盖完整性),test 错误信息指向契约;裁决文档 U1 声明自己是 review-evidence。
- **风险:嵌套 YAML 解析 helper 引入脆弱性。** 缓解:helper 限定本测试文件、只解析所需字段、对畸形输入降级为「跳过该 entry」而非崩溃;用例覆盖 legacy/缺字段。
- **风险:正则 `docs/项目审查/.*报告` 匹配过窄或过宽。** 缓解:用 `docs/项目审查/` 前缀 + `role:origin/scope:in` 双条件收敛,而非依赖文件名「报告」字样;用例验证边界。
- **风险:触碰 dirty 工作树无关文件。** 缓解:每切片开头 `git status --short`,只 add in-scope 文件。

---

## Validation Plan

1. U1 后:人工核对 12 P1 全覆盖、三选一无遗漏。
2. U2 后:契约文档与 05-07-001 先例兼容性核对。
3. U3 后:`npx jest tests/unit/plan-status-taxonomy.test.js`;`npm run test:unit`(确认无其他 plan 误报)。
4. 全切片后:`git status --short` 确认只动 in-scope 文件;`CHANGELOG.md` 已按切片同步。

---

## CHANGELOG

每个切片同步 `CHANGELOG.md`,作者读 `~/.spec-first/.developer`。本计划属 source 新增,U1/U2 为治理文档(非用户可见运行行为),U3 为 test 新增;均非 user-visible runtime 行为变化,但属 source 变更必须记录。按仓库现行格式追加,声明「未手改 generated runtime mirrors」。
