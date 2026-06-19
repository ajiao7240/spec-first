---
title: "feat: CE 对比文档暴露的 spec-first 优化技术方案"
spec_id: SF-2026-06-19-001-ce-followup
type: feat
status: completed
plan_depth: deep
created: 2026-06-19
target_repo: spec-first
origin: docs/validation/2026-06-19-ce-recent-diff-comparison.md
referenced_reviews:
  - path: docs/validation/2026-06-19-ce-recent-diff-comparison.md
    role: origin
    scope: in
    addresses_findings: ["CE-P2-origin-aware-calibration", "CE-P2-worktree-existing-isolation", "CE-P3-plan-sections"]
    deferred_findings: ["CE-P4-proof-product-decision", "CE-P3-config-read-pattern", "CE-P4-ce-sync-methodology"]
    note: "Addresses open optimization items; validator fallback is already resolved and treated as premise evidence."
  - path: docs/validation/2026-06-19-origin-calibration-eval.md
    role: cross-reference
    scope: in
    note: "Measurement evidence for U1; not an independent review origin."
---

# feat: CE 对比文档暴露的 spec-first 优化技术方案

> 注：本方案没有可继承 `spec_id` 的上游 requirements 文档，origin 为两份 validation 报告，故 `spec_id` 为 plan-local，未继承 origin 身份。

---

## Summary

基于 `docs/validation/2026-06-19-ce-recent-diff-comparison.md` 及配套度量 `docs/validation/2026-06-19-origin-calibration-eval.md`，本方案识别 spec-first 仍**真正开放**的优化点并给出落地路径。

关键前提（均已回源核验，**不是待办**）：

- **P1 validator fallback 已落地**：`spec-compound/SKILL.md` step 8 + `spec-compound-refresh/references/per-action-flows.md` Replace step 3 + `tests/unit/spec-compound-contracts.test.js` 已实现 loud-convention degraded mode。
- **origin 校准机制已实现**：注入在 `spec-doc-review/SKILL.md`（抽取 `origin:` / 传 `{origin}`）+ `references/subagent-template.md` document-type-rules，并由 `tests/unit/spec-doc-review-contracts.test.js` 锁住。首次度量为 **concerns**；本轮 expanded U1a（3 fixtures × 2 runs × 3 personas × A/B）已达到 **measured-improved**：`origin_set` 下安全属性与抑制属性均通过阈值，U1b template 强化不触发。

因此本方案聚焦三项本轮可执行工作：**(U1) 先扩展测量再条件性强化 origin 抑制**、**(U2) 给 internal `git-worktree` 补已有隔离检测的确定性事实合同**、**(U3) 选择性吸收 CE `plan-sections.md` 中不改变 artifact 生成语义的写作规则**。Proof 单向化、config-read 模式和 CE-sync 方法学修订均作为 deferred decision notes 留给后续独立 workflow，不进入本轮实现范围。

落地遵循 80/20：先补能验证当前痛点是否真实存在的 U1a 测量门与 U2 确定性 worktree 检测；只有 U1a 仍证明 origin 规则本身贡献不足，才做 U1b template 变更。当前代码校准结果是：U1a 已通过，U1b 不执行；U2/U3 按下方边界落地。U3 需先通过 admission gate，避免把 CE 文案增量变成无证据的 prompt 负担。

---

## Decision Brief

- **推荐先做**：U1a（扩大 fresh-source eval，零 source 行为变更）+ U2（确定性 worktree detect 合同）。U1b template 强化只在 U1a 仍显示 origin 抑制失败时执行；否则保留当前 confidence 50-cap 保护，不为低增益噪音增加 prompt 复杂度。当前校准：U1a 已通过，U1b 不触发。
- **Priority rationale**：U1 当前痛点是 reviewer 噪音归位（FYI vs residual），计划本身承认 actionable tier 已由 confidence 50-cap 保护；因此它需要先测量再改。U2 则是确定性 workflow safety：避免已在 linked worktree 中继续创建不可见/嵌套 worktree，且脚本已有 env/trust/path-safety 能力需要被事实合同保护。两者可并行设计，但实际 source 行为变更优先落 U2。
- **核心技术决策**：
  1. origin 抑制强化仍只允许在 template/orchestrator 层发生（`subagent-template.md` document-type-rules），**不把 CE 的 per-persona 硬抑制文案抄进 persona 文件**。理由：spec-first 角色契约 §5 明确校准注入在 dispatch 层、persona 不含 origin 文案是有意设计；这也正是 `origin-calibration-eval.md` 的推荐后续 #1。
  2. `git-worktree` 补「已有隔离检测」**增强而非删除脚本**；检测逻辑收敛为 `worktree-manager.sh detect --json` 产生 machine-readable facts，SKILL prose 只消费事实并做语义决策。任何 host-native worktree primitive 只能在当前 host 明确暴露且能映射同等 env/trust/audit/path-safety 行为时使用；本计划不再声称 `EnterWorktree`/`WorktreeCreate` 已是 spec-first runtime contract。
  3. `plan-sections.md` 只吸收与现有 canonical Markdown 不冲突、且不改变 plan artifact 生成/路由语义的写作规则，**不引入 HTML/output-format contract**，也不在本轮引入「何时不生成 plan」的行为政策。
