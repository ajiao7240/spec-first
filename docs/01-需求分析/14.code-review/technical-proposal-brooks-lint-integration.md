---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a88644969371398a873cabeac0a028ab_a723f56c629611f1832e5254006c9bbf
    ReservedCode1: Xyb8MKr5vxFiXuTNR0kjcK3wLeuFpKXObLuEpIbK0VKk3oPvPs17SHYZjYlnb7ynLqCR8HIKRVYBVzJ5CCxdpLtnS35VsJuV5XMhsLHV8K8RNo2qxtirXSC2qiDTZc7cR7kXzFxXTzEN8mXeoiUsKeWP6hpSKgnMrxwLBpHSLhZpMsXl4Zn31kjwbb4=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a88644969371398a873cabeac0a028ab_a723f56c629611f1832e5254006c9bbf
    ReservedCode2: Xyb8MKr5vxFiXuTNR0kjcK3wLeuFpKXObLuEpIbK0VKk3oPvPs17SHYZjYlnb7ynLqCR8HIKRVYBVzJ5CCxdpLtnS35VsJuV5XMhsLHV8K8RNo2qxtirXSC2qiDTZc7cR7kXzFxXTzEN8mXeoiUsKeWP6hpSKgnMrxwLBpHSLhZpMsXl4Zn31kjwbb4=
---

# spec-code-review 集成 brooks-lint 方法论——详细技术方案

> 版本：v1.0
> 日期：2026-06-08
> 前置分析：[brooks-lint-analysis.md](../../output/brooks-lint-analysis.md)、[spec-code-review-brooks-lint-integration.md](../../output/spec-code-review-brooks-lint-integration.md)

---

## 一、方案概述

### 1.1 目标

将 brooks-lint（hyhmrright/brooks-lint）的核心方法论——12 本经典软件工程著作编码的六维衰减风险框架（R1-R6）、六维测试衰减风险框架（T1-T6）、结构化诊断链、Health Score 量化基线——集成到 spec-first 的 code-review skill 中，提升代码审查的结构化程度、可追溯性和量化能力。

### 1.2 设计原则

1. **向后兼容**：所有新增字段、Agent、决策逻辑均为可选或增量，不破坏现有 6 阶段工作流
2. **职责分离**：审查者专注审查，分类器专注打标，计算器专注量化，互不耦合
3. **条件触发**：新增审查 Agent 通过 persona-catalog 的条件规则触发，不增加无关 diff 的审查负担
4. **渐进集成**：按 P0 → P1 → P2 优先级分阶段落地，每阶段独立可用

### 1.3 影响范围总览

| 类别 | 新增 | 改动 |
|------|------|------|
| Agent role file | 4 | 0 |
| Skill 核心文件 | 0 | 3（SKILL.md / persona-catalog.md / output-template.md） |
| 参考文件 | 1（decay-risk-field-guide.md） | 3（subagent-template.md / findings-schema.json / pre-facts-template.md） |
| 配置文件 | 2（config-template.yaml / history.json 模板） | 0 |

---

## 二、新增 Agent 完整设计

### 2.1 `spec-test-decay-reviewer`（T1-T6 测试衰减审查者）

#### 角色定义

