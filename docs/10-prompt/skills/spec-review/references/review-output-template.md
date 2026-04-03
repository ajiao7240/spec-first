# 代码审查输出模板

呈现综合评价结果时，请使用此**精确格式**。结果按严重程度分组，而不是按审阅者分组。

**重要提示：** 使用管道分隔的降价表 (`| col | col |`)。不要使用 ASCII 方框图字符。

## 例子

```markdown
## Code Review Results

**Scope:** merge-base with the review base branch -> working tree (14 files, 342 lines)
**Intent:** Add order export endpoint with CSV and JSON format support
**Mode:** autofix

**Reviewers:** correctness, testing, maintainability, security, api-contract
- security -- new public endpoint accepts user-provided format parameter
- api-contract -- new /api/orders/export route with response schema

### P0 -- Critical

| # | File | Issue | Reviewer | Confidence | Route |
|---|------|-------|----------|------------|-------|
| 1 | `orders_controller.rb:42` | User-supplied ID in account lookup without ownership check | security | 0.92 | `gated_auto -> downstream-resolver` |

### P1 -- High

| # | File | Issue | Reviewer | Confidence | Route |
|---|------|-------|----------|------------|-------|
| 2 | `export_service.rb:87` | Loads all orders into memory -- unbounded for large accounts | performance | 0.85 | `safe_auto -> review-fixer` |
| 3 | `export_service.rb:91` | No pagination -- response size grows linearly with order count | api-contract, performance | 0.80 | `manual -> downstream-resolver` |

### P2 -- Moderate

| # | File | Issue | Reviewer | Confidence | Route |
|---|------|-------|----------|------------|-------|
| 4 | `export_service.rb:45` | Missing error handling for CSV serialization failure | correctness | 0.75 | `safe_auto -> review-fixer` |

### P3 -- Low

| # | File | Issue | Reviewer | Confidence | Route |
|---|------|-------|----------|------------|-------|
| 5 | `export_helper.rb:12` | Format detection could use early return instead of nested conditional | maintainability | 0.70 | `advisory -> human` |

### Applied Fixes

- `safe_auto`: Added bounded export pagination guard and CSV serialization failure test coverage in this run

### Residual Actionable Work

| # | File | Issue | Route | Next Step |
|---|------|-------|-------|-----------|
| 1 | `orders_controller.rb:42` | Ownership check missing on export lookup | `gated_auto -> downstream-resolver` | Create residual todo and require explicit approval before behavior change |
| 2 | `export_service.rb:91` | Pagination contract needs a broader API decision | `manual -> downstream-resolver` | Create residual todo with contract and client impact details |

### Pre-existing Issues

| # | File | Issue | Reviewer |
|---|------|-------|----------|
| 1 | `orders_controller.rb:12` | Broad rescue masking failed permission check | correctness |

### Learnings & Past Solutions

- [Known Pattern] `docs/solutions/export-pagination.md` -- previous export pagination fix applies to this endpoint

### Agent-Native Gaps

- New export endpoint has no CLI/agent equivalent -- agent users cannot trigger exports

### Schema Drift Check

- Clean: schema.rb changes match the migrations in scope

### Deployment Notes

- Pre-deploy: capture baseline row counts before enabling the export backfill
- Verify: `SELECT COUNT(*) FROM exports WHERE status IS NULL;` should stay at `0`
- Rollback: keep the old export path available until the backfill has been validated

### Coverage

- Suppressed: 2 findings below 0.60 confidence
- Residual risks: No rate limiting on export endpoint
- Testing gaps: No test for concurrent export requests

---

> **Verdict:** Ready with fixes
>
> **Reasoning:** 1 critical auth bypass must be fixed. The memory/pagination issues (P1) should be addressed for production safety.
>
> **Fix order:** P0 auth bypass -> P1 memory/pagination -> P2 error handling if straightforward
```

## 格式规则

- **管道分隔的降价表** -- 绝不是 ASCII 画框字符
- **按严重性分组的部分** -- `### P0 -- Critical`、`### P1 -- High`、`### P2 -- Moderate`、`### P3 -- Low`。省略空的严重级别。
- **始终包含文件：行位置**以解决代码审查问题
- **审阅者列**显示哪些角色标记了该问题。多个审稿人=跨审稿人协议。
- **置信度列**显示结果的置信度得分
- **路线列**将综合处理决策显示为“`<autofix_class> -> <owner>`”。
- **标题包括**范围、意图和审核团队以及每个条件的理由
- **模式行** -- 包括 `interactive`、`autofix` 或 `report-only`
- **应用的修复部分** -- 仅包括在此审查调用中运行修复阶段时
- **剩余可操作工作部分** - 仅当未解决的可操作结果移交给后续工作时才包含
- **预先存在的部分** - 单独的表，无置信度列（这些是信息性的）
- **学习和过去的解决方案部分** - 来自学习研究人员的结果，包含文档/解决方案/文件的链接
- **代理与本地差距部分**——来自代理本地审核者的结果。如果没有发现间隙则省略。
- **模式漂移检查部分**——来自模式漂移检测器的结果。如果代理未运行则省略。
- **部署注释部分** -- 来自部署验证代理的关键清单项目。如果代理未运行则省略。
- **覆盖范围**——抑制计数、残余风险、测试差距、失败的审阅者
- **摘要使用块引用**进行判决、推理和修正顺序
- **水平规则** (`---`) 将调查结果与判决分开
- **`###` 每个部分的标题**——绝不是纯文本标题
