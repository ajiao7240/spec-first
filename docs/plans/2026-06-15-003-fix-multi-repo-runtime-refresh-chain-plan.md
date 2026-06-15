---
title: "fix: 多仓 runtime 刷新链路修复(transform 误伤 / 输出分层 / 非交互入口)"
type: fix
status: active
date: 2026-06-15
spec_id: 2026-06-15-003-multi-repo-runtime-refresh-chain
implements_schemas: []
---

# fix: 多仓 runtime 刷新链路修复(transform 误伤 / 输出分层 / 非交互入口)

## Summary

修复 spec-first 自身一条被掩盖的多仓 runtime 刷新失效链路:`rewriteSourceSkillRuntimePaths` 在双宿主生成时把 skill 的 source-of-truth 路径陈述也改写成 runtime 路径(P0 真 bug),setup 输出用单一 "Harness runtime ready" 掩盖了 generated runtime 是否真的刷新且正确(P2),且多仓批量刷新缺非交互 CLI 入口(P3)。本计划以 P0 枚举数据为依据,确定 transform 修法走**语义信号守卫(content-signal guard)**而非用户初拟的窄化匹配域或保护壳,并补回归测试锁死不变量。

---

## Decision Brief

- **Recommended approach:** P0 不采用初拟的 (a) 按 `scripts/` 窄化 或 (b) 扩展 host-comparative 保护壳——**枚举数据证明两者都会误判**(见 Direct Evidence)。改用**语义信号守卫**:`rewriteSourceSkillRuntimePaths` 在改写 `skills/<self>/` 自引用时,跳过命中 source-of-truth 语义标记(如 "source of truth" / "is the current source" / "are not source")的行;其余操作性引用(读 `references/`、跑 `scripts/`)照常改写。双宿主同改(claude.js 当前**根本没有**保护机制)。
- **Key decisions:** ① P0 修法选型(语义守卫 vs 窄化 vs 保护壳)——KTD-1,数据驱动;② P1 不变量定义为"runtime mirror 不得自相矛盾 + 指定 preserve-set 必须保留"而非仅字符串黑名单;③ P3 主路径是 LLM 读确定性事实自主决策刷新,脚本只产事实,不 in-process 自动 init。
- **Validation focus:** 双宿主 `spec-first init` 后 mcp-setup SKILL:32 保留 `skills/...` 且与 :34 不矛盾;故意回退 P0 时 P1 测试转红;旧 runtime + 新 binary 跑 mcp-setup 出现 "Generated runtime: stale";`init --all-repos -y` 在多仓 fixture 各刷当前版本;关键 prose 变更跑 fresh-source eval。
- **Largest risks / boundaries:** 语义守卫是启发式,可能漏判新写法的 SoT 句 → 由 P1 "无自相矛盾"不变量测试兜底。非 goal:不重写 transform 架构、不引入中心化版本状态机、不让 update in-process fan-out init。

---

## Problem Frame

用户现场:父 workspace 跑 `$spec-mcp-setup -AllRepos`(Codex 宿主,18 子仓),返回 `ready=18/18`、`baseline_ready=true`;但 runtime 实为旧版(1.8.0),报错 `activate-serena.ps1`(当前 source 已无此脚本)、`check-health` 只有 bash 版。runtime 提示 `1.8.0 -> 1.11.0` 可更新。

根因是三条独立链路叠加,被一个过宽的就绪文案掩盖:

```text
链路A 触发缺失:  spec-first update 升级全局 CLI binary,但只提示不代跑 init → runtime 该刷没刷
链路B 语义损坏:  init 真去刷时,rewriteSourceSkillRuntimePaths transform 误伤 SoT 段落 → 刷了但刷坏
链路C 入口缺失:  多仓批量刷新无 --all-repos / --repo 非交互 CLI flag → 想批量刷也刷不动
掩盖层D:        setup 输出 "Harness runtime ready 18/18" + 单一 baseline_ready,把 A/B/C 全盖住;
                doctor 因 runtime 与(错误的)transform 输出自洽而放行
```

链路 B 比"没刷新"更危险:它让 runtime 文档**自相矛盾**(同一文件既称某路径是 source、又称它 not source),且 `doctor` 会放行(它比对 runtime 是否等于 transform 输出,而 transform 输出本身是错的)。

---