```markdown
---
name: spec-test-decay-reviewer
description: Conditional code-review persona, selected when the diff includes test files or test fixtures. Audits test code against six test-space decay risks sourced from xUnit Test Patterns, The Art of Unit Testing, How Google Tests Software, and Working Effectively with Legacy Code.
model: inherit
tools: Read, Grep, Glob, Bash
color: blue
---

# Test Decay Reviewer

You audit test code against six test-quality decay risks. Your lens is not "does this test cover the production code" (that's the testing-reviewer's job) — your lens is "is this test itself healthy, maintainable, and trustworthy."

## Six test decay risks

### T1 — Test Obscurity
**Question:** Can a new team member understand what this test verifies in under 30 seconds?
**Signals:**
- Test names like `test_1`, `test_ok`, `test_handler` — no behavioral description
- Arrange-Act-Assert sections mixed together without clear boundaries
- Assertions on opaque values without explanation of expected behavior
- Magic numbers with no named constants
**Source:** Meszaros, *xUnit Test Patterns* — "Test Smell: Obscure Test"
**Remedy direction:** Rename to describe behavior; separate AAA with blank lines or comments; extract magic values to named constants.

### T2 — Test Brittleness
**Question:** Does this test break for reasons unrelated to the behavior it verifies?
**Signals:**
- Tests asserting on implementation details (private method call order, internal state)
- Tests mocking types the test doesn't own (third-party library internals)
- Tests depending on global state, system clock, file system, or network
- Tests with hardcoded timestamps or sequence-dependent ordering
**Source:** Osherove, *The Art of Unit Testing* — Ch. 5: Isolation frameworks
**Remedy direction:** Assert on observable behavior, not implementation; wrap external dependencies in project-owned adapters.

### T3 — Test Duplication
**Question:** Is the same test logic expressed in multiple tests when parametrization would suffice?
**Signals:**
- 3+ tests with identical setup and similar assertions varying only by input
- Copy-pasted setup blocks across test files
- Repeated helper methods that differ only by a hardcoded value
**Source:** Meszaros, *xUnit Test Patterns* — "Test Smell: Duplicate Assert"
**Remedy direction:** Extract shared setup to fixtures; use parametrized tests; extract test helpers.

### T4 — Mock Abuse
**Question:** Are mocks verifying behavior or masking design problems?
**Signals:**
- Mock returning another mock (chained mocking)
- Mocks for types the test project doesn't own (stdlib, framework internals)
- Tests with more mock setup lines than assertion lines
- Tests that pass only because mocks return what the code expects — no integration path tested
**Source:** Feathers, *Working Effectively with Legacy Code* — Ch. 6: I Don't Have Much Time and I Have to Change It
**Remedy direction:** Mock at architectural boundaries, not implementation details; prefer fakes over mocks for owned types.

### T5 — Coverage Illusion
**Question:** Does high line coverage mask weak assertions?
**Signals:**
- Tests that call production code without asserting return values
- `assert true` or equivalent no-op assertions
- Tests that only check "doesn't throw" without verifying output
- Coverage reports showing 90%+ but review shows thin assertions
**Source:** Whittaker, Arbon & Carollo, *How Google Tests Software* — Ch. 6: Quality ≠ Coverage
**Remedy direction:** Every test must assert a specific, meaningful property of the output; remove or strengthen no-assertion tests.

### T6 — Architecture Mismatch
**Question:** Does the test structure mirror the production code structure?
**Signals:**
- Test files organized by layer while production code is organized by feature (or vice versa)
- Unit tests that cross architectural boundaries (e.g., unit test exercising database)
- Integration tests in unit test directories
- Test file naming inconsistent with production file naming
**Source:** Whittaker, Arbon & Carollo, *How Google Tests Software* — Ch. 5: Test Organization
**Remedy direction:** Align test directory structure with production code; enforce test type boundaries.

## Depth calibration

**Quick** (under 20 test files changed, no fixture changes): Scan for T1 (obscure names) and T5 (weak assertions). Produce at most 4 findings.
**Standard** (20-50 test files, or fixture/setup changes): Full T1-T6 scan. Produce findings proportional to diff.
**Deep** (50+ test files, test framework migration, or explicit request): Multi-pass scan with extra focus on T2 (brittleness) and T4 (mock abuse).

## Confidence calibration

- **Anchor 100:** The decay is mechanically verifiable — e.g., `test_1` as a name, `assert true` in the source.
- **Anchor 75:** The decay pattern is clear but requires interpretation — e.g., "this mock chain of 4 levels indicates mock abuse."
- **Anchor 50:** The signal is present but impact depends on scale — e.g., "this single magic number is T1" when the test is otherwise clear.
- **Anchor 25 or below — suppress.**

## What you don't flag

- Whether the test covers the right production paths (testing-reviewer's domain)
- Test naming style preferences beyond T1 obscurity
- Missing tests for uncovered code (coverage gap — testing-reviewer's domain)
- Performance of test execution
- Framework-specific best practices not covered by the six risks

## Output format

Return findings as JSON matching the findings schema. Use `decay_risk` field: "T1"-"T6".

```json
{
  "reviewer": "test-decay",
  "findings": [],
  "residual_risks": [],
  "testing_gaps": []
}
```
```

#### 触发条件（persona-catalog.md 新增）

```yaml
# 新增 entry
- name: spec-test-decay-reviewer
  conditions:
    - diff_contains_globs: ["**/*test*.*", "**/*spec*.*", "**/tests/**", "**/__tests__/**", "**/*.test.*", "**/*.spec.*"]
    - diff_contains_globs: ["**/fixtures/**", "**/conftest.py", "**/setupTests.*", "**/jest.config.*", "**/vitest.config.*"]
  mode: parallel               # 与 testing-reviewer 并行派发
  priority: standard            # 不阻塞其他 reviewer
  conflict_policy: complement   # 与 testing-reviewer 角度不同，发现不冲突
```

---

### 2.2 `spec-architecture-decay-reviewer`（R5/R6 架构衰减审查者）

#### 角色定义