- **验证焦点**：U1 必须先用 expanded fresh-source eval 定义通过/失败阈值；U2 必须用脚本合同测试证明 detect facts 与既有 safety 行为不回退；U3 必须证明新增 prose 对当前 plan-writing 失败有实际防护价值。
- **最大风险**：U1 过度抑制 → 压掉真正应被发现的 scope/product 问题。缓解：先做 U1a expanded measurement；只有失败门命中才做 U1b template 变更，并保留 50-cap、carve-out 与 eval gate。

---

## Direct Evidence

- target_repo: spec-first
- source_refs:
  - docs/validation/2026-06-19-ce-recent-diff-comparison.md
  - docs/validation/2026-06-19-origin-calibration-eval.md
  - skills/spec-doc-review/SKILL.md (origin 抽取/dispatch)
  - skills/spec-doc-review/references/subagent-template.md:178 (document-type-rules origin 规则)
  - agents/spec-{adversarial-document,product-lens,scope-guardian}-reviewer.agent.md (persona 不含 origin 文案，确认)
  - skills/git-worktree/SKILL.md + skills/git-worktree/scripts/worktree-manager.sh（确认保留）
  - ../compound-engineering-plugin/plugins/compound-engineering/skills/ce-worktree/SKILL.md (Step 0 隔离检测设计；CE 为外部 sibling checkout，非 repo-local，判定算法已内嵌于本 plan U2 Approach 与对比文档)
  - skills/spec-plan/references/plan-sections.md vs ../compound-engineering-plugin/.../ce-plan/references/plan-sections.md (header 差异；CE 路径为 sibling，非 repo-relative)
  - tests/unit/{spec-doc-review-contracts,git-worktree-contracts,spec-plan-contracts,spec-compound-contracts}.test.js
- current_revision: 3d8f35d (+ 本会话未提交改动)
- worktree_dirty: true（本轮 source/docs/tests 有未提交改动，精确范围以 `git status --short` 为准）
- discovery_methods: rg / sed / node / 双仓 direct read（CE 源码取自 plugins/，非 .claude|.agents mirror）
- tests_or_logs: 见下方 `Implementation Calibration (2026-06-20)`；本方案已被执行并按当前 source/test 校准
- confidence: high（origin/validator/proof/worktree/计数 5 类共 13 处声明已回源核验）
- limitations: U1 expanded measurement 仍是 fresh-source proxy，非 typed runtime integration；plan-sections 吸收范围已由本轮 admission evidence 限定为 prose-only；Proof 方向需独立 brainstorm

---

## Context & Research

### 优化点来源映射（已核验状态）

| 来源（对比文档） | 优化点 | 当前真实状态 | 本方案处置 |
|---|---|---|---|
| 事实修正 #2 / 建议 #4 | validator fallback | **已落地** | 不列入；仅作前提 |
| 事实修正 #1 / P2 / 合理性表 | origin-aware 抑制 | 已实现；首次度量 concerns，expanded U1a 已 measured-improved | **U1a 已完成；U1b 不触发** |
| 逐文件 row 25/26、建议 #3、worktree 节 | git-worktree 已有隔离检测 | 已补 `detect --json` 事实合同 | **U2（确定性 safety 合同）已落地** |
| 逐文件 row 18、plan 节、建议 | CE plan-sections 高价值规则 | 已选择性吸收 2 节 prose-only 规则 | **U3（admission-gated prose 增强）已落地** |
| Proof 节、建议 #2、row 9/14/17/21/22 | Proof 单向 vs HITL | spec-first 保留 HITL（有意） | **D1（deferred decision note）** |
| 配置读取节、建议 #5 | config-read 模式 | 无 consumer | **D2（deferred pattern note）** |
| 本会话 doc-review 方法学发现 | CE-sync 分析方法 | diff-first 导致过 #1 误判 | **D3（deferred methodology note）** |

### 关键设计约束

- **角色契约 §5**：workflow dispatch 不能替代最终判断，且 internal/helper 边界需清晰；U1 因此把 origin 校准留在 dispatch/template 层，persona 保持单一职责。
- **`git-worktree` 是 internal-only helper**（`user-invocable: false`），由 `spec-work`/`spec-code-review` 委派；其脚本承担 env opt-in、dev-tool trust、path/symlink safety、audit log 等确定性职责，**不可删除**。
- **Markdown 是 plan 的 canonical artifact**，被 `spec-work`/`spec-write-tasks`/`spec-doc-review`/deepening 消费。U3 不得引入 exclusive HTML output。
- **eval harness 已存在**：`docs/validation/2026-06-19-origin-calibration-eval.md` 定义了 A/B fixture 与重跑条件；本轮 U1a expanded measurement 已追加在同一文档中。

---

## Implementation Units

### U1. 先测量、再条件性强化 doc-review origin 抑制（template 层）

