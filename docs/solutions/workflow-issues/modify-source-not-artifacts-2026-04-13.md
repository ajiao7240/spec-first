---
title: "修改生成产物而非源头模板"
date: "2026-04-13"
last_updated: "2026-06-04"
category: "workflow-issues"
module: "spec-first"
problem_type: "workflow_issue"
component: "documentation"
severity: "high"
applies_when:
  - "发现历史 docs/contexts/、当前 .spec-first/workflows/ 或其他 workflow artifact 与预期不一致"
  - "发现 .agents/skills/、.claude/skills/、.claude/commands/、.codex/agents/ 等运行时副本与源码不一致"
  - "slash command 或 $skill 运行时读到旧内容，怀疑源码没有改完"
  - "需要修复 spec-first 工作流的生成逻辑或模板输出"
tags: ["injection-index", "spec-graph-bootstrap", "source-of-truth", "artifact", "generated-file", "phase-4", "spec-code-review", "runtime-artifact", "codex-runtime"]
---

# 修改生成产物而非源头模板

## Context

历史案例：在修复 `injection-index.yaml` 中 `advice.work` 的语义错误时，很容易直接打开
`docs/contexts/spec-first/injection-index.yaml` 这样的产物文件动手改，但它其实由
当时的 `spec-graph-bootstrap` 运行时生成，真正的 source-of-truth 在
`skills/spec-graph-bootstrap/SKILL.md` 的 Phase 4 模板里。

2026-06-04 刷新时，`skills/spec-graph-bootstrap/` 与 `docs/contexts/` 已不是当前仓库的有效执行面。这个案例只保留为历史问题形态；当前 source/runtime 边界以 `docs/contracts/source-runtime-customization-boundary.md`、`docs/contracts/context-governance.md`、`docs/catalog/runtime-capabilities.md` 和 `src/cli/plugin.js` 为准。

2026-04-15 的 `spec-code-review` 同步审查里，同样出现了另一种高频误判：

- 用户实际通过 `$spec-code-review` 读到了 `.agents/skills/spec-code-review/SKILL.md`
- 该文件仍是 repo-local runtime artifact，内容落后于 `skills/spec-code-review/SKILL.md`
- 如果只盯着 `.agents/skills/...`，很容易误判为“源码没改完”

但从源码看，这类结论必须拆成两个独立判断：

1. `skills/`、`agents/`、`templates/` 里的 source-of-truth 是否已经正确修改
2. `.agents/skills/`、`.claude/skills/`、`.claude/commands/`、`.codex/agents/` 等运行时副本是否已经按同步链路刷新

这两个问题不能混为一谈。runtime artifact 旧，只能先说明“产物未刷新或未重新安装”，不能直接推导为“源码缺陷”。

## Guidance

遇到 `.spec-first/workflows/`、`.claude/`、`.codex/`、`.agents/skills/` 等运行时、workflow artifact 或 generated mirror 出错时，先反向追踪生成链，优先修改源头模板、source workflow 或 CLI writer，而不是直接修补产物。

对 spec-first 仓库，判断顺序应固定为：

1. 先识别当前打开的是 source-of-truth 还是 runtime artifact
2. 如果是 runtime artifact，先回溯它来自哪个源目录
3. 只在源目录做持久修改
4. 通过安装/同步链路刷新运行时副本，再验证实际消费到的新内容

`spec-code-review` 这个案例里，正确动作不是编辑 `.agents/skills/spec-code-review/SKILL.md`，而是：

```bash
# 先检查源头
sed -n '1,80p' skills/spec-code-review/SKILL.md

# 再确认 runtime 副本是否滞后
sed -n '1,80p' .agents/skills/spec-code-review/SKILL.md

# 若两者不一致，修改 source-of-truth 后走同步链路刷新 runtime
spec-first init
```

修改路径示例：

```bash
# 错误：修改产物
vi .agents/skills/spec-code-review/SKILL.md

# 正确：修改生成源头
vi skills/spec-code-review/SKILL.md
spec-first init
```

对 skills / commands / agents 这类安装型产物，不推荐手改 runtime 副本；应优先重新执行安装或同步链路，让运行时目录重新从源码生成。对 `.spec-first/workflows/**` 这类 workflow artifact，先确认它是 evidence artifact 还是某个 source-owned writer 的输出；artifact 本身不覆盖 `skills/`、`agents/`、`templates/`、`src/cli/` 或 `docs/contracts/**` 的行为契约。

## Why This Matters

spec-first 项目遵循**单向生成链**设计。当前 runtime mirror 链路是：

```
skills/、agents/、templates/、src/cli/contracts/**  ← source-of-truth
         ↓ spec-first init / src/cli/plugin.js / host adapter
.claude/、.codex/、.agents/skills/  ← generated runtime mirrors
```

workflow artifact 链路是：

```
source workflow / CLI writer / docs contract  ← behavior source
         ↓ workflow run
docs/plans/、docs/validation/、docs/solutions/、.spec-first/workflows/**  ← durable evidence artifacts
```

