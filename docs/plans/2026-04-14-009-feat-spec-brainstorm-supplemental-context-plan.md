---
title: "feat: implement supplemental context for spec-brainstorm"
type: feat
status: completed
date: 2026-04-14
origin: docs/业界分析/13.spec-brainstorm-追平后增强版-外部上下文架构方案-2026-04-14.md
---

# feat: implement supplemental context for spec-brainstorm

## Overview

把 `spec-brainstorm` 从当前的 repo-context-only 工作流，升级为受当前产品边界约束的 `Supplemental Context` 版本：保留上游 `ce-brainstorm` 中与方法论质量直接相关、且不依赖 Slack 的能力，同时新增 `Local Docs`、`GitHub URL`、`Web URL`、`Docs URL` 的路由与 adapter contract，并补齐最小 contract / smoke 回归。

## Problem Frame

当前 `skills/spec-brainstorm/SKILL.md` 仍停留在上一轮同步后的基础态：

- 没有吸收上游 `ce-brainstorm` 的部分非 Slack 方法论护栏
- 没有 `Supplemental Context` 路由
- 缺少 `universal-brainstorming.md` 和 `visual-communication.md`
- 对 `find-skills`、`learnings-researcher`、`agent-browser`、现有 research agents 的协作边界没有落到代码

而新的产品边界已经明确：

- 不引入 `Slack context`
- 只维持 `Claude` 和 `Codex`
- `find-skills` 只能作为环境可选 fallback
- `GitHub`、`Web/Docs URL`、本地文档共同组成当前增强方向

因此这次工作不是简单补 6 个新 agent，而是要把 `spec-brainstorm` 的 skill contract、reference、adapter 边界、运行时安装行为和测试面一次收口，确保实现后既追平当前方案文档，也不破坏现有 repo-owned workflow 分发模型。

## Requirements Trace

- R1. `spec-brainstorm` 必须吸收上游非 Slack 方法论护栏：任务域识别、非软件任务分流、先问用户已有想法、至少一个非显然角度、先展示方案再评估、requirements visual guidance。
- R2. `spec-brainstorm` 必须建立 `Existing and Supplemental Context Scan` 路由，覆盖 `local-doc`、`feishu-chat`、`feishu-doc`、`github-url`、`web-url`、`docs-url`；其中外部 supplemental context 必须是 **opt-in / source-driven**：只有用户显式给出链接、文档、路径，或明确要求引入该类外部上下文时才可 dispatch，对 topic 本身不得做自动外部搜索。
- R3. 所有 supplemental source 必须统一输出 `research digest` contract；其 `status` 枚举在本计划中一次性冻结为 `success | no-result | tool-unavailable | permission-denied | source-unparseable | executor-unavailable`。brainstorm core 消费 digest 时须对 5 种失败状态均有显式处理分支，不允许各 agent 自行发明近义状态名。
- R4. `local-doc-reader` 与 `learnings-researcher` 必须职责分离，避免对 `docs/solutions/` 重复扫描和重复摘要。
- R5. `github-context-reader`、`web-context-reader`、`docs-context-reader` 必须作为稳定 adapter contract 落地，优先复用现有 `issue-intelligence-analyst`、`best-practices-researcher`、`framework-docs-researcher`、`agent-browser`，而不是机械重造。
- R6. `find-skills` 必须被实现为环境可选 fallback，不得被假设为 repo-bundled 能力；Codex 场景不可假设可用。
- R8. 新增/修改的 workflow assets 必须通过现有 bundling 机制随 `init --claude` / `init --codex` 进入 runtime，不新增 public command，不新增平台分发结构。
- R9. 本次代码改动必须带上最小 unit/smoke 回归，并同步更新 `CHANGELOG.md`；作为显著 workflow 增强，也要更新 `docs/08-版本更新/README.md`。

## Scope Boundaries