- **Goal**：先确认 origin 抑制弱是否在更大样本中仍成立，再决定是否把 template 规则升级为真实有效的路由指令。目标行为：`origin: set` 的 plan 上，上游 WHAT/WHY 观察被路由到 `residual_risks` / `deferred_questions`（而非作为 FYI finding 抛出），同时不削弱对 plan 引入的新 scope 的批评。
- **Requirements**：对比文档 P2、事实修正 #1；`origin-calibration-eval.md` 推荐后续 #1。
- **Dependencies**：无（可独立先行）。
- **Files**：
  - `docs/validation/2026-06-19-origin-calibration-eval.md`（U1a：追加 expanded measurement 方案与结果，或新建第二次度量文档）
  - `skills/spec-doc-review/references/subagent-template.md`（U1b，仅当 U1a 失败门触发：document-type-rules / Confidence rubric 区域）
  - `tests/unit/spec-doc-review-contracts.test.js`（U1b：新增断言锁住强化后的措辞）
  - `CHANGELOG.md`
- **Approach**：
  - **U1a measurement gate（先做）**：按固定矩阵重跑 fresh-source eval：≥3 份 plan fixture、每份 ≥2 次运行、至少覆盖 `spec-adversarial-document-reviewer` / `spec-product-lens-reviewer` / `spec-scope-guardian-reviewer`。每份 fixture 同时包含「上游 WHAT/WHY」与「plan 引入的新 scope / contradiction / strategic risk」两类 finding。
  - **U1a pass / fail threshold**：
    - Safety pass：`origin: set` 下，plan 引入的新 scope / contradiction / strategic risk 在每份 fixture 中仍至少由 1 个 relevant persona 以 confidence 75+ 触发。
    - Suppression pass：`origin: set` 下，上游 WHAT/WHY 观察在 ≥80% run-persona 样本中不进入 `findings`，而是进入 `residual_risks` / `deferred_questions` 或被抑制；同时 `origin: none` 变体不得被同规则压制。
    - Fail condition：若 suppression 仍主要依赖 confidence 50-cap（上游 WHAT/WHY 继续进入 FYI findings），则执行 U1b；若样本结果不稳定或不足以判定，记录 `concerns`，不得声称 `measured-improved`。
  - **U1b template change（条件执行）**：仅在 U1a fail condition 命中时，在 document-type-rules 中把当前「do not routinely re-litigate upstream WHAT/WHY」从「软提示」升级为「显式路由指令」：当 `Origin` 是 path 且 finding 属上游 WHAT/WHY（premise / 已定备选 / 已定优先级）时，要求 reviewer 将其放入 `residual_risks` / `deferred_questions` 并注明「carried from origin, not re-litigated」，而非作为 actionable/FYI finding。
  - **carve-out 必须保留**：plan 引入的新 scope、与 origin 矛盾、新 strategic/architectural 风险仍照常作为 finding 触发（这是安全属性）。
  - **不改 persona 文件**（不抄 CE `Suppress Section 1&5 entirely`），保持 §5 ownership。
  - 保留 confidence 50-cap，不依赖单一机制。
  - **Fallback decision**：如果 U1b 后 expanded eval 仍显示只有 confidence 50-cap 在保护 actionable tier，停止继续调 template；后续只能在新的 plan 中评估 synthesis routing 或针对前提敏感 persona 的更窄约束。
- **Patterns to follow**：现有 subagent-template.md document-type-rules 结构；`scope-guardian` 在 eval 中已自发表现的 `residual_risks` 路由行为可作为目标范式。
- **Execution note**：先执行 U1a 并记录结果；只有 U1a 失败门触发时，才写/更新 `spec-doc-review-contracts.test.js` 断言（characterization）并改 template 措辞。
- **Test scenarios**：
  - Covers（safety）：`origin: set` + plan 引入推测性新框架 / contradiction / new strategic risk → 仍以高置信触发 finding（断言 template 含 carve-out 措辞）。
  - 抑制：`origin: set` + 上游已定 premise / alternative / priority → expanded eval 统计应进入 `residual_risks` / `deferred_questions` 或被抑制，不进入 FYI/actionable findings。
  - 边界：`Origin: none` → 不应用抑制，premise review 照常。
  - 契约（U1b only）：`spec-doc-review-contracts.test.js` 断言强化后的关键句存在，防回退。
  - 行为验证：fresh-source eval（按 `fresh-source-eval-checklist.md`）对 3 个前提敏感 persona 重跑 A/B，按固定阈值记录 `concerns` / `measured-improved` / `no-change`。
- **Verification**：U1a 度量文档写回；若执行 U1b，则契约测试通过且 expanded fresh-source eval 显示 safety pass、suppression pass。未满足阈值时保持 `concerns` 并停止继续扩大 prompt 改动。
- **Current calibration (2026-06-20)**：U1a 已写回 `docs/validation/2026-06-19-origin-calibration-eval.md`；18/18 `origin_set` 样本通过 safety 与 suppression threshold；U1b 不触发，不修改 `subagent-template.md` 或 `spec-doc-review-contracts.test.js`。

### U2. 给 `git-worktree` 补「已有隔离检测」（不删脚本）

