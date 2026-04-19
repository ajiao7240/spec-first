---
title: "refactor: Remove spec-bootstrap workflow"
type: refactor
status: active
created: 2026-04-19
author: Claude
depth: medium
---

# refactor: Remove spec-bootstrap workflow

## Overview

这份文档是“删除 `skills/spec-bootstrap` 的最小改造清单”，目标是把当前仍然并行存在的旧 Stage-0 入口 `spec-bootstrap` 从源码、runtime 安装面、治理契约、测试与对外文档中**完整退场**，并把用户入口、治理叙事与验证闭环统一收敛到 `spec-graph-bootstrap` / `spec-compound` 所代表的新路径。

本文档只覆盖**最小必要改造**，不顺带重构 Stage-0 总体架构，不扩大到无关 workflow，也不在本轮重新设计 bootstrap 家族的产品矩阵。

## Problem Frame

当前仓库里 `spec-bootstrap` 仍是一个活跃资产，而不是历史残留：

- `skills/spec-bootstrap/SKILL.md` 仍定义 `/spec:bootstrap` / `$spec-bootstrap` 入口
- `templates/claude/commands/spec/bootstrap.md` 仍把 `.claude/spec-first/workflows/spec-bootstrap/SKILL.md` 作为运行时真源
- `.claude-plugin/plugin.json` 与 `src/cli/contracts/dual-host-governance/skills-governance.json` 仍把它当作正式 workflow 交付
- `skills/using-spec-first/SKILL.md` 仍把 bootstrap 路由到 `spec-bootstrap`
- smoke / unit tests 仍显式断言它会被安装到 Claude/Codex runtime

因此，删除 `skills/spec-bootstrap` 不是“删一个目录”，而是一次**入口撤役（decommission）**：只删源码目录会同时打断命令模板、runtime 同步、治理契约和测试闭环。

## Requirements Trace

- R1. 删除后，仓库中不再存在 `spec-bootstrap` 作为可安装、可路由、可测试的正式 workflow 资产。
- R2. Claude 侧 `/spec:bootstrap` 命令入口必须一起撤役，不能留下指向缺失 runtime skill 的悬空模板。
- R3. `using-spec-first` 的 Stage-0 路由必须改为只指向仍然保留的入口，避免继续把请求导向已删除 workflow。
- R4. dual-host governance、plugin manifest、runtime 安装与 smoke tests 必须同步收口，不能出现“源码删了但 runtime contract 还认为它存在”的分叉。
- R5. 所有“当前用户仍可通过 README / 手册 / docs 发现并尝试使用 `spec-bootstrap`”的 active 文档都必须改口径；历史计划/历史分析文档保留为历史记录，不做全量批改。
- R6. 迁移顺序必须先完成替代入口和 contract 收口，再删除文件，避免中间态出现不可执行 runtime。
- R7. 任何源码改动都必须同步更新 `CHANGELOG.md`。

## Scope

### In Scope

- 移除 `skills/spec-bootstrap/` 及其 docs mirror
- 移除 Claude `templates/claude/commands/spec/bootstrap.md`
- 更新 `using-spec-first` 的路由口径
- 更新 plugin/governance/runtime 安装真源
- 更新直接依赖 `spec-bootstrap` 存在性的 unit/smoke tests
- 更新仍面向当前用户的 active 文档与 README 口径
- 补齐删除后的最小验证闭环

### Out of Scope

- 不重写 `spec-graph-bootstrap` / `spec-compound` 的核心流程
- 不新增新的 Stage-0 workflow 名称
- 不批量清理历史 plans / brainstorms / analysis 文档里所有 `spec-bootstrap` 字样
- 不把本轮扩展成“Stage-0 体系全面重构”
- 不处理用户本地已安装 runtime 的自动迁移脚本；`init`/文档说明是本轮已知承接面，`doctor` 是否需要补迁移提示需在实现前按源码事实确认

## Decisions

### D1. 采用“硬删除 + 路由收口”，不保留兼容壳

本轮目标是删除 `spec-bootstrap`，因此不建议保留一个空壳 skill 或转发模板。保留壳会延长双入口并存状态，继续制造发现面歧义。

### D2. `/spec:bootstrap` 的用户意图统一收敛到现存 Stage-0 入口

删除后，Stage-0 路由口径应只保留：

- `/spec:graph-bootstrap`
- `/spec:compound`