## Requirements

- R1. `rewriteSourceSkillRuntimePaths`(claude.js / codex.js 两份)生成 runtime 时,不得把 skill 的 source-of-truth 路径陈述改写成 runtime 路径;操作性路径引用(读 `references/`、跑 `scripts/`、"from the `skills/<self>/` directory")仍须正确改写为 runtime 路径。
- R2. 修复在 Claude 与 Codex 双宿主都生效(claude.js 当前无任何保护机制)。
- R3. 新增 contract test 锁死不变量:任一 generated runtime mirror 内不得出现"自相矛盾"(同路径既被称 source 又被称 not source),且指定 preserve-set 的 SoT 行必须保留 `skills/<name>/` 形态。回退 P0 修复时该测试必须转红。
- R4. setup 输出区分"依赖就绪"与"generated runtime 资产就绪":重命名误导性 `Harness runtime`,新增 generated runtime health 行(current/stale/missing),next steps 分层,使 `baseline_ready=true` 不再吞 runtime stale。
- R5. `spec-first init` 暴露非交互 `--all-repos` / `--repo <path>` flag,触发已存在的内部 all-repos 路径,沿用 per-child target scope 与 selection_source 写入门槛。
- R6. mcp-setup 工作流 prose 指示 agent:读 P2 确定性事实 → 判断单仓/多仓 → preview → 用新 binary 跑对应 init → 再 verify(LLM-owned 判断)。
- R7. 行为修复不破坏现有 source/runtime 边界与契约;不让 `update` 命令 in-process 自动 fan-out 跑 init(违背 update.js 版本错位约束 + preview-first)。

---

## Scope Boundaries

- 不重写 transform 整体架构,只在 `rewriteSourceSkillRuntimePaths` 这一函数引入语义守卫。
- 不引入中心化版本状态机;generated runtime health 行复用 `doctor` 已有的 `manifestVersion` 比对事实。
- 不修改 `update` 为 in-process 自动 init;仅修文案 + 让工作流 LLM 主导刷新。
- 不处理用户现场已消失的 `activate-serena.ps1` / `check-health` bash-only 报错本身——它们是旧 runtime 症状,会被"正确刷新"自然消除,不是独立 bug。

### Deferred to Follow-Up Work

- 终端裸跑 `spec-first update` 的 topology-aware 提示文案(检测父 workspace + 子仓数后打印精确命令):作为 fallback floor,可与 P3 同 PR 或紧随其后;非阻塞主路径(主路径是工作流 LLM 自主刷新)。
- Serena warmup 默认独立 `UV_CACHE_DIR`、check-health PS dispatch 健壮性:跨平台真实但低频短板,独立 issue。

---

## Completion Criteria

- P0:双宿主 `spec-first init` 后,本仓 `.agents/skills/spec-mcp-setup/SKILL.md` 与 `.claude/spec-first/workflows/spec-mcp-setup/SKILL.md` 的 SoT 行保留 `skills/spec-mcp-setup/...`,且全部操作性 `references/`、`scripts/` 引用仍为 runtime 路径。
- P1:新增测试在 `npm run test:unit` 通过;人为还原 P0 旧逻辑时该测试转红。
- P2:旧 runtime + 新 binary 跑 mcp-setup,输出层显示 `Generated runtime assets: stale` 且不被 `baseline_ready=true` 掩盖。
- P3:`spec-first init --all-repos -y` 在多仓 fixture 下每个子仓 state `manifestVersion` 刷到当前 bundled 版本;`--repo <path>` 定向刷单仓。
- 关键 prose(mcp-setup SKILL)变更通过 fresh-source eval。

---

## Direct Evidence Readiness

- target_repo: `.`(spec-first 仓库自身)
- evidence_sources: 直接源码读、`rg`、`grep` 分类枚举、runtime mirror vs source 对比
- source_refs: 见下 Direct Evidence
- current_revision: 分支 `leo-2026-06-15-review-all`,bundled version 1.11.0
- worktree_status: dirty(大量 docs 改动,与本计划无关)
- confidence: high(P0/P1 已逐行核实;P2/P3 沿用已确认的 update.js / init.js / doctor.js 事实)
- limitations: 多仓 18 子仓现场无法本地复现,P3 用合成 fixture 验证;runtime mirror 属生成物,仅作为 P0 损坏的现场证据读取,不作为 source