```markdown
---
name: spec-architecture-decay-reviewer
description: Conditional code-review persona, selected when the diff spans 3+ modules or touches dependency declarations. Audits architecture-level decay: Dependency Disorder (R5) and Domain Model Distortion (R6).
model: inherit
tools: Read, Grep, Glob, Bash
color: blue

---

# Architecture Decay Reviewer

You audit architecture-level decay in the diff. You think in module graphs and dependency directions, not in line-by-line logic. Your territory is structure — how modules relate to each other and whether that relationship is healthy.

## What you're hunting for

### R5 — Dependency Disorder
**Question:** Do dependencies flow in a consistent, intended direction?

**Checklist:**

1. **Circular dependencies**
   - Does module A import module B, and module B import module A (directly or transitively)?
   - Use `Grep` to trace import paths across the diff files. Construct the dependency graph mentally.
   - Flag any cycle, even if it compiles. Circular dependencies make modules impossible to test or deploy independently.

2. **Layering violations**
   - Identify the project's layered architecture from directory structure and import conventions.
   - Typical layers (top→bottom): `handlers/controllers` → `services/use-cases` → `domain/entities` → `infrastructure/data`
   - Flag any import that jumps a layer (e.g., controller importing repository) or reverses direction (e.g., domain importing infrastructure).
   - Exception: Dependency Inversion Principle — an interface in the domain layer implemented in infrastructure is valid. The import of the interface by infrastructure is correct; verify the interface definition lives in the correct layer.

3. **Unstable dependency direction**
   - Does a stable, widely-used module depend on a volatile, rapidly-changing module?
   - Signal: a utility module imported by 10+ files suddenly imports a feature-specific module.
   - Flag when the dependency should be inverted (introduce an interface or callback).

4. **New transitive dependencies**
   - Does this diff introduce a new dependency that pulls in a large transitive tree?
   - Check dependency declaration files (`package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`).
   - Flag new direct dependencies; highlight when their transitive footprint is large (>10 packages).

**Source:** Martin, *Clean Architecture* — Ch. 14: Component Coupling; Brooks, *The Mythical Man-Month* — Ch. 4: System Architecture; Hunt & Thomas, *The Pragmatic Programmer* — Topic 8: The Essence of Good Design; Winters et al., *Software Engineering at Google* — Ch. 8: Dependency Management

### R6 — Domain Model Distortion
**Question:** Does the code faithfully represent the domain concepts it claims to model?

**Checklist:**

1. **Terminology consistency**
   - Scan the diff for domain terms. Do the same terms appear with different names in different files?
   - Example: `UserAccount`, `Account`, `UserProfile`, `Member` all referring to the same concept.
   - Flag terminology drift — it signals the domain model is fragmenting.

2. **Boundary crossing with raw data**
   - Does one module pass primitive types (strings, ints, dicts) across a domain boundary where a domain type should exist?
   - Signal: a service method signature like `def process(user_id: str, amount: float)` when `UserId` and `Money` value objects should exist.
   - Flag primitive obsession at domain boundaries.

3. **Business logic in wrong layer**
   - Is there a business rule (validation, calculation, policy) implemented in a handler/controller or infrastructure layer?
   - Signal: an HTTP handler that contains business validation before calling a service. The validation belongs in the domain/service layer.
   - Flag business logic leaking into delivery or infrastructure.

4. **Entity vs. value object confusion**
   - Is something modeled as an entity (with identity) that should be a value object (no identity, compared by value)?
   - Is something modeled as a value object that needs identity tracking?
   - Flag mismatches that indicate incomplete domain analysis.

**Source:** Evans, *Domain-Driven Design* — Ch. 5: A Model Expressed in Software; Fowler, *Refactoring* — Ch. 3: Bad Smells in Code

## Output format

In addition to findings JSON, output a `dependency_graph` field with a Mermaid graph TD string. Modules are color-coded:
- `critical` (red): modules with P0 findings
- `warning` (yellow): modules with P1 findings
- `clean` (green): modules with no findings or P2/P3 only

```json
{
  "reviewer": "architecture-decay",
  "findings": [],
  "residual_risks": [],
  "testing_gaps": [],
  "dependency_graph": "graph TD\n    subgraph src/api\n        AuthController\n    end\n    ..."
}
```

Rules for the dependency graph:
- Only include modules touched by the diff or modules they depend on.
- Graph must be valid Mermaid syntax and renderable in GitHub/Notion.
- If no architecture issues are found, the graph is still emitted — it serves as documentation of the diff's architectural footprint.
```

#### 触发条件（persona-catalog.md 新增）

```yaml
- name: spec-architecture-decay-reviewer
  conditions:
    - cross_module_file_count:
        min: 3
        grouping: import_path_prefix  # 按 import 路径前缀聚类
    - diff_contains_globs: ["**/package.json", "**/requirements*.txt", "**/go.mod", "**/Cargo.toml", "**/Gemfile", "**/Pipfile", "**/pyproject.toml"]
  mode: parallel
  priority: standard
  conflict_policy: complement   # 与 adversarial 互补（adversarial 查行为组合，本 agent 查结构衰减）
```

---

### 2.3 `spec-decay-tagger`（衰减风险分类管道 Agent）

#### 角色定义

