# Phases 3-5: Synthesis, Presentation, and Next Action

## Phase 3: Synthesize Findings

Process findings from all agents through this pipeline. **Order matters** -- each step depends on the previous.

### 3.1 Validate

Check each agent's returned JSON against the findings schema:
- Drop findings missing any required field defined in the schema
- Drop findings with invalid enum values
- Note the agent name for any malformed output in the Coverage section

### 3.2 Confidence Gate

Suppress findings below 0.50 confidence. Store them as residual concerns for potential promotion in step 3.4.

### 3.3 Deduplicate

Fingerprint each finding using `normalize(section) + normalize(title)`. Normalization: lowercase, strip punctuation, collapse whitespace.

When fingerprints match across personas:
- If the findings recommend opposing actions, do not merge -- preserve both for contradiction resolution in 3.5.
- Otherwise merge: keep the highest severity, keep the highest confidence, union all evidence arrays, note all agreeing reviewers (for example, `coherence, feasibility`).
- Coverage attribution: attribute the merged finding to the persona with the highest confidence. Decrement the losing persona's Findings count and the corresponding route bucket (Auto, Batch, or Present) so `Findings = Auto + Batch + Present` stays exact.

### 3.4 Promote Residual Concerns

Scan the residual concerns (findings suppressed in 3.2) for:
- Cross-persona corroboration: a residual concern from Persona A overlaps with an above-threshold finding from Persona B. Promote at P2 with confidence 0.55-0.65. Inherit `finding_type` from the corroborating above-threshold finding.
- Concrete blocking risks: a residual concern describes a specific, concrete risk that would block implementation. Promote at P2 with confidence 0.55. Set `finding_type: omission`.

### 3.5 Resolve Contradictions

When personas disagree on the same section:
- Create a combined finding presenting both perspectives
- Set `autofix_class: present`
- Set `finding_type: error`
- Frame it as a tradeoff, not a verdict

Specific conflict patterns:
- Coherence says "keep for consistency" + scope-guardian says "cut for simplicity" -> combined finding, let the user decide
- Feasibility says "this is impossible" + product-lens says "this is essential" -> P1 finding framed as a tradeoff
- Multiple personas flag the same issue -> merge into a single finding, note consensus, increase confidence

### 3.6 Promote Pattern-Resolved Findings

Scan `present` findings for codebase-pattern-resolved auto-eligibility. Promote `present -> auto` only when all three conditions are met:

1. `why_it_matters` cites a specific existing codebase pattern, not just a generic best practice
2. `suggested_fix` follows that cited pattern concretely
3. There is no genuine tradeoff left once the codebase context is considered

Additional promotion patterns:
- factually incorrect behavior in the document where the correct behavior is obvious from context or the codebase
- missing standard security controls where omission is clearly a bug for the system described
- incomplete technical descriptions whose accurate version is directly derivable from the codebase

Do not promote if the finding still involves scope, priority, or strategic judgment, or if the correct content is obvious but its exact wording still deserves grouped approval. Those belong in `batch_confirm`.

### 3.7 Route by Autofix Class

Severity and autofix_class are independent. A P1 finding can be `auto` if the correct fix is deterministic.

| Autofix Class | Route |
|---------------|-------|
| `auto` | Apply automatically -- one clear correct fix. Includes internal reconciliation, mechanically implied additions, and codebase-pattern-resolved fixes where repo evidence settles the ambiguity. |
| `batch_confirm` | Group for a single approval when the correct content is clear but the exact phrasing still deserves review. |
| `present` | Present individually for user judgment. |

Demote any `auto` finding that lacks a `suggested_fix` to `batch_confirm`. Demote any `batch_confirm` finding that lacks a `suggested_fix` to `present`.

### 3.8 Sort

Sort findings for presentation: P0 -> P1 -> P2 -> P3, then by finding type (errors before omissions), then by confidence (descending), then by document order (section position).

## Phase 4: Apply and Present

### Apply Auto-fixes

Apply all `auto` findings to the document in a single pass:
- edit the document inline using the platform's edit tool
- track what changed for the "Auto-fixes Applied" section
- do not ask for approval

### Batch Confirm

If any `batch_confirm` findings exist:

1. Present the proposed fixes in a numbered table using the review output template.
2. Ask for approval using the platform's interactive question tool:
   - Claude Code: `AskUserQuestion`
   - Codex: `request_user_input`
   - Gemini: `ask_user`
   - Fallback: present numbered options and wait for the next user message
3. Question text: `Apply these N fixes? (yes/no/select)`
4. Handle the response:
   - `yes`: apply all in a single pass
   - `select`: let the user pick which to apply
   - `no`: demote remaining items to `present`

### Present Remaining Findings

**Headless mode:** Do not use interactive question tools. Output all non-auto findings as a structured text summary the caller can parse and act on:

```
Document review complete (headless mode).

Applied N auto-fixes:
- <section>: <what was changed> (<reviewer>)
- <section>: <what was changed> (<reviewer>)

Batch-confirm findings:
- <section>: <title> (<reviewer>, confidence <N>)
  Why: <why_it_matters>
  Suggested fix: <suggested_fix>

Findings (requires judgment):

[P0] Section: <section> -- <title> (<reviewer>, confidence <N>)
  Why: <why_it_matters>
  Suggested fix: <suggested_fix or "none">

[P1] Section: <section> -- <title> (<reviewer>, confidence <N>)
  Why: <why_it_matters>
  Suggested fix: <suggested_fix or "none">

Residual concerns:
- <concern> (<source>)

Deferred questions:
- <question> (<source>)
```

Omit any section with zero items. Then proceed directly to Phase 5, which returns immediately in headless mode.

**Interactive mode:**

Present `present` findings using `references/review-output-template.md`. Within each severity level, separate findings by type:
- Errors first
- Omissions second

Brief summary at the top:
`Applied N auto-fixes. Batched M fixes for approval. K findings to consider (X errors, Y omissions).`

Include the Coverage table, auto-fixes applied, residual concerns, and deferred questions.

### Protected Artifacts

During synthesis, discard any finding that recommends deleting or removing files in:
- `docs/brainstorms/`
- `docs/plans/`
- `docs/solutions/`

These are pipeline artifacts and must not be flagged for removal.

## Phase 5: Next Action

**Headless mode:** Return `Review complete` immediately. Do not ask questions. The caller receives the structured text summary from Phase 4 and handles any remaining findings.

**Interactive mode:**

Ask using the platform's interactive question tool:
- Claude Code: `AskUserQuestion`
- Codex: `request_user_input`
- Gemini: `ask_user`
- Fallback: present numbered options and wait for the next user message

Offer:
1. Refine again -- another review pass
2. Review complete -- description based on document type:
   - requirements document: `Create technical plan with spec:plan`
   - plan document: `Implement with spec:work`

After 2 refinement passes, recommend completion, but allow the user to continue if they want.

Return `Review complete` as the terminal signal for callers.

## What Not To Do

- Do not rewrite the entire document
- Do not add new sections or requirements the user didn't discuss
- Do not over-engineer or add complexity
- Do not create separate review files or add metadata sections
- Do not modify caller skills (`spec-brainstorm`, `spec-plan`, or external plugin skills that invoke `document-review`)

## Iteration Guidance

On subsequent passes, re-dispatch personas and re-synthesize. The auto-fix mechanism and confidence gating prevent the same findings from recurring once fixed. If findings are repetitive across passes, recommend completion.