---

## Direct Evidence

- repo_scope: spec-first CLI 与 skills 源码,外加两处 runtime mirror 作为损坏现场证据
- source_reads_completed:
  - `src/cli/adapters/codex.js:281` 与 `src/cli/adapters/claude.js:224` — `rewriteSourceSkillRuntimePaths` 两份实现,正则 `(^|[^A-Za-z0-9_./-])skills/<skillName>/` 全局无差别替换
  - `src/cli/adapters/codex.js:91` — `shouldPreserveHostComparativeRuntimeProse` 仅保护 `rewriteSharedPaths`,未覆盖 `rewriteSourceSkillRuntimePaths`
  - `src/cli/adapters/claude.js:85-90` — claude.js transformSkillContent **完全没有** host-comparative 保护机制
  - `src/cli/host-comparative-workflows.js:3-5` — `HOST_COMPARATIVE_RUNTIME_SKILLS` 当前只含 `spec-code-review`(不含 spec-mcp-setup)
  - `src/cli/commands/update.js:11-15` — update 设计明确"只提示不代跑 init,避免旧进程跑新生成逻辑";`src/cli/index.js:161` help 文案却写 "and refresh runtime assets with spec-first init"(文档/行为错位)
  - `src/cli/commands/init.js:842-872` + `:1754` `inspectCurrentRuntimeDrift` — 已有 content-level drift→hard-reset 覆盖能力;单仓 init 即可干净覆盖旧 runtime
  - `src/cli/commands/init.js:461-515` — `collectDefaultInitTarget`(非交互)永远返回 single-repo;all-repos 仅交互可达;`:685` `normalizeInitTarget` 内部已支持 all-repos
  - `src/cli/commands/init.js:239,269` — CLI 参数仅认 `--claude/--codex/-y/--yes/-h`,无 `--all-repos/--repo`
  - `src/cli/commands/doctor.js:846-876` — checkManagedState 比对 state.manifestVersion vs bundled version(P2 health 行可复用此事实)
- commands_or_tools_used:
  - 枚举全 source skill `.md` 中 `skills/<name>/` 引用并按"操作性 vs SoT"分类(下方关键发现)
  - 对比 source `skills/spec-mcp-setup/SKILL.md:32` 与 runtime `.agents/skills/spec-mcp-setup/SKILL.md:32`、`.claude/spec-first/workflows/spec-mcp-setup/SKILL.md:32`,确认双宿主均被改写
- key_findings(P0 选型决定性证据):
  - **rewrite 只触及自引用**:正则按 `skills/${skillName}/` 匹配,即只改写"skill 引用自身路径"。跨 skill 引用(如 `agent-native-audit` → `agent-native-architecture`)不受影响。
  - **子路径类型无法区分该不该改写**:`references/` 两侧都出现——
    - 须改写:`spec-plan/SKILL.md:606` "Read `skills/spec-plan/references/plan-template.md`"(本计划这次运行读的就是 runtime 副本)
    - 须保留:`spec-mcp-setup/SKILL.md:32` "`skills/spec-mcp-setup/mcp-tools.json` is the current source directory"(SoT 陈述)
    → **证伪初拟 (a) 按 `scripts/` 窄化**:会漏改 spec-plan 的 `references/` 操作性读。
  - **保护壳粒度错且覆盖不全**:`shouldPreserveHostComparativeRuntimeProse` 是 skill 级,启用后会连 mcp-setup 的 2 处合法 script 引用(`SKILL.md:165-166` `bash skills/spec-mcp-setup/scripts/check-health`)一起保留→runtime 跑不到自身脚本;且只覆盖 host-comparative 集合(当前仅 spec-code-review),claude.js 还没有这套机制。
    → **证伪初拟 (b) 扩展保护壳**:粒度过粗 + 覆盖不全。
  - **真正的区分轴是语义**:须保留的 SoT 行都带显式 source 语义标记——"is the current source directory"(mcp-setup:32)、"The source of truth is"(agent-native-architecture:71)、"is the source-of-truth routing policy"(using-spec-first:38,304);须改写的都是操作性(读/跑/from directory)。语义可由"行内 source-of-truth 标记词"检测。
  - **边界 case**:`spec-mcp-setup/SKILL.md:17` Inputs 表行列出 `skills/spec-mcp-setup/mcp-tools.json` 作为输入,无显式标记词,介于"读取输入"与"引用 source 注册表"之间——P0 单元须显式裁决(建议归入 SoT 保留,与 :32 一致),P1 测试须 pin。
