# 技术方案：spec-plan 与 spec-code-review 文案优化

Created: 2026-05-09

## 目标

在不改变架构、不新建 reference 文件、不改变外部行为的前提下，通过纯文案精简提升两个核心 skill 的执行质量。预计 spec-plan 减少 60-80 行，spec-code-review 减少 100-130 行。

## 约束

- 不拆分文件、不新建 references/
- 不改变 phase 路由逻辑和判断条件
- 不改变 skill 的外部调用接口
- 不删除任何功能性规则，只压缩表述
- 保持所有关键判断点的可见性

## 优化原则

1. 一次定义多次引用：重复规则只在首次完整描述，后续用 "(see Interaction Method)" 引用
2. 正面表述优先：连续否定合并为一句正面约束
3. 表格优于 prose：多条 if-then 规则用表格替代段落
4. 去重复模板：相同命令序列只保留一次
5. 压缩解释性文字：表格/代码块已自解释时删除重复 prose

---

## spec-plan 优化清单

### SP-1. Context Orientation Anchor 压缩（~15 行 → ~5 行）

当前问题：Standards consumption 的 5 级分类、degraded 处理、workspace-advisory-only 建议全部内联。

改写前（摘要）：
```
Orient from... Standards consumption contract: `confirmed` -> hard project context;
`observed` / `imported` / `suggested` -> advisory context; `conflict` -> risk context
to resolve or call out in the plan; `unknown` -> question context for user/project
evidence. If validation failed, is missing, reports `trust_level=degraded`, reports
`consumption_boundary=advisory_only`, or carries `workspace-advisory-only`, consume
standards artifacts as degraded/advisory only；遇到 workspace-advisory-only 时，可建议
用户运行 `spec-standards --repo <child>` 获取 child-local confirmed baseline。
Use `glue-map.json` for reuse-first implementation boundaries...
```

改写后：
```
Orient from the user request, existing plans/task packs, project role docs (AGENTS.md,
CLAUDE.md), .spec-first/standards/ artifacts, package manifests, nearby implementation
and test files, and git diff when applicable.

Standards trust: confirmed = hard context; observed/imported/suggested = advisory;
conflict = risk to resolve; unknown = question for user. Degraded/missing validation
→ advisory only. Use glue-map.json for reuse-first boundaries, not as workflow state.
```

### SP-2. Interaction Method 去重（节省 ~15 行）

当前问题：完整的 "use the platform's blocking question tool: AskUserQuestion in Claude Code (call ToolSearch with select:AskUserQuestion first if its schema isn't loaded) or request_user_input in Codex. Fall back to numbered options..." 在 spec-plan 中出现 5 次。

优化方案：
- 保留顶部 "## Interaction Method" 段落的完整描述（已有）
- 后续 4 处替换为：`Ask using the Interaction Method defined above.`
- 每处节省 3-4 行，合计 ~15 行

涉及位置：
- Phase 0.2（multiple source docs）
- Phase 0.5（blocking questions）
- Phase 2（planning questions）
- Phase 5.3.8（post-generation menu）

### SP-3. Phase 0.1 "deepen intent" 反面说明压缩（~15 行 → ~8 行）

当前问题：用 5 行解释哪些词不触发 deepening。

改写前：
```
Words like "strengthen", "confidence", "gaps", and "rigor" are NOT sufficient on
their own to trigger deepening. These words appear in normal editing requests
("strengthen that section about the diagram", "there are gaps in the test scenarios")
and should not cause a holistic deepening pass. Only treat them as deepening intent
when the request clearly targets the plan as a whole and does not name a specific
section or content area to change — and even then, prefer to confirm with the user
before entering the deepening flow.
```

改写后：
```
Anti-pattern: "strengthen", "gaps", "rigor" alone do NOT trigger deepening — these
appear in normal section-edit requests. Trigger only when the request targets the
plan as a whole without naming a specific section. When ambiguous, confirm with user.
```

### SP-4. Phase 0.4 bug-shaped prompt 跨仓描述压缩（~12 行 → ~5 行）

当前问题：跨仓 bug 场景的 announce/default/redirect 规则占 7 行，大多数调用不涉及。

改写前：
```
When the bug is at another local path, announce the target before any cross-repo
investigation: which path will be read and where the plan output will land. Default
to the target repo for both investigation and plan writing unless the user redirects.
Cross-repo target location and workflow choice are separate decisions; do not silently
write a plan into the wrong repository.

In headless mode, skip the route-out menu and continue with spec-plan. Auto-routing
into debugging would change workflows without synchronous user authorization.
```

