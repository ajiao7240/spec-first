# spec-write-tasks Eval Fixture Contract

本目录保存的是 LLM review fixtures，不是 executable eval runner。

## Contract

- `trigger-cases.json`、`boundary-cases.json`、`failure-cases.json` 和 `expected-behavior-cases.json` 只提供可复查样例，不能替代 LLM 语义判断。
- `expected_decision` 必须来自 `SKILL.md` 的 Final Decision Envelope：`compile`、`skip`、`return-to-plan`、`draft-only` 或 `validate-only`。
- `expected_failure` 必须来自 `SKILL.md` 的 Failure Modes 枚举。
- Final Decision Envelope 中声明的每个 decision 至少要有一个 eval case 覆盖。
- Failure Modes 中声明的每个 failure 至少要有一个 eval case 覆盖。
- 确定性测试只校验 JSON shape、case id 唯一性、decision/failure 枚举合法性和覆盖率，不判断样例的语义质量。

## Review Boundary

新增或修改 case 时，先从 `SKILL.md` 派生当前 decision/failure 枚举，再更新 fixture。脚本负责发现漂移；LLM 负责判断样例是否代表真实触发、边界、失败或期望行为。