- impact_on_plan: P0 修法从用户初拟的 (a)/(b) 改为 KTD-1 的语义信号守卫(option C),并据此定义 U1;P1 不变量从"字符串黑名单"升级为"无自相矛盾 + preserve-set"
- limitations: 语义守卫为启发式,新 SoT 写法若不含已知标记词可能漏判 → 必须由 P1 "runtime 无自相矛盾"不变量兜底,而非依赖标记词穷举

---

## Context & Research

### Relevant Code and Patterns

- `src/cli/adapters/codex.js` / `src/cli/adapters/claude.js` — 双适配器各自的 `transformSkillContent` 与 `rewriteSourceSkillRuntimePaths`;修复须双改,且需注意 claude.js 无保护脚手架
- `src/cli/host-comparative-workflows.js` — 现成的 skill 级谓词模式参考(但本修复不复用其粒度)
- `src/cli/commands/init.js` — `runSingleProjectInit` / `normalizeInitTarget` / `collectDefaultInitTarget` / `collectInteractiveInitTarget`,all-repos 内部路径已存在
- `src/cli/commands/doctor.js:846` `checkManagedState` — manifestVersion vs bundled version 比对,P2 health 行的事实来源
- `tests/unit/init-source-path-coverage.test.js` — P1 测试挂载点;已有"runtime-deliverable skill source 目录治理"断言,风格可沿用
- setup 渲染层:`skills/spec-mcp-setup/scripts/render-status-block.cjs`、`setup-plan-renderer.cjs`、`provider-readiness-renderer.cjs`、`write-setup-facts.{sh,ps1}` — P2 输出分层与命名的改动面

### Institutional Learnings

- 本会话三轮诊断未检索 `docs/solutions/`;实施期 spec-work 应先按 `docs/contracts/workflows/fresh-source-eval-checklist.md` 准备 prose 变更验证。

### External References

- 未使用外部研究:全部为本仓自身源码事实,本地模式充分。

---

## Key Technical Decisions

- **KTD-1(P0 修法选型,数据驱动):** 采用**语义信号守卫(content-signal guard)**。`rewriteSourceSkillRuntimePaths` 在执行 `skills/<self>/` → runtime 路径替换时,逐行(或逐句)检测 source-of-truth 语义标记;命中标记的行跳过改写,其余照常。理由:枚举数据证伪 (a) 窄化(漏改 spec-plan references)与 (b) 保护壳(粒度过粗 + 覆盖不全);语义轴是唯一能同时正确处理 mcp-setup:32(保留)与 spec-plan:606(改写)的区分。残余启发式风险由 KTD-2 的不变量测试兜底。
- **KTD-2(P1 不变量定义):** 测试断言两层——① **preserve-set**:枚举出的 SoT 行(至少 mcp-setup SKILL:17/32、agent-native-architecture:71、using-spec-first:38/304)在双宿主 runtime 中保留 `skills/<name>/` 形态;② **no-self-contradiction**:任一 runtime mirror 文件不得同时把同一路径表述为 source 与 not-source。后者不依赖标记词穷举,是真正的回归护栏。
- **KTD-3(P0 标记词集合作为 source-owned 常量):** 标记词集合(如 `source of truth` / `source-of-truth` / `is the current source` / `are not source` / `current source directory`)集中定义为单一常量,双适配器共享,便于审查与扩展,避免两份正则漂移。
- **KTD-4(边界 case 裁决):** mcp-setup SKILL:17 Inputs 行归入保留(与 :32 同一 source 注册表语义),保持文档内一致;在 U1 与 P1 测试中显式覆盖。
- **KTD-5(P2 复用 doctor 事实):** generated runtime health 行直接复用 `doctor` 的 manifestVersion 比对,不新建版本状态;输出为 script-owned 确定性事实(current/stale/missing)。
- **KTD-6(P3 职责切分):** `--all-repos/--repo` flag 是 script-owned 确定性入口;"该不该刷、单仓还是多仓"是 LLM-owned 判断,写在 mcp-setup 工作流 prose,由 agent 读 P2 事实后决策。`update` 不 in-process fan-out init(版本错位约束)。