- **Goal**：已在 linked worktree 时识别隔离状态并原地工作（而非再生成同级 worktree——脚本已用 `git worktree list --porcelain | head -n 1` 锚定 main 根，从 linked worktree 调用 `create` 会建在 main 根下、不会嵌套，故真实缺口是「识别已隔离并原地工作」而非防嵌套）；保留脚本的确定性安全能力。
- **Requirements**：对比文档 worktree 节、建议 #3、逐文件 row 25/26。
- **Dependencies**：无。
- **Files**：
  - `skills/git-worktree/SKILL.md`（新增 Step 0 检测；native-tool 协调约束仅保留在 Decision Brief，本轮不写入 SKILL prose——当前无 host-native primitive 可协调）
  - `skills/git-worktree/scripts/worktree-manager.sh`（新增 `detect --json` 子命令输出确定性隔离事实；`status` 不作为合同或 alias）
  - `tests/unit/git-worktree-contracts.test.js`（断言检测契约）
  - 视情况：`skills/spec-work/SKILL.md`、`skills/spec-code-review/SKILL.md` 的 worktree handoff 文案（仅当 helper contract 改动需要）
  - `CHANGELOG.md`
- **Approach**：
  - 移植 CE Step 0 的**精确判定**：比较 resolved-absolute `--absolute-git-dir` 与 resolved-absolute `--git-common-dir`；相等=普通 checkout；不等→用 `--show-superproject-working-tree` 区分 submodule（非空=submodule，按普通处理）vs 已在 linked worktree（空=已隔离，原地工作）。
  - **事实层合同**：给 `worktree-manager.sh` 增加必需的 `detect --json` 子命令，不提供 `status` alias 或第二合同，输出 machine-readable facts；SKILL prose 只消费事实并做语义决策，符合「scripts prepare, LLM decides」。
  - **`detect --json` 输出合同（draft）**：
    ```json
    {
      "schema_version": "git-worktree-detect.v1",
      "state": "ordinary-checkout | linked-worktree | submodule | unknown",
      "reason_code": "same-git-dir | linked-worktree | submodule-superproject | not-git-repo | git-query-failed | output-contract-failed",
      "worktree_root": "<absolute path>",
      "main_worktree_root": "<absolute path or null>",
      "git_dir": "<resolved absolute path>",
      "common_dir": "<resolved absolute path>",
      "branch": "<current branch or null>"
    }
    ```
    Exit code `0` means a deterministic state was produced (`ordinary-checkout` / `linked-worktree` / `submodule`)；非 0 只用于不在 git repo、git query 失败或输出合同无法满足，并必须输出/携带 machine-readable `reason_code`。
  - **路径字段约束**：`detect --json` 仅供本地 shell 会话消费；持久化输出（日志、review artifact、`spec-work`/`spec-code-review` handoff 文案）只记 `state`/`reason_code`，不转发 `worktree_root`/`git_dir`/`common_dir`/`main_worktree_root` 等原始绝对路径，避免泄露 home/用户名/目录结构。
  - **脚本结构校准**：当前 `worktree-manager.sh` 在文件顶部立即计算 `GIT_ROOT=$(git worktree list --porcelain ...)` 与 `WORKTREE_DIR`，这会让非 git repo / query failure 在进入 `main()` 前失败。实现 `detect --json` 时必须把 repo discovery 移入命令函数或惰性初始化，让 `detect` 和 `create` 都能先产生确定性 reason_code，而不是被 `set -euo pipefail` 的全局初始化提前打断。
  - **Consumer behavior**：`state=linked-worktree` 时不得再创建新的 `.worktrees/<branch>`；报告当前 worktree path/branch 并原地工作。`state=ordinary-checkout` 或 `submodule` 时才允许进入 create path。`state=unknown` 或非 0 时停止并报告 reason_code，不 silent fallback 到 raw `git worktree add`。`create` path 必须在执行 `mkdir -p "$WORKTREE_DIR"` 或 `git worktree add` 前消费同一检测函数，防止绕过 `detect --json`。
  - **与 host-native 工具协调**：本计划不声称 `EnterWorktree` / `WorktreeCreate` 已是 spec-first runtime contract。若未来当前 host 明确暴露 native worktree primitive，只有在它能提供或等价映射 `detect --json` 的状态事实，并保留 helper 既有 env opt-in、dev-tool trust、path/symlink safety、audit log 行为时，才可优先使用；否则仍以 helper script 为事实与创建入口。
  - **明确不做**：不删除 `worktree-manager.sh`，不转「native-first 去脚本化」整改（那是独立 contract migration）。