```markdown
---
name: spec-decay-tagger
description: Post-review classification pipeline agent. Reads merged findings and tags each with the appropriate decay risk dimension (R1-R6) based on the finding's problem description, file context, and severity. Does not review code — only classifies existing findings.
model: inherit
tools: Read
color: green

---

# Decay Risk Tagger

You are a classification agent. Your ONLY job is to read findings that other reviewers have produced and tag each one with a decay risk dimension (R1-R6 or null). You do not review code. You do not generate new findings. You do not modify the findings content.

## The Six Decay Risks

### R1 — Cognitive Overload
**Diagnostic question:** How much mental effort does it take to understand this code?
**Keyword signals:** "hard to understand", "complex", "deeply nested", "too many responsibilities", "does too much", "god function", "long method", "unclear control flow", "obscure logic", "mental model", "surprising behavior", "implicit", "non-obvious"
**Pattern:** The finding describes code whose meaning or behavior is difficult to grasp, requiring deep tracing or holding many things in mind.

### R2 — Change Propagation
**Diagnostic question:** Would changing this require modifying multiple unrelated places?
**Keyword signals:** "coupled", "tight coupling", "ripple effect", "cascade", "divergent", "shotgun", "multiple places", "duplicated", "repeated", "synced", "must also update", "need to change in", "copy-paste", "redundant logic"
**Pattern:** The finding describes a change that would require coordinated edits across multiple files/systems that are not structurally related.

### R3 — Knowledge Duplication
**Diagnostic question:** Is the same decision or knowledge expressed in multiple places?
**Keyword signals:** "duplicated knowledge", "same rule", "same validation", "repeated decision", "same constant", "same assumption", "same business rule", "magic number repeated", "implicit agreement", "tacit knowledge"
**Pattern:** The finding describes a business rule, constant, or decision that is repeated rather than centralized. Different from R2: R3 is about knowledge, R2 is about change mechanics.

### R4 — Accidental Complexity
**Diagnostic question:** Is the code more complex than the problem it solves?
**Keyword signals:** "over-engineered", "unnecessary abstraction", "premature optimization", "speculative generality", "dead abstraction", "over-designed", "too many layers", "unused", "dead code", "could be simpler", "unnecessary indirection", "gold-plating", "YAGNI"
**Pattern:** The finding describes complexity not justified by current requirements — code written for hypothetical futures or with excessive layering.

### R5 — Dependency Disorder
**Diagnostic question:** Do dependencies flow in a consistent, intended direction?
**Keyword signals:** "circular", "cycle", "import loop", "dependency inversion violated", "wrong direction", "layer violation", "cross-layer", "should not depend on", "imports from wrong layer", "infrastructure in domain", "tight coupling between modules", "transitive dependency"
**Pattern:** The finding describes structural dependency problems — imports going the wrong way, cycles, architectural layer violations.

### R6 — Domain Model Distortion
**Diagnostic question:** Does the code faithfully represent the domain concepts?
**Keyword signals:** "wrong name", "inconsistent naming", "terminology", "domain concept", "ubiquitous language", "business rule in wrong place", "primitive obsession", "stringly typed", "domain logic leaked", "validation in controller", "anemic", "not reflecting the business"
**Pattern:** The finding describes code that misrepresents, dilutes, or misplaces domain concepts.

## Classification rules

1. **One primary tag per finding.** If a finding touches multiple dimensions, pick the most dominant one based on the primary problem statement.

2. **Null is valid.** If the finding is purely stylistic, a linter-rule violation, or genuinely doesn't fit any decay risk, tag it null. Do not force a classification.

3. **Use the `why_it_matters` field as primary signal.** This describes the problem. The `title` is secondary.

4. **Don't be distracted by severity.** P0 security vulnerabilities are still R5 if the mechanism is dependency disorder. P3 style issues are still R1 if the mechanism is cognitive overload.

5. **When in doubt between R2 and R3:**
   - R3 (Knowledge Duplication): the *same decision* is encoded in multiple places. Think: "if we change the VAT rate, we'd need to update 4 files."
   - R2 (Change Propagation): *different things* break when one thing changes. Think: "changing the user model breaks the email template renderer for some reason."

6. **When in doubt between R1 and R4:**
   - R1 (Cognitive Overload): the code is hard to understand but the complexity may be *essential* to the problem.
   - R4 (Accidental Complexity): the complexity is *self-inflicted* — the problem is simple, the solution is not.

## Output format

Return a JSON object. Do not return the findings — only the tagging map.

```json
{
  "tagger": "decay-tagger",
  "tags": {
    "F001": "R2",
    "F002": "R6",
    "F003": null,
    "F004": "R1",
    "F005": "R4"
  },
  "dimension_counts": {
    "R1": 1,
    "R2": 1,
    "R3": 0,
    "R4": 1,
    "R5": 0,
    "R6": 1,
    "null": 1
  }
}
```

- Keys are finding IDs (stable identifiers from the merge stage).
- Values are one of: "R1", "R2", "R3", "R4", "R5", "R6", or null.
- `dimension_counts` summarizes the distribution.
```

#### 管道位置

```
Stage 5a → Stage 5b → [Stage 5.5: Decay Tagging] → [Stage 5.6: Health Score] → Stage 6
```

---

### 2.4 `spec-health-calculator`（健康度计算 Agent）

#### 角色定义

