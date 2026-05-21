---
spec_id: 2026-05-20-001-fix-spec-work-skill-quality
type: fix
title: 按审查报告 §0/§8 当前执行依据落地 spec-work skill Phase A 质量修复
status: active
created: 2026-05-20
origin: docs/10-prompt/skill-reviews/2026-05-20-spec-work.md
---

# fix: 按审查报告 §0/§8 当前执行依据落地 spec-work skill Phase A 质量修复

## Summary

按 `/spec:doc-review` 综合 reviewer 反馈(spec-feasibility-reviewer / spec-adversarial-document-reviewer / spec-product-lens-reviewer)+ **审查报告 §0/§8 v1 校准吸收**,把 origin 9 项 finding **再次收敛为 Phase A / Phase B 两阶段执行**——避免 6 unit 单 plan 执行触发对抗反例 + 评分焦虑驱动 + 低 ROI 路径风险。

**Execution authority**:本 plan 的下游执行依据是 origin 报告 §0 Current Decision + §1 yaml `summary.minimum_viable_fix_set_ref` + §8 v1 校准吸收。origin 报告 §2-§7 / §6 minimum viable fix set 只作为 historical diagnostics 与对抗风险来源,不得覆盖本 plan 的 Phase A/B scope。

- **Phase A**(本周内,~30-45min work session,**本 plan ship-now scope**):**U4** (Phase 2 编号+Phase 0 边界) + **U1** (examples.json 删第 5 例) + **U2** (SKILL.md 加自指否定声明) + **U7** (SKILL.md 加 light-boundary Execution Boundary 段,§8 v1 校准吸收新增)。**机械修复 + 配套边界声明 + light-boundary 显式 scripts/LLM 分工,零评分目标依赖**
- **Phase B**(defer 到后续 batch review,**不在本 plan ship-now scope**):U3(Key Principles 部分删 + **Cache-Friendly 改名 Context Handoff Layout 而非删除**,§8 校准修订)+ U5(description 改写)+ U6(拆 references)。U6 按 2026-05-21 Codex 0.132.0 调研校准:Codex 支持 skill-level progressive disclosure,但 `references/` 是 as-needed bundled resources,不保证 happy-path 自动加载。与其他 5 核心 skill batch 跑新版 `审查skill.md`(含 Step 1.5)结果一起进入统一治理 plan,杠杆 ≥5x 单 skill 深修

修复目标(Phase A):**消除 examples.json 第 5 例 ownership 文档化缺失 + 显式声明 spec-work 边界(自指否定 U2 + light-boundary U7 两段语义互补) + Phase 编号线性化 + Phase 0 large 路由 task list/task pack 边界划清**。评分变化(fresh review)作为修复方向是否正确的诊断信号,**不作为 merge 条件**(审查报告 §6.5 评分路径已降级为 advisory anecdote,详见 §0)。

---

## Problem Frame

`skills/spec-work/SKILL.md`(512 行)+ `evals/examples.json` + `references/` 经多轮审查发现 3 类真实质量问题:

1. **examples.json 第 5 例 ownership 文档化缺失**(P1-002):4 处 token(`secret-deny-patterns.json` / `batch-owned files` / `expected_side_effects` / `--copy-env`)在 SKILL.md / references 本 skill 内 grep 0 命中,但**全仓 grep**(含 src/cli/contracts/ + 邻近 skill source)可定位 owner(详见审查报告 §8.1 + U1 Approach owner mapping)。fresh-source eval 加载该例时找不到 source owner anchor 会**误判 spec-work 缺失边界 governance**,或反向把已有 CLI/task-pack/delegation safety contracts 当成未实现 drift 删除;**不是 governance 不存在,是 ownership 在邻近 skill 而非 spec-work 私有**
2. **Key Principles 冗余口号 + Cache-Friendly Context Layout 段名误导**(P2-008-dedupe-only):Key Principles 多段口号与 §Workflow Contract Summary + Phase 0/1/2 各步骤重复,可能稀释执行强度;但 Cache-Friendly 段内含 `artifact-summary.v1`、`context-bundle.v1`、work-to-review handoff posture 与 `full_read_triggers` 等 LLM 实际执行指令。§8 校准后当前处理是 Phase B 改名为 `Context Handoff Layout`,**不删除、不迁移到 docs/contracts/skill-design-principles.md**
3. **Phase 2 编号笔误 + Phase 0 large 路由 task list 边界未划清**(P2-005-merged):line 451 与 line 459 同为 step 6;line 119-123 Phase 0 large 路由未限定"build a task list"是否等同于 spec-write-tasks 产出的 task pack

不在本 plan 范围(经对抗审查降级 / 砍 / 重路由):

- P1-001 全量版 + P2-003(25 行 §Evidence And Execution Boundary / Evidence Rules 聚合)→ **降级**:不在 spec-work 私有建第二份 evidence policy source-of-truth;仅保留 §8 校准后的 U7 light-boundary 3-6 行版
- P2-002(拆 references)→ **降级**:reject 矩阵 9 项 + host matrix 4 行表留主文件防 Codex 路径残缺;仅外置 review_gate 流程 line 175-181 与 worktree batch 7 步 line 315-326
- P2-004(§Minimal Examples 内嵌)→ **砍**:Phase 0 复杂度路由表已覆盖,与 examples.json 双锚点维护成本 > onboarding 收益
- P2-006(tracker-defer ownership)→ **重路由**:跨 4 skill 治理问题,交后续 spec-skill-audit batch
- P2-001(description 改写)→ **可选**:本 plan 含 U5 但作为可选 unit,workflow 决定是否执行

---

## Scope Boundaries

### In Scope(Phase A only)

- `skills/spec-work/SKILL.md` 修改:U4(Phase 2 编号 + Phase 0 large 路由 1 行边界)+ U2(加 1 行自指否定声明)+ U7(加 light-boundary Execution Boundary H3 子段)
- `skills/spec-work/evals/examples.json` 修改:U1(删第 5 例)
- CHANGELOG 同步
- 双宿主 runtime regenerate(`spec-first init --claude` + `spec-first init --codex`;Claude runtime mirror 为 `.claude/spec-first/workflows/spec-work/`,Codex runtime mirror 为 `.agents/skills/spec-work/`)
- (deferred follow-up,不阻塞 merge)跑新版 `审查skill.md` fresh review 作为修复方向诊断信号