- 不包含 `Slack context`、`slack-researcher`、Slack MCP 接入
- 不包含多平台扩展，仍只支持 `Claude` / `Codex`
- 不包含新增 public slash command；`spec-brainstorm` 仍是现有命令映射的 command-backing workflow
- 不包含在 CLI 核心增加新的 command/router 入口；除非测试证明 bundling 无法承接，否则主实现落点仍在 `skills/`、`agents/`、`tests/`

## Context & Research

### Relevant Code and Patterns

- `skills/spec-brainstorm/SKILL.md`
  当前主 workflow 合同落点，仍使用 command-backing workflow 的内部 source name（`brainstorm-workflow`）。

- `skills/spec-brainstorm/references/requirements-capture.md`
  当前 requirements capture 模板尚未接入 visual communication guidance，是补 reference 的直接落点。

- `.claude-plugin/plugin.json`
  `spec-brainstorm` 已是既有 command-backed workflow；本次增强不需要新增 command manifest 项。

- `src/cli/skills.js`、`src/cli/agents.js`、`src/cli/plugin.js`
  仓库内 `skills/`、`agents/` 已经由 bundling 机制自动分发到 runtime，因此新增 research agent 文件不需要额外 CLI plumbing。

- `src/cli/adapters/codex.js`
  Codex runtime 会在分发时把 source skill 的 `name:` 改写为 runtime skill 名。因此 source 文件应保持 repo 内部命名约定，不应为追求运行时名字而破坏 source 合同。

- `src/cli/adapters/claude.js`
  Claude runtime 会重写 canonical agent names，但不会改写 workflow source frontmatter。这进一步说明 source 层应保持 repo 既有模式，runtime 名称靠适配器与安装产物保证。

- `agents/research/learnings-researcher.md`
  已经是 `docs/solutions/` 专用检索器，应继续承担 institutional knowledge 检索，不应被 `local-doc-reader` 吞并。

- `agents/research/issue-intelligence-analyst.md`
  适合 issue landscape / theme clustering，不等价于“读取用户给定 GitHub URL 并产出 digest”。

- `agents/research/best-practices-researcher.md`
  面向开放式外部技术调研，不等价于“对给定 URL 做稳定 digest”。

- `agents/research/framework-docs-researcher.md`
  面向框架/库文档调研，不等价于“对用户给定 docs URL 提取当前 brainstorm 相关约束”。

- `.agents/skills/agent-browser/SKILL.md`
  可作为页面型 source 的底层执行器，但不应直接被当作完整 supplemental adapter。

- `tests/unit/spec-graph-bootstrap-contracts.test.js`
  现有 contract test 风格是“直接读 repo assets 文本并断言 contract 字符串/结构”，适合作为 `spec-brainstorm` unit contract 的实现模式。

- `tests/smoke/cli.sh`
  已覆盖 `init --claude` / `init --codex` 后 workflow/runtime assets 的安装结果；本次应在现有 smoke 上补新 agents / 新 references / 新关键文案断言。

- `docs/contexts/spec-first/00-summary.md`、`docs/contexts/spec-first/architecture/module-map.md`、`docs/contexts/spec-first/code-facts/public-entrypoints.md`
  Stage-0 上下文显示当前仓库仍是单包 CLI + repo-owned workflow assets 的结构，说明本次工作应优先保持 asset-driven 架构，不向 CLI command 面新增复杂分发。

### Institutional Learnings

- `docs/plans/2026-04-13-006-feat-sync-compound-core-workflow-updates-plan.md`
  上一轮 compound core workflow 同步计划已经证明：这类工作最稳妥的落点是 repo-owned assets + contract/smoke guard，而不是先改 CLI 控制面。

### External References

- 本次未追加外部在线研究。
- 原因：当前工作主要是 repo-owned workflow contract 设计与 asset 组织，不需要再用开放式研究替代本仓事实。

## Key Technical Decisions

- **保持 source skill 使用内部命名，不为 runtime 名称改 source frontmatter。**
  - 理由：`spec-plan`、`spec-work`、`spec-review` 等 command-backing workflow 的 source 都使用内部命名；Codex runtime 会在安装时改成 `spec-brainstorm`。如果直接把 source 改成 public name，容易与现有 smoke / transform 约定冲突。