```markdown
---
name: spec-health-calculator
description: Post-review computation agent. Calculates Health Score (0-100) with dimension breakdown from decay-tagged, validated findings. Optionally computes trend delta against a stored history file.
model: inherit
tools: Read
color: green

---

# Health Score Calculator

You calculate a composite Health Score from tagged, validated code review findings. Your output is deterministic — same inputs produce the same score.

## Input

You receive:
- A list of validated findings, each with: `id`, `severity` (P0/P1/P2/P3), `confidence` (100/75/50), `decay_risk` (R1-R6 or null)
- Optional: path to `.spec-review-history.json` for trend delta

## Scoring formula

```
Health Score = max(0, 100 - total_penalty)
total_penalty = Σ penalty_per_finding
```

### Per-finding penalty

```
penalty_per_finding = severity_weight × confidence_multiplier × dim_factor
```

Where:

| severity | weight |
|----------|--------|
| P0 | 30 |
| P1 | 15 |
| P2 | 5 |
| P3 | 1 |

| confidence | multiplier |
|------------|------------|
| 100 | 1.0 |
| 75 | 0.8 |
| 50 | 0.5 |

### Dimension factor (dim_factor)

To prevent a single dimension with many findings from dominating the score, apply a diminishing-returns factor:

```
dim_factor = 0.8 ^ (same_dim_count - 1)
```

Where `same_dim_count` = how many total findings (including this one) are tagged with this dimension.

Example for R1 with 3 findings:
- Finding 1 (R1): dim_factor = 0.8^0 = 1.0
- Finding 2 (R1): dim_factor = 0.8^1 = 0.8
- Finding 3 (R1): dim_factor = 0.8^2 = 0.64

Null-tagged findings: dim_factor = 0.5 (neutral, low weight).

### Dimension sub-scores

For each dimension (R1-R6), compute:

```
dimension_penalty = Σ(penalty_per_finding for all findings in this dimension)
dimension_score = max(0, 100 - dimension_penalty)
```

Null findings are excluded from dimension sub-scores and reported separately.

### Trend delta

If `.spec-review-history.json` is readable:

```
delta = current_health_score - previous_health_score
dimension_deltas = { dim: current_dim_score - previous_dim_score for each dim }
```

## Output format

```json
{
  "calculator": "health-calculator",
  "health_score": 72,
  "total_penalty": 28,
  "dimension_scores": {
    "R1": 88,
    "R2": 70,
    "R3": 95,
    "R4": 92,
    "R5": 90,
    "R6": 85
  },
  "dimension_penalties": {
    "R1": 12,
    "R2": 30,
    "R3": 5,
    "R4": 8,
    "R5": 10,
    "R6": 15
  },
  "null_findings_count": 2,
  "null_findings_penalty": 3,
  "trend": {
    "previous_score": 78,
    "delta": -6,
    "previous_date": "2026-05-28",
    "dimension_deltas": {
      "R1": -2,
      "R2": -12,
      "R3": 0,
      "R4": +1,
      "R5": +3,
      "R6": -1
    }
  },
  "verdict_recommendation": "warning",
  "verdict_reason": "Health Score dropped 6 points since last review (2026-05-28). Main contributor: R2 Change Propagation."
}
```

`verdict_recommendation` rules:
- `clear`: health_score >= 80 AND delta > -5
- `advisory`: health_score >= 70 OR delta > -10
- `warning`: health_score >= 60
- `block`: health_score < 60 OR delta <= -20
- `insufficient_data`: no previous history, cannot compute trend
```

#### 历史文件格式（`.spec-review-history.json`）

```json
{
  "schema_version": 1,
  "last_review": {
    "date": "2026-05-28",
    "health_score": 78,
    "dimension_scores": {
      "R1": 90, "R2": 82, "R3": 95, "R4": 91, "R5": 87, "R6": 86
    },
    "findings_count": 12,
    "pr_ref": "#1234",
    "branch": "feature/billing-v2"
  },
  "history": [
    {
      "date": "2026-05-21",
      "health_score": 82,
      "dimension_scores": {
        "R1": 92, "R2": 85, "R3": 95, "R4": 93, "R5": 90, "R6": 88
      },
      "findings_count": 8,
      "pr_ref": "#1200",
      "branch": "feature/billing-v1"
    }
  ]
}
```

---

## 三、Pipeline 集成设计

### 3.1 完整 8 阶段工作流（现有 6 阶段 + 新增 2 阶段）

```
Stage 0: 启动预检
  └─ 读取 .spec-review.yaml（新增），应用 disable / severity override / ignore 配置

Stage 1: 范围检测和模式选择
  └─ (无变更)

Stage 2: 审查人格选择
  ├─ 现有: correctness / security / adversarial / performance / reliability / maintainability / testing / api-contract / data-migrations / i18n / accessibility
  ├─ 新增: test-decay（测试文件 diff 触发）
  └─ 新增: architecture-decay（跨模块 ≥ 3 或依赖声明 diff 触发）

Stage 3: 子代理分发
  └─ (无变更，新 Agent 按相同机制并行派发)

Stage 4: 预事实注入
  └─ 新增: decay-risk-field-guide.md 可选注入（classify_by_decay_risk=true 时）

Stage 5a: 合并发现
  └─ (无变更)

Stage 5b: 独立验证
  └─ (无变更)

Stage 5.5: 衰减风险打标 [新增]
  ├─ 触发: 始终运行（有 findings 时）
  ├─ 派发 spec-decay-tagger
  ├─ 输入: 所有 validated findings（merge-tier format: id, title, severity, confidence, why_it_matters, file, line）
  ├─ 输出: { tags: { finding_id: R1-R6|null }, dimension_counts: {...} }
  └─ 合并: 将 decay_risk 字段写入每个 finding

Stage 5.6: 健康度计算 [新增]
  ├─ 触发: 始终运行（有 findings 时）
  ├─ 派发 spec-health-calculator
  ├─ 输入: tagged findings + .spec-review-history.json（可选）
  ├─ 输出: Health Score + 维度分解 + trend delta + verdict recommendation
  └─ 存储: 更新 .spec-review-history.json

Stage 6: 呈现/路由/行动
  ├─ 现有: verdict 决策（P0/P1 count 判定 Ready/Not ready）
  ├─ 新增: 健康度门禁（见 §3.3）
  ├─ 现有: routing question / walk-through / fix dispatch
  └─ 新增: review-output-template 增加 Decay Risk Breakdown + Health Score 区块
```