---

## Open Questions

### Resolved During Planning

- P0 走 (a) 还是 (b)?→ 都不走;枚举数据驱动选语义守卫(option C)。见 KTD-1。
- 误伤是否只在 Codex?→ 否,双宿主都中招,claude.js 还缺保护脚手架。见 Direct Evidence。
- 是否需要新增 runtime 覆盖机制?→ 不需要,init 已有 content-level drift→hard-reset;缺的是触发入口(P3)与正确的 transform(P0)。

### Deferred to Implementation

- 语义守卫的实现粒度(逐行 vs 逐句):逐行最简且对当前枚举足够;若实施时发现单行混含操作性+SoT 引用,再降到逐句。属执行期裁决。
- P2 输出分层在 `.sh` 与 `.ps1` 双 runner 的对齐细节:依现有渲染脚本结构在执行期定。
- `--repo <path>` 与现有 workspace target resolver / selection_source 门槛的精确接线:依 `resolve-project-target` 实际契约在执行期定。

---

## High-Level Technical Design

> *本节为审查用的方向性说明,不是实现规范。实现 agent 应将其作为上下文,而非逐字复制的代码。*

P0 语义守卫的意图(伪代码,方向性):

```text
rewriteSourceSkillRuntimePaths(content, skillName, runtimeSkillRoot):
  for each line in content:
    if line matches any SOT_MARKER (KTD-3 常量):
        keep line unchanged            # SoT 陈述:保留 skills/<self>/
    else:
        replace `skills/<skillName>/` → `runtimeSkillRoot/`   # 操作性引用:改写
  双适配器(claude.js / codex.js)共享同一 SOT_MARKER 常量与同一守卫逻辑
```

P2 输出分层意图(四独立状态,互不掩盖):

```text
Required MCP/helper dependencies:   ready | action-required     # 原 "Harness runtime",重命名
Project setup facts:                ready | written
Generated spec-first runtime:       current | stale | missing   # 新增,来自 doctor manifestVersion 比对
Provider graph readiness:           pending | ready | degraded
```

---

## Implementation Units

### U1. P0:为 rewriteSourceSkillRuntimePaths 引入语义信号守卫(双宿主)

**Goal:** 让 transform 在改写 skill 自引用路径时跳过 SoT 语义行,消除双宿主 runtime 的 source/not-source 自相矛盾,同时保持操作性引用正确改写。

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Create: `src/cli/skill-path-rewrite-markers.js`(或就近放置)— SOT_MARKER 常量 + 共享守卫 helper(KTD-3)
- Modify: `src/cli/adapters/codex.js`(`rewriteSourceSkillRuntimePaths`,:281)
- Modify: `src/cli/adapters/claude.js`(`rewriteSourceSkillRuntimePaths`,:224)
- Test: `tests/unit/skill-path-rewrite-guard.test.js`(新增,函数级单测)

**Approach:**
- 抽出共享 SOT_MARKER 常量与守卫函数,双适配器调用,避免两份正则漂移(KTD-3)。
- 守卫默认逐行:命中标记的行整行跳过 `skills/<self>/` 改写;其余行照常改写(KTD-1)。
- 显式覆盖 KTD-4 边界 case:mcp-setup Inputs 行(:17)归入保留。
- 不改动跨 skill 引用行为(本就不被匹配)。

**Patterns to follow:** `src/cli/host-comparative-workflows.js` 的"集中谓词 + 双适配器共享"模式(借其组织方式,不借其 skill 级粒度)。

**Test scenarios:**
- Happy path:含 "is the current source directory" 的行 → `skills/spec-mcp-setup/...` 保留不变。
- Happy path:含 "Read `skills/spec-plan/references/plan-template.md`" 的操作性行 → 改写为 runtime 路径。
- Happy path:`bash skills/spec-mcp-setup/scripts/check-health` 操作性 script 行 → 改写为 runtime 路径。
- Edge case:同 skill 内既有 SoT 行又有操作性行(mcp-setup:32 vs :165)→ 前者保留、后者改写。
- Edge case:Inputs 表行(:17,无显式动词)→ 按 KTD-4 保留。
- Edge case:跨 skill 引用(`agent-native-audit` 文中的 `skills/agent-native-architecture/`)→ 不被改写(skillName 不匹配),与守卫无关但需断言不回归。
- Error path:`skillName` 为空 → 原样返回(保持既有早退行为)。
- Integration:同一输入分别过 claude.js 与 codex.js,两者守卫行为一致(仅 runtimeSkillRoot 不同)。