- **Patterns to follow**：CE `ce-worktree/SKILL.md` Step 0（仅借判定算法，不借「删脚本」结论）；现有 `git-worktree` allowed-tools 与 `${CLAUDE_SKILL_DIR}` fallback 形态。
- **Test scenarios**：
  - 普通 checkout（abs git dir == abs common dir）→ `state=ordinary-checkout`，允许继续创建。
  - 已在 linked worktree（不等 + superproject 空）→ `state=linked-worktree`，报告路径与分支，原地工作，不创建。
  - submodule（不等 + superproject 非空）→ `state=submodule`，按普通 checkout 处理。
  - 子目录调用：相对/绝对 git dir 混用不产生 false「已隔离」（resolved-absolute 比较）。
  - 非 git 目录：`detect --json` 非 0，输出 `state=unknown`、`reason_code=not-git-repo`；`create` 不得继续。
  - 契约：`git-worktree-contracts.test.js` 断言 `detect --json` schema_version、state enum、reason_code enum、exit-code 语义、三态判定与「不创建嵌套」约束；并覆盖 `create` 在 linked worktree / unknown 状态下不会创建 nested `.worktrees/<branch>`。
  - Safety parity：任何 host-native path 的文案/测试必须证明不会绕过 env opt-in、dev-tool trust、path/symlink safety、audit log；无法证明时不得优先 native path。具体回归断言（独立于是否引入 native path，必须存在且不回退，否则 parity proof 无锚）：① symlinked `.gitignore`/env dest/env-copy log 拒绝；② env copy 目标 path-escape 守卫；③ `--copy-env` 写 SHA-256 审计日志；④ 分支感知 dev-tool trust 拒绝非基线分支自动信任。
- **Verification**：脚本/契约测试通过；在普通 checkout、linked worktree、submodule、子目录四种场景手验判定正确；脚本既有 env/trust/audit/path-safety 测试不回退。
- **Current calibration (2026-06-20)**：`worktree-manager.sh` 已新增 `detect --json`，未保留 `status` alias；移除加载期 `GIT_ROOT`/`WORKTREE_DIR` git 查询并改为惰性检测；`create` 在 `mkdir -p`/`git worktree add` 前消费同一检测函数并拒绝 `linked-worktree`/`unknown`；`main_worktree_root` 仅在能确认真实工作树根时填充，`--separate-git-dir` 的 linked worktree 返回 `null` 而非误报 git dir；`skills/git-worktree/SKILL.md` 只描述 Step 0 与 helper 行为，未写入未核实 host-native primitive 协调 prose；`tests/unit/git-worktree-contracts.test.js` 覆盖 ordinary/subdir/linked/submodule/non-git、separate-git-dir facts/create 锚点、create 阻断和既有 env/path/audit/trust safety。

### U3. 选择性吸收 CE `plan-sections.md` 高价值写作规则

- **Goal**：在不改 plan output contract、artifact 生成语义或 workflow routing 的前提下，只引入 CE 已较成熟且低风险的写作规则：prose economy 与 agent agency。
- **Requirements**：对比文档 plan 节、建议（plan-sections 可单独审查吸收）、逐文件 row 18。
- **Dependencies**：建议在 U1/U2 之后，且必须先通过 admission gate（属内容增强，非阻塞）。
- **Files**：
  - `skills/spec-plan/references/plan-sections.md`（新增/合并 `Agent Agency` 与 `Prose Economy` 两节，对齐现有 Outcome/Hard Floor/Include When Material 结构）
  - `tests/unit/spec-plan-contracts.test.js`（若契约断言 section 名/规则）
  - 视情况：`skills/spec-plan/references/plan-template.md`（仅当新增规则影响骨架）
  - `CHANGELOG.md`
- **Approach**：
  - **Admission gate**：执行前必须能指出至少一个当前 spec-plan 文档失败样本或 recent review finding，说明 prose economy / agent agency 规则会实际防止该问题；若没有样本，U3 保持 deferred，不为“看起来更成熟”的文案增加 prompt 负担。
  - **当前候选 admission evidence**：本计划早期草稿曾把若干条目作为 implementation units 与 deferred/optional 边界混杂（后重构为 U1–U3 + D1/D2/D3 deferred notes，本文档当前不含 U4/U5/U6）；CE `plan-sections.md` 的「Agent agency」支持按内容新增合适 section，「Prose economy」中的 resolve-in-place / don't stratify 可直接防止这类层叠式修补。执行 U3 时应把该重构作为 admission evidence 记录，而不是重新声称“泛化写作规则看起来更成熟”。
  - **只吸收不改变行为的语义写作规则，不吸收 HTML/output-format gate，也不吸收 plan artifact admission policy**。本轮候选仅包括：
    - 「Prose economy」→ 写作精简规则，减少 padding、hedges、nominalization，保留路径/ID/阈值精度。
    - 「Agent agency」→ 给实现 agent 适当裁量权，强调 section catalog 是 floor not ceiling，但不授权省略 canonical markdown plan。
  - **Deferred contract decision**：「Decide whether a plan doc is warranted at all」可能改变 `spec-plan` 是否生成 canonical artifact，影响 `spec-work` / `spec-write-tasks` / `spec-doc-review` handoff；不作为本轮 prose-only 增强落地。若未来要引入，必须另开 contract decision，明确它是 authoring advice 还是允许 workflow 不生成 plan artifact。
  - 用 spec-first 术语改写，避免引入 CE 的 model-tiers/output config 上下文。
  - 经 `spec-doc-review` 确认不与现有 ID/content rules、Rendering Boundary 冲突。