- **source skill 中新增 agent 调用继续使用 canonical `Task spec-first:<category>:<name>(...)` 写法。**
  - 理由：当前 source assets 依赖 `src/cli/adapters/codex.js` / `src/cli/adapters/claude.js` 做双宿主转换。若在 source 里直接写 Claude runtime 视角的 bare agent name，Codex transform 无法稳定改写，容易造成双宿主行为漂移。

- **`github/web/docs` 三类 adapter 先定义 contract，再按最薄包装复用现有能力。**
  - 理由：当前真正需要的是稳定路由和统一 digest，而不是复制 `issue-intelligence-analyst`、`best-practices-researcher`、`framework-docs-researcher` 的全部研究逻辑。

- **`local-doc-reader` 不替代 `learnings-researcher`。**
  - 理由：`docs/solutions/` 已经有 frontmatter-aware 专用检索路径；通用 reader 只应处理显式本地文档读取，不应重复做 institutional search。

- **`agent-browser` / Playwright 仅作为页面型 source 的底层执行器。**
  - 理由：它可以负责“打开页面并读取内容”，但不能单独承担 source 路由、内容抽取归一化、失败分类和 digest 合同。

- **`find-skills` 是 environment-optional fallback，不进入 repo-bundled 假设。**
  - 理由：当前仓库 `skills/` 内没有它，`spec-first init` 也不会分发它；因此测试和 skill contract 都必须按“可能不存在”设计。

- **运行时命名验收必须按宿主区分，不得把 Claude / Codex 混成一条。**
  - 理由：Codex adapter 会把 source skill 的 `name:` 改写为 runtime skill 名；Claude adapter 不改 skill frontmatter，只改 canonical agent 引用。因此验收应分别验证“Codex runtime name 已改写”和“Claude runtime 路径/agent 引用已正确适配”，而不是要求两边都满足同一 `name:` 口径。

- **外部 supplemental context 必须沿用上游 Slack context 的 opt-in 精神，但将触发条件推广为 source-driven。**
  - 理由：上游 `ce-brainstorm` 对 Slack 明确采用“opt-in、never auto-dispatch”。当前产品对 GitHub / Web / Docs 等 repo 外部上下文同样保持该约束；若按 topic 自动抓取会扩大权限、成本和行为不确定性。因此这里固定为：显式 source 或显式请求才 dispatch；否则只提示可用能力，不做自动外部读取。

- **主实现面保持在 workflow assets 和测试层，CLI 核心默认不改。**
  - 理由：bundling 机制已具备承接能力。本次若再改 CLI，只会扩大 blast radius；除非验证证明现有安装路径无法覆盖新资产，否则不触碰 command/router。

## Open Questions

### Resolved During Planning

- **Q1. `spec-brainstorm` source frontmatter 是否要改成 `name: spec-brainstorm`？**
  - 结论：不改 source frontmatter，保持 command-backing workflow 的内部命名模式；runtime public name 依赖现有 adapter transform 和安装结果保证。

- **Q2. 新增 research agents 是否需要改 `.claude-plugin/plugin.json` 或 CLI 路由？**
  - 结论：不需要。当前 bundling 已自动分发 `skills/` 和 `agents/`，本次不新增 public command。

- **Q3. `find-skills fallback` 是否能写成“默认存在”的主路径？**
  - 结论：不能。它只能作为 environment-optional fallback，并在 Codex / 未安装场景直接降级。

- **Q4. `github-context-reader` / `web-context-reader` / `docs-context-reader` 是否必须完全独立重写？**
  - 结论：不必须。优先做薄包装 adapter，把底层读取或研究能力统一收敛到 `research digest`。

### Deferred to Implementation

