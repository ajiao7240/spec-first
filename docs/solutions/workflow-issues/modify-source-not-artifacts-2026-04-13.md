---
title: "修改生成产物而非源头模板"
date: "2026-04-13"
last_updated: "2026-04-15"
category: "workflow-issues"
module: "spec-first"
problem_type: "workflow_issue"
component: "documentation"
severity: "high"
applies_when:
  - "发现 docs/contexts/ 或 .spec-first/workflows/ 里的生成产物与预期不一致"
  - "发现 .agents/skills/、.claude/skills/、.codex/commands/ 等运行时副本与源码不一致"
  - "slash command 或 $skill 运行时读到旧内容，怀疑源码没有改完"
  - "需要修复 spec-first 工作流的生成逻辑或模板输出"
tags: ["injection-index", "spec-graph-bootstrap", "source-of-truth", "artifact", "generated-file", "phase-4", "spec-review", "runtime-artifact", "codex-runtime"]
---

# 修改生成产物而非源头模板

## Context

在修复 `injection-index.yaml` 中 `advice.work` 的语义错误时，很容易直接打开
`docs/contexts/spec-first/injection-index.yaml` 这样的产物文件动手改，但它其实由
`spec-graph-bootstrap` 运行时生成，真正的 source-of-truth 在
`skills/spec-graph-bootstrap/SKILL.md` 的 Phase 4 模板里。

2026-04-15 的 `spec-review` 同步审查里，同样出现了另一种高频误判：

- 用户实际通过 `$spec-review` 读到了 `.agents/skills/spec-review/SKILL.md`
- 该文件仍是 repo-local runtime artifact，内容落后于 `skills/spec-review/SKILL.md`
- 如果只盯着 `.agents/skills/...`，很容易误判为“源码没改完”

但从源码看，这类结论必须拆成两个独立判断：

1. `skills/`、`agents/`、`templates/` 里的 source-of-truth 是否已经正确修改
2. `.agents/skills/`、`.claude/skills/`、`.codex/commands/` 等运行时副本是否已经按同步链路刷新

这两个问题不能混为一谈。runtime artifact 旧，只能先说明“产物未刷新或未重新安装”，不能直接推导为“源码缺陷”。

## Guidance

遇到 `docs/contexts/`、`.spec-first/workflows/`、`.claude/`、`.codex/` 等运行时或生成产物出错时，先反向追踪生成链，优先修改源头模板，而不是直接修补产物。

对 spec-first 仓库，判断顺序应固定为：

1. 先识别当前打开的是 source-of-truth 还是 runtime artifact
2. 如果是 runtime artifact，先回溯它来自哪个源目录
3. 只在源目录做持久修改
4. 通过安装/同步链路刷新运行时副本，再验证实际消费到的新内容

`spec-review` 这个案例里，正确动作不是编辑 `.agents/skills/spec-review/SKILL.md`，而是：

```bash
# 先检查源头
sed -n '1,80p' skills/spec-review/SKILL.md

# 再确认 runtime 副本是否滞后
sed -n '1,80p' .agents/skills/spec-review/SKILL.md

# 若两者不一致，修改 source-of-truth 后走同步链路刷新 runtime
spec-first init
```

修改路径示例：

```bash
# 错误：修改产物
vi docs/contexts/spec-first/injection-index.yaml

# 正确：修改生成源头
vi skills/spec-graph-bootstrap/SKILL.md  # 找到 Phase 4 yaml 模板
```

**Before（SKILL.md Phase 4 模板中）**：
```yaml
advice:
  work: "优先 context-packs 和 test-map，而非 architecture"
```

**After**：
```yaml
advice:
  work: "优先 code-facts 和 test-map，而非 architecture"
```

修改源头后，如需立即生效，有两个路径：
1. 重新运行 `/spec:graph-bootstrap` 自动刷新产物
2. 同步手动更新产物文件（仅作临时对齐，源头已修复）

对 skills / commands / agents 这类安装型产物，不推荐手改 runtime 副本；应优先重新执行安装或同步链路，让运行时目录重新从源码生成。

## Why This Matters

spec-first 项目遵循**单向生成链**设计：

```
skills/spec-graph-bootstrap/SKILL.md   ← 源头（唯一真实来源）
         ↓ Phase 4：LLM 执行生成逻辑
docs/contexts/<slug>/injection-index.yaml  ← 产物（可重新生成）
```