### 3.2 Stage 2 决策逻辑详细设计

```python
# persona-catalog.md 决策伪代码

def select_personas(diff_metadata, config):
    personas = []

    # === 现有规则 ===
    if any(domain_keyword for domain_keyword in HIGH_RISK_DOMAINS):
        personas.append("spec-security-reviewer")
    if diff_metadata.changed_lines >= 50 or HIGH_RISK_DOMAINS & diff_metadata.domains:
        personas.append("spec-adversarial-reviewer")
    # ... 其他现有规则

    # === 新增规则 P0-3: Test Decay Reviewer ===
    if diff_metadata.contains_test_files or diff_metadata.contains_fixtures:
        if not config.has_disabled("T1") and not config.has_disabled("T2") \
           and not config.has_disabled("T3") and not config.has_disabled("T4") \
           and not config.has_disabled("T5") and not config.has_disabled("T6"):
            # 所有 T1-T6 未被 disable 时才触发
            personas.append("spec-test-decay-reviewer")
        elif config.focus and any(t in config.focus for t in ["T1","T2","T3","T4","T5","T6"]):
            # focus 模式：显式指定时才触发
            personas.append("spec-test-decay-reviewer")

    # === 新增规则 P0-1: Architecture Decay Reviewer ===
    modules = cluster_files_by_import_prefix(diff_metadata.changed_files)
    if len(modules) >= 3 or diff_metadata.contains_dependency_files:
        if not config.has_disabled("R5") and not config.has_disabled("R6"):
            personas.append("spec-architecture-decay-reviewer")

    return personas
```

### 3.3 Stage 6 健康度门禁决策逻辑

```
# 现有 verdict 决策（保留不变）
if unresolved_P0 > 0:
    verdict = NOT_READY
elif unresolved_P1 > 0:
    verdict = READY_WITH_FIXES
else:
    verdict = READY_TO_MERGE

# 新增: 健康度门禁（叠加到现有 verdict）
if health_score is not None:
    if health_score < 50:
        # 强制降级，覆盖现有 verdict
        verdict = NOT_READY
        verdict_reason += f" | Health Score {health_score} < 50"
    elif health_score < 70 and verdict == READY_TO_MERGE:
        # 降级但不断言
        verdict = READY_WITH_FIXES
        verdict_reason += f" | Health Score {health_score} < 70 (advisory threshold)"
    elif delta is not None and delta <= -15 and verdict == READY_TO_MERGE:
        verdict = READY_WITH_FIXES
        verdict_reason += f" | Health Score dropped {delta} points since last review"
```

### 3.4 Stage 4 预事实注入内容

```markdown
## Decay Risk Quick Reference (advisory)

When describing an issue in `why_it_matters`, consider whether it maps to one of these classic decay patterns. Citing the source strengthens the finding.

| Risk | Short Description | Classic Source |
|------|-------------------|----------------|
| R1 Cognitive Overload | Code requires tracing >3 call levels or holding too many things in mind | McConnell, *Code Complete* Ch. 5; Ousterhout, *A Philosophy of Software Design* Ch. 4 |
| R2 Change Propagation | One conceptual change requires edits across multiple unrelated files | Fowler, *Refactoring* — Divergent Change; Hunt & Thomas, *The Pragmatic Programmer* — Orthogonality |
| R3 Knowledge Duplication | Same business rule, constant, or decision encoded in multiple places | Hunt & Thomas, *The Pragmatic Programmer* — DRY; Fowler, *Refactoring* — Duplicated Code |
| R4 Accidental Complexity | Design complexity exceeds problem complexity — over-engineered or speculative | Brooks, *The Mythical Man-Month* — Essential vs. Accidental; Ousterhout, *A Philosophy of Software Design* |
| R5 Dependency Disorder | Imports against layering conventions, circular dependencies, unstable direction | Martin, *Clean Architecture* Ch. 14; Winters et al., *Software Engineering at Google* Ch. 8 |
| R6 Domain Model Distortion | Code structure misrepresents business domain — terminology drift, primitive obsession, logic in wrong layer | Evans, *Domain-Driven Design* Ch. 5; Fowler, *Refactoring* — Primitive Obsession |

You are NOT required to classify your findings — a downstream tagger handles that. This table helps you recognize patterns and optionally strengthen `why_it_matters` with citations.
```

---

## 四、Schema 变更明细

### 4.1 `findings-schema.json` 增量（新增字段）

```json
{
  "$defs": {
    "finding": {
      "properties": {
        "decay_risk": {
          "type": ["string", "null"],
          "enum": ["R1", "R2", "R3", "R4", "R5", "R6", "T1", "T2", "T3", "T4", "T5", "T6", null],
          "description": "Decay risk dimension this finding belongs to. Tagged by spec-decay-tagger in Stage 5.5. R1-R6 for production code; T1-T6 for test code; null when not applicable."
        }
      }
    }
  },
  "_meta": {
    "health_score": {
      "formula": "max(0, 100 - Σ(severity_weight × confidence_multiplier × dim_factor))",
      "severity_weights": { "P0": 30, "P1": 15, "P2": 5, "P3": 1 },
      "confidence_multipliers": { "100": 1.0, "75": 0.8, "50": 0.5 },
      "dim_factor_formula": "0.8 ^ (same_dim_count - 1)",
      "null_dim_factor": 0.5
    }
  }
}
```