- **Patterns to follow**：现有 `plan-sections.md` 的 H2 结构与措辞密度。
- **Test scenarios**：
  - Admission：至少一条当前 plan-writing failure / recent review finding 能被新增规则直接防止；否则不执行 U3。
  - 契约：若 `spec-plan-contracts.test.js` 断言 section 集合，更新断言并保持 Markdown canonical。
  - 回归：现有 plan 模板渲染/`init-plan*` 测试不回退。
  - Test expectation：prose-only 内容增强，不改变 artifact admission / workflow routing 行为；以 doc-review + 契约断言为主。
- **Verification**：Admission evidence 记录在变更说明；`spec-plan-contracts.test.js` 与 `init-plan*` 测试通过；doc-review 确认无 contract 漂移。
- **Current calibration (2026-06-20)**：当前 source 仅新增 `Agent Agency` 与 `Prose Economy`，未改 `plan-template.md`；`tests/unit/spec-plan-contracts.test.js` 已断言 canonical Markdown、optional HTML sidecar、禁止 CE `Decide whether a plan doc is warranted at all` 与 `Plans carry **no status field**` 语义。

## Deferred Decision Notes

这些条目来自 origin 对比文档，但不属于本轮 implementation units。它们只提供后续 workflow 的 handoff 问题，不要求本轮创建 brainstorm、contract note 或方法学文档。

### D1. Proof 单向化产品方向（deferred）

- **Decision question**：spec-first 是否放弃 local sync-backed HITL evidence loop，转向 CE 式 one-way publish/shareable link。
- **Requirements**：对比文档 Proof 节、建议 #2、逐文件 row 9/14/17/21/22。
- **Deferred reason**：这是产品/contract 决策，不是 CE wording patch；本轮只记录 handoff 问题，不创建 `docs/brainstorms/` 产物。
- **Future entrypoint**：`$spec-brainstorm`（产品方向）→ 如采纳，再独立 `$spec-plan` 做 contract migration。
- **Context to carry**：
  - 触及面：`skills/proof/SKILL.md`、`skills/proof/references/hitl-review.md`、`spec-brainstorm` / `spec-ideate` / `spec-plan` 的 handoff（`localSynced` 分支）、proof contracts、相关 workflow tests。
  - 取舍：单向化降低 API mutation / 本地覆盖风险 vs 失去「Proof review 后本地 artifact 作为 canonical 被更新」的证据闭环。
  - Security decision inputs：API mutation authorization、credential/session scope、audit trail、rollback/retry behavior、local overwrite or merge safety、Proof review data redaction。
- **Current-plan effect**：本仓 Proof 行为零变更；spec-first 维持 Proof HITL 现状，直到独立产品决策改变它。

### D2. 未来 config-read 模式（deferred）

- **Decision question**：若未来出现真实 local config consumer，spec-first 应采用什么读取模式。
- **Requirements**：对比文档 配置读取节、建议 #5。
- **Deferred reason**：无真实 consumer 前不引入配置系统，避免 speculative config truth。
- **Future pattern constraints**：
  - 路径用 `.spec-first/config.local.yaml`（非 `.compound-engineering`）。
  - `!` pre-resolution 只解析 repo root；skill body 用原生 file read。
  - 配置文件必须 local-only / untracked；不得记录 raw values 到日志或 review artifact。
  - 每个 consumer 必须定义自己的最小 schema / accepted keys；不得把该文件变成通用 unchecked settings bag。
  - 不存 credentials；若未来确需 credentials，必须另立计划定义 storage、rotation、access、redaction 和 audit 行为。
  - 必须提供 unavailable fallback；不引入 exclusive HTML output。
- **Current-plan effect**：本仓不出现新配置 truth，不新增配置文件或读取代码。

### D3. CE-sync 分析方法学修订（deferred）

- **Decision question**：是否需要把「全文源码优先于 git diff」沉淀为长期 CE-sync 方法学约定。
- **Requirements**：本会话 doc-review 方法学发现（已写入对比文档「方法学说明」）。
- **Deferred reason**：它是低优先级方法学沉淀，当前计划没有确定唯一 source contract；本轮不让实现者临场发明落点。
- **Future acceptance**：只有找到既有 sync 方法 contract 或明确指定单一目标文件时才执行；否则继续保留为 deferred note。
- **Current-plan effect**：不创建新机制、不建脚本、不改 validation 模板。

---

## System-Wide Impact

| 受影响面 | 单元 | 影响 |
|---|---|---|
| `spec-doc-review` template + 契约测试 | U1 | U1a 先新增/扩展 eval evidence；仅 U1b 触发时才改变 reviewer routing |
| `git-worktree` helper + 脚本 + 调用方 handoff | U2 | worktree 创建前新增检测；`spec-work`/`spec-code-review` 文案可能微调 |
| `spec-plan` 写作规则 | U3 | 仅在 admission gate 通过后增强 prose economy / agent agency；plan 输出形状与是否生成 artifact 的语义不变 |
| Proof 链路 | D1 | 本轮零变更；仅保留后续 brainstorm 的问题清单 |
| 配置系统 | D2 | 本轮零变更；不新增配置 truth |
| CE-sync 分析约定 | D3 | 本轮零变更；不发明方法学 contract 落点 |