如需在文档中描述替代关系，应明确说明：

- 图谱 / Stage-0 上下文构建 → `spec:graph-bootstrap`
- 更偏知识捕获 / 复合上下文构建 → `spec:compound`

本轮**不**保留 `/spec:bootstrap` 别名。

### D3. 历史文档按“记录”处理，active 文档按“产品面”处理

凡是当前 README、手册、治理 README、当前 skill mirror、当前命令模板、当前测试基线，必须同步更新。历史计划、需求、审计、归档文档不要求全量替换，只在本轮新增的删除计划中说明该边界即可。

## Affected Files

### Must remove

- `skills/spec-bootstrap/SKILL.md`
- `skills/spec-bootstrap/references/prd-template.md`
- `skills/spec-bootstrap/references/database-prd-template.md`
- `docs/10-prompt/skills/spec-bootstrap/SKILL.md`
- `docs/10-prompt/skills/spec-bootstrap/references/prd-template.md`
- `docs/10-prompt/skills/spec-bootstrap/references/database-prd-template.md`
- `templates/claude/commands/spec/bootstrap.md`

### Must modify

- `skills/using-spec-first/SKILL.md`
- `docs/10-prompt/skills/using-spec-first/SKILL.md`
- `src/cli/contracts/dual-host-governance/skills-governance.json`
- `.claude-plugin/plugin.json`
- `tests/smoke/cli.sh`
- `tests/unit/dual-host-governance-contracts.test.js`
- `tests/unit/spec-bootstrap-contracts.test.js`
- `README.md`
- `README.zh-CN.md`
- `docs/05-用户手册/README.md`
- `docs/05-用户手册/01-快速开始.md`
- `docs/05-用户手册/02-核心概念.md`
- `docs/05-用户手册/04-常见问题.md`
- `docs/05-用户手册/06-本地源码安装.md`
- `docs/contracts/dual-host-governance/README.md`
- `CHANGELOG.md`

### Active product-surface facts that must be rewritten, not just grep-trimmed

以下位置当前把 `spec-bootstrap` 定义为有效产品面，实施时必须按“矩阵/能力说明重写”处理，不能只做删词：

- `README.md` 中的 Stage-0 入口矩阵（当前把 `/spec:bootstrap` / `$spec-bootstrap` 标成 `Default entry` / `Stable`）
- `README.zh-CN.md` 中对应的 Stage-0 入口矩阵
- `docs/05-用户手册/01-快速开始.md` 中“默认稳定入口”说明与安装成功信号
- `docs/05-用户手册/02-核心概念.md` 中 `spec-bootstrap` 章节与它和 `spec-graph-bootstrap` 的关系说明
- `docs/05-用户手册/04-常见问题.md` 中 runtime 路径、skill 列表与推荐入口说明
- `docs/05-用户手册/06-本地源码安装.md` 中“测试两个 Stage-0 入口 / 双入口安装成功”说明

### Must confirm before implementation

- `doctor` 当前是否已经能正确处理“已删除 spec-bootstrap 后的迁移提示或残留诊断”；在未 grep/阅读对应实现前，不把 `doctor` 视为已足够承接迁移

### May modify after exact grep confirmation

以下文件只在确认其仍承担当前用户发现面/治理口径时再改：

- `AGENTS.md`
- `docs/项目介绍/README.md`
- `docs/08-版本更新/README.md`
- 其他仍把 `spec-bootstrap` 当成当前入口陈述的 active README / guide

## Minimal Implementation Units

### [ ] Unit 1 — 收口入口与治理真源

**Goal**

先让仓库的“当前产品面”不再把 `spec-bootstrap` 当作正式入口，避免删除源码后仍有路由继续指向它。

**Requirements**

R1, R2, R3, R4

**Dependencies**

无

**Files**

- `skills/using-spec-first/SKILL.md`
- `docs/10-prompt/skills/using-spec-first/SKILL.md`
- `src/cli/contracts/dual-host-governance/skills-governance.json`
- `.claude-plugin/plugin.json`
- `docs/contracts/dual-host-governance/README.md`
- Test files that assert governance/product surface

**Approach**

- 从 `using-spec-first` 路由规则中删除 `spec-bootstrap`，把 Stage-0 路由表收口到 `spec-graph-bootstrap` / `spec-compound`
- 从 governance JSON 中移除 `spec-bootstrap` 条目
- 从 plugin manifest 中移除 `spec-bootstrap` skill/command 交付声明
- 更新 dual-host governance README，使其不再把 `bootstrap` 记为有效 workflow command