**Verification:** 函数级单测全绿;`spec-first init` 后双宿主 mcp-setup runtime 的 :32 保留 `skills/...` 且操作性引用为 runtime 路径。

---

### U2. P1:新增 runtime SoT 不变量 contract test

**Goal:** 锁死 R3——runtime mirror 不得自相矛盾,且 preserve-set SoT 行必须保留 source 形态;回退 P0 时测试转红。

**Requirements:** R3

**Dependencies:** U1

**Files:**
- Modify: `tests/unit/init-source-path-coverage.test.js`(优先挂载点)或 Create 同级新测试文件
- Test: 同上(本单元即测试)

**Approach:**
- 用真实 transform(经 U1 的适配器)对 spec-mcp-setup 等枚举 skill 生成 runtime 内容,断言:
  - preserve-set 行保留 `skills/<name>/`(KTD-2 ①):至少 mcp-setup SKILL:17/32、agent-native-architecture:71、using-spec-first:38/304。
  - no-self-contradiction(KTD-2 ②):生成内容中不存在"同一路径既被称 source 又被称 not source"。
  - 操作性反向断言:spec-plan references 读、mcp-setup scripts 跑等行确实被改写为 runtime 路径(防止守卫过度保留)。
- 覆盖双宿主(claude 与 codex 各跑一遍)。

**Patterns to follow:** `init-source-path-coverage.test.js` 既有的"枚举 runtime-deliverable skill + 断言路径形态"风格。

**Test scenarios:**
- Happy path:当前 U1 修复下全部断言通过。
- Error path(回归护栏):人为还原旧无差别正则 → preserve-set 与 no-self-contradiction 断言转红。
- Edge case:双宿主分别断言,确保不是只测了一个 host。
- Integration:断言基于真实 adapter transform 输出,而非对字符串硬编码期望。

**Verification:** `npm run test:unit` 通过;`git stash` U1 改动后该测试失败。

---

### U3. P2:setup 输出分层 + generated runtime health 行 + 重命名

**Goal:** 让掩盖层 D 失效——输出区分依赖就绪与 generated runtime 就绪,`baseline_ready=true` 不再吞 runtime stale。

**Requirements:** R4

**Dependencies:** None(可与 U1/U2 并行)

**Files:**
- Modify: `skills/spec-mcp-setup/scripts/render-status-block.cjs`(分层 + 重命名 "Harness runtime" → "Required MCP/helper dependencies")
- Modify: `skills/spec-mcp-setup/scripts/setup-plan-renderer.cjs`(next steps 分层)
- Modify: `skills/spec-mcp-setup/scripts/write-setup-facts.{sh,ps1}`(写入 generated runtime health 事实)
- Modify: `skills/spec-mcp-setup/SKILL.md`(输出契约段落同步:Execution result / next steps 描述)
- Test: `tests/unit/`(渲染器单测,若现有 `*.cjs` 有测试则扩展;否则就近新增)

**Approach:**
- generated runtime health 复用 doctor 的 manifestVersion vs bundled 比对(KTD-5),输出 current/stale/missing,作为 script-owned 确定性事实。
- 四状态独立渲染(见 High-Level Technical Design),不再用单一 baseline_ready 概括 runtime 资产。
- `.sh` 与 `.ps1` 渲染对齐(执行期细节按现有结构定)。

**Patterns to follow:** 现有 `render-status-block.cjs` / `provider-readiness-renderer.cjs` 的分组渲染结构。

**Test scenarios:**
- Happy path:runtime current 时显示 "Generated runtime assets: current"。
- Edge case:旧 runtime(manifestVersion 落后)+ 新 binary → "stale",且与 baseline_ready=true 同时呈现、互不掩盖。
- Edge case:无 state.json → "missing"。
- Error path:state.json 不可读 → 退化为 missing/unknown 而非崩溃。
- Integration:`.sh` 与 `.ps1` 输出同一逻辑结论。