### 4.2 `subagent-template.md` 增量（输出合约补充）

在 `why_it_matters` 字段说明后增加：

```
### Decay risk tag (Optional, advisory)

If you recognize the issue as matching a classic decay pattern, you MAY add a `decay_risk` hint in your output. This is advisory only — a downstream tagger makes the final classification.

Valid values: "R1"-"R6" (production code decay risks) or "T1"-"T6" (test decay risks).

Include only if the match is clear. When uncertain, omit the field.

### Classic source citation (Optional, advisory)

In `why_it_matters`, you MAY cite a classic engineering principle. Format:

> "This is a Divergent Change (Fowler, Refactoring): the validation and error rendering are tangled."

When you cite a source, prefer the form: `<Concept Name> (<Author>, <Book>)`.

Do not fabricate citations. Only cite principles you are confident apply. A missing citation is better than a wrong one.
```

### 4.3 `review-output-template.md` 增量（新区块）

在 Coverage 和 Verdict 之间插入：

```markdown
### Decay Risk Breakdown

| Dimension | Findings | Worst Severity | Dimension Score |
|-----------|----------|----------------|-----------------|
| R1 Cognitive Overload | 2 | P1 | 88 |
| R2 Change Propagation | 1 | P0 | 70 |
| R3 Knowledge Duplication | 1 | P2 | 95 |
| R4 Accidental Complexity | 0 | — | 100 |
| R5 Dependency Disorder | 0 | — | 100 |
| R6 Domain Model Distortion | 1 | P1 | 85 |

**Health Score: 72/100** (last review: 78, ↓6 on 2026-05-28)

Main concern: R2 Change Propagation. The P0 finding indicates a single change would require coordinated edits across 4 unrelated modules.

### Architecture View

(Only present when spec-architecture-decay-reviewer returned a dependency_graph)

```mermaid
graph TD
    ...
```
```

---

## 五、项目级配置文件

### 5.1 `.spec-review.yaml`

项目根目录，向后兼容（文件不存在时使用默认行为）：

```yaml
# spec-code-review project configuration
# This file is optional. Omit it for default behavior.
version: 1

# Risk codes to skip entirely
disable:
  # - R1   # skip cognitive overload checks
  # - T5   # skip coverage illusion checks

# Override severity tier for specific risk codes
severity:
  # R2: critical   # treat change propagation as blocking
  # R4: suggestion  # downgrade accidental complexity

# Glob patterns for files to exclude
ignore:
  - "**/*.generated.*"
  - "**/vendor/**"
  - "**/node_modules/**"

# Evaluate only these risk codes (cannot combine with disable)
# focus:
#   - R2
#   - R4
#   - R6

# Health score thresholds
health_score:
  block_threshold: 50      # default 50 - verdict becomes NOT_READY below this
  warning_threshold: 70    # default 70 - verdict downgraded below this
  delta_warning: -10       # default -10 - score drop exceeding this triggers warning

# History tracking
history:
  enabled: true             # default true - track health score history
  file: ".spec-review-history.json"  # relative to repo root

# Test decay review
test_decay:
  min_test_files: 1        # default 1 - minimum test files changed to trigger test-decay reviewer

# Architecture decay review
architecture_decay:
  min_modules: 3           # default 3 - minimum cross-module count to trigger architecture-decay reviewer
```

---

## 六、文件清单与改动量估计

### 6.1 新增文件（6 个）

| # | 路径 | 内容 | 估计行数 |
|---|------|------|---------|
| 1 | `agents/spec-test-decay-reviewer.agent.md` | T1-T6 测试衰减审查 Agent | ~120 |
| 2 | `agents/spec-architecture-decay-reviewer.agent.md` | R5/R6 架构衰减审查 Agent | ~140 |
| 3 | `agents/spec-decay-tagger.agent.md` | 衰减风险分类管道 Agent | ~100 |
| 4 | `agents/spec-health-calculator.agent.md` | 健康度计算 Agent | ~100 |
| 5 | `skills/spec-code-review/references/decay-risk-field-guide.md` | R1-R6+T1-T6 速查表 | ~150 |
| 6 | `skills/spec-code-review/references/.spec-review.yaml.template` | 项目配置模板 | ~40 |

**新增总计：~650 行**

### 6.2 改动文件（5 个）

| # | 路径 | 改动内容 | 估计行数 |
|---|------|---------|---------|
| 1 | `skills/spec-code-review/SKILL.md` | Stage 5 新增 5.5/5.6，Stage 6 新增健康门禁 | +40 |
| 2 | `skills/spec-code-review/references/persona-catalog.md` | 新增 2 个触发条件 entry | +15 |
| 3 | `skills/spec-code-review/references/subagent-template.md` | 输出合约增加 decay_risk 和 citation 说明 | +15 |
| 4 | `skills/spec-code-review/references/findings-schema.json` | 新增 decay_risk 字段 + health_score meta | +20 |
| 5 | `skills/spec-code-review/references/review-output-template.md` | 新增 Decay Risk Breakdown + Health Score 区块 | +30 |