---

## Risks & Mitigations

- **U1 过度抑制**（最高风险）：可能压掉应被发现的 scope/product 问题。缓解：先做 U1a expanded measurement；U1b template 变更必须保留 50-cap 与 carve-out，并通过 safety pass。
- **U1 度量统计力弱**：eval 为 N=1 single-run。缓解：本方案把 expanded measurement 作为前置 gate；未满足固定阈值时不得声称 `measured-improved`，也不得继续扩大 prompt 改动。
- **U2 检测误判**：相对/绝对 git dir 混用导致 false「已隔离」。缓解：严格 resolved-absolute 比较 + submodule 区分 + 四场景测试。
- **U2 范围蔓延**：易滑向「删脚本/native-first」或依赖未核实 host primitive。缓解：本方案明确 helper script 是事实合同主路径；native 只能作为已核实且安全等价的条件路径，删脚本另立 migration plan。
- **U3 contract 漂移**：plan-sections 改动可能影响 plan 输出 contract 与下游 tests。缓解：admission gate；只吸收 prose economy / agent agency，不引入 output-format，不引入 artifact admission policy；doc-review + 契约/`init-plan` 测试把关。
- **D1 误同步**：把 Proof 产品决策当 wording patch。缓解：本方案不实现、不产 brainstorm artifact；后续强制走 brainstorm + 独立 contract migration plan。

---

## Scope Boundaries

### In scope
- U1a expanded origin-calibration measurement；U1b 条件性 template 强化（仅当 U1a fail condition 命中）
- U2 git-worktree 已有隔离检测事实合同（保留脚本）
- U3 plan-sections prose economy / agent agency 选择性语义吸收（仅 admission gate 通过后）

### Deferred for later
- **D1 Proof 方向**：Proof 单向化若被 brainstorm 采纳，作为独立 plan + contract tests + downstream consumer 检查执行。
- **D2 config-read 实现**：无真实 consumer 前不引入（YAGNI）；仅保留 future pattern constraints。
- **D3 CE-sync 方法学**：只有存在单一目标 source contract 时才落地；否则不让本轮实现者发明落点。
- **Plan artifact admission policy**：CE 「Decide whether a plan doc is warranted at all」需独立 contract decision；本轮不改变 `spec-plan` 是否生成 canonical markdown plan 的语义。

### Outside this product's identity / 不做
- 不删除 `skills/git-worktree/scripts/worktree-manager.sh`。
- 不把 CE per-persona 硬抑制文案抄进 spec-first persona 文件（违反 §5）。
- 不引入 exclusive HTML output / CE output-format contract。
- 不同步 CE release metadata / plugin manifests / 产品专用 skill。
- 不恢复 reviewer 的 `Write` 工具权限。

---

## Assumptions

- 对比文档与 eval 的回源核验结论稳定（本会话已验 13 处声明一致）。
- `git-worktree` 维持 internal-only helper 定位，不在本轮升级为公开入口。
- spec-first 维持 Proof HITL 现状，直到独立产品决策改变它。
- 当前仓库没有已确认的 `EnterWorktree` / `WorktreeCreate` runtime contract；U2 以 helper script `detect --json` 为事实层主路径。

---

## Sequencing（推荐落地顺序）

1. **U1a**（measurement gate，无 source 行为改动）—— 先扩展 fresh-source eval，决定是否真的需要 U1b。
2. **U2**（确定性收益）—— 落 `worktree-manager.sh detect --json` + SKILL consumer prose + contract tests。
3. **U1b**（条件执行）—— 仅当 U1a fail condition 命中时，改 template + contract tests + eval 复测。
4. **U3**（条件执行）—— 仅 admission gate 通过后吸收 prose economy / agent agency，并跑 plan contract tests。

每个单元独立可交付、按 commit 粒度落地；U1/U2/U3 各自配套契约测试与最窄验证（`npm run test:unit` 子集 + 受影响 contract test）。D1/D2/D3 不作为本轮 task。

---

## Implementation Calibration (2026-06-20)

