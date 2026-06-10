---
title: "docs: 文档化 base:<sha> 作为 code-review 手动增量复审路径"
type: docs
status: completed
date: 2026-06-09
completed_at: 2026-06-10
plan_depth: lightweight
spec_id: 2026-06-09-001-code-review-incremental-scope
---

# docs: 文档化 base:<sha> 作为 code-review 手动增量复审路径

## Summary

本计划的初版提出给 spec-code-review 新增一套增量/delta 复审机制(新脚本 + repo-local state 文件 + SKILL prose + 5 个实现单元)。经 4 个 doc-reviewer 对照真实源码对抗式评审后**否决了重型方案**,收敛为 20% 版本:

**spec-code-review 已有 `base:<sha-or-ref>` token(SKILL.md 行 110),走 fast-path 直接用作 diff base 并跳过全部 scope 检测。用户重审同一分支时传上次复审到的 HEAD SHA,即等价于增量复审——零新机制。** 本期工作仅为把这条既有能力**文档化**为显式的「手动增量复审」用法,让用户/调用方知道它存在。

完整评审证据与否决理由见本文「Rejected Heavy Mechanism」一节,供后续检索,避免重复提案。

---

## Completion Evidence

**状态:`completed`(2026-06-10)。**

已按 20% 方案完成 docs-only 收口:

- `skills/spec-code-review/SKILL.md` 的 Argument Parsing 表补充 `base:<sha-or-ref>` 可用于同分支手动增量复审:传上次复审的 HEAD SHA,只审后续变更。
- `skills/spec-code-review/SKILL.md` 的 `base:` fast-path 段补充交互用户用法,并明确这只缩小 diff 范围,不承诺跨运行 finding 去重。
- `CHANGELOG.md` 已记录本次 docs(review) 用户可见变更。
- README / README.zh-CN 仅有 `$spec-code-review` 入口级说明,无参数级用法表,本切片无需同步。

验证:

- `rg -n "manual incremental re-review|last completed review|no cross-run finding deduplication|手动增量复审|只审后续变更|README 无参数级说明" skills/spec-code-review/SKILL.md CHANGELOG.md`
- `git diff --check -- skills/spec-code-review/SKILL.md CHANGELOG.md docs/plans/2026-06-09-001-feat-code-review-incremental-scope-plan.md`
- `rg -n "[ \t]+$" docs/plans/2026-06-09-001-feat-code-review-incremental-scope-plan.md`
- `npm run lint:skill-entrypoints`

本次不新增脚本、state 文件、argument token 或 runtime mirror 变更。

## Direct Evidence

- target_repo: spec-first
- source_refs:
  - `skills/spec-code-review/SKILL.md`(行 103-113 Argument Parsing;行 277-292 `base:` fast-path;行 1053 metadata 时机)
  - `skills/spec-work/SKILL.md`(行 197:显式传 `base:<pre_task_base>`)
  - `skills/lfg/SKILL.md`(行 28:`mode:autofix`,一次性首审,不传 base:)
- discovery_methods: 全文 Read + 评审 workflow 4 reviewer 对照核验 + 本人复核行 110/277/292/1053/197/28
- confidence: high(所有关键断言均已直接 grep/read 核验)
- limitations: 无(轻量文档变更,无运行时风险)

---

## Context & Research

### 评审如何改变方案

初版假设需要持久 state 记录「上次复审位置」。评审对照源码发现:

1. **`base:<sha>` 已提供手动增量(已核验,SKILL.md 行 110/277/292)**:`base:` 走 fast-path,直接用作 diff base、跳过 scope 检测。传上次 HEAD SHA = 增量复审,零成本。初版完全没考虑这个 do-nothing 基线。
2. **自动化 caller 多数已传 `base:`(已核验)**:spec-work 行 197 显式传 `base:<pre_task_base>`——原方案的「增量层」对它根本不触发,D4 防护是伪命题。
3. **lfg 是一次性首审(已核验,行 28)**:`mode:autofix` 无 base:,但它在 pipeline 里只审一次、非重复复审,增量概念对它不适用。
4. **A4(metadata SHA 时机)不是 bug(已核验,行 1053)**:SKILL.md 已明确写「Capture branch and head_sha at dispatch time (before any autofixes land)」——初版误判为 bug,撤回。
5. **ROI 不成立**:增量复审是 CodeRabbit 那类云端高频 PR bot 的形态;spec-first 是本地 CLI、单人、单会话。重型 state 机制违反 CLAUDE.md 抗膨胀红线与 80/20。

### 为什么仍值得做这一步

`base:` 的增量用法**现状未被文档化**为「重复复审」场景——用户不知道可以这么用。补一行文档是真实增益,且零维护面。

---

## Goals

- 让用户与调用方知道:重审同一分支时传 `base:<上次复审的 HEAD SHA>` 即可只审增量。
- 零新机制、零 state 文件、零运行时风险。