- **给定 GitHub issue URL 时，`github-context-reader` 是直接做页面/CLI digest，还是在需要主题聚类时再委托 `issue-intelligence-analyst`？**
  - 原因：这是实现期的 delegation 粒度问题，不影响当前 plan 的结构与文件拆分。

- **`local-doc-reader` 的 pdf 支持采用哪条具体提取路径？**
  - 原因：仓库当前没有现成统一 pdf parser；计划期只需要锁定“best-effort + 明确失败分类”，具体技术路径留到实现。

- **`docs-context-reader` 与 `web-context-reader` 是否共用同一底层模块/模板骨架？**
  - 原因：属于实现内聚度问题，不改变对外 contract。


## High-Level Technical Design

> *此图说明预期路由和 adapter 责任边界，是评审用方向性设计，不是实现规范。实现时允许做等价拆分，但必须保留相同 contract。*

```text
User request / origin topic
  -> Repo Context scan
  -> Existing and Supplemental Context Scan
       -> explicit local path?      -> local-doc-reader
       -> docs/solutions intent?    -> learnings-researcher
       -> explicit github.com URL?  -> github-context-reader
       -> explicit docs site URL?   -> docs-context-reader
       -> explicit http/https URL?  -> web-context-reader
       -> external context not explicitly requested?
            -> do not auto-dispatch external readers
            -> briefly note available source types
       -> no stable source?
            -> find-skills available? yes -> environment fallback
            -> no  -> 向用户说明当前环境不支持 supplemental skill discovery；
                      列出仍可使用的 source 类型（local docs / GitHub / Web URL / Docs URL）；
                      继续执行 brainstorm，不阻塞
  -> all adapters emit research digest
  -> brainstorm core consumes digest, not raw source output
```

Decision matrix:

| Source | Primary executor | Fallback | Notes |
|---|---|---|---|
| local file / `docs/` | `local-doc-reader` | none | `docs/solutions/` 优先交给 `learnings-researcher` |
| GitHub URL | `github-context-reader` | browser only when structured path unavailable | issue landscape 与单 URL digest 分工分离 |
| docs URL | `docs-context-reader` | `agent-browser` | 偏接口说明/产品文档抽取 |
| generic web URL | `web-context-reader` | `agent-browser` | 偏单页正文摘要 |
| unknown | `find-skills` if available | direct degrade | 不可假装成功 |

## Implementation Units

- [x] **Unit 1: 锁定 `spec-brainstorm` 主 skill 合同与 source naming invariant**

**Goal:** 把 Part B 的实现边界、上游非 Slack 方法论护栏、supplemental route contract 写入主 skill，同时保住 repo 的 source naming 约定。

**Requirements:** R1, R2, R3, R6, R8

**Dependencies:** 无

**Files:**
- Modify: `skills/spec-brainstorm/SKILL.md`
- Add: `tests/unit/spec-brainstorm-contracts.test.js`（最小可运行 contract test，Unit 1 即落地 source naming invariant 与 digest enum 冻结断言；Unit 6 再扩充覆盖面）

**Approach:**
- 在 `Phase 0/1/2/3` 中补回上游非 Slack 护栏
- 将 `1.1 Existing Context Scan` 升级为 `Existing and Supplemental Context Scan`
- 先写最小可运行 contract test，冻结 source `name:` 与 `research digest.status` enum，再修改主 skill
- 把 `research digest` contract、source router、`find-skills` 环境约束和失败降级写入主 skill
- 把外部 supplemental context 的触发边界写死为 opt-in / source-driven：没有显式 source 或显式请求时，不自动 dispatch `feishu-*` / `github-*` / `web-*` / `docs-*`
- 明确保留 source `name: brainstorm-workflow`，由 runtime transform 输出 public name
- 若主 skill 需要新增 agent 调用，source 中统一使用 canonical `Task spec-first:research:...(...)` 写法，由 Claude/Codex adapter 在 runtime 做宿主适配

**Execution note:** Unit 1 的 contract test 必须是可执行断言，不能以 `.skip()` 或占位 stub 替代；否则“先写测试再改 skill”这条保护不会真正生效。

