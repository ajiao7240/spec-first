# spec-plan Eval Fixture Contract

本目录保存 maintainer-only planning review fixtures。它们提供 trigger、boundary、fallback、handoff 和 output-quality 样例，用来帮助维护者审查 `spec-plan` 的 source 变更；它们不是 executable eval runner，也不是 provider-backed model telemetry。

## Contract

- `examples.json` 是 examples-as-context，只提供可复查样例，不能替代 LLM 语义判断，也不能作为 deterministic router 或 semantic readiness gate。
- `output-quality-cases.json` 记录 file-backed output-quality review cases，用来审查 plan artifact 是否保持 Direct Evidence、plan-only safety、handoff blocking、review-origin traceability 和 source/runtime 边界。
- output-quality case 必须声明 `input_files`、`baseline_risks`、`with_skill_expectations`、`objective_assertions` 和 `evidence_status`。
- 当缺少 provider telemetry、model execution evidence 或 human adjudication 时，每个 output-quality case 必须在 `missing_evidence` 中显式标注，不能声称 fixture 已证明真实模型输出质量提升。
- source refs 必须是 repo-relative source paths；generated runtime mirrors 只能作为投影验证对象，不能作为 source authority。

## Review Boundary

确定性测试只校验 JSON shape、source-ref 安全、case id 唯一性、声明式覆盖和关键字段存在。LLM 或 reviewer 仍负责判断样例是否代表真实 planning 质量风险。