## Non-Goals

- 不新增脚本、state 文件、argument token(`scope:full` / `scope:incremental` 均不引入)。
- 不做 per-finding 跨运行去重、carried-forward 结构化、跨机器 state。
- 不改 `base:` 的解析逻辑或 fast-path 行为。
- 不动 metadata.json 时机(行 1053 已正确)。

---

## Implementation Units

### U1. 文档化 base:<sha> 的增量复审用法

**Goal**: 在 SKILL.md 让 `base:<sha>` 的「重复复审只看增量」用法显式可见。

**Requirements**: 两个 Goal。

**Dependencies**: 无。

**Files**:
- `skills/spec-code-review/SKILL.md`(Argument Parsing 表 行 105-113 附近;`base:` fast-path 说明 行 277-292 附近)

**Approach**:
- 在 Argument Parsing 表 `base:` 行的 Effect 或紧邻处补一句:重复复审同一分支时,传上次复审到的 HEAD SHA 作为 `base:`,即只复审自那次以来的新提交(手动增量复审)。
- 在 fast-path 段(行 292 附近,已有「Automated callers should prefer this」)补一句面向交互用户的增量用法说明,与现有自动化 caller 说明并列。
- 措辞保持 light:不引入新概念名,不承诺降噪/去重(诚实——`base:` 只缩小 diff 范围,reviewer 仍会对新范围独立分析)。
- 不新增表格行 token;`base:` 已存在,只是补充用法说明。

**Patterns to follow**: Argument Parsing 表现有行格式;fast-path 段现有「Automated callers」说明句式。

**Test scenarios**: `Test expectation: none -- 纯文档说明,无行为变更;由 U2 的文档治理检查覆盖`。

**Verification**: SKILL.md 渲染正常;说明准确(不夸大为去重);`npm run lint:skill-entrypoints` 通过(若覆盖该文件结构)。

### U2. CHANGELOG 与既有用户文档同步

**Goal**: 记录这条文档增益;确认无其他 user-facing 文档需更新。

**Requirements**: CLAUDE.md 文档与 changelog 治理。

**Dependencies**: U1。

**Files**:
- `CHANGELOG.md`(作者读 `~/.spec-first/.developer`;判断是否标 `(user-visible)`——这是文档澄清既有能力,非新行为,倾向不标或标注「docs」)
- `README.md` / `README.zh-CN.md`(若有 code-review 用法描述则补一句;否则记录「无需」)

**Approach**:
- CHANGELOG 记「文档化 `base:<sha>` 的手动增量复审用法」,归类 docs。
- 检查 README 是否有 code-review argument 说明;有则同步,无则记录无需。

**Test scenarios**: `Test expectation: none -- 文档变更`。

**Verification**: CHANGELOG 格式校验通过;README 检查有结论。

---

## Verification

- `npm run typecheck`(若触及结构);`npm run lint:skill-entrypoints` 验证 skill 入口治理未被破坏。
- 人工确认 SKILL.md 新增说明不夸大 `base:` 能力(只缩小范围,非去重)。

## Risks & Mitigations

| 风险 | 缓解 |
|---|---|
| 用户误以为 `base:` 增量用法能去重/不重报旧 finding | U1 措辞明确「只缩小 diff 范围,reviewer 仍独立分析新范围」 |
| 用户不知道怎么拿「上次复审的 SHA」 | fast-path 说明里举例(如 `git rev-parse HEAD` 记录或从上次复审输出);保持一句话 |

## Rejected Heavy Mechanism(留档,避免重复提案)

初版方案(新脚本 `incremental-scope.sh` + repo-local state + `scope:full` token + U1–U5)被对抗式评审否决,核心理由:

- **已有 `base:<sha>` 覆盖 80% 价值**,重型 state 机制是把云端 PR bot 形态错配到本地 CLI 单人场景(违反抗膨胀 + 80/20)。
- **技术上还有真缺陷**:`set -euo pipefail` 与 `git merge-base --is-ancestor` 的 exit-128 三态冲突会破坏降级;scope-key 无类型前缀导致 PR#42 与分支"42"碰撞;D5 carried-forward 只存提示不存结构化 finding,兑现不了「降噪」卖点。
- **D4 防护伪命题**:主要自动化 caller(spec-work)已显式传 `base:`,增量层对它不触发。

若未来有**确凿用户证据**(用户实际在本地对同一分支跑 3+ 次复审且受重复 finding 困扰)且 `base:<sha>` 手动路径被证明摩擦过大,再考虑重开计划评估——届时需先解决上述三个技术缺陷,并优先考虑「结构化 prior-finding 注入」而非仅缩小 diff。

## Open Questions

- CHANGELOG 是否标 `(user-visible)`:倾向归 docs(澄清既有能力,非新行为)——执行时按仓库治理判定。