**Patterns to follow:**
- `skills/spec-plan/SKILL.md`
- `skills/spec-review/SKILL.md`
- `src/cli/adapters/codex.js`

**Test scenarios:**
- Happy path: 主 skill 包含 `Existing and Supplemental Context Scan`、`research digest`、`find-skills` 环境约束
- Happy path: 主 skill 包含上游非 Slack 护栏（任务域识别、非显然角度、先展示方案再评估）
- Happy path: 主 skill 明确外部 supplemental context 仅在显式 source 或显式请求时触发，不按 topic 自动搜索外部资源
- Edge case: source `name:` 仍保持内部命名，而不是 public runtime name
- Edge case: `research digest.status` 精确等于 `success | no-result | tool-unavailable | permission-denied | source-unparseable | executor-unavailable`
- Edge case: source 中若新增 Task 调用，使用 canonical `spec-first:research:*` 写法，且 Claude/Codex runtime 产物分别保持各自宿主兼容形式
- Error path（代码审查路径）: skill 文本须包含 `find-skills` 不可用时的降级说明；smoke 不执行此路径断言，由代码审查覆盖

**Verification:**
- `tests/unit/spec-brainstorm-contracts.test.js` 能运行并从 source skill 中断言关键 contract、digest enum 和命名 invariant

---

- [x] **Unit 2: 补齐 brainstorm references 与 visual guidance 合同**

**Goal:** 补回当前缺失的 reference 文件，并让 requirements capture 显式接入 visual guidance。

**Requirements:** R1, R8

**Dependencies:** Unit 1

**Files:**
- Modify: `skills/spec-brainstorm/references/requirements-capture.md`
- Add: `skills/spec-brainstorm/references/universal-brainstorming.md`
- Add: `skills/spec-brainstorm/references/visual-communication.md`
- Test: `tests/unit/spec-brainstorm-contracts.test.js`
- Test: `tests/smoke/cli.sh`

**Approach:**
- 新增通用 brainstorm 分流 reference
- 新增 visual communication guidance reference
- 在 requirements capture 中加入“何时读取 visual guidance”入口与自检项
- 如 handoff 文案需要引用新的 supplemental context 术语，再做最小对齐；否则保持不动

**Patterns to follow:**
- `skills/spec-brainstorm/references/handoff.md`
- 现有 `skills/spec-plan/references/*` 的 reference 组织方式

**Test scenarios:**
- Happy path: 两个新增 reference 文件存在且被 source skill / requirements capture 正确引用
- Edge case: 安装到 Claude/Codex runtime 后，新 reference 文件实际存在于目标目录
- Integration: requirements capture 仍保留原有 `spec:plan` handoff 语义，不因新增 visual guidance 破坏后续链路

**Verification:**
- unit contract 覆盖 reference 存在与引用关系
- smoke 断言 runtime 目录中包含新增 reference 文件

---

- [x] **Unit 3: 落地 `local-doc-reader`，并与 `learnings-researcher` 做职责分工**

**Goal:** 为本地文档上下文建立一等读取器，同时确保 `docs/solutions/` 继续由专用 learnings 流程负责。

**Requirements:** R2, R3, R4, R8

**Dependencies:** Unit 1

**Files:**
- Add: `agents/research/local-doc-reader.md`
- Modify: `skills/spec-brainstorm/SKILL.md`
- Test: `tests/unit/spec-brainstorm-contracts.test.js`
- Test: `tests/smoke/cli.sh`

**Approach:**
- `local-doc-reader` 负责显式本地路径、`docs/` 下普通文档、topic-driven 命中的本地材料
- 在主 skill 中写清 `docs/solutions/` / 历史方案检索优先委托 `learnings-researcher`
- 对 pdf 定义 best-effort 读取与显式失败分类，不在计划期承诺统一 parser

**Patterns to follow:**
- `agents/research/learnings-researcher.md`
- `agents/research/repo-research-analyst.md`