改写后：
```
Cross-repo: announce target path before investigation; default to target repo for
both reading and writing. Headless mode: skip route-out menu, continue planning.
```

### SP-5. Phase 1.1a Graph Readiness 压缩（~40 行 → ~15 行）

当前问题：MCP fallback 链的每个分支都有 3-4 行解释，plan block 模板重复出现（Phase 1.1a 和 Phase 4 core template 各一次）。

优化方案：
- 保留核心逻辑：check artifacts → compare revision → determine status → fallback to MCP → fallback to direct reads
- 删除 "A successful or partial live MCP call does not change compiled query_ready..." 等防御性重复（已在 Context Orientation Anchor 中覆盖）
- plan block 模板只在 Phase 4 core template 中保留一次，Phase 1.1a 改为 "Include the Graph Readiness block (see core template in Phase 4.2)"

### SP-6. Phase 1.2 if-then 规则改为表格（~20 行 → ~12 行）

当前问题：5 个 bullet 的 "If specific frameworks... If the feature touches... If the scan detected..." 用 prose 描述。

改写后：
```
| Research finding | Action |
|-----------------|--------|
| Exact framework+version detected | Pass identifiers to spec-framework-docs-researcher |
| Technology layer well-established locally | Lean toward skipping external research |
| Technology layer absent or thin locally | Lean toward external research |
| Deployment infra detected | Note in planning context for downstream agents |
| Monorepo scoped to service | Pass service-specific tech context, not aggregate |
```

### SP-7. Phase 5.1 checklist spec_id 规则合并（~12 行 → ~4 行）

当前问题：4 条独立的 spec_id 检查项。

改写前：
```
- `spec_id` is present for software plans, is inherited from origin requirements
  when available, and is not changed during deepening or ordinary plan edits
- If the origin requirements document lacks `spec_id`, the plan explicitly says it
  uses a plan-local `spec_id` and that origin identity was not inherited
- If this plan is an alternative, independent delivery chain, or replacement for
  another plan from the same origin, the plan states why it inherits the existing
  `spec_id` or starts a new spec chain
```

改写后：
```
- `spec_id` present, correctly inherited or plan-local with stated reason; unchanged
  across edits/deepening; alternative/replacement chains explicitly justified
```

---

## spec-code-review 优化清单

### CR-1. Stage 1 shell 脚本去重复（节省 ~40 行）

当前问题：以下命令模板在 PR/branch/standalone 三条路径中各出现一次，完全相同：
```bash
echo "BASE:$BASE" && echo "FILES:" && git diff --name-only $BASE && echo "DIFF:" && git diff -U10 $BASE && echo "UNTRACKED:" && git ls-files --others --exclude-standard
```

优化方案：
- 在 Stage 1 开头定义一次 "scope output template"：
  ```
  SCOPE_OUTPUT: echo "BASE:$BASE" && echo "FILES:" && git diff --name-only $BASE &&
  echo "DIFF:" && git diff -U10 $BASE && echo "UNTRACKED:" && git ls-files --others --exclude-standard
  ```
- 三条路径各自只描述如何计算 `$BASE`，最后统一引用 "Then produce SCOPE_OUTPUT"
- 每条路径节省 2-3 行重复命令 + 1-2 行重复的 untracked handling 说明

### CR-2. Interaction Method 去重（节省 ~12 行）

当前问题：与 spec-plan 相同，完整的 AskUserQuestion/ToolSearch/fallback 描述出现 4 次。

优化方案：
- 保留 "Interactive mode rules" 中的完整 pre-load 描述（已有）
- Stage 2 ambiguous intent、After-Review routing question、post-run failure question 各处替换为 "Ask using the Interactive mode question tool (see Interactive mode rules above)"
- 每处节省 3 行

涉及位置：
- Stage 2 intent ambiguity question
- After-Review Step 2 routing question
- After-Review Step 2 option B failure-handling question
- After-Review Step 2 option C bulk-preview

### CR-3. Stage 5 step 6b 表格后解释删除（节省 ~8 行）

当前问题：recommended action 映射表格已经完全自解释，但后面跟了 8 行 prose 重复解释表格内容。

改写前（表格后）：
```
The presence of `suggested_fix` is the authoritative signal that the agent can act
on the finding. A `manual` finding with a concrete `suggested_fix` recommends Apply
because the persona committed to a defensible fix shape grounded in review context.
A `manual` finding without `suggested_fix` recommends Defer because the persona
signaled that the fix needs context the reviewer cannot provide. `autofix_class`
itself is not collapsed by this mapping; the report still records `manual` vs
`gated_auto`.
```