**Starting point**

`src/cli/contracts/dual-host-governance/skills-governance.json`

**Patterns to follow**

- `docs/plans/2026-04-16-015-dual-host-governance-runtime-contract-relocation-plan.md`
- `skills/using-spec-first/SKILL.md`

**Test scenarios**

- Governance 真源中不再存在 `spec-bootstrap`
- `using-spec-first` 不再把 Stage-0 请求路由到 `spec-bootstrap`
- plugin manifest 不再安装 `spec-bootstrap`

**Verification**

实现后，新的治理真源、路由真源与对外治理 README 对 `spec-bootstrap` 的“当前可用入口”表述一致。

### [ ] Unit 2 — 删除源码与 runtime 命令模板

**Goal**

删除 `spec-bootstrap` 源 skill、mirror 和 Claude command template，完成源码级撤役。

**Requirements**

R1, R2, R4

**Dependencies**

Unit 1

**Files**

- Remove `skills/spec-bootstrap/`
- Remove `docs/10-prompt/skills/spec-bootstrap/`
- Remove `templates/claude/commands/spec/bootstrap.md`

**Approach**

- 在入口与治理已收口后，再物理删除源码目录与命令模板
- 不保留 forwarding shell / compatibility wrapper
- 同步确认不会有其余 source-of-truth 文件继续引用这些路径作为必装 runtime 资产

**Starting point**

`templates/claude/commands/spec/bootstrap.md`

**Patterns to follow**

- 本仓现有对 retired skill 的硬删除方式
- `docs/solutions/workflow-issues/modify-source-not-artifacts-2026-04-13.md`

**Test scenarios**

- source tree 中不再存在 `skills/spec-bootstrap/`
- source tree 中不再存在 `templates/claude/commands/spec/bootstrap.md`
- runtime 安装后不再生成 `.claude/spec-first/workflows/spec-bootstrap/` 或 `.agents/skills/spec-bootstrap/`

**Verification**

源码与 runtime 安装面都不再产出 `spec-bootstrap` 相关文件。

### [ ] Unit 3 — 更新测试闭环

**Goal**

把所有“断言 spec-bootstrap 存在”的测试收口到删除后的新事实，避免 CI 因历史断言失败。

**Requirements**

R4

**Dependencies**

Unit 1, Unit 2

**Files**

- `tests/smoke/cli.sh`
- `tests/unit/dual-host-governance-contracts.test.js`
- `tests/unit/spec-bootstrap-contracts.test.js`
- Other direct tests found by grep

**Special focus**

- `tests/smoke/cli.sh` 中不仅有 runtime 安装断言，还有 `npm pack` / tarball payload 断言；当前它显式要求 pack 输出包含 `skills/spec-bootstrap/SKILL.md`，删除方案必须同步改写这部分发布验证，而不是只修改 runtime copy 断言

**Approach**

- 删除专门守护 `spec-bootstrap` 存在性的 contract tests
- 对 smoke tests：去掉对 bootstrap command template / runtime asset 的存在性断言，改成断言其**不存在**，或把 coverage 转移到 `spec-graph-bootstrap` 的现有断言上
- 若 `tests/unit/spec-bootstrap-contracts.test.js` 只服务于该 workflow，本轮应直接删除整个测试文件，而不是留空壳

**Starting point**

`tests/unit/spec-bootstrap-contracts.test.js`

**Patterns to follow**

- 当前仓库对 retired source contract 的删除方式
- `tests/smoke/cli.sh` 中现有对 workflow runtime copy 的断言风格

**Test scenarios**

- `npm run test:jest` 不再包含针对 `spec-bootstrap` 的失败断言
- smoke 不再期望 runtime 安装 `spec-bootstrap`
- governance tests 仍覆盖剩余 workflow catalog 的合法性

**Verification**

删除后测试表达的是“`spec-bootstrap` 已退场”的新事实，而不是简单跳过验证。

### [ ] Unit 4 — 更新 active 文档与迁移说明

**Goal**

让当前用户不会再从 README / 手册里发现并尝试使用已删除入口，并把当前产品矩阵从“双入口并行”改写为删除后的新事实。

**Requirements**