**Test scenarios:**
- Happy path: 主 skill 明确区分 `local-doc-reader` 与 `learnings-researcher`
- Edge case: 用户显式给出 `docs/solutions/...` 单文件路径时，允许 `local-doc-reader` 读该文件，但 contract 不再触发重复 institutional search
- Error path: 无法解析/读取本地文档时，要求返回统一失败分类，而不是空白成功
- Integration: runtime 安装后 `.claude/agents/research`、`.codex/agents/research` 中可见新 agent 文件

**Verification:**
- unit contract 能断言主 skill 与 agent 文本中的职责边界
- smoke 能断言新 agent 被打包安装

---


**Requirements:** R2, R3, R7, R8

**Dependencies:** Unit 1, Unit 3（Unit 3 先完成对 `skills/spec-brainstorm/SKILL.md` 的修改，避免并行写入冲突）

**Files:**
- Modify: `skills/spec-brainstorm/SKILL.md`
- Test: `tests/unit/spec-brainstorm-contracts.test.js`
- Test: `tests/smoke/cli.sh`

**Approach:**
- `feishu-chat-researcher` 明确为 MCP/API-first，不承诺 browser-only 主路径
- `feishu-doc-reader` 支持 MCP-first，并在主 skill 中声明 browser fallback 仅作读取降级；`agent-browser` 作为 browser fallback 执行器需独立安装（非 `spec-first init` 分发），若不可用需返回 `executor-unavailable` 失败分类
- MCP 不可用且 agent-browser 不可用时（如 Codex 环境或 agent-browser 未安装），feishu-doc-reader 须返回 `executor-unavailable` 并向用户说明当前环境不支持 Feishu doc 读取，建议改用本地文件路径或手动粘贴内容
- 主 skill 合同须显式处理 `executor-unavailable` 状态：收到该状态时，向用户说明当前环境不支持对应 source 的页面读取，并拒绝继续尝试，不静默略过
- 在主 skill / agent 文本中明确 host dependency：飞书 MCP 可由独立的 `spec-mcp-setup` 计划提供，但本 plan 不负责其安装
- `feishu-chat-researcher` 在 MCP 不可用时必须返回 R3 冻结后的 `tool-unavailable` 状态，且主 skill 需在 brainstorm 输出中向用户可见地展示该状态，不得静默略过

**Patterns to follow:**
- `docs/plans/2026-04-14-008-feat-feishu-mcp-setup-integration-plan.md`
- `.agents/skills/agent-browser/SKILL.md`

**Test scenarios:**

**Verification:**
- unit contract 覆盖 role、dependency 和 fallback 语义
- smoke 覆盖 agent 文件安装与主 skill 关键文案

---

- [x] **Unit 5: 以薄包装方式落地 GitHub / Web / Docs adapters**

**Goal:** 为在线上下文建立稳定的 source adapter contract，并把底层能力复用关系写死，避免重复造轮子。

**Requirements:** R2, R3, R5, R8

**Dependencies:** Unit 1, Unit 4（Unit 4 先完成对 `skills/spec-brainstorm/SKILL.md` 的修改，避免并行写入冲突）

**Files:**
- Add: `agents/research/github-context-reader.md`
- Add: `agents/research/web-context-reader.md`
- Add: `agents/research/docs-context-reader.md`
- Modify: `skills/spec-brainstorm/SKILL.md`
- Test: `tests/unit/spec-brainstorm-contracts.test.js`
- Test: `tests/smoke/cli.sh`

**Approach:**
Unit 5 在实现期内须解决以下设计选择，并以代码注释形式记录在各 agent 文件中：Q2（`github-context-reader` 是否委托 `issue-intelligence-analyst`）、Q4（`docs-context-reader` 与 `web-context-reader` 是否共用骨架）。如实现中与现有 research agents 发生设计冲突，升级至计划作者确认后再完成 agent 文件。

