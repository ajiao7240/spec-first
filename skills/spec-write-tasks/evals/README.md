# spec-write-tasks Eval Fixture Contract

本目录保存的是 maintainer-only LLM review fixtures，不是 executable eval runner，也不是通用 `.skill` 包的用户运行时依赖。官方 `.skill` packager 会跳过根目录 `evals/`；需要验证 skill 质量时，在 source 仓库运行这些 fixtures 或后续 provider-backed eval。

## Contract

- `trigger-cases.json`、`boundary-cases.json`、`failure-cases.json` 和 `expected-behavior-cases.json` 只提供可复查样例，不能替代 LLM 语义判断。
- `output-quality-cases.json` 记录 file-backed output-quality review cases，用来评审 skill-guided task pack 是否优于无 skill 的普通拆分；它仍是 fixture evidence，不是 provider-backed model eval，也不是 executable runner。
- `expected_decision` 必须来自 `SKILL.md` 的 Final Decision Envelope：`compile`、`skip`、`return-to-plan`、`draft-only` 或 `validate-only`。
- `expected_failure` 必须来自 `SKILL.md` 的 Failure Modes 枚举。
- Final Decision Envelope 中声明的每个 decision 至少要有一个 eval case 覆盖。
- Failure Modes 中声明的每个 failure 至少要有一个 eval case 覆盖。
- 确定性测试只校验 JSON shape、case id 唯一性、decision/failure 枚举合法性和覆盖率，不判断样例的语义质量。
- output-quality case 必须声明 `input_files`、`baseline_risks`、`with_skill_expectations` 和 `objective_assertions`；如果缺少真实文件、provider telemetry、human adjudication 或 model execution evidence，必须标记为 `missing evidence`，不能声称已证明产出质量。

## Review Boundary

新增或修改 case 时，先从 `SKILL.md` 派生当前 decision/failure 枚举，再更新 fixture。脚本负责发现漂移；LLM 负责判断样例是否代表真实触发、边界、失败或期望行为。
