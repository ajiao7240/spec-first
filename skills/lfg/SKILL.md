---
name: lfg
description: Full autonomous engineering workflow
argument-hint: "[feature description]"
disable-model-invocation: true
---

CRITICAL: You MUST execute every step below IN ORDER. Do NOT skip any required step. Do NOT jump ahead to coding or implementation. The plan phase (step 2) MUST be completed and verified BEFORE any work begins. Violating this order produces bad output.

1. `/spec:plan $ARGUMENTS`

   GATE: STOP. If `spec:plan` reported the task is non-software and cannot be processed in pipeline mode, stop the pipeline and inform the user that LFG requires software tasks. Otherwise, verify that the `spec:plan` workflow produced a plan file in `docs/plans/`. If no plan file was created, run `/spec:plan $ARGUMENTS` again. Do NOT proceed to step 3 until a written plan exists. **Record the plan file path** — it will be passed to spec:review in step 4.

2. `/spec:work <plan-path-from-step-1>`

   GATE: STOP. Verify that implementation work was performed - files were created or modified beyond the plan. Do NOT proceed to step 3 if no code changes were made.

3. `/spec:review mode:autofix plan:<plan-path-from-step-1>`

   Pass the plan file path from step 1 so spec:review can verify requirements completeness.

4. Load the `todo-resolve` skill and resolve the approved items.

5. Load the `test-browser` skill and run browser verification for the changed surfaces.

6. Load the `feature-video` skill and record the walkthrough.

7. Output `<promise>DONE</promise>` when video is in PR

Start with step 1 now. Remember: plan FIRST, then work. Never skip the plan.