### Deferred to Phase B(后续 batch review 后统一治理)

- **U3** Key Principles 整体治理 + §Cache-Friendly Context Layout 改名为 `Context Handoff Layout`(保留 Start Fast 语义的结构处理需先解决 cohesion 反例;Cache-Friendly 段内容保留、不迁移)
- **U5** description 改写(12 词简版仍有反例:仍不能完全区分 spec-debug settled scope,需 batch review 后统一 description 模板)
- **U6** 拆 references/task-pack-validation.md + references/subagent-dispatch.md(行号会被 U2/U4 漂移 + shared-directory fallback 段处理边界模糊 + Codex/Claude 的 `references/` happy-path 加载可靠性未验证,defer until happy-path eval)
- **batch review**:对 spec-plan / spec-debug / spec-code-review / spec-write-tasks / spec-compound 5 核心 skill 跑新版 `审查skill.md`(含 Step 1.5),发现跨 skill 系统性 ownership 文档化缺失 / 冗余口号 / 边界笔误,与本 plan Phase B units 一起进统一治理 plan(预期杠杆 ≥5x 单 skill 深修)

### Outside this Plan's Identity

- spec-work-beta 等邻近 skill 修改(P1-002 选项 B 已确认**不推荐**:BETA-edge skill 不接管 stable production 边界 example,见 Decision #1)
- `docs/contracts/skill-design-principles.md` 新建或迁移 Cache-Friendly 内容(§8 已否决:该段是 LLM handoff 指令,Phase B 只改名不迁移)
- `审查agent.md` 同步 Step 1.5 改进(meta-review,独立 plan)
- spec-skill-audit batch 跑 tracker-defer ownership 评估(P2-006 重路由 destination)

---

## Key Technical Decisions

### Decision #1:examples.json 第 5 例处理路径 — **删除并加 SKILL.md 声明**

**Question**:对抗审查推荐"迁移到 owning skill 优先",但第 5 例 4 token 横跨 3 owner(`secret-deny-patterns.json` / `batch-owned files` 是 spec-work-beta;`expected_side_effects` 是 spec-write-tasks task-pack schema;`--copy-env` 是 git-worktree)。不可能只迁移到一个 owner。

**Recommended answer**:**A. 删除该例** + SKILL.md §Workflow Contract Summary 末尾加 1 句自指否定声明(见 U2 改写)。

**Options 与 verdict**:

- **A. 删除该例(推荐)**:复合示例无单一 owner,删除最稳健;符合对抗审查"迁移到 owning skill 优先"原意但实际无单一 owner 可迁
- **B. 迁移到 spec-work-beta**(**不推荐**):spec-work-beta 是 BETA skill(`[BETA]` + "during beta period remain pointed at stable spec-work")。把 production 边界示例迁到 beta 会让 (a) BETA 毕业/撤回时该 example 跟着消失 (b) 4 token 横跨 3 owner 强迫单一接管立刻违反 §6.4 反例 #2。若 user override 选 B,先要求另开 plan 处理 BETA promotion 路径
- **C. 保留 + canonical refs**(对抗审查警告):命运绑死 4 owner 演化

**Source tag**:`advisory`(基于审查报告 §0.1 / §8.1 P1-002 owner mapping + historical §6 对抗反例 + doc-review adversarial AF-002)

**Consequence**:examples.json 从 5 例缩为 4 例(仍满足 contract test 下沿约束:`min length 4` 合法值,测试通过,非危险状态,见 MF-1);U1 Test scenarios 必须含 focused Jest contract test;fresh-source eval 不再被 ownership-anchor 缺失干扰

**Deferred for user confirmation at work time**:若 user 在 work 阶段 override 选 C(canonical refs),U1 实现路径需调整(改 source_note 而非删除),U2 改写文案不变。**选项 B 已显式 rejected,work 阶段若选 B 必须先开新 plan**

### Decision #2:Key Principles 保留哪段?(**Phase B,本 plan 不执行**)

**Phase B 决策**:Decision #2 与 U3 整体 defer 到 Phase B。Phase A 不修改 Key Principles。

理由:对抗审查 AF-005 发现保留 'Start Fast' 1 段后 Key Principles 节呈"H2 + 孤立 1 段 + Common Pitfalls"怪结构,LLM 反而忽略 Start Fast 语义权重。Phase B 与 batch review 一起处理 Key Principles 节整体设计(如降级 Start Fast 为 Common Pitfalls 上方 prose / 整合 H2 为 Common Pitfalls 开篇 lead)。

### Decision #3:references 拆分粒度?(**Phase B,本 plan 不执行**)

**Phase B 决策**:U6 整体 defer。Phase A 不拆 references。

理由:对抗审查 AF-001 发现 line 号会被 U2/U4 漂移;feasibility F-001 发现 U6 修改范围未覆盖 shared-directory fallback 区段(line 301-305 / 327-333);product F-004 发现 happy-path LLM 是否主动 read references 未验证。2026-05-21 Codex 0.132.0 调研进一步校准:官方 Codex skills docs 只保证 skill discovery 阶段加载 `name` / `description` / `path`,触发后读取完整 `SKILL.md`;`references/` 属于 bundled resources,由 Codex as-needed 读取,不是 host 强制 happy-path 自动加载层。Phase B 前必须:(a) 跑 happy-path fresh-source eval 验证 LLM 实际加载行为 (b) U6 Approach 改用 anchor-text 定位而非 line 号 (c) 显式声明 shared-directory 段处理。

### Decision #4:description 是否改写?(**Phase B,本 plan 不执行**)

**Phase B 决策**:U5 整体 defer。Phase A 不改 description。

理由:对抗审查 OS-003 发现 12 词版仍不能区分 spec-debug 的 settled scope("bug repro 是一种 settled scope");12 词版还与 SKILL.md line 19 "validated task pack, settled plan, spec path, or concrete implementation request" 不一致(漏掉后两项)。Phase B 与 batch review 一起统一 description 模板,跨 5 核心 skill 对齐。

### Decision #5:**Phase A / Phase B 拆分原则**(re-scope 新决策)

**Question**:doc-review product reviewer 建议 re-scope。本 plan 接受还是拒绝?

**Recommended answer**:**接受 re-scope + §8 校准吸收**——Phase A 必修零风险机械修复与轻量边界修复(U4+U1+U2+U7),Phase B defer U3/U5/U6 到 batch review 后统一治理。

**Source tag**:`user`(用户在 doc-review routing question 显式选择 "Re-scope 为 Phase A/B (推荐)")

**Consequence**:
- 本 plan ship-now scope 缩减为 4 unit(U4/U1/U2/U7),work session 估算从 1plan+1work 收敛到 ~30-45min work
- U3/U5/U6 移到 Phase B Deferred,与后续 5 核心 skill batch review 一起规划
- fresh review 不再作为本 plan 完成条件(Phase A 修复后预期评分变化是诊断信号)
- opportunity cost 重新平衡:Phase A 解决最高优先级真实缺陷(ownership 文档化缺失 + 编号错位 + 边界声明 + light-boundary 显式分工),Phase B 留待 batch review 提供跨 skill 系统证据后统一动手

**理由**:product reviewer 指出 0 真实 user pain 证据,1 plan + 1 work 精力可改为 batch 跑新版 `审查skill.md`(含 Step 1.5)对 5 核心 skill 一次扫描,杠杆 ≥5x 单 skill 深修。Phase A 仅保留无可争议的机械修复 + 高优先 ownership-anchor 修复 + §8 新增 light-boundary。

---

## Implementation Units

### U1. examples.json 第 5 例处理(必修)

**Goal**:消除 fresh-source eval 加载 examples.json 第 5 例时找不到 owner anchor 的误报路径(审查报告 §8.1 校准:owner 真实存在于邻近 skill / contract,不是 governance 已废弃,而是 ownership 文档化缺失)

**Requirements**:审查报告 §0.1 / §8.1 P1-002-revised;Decision #1

**Dependencies**:无

**Files**(repo-relative):

- `skills/spec-work/evals/examples.json`(修改:删除 line 54-66 第 5 例 'secrets and staging require high-risk boundary'

**Approach**:
- 直接删除 examples 数组中第 5 个 object(下标 4)
- 保留 1-4 例(都已通过审查 §5.5 一致性检查;第 1 例 context_snippets 含 `expected_side_effects` 由 U2 加的声明配合解决——参见报告 §0.1 / §8.1 P1-002 校准)
- 不需修改 schema_version / skill / examples 数组 framing

**Owner mapping(v1 §5 校准 + 审查报告 §8.2)** — work 阶段 user 若 override 选 Decision #1 选项 C(保留 + canonical refs),按以下 owner refs 改 source_note:

| Token | Owner 路径 | 用途 |
|---|---|---|
| `expected_side_effects` | `skills/spec-write-tasks/references/task-pack-schema.md:152/164/192` | task-pack quality/delegation field 定义 |
| `batch-owned files` | `skills/spec-work-beta/references/codex-delegation-workflow.md:341/345/347` | batch-owned set + expected_side_effects staging check |
| `secret-deny-patterns.json` | `src/cli/contracts/security/secret-deny-patterns.json`(配合 `spec-work-beta/references/codex-delegation-workflow.md:353` deny 应用规则) | staging 前 deny patterns 应用 |
| `--copy-env` | `skills/git-worktree/SKILL.md:12/22/28` | worktree env copy opt-in 与 staging deny |
| `thin high-risk contract` 总章 | `docs/contracts/workflows/skill-agent-quality-governance.md:32-45` | high-risk execution safety contract(声明不是 runtime state machine) |

**审查报告校准**(§8.1):v0 评估 "local bundle grep 0 命中" 是范围错误(只扫 `skills/spec-work/`)。全仓 grep(含 src/cli/contracts/ + 邻近 skill source)证明 owner 真实存在,**不是 governance 已废弃**——是 ownership 文档化在邻近 skill 而非 spec-work 私有。删除第 5 例是因 spec-work 不实现 staging/security engine,边界由 owner skill 维护;不是因 owner 不存在。

**Test scenarios**:
- 正例:`jq '.examples | length' skills/spec-work/evals/examples.json` 应输出 4
- 边缘:`jq '.examples[].name' skills/spec-work/evals/examples.json` 不应含 "secrets and staging require high-risk boundary"
- 反向 grep:`grep -rn "secret-deny-patterns\|batch-owned files\|--copy-env" skills/spec-work/` 应 0 命中(配合 U2 SKILL.md 加的声明)
- JSON 合法性:`python3 -m json.tool skills/spec-work/evals/examples.json > /dev/null` 应 exit 0
- **contract 测试**(MF-1):`npm run test:jest -- tests/unit/prompt-examples-contracts.test.js --runInBand` 应通过(验证 examples 数组 `min length 4` 下沿约束;删第 5 例后 4 例正好命中下沿)

**Verification**:examples.json 4 例结构完整;fresh-source eval(若运行)不再读取第 5 例 ownership-anchor 缺失引用;contract test 通过

---

### U2. SKILL.md 加自指否定声明 spec-work 不实现 staging/security engine(必修)

**Goal**:配合 U1,在 SKILL.md 明确边界,避免下游 reviewer 误判 spec-work 缺失 high-risk boundary governance

**Requirements**:审查报告 §0.1 / §8.1 P1-002-revised added 字段;Decision #1;doc-review HF-3(adversarial AF-003 + product F-003 共识)

**Dependencies**:**U1**(语义上配套——先删示例再加声明,顺序可逆但逻辑上配对)

**Files**(repo-relative):

- `skills/spec-work/SKILL.md`(修改:§Workflow Contract Summary 末尾 / §Downstream Consumers 之前,line 47 附近加 1 行)

**Approach**:

按 doc-review HF-3 修订——**改写为自指否定句,去掉具体邻居 skill 名列表 + 4 类边界枚举**,避免成为新的 cross-skill owner anchor drift(§6.4 反例 #1 轻量版触发风险):

- 在 §Workflow Contract Summary 段最后追加 1 行:
  ```
  > Note: spec-work executes high-risk units by following contracts owned by adjacent skills; it does not maintain its own staging or security engine source.
  ```
- **不写** "(spec-work-beta, spec-write-tasks, git-worktree)" 邻居 skill 名列表
- **不写** "secret handling / batch staging / env copy / side-effect declaration" 4 类边界枚举
- 位置选 §Workflow Contract Summary 末尾(line 47 之后)而非 §Downstream Consumers 之前,使其作为契约段的边界声明
- 不引入新章节标题(避免新增 anchor)

**Patterns to follow**:仿 line 23 §When Not To Use 显式禁止表述的语气(`do not use for ... runtime mirror edits.`);采用自指否定(`does not maintain its own ...`)而非他指肯定(`is owned by X / Y / Z`)

**HF-3 修复理由**:原方案的"owned by adjacent skills (spec-work-beta, spec-write-tasks, git-worktree)" 包含 3 个邻居 skill 名 + 4 类边界类型,本身就是 evidence/governance policy anchor。邻居 skill rename / split / merge 时,这句声明会变成新的 owner-anchor drift,重演 examples.json 第 5 例 ownership 文档化缺失模式(只是从 evals 换到 SKILL.md)。改写为自指否定句后,语义清晰但不依赖外部 owner 命名稳定性。

**Test scenarios**:
- 正例:`grep -n "does not maintain its own" skills/spec-work/SKILL.md` 应命中 1 行
- 反例(HF-3):`grep -c "spec-work-beta\|spec-write-tasks\|git-worktree" skills/spec-work/SKILL.md` 在 U2 修改后**不应新增命中**(若原文已含 spec-work-beta 引用则不变)
- 反例:不应新增 ## 章节(grep `^## ` 行数应保持不变)

**Verification**:SKILL.md 加 1 行后行数变化 +1;新增声明出现在 §Downstream Consumers 之前;Examples As Context 段不受影响;不引入新的 cross-skill owner anchor

---

### U3. 删除 Key Principles 4 段 + Cache-Friendly Context Layout 改名(**Phase B,defer**)

**Phase B 状态**:本 plan 不执行。defer 到 batch review 后统一治理 plan(详见 §Scope Boundaries `Deferred to Phase B`)。

**Phase B Approach(按审查报告 §8 v1 校准修订)**:

- **Key Principles**:删 4 段(`The Plan is Your Guide` / `Test As You Go` / `Quality is Built In` / `Ship Complete Features`)+ 保留 `Start Fast, Execute Faster` 1 段(latency posture hint,Common Pitfalls `Analysis paralysis` 一起对抗 over-cautious)
- **Cache-Friendly Context Layout(v1 校准)**:**改名为 `Context Handoff Layout`,不删除整段**——v1 sanity check(`sed -n '77,80p'`)确认段内含 `artifact-summary.v1` + `context-bundle.v1` + work-to-review handoff posture + `full_read_triggers` 等 LLM 实际遵循的 handoff 契约引用,**非纯元描述**。改名让段名匹配段内 handoff 指令性质(`Cache-Friendly` 易被 LLM 误读为维护者设计原则,导致段内 handoff 契约被忽略;`Context Handoff Layout` 表达更精准)
- **删除 docs/contracts/skill-design-principles.md 迁移**:原 plan 提议把 Cache-Friendly 迁移到该文件——v1 校准否决,因为段内是 LLM 执行指令而非维护者原则,不应迁离 SKILL.md

**Defer 理由**(综合 doc-review AF-005 + MF-2 + §8 校准):
- AF-005:保留 'Start Fast' 1 段后 Key Principles 节呈"H2 + 孤立 1 段 + Common Pitfalls"怪结构
- MF-2:LLM 反而忽略 Start Fast 语义权重
- §8 校准:Cache-Friendly 必须改名而非删除,处理路径较精细

Phase B 需先评估替代设计:(a) Start Fast 降级为 Common Pitfalls 上方 prose 1 行 (b) H2 "Key Principles" 整合为 Common Pitfalls 开篇 lead (c) 直接全删 H2 标题保留 Common Pitfalls;**Cache-Friendly 改名 Context Handoff Layout 在所有 (a)/(b)/(c) 路径下都执行**。Decision #2 推迟到 batch review 后基于跨 skill 模式做决定。

---

### U4. Phase 2 编号修正 + Phase 0 large 路由 1 行补丁(必修)

**Goal**:消除 Phase 2 step 6 重复(line 451 与 line 459 同号);防止 Phase 0 large 路由在 user 拒绝 brainstorm/plan 时让 spec-work 二次发明 task pack

**Requirements**:审查报告 §0.1 `P2-005-merged` + `P2-007-one-line`

**Dependencies**:无。U3 已 defer 到 Phase B;U4 执行时用 anchor-text / 当前段落标题定位,不依赖 historical line 号。

**Files**(repo-relative):

- `skills/spec-work/SKILL.md`(修改:Phase 2 子步骤编号 + Phase 0 large 路由表后追加 1 行)

**Approach**:

1. **Phase 2 子步骤重新编号**(currently 1 Task Execution Loop / 2 Incremental Commits / 3 Follow Existing Patterns / 4 Test Continuously / 5 Simplify as You Go / **6 Figma Design Sync** / **6 Track Progress**):
   - 把第二个 "6. Track Progress" 改为 "7. Track Progress"
   - Phase 2 最终顺序:1-7 连续无重复

2. **Phase 0 large 路由补丁**(Phase 0 路由表格之后，*不*在 cell 内追加):
   - **[行为边界变更，非机械修复]** 在 Phase 0 routing 表格(line 119-123)之后，空一行，追加独立 blockquote：`> 若用户拒绝走 brainstorm/plan,Phase 1 step 3 task list 仅作为 in-session task list(not persisted as task pack);若复杂度 mid-execution 越过阈值,使用 User-Facing Handoff Contract 升级到 spec-plan / spec-write-tasks`
   - **[Markdown 约束]** GFM/CommonMark 管道表格 cell 不支持 block 元素（blockquote `>`）；cell 内追加会产生字面字符而非结构。**仅使用"表格后追加独立 blockquote"路径**，不要追加到 cell 内。表格后追加的声明语义上适用于"任何复杂度下用户拒绝 brainstorm/plan 的场景"，这在当前语境中成立：Large 路由是唯一需要此声明的路径，Trivial/Small 路由不涉及 brainstorm/plan 推荐。
   - **LF-3 修订**:术语用 `in-session task list (not persisted as task pack)` 而非新发明的 `in-session 执行索引`——前者复用 SKILL.md 已有 task list 与 task pack 两个既有概念的对比，通过 `(not persisted as task pack)` 子句划清边界；后者全仓 grep 0 命中

**Patterns to follow**:仿 line 132 `Do not describe task compilation as a command-backed workflow entrypoint` 的边界声明风格

**Test scenarios**:
- 正例:`grep -n "^7. \*\*Track Progress\*\*" skills/spec-work/SKILL.md` 应命中 1 行
- 反例:Phase 2 段内不应有 2 个 `^6. \*\*` 起始行(`awk '/^## Execution Workflow$/,/^## Key Principles$/' skills/spec-work/SKILL.md | grep -c "^6\. \*\*"` 应输出 1)
- 正例:`grep -n "in-session task list (not persisted as task pack)" skills/spec-work/SKILL.md` 应命中 1 行
- 表格结构完整性:`awk '/^### Phase 0/,/^### Phase 1/' skills/spec-work/SKILL.md | grep "^|" | wc -l` 应仍为 5（表头+分隔行+3 数据行；blockquote 在表格后，不干扰表格行数）

**Verification**:Phase 2 子步骤顺序读起来线性 1-7;Phase 0 large 路由表后有显式 task list / task pack 边界声明;routing 表格行数不变

---

### U5. description 12 词简版改写(**Phase B,defer**)

**Phase B 状态**:本 plan 不执行。defer 到 batch review 后统一 description 模板。

**Defer 理由**(doc-review OS-003):12 词版仍不能区分 spec-debug 的 settled scope("bug repro 是 settled");与 SKILL.md line 19 "validated task pack, settled plan, spec path, or concrete implementation request" 不一致(漏掉后两项)。Phase B 与其他 5 核心 skill description 一起,统一 spec-first description 模板(`<动词 + 输入类型 + scope guard + 排除边界>` 四段式),跨 skill 对齐 routing signal 后再改。Decision #4 推迟。

### U6. 拆出 references/task-pack-validation.md + references/subagent-dispatch.md(**Phase B,defer**)

**Phase B 状态**:本 plan 不执行。defer until happy-path fresh-source eval 验证。

**Defer 理由**(doc-review HF-1 + AF-001 + F-001 + F-004):

- **行号会被 U2/U4 漂移**:本 plan U2(+1)/ U4(编号改)修改后 line 175-181 + 286-326 实际位置变化。U6 Approach 必须改为 anchor-text 定位(grep `review_gate: required` / `worktree-isolated mode`)而非 line 号,但本 plan 无此修订
- **shared-directory fallback 边界模糊**:line 301-305 + 327-333 同样属于 fallback 段,只外置 315-326 会让主文件 Phase 1 Step 4 出现"删了 worktree-isolated 段、保留 shared-directory 段"非对称结构。U6 Approach 未声明这两段处理
- **happy-path LLM 行为未验证(2026-05-21 Codex 调研校准)**:Codex 0.132.0 支持 skill-level progressive disclosure(`name` / `description` / `path` 常驻,触发后加载 `SKILL.md`),但官方 docs 与本地 skill-creator 都把 `references/` 定义为 as-needed bundled resources,不保证 happy-path 自动加载。Claude/Codex 都不能把 `references/` 拆分当成 host 强制 gate;U6 若拆,主文件必须保留 mandatory load trigger,并用 fresh-source eval 证明执行前会读对应 reference。
- **trajectory risk**:U6 后 spec-work 从"主文件单点"变"主文件指针 + references 双点",引入 path dependency。与 plan 主目标"消除两份口号稀释"自相矛盾(U3 删两份,U6 反向引入两份契约)

Phase B 前必须:(a) 完成 1 次 happy-path fresh-source eval 验证 LLM 实际加载行为,覆盖 validated task pack 与 subagent dispatch 两条正向路径 (b) U6 Approach 改用 anchor-text 定位 (c) 显式声明 shared-directory 段处理 (d) 评估 lint:skill-entrypoints 兼容性(LF-2)。Decision #3 推迟。

---

### U7. SKILL.md 加 light-boundary Execution Boundary 段(**Phase A 必修,§8 v1 校准吸收新增**)

**Goal**:补 §Workflow Contract Summary 之后的 3-6 行 light-boundary Execution Boundary 段,显式声明 scripts/tools vs LLM 决策边界。**不引入 25 行大段私有 policy / 不含邻居 skill 名(避免触发对抗反例 AF-003 cross-skill anchor 残余风险)**

**Requirements**:审查报告 §0.1 must_fix `P1-001-light-boundary`;§8.2 校准——v0 把 P1-001 全降级是过度反应,light-boundary 3-6 行版不触发对抗反例;Decision #5 Phase A re-scope 后,P1-001-light-boundary 应进 Phase A 而非 defer

**Dependencies**:**U2**（语义配套）。**位置顺序（明确）**：U2 prose 先，U7 H3 段后。最终目标 diff 结构如下：
```
### Downstream Consumers
...existing content...
> Note: spec-work executes high-risk units ...   ← U2 新增（blockquote prose）
### Execution Boundary                            ← U7 新增（H3 标题）
                                                  ← U7 新增（空行）
`spec-work` orchestrates execution ...            ← U7 新增（3 行 prose）
...
## Examples As Context
```
U2 是 §Workflow Contract Summary 末尾的"不做什么"声明；U7 是紧随的 H3 子段说明"做什么 + 谁决策"。两段语义互补，顺序不可逆（否则 H3 标题前跟 prose 结构更合理）。

**Files**(repo-relative):
- `skills/spec-work/SKILL.md`(修改:§Workflow Contract Summary 末尾后,§Examples As Context 之前,加 ~5 行 H3 子段)

**Approach**:按审查报告 §0.1 / §8.2 的 P1-001-light-boundary 校准——加 3-6 行轻量 Execution Boundary 段:

```markdown
### Execution Boundary

`spec-work` orchestrates execution; it does not own deterministic validators or provider refresh.
Tools/CLI/git provide task-pack validation, diff/branch facts, test results, and optional run artifact writes.
The LLM decides scope fit, task ordering, review depth, handoff, and whether advisory evidence is sufficient to proceed.
```

**严格约束**:
- **3 行 prose,~50 词**,严格控制在 light-boundary 区间
- **不含具体邻居 skill 名**(spec-work-beta / spec-write-tasks / git-worktree)——避免 §6.4 对抗反例 #1 cross-skill anchor 触发(与 U2 修订风险声明 6 一致)
- **不复制项目角色契约**(`docs/10-prompt/结构化项目角色契约.md`)——只声明 spec-work 自身边界
- **位置 H3 子标题**(`###`),作为 §Workflow Contract Summary 的子段,而非新建 H2(避免新增 anchor 段)
- 与 U2 语义互补,不重复——U2 是"不做什么"(does not implement),U7 是"做什么 + 谁决策"(orchestrates + LLM decides)

**Patterns to follow**:仿 §When Not To Use 显式声明语气(line 23);仿 §Workflow Contract Summary 已有 H3 子段结构(line 17-47);保持 light contract 原则

**Test scenarios**:
- 正例:`grep -n "^### Execution Boundary" skills/spec-work/SKILL.md` 应命中 1 行
- 正例:`grep -n "orchestrates execution\|LLM decides scope fit" skills/spec-work/SKILL.md` 应各命中 1 行
- 反例(对抗反例 #1 防护):`grep -A 6 "### Execution Boundary" skills/spec-work/SKILL.md | grep -c "spec-work-beta\|spec-write-tasks\|git-worktree"` 应输出 0(段内不含邻居 skill 名)
- 体积:Execution Boundary 段 prose 不超过 6 行(`awk '/^### Execution Boundary/,/^###|^##/' skills/spec-work/SKILL.md | head -7` 输出应 ≤ 7 行)
- 不引入新 H2:`grep -c "^## " skills/spec-work/SKILL.md` 在 U7 前后应保持相同数(只新增 H3)

**Verification**:
- 段标题 `### Execution Boundary` 出现在 §Workflow Contract Summary 与 §Examples As Context 之间
- 段内容含 scripts/tools 与 LLM 分工声明
- 不引入新 H2 anchor
- 不含 25 行大段 / 不含邻居 skill 名 / 不复制角色契约
- 与 U2 自指否定句语义不重复

---

## Sequencing

### Phase A(本 plan ship-now scope)

```
U4 (Phase 2 编号 + Phase 0 边界) [无依赖,先做,避免后续 U1/U2/U7 改动后还要重新算 U4 行号]
  ↓
U1 (examples.json 删第 5 例) [无依赖,修改 examples.json 不影响 SKILL.md 行号]
  ↓
U2 (SKILL.md 加自指否定声明) [配套 U1,在 §Workflow Contract Summary 末尾加 1 行]
  ↓
U7 (SKILL.md 加 light-boundary Execution Boundary H3 段) [§8 v1 校准吸收新增,配套 U2 但语义互补]
```

**推荐执行顺序**:U4 → U1 → U2 → U7

- U4 先做(改 Phase 2 编号 + 加 Phase 0 1 行,SKILL.md 行号变化 +1)
- U1 / U2 配套(顺序可逆但配对——U1 删 examples 第 5 例,U2 加自指否定声明)
- U7 紧随 U2(在 §Workflow Contract Summary 末尾加 H3 子段;U2 是末尾 prose,U7 是 H3 子标题,位置不冲突)
- U1 / U2 / U7 不依赖 U4 的行号稳定(它们改的是 frontmatter / Workflow Contract Summary / examples.json,不涉及 Phase 2 / Phase 0 段)。**U4 先做是建议而非硬依赖**:U1/U2/U7 均以段落标题定位(非行号),乱序执行技术上可行;先做 U4 只是降低施工者同时追踪多份行号漂移的心理负担。
- 总工作量:~30-45min(U7 是 ~5min 增量,3-6 行 prose)

**重要(LF-1)**:本 plan 所有 line N 均为参考;实际定位以 § 标题 / ### 子标题 grep 为准。U1-U7 行号偏差 ±1~2 是预期(SKILL.md 当前 512 行,任何修改都会让后续 unit 引用的 line 号漂移)。

### Phase B(defer,不在本 plan)

```
[batch review on spec-plan / spec-debug / spec-code-review / spec-write-tasks / spec-compound]
  ↓
[统一治理 plan,含本 plan 的 U3 / U5 / U6 + batch review 发现的跨 skill 系统性 ownership 文档化缺失 / 冗余口号 / 引用漂移]
```

Phase B 前提:
- happy-path fresh-source eval 验证 LLM 实际加载 references 行为(决定 U6 是否还做);Codex 0.132.0 仅证明 skill-level progressive disclosure,不能替代 `references/` 加载可靠性验证
- 5 核心 skill batch review 完成,提供跨 skill 统一 description 模板(决定 U5 12 词版是否够)
- Key Principles 节替代设计已评估(决定 U3 保留 / 删除 / 整合策略)

---

## Verification

每个 unit 完成后:

1. 跑该 unit Test scenarios 节列出的 grep / jq / awk / test 命令
2. 跑项目级验证:
   - `npm run typecheck`(语法检查)
   - `npm run lint:skill-entrypoints`(skill 入口治理)
   - `npm run test:smoke`(若涉及 init / doctor 命令——本 plan 涉及 runtime regenerate)
   - **`npm run test:jest -- tests/unit/prompt-examples-contracts.test.js --runInBand`**(MF-1:验证 examples 数组 min length 4 下沿约束)

所有 Phase A unit 完成后:

3. 双宿主 runtime regenerate:
   - `spec-first init --claude`(刷新 `.claude/spec-first/workflows/spec-work/`)
   - `spec-first init --codex`(刷新 `.agents/skills/spec-work/`)
   - `spec-first doctor --claude` + `spec-first doctor --codex` 验证 runtime 一致
4. CHANGELOG 同步(每个 unit 完成后追加,或全部完成后一次性追加)
5. **Fresh review(advisory follow-up,不阻塞 merge)**:跑新版 `审查skill.md`(含 Step 1.5 grep verification)对修复后 spec-work 做 fresh review。**这是修复方向是否正确的诊断信号,不作为 merge 条件**(MF-3:原 §6.5 起点 81 / 修复后预期变化区间作为 advisory 信息,不强制达标分数)

---

## Rollback Procedure(HF-4)

Phase A 落地后若 fresh review 落点低于预期(例如 < 80,advisory 信号),或 work 阶段发现实际 LLM 行为偏离:

| 触发条件 | 回滚动作 |
|---|---|
| **user 主动请求回滚** + fresh review 后有具体 cross-skill anchor grep 命中证据（`grep -A 6 "### Execution Boundary" ... \| grep -c "spec-work-beta\|..."` 输出 > 0）且诊断为 U7 light-boundary 段触发 | 回滚 U7 单元:删除 §Workflow Contract Summary 后的 §Execution Boundary H3 段;保留 U2 自指否定句;U1/U4 不回滚 |
| **user 主动请求回滚** + 有具体证据诊断为 U2 声明触发 cross-skill owner anchor drift | 回滚 U2 单元:删除自指否定句;保留 U7(light-boundary 段语义独立);U1/U4 不回滚 |
| **user 主动请求回滚** + 有具体证据诊断为多 unit 互相干扰 | 同时回滚 U2 + U7(保留 U1 + U4)。U1 回滚需重新添加 examples.json 第 5 例(从 git history `git show HEAD~N:skills/spec-work/evals/examples.json` 恢复) |
| U1 / U4 任何情况 | **不回滚** — examples.json 第 5 例删除 + Phase 编号修正都是零风险机械改动 |
| 全 plan 回滚 | `git revert <commit>` + 重跑 `spec-first init --claude` + `spec-first init --codex` + CHANGELOG 追加 revert 记录 |

**回滚成本预估**:
- U7 单独回滚:~3min(单 commit revert + runtime regen)
- U2 单独回滚:~5min(单 commit revert + runtime regen)
- U2 + U7 回滚:~8min(2 commit revert + runtime regen)
- U1 + U2 + U7 回滚:~12min(3 commit revert + examples.json 恢复 + runtime regen)
- 全 plan 回滚:~15min(4 commit revert + 2 host runtime regen + CHANGELOG)

**Rollback 不需要 user 重新批准**:Phase A unit 都是 source-only 局部修改,无 contract / schema / runtime breaking。若 user 在 advisory 信号后选择回滚,plan owner 可直接执行。

---

## Risks

### 风险 1:U6 拆分质量不达预期(**Phase B,不在本 plan 风险**)

Phase B 预期 risk;Phase A 不执行 U6。

### 风险 2:U3 删除 Key Principles 后 LLM ship-bias 校准失效(**Phase B,不在本 plan 风险**)

Phase B 预期 risk;Phase A 不执行 U3。

### 风险 3:U1 删除第 5 例后,fresh-source eval 覆盖度下降

**Source**:examples.json 从 5 例缩为 4 例(命中 contract test `min length 4` 下沿);若 high-risk boundary 是真实重要 capability,删除会让 fresh-source eval 缺少该维度覆盖

**Mitigation**:Decision #1 已声明这些边界是邻近 skill 责任(spec-work-beta / spec-write-tasks / git-worktree);U2 加自指否定声明(本 plan 修订版,去掉邻居名)在该路径下成立;contract test 验证下沿不触发(MF-1 已加入 Test scenarios)

### 风险 4:双宿主 runtime regenerate 出现 drift

**Source**:U1/U2/U4/U7 都修改 source,runtime mirror 必须同步;若 `spec-first init --codex` 与 `--claude` 之间 drift,fresh review 可能在某一侧失败

**Mitigation**:Verification 步骤显式包含双宿主 init + doctor;若发现 drift,先 `spec-first doctor` 诊断再决定是否 `spec-first clean` 后重新 init;Rollback Procedure 含 runtime regen 步骤。**init 命令本身失败路径**：若 `spec-first init --claude` 或 `--codex` exit ≠ 0，不继续执行另一侧 init，先排查原因（developer profile 缺失、路径权限）；两个 init 必须都 exit 0 后才执行 doctor 验证，否则不 merge

### 风险 5:Decision #1 user 在 work 阶段 override 选项 C(canonical refs)

**Source**:Open Questions Q1;选项 B 已 rejected,但 C 仍可能被 user 选

**Mitigation**:U1 实现路径需调整(改 source_note 而非删除);U2 不变(自指否定句在所有路径下都成立);contract test 不再触发 min length 下沿。work 阶段开始 U1 前显式与 user 确认

### 风险 6(MF-5/AF-003):U2 自指否定声明 + U7 light-boundary 仍可能反向触发 §6.4 反例 #1 轻量版

**Source**:doc-review adversarial AF-003 + product F-003 共识;原 U2 文案因含 3 邻居 skill 名 + 4 边界类型,触发 evidence policy anchor 风险。本 plan HF-3 修订改为自指否定句,理论上消除该风险;新增 U7 light-boundary 同样严格控制(不含邻居名)

**Mitigation**:
- **U2** 严格按修订文案执行:`spec-work executes high-risk units by following contracts owned by adjacent skills; it does not maintain its own staging or security engine source.`(不写邻居 skill 名)
- **U7** 严格按 light-boundary 模板执行:`spec-work orchestrates execution; it does not own deterministic validators or provider refresh. Tools/CLI/git provide ... The LLM decides ...`(不含邻居 skill 名,3 行 prose)
- Test scenarios 已加反向 grep(U2 不新增 `spec-work-beta` / `spec-write-tasks` / `git-worktree` 命中;U7 段内同样不含)
- 若 fresh review 后发现两段仍触发反例,Rollback Procedure 含单独回滚 U2 / U7 路径

### 风险 7:本 plan 仅修复 spec-work 表面缺陷,未触发 product reviewer 建议的 batch review

**Source**:doc-review product F-005(opportunity cost):本 plan 1 work session 精力 vs batch 跑新版 `审查skill.md` 对 5 核心 skill 杠杆 ≥5x

**Mitigation**:Decision #5 已接受 re-scope 为 Phase A/B,U3/U5/U6 推到 Phase B 与 batch review 一起处理。Phase A 完成后,立即启动 batch review 作为 follow-up plan(不在本 plan ship-now scope,但在 §Scope Boundaries Deferred to Phase B 已声明)

---

## Open Questions

### Q1:Decision #1 选项最终确认(defer to work)

**Question**:U1 实际执行时,是按 Decision #1 推荐的"A. 删除"做,还是 user override 选"C. canonical refs"?(**选项 B 已 rejected**——见 Decision #1 / HF-2)

**Resolve approach**:work 阶段开始 U1 前显式与 user 确认("默认执行 Decision #1 选项 A 删除路径，是否切换到选项 C canonical refs？")。**默认值为 A（删除）**；若 user 不可用或回答模糊，executor 应等待而非自行决定，因 U1 执行后 "U1/U4 不回滚" 规则生效，路径一旦选定不可逆（需全 plan 回滚）。

**Affect scope if changed**:U1 修改范围（改 source_note 而非删除）;U2 不变;若选 C,contract test min length 4 下沿不触发（examples 仍为 5 例）

### Q2:Cache-Friendly Context Layout 改名落点(**Phase B,defer**)

**Question**:Phase B 执行 U3 时,`Cache-Friendly Context Layout` 改名为 `Context Handoff Layout` 后是否需要同步调整邻近引用、目录或 reviewer prompt 示例?

**Resolve approach**:**defer to Phase B**(本 plan 不执行 U3);Cache-Friendly 段内容已确认为 LLM handoff 指令,不删除、不迁移到 `docs/contracts/skill-design-principles.md`

### Q3:Phase B 启动时机(defer to batch review 后)

**Question**:Phase B 何时启动?是否在 Phase A merge 后立即启动 batch review,还是等其他 follow-up?

**Resolve approach**:**defer to Phase A 完成后**——基于 Phase A fresh review 实际落点 + product reviewer 推荐的 batch review 优先级,在新 plan 决策。本 plan 不预设 Phase B 启动时间

### Q4(MF-4):U6 happy-path fresh-source eval 验证设计(**Phase B 前置**)

**Question**:Phase B 启动前,如何设计 happy-path fresh-source eval 验证 LLM 实际是否主动 read references?

**Resolve approach**:**defer to Phase B 前置任务**——按 2026-05-21 Codex 0.132.0 调研,验证目标应改为"主 `SKILL.md` 的 mandatory load trigger 是否足够驱动 LLM 读取 references",而不是验证 Codex 是否存在 progressive disclosure。可能路径:(a) 跑一个已验证 task pack 通过 fresh-source spec-work,观察编辑前是否读取 `references/task-pack-validation.md` (b) 跑一个需要 subagent dispatch 的 plan,观察派发前是否读取 `references/subagent-dispatch.md` (c) 在 evals/examples.json 加 1 个专门测 reference 加载的 example。本 plan 不解决

---

## Deferred to Implementation

- 具体 §Cache-Friendly Context Layout 段落的精确 line 边界(Phase B 时按 git blame 确认)
- U2 新增的 1 行声明放在 §Workflow Contract Summary 末尾后的精确锚点(以 work 时实际 git diff 为准,但 anchor-text 是 `## Examples As Context` 之前)
- U4 'in-session task list (not persisted as task pack)' 短语与 SKILL.md line 132 'Do not describe task compilation as a command-backed workflow entrypoint' 在最终 prose 中的衔接方式(以可读性为准)

---

## Test Expectation

- U1:5 个验证命令(jq/grep/python + contract test)
- U2:3 个 grep 命令(正例 + 反例 HF-3 + 新章节不变)
- U4:3 个 grep / awk
- **U7:5 个验证命令**(正例 H3 标题 + 段内核心词 + 反例 cross-skill 名 + 体积上限 + 不引入新 H2)

无新增 unit / integration / e2e test 文件——本 plan 修改的是 markdown skill source + JSON examples,验证主要靠 grep / jq / structural check + 双宿主 init + doctor + (advisory follow-up) fresh review

---

## Context & Research

**Origin**(see origin: `docs/10-prompt/skill-reviews/2026-05-20-spec-work.md`):

- §1 dimension_scores:12 维(7 pass / 4 partial / 1 fail)
- §0 Current Decision + §1 yaml `summary.minimum_viable_fix_set_ref` + §8 v1 校准吸收:下游执行唯一依据
- §6 对抗审查综合 / §6.4 5 个对抗反例触发条件:historical diagnostics,仅作为风险来源
- §6.5 复审路径预测表:已降级为 session-local advisory anecdote,不作为 merge gate
- §7 Reviewer Prompt Self-Reflection

**Doc-review iteration**(本 plan 经 `/spec:doc-review` 二次收敛):

- spec-feasibility-reviewer 4 findings(F-001 ~ F-004):U6 边界 / contract test 约束 / 行号偏差 / lint 兼容
- spec-adversarial-document-reviewer 5 high-risk + 3 overrated + 3 unstated + conditional verdict:U6 line drift / Decision #1 B reject / U2 cross-skill anchor / rollback gap / Key Principles cohesion
- spec-product-lens-reviewer 6 findings + judgment=re-scope:Goal vs Verification / user pain 证据缺失 / identity contraction / trajectory / opportunity cost / roadmap anchor
- 2 reviewer dispatch 失败(coherence 429 rate limit / scope-guardian 1m context 配置错误)——记入 Coverage,不阻塞修复方向

**Roadmap anchor**(LF-4):no direct roadmap anchor; classified as ongoing skill governance cleanup with M-stage support for fresh-source eval automation pipeline(M5)。

---

## Graph Readiness

- target_repo: spec-first(单仓 plan)
- status: unavailable
- confidence: high(基于直接读取 source files + 多轮对抗审查证据 + 1 轮 doc-review reviewer 综合)
- limitations: 无 graph readiness 不构成本 plan 风险

---

## Downstream Handoff

本 plan 完成后:

1. **work**:`/spec:work docs/plans/2026-05-20-001-fix-spec-work-skill-quality-plan.md`——**仅执行 Phase A**(U4 → U1 → U2 → U7)
2. **review(advisory)**:Phase A 完成后跑 `/spec:code-review` 做修复 diff review(可选)
3. **fresh review(advisory follow-up)**:跑新版 `审查skill.md`(含 Step 1.5)对修复后 spec-work 做 fresh review;**评分作为修复方向诊断信号,不作为 merge 条件**
4. **Phase B 启动**:基于 Phase A fresh review 落点 + product reviewer 推荐的 batch review 优先级,新开 plan 涵盖:
   - batch 跑 `审查skill.md` 对 spec-plan / spec-debug / spec-code-review / spec-write-tasks / spec-compound
   - 综合 batch findings + 本 plan U3 / U5 / U6 进入统一治理 plan

---

## Plan Sign-off

- [ ] User 确认 Decision #1 推荐路径(选项 A 删除 examples.json 第 5 例,**选项 B 已 rejected**)
- [x] User 确认 Decision #5 接受 Phase A/B re-scope(已通过 doc-review routing question 确认)
- [x] User 确认 §8 校准吸收(U7-light-boundary 进 Phase A + U3 Cache-Friendly 改名而非删除 + U1 Approach owner mapping)(本 plan Summary 已声明 U7 进 Phase A，doc-review 二次审查确认通过)
- [ ] Plan 进入 `/spec:work` 执行 Phase A(U4 → U1 → U2 → U7)
- [ ] Phase A 完成后,advisory fresh review 验证修复方向(分数仅作诊断信号,不阻塞 merge)
- [ ] Phase B 启动决策(新 plan,不在本 plan scope)