改写后：
```
Key: `suggested_fix` presence determines Apply vs Defer. `autofix_class` is preserved
in the report regardless of recommended action.
```

### CR-4. Stage 5 step 6c mode-aware demotion 压缩（~25 行 → ~10 行）

当前问题：3 个条件的规则用 25 行解释。

改写前（核心部分）：
```
A finding qualifies for demotion when **all** of these hold:
   - Severity is P2 or P3 (P0 and P1 always stay in primary findings)
   - `autofix_class` is `advisory` (concrete-fix findings stay in primary)
   - **All** contributing reviewers are `testing` or `maintainability` — if any
     other persona also flagged this finding, cross-reviewer corroboration is present
     and the finding stays in primary findings regardless...

When a finding qualifies, route by mode:
   - **Interactive and report-only modes:** Move the finding out of the primary
     findings set. If the contributing reviewer is `testing`, append... If
     `maintainability`, append...
   - **Headless and autofix modes:** Suppress the finding entirely...

Demotion is intentionally narrow. The conservative scope... do not expand the rule
by guessing... expand with evidence.
```

改写后：
```
Demotion gate (ALL must hold): P2/P3 + advisory + only testing/maintainability reviewers.

| Mode | Action |
|------|--------|
| Interactive / report-only | Move to soft buckets (testing_gaps or residual_risks) |
| Headless / autofix | Suppress entirely |

Do not expand demotion scope without evidence from real review runs.
```

### CR-5. After-Review routing option 描述压缩（~60 行 → ~25 行）

当前问题：option A/B/C/D 各有 10-15 行描述，大量内容是对 reference 文件的调用说明和 edge case 处理。

优化方案：保留每个 option 的核心行为（3-5 行），把 reference 调用压缩为一行指向：

改写后：
```
(A) Walk through each finding:
    Load `references/walkthrough.md`. Enter per-finding loop (Apply/Defer/Skip/Acknowledge).
    "Auto-resolve rest" exits loop → dispatch fixer on accumulated + remaining.

(B) Auto-resolve with best judgment:
    Dispatch fixer on full pending set. Items with suggested_fix → apply; advisory → no-op;
    cannot-apply → failed bucket. If failed non-empty → fire failure-handling question
    (File tickets / Walk through / Ignore).

(C) File tickets (when tracker available):
    Run Stage 5b validation → load `references/bulk-preview.md` → on Proceed, route all
    through `references/tracker-defer.md`. No fixes applied.

(D) Report only:
    Emit report. Proceed to Step 5 only if fixes_applied_count > 0.
```

### CR-6. Headless output format 模板注释压缩（节省 ~15 行）

当前问题：模板后的 "Detail enrichment (headless only)" 和 "Formatting rules" 段落有大量重复解释。

优化方案：
- "Detail enrichment" 的 field tiers/artifact matching/reviewer order/no-match fallback 4 段压缩为 2 行：
  ```
  Detail enrichment: load Why/Evidence from reviewer returns first; fall back to
  parent-owned artifact files matching file + line_bucket(+/-3). Omit if no match.
  ```
- "Formatting rules" 的 8 条 bullet 中，3 条是对已有规则的重复（needs-verification marker、pre_existing routing、omit empty sections），可删除

### CR-7. Stage 3b standards paths 压缩（~20 行 → ~8 行）

当前问题：glob 文件、过滤祖先目录、处理 standards-candidates.json 的步骤用 prose 描述。

改写后：
```
1. Glob `**/CLAUDE.md` and `**/AGENTS.md`; filter to ancestors of changed files
2. If `.spec-first/standards/standards-candidates.json` exists, include it and
   `standards-preview.md` in a separate `<standards-baseline-paths>` block
3. Pass path list to project-standards persona in `<standards-paths>` block

Trust rules: confirmed = hard criteria; observed/imported/suggested = advisory;
degraded/missing validation = advisory only, no hard findings.
```

### CR-8. Stage 4 "Dispatch capability gate" 否定句式合并（节省 ~5 行）

当前问题：5 条独立的 if/do-not 规则。

改写前：
```
- If the user explicitly requested subagents... continue with normal dispatch.
- If the active workflow or parent orchestrator explicitly delegated... continue.
- If the user explicitly requests report-only/no-agents mode... do not call Agent.
- ...the host lacks a dispatch primitive... do not call Agent.
- ...the current runtime cannot call it... do not call Agent.
```

