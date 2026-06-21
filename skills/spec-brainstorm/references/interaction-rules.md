# Interaction Rules

These rules apply to every brainstorm, including the universal non-software flow.

## Question Discipline

1. Ask one question at a time. One question per turn keeps answers precise; choose the single most useful next question.
2. Prefer single-select multiple choice when choosing one direction, one priority, or one next step.
3. Use multi-select only for compatible sets such as goals, constraints, non-goals, or success criteria. If prioritization matters, follow up by asking which selected item is primary.
4. Default to the platform's blocking question tool. Use `AskUserQuestion` in Claude Code, or `request_user_input` in Codex when available. These tools include free-text fallback, so options scaffold the answer without confining it. Fall back to numbered options in chat only when no blocking tool exists or the call errors. Never silently skip the question.
5. Use prose only when the answer is genuinely open, diagnostic, or introspective, or when 3-4 distinct and plausible options would be padded or biased. Rule 1 still applies.

## Recommendation Timing

Pair decision and narrowing questions with your recommended answer when asking the user to pick a direction, priority, scope boundary, or next step. Say what you would choose and why before they answer so they can correct your priors.

Do not attach a recommendation to the opening "what are you already thinking" question, or to prose-only diagnostic, introspective, or rigor-probe questions. In those cases a suggested answer leaks the axes you consider important and biases the response.

## Decision Branch Handling

Track open decision branches as a lightweight decision tree. Resolve parent decisions before children they gate. If a branch is answerable from the codebase, read it instead of asking.

For Standard and Deep brainstorms, record each material unresolved branch in the decision ledger with a `deferred_reason` so it survives outside working memory. Lightweight brainstorms can track branches in conversation without ledger ceremony. The ledger holds major open decisions, not every minor sub-question.

Exit only when the idea is clear or the user explicitly wants to proceed. Before exiting, carry unresolved branches into the requirements document rather than dropping them silently.

## Shared Understanding Scope Loop

Use this loop only for material scope decisions that affect WHAT, success, non-goals, trade-offs, or handoff readiness.

For each open branch:

1. State the current decision branch internally.
2. Ask the single sharpest next question.
3. Pair decision and narrowing questions with the recommended answer and why.
4. If source or docs can answer the branch, read them instead of asking.
5. Record the chosen answer or deferred reason before moving to child branches.

Continue until planning would not need to invent WHAT. Resolve parent decisions before children; carry unresolved branches into the requirements artifact instead of hiding them in chat history.
