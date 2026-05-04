# spec-graph-bootstrap Eval Fixture Contract

本目录保存 LLM review fixtures，不是 executable eval runner。

## Contract

- `trigger-cases.json`、`boundary-cases.json`、`failure-cases.json` 和 `expected-behavior-cases.json` 只提供可复查样例，不能替代 LLM 语义判断。
- `expected_decision` 必须来自 `SKILL.md` 中的 invocation、workspace、readiness 或 live MCP 边界。
- `expected_failure` 必须来自 `SKILL.md` 的 Failure Modes 或脚本 `reason_code`。
- fixtures 覆盖多仓默认 all-repos、单仓 child scope、parent advisory boundary、GitNexus query proof、no-source / not-applicable、dirty freshness fingerprint、provider command safety 和 live MCP compiled-vs-session-local 分离。
- 确定性测试只校验文件存在、JSON shape 和少量关键枚举，不判断样例的语义质量。

## Review Boundary

新增或修改 case 时，先从 `SKILL.md` 和 `scripts/*` 派生当前 contract，再更新 fixture。脚本负责发现事实漂移；LLM 负责判断样例是否代表真实触发、边界、失败或期望行为。