改写后：
```
Dispatch proceeds when: user requested subagents, OR workflow delegated review,
OR direct invocation of code-review entrypoint (no second confirmation needed).

Dispatch blocked when: user requests no-agents, OR host lacks dispatch primitive,
OR runtime cannot call it. → Set single_agent_report_only_fallback: true.
```

---

## 预期收益汇总

### spec-plan

| 优化项 | 节省行数 | 风险 |
|--------|----------|------|
| SP-1 Context Anchor 压缩 | ~10 | 低 |
| SP-2 Interaction Method 去重 | ~15 | 低 |
| SP-3 Deepen intent 反面说明 | ~7 | 低 |
| SP-4 Bug-shaped prompt 跨仓 | ~7 | 低 |
| SP-5 Graph Readiness 压缩 | ~25 | 低 |
| SP-6 Phase 1.2 改表格 | ~8 | 低 |
| SP-7 Phase 5.1 spec_id 合并 | ~8 | 低 |
| **合计** | **~80** | |

目标：959 行 → ~880 行（减少 8%）

### spec-code-review

| 优化项 | 节省行数 | 风险 |
|--------|----------|------|
| CR-1 Stage 1 shell 去重 | ~40 | 中 |
| CR-2 Interaction Method 去重 | ~12 | 低 |
| CR-3 Step 6b 解释删除 | ~8 | 低 |
| CR-4 Step 6c demotion 压缩 | ~15 | 低 |
| CR-5 After-Review routing 压缩 | ~35 | 中 |
| CR-6 Headless 模板注释压缩 | ~15 | 低 |
| CR-7 Stage 3b standards 压缩 | ~12 | 低 |
| CR-8 Dispatch gate 合并 | ~5 | 低 |
| **合计** | **~142** | |

目标：920 行 → ~780 行（减少 15%）

---

## 风险评估

| 风险 | 影响 | 缓解 |
|------|------|------|
| 压缩后 LLM 遗漏边界条件 | 某些 edge case 处理不当 | 只压缩表述不删规则；保留表格形式的完整规则集 |
| shell 脚本去重后执行出错 | Stage 1 scope detection 失败 | 保留完整的 BASE 计算逻辑，只去重 output 模板 |
| After-Review 压缩后路由错误 | 用户选择后走错分支 | 保留 option letter 路由规则，只压缩每个分支的执行描述 |
| Interaction Method 引用后 LLM 找不到定义 | 跳过用户交互 | 引用格式统一为 "(see Interaction Method)" 并确保段落标题可搜索 |

---

## 实施顺序

### 第一批（低风险，立即可做）

1. SP-2 + CR-2：Interaction Method 去重（两个 skill 同时做，模式一致）
2. SP-1：Context Anchor 压缩
3. SP-3：Deepen intent 压缩
4. CR-3：Step 6b 解释删除
5. CR-4：Step 6c demotion 压缩
6. CR-8：Dispatch gate 合并

### 第二批（中风险，需要验证）

7. CR-1：Stage 1 shell 去重（需在新会话中验证 scope detection 正常）
8. CR-5：After-Review routing 压缩（需验证 option A/B/C/D 路由正确）
9. SP-5：Graph Readiness 压缩（需确认 plan block 模板不丢失）

### 第三批（收尾）

10. SP-4、SP-6、SP-7、CR-6、CR-7：剩余低风险项

---

## 验证方法

每批完成后：

1. `npm run lint:skill-entrypoints` — 确认治理无违规
2. `spec-first init --claude --dry-run` — 确认 runtime generation 正确
3. 在新 Claude Code 会话中调用 skill，验证：
   - spec-plan：从 bare prompt 走完 Phase 0-5，确认 plan 正常生成
   - spec-code-review：在有 diff 的分支上运行，确认 scope detection 和 reviewer dispatch 正常
4. 对比 git diff 确认只有文案变更，无逻辑删除

---

## 工作量估算

| 批次 | 工作量 | 说明 |
|------|--------|------|
| 第一批（6 项） | 2-3 小时 | 纯文本替换，风险低 |
| 第二批（3 项） | 2-3 小时 | 需要仔细验证 |
| 第三批（5 项） | 1-2 小时 | 收尾 |
| **合计** | **5-8 小时** | 可在 1-2 个 session 完成 |

---

## 不做的事情

- 不新建 reference 文件
- 不改变 phase/stage 编号
- 不改变 shell 脚本的实际逻辑（只去重 output 模板）
- 不改变 reviewer 选择规则
- 不改变 mode detection 判断条件
- 不改变 confidence-first gate 阈值
- 不改变 plan template 的 section 结构