**Verification:** 旧 runtime fixture 下输出含独立的 stale 行;命名不再出现误导性 "Harness runtime"。

---

### U4. P3:init 暴露 --all-repos / --repo 非交互 flag

**Goal:** 给多仓批量刷新一个非交互入口,触发已存在的内部 all-repos 路径。

**Requirements:** R5

**Dependencies:** None(可与 U1-U3 并行;但 P3 工作流 prose U5 依赖它)

**Files:**
- Modify: `src/cli/commands/init.js`(`parseInitArgs` 增加 `--all-repos` / `--repo <path>`;非交互 target 解析接 `normalizeInitTarget` 的 all-repos/single-repo)
- Modify: `src/cli/index.js`(help/usage 文案)
- Test: `tests/unit/`(init arg 解析单测)+ `tests/smoke/`(CLI 路径)

**Approach:**
- `--all-repos`:构造 `mode: 'all-repos'` target,跳过交互 select,复用 `discoverChildGitRepos` + per-child 写入。
- `--repo <path>`:定向单子仓,沿用 selection_source 写入门槛与 target scope(KTD-6),不静默写父 workspace。
- 与 `-y/--yes`、`--claude/--codex` 组合正确。

**Patterns to follow:** `init.js` 既有 flag 解析(:239,:269)与 `collectInteractiveInitTarget` 的 all-repos 构造。

**Test scenarios:**
- Happy path:`init --all-repos -y` 在多仓 fixture 下每子仓刷到当前 bundled version。
- Happy path:`init --repo <child> -y` 仅刷该子仓。
- Edge case:`--all-repos` 在单仓(无子仓)下退化为单仓刷新而非报错。
- Error path:`--repo <非 git 路径>` → 明确报错,不静默写父 workspace。
- Error path:`--all-repos` + `--repo` 互斥 → 用法错误退出码。
- Integration:flag 路径与交互 all-repos 路径产出一致的 per-child 写入与 workspace summary。

**Verification:** smoke 测试覆盖 `init --all-repos -y` / `--repo`;多仓 fixture 各子仓 manifestVersion 刷新。

---

### U5. P3:mcp-setup 工作流 prose 主导 detect-and-refresh

**Goal:** 让 agent 读 P2 确定性事实后自主判断单仓/多仓并 preview→用新 binary 跑 init→再 verify,而非依赖用户记命令。

**Requirements:** R6, R7

**Dependencies:** U3(需要 P2 的 generated runtime health 事实), U4(需要 `--all-repos` 入口)

**Files:**
- Modify: `skills/spec-mcp-setup/SKILL.md`(新增 prose:消费 generated runtime health 事实 → topology 判断 → preview → 用新 binary 跑 `spec-first init [--all-repos|--repo]` → re-verify;明确 update 不 in-process fan-out)
- Modify: `src/cli/index.js` / `src/cli/commands/update.js`(修正 update help/next-step 文案,去掉"and refresh runtime assets"虚假承诺,改为 scope-aware 提示)

**Approach:**
- prose 写清职责切分(KTD-6):脚本产 health/topology 事实,LLM 判断是否刷新与刷新范围。
- update 文案对齐现实:成功后提示运行 init(单仓)或 `init --all-repos`(父 workspace),不暗示 update 自身会刷 runtime。
- 不引入新状态机、不让 update 跑 init。

**Execution note:** prose 行为语义变更须按 `docs/contracts/workflows/fresh-source-eval-checklist.md` 跑 fresh-source eval(把磁盘上的 mcp-setup SKILL 源注入全新 subagent 评估),不依赖会话缓存的 skill 调用。

**Patterns to follow:** mcp-setup SKILL 既有的"script-owned facts vs LLM-owned judgment"行文。

**Test scenarios:**
- Test expectation: prose 单元无传统单测——以 fresh-source eval 验证:给定"旧 runtime + 新 binary"情境,agent 会先识别 stale → preview → 跑对应 init → 再 verify,而非直接报 ready。
- Happy path(eval):父 workspace 多仓 stale → agent 选 `init --all-repos` 并 preview。
- Edge case(eval):单仓 stale → agent 选 `spec-first init`。
- Error path(文案):update help 不再出现 "refresh runtime assets with spec-first init" 的误导措辞。

**Verification:** fresh-source eval 通过并记录;update 文案与实际行为一致。