产物文件应被视为可追溯证据或可重新生成的运行时镜像，而非可手工维护的行为配置。修改源头确保：持久性、可重现性、可追溯性。

对 Codex / Claude runtime 安装链也是同一个原则：

```
skills/spec-code-review/SKILL.md            ← 源头
agents/*.agent.md                       ← 源头
templates/...                          ← 源头
         ↓ spec-first init / syncBundledAssets
.agents/skills/spec-code-review/SKILL.md    ← Codex runtime 副本
.codex/agents/*.agent.md               ← Codex runtime 副本
.claude/skills/...                     ← Claude runtime 副本
```

源码里已经有明确实现依据：

- `src/cli/plugin.js` 的 `syncBundledAssets()` / `syncSkills()` / `syncAgents()` 会把 repo 内 `skills/` 与 `agents/` 复制并转换到运行时目录
- `src/cli/adapters/codex.js` 明确把 Codex 的 `skillsRoot` 和 `workflowsRoot` 都指向 `.agents/skills`

所以，`.agents/skills/spec-code-review/SKILL.md` 的旧状态首先说明的是“runtime 副本未刷新”，而不是“`skills/spec-code-review/SKILL.md` 必然错误”。

## When to Apply

- 发现某个生成文件的内容错误，但不确定该改哪里时
- 处理 workflow / template / command / runtime asset 一致性问题时
- 看到改动目标位于 `.spec-first/`、`.claude/`、`.codex/`、`.agents/skills/` 这类明显产物目录时
- slash command / `$skill` 实际运行时读到了 `.agents/skills/...` 或 `.claude/skills/...` 的旧内容时
- 代码审查中发现 runtime 副本与源目录不一致，需要区分“源码缺陷”与“未重新同步”时

## Examples

**识别 spec-first 中的产物 vs 源头**：

| 产物位置 | 源头位置 | 触发方式 |
|---------|---------|---------|
| `.claude/commands/spec/*.md` | `templates/claude/commands/spec/*.md` + `skills/spec-xxx/SKILL.md` + `skills-governance.json` | `spec-first init --claude` |
| `.agents/skills/spec-xxx/SKILL.md` | `skills/spec-xxx/SKILL.md` + `skills-governance.json` | `spec-first init --codex` |
| `.claude/agents/*.agent.md`、`.codex/agents/*.agent.md` | `agents/*.agent.md` | `spec-first init` |
| `.spec-first/workflows/**` | 对应 source workflow、CLI writer 或 docs contract；先查 producer，再判断 artifact 是否需要重跑 | workflow-specific |

**`spec-code-review` 具体案例**：

**Before（错误判断）**：

- 看到 `.agents/skills/spec-code-review/SKILL.md` 还是旧 contract
- 直接下结论：“`spec-code-review` 源码还没开发完”

**After（正确判断）**：

- 先审 `skills/spec-code-review/SKILL.md`、`agents/review/*`、相关 tests，确认 source-of-truth 是否已完成
- 若 source-of-truth 正确，而 `.agents/skills/spec-code-review/SKILL.md` 落后，则把问题归类为 runtime artifact 刷新/验证项
- 通过同步链路刷新 runtime，再验证 `$spec-code-review` 实际消费到的新 contract

**通用原则**：
1. 遇到文件内容错误，先追溯其生成来源，再决定修改位置
2. 产物目录（`.spec-first/workflows/`、`.claude/`、`.codex/`、`.agents/skills/`）中的文件默认不应手工编辑
3. runtime 副本与源码不一致时，先判断“源码是否正确”，再判断“产物是否已刷新”
4. 若无法立即重新生成产物，手工临时修改只可作为短期验证手段，且必须同步修改源头；对安装型 runtime 副本应尽量避免这样做

**检查方式**：
```bash
grep -n "Source Of Truth" docs/contracts/source-runtime-customization-boundary.md
```

```bash
grep -n "syncBundledAssets\\|syncSkills\\|syncAgents" src/cli/plugin.js
grep -n "skillsRoot\\|workflowsRoot" src/cli/adapters/codex.js
```

## Related

- `docs/plans/2026-04-13-002-artifact-path-standardization-design.md` — 产物路径标准化设计，解释了源头/产物分层的整体方案
- `docs/plans/2026-04-13-003-refactor-artifact-path-hard-cut-plan.md` — Unit 3 明确规定“只改 source-of-truth（skills/ 与 templates/），runtime 副本不作手工编辑入口”
- `docs/validation/2026-04-01-spec-graph-bootstrap-deep-review.md` — 类似问题：PRD 模板（源头）vs 生成的 worker 产物的边界设计
- `docs/contracts/source-runtime-customization-boundary.md` — 当前 source/runtime/provider 边界 source-of-truth
- `docs/catalog/runtime-capabilities.md` — 当前 runtime delivery catalog，由 source/governance 生成
