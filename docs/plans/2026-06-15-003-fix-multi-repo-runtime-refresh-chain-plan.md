---
title: "fix: 多仓 runtime 刷新链路修复(transform 误伤 / 输出分层 / 非交互入口)"
type: fix
status: completed
date: 2026-06-15
spec_id: 2026-06-15-003-multi-repo-runtime-refresh-chain
implements_schemas: []
---

# fix: 多仓 runtime 刷新链路修复(transform 误伤 / 输出分层 / 非交互入口)

## Summary

修复 spec-first 自身一条被掩盖的多仓 runtime 刷新失效链路:`rewriteSourceSkillRuntimePaths` 在双宿主生成时把 skill 的 source-of-truth 路径陈述也改写成 runtime 路径(P0 真 bug),setup / `verify-tools -AllRepos` 输出用单一 "Harness runtime ready" 掩盖了 generated runtime manifest 是否刷新(P2),且多仓批量刷新缺非交互 CLI 入口(P3)。本计划以 P0 枚举数据为依据,确定 transform 修法走**语义信号守卫(content-signal guard)**而非用户初拟的窄化匹配域或保护壳,并补回归测试锁死不变量。

---

## Decision Brief

- **Recommended approach:** P0 不采用初拟的 (a) 按 `scripts/` 窄化 或 (b) 扩展 host-comparative 保护壳——**枚举数据证明两者都会误判**(见 Direct Evidence)。改用**语义信号守卫**:`rewriteSourceSkillRuntimePaths` 在改写 `skills/<self>/` 自引用时,跳过命中 source-of-truth 语义标记(如 "source of truth" / "is the current source" / "are not source")的行;其余操作性引用(读 `references/`、跑 `scripts/`)照常改写。双宿主同改(claude.js 当前**根本没有**保护机制)。
- **Key decisions:** ① P0 修法选型(语义守卫 vs 窄化 vs 保护壳)——KTD-1,数据驱动;② P1 不变量定义为"preserve-set 必须保留 + known-pattern contradiction lexicon 不回归",而非任意 prose 语义理解或仅字符串黑名单;③ `update` 成功后应自动委托 fresh `spec-first init` 子进程刷新 runtime,脚本仍只做确定性 scope/host 选择与事实输出。
- **Validation focus:** 双宿主 `spec-first init` 后 mcp-setup SKILL:32 保留 `skills/...` 且与 :34 不矛盾;故意回退 P0 时 P1 测试转红;旧 runtime + 新 binary 跑 mcp-setup 与 `verify-tools -AllRepos` 出现独立的 "Generated runtime manifest: stale";`init --all-repos -y` 在多仓 fixture 各刷当前版本;`spec-first update` 成功后自动调用 fresh init 刷新 runtime,失败或无法安全判定 scope 时输出明确 fallback 命令;关键 prose 变更跑 fresh-source eval。
- **Largest risks / boundaries:** 语义守卫是启发式,可能漏判新写法的 SoT 句 → 由 P1 preserve-set + 已知模式 contradiction lexicon 测试兜底,不声称脚本可理解任意 prose 语义。非 goal:不重写 transform 架构、不引入中心化版本状态机、不在旧 `update` 进程内直接执行 runtime generator。

---

## Problem Frame

用户现场:父 workspace 跑 `$spec-mcp-setup -AllRepos`(Codex 宿主,18 子仓),返回 `ready=18/18`、`baseline_ready=true`;但 runtime 实为旧版(1.8.0),报错 `activate-serena.ps1`(当前 source 已无此脚本)、`check-health` 只有 bash 版。runtime 提示 `1.8.0 -> 1.11.0` 可更新。

根因是三条独立链路叠加,被一个过宽的就绪文案掩盖:

```text
链路A 触发缺失:  spec-first update 升级全局 CLI binary,但不自动委托 fresh init → runtime 该刷没刷
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
- R3. 新增 contract test 锁死不变量:指定 preserve-set 的 SoT 行必须保留 `skills/<name>/` 形态,且 generated runtime mirror 不得命中已知模式的"自相矛盾"(同路径既被称 source 又被称 not source)。回退 P0 修复时该测试必须转红;该测试是确定性文本护栏,不是任意 prose 语义理解器。
- R4. setup 输出区分"依赖就绪"与"generated runtime manifest fresh/stale":重命名误导性 `Harness runtime`,新增 generated runtime manifest health 行(current/stale/missing/unknown,证据仅为 `manifestVersion`),next steps 分层,使 `baseline_ready=true` 不再吞 runtime stale。
- R5. `spec-first init` 暴露非交互 `--all-repos` / `--repo <path>` flag,触发已存在的内部 all-repos 路径,沿用 per-child target scope 与 selection_source 写入门槛。
- R6. mcp-setup 工作流 prose 指示 agent:读 P2 确定性事实 → 判断单仓/多仓 → preview → 用新 binary 跑对应 init → 再 verify(LLM-owned 判断)。
- R7. 行为修复不破坏现有 source/runtime 边界与契约;`update` 升级成功后必须启动 fresh `spec-first init` 子进程刷新 runtime,不得在当前旧进程内直接执行 runtime generator。
- R8. `spec-first update` 成功输出、`update --help` 与 root help 必须对齐现实:upgrade 后会自动刷新 runtime;若自动刷新失败或无法安全判定 scope,必须提示单仓 `spec-first init -y` 或父 workspace `spec-first init --all-repos -y` 的 fallback 命令。

---

## Scope Boundaries

- 不重写 transform 整体架构,只在 `rewriteSourceSkillRuntimePaths` 这一函数引入语义守卫。
- 不引入中心化版本状态机;generated runtime manifest health 行复用 `doctor` 已有的 `manifestVersion` 比对事实。该状态只表示 managed state manifest 与 bundled version 的 freshness,不表示 transform 语义正确。
- `update` 可以自动刷新 runtime,但只能通过升级后的 fresh `spec-first init` 子进程;不在当前旧进程内直接跑生成逻辑。
- 不处理用户现场已消失的 `activate-serena.ps1` / `check-health` bash-only 报错本身——它们是旧 runtime 症状,会被"正确刷新"自然消除,不是独立 bug。

### Deferred to Follow-Up Work

- Serena warmup 默认独立 `UV_CACHE_DIR`、check-health PS dispatch 健壮性:跨平台真实但低频短板,独立 issue。

---

## Completion Criteria

- P0:双宿主 `spec-first init` 后,本仓 `.agents/skills/spec-mcp-setup/SKILL.md` 与 `.claude/spec-first/workflows/spec-mcp-setup/SKILL.md` 的 SoT 行保留 `skills/spec-mcp-setup/...`,且全部操作性 `references/`、`scripts/` 引用仍为 runtime 路径。
- P1:新增测试在 `npm run test:unit` 通过;人为还原 P0 旧逻辑时该测试转红。
- P2:旧 runtime + 新 binary 跑 mcp-setup 或 `verify-tools -AllRepos`,输出层显示 `Generated runtime manifest: stale`(或同义 label,证据为 manifestVersion)且不被 `baseline_ready=true`/`ready=18/18` 掩盖;per-child workspace summary 传播该状态。
- P3:`spec-first init --all-repos -y` 在多仓 fixture 下每个子仓 state `manifestVersion` 刷到当前 bundled 版本;`--repo <path>` 定向刷单仓。
- P4:`spec-first update` 成功后自动调用 fresh init 刷新 runtime;`update --help`、root `--help` 均说明该行为,并在刷新失败或无法判定 scope 时给出单仓/父 workspace 两类 copy-ready fallback 命令。
- 关键 prose(mcp-setup SKILL)变更通过 fresh-source eval。

### Completion Evidence

- Implementation scope: `update` 升级成功后 spawn fresh `spec-first init`;单仓使用 `init -y`,父 workspace 使用 `init --all-repos -y`,刷新失败或 scope 不明时输出 fallback。`init` 支持 `--all-repos`、`--repo <path>`、`--dry-run`;双宿主 path rewrite 使用共享 source-truth guard;`verify-tools.{sh,ps1}` 与 setup facts 分离 dependency readiness 和 generated runtime manifest freshness。
- Verification: `npm run test:unit` 通过(150 suites / 1209 tests);`npm run typecheck` 通过;`npm run test:mcp-setup` 通过;focused Jest 覆盖 `update-contracts`, `skill-path-rewrite-guard`, `cli-entry-contracts`, `mcp-setup-verify-host-contracts`, `mcp-setup-powershell-contracts`;`git diff --check` 与 `git diff --cached --check` 通过;CLI help 已手动验证。
- Review status: inline single-agent final review completed, no blocking findings after fixing the update refresh failure exit-code contract.
- Fresh-source eval: `not_run`, reason_code=`dispatch_authorization_missing`; fallback evidence is current disk source reads plus source/runtime boundary contract tests. Runtime mirrors were not hand-edited.

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
  - `src/cli/commands/update.js:11-15` — update 当前"只提示不代跑 init,避免旧进程跑新生成逻辑";`src/cli/index.js:161` help 文案却写 "and refresh runtime assets with spec-first init"。目标行为应改为升级后 spawn fresh `spec-first init`,既兑现自动刷新,又避免旧进程直接生成 runtime。
  - `src/cli/commands/init.js:842-872` + `:1754` `inspectCurrentRuntimeDrift` — 已有 content-level drift→hard-reset 覆盖能力;单仓 init 即可干净覆盖旧 runtime
  - `src/cli/commands/init.js:461-515` — `collectDefaultInitTarget`(非交互)永远返回 single-repo;all-repos 仅交互可达;`:685` `normalizeInitTarget` 内部已支持 all-repos
  - `src/cli/commands/init.js:239,269` — CLI 参数仅认 `--claude/--codex/-y/--yes/-h`,无 `--all-repos/--repo`
  - `src/cli/commands/doctor.js:846-876` — checkManagedState 比对 state.manifestVersion vs bundled version(P2 manifest health 行可复用此事实,但不能证明 transform 语义正确)
  - `skills/spec-mcp-setup/scripts/verify-tools.{sh,ps1}` — 当前 single-repo 与 all-repos 输出、workspace summary 都以 `baseline_ready` 聚合,child result 未传播 generated runtime manifest health
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
- impact_on_plan: P0 修法从用户初拟的 (a)/(b) 改为 KTD-1 的语义信号守卫(option C),并据此定义 U1;P1 不变量从"字符串黑名单"升级为"preserve-set + known-pattern contradiction lexicon"
- limitations: 语义守卫与 contradiction 检测均为确定性文本护栏,新 SoT 写法若不含已知标记词且不形成已知 source/not-source 模式可能漏判 → 必须由 preserve-set、已知模式 lexicon、fresh-source eval 与 review 共同兜底,不能声称脚本理解任意 prose 语义

---

## Context & Research

### Relevant Code and Patterns

- `src/cli/adapters/codex.js` / `src/cli/adapters/claude.js` — 双适配器各自的 `transformSkillContent` 与 `rewriteSourceSkillRuntimePaths`;修复须双改,且需注意 claude.js 无保护脚手架
- `src/cli/host-comparative-workflows.js` — 现成的 skill 级谓词模式参考(但本修复不复用其粒度)
- `src/cli/commands/init.js` — `runSingleProjectInit` / `normalizeInitTarget` / `collectDefaultInitTarget` / `collectInteractiveInitTarget`,all-repos 内部路径已存在
- `src/cli/commands/doctor.js:846` `checkManagedState` — manifestVersion vs bundled version 比对,P2 manifest health 行的事实来源
- `tests/unit/init-source-path-coverage.test.js` — P1 测试挂载点;已有"runtime-deliverable skill source 目录治理"断言,风格可沿用
- setup 渲染层:`skills/spec-mcp-setup/scripts/render-status-block.cjs`、`setup-plan-renderer.cjs`、`provider-readiness-renderer.cjs`、`write-setup-facts.{sh,ps1}`、`verify-tools.{sh,ps1}` — P2 输出分层、per-child summary 传播与命名的改动面

### Institutional Learnings

- 本会话三轮诊断未检索 `docs/solutions/`;实施期 spec-work 应先按 `docs/contracts/workflows/fresh-source-eval-checklist.md` 准备 prose 变更验证。

### External References

- 未使用外部研究:全部为本仓自身源码事实,本地模式充分。

---

## Key Technical Decisions

- **KTD-1(P0 修法选型,数据驱动):** 采用**语义信号守卫(content-signal guard)**。`rewriteSourceSkillRuntimePaths` 在执行 `skills/<self>/` → runtime 路径替换时,逐行(或逐句)检测 source-of-truth 语义标记;命中标记的行跳过改写,其余照常。理由:枚举数据证伪 (a) 窄化(漏改 spec-plan references)与 (b) 保护壳(粒度过粗 + 覆盖不全);语义轴是唯一能同时正确处理 mcp-setup:32(保留)与 spec-plan:606(改写)的区分。残余启发式风险由 KTD-2 的不变量测试兜底。
- **KTD-2(P1 不变量定义):** 测试断言两层——① **preserve-set**:枚举出的 SoT 行(至少 mcp-setup SKILL:17/32、agent-native-architecture:71、using-spec-first:38/304)在双宿主 runtime 中保留 `skills/<name>/` 形态;② **known-pattern no-self-contradiction**:任一 runtime mirror 文件不得命中已知 source/not-source contradiction lexicon。后者不替代语义 review,只防止本次已知失效模式回归。
- **KTD-3(P0 标记词集合作为 source-owned 常量):** 标记词集合(如 `source of truth` / `source-of-truth` / `is the current source` / `are not source` / `current source directory`)集中定义为单一常量,双适配器共享,便于审查与扩展,避免两份正则漂移。
- **KTD-4(边界 case 裁决):** mcp-setup SKILL:17 Inputs 行归入保留(与 :32 同一 source 注册表语义),保持文档内一致;在 U1 与 P1 测试中显式覆盖。
- **KTD-5(P2 复用 doctor 事实):** generated runtime manifest health 行直接复用 `doctor` 的 manifestVersion 比对,不新建版本状态;输出为 script-owned 确定性事实(current/stale/missing/unknown)。Label 与 evidence 必须写清 `manifestVersion` basis,避免被理解为 runtime 内容语义正确。
- **KTD-6(P3/R8 职责切分):** `--all-repos/--repo` flag 是 script-owned 确定性入口;`update` 负责自动刷新 runtime,但只负责确定性 scope/host 选择并 spawn 升级后的 fresh `spec-first init` 子进程。若 scope/host 不可安全判定或刷新失败,再给出 copy-ready fallback 命令。mcp-setup 仍读 P2 事实并在后续 verify 中判断是否还 stale。

---

## Open Questions

### Resolved During Planning

- P0 走 (a) 还是 (b)?→ 都不走;枚举数据驱动选语义守卫(option C)。见 KTD-1。
- 误伤是否只在 Codex?→ 否,双宿主都中招,claude.js 还缺保护脚手架。见 Direct Evidence。
- 是否需要新增 runtime 覆盖机制?→ 不需要,init 已有 content-level drift→hard-reset;缺的是触发入口(P3)与正确的 transform(P0)。

### Deferred to Implementation

- 语义守卫的实现粒度(逐行 vs 逐句):逐行最简且对当前枚举足够;若实施时发现单行混含操作性+SoT 引用,再降到逐句。属执行期裁决。
- P2 输出分层在 `.sh` 与 `.ps1` 双 runner、single-repo ledger 与 all-repos workspace summary 的对齐细节:依现有渲染脚本结构在执行期定。
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
Generated runtime manifest:         current | stale | missing | unknown
  Evidence: state.manifestVersion vs bundled manifest.version only
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

**Goal:** 锁死 R3——runtime mirror 不得命中已知模式的 source/not-source 自相矛盾,且 preserve-set SoT 行必须保留 source 形态;回退 P0 时测试转红。

**Requirements:** R3

**Dependencies:** U1

**Files:**
- Modify: `tests/unit/init-source-path-coverage.test.js`(优先挂载点)或 Create 同级新测试文件
- Test: 同上(本单元即测试)

**Approach:**
- 用真实 transform(经 U1 的适配器)对 spec-mcp-setup 等枚举 skill 生成 runtime 内容,断言:
  - preserve-set 行保留 `skills/<name>/`(KTD-2 ①):至少 mcp-setup SKILL:17/32、agent-native-architecture:71、using-spec-first:38/304。
  - known-pattern no-self-contradiction(KTD-2 ②):生成内容中不存在已知 lexicon 可机械识别的"同一路径既被称 source 又被称 not source"。
  - 操作性反向断言:spec-plan references 读、mcp-setup scripts 跑等行确实被改写为 runtime 路径(防止守卫过度保留)。
- 覆盖双宿主(claude 与 codex 各跑一遍)。

**Patterns to follow:** `init-source-path-coverage.test.js` 既有的"枚举 runtime-deliverable skill + 断言路径形态"风格。

**Test scenarios:**
- Happy path:当前 U1 修复下全部断言通过。
- Error path(回归护栏):人为还原旧无差别正则 → preserve-set 与 known-pattern no-self-contradiction 断言转红。
- Edge case:双宿主分别断言,确保不是只测了一个 host。
- Integration:断言基于真实 adapter transform 输出,而非对字符串硬编码期望。

**Verification:** `npm run test:unit` 通过;`git stash` U1 改动后该测试失败。

---

### U3. P2:setup 输出分层 + generated runtime manifest health 行 + 重命名

**Goal:** 让掩盖层 D 失效——输出区分依赖就绪与 generated runtime manifest freshness,`baseline_ready=true` 与 `ready=18/18` 不再吞 runtime stale。

**Requirements:** R4

**Dependencies:** None(可与 U1/U2 并行)

**Files:**
- Modify: `skills/spec-mcp-setup/scripts/render-status-block.cjs`(分层 + 重命名 "Harness runtime" → "Required MCP/helper dependencies")
- Modify: `skills/spec-mcp-setup/scripts/setup-plan-renderer.cjs`(next steps 分层)
- Modify: `skills/spec-mcp-setup/scripts/write-setup-facts.{sh,ps1}`(写入 generated runtime manifest health 事实)
- Modify: `skills/spec-mcp-setup/scripts/verify-tools.{sh,ps1}`(single-repo 输出、`-AllRepos` per-child result、workspace summary 均传播 generated runtime manifest health)
- Modify: `skills/spec-mcp-setup/SKILL.md`(输出契约段落同步:Execution result / next steps 描述)
- Test: `tests/unit/`(渲染器单测,若现有 `*.cjs` 有测试则扩展;否则就近新增)

**Approach:**
- generated runtime manifest health 复用 doctor 的 manifestVersion vs bundled 比对(KTD-5),输出 current/stale/missing/unknown,作为 script-owned 确定性事实;label/evidence 必须带 `manifestVersion` basis,不承诺内容语义正确。
- 四状态独立渲染(见 High-Level Technical Design),不再用单一 baseline_ready 概括 runtime manifest freshness。
- `.sh` 与 `.ps1` 渲染对齐(执行期细节按现有结构定)。
- `verify-tools -AllRepos` 的 `mcp-verify-child-result.v1` 与 `workspace-mcp-verify-summary.v1` 增加 per-child manifest health 字段和 aggregate counts/next_action,避免父 workspace 只显示 `ready=18/18`。

**Patterns to follow:** 现有 `render-status-block.cjs` / `provider-readiness-renderer.cjs` 的分组渲染结构。

**Test scenarios:**
- Happy path:runtime manifest current 时显示 "Generated runtime manifest: current"。
- Edge case:旧 runtime(manifestVersion 落后)+ 新 binary → "stale",且与 baseline_ready=true 同时呈现、互不掩盖。
- Edge case:无 state.json → "missing"。
- Error path:state.json 不可读 → 退化为 missing/unknown 而非崩溃。
- Integration:`.sh` 与 `.ps1` 输出同一逻辑结论。
- Integration:`verify-tools -AllRepos` 在一个 child stale、其余 ready 的 fixture 下,父 summary 不得只报 `ready=18/18`;必须显示 stale child count 和对应 next_action。

**Verification:** 旧 runtime fixture 下输出含独立的 stale 行;all-repos summary 传播 per-child stale;命名不再出现误导性 "Harness runtime"。

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
- `--all-repos` 只在父 workspace(非当前 Git repo root 且发现 child repos)成立;在 Git repo 内显式报错,不 silent fallback 写当前 repo。

**Patterns to follow:** `init.js` 既有 flag 解析(:239,:269)与 `collectInteractiveInitTarget` 的 all-repos 构造。

**Test scenarios:**
- Happy path:`init --all-repos -y` 在多仓 fixture 下每子仓刷到当前 bundled version。
- Happy path:`init --repo <child> -y` 仅刷该子仓。
- Edge case:`--all-repos` 在当前 Git repo 内报错并提示从父 workspace 运行;无 child repo 的父目录给出明确 no-candidates/action-required,不退化写当前目录。
- Error path:`--repo <非 git 路径>` → 明确报错,不静默写父 workspace。
- Error path:`--all-repos` + `--repo` 互斥 → 用法错误退出码。
- Integration:flag 路径与交互 all-repos 路径产出一致的 per-child 写入与 workspace summary。

**Verification:** smoke 测试覆盖 `init --all-repos -y` / `--repo`;多仓 fixture 各子仓 manifestVersion 刷新。

---

### U5. P3:update 自动委托 fresh init 刷新 runtime + mcp-setup 复核

**Goal:** 让 `spec-first update` 升级成功后自动用 fresh `spec-first init` 覆盖刷新 runtime;setup/mcp-setup 继续读 P2 确定性事实并复核是否仍 stale。

**Requirements:** R6, R7, R8

**Dependencies:** U3(需要 P2 的 generated runtime manifest health 事实), U4(需要 `--all-repos` 入口)

**Files:**
- Modify: `skills/spec-mcp-setup/SKILL.md`(新增 prose:消费 generated runtime manifest health 事实 → 若 update 自动刷新后仍 stale,按 topology 提示/执行 `spec-first init [--all-repos|--repo]` → re-verify)
- Modify: `src/cli/index.js` / `src/cli/commands/update.js`(升级成功后 spawn fresh `spec-first init` 自动刷新 runtime;help/成功输出说明自动刷新与 fallback 命令)
- Test: `tests/unit/update-contracts.test.js`、`tests/unit/cli-entry-contracts.test.js`(update/root help 文案 contract)

**Approach:**
- update 在 `npm install -g` 成功后,启动一个新的 `spec-first init` 子进程刷新 runtime;不要在当前旧 Node 进程里直接调用 init 的生成函数。
- scope 选择保持简单:当前 Git repo 内跑 `spec-first init -y`;父 workspace 且发现 child repos 时跑 `spec-first init --all-repos -y`;无法安全判定时不 silent write,输出同两条 fallback 命令。
- prose 写清职责切分(KTD-6):脚本产 manifest health/topology 事实;update 负责自动刷新;LLM 在 mcp-setup 中只处理刷新失败、仍 stale 或 scope 需要人工判断的 degraded 情况。
- root help 与 update help 说明 update 会升级 CLI 并刷新 runtime,但刷新失败时需要按输出的 fallback 命令补跑 init。
- 不引入新状态机。

**Execution note:** prose 行为语义变更须按 `docs/contracts/workflows/fresh-source-eval-checklist.md` 跑 fresh-source eval(把磁盘上的 mcp-setup SKILL 源注入全新 subagent 评估),不依赖会话缓存的 skill 调用。

**Patterns to follow:** mcp-setup SKILL 既有的"script-owned facts vs LLM-owned judgment"行文。

**Test scenarios:**
- Happy path:update 在单仓中升级成功后调用 fresh `spec-first init -y`,并输出 refresh succeeded。
- Happy path:update 在父 workspace 中升级成功后调用 fresh `spec-first init --all-repos -y`,并输出 child summary。
- Edge case:自动刷新失败或 scope 不可判定 → update 返回/输出 degraded refresh 状态和 copy-ready fallback 命令,不得仍报全 ready。
- Error path(文案):update help/root help 不再把 refresh 写成纯下一步;必须说明 update 会自动刷新 runtime,并说明失败时如何补跑 init。
- Eval:mcp-setup 在"update 后仍 stale"情境下会提示/执行对应 init 并 re-verify,而非直接报 ready。

**Verification:** update contract tests 覆盖 auto-refresh/fallback 文案与子进程调用;fresh-source eval 通过并记录;mcp-setup 输出与 update 行为一致。

---

## System-Wide Impact

- **Interaction graph:** P0 改 transform 影响**所有 skill** 的 runtime 生成,不止 mcp-setup;U2 须抽样多个 skill 断言无回归。P2 改 setup 输出影响 mcp-setup 工作流呈现、single-repo ledger 与 all-repos workspace summary。P3 改 init flag 与 update 自动刷新影响所有 init/update 调用方(smoke / 文档 / 用户脚本)。
- **Error propagation:** P2 manifest health 行读 state.json 失败须退化为 missing/unknown,不可让 setup 崩溃(warn-and-continue)。
- **State lifecycle risks:** P0 修复后需 `spec-first init` 重新生成本仓 runtime mirror,使现有被污染的 `.agents/skills/**`、`.claude/spec-first/workflows/**` 恢复——属正常 runtime 再生,不是 source 改动。
- **API surface parity:** P0 双宿主同改;P3 flag 须在 Claude / Codex 两宿主语义一致。
- **Surface coverage:** CLI(init/update/root help)→ in-scope;双宿主 adapter → in-scope;setup 渲染脚本与 verify-tools(.sh/.ps1)→ in-scope;Serena/uv 跨平台 → deferred(独立 issue)。
- **Integration coverage:** U2 用真实 adapter transform 输出断言(非 mock);U4 smoke 覆盖真实 CLI 路径;U5 覆盖 update fresh subprocess refresh 与 fresh-source eval prose 语义。
- **Unchanged invariants:** source/runtime 边界不变(仍只改 source,runtime 由 init 再生);init 的 drift→hard-reset 覆盖机制不变;update 不在旧进程内直接执行 runtime generator 的版本错位约束不变。

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| 语义守卫漏判新写法的 SoT 句(启发式固有缺陷) | U2 的 preserve-set + known-pattern no-self-contradiction 兜底,并用 fresh-source eval 审 prose 行为;不要把脚本护栏描述成任意语义理解 |
| 守卫过度保留,误伤操作性引用(如 spec-plan references 读) | U1/U2 显式反向断言操作性行必须被改写;枚举数据已列出双侧样本 |
| claude.js 无保护脚手架,双改易只改一半 | KTD-3 共享常量 + helper,U1 强制双适配器调用同一逻辑;U2 双宿主各断言一遍 |
| P3 `--repo` 与 workspace target resolver 接线复杂 | 沿用既有 selection_source 门槛与 `resolve-project-target` 契约;执行期按真实契约接线,error path 测试守住"不静默写父 workspace" |
| P2 .sh/.ps1 双 runner 漂移 | U3 集成断言两 runner 同结论;依现有渲染脚本共享结构 |
| `verify-tools -AllRepos` 汇总仍只看 baseline_ready | U3 明确修改 child result/workspace summary schema,并加一 stale child fixture 验证 aggregate 不再误报全 ready |
| update 误在旧进程内直接生成 runtime | U5/R8 明确只能 spawn 升级后的 fresh `spec-first init` 子进程,并用 contract test 检查刷新调用路径 |
| update 文案与行为再次漂移 | U5/R8 把 `update-contracts` 与 root CLI help contract 纳入验证,保证 help/成功输出同时说明自动刷新与失败 fallback |
| 本仓 dirty worktree(大量无关 docs 改动) | 实施在独立分支/worktree;只 stage 本计划相关文件,避免裹挟 |

---

## Documentation / Operational Notes

- 任一 source 变更须按仓库格式更新 `CHANGELOG.md`(作者取 `~/.spec-first/.developer`),用户可见的(P2 输出、P3 flag、update 文案)追加 `(user-visible)`。
- P3/R8 新增 flag 与 update 自动刷新行为须更新 `README.md` / `README.zh-CN.md` 的 init/update 用法、`spec-first init -h` help、root `spec-first --help`、`spec-first update --help`。
- P0/P1 修复后在本仓跑 `spec-first init` 再生 runtime,使现有污染的 runtime mirror 恢复;提交时一并更新 generated runtime expectations(若测试快照涉及)。
- 跨宿主改动按 CLAUDE.md 要求跑 `npm run typecheck`、`test:unit`、`test:smoke`,并 `spec-first init` 验证双宿主再生。

---

## Sources & References

- Related code: `src/cli/adapters/codex.js:281`、`src/cli/adapters/claude.js:224`、`src/cli/host-comparative-workflows.js`、`src/cli/commands/init.js:461,685,842,1754`、`src/cli/commands/update.js:11`、`src/cli/index.js:161`、`src/cli/commands/doctor.js:846`
- Setup 渲染:`skills/spec-mcp-setup/scripts/render-status-block.cjs`、`setup-plan-renderer.cjs`、`write-setup-facts.{sh,ps1}`、`verify-tools.{sh,ps1}`、`skills/spec-mcp-setup/SKILL.md`
- 测试挂载:`tests/unit/init-source-path-coverage.test.js`、`tests/unit/update-contracts.test.js`、`tests/unit/cli-entry-contracts.test.js`
- 契约:`docs/contracts/workflows/fresh-source-eval-checklist.md`、`docs/10-prompt/结构化项目角色契约.md`(source/runtime 边界、scripts-prepare/LLM-decides)