- `github-context-reader` 处理显式 GitHub URL 的 digest，必要时可委托 `issue-intelligence-analyst` 做 issue 主题分析，但不与其同构
- `web-context-reader` / `docs-context-reader` 使用 `agent-browser` 作为底层页面读取器，外层负责 source 类型区分、抽取重点和 digest 归一化；`agent-browser` 需独立安装（非 `spec-first init` 分发），若执行器不可用应返回 `executor-unavailable` 失败分类而非静默失败
- 在主 skill 中明确 `docs-context-reader` 与 `framework-docs-researcher`、`web-context-reader` 与 `best-practices-researcher` 的分工

**Patterns to follow:**
- `agents/research/issue-intelligence-analyst.md`
- `agents/research/best-practices-researcher.md`
- `agents/research/framework-docs-researcher.md`
- `.agents/skills/agent-browser/SKILL.md`

**Test scenarios:**
- Happy path: 主 skill 和 agent 文本明确三类 adapter 的 source 触发条件与输出 contract
- Edge case: GitHub issue landscape 分析与单 URL digest 被明确区分，不重复承诺
- Error path: 页面无法读取或权限不足时，必须走统一失败分类
- Integration: runtime 安装包含 3 个新 online adapters

**Verification:**
- unit contract 覆盖分工关系与 digest 语义
- smoke 覆盖 3 个 agent 的安装存在性

---

- [x] **Unit 6: 补齐 contract / smoke / release-note guard，锁住运行时行为**

**Goal:** 用最小测试和治理文档把本次 workflow 增强锁住，避免后续回退或误分叉。

**Requirements:** R8, R9

**Dependencies:** Unit 1, Unit 2, Unit 3, Unit 4, Unit 5

**Files:**
- Modify: `tests/unit/spec-brainstorm-contracts.test.js`（Unit 1 已有最小可运行断言，本单元扩充为完整覆盖）
- Modify: `tests/smoke/cli.sh`
- Modify: `CHANGELOG.md`
- Modify: `docs/08-版本更新/README.md`

**Approach:**
- 扩充 Unit 1 创建的最小可运行 contract test 为完整覆盖：断言 skill/reference/agent 之间的关键 contract
- 不修改 `package.json`；当前 `test:unit` 已通过 `npx jest tests/unit --runInBand` 自动发现 `tests/unit/` 下新增的 Jest 合同测试，因此新增 `spec-brainstorm-contracts.test.js` 后会直接进入 CI 流水线
- source naming invariant test 断言对象为 source skill frontmatter `name:` 字段（验证其保持内部命名），是对 `doctor` canonical name 检测的**补充**而非替代——`doctor` 检测 runtime 产物是否残留未重写的 canonical name，contract test 检测 source 文件始终保持内部 name
- 在 smoke 中补 runtime 安装断言：新增 references、research agents、主 skill 关键文案，并按宿主分别验证 runtime 命名/适配结果
- 文档层更新 `CHANGELOG.md` 与 `docs/08-版本更新/README.md`（后者记录本次 supplemental context 增强的 source 类型清单），满足仓库治理要求
- 明确不对 `find-skills` 做”安装后一定存在”的 smoke 断言
- `find-skills` 不可用的 error path（Unit 1 Test scenarios 中的代码审查路径）由代码审查覆盖，非 smoke 执行路径

**Execution note:** 先补 unit contract，再扩 smoke；避免 smoke 先写死了错误假设。

**Patterns to follow:**
- `tests/unit/spec-graph-bootstrap-contracts.test.js`
- `tests/smoke/cli.sh`
- `CHANGELOG.md`

**Test scenarios:**
- Happy path: unit contract 断言 `research digest`、supplemental route、reference 引用、source naming invariant、agent 分工语义
- Happy path: smoke 断言 `init --claude` / `init --codex` 后新增 references 与 agents 已安装
- Edge case: smoke 不把 `find-skills` 当成 repo-bundled asset 断言
- Integration: Claude runtime 断言 `.claude/spec-first/workflows/spec-brainstorm/SKILL.md` 已安装且 agent 引用完成 Claude 适配，不强行要求 frontmatter `name:` 改写；Codex runtime 断言 `.agents/skills/spec-brainstorm/SKILL.md` 的 frontmatter `name:` 已改写为 `spec-brainstorm`