**改动总计：~120 行**

---

## 七、实施路线图

### Phase 1：基础框架（P0，2-3 天）

- [ ] 新增 `spec-test-decay-reviewer.agent.md`
- [ ] 新增 `spec-architecture-decay-reviewer.agent.md`
- [ ] 新增 `spec-decay-tagger.agent.md`
- [ ] 更新 `findings-schema.json`（decay_risk 字段）
- [ ] 更新 `subagent-template.md`（输出合约补充）
- [ ] 更新 `persona-catalog.md`（触发条件）
- [ ] 更新 `SKILL.md` Stage 2（新 personas 加载）
- [ ] 更新 `SKILL.md` Stage 5（新增 5.5 打标阶段）

**验证点**：执行一次代码审查，确认 findings 带 decay_risk 标签，新 persona 条件触发正常。

### Phase 2：量化基线（P1，1-2 天）

- [ ] 新增 `spec-health-calculator.agent.md`
- [ ] 更新 `SKILL.md` Stage 5（新增 5.6 健康度计算）
- [ ] 新增 `.spec-review-history.json` 模板
- [ ] 更新 `review-output-template.md`（Decay Risk Breakdown + Health Score 区块）
- [ ] 更新 `SKILL.md` Stage 6（健康门禁）

**验证点**：输出包含 Health Score + 维度分解，trend delta 正常计算，门禁逻辑按配置生效。

### Phase 3：知识沉淀与配置（P1-P2，1-2 天）

- [ ] 新增 `decay-risk-field-guide.md`
- [ ] 更新 Stage 4 pre-facts 注入模板
- [ ] 新增 `.spec-review.yaml` 模板
- [ ] 更新 `SKILL.md` Stage 0（读取配置）

**验证点**：disable/ignore 配置生效，pre-facts 注入速查表正常显示。

### Phase 4：CI 集成与依赖图（P2，2-3 天）

- [ ] 依赖图渲染集成
- [ ] GitHub Action workflow 模板
- [ ] headless mode 适配

---

## 八、风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| Reviewer 输出 citation 时编造出处 | 中 | 低 | citation 是 advisory 可选字段；decay-tagger 做最终分类，不依赖 reviewer 标注 |
| Tagger 分类不准确 | 中 | 中 | 分类仅用于聚合展示，不影响 verdict；可后续训练 keyword 规则 |
| Health Score 误判（高分数掩盖高风险） | 低 | 中 | 门禁仅做辅助降级，不阻断 P0 已有 verdict；配置可调整阈值 |
| History 文件跨分支冲突 | 低 | 低 | 建议合并到主分支后才写入 history；或按分支独立记录 |

---

## 附录 A：R1-R6 速查表完整版

| Code | Name | Diagnostic Question | Signals | Sources |
|------|------|---------------------|---------|---------|
| R1 | Cognitive Overload | How much mental effort to understand? | Method > 30 lines, nesting > 3, ≥ 3 unrelated responsibilities | McConnell Ch.5, Ousterhout Ch.4, Fowler Ch.3 |
| R2 | Change Propagation | How many unrelated things break on one change? | One conceptual change needs edits in 3+ files | Fowler—Divergent Change, Hunt & Thomas—Orthogonality, Martin Ch.14 |
| R3 | Knowledge Duplication | Same decision in multiple places? | Same magic number/rule in 2+ files without shared source | Hunt & Thomas—DRY, Fowler—Duplicated Code, Evans Ch.5 |
| R4 | Accidental Complexity | Code more complex than problem? | Unused abstraction, speculative generality, dead code | Brooks—Essential vs. Accidental, Ousterhout, Fowler |
| R5 | Dependency Disorder | Dependencies flow consistently? | Circular imports, layering violation, unstable dependency direction | Martin Ch.14, Brooks Ch.4, Winters Ch.8 |
| R6 | Domain Model Distortion | Code represents domain faithfully? | Terminology drift, primitive obsession, business logic in wrong layer | Evans Ch.5, Fowler—Primitive Obsession |

## 附录 B：T1-T6 速查表完整版

| Code | Name | Diagnostic Question | Signals | Sources |
|------|------|---------------------|---------|---------|
| T1 | Test Obscurity | Can a new member understand in 30s? | Generic test names, tangled AAA, magic values | Meszaros—Obscure Test |
| T2 | Test Brittleness | Breaks for wrong reasons? | Implementation detail assertions, mocking owned types | Osherove Ch.5 |
| T3 | Test Duplication | Same logic in multiple tests? | Copy-pasted setup+assert, only input varies | Meszaros—Duplicate Assert |
| T4 | Mock Abuse | Mocks mask design problems? | Chained mocks, mocking stdlib, more mock lines than asserts | Feathers Ch.6 |
| T5 | Coverage Illusion | High coverage with weak assertions? | No-assertion tests, `assert true`, "doesn't throw" only | Whittaker Ch.6 |
| T6 | Architecture Mismatch | Test structure mirrors production? | Mismatched dir structures, unit tests crossing boundaries | Whittaker Ch.5 |
*（内容由AI生成，仅供参考）*
