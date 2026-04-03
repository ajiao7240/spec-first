# 文档审核输出模板

呈现综合评价结果时，请使用此**精确格式**。结果按严重程度分组，而不是按审阅者分组。

**重要提示：** 使用管道分隔的降价表 (`| col | col |`)。不要使用 ASCII 方框图字符。

＃＃ 例子
```markdown
## Document Review Results

**Document:** docs/plans/2026-03-15-feat-user-auth-plan.md
**Type:** plan
**Reviewers:** coherence, feasibility, security-lens, scope-guardian
- security-lens -- plan adds public API endpoint with auth flow
- scope-guardian -- plan has 15 requirements across 3 priority levels

Applied 3 auto-fixes. Batched 2 fixes for approval. 4 findings to consider (2 errors, 2 omissions).

### Auto-fixes Applied

- Standardized "pipeline"/"workflow" terminology to "pipeline" throughout (coherence)
- Fixed cross-reference: Section 4 referenced "Section 3.2" which is actually "Section 3.1" (coherence)
- Updated unit count from "6 units" to "7 units" to match listed units (coherence)

### Batch Confirm

These fixes have one clear correct answer but touch document meaning. Apply all?

| # | Section | Fix | Reviewer |
|---|---------|-----|----------|
| 1 | Unit 4 | Add "update API rate-limit config" step -- implied by Unit 3's rate-limit introduction | feasibility |
| 2 | Verification | Add auth token refresh to test scenarios -- required by Unit 2's token expiry handling | security-lens |

### P0 -- Must Fix

#### Errors

| # | Section | Issue | Reviewer | Confidence |
|---|---------|-------|----------|------------|
| 1 | Requirements Trace | Goal states "offline support" but technical approach assumes persistent connectivity | coherence | 0.92 |

### P1 -- Should Fix

#### Errors

| # | Section | Issue | Reviewer | Confidence |
|---|---------|-------|----------|------------|
| 2 | Scope Boundaries | 8 of 12 units build admin infrastructure; only 2 touch stated goal | scope-guardian | 0.80 |

#### Omissions

| # | Section | Issue | Reviewer | Confidence |
|---|---------|-------|----------|------------|
| 3 | Implementation Unit 3 | Plan proposes custom auth but does not mention existing Devise setup or migration path | feasibility | 0.85 |

### P2 -- Consider Fixing

#### Omissions

| # | Section | Issue | Reviewer | Confidence |
|---|---------|-------|----------|------------|
| 4 | API Design | Public webhook endpoint has no rate limiting mentioned | security-lens | 0.75 |

### Residual Concerns

| # | Concern | Source |
|---|---------|--------|
| 1 | Migration rollback strategy not addressed for Phase 2 data changes | feasibility |

### Deferred Questions

| # | Question | Source |
|---|---------|--------|
| 1 | Should the API use versioned endpoints from launch? | feasibility, security-lens |

### Coverage

| Persona | Status | Findings | Auto | Batch | Present | Residual |
|---------|--------|----------|------|-------|---------|----------|
| coherence | completed | 3 | 2 | 0 | 1 | 0 |
| feasibility | completed | 2 | 0 | 1 | 1 | 1 |
| security-lens | completed | 2 | 0 | 1 | 1 | 0 |
| scope-guardian | completed | 1 | 0 | 0 | 1 | 0 |
| product-lens | not activated | -- | -- | -- | -- | -- |
| design-lens | not activated | -- | -- | -- | -- | -- |
```
## 部分规则

- **摘要行**：始终出现在审阅者列表之后。格式：“应用了 N 个自动修复。批量 M 个修复以供批准。需要考虑的 K 个发现（X 个错误，Y 个遗漏）。”省略任何零子句。
- **应用的自动修复**：列出自动应用的修复（自动类）。如果没有则省略部分。
- **批量确认**：对 `batch_confirm` 结果进行分组，以进行单个是/否/选择批准。如果没有则省略部分。
- **P0-P3 部分**：仅包含有发现的部分。省略空的严重级别。在每个严重性中，分为 **Errors** 和 **Omissions** 子标题。如果该严重性没有该类型，则省略子标头。
- **残余问题**：通过跨人物验证促进的低于置信阈值的发现，加上未促进的残余风险。如果没有则省略。
- **推迟的问题**：稍后工作流程阶段的问题。如果没有则省略。
- **覆盖范围**：始终包括在内。所有计数均为**合成后**。 **结果**必须完全等于“自动”+“批量”+“呈现”——如果重复数据删除合并了跨角色的结果，则将其归因于置信度最高的角色，并减少其他角色的计数。 **剩余** = 此角色的原始输出中的 `residual_risks` 计数（不是“剩余关注点”部分中的升级子集）。