**Verification:**
- `tests/unit/spec-brainstorm-contracts.test.js` 通过
- `tests/smoke/cli.sh` 通过
- `CHANGELOG.md` 和 `docs/08-版本更新/README.md` 包含对应记录

## System-Wide Impact

- **Interaction graph:** 本次主要触达 `skills/`、`agents/`、`tests/`。通过 `plugin` bundling 进入 Claude/Codex runtime，不新增 CLI command 入口。
- **Error propagation:** 外部上下文读取失败必须被归一化为 digest 级失败分类，不能让 brainstorm core 接收到“空白但看似成功”的结果。
- **State lifecycle risks:** 新 agents 只负责读取与摘要，不应写入 repo 状态，也不应在 skill 文本中暗示持久化凭据。
- **API surface parity:** `spec-brainstorm` 仍是既有 public command；source 内部名与 runtime public name 的双层约定必须保持 Claude/Codex 一致。
- **Integration coverage:** 需要同时覆盖 source asset contract、runtime 安装结果、`find-skills` 非 bundled 假设，以及新增 references 的安装存在性。
- **Unchanged invariants:** 不新增 `Slack context`、不新增 `slack-researcher`、不新增 public command、不把 `find-skills` 变成 repo-owned asset、不把 `agent-browser` 直接当成完整 adapter。

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| 误把 source `name:` 改成 public name，打破现有 workflow asset 约定 | 在 Unit 1 和 Unit 6 中把 source naming invariant 写进 contract test |
| `github/web/docs` adapters 与现有 researchers 重复建设 | Unit 5 明确以薄包装 contract 为原则，并在 agent 文本中写清分工 |
| `local-doc-reader` 与 `learnings-researcher` 重复扫描 `docs/solutions/` | Unit 3 在主 skill 和 agent 文本中固定职责边界 |
| `find-skills` 在不同环境可用性不一致，导致 workflow 不稳定 | 把它降为 environment-optional fallback，并禁止 smoke 假设其存在 |
| 使用 browser 读取页面时，开发者把底层执行器误当成完整 adapter | 在 Unit 5 和主 skill 中写死“底层执行器 != adapter contract” |

## Documentation / Operational Notes

- 本次属于显著 workflow 增强，代码改动时必须同步更新 `CHANGELOG.md`；多 unit 批量执行时，CHANGELOG 条目可在 Unit 6 统一写入，但若各 unit 分批提交，则每批需独立更新。
- 根据仓库治理规则，本次也应同步更新 `docs/08-版本更新/README.md`，内容应列出新增的 supplemental source 类型（GitHub URL / Web URL / Docs URL / Local Docs）作为用户可见的 workflow 增强。
- 计划期不要求修改 `docs/业界分析/13...` / `14...`，除非实现中发现 source-of-truth 与代码结构再次产生新的阻断性冲突。

## Sources & References

- **Origin document:** [docs/业界分析/13.spec-brainstorm-追平后增强版-外部上下文架构方案-2026-04-14.md](docs/业界分析/13.spec-brainstorm-追平后增强版-外部上下文架构方案-2026-04-14.md)
- Related plan: [docs/plans/2026-04-14-008-feat-feishu-mcp-setup-integration-plan.md](docs/plans/2026-04-14-008-feat-feishu-mcp-setup-integration-plan.md)
- Related code: `skills/spec-brainstorm/SKILL.md`
- Related code: `src/cli/plugin.js`
- Related code: `src/cli/adapters/codex.js`
- Related code: `src/cli/adapters/claude.js`
- Related code: `agents/research/learnings-researcher.md`
- Related code: `agents/research/issue-intelligence-analyst.md`
- Related code: `agents/research/best-practices-researcher.md`
- Related code: `agents/research/framework-docs-researcher.md`