| Item | Current code/doc state | Calibration result |
|---|---|---|
| U1a expanded origin measurement | `docs/validation/2026-06-19-origin-calibration-eval.md` 已追加 3 fixtures × 2 runs × 3 personas × A/B 结果；`status: measured-improved` | 满足方案 threshold；U1b 不触发 |
| U1b template strengthening | `skills/spec-doc-review/references/subagent-template.md` 与 `tests/unit/spec-doc-review-contracts.test.js` 未因 U1b 改动 | 符合条件执行边界；不为了低增益噪音增加 prompt 复杂度 |
| U2 worktree detection | `skills/git-worktree/scripts/worktree-manager.sh` 输出 `git-worktree-detect.v1`，`create` 先检测并 fail closed；`main_worktree_root` 不把 separate-git-dir 的 git dir 当工作树根；`skills/git-worktree/SKILL.md` Step 0 消费事实合同 | 与方案一致；脚本保留，未转 native-first |
| U2 tests | `tests/unit/git-worktree-contracts.test.js` 覆盖 ordinary/subdir/linked/submodule/non-git、separate-git-dir facts/create 锚点、create 阻断、env/path/audit/trust regression | 与方案一致；仍需最终验证命令输出作为 closeout 证据 |
| U3 plan prose rules | `skills/spec-plan/references/plan-sections.md` 只新增 `Agent Agency` 与 `Prose Economy`；`tests/unit/spec-plan-contracts.test.js` 防引入 CE plan-admission/no-status 语义 | 与方案一致；未改变 markdown canonical artifact |
| D1 Proof | 未改 `skills/proof/**`、proof contracts 或 brainstorm/plan/ideate Proof handoff | 保持 deferred |
| D2 config-read | 未新增 `.spec-first/config.local.yaml`、config schema 或 consumer | 保持 deferred |
| D3 CE-sync methodology | 未新增方法学 contract、脚本或 validation 模板 | 保持 deferred |

---

## Deferred / Open Questions

### From 2026-06-19 doc-review

- **[P1] U1 是否值得留在本轮 in-scope？** 计划自承 actionable tier 已由 confidence 50-cap 保护，U1 可交付收益仅为「上游 WHAT/WHY 从 FYI 归位到 residual」的 FYI 层整理；且 U1a 依据的 fresh-source eval 被 eval 自身声明为「dispatch 代理、非运行时集成测试，typed dispatch 可能用缓存定义」——该 gate 度量的并非生产 typed-agent 行为，扩样本只提升采样稳定性、不缩小 proxy↔runtime 缺口。**决策**：要么在 Summary 给出「FYI→residual 归位」的真实用户可感成本实例、立 U1 为 first-class；要么把 U1 整体降为与 D1/D2/D3 同级 deferred，本轮只留 U2 + U1a 测量。（跨 persona：adversarial / scope-guardian / product-lens）
- **[P1] U1a 判定逻辑欠定义（cascaded from 上一条）。** 实现者无法确定 U1b 触发时机：「样本不稳定/不足→记 `concerns`」未说明这算不算「失败门触发」；`≥80%` 抑制阈值在失败条件中从未被引用，且未定义是 per-fixture（6 中 5）还是全矩阵（18 中 15），在 eval 自陈高采样方差下单个离群样本即可翻转。若 U1 保留，需把触发条件三态写死（fail→执行 U1b / indeterminate→记 concerns 不执行 / pass→关闭 U1）并定义 `≥80%` 为全 18 样本矩阵向下取整、明确 `residual_risks` 路由是否计入「不进入 findings」。（coherence + feasibility）
- **[P2] 是否把 U2 拆为独立 plan，并复核 in-scope/deferred 战略权重？** U2 是唯一无条件确定性收益单元，却与两个条件单元捆在一个 spec_id；origin 对比文档本身建议「单独做 worktree helper migration plan」。同时被 deferred 的 D1（Proof 单向化，origin 评为影响 requirements/plan/ideation canonical artifact 流的高权重决策）战略权重高于在 scope 的 U1/U3。建议在本 plan 显式声明「最高战略权重项 D1 是有意 deferred」，避免 in-scope 集被误读为优先级序。（product-lens；注：U2 已在并发实现，「拆 plan」实际意义降低，保留为战略记录）

> 注：本节由 2026-06-19 doc-review 写入，记录已 Defer 的开放决策；上方 Implementation Units 已应用同轮的具体修复（U2 Goal 去 strawman、移除投机 native prose、detect 路径字段约束、Safety parity 具名断言、source_refs 标注 CE sibling、U3 admission evidence 去除悬空 U4/U5/U6 引用）。

---

## Completion Evidence

- **Implementation scope**：U1a expanded origin measurement 写回，U1b 未触发；U2 `git-worktree` detect facts contract 落地；U3 `plan-sections.md` prose-only 规则落地。D1/D2/D3 保持 deferred。
- **Verification**：`bash -n skills/git-worktree/scripts/worktree-manager.sh`、`npx jest tests/unit/git-worktree-contracts.test.js --runInBand`、`npx jest tests/unit/spec-plan-contracts.test.js --runInBand`、`npx jest tests/unit/spec-doc-review-contracts.test.js --runInBand`、`npx jest tests/unit/changelog-format.test.js --runInBand`、`npm run typecheck`、`git diff --check`、`git diff --check --cached` 均通过；手验当前仓 `detect --json` 为 `ordinary-checkout/same-git-dir`，非 git 目录为 `unknown/not-git-repo` 且退出码 1，`--separate-git-dir` ordinary checkout 的 `main_worktree_root` 为工作树根，linked worktree 中为 `null`。
- **Review status**：scoped report-only review completed in current agent；后续复审发现的 `main_worktree_root` separate-git-dir 语义漂移与计划 `status` alias stale 声称均已修复并复测。No `$spec-code-review` artifact was written.
- **Generated runtime**：未修改 `.claude/`、`.codex/`、`.agents/skills/`；如需刷新 runtime，由后续 `spec-first init` 处理。