R5, R7

**Dependencies**

Unit 1

**Files**

- `README.md`
- `README.zh-CN.md`
- `docs/05-用户手册/README.md`
- `docs/05-用户手册/01-快速开始.md`
- `docs/05-用户手册/02-核心概念.md`
- `docs/05-用户手册/04-常见问题.md`
- `docs/05-用户手册/06-本地源码安装.md`
- `CHANGELOG.md`
- Other active docs confirmed by grep

**Document-specific expectations**

- `README.md` / `README.zh-CN.md`：必须重写 Stage-0 入口矩阵，不再保留 `Default entry` / `Stable` 对 `spec-bootstrap` 的旧定位
- `docs/05-用户手册/06-本地源码安装.md`：必须把“两个 Stage-0 入口均可见即安装成功”的判定改成删除后的新安装事实
- 所有 active 文档中的迁移说明都应避免暗示 `/spec:bootstrap` 仍是兼容别名

**Approach**

- 删除 `spec-bootstrap` 作为当前入口的描述
- 把需要保留的用户意图迁移到 `spec-graph-bootstrap` / `spec-compound`
- 对 FAQ / 手册增加一句迁移说明：旧 `spec-bootstrap` 已移除，请改用新的 Stage-0 入口
- 按仓库治理补 `CHANGELOG.md`

**Starting point**

`README.md`

**Patterns to follow**

- `README.zh-CN.md` 与 `README.md` 的双语同步方式
- 仓库现有 CHANGELOG 追加格式

**Test scenarios**

- README 不再把 `/spec:bootstrap` / `$spec-bootstrap` 列为可用入口
- 用户手册中的 Stage-0 指引只引用现存入口
- CHANGELOG 有一条与本轮删除对应的记录

**Verification**

用户从当前文档表面已无法发现 `spec-bootstrap` 是可用命令。

## Migration Order

严格按以下顺序执行：

1. 收口治理与路由真源（Unit 1）
2. 删除源码与命令模板（Unit 2）
3. 更新测试闭环（Unit 3）
4. 更新 active 文档与 changelog（Unit 4）
5. 跑完整验证并人工检查仓库内残余引用

顺序原因：

- 先删源码会导致命令模板、governance、tests 同时悬空
- 先收口入口可以确保中间态仍然有一致的“当前产品面”
- 测试应在新事实稳定后再改，避免断言目标来回变化

## Deferred / Not In This Plan

以下问题明确延后，不纳入本轮最小清单：

- 是否为旧用户提供专门的运行时报错文案或迁移提示 wrapper
- 是否新增 `doctor` 针对已删除 runtime 资产的专项提示
- 是否批量清理历史 plans / brainstorms / archive / 审计文档中的全部 `spec-bootstrap` 提及
- 是否进一步重命名 `spec-graph-bootstrap` / `spec-compound` 的产品分工

## Risks

- **风险 1：文档删改不完整**：README 收口了，但 FAQ/手册仍提示旧入口，用户会继续尝试无效命令。
- **风险 2：测试只删不补**：简单删除测试可能造成 Stage-0 产品面缺少回归保护，应把必要 coverage 转移到“`spec-bootstrap` 已退场”的新事实。
- **风险 3：governance/runtime 漂移**：只删 skill 目录但不删 governance/plugin 条目，会让 init/install 仍尝试分发已不存在资产。

## Done Signals

1. 源码树中已无 `skills/spec-bootstrap/`、docs mirror、Claude bootstrap command template
2. `using-spec-first`、governance JSON、plugin manifest 不再把 `spec-bootstrap` 视为当前有效入口
3. 直接依赖其存在性的 tests 已删除或改写为新事实断言
4. 当前 README / 用户手册不再宣传 `/spec:bootstrap` / `$spec-bootstrap`
5. `CHANGELOG.md` 已记录本次删除
6. `git grep "spec-bootstrap"` 仅剩历史文档、历史计划、归档或明确允许保留的迁移说明，不再命中 active runtime/source-of-truth 文件

## Suggested Verification Matrix

- `npm run test:jest`
- `npm run test:smoke`
- 人工检查安装产物中不再生成：
  - `.claude/spec-first/workflows/spec-bootstrap/`
  - `.agents/skills/spec-bootstrap/`
- 人工 `git grep "spec-bootstrap"`，确认剩余引用都属于历史记录或迁移说明
