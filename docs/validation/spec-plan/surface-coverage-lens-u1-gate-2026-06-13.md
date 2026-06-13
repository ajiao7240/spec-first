# spec-plan Surface Coverage Lens U1 Gate Check (2026-06-13)

Plan: `docs/plans/2026-06-12-005-refactor-spec-plan-surface-coverage-lens-plan.md`
Spec ID: `2026-06-12-005-spec-plan-surface-coverage-lens`
Gate result: `gate-not-met`
Reason code: `insufficient-primary-evidence`
Override: user-confirmed on 2026-06-13, "确认覆盖 U1 Gate，按 override 直接实现 U2-U4。"

## Summary

U1 was run as a read-only gate check. The evidence result remains `gate-not-met`: current evidence does not satisfy both Gate conditions.

The user later explicitly overrode this Gate and authorized U2-U4 implementation despite the missing primary evidence. Closeout must therefore describe the implementation as `gate-overridden`, not as `gate-passed`.

The original gate decision is evidence-bound, not a product judgment that surface coverage is unimportant. Multi-end planning is still a core scenario; this check only says the current repo/workspace does not yet contain enough qualifying real downstream Standard/Deep samples, and the inspected secondary spec-first samples did not show an in-scope surface miss that existing primitives failed to surface.

## Gate Conditions

| Condition | Result | Evidence |
|---|---|---|
| `001 has shipped` | pass | `docs/plans/2026-06-11-001-refactor-spec-plan-decision-surface-coverage-plan.md` has `status: completed` and split former Track B to plan 005. |
| `>=2` genuine recent Standard/Deep multi-surface samples | fail for primary source | `rg -n "^plan_depth: (standard|deep)" /Users/kuang/xiaobu -g 'docs/plans/*.md' ...` found Standard/Deep markers only under `spec-first/docs/plans`, not downstream product repos. |
| Existing primitives demonstrably missed an in-scope surface | not proven | Inspected secondary spec-first samples already use `Summary` / `Decision Brief` / `System-Wide Impact` to name the relevant workflow, host, runtime, provider, test, and docs surfaces. No qualifying miss observed. |

## Sample Review

| Sample | Source class | Counted for Gate? | Notes |
|---|---|---:|---|
| `/Users/kuang/xiaobu/Hr360_temp/docs/plans/2026-05-24-001-feat-email-registration-plan.md` | real downstream product plan | no | Genuine multi-end business work: backend API/model/email, admin frontend, user management, H5 login status handling. It is pre-001 and has no `plan_depth: standard|deep`, so it is useful weak evidence but not a qualifying Standard/Deep sample for this Gate. It also already has `Scope Boundaries` excluding H5 registration entry and a `System-Wide Impact` section naming login, user management, email, route, and DB surfaces. |
| `docs/plans/2026-06-12-008-fix-using-spec-first-dispatch-governance-plan.md` | admissible secondary spec-first sample | secondary only | `plan_depth: deep`; multi-surface across `using-spec-first`, review dispatch semantics, bootstrap, checked-in host blocks, runtime projection tests, prompt eval fixtures, and durable docs. Its `System-Wide Impact` explicitly covers interaction graph, error propagation, runtime mirrors, API surface parity, and integration coverage. No unhandled in-scope surface was observed. |
| `docs/plans/2026-06-13-001-refactor-context-injection-progressive-disclosure-plan.md` | admissible secondary spec-first sample | secondary only | `plan_depth: deep`; multi-surface across bootstrap, routing, Graphify/provider guidance, changelog consumption, contracts, tests, and runtime mirrors. Its `Decision Brief`, `Direct Evidence`, and `System-Wide Impact` explicitly call out top-level orchestrators, lightweight users, maintainers, provider setup, downstream planners/reviewers, and runtime mirrors. No unhandled in-scope surface was observed. |

## Conclusion

Initial evidence conclusion: do not implement U2-U4 without an explicit override.

Execution posture after user override: U2-U4 may proceed, but the implementation and changelog must not claim U1 passed.

Without the user override, the correct next action would have been to collect or produce at least two real downstream Standard/Deep multi-end requirement plans after the decision-brief shape is in use, then rerun this same review-for-misses check. If those plans showed an in-scope App/H5/PC/Admin/backend/data/events surface that `Summary`, `System-Wide Impact`, and current deepening specialists did not surface, the Gate would open and U2 could start; until then, plan 005 would have stayed `status: active` with the deferred banner intact.

After the 2026-06-13 user override, the implementation posture is different: U2-U4 may be completed as `gate-overridden`, while this U1 evidence result remains `gate-not-met`.

## Commands And Reads

- `git status --short`
- `rg -n "^plan_depth: (standard|deep)" /Users/kuang/xiaobu -g 'docs/plans/*.md' ...`
- `rg -n "App|H5|PC web|Admin|backend|multi-end|multi-surface|iOS|Android|web frontend|mobile|API|events|analytics|用户|登录|注册|支付|订单|后台|管理端|客户端" /Users/kuang/xiaobu -g 'docs/plans/*.md' ...`
- `sed -n` reads of the 005 plan, 001 plan, the Hr360 email registration plan, and the two secondary spec-first samples above.

## Limitations

- This check did not generate a fresh downstream multi-end plan; it only inspected existing local plans.
- Secondary spec-first plans exercise dual-host, CLI, runtime, contract, provider, test, and docs surfaces, but they do not exercise the App/H5/PC web/Admin/backend product-client matrix that the proposed lens primarily targets.
- The check catches visible enumerative misses in read plans. It does not solve unknown-unknown surface discovery; plan 005 intentionally routes that residual risk toward deterministic surface enumeration, not toward relaxing this Gate.