---

## System-Wide Impact

- **Interaction graph:** P0 改 transform 影响**所有 skill** 的 runtime 生成,不止 mcp-setup;U2 须抽样多个 skill 断言无回归。P2 改 setup 输出影响 mcp-setup 工作流呈现。P3 改 init flag 影响所有 init 调用方(smoke / 文档 / 用户脚本)。
- **Error propagation:** P2 health 行读 state.json 失败须退化为 missing/unknown,不可让 setup 崩溃(warn-and-continue)。
- **State lifecycle risks:** P0 修复后需 `spec-first init` 重新生成本仓 runtime mirror,使现有被污染的 `.agents/skills/**`、`.claude/spec-first/workflows/**` 恢复——属正常 runtime 再生,不是 source 改动。
- **API surface parity:** P0 双宿主同改;P3 flag 须在 Claude / Codex 两宿主语义一致。
- **Surface coverage:** CLI(init/update)→ in-scope;双宿主 adapter → in-scope;setup 渲染脚本(.sh/.ps1)→ in-scope;终端裸跑 update topology 文案 → deferred(follow-up);Serena/uv 跨平台 → deferred(独立 issue)。
- **Integration coverage:** U2 用真实 adapter transform 输出断言(非 mock);U4 smoke 覆盖真实 CLI 路径;U5 用 fresh-source eval 覆盖 prose 语义。
- **Unchanged invariants:** source/runtime 边界不变(仍只改 source,runtime 由 init 再生);init 的 drift→hard-reset 覆盖机制不变;update 不代跑 init 的版本错位约束不变。

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| 语义守卫漏判新写法的 SoT 句(启发式固有缺陷) | U2 的 no-self-contradiction 不变量兜底,不依赖标记词穷举;新增 SoT 写法若触发矛盾即被测试拦截 |
| 守卫过度保留,误伤操作性引用(如 spec-plan references 读) | U1/U2 显式反向断言操作性行必须被改写;枚举数据已列出双侧样本 |
| claude.js 无保护脚手架,双改易只改一半 | KTD-3 共享常量 + helper,U1 强制双适配器调用同一逻辑;U2 双宿主各断言一遍 |
| P3 `--repo` 与 workspace target resolver 接线复杂 | 沿用既有 selection_source 门槛与 `resolve-project-target` 契约;执行期按真实契约接线,error path 测试守住"不静默写父 workspace" |
| P2 .sh/.ps1 双 runner 漂移 | U3 集成断言两 runner 同结论;依现有渲染脚本共享结构 |
| 本仓 dirty worktree(大量无关 docs 改动) | 实施在独立分支/worktree;只 stage 本计划相关文件,避免裹挟 |

---

## Documentation / Operational Notes

- 任一 source 变更须按仓库格式更新 `CHANGELOG.md`(作者取 `~/.spec-first/.developer`),用户可见的(P2 输出、P3 flag、update 文案)追加 `(user-visible)`。
- P3 新增 flag 须更新 `README.md` / `README.zh-CN.md` 的 init 用法、`spec-first init -h` help。
- P0/P1 修复后在本仓跑 `spec-first init` 再生 runtime,使现有污染的 runtime mirror 恢复;提交时一并更新 generated runtime expectations(若测试快照涉及)。
- 跨宿主改动按 CLAUDE.md 要求跑 `npm run typecheck`、`test:unit`、`test:smoke`,并 `spec-first init` 验证双宿主再生。

---

## Sources & References

- Related code: `src/cli/adapters/codex.js:281`、`src/cli/adapters/claude.js:224`、`src/cli/host-comparative-workflows.js`、`src/cli/commands/init.js:461,685,842,1754`、`src/cli/commands/update.js:11`、`src/cli/index.js:161`、`src/cli/commands/doctor.js:846`
- Setup 渲染:`skills/spec-mcp-setup/scripts/render-status-block.cjs`、`setup-plan-renderer.cjs`、`write-setup-facts.{sh,ps1}`、`skills/spec-mcp-setup/SKILL.md`
- 测试挂载:`tests/unit/init-source-path-coverage.test.js`
- 契约:`docs/contracts/workflows/fresh-source-eval-checklist.md`、`docs/10-prompt/结构化项目角色契约.md`(source/runtime 边界、scripts-prepare/LLM-decides)