产物文件是运行时的临时输出，应被视为“可重新生成的缓存”而非可手工维护的配置文件。修改源头确保：持久性、可重现性、可追溯性。

对 Codex / Claude runtime 安装链也是同一个原则：

```
skills/spec-review/SKILL.md            ← 源头
agents/review/*.md                     ← 源头
templates/...                          ← 源头
         ↓ spec-first init / syncBundledAssets
.agents/skills/spec-review/SKILL.md    ← Codex runtime 副本
.codex/agents/review/*.md              ← Codex runtime 副本
.claude/skills/...                     ← Claude runtime 副本
```

源码里已经有明确实现依据：

- `src/cli/plugin.js` 的 `syncBundledAssets()` / `syncSkills()` / `syncAgents()` 会把 repo 内 `skills/` 与 `agents/` 复制并转换到运行时目录
- `src/cli/adapters/codex.js` 明确把 Codex 的 `skillsRoot` 和 `workflowsRoot` 都指向 `.agents/skills`

所以，`.agents/skills/spec-review/SKILL.md` 的旧状态首先说明的是“runtime 副本未刷新”，而不是“`skills/spec-review/SKILL.md` 必然错误”。

## When to Apply

- 发现某个生成文件的内容错误，但不确定该改哪里时
- 处理 workflow / template / command / runtime asset 一致性问题时
- 看到改动目标位于 `docs/contexts/`、`.spec-first/`、`.claude/`、`.codex/` 这类明显产物目录时
- slash command / `$skill` 实际运行时读到了 `.agents/skills/...` 或 `.claude/skills/...` 的旧内容时
- 代码审查中发现 runtime 副本与源目录不一致，需要区分“源码缺陷”与“未重新同步”时

## Examples

**识别 spec-first 中的产物 vs 源头**：

| 产物位置 | 源头位置 | 触发方式 |
|---------|---------|---------|
| `docs/contexts/<slug>/` 所有文件 | `skills/spec-graph-bootstrap/SKILL.md` Phase 4 | `/spec:graph-bootstrap` |
| `.spec-first/workflows/bootstrap/<slug>/` JSON 文件 | `skills/spec-graph-bootstrap/SKILL.md` 各 Phase | `/spec:graph-bootstrap` |
| `.claude/skills/`、`.agents/skills/` | `skills/` 目录各 SKILL.md | `spec-first init` |

**`spec-review` 具体案例**：

**Before（错误判断）**：

- 看到 `.agents/skills/spec-review/SKILL.md` 还是旧 contract
- 直接下结论：“`spec-review` 源码还没开发完”

**After（正确判断）**：

- 先审 `skills/spec-review/SKILL.md`、`agents/review/*`、相关 tests，确认 source-of-truth 是否已完成
- 若 source-of-truth 正确，而 `.agents/skills/spec-review/SKILL.md` 落后，则把问题归类为 runtime artifact 刷新/验证项
- 通过同步链路刷新 runtime，再验证 `$spec-review` 实际消费到的新 contract

**通用原则**：
1. 遇到文件内容错误，先追溯其生成来源，再决定修改位置
2. 产物目录（`docs/contexts/`、`.spec-first/workflows/`、`.claude/`、`.codex/`、`.agents/skills/`）中的文件默认不应手工编辑
3. runtime 副本与源码不一致时，先判断“源码是否正确”，再判断“产物是否已刷新”
4. 若无法立即重新生成产物，手工临时修改只可作为短期验证手段，且必须同步修改源头；对安装型 runtime 副本应尽量避免这样做

**检查方式**：
```bash
grep -n "docs/contexts" skills/spec-graph-bootstrap/SKILL.md
```

```bash
grep -n "syncBundledAssets\\|syncSkills\\|syncAgents" src/cli/plugin.js
grep -n "skillsRoot\\|workflowsRoot" src/cli/adapters/codex.js
```

## Related

- `docs/plans/2026-04-13-002-artifact-path-standardization-design.md` — 产物路径标准化设计，解释了源头/产物分层的整体方案
- `docs/plans/2026-04-13-003-refactor-artifact-path-hard-cut-plan.md` — Unit 3 明确规定“只改 source-of-truth（skills/ 与 templates/），runtime 副本不作手工编辑入口”
- `docs/validation/2026-04-01-spec-bootstrap-deep-review.md` — 类似问题：PRD 模板（源头）vs 生成的 worker 产物的边界设计
