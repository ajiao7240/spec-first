# Closure Summary

## 完成内容

- 删除中英文 README 中已失效的 `test:crg:gate` 文案。
- 将 `docs/05-用户手册/04-workflows-artifacts-map.md` 中的 benchmark 现役表述收口为当前真相，并把 `crg-benchmark-evidence` 改成已退役历史说明。
- 在 `docs/08-版本更新/README.md` 增加 benchmark / CRG Quality Gate 退役总说明，并把相关历史章节改成明确历史语境。
- 修正 `docs/项目介绍/README.md` 中把 `benchmarks/` 写成现役目录的概览描述。
- 将 `docs/09-业界借鉴/crg-benchmark-governance.md`、`docs/项目介绍/2026-04-17-CRG-Phase-1-之后路线.md`、`docs/项目介绍/2026-04-17-CRG-优化工作清单.md`、两份 `docs/02-架构设计/全局分析/*` 文档，以及多份高频历史计划 / Sprint / 执行清单统一补上退役提示，避免旧 benchmark/gate 脱离语境继续误导当前读者。
- 补回 `docs/contexts/spec-first/injection-index.yaml` 样例文件，恢复 `spec-graph-bootstrap` contract test 与 AI Dev Quality Gate 所需样例真相源。
- 删除 `tests/unit/quality-feedback.test.js` 里已退役的 `crg-regression` 示例 check。
- 在 `CHANGELOG.md` 追加 benchmark 退役文档收口、全量审查与历史文档治理记录。

## 审查结论

- 当前真相面已删除干净：现行 README、用户手册、项目概览、quality feedback 测试、AI Dev Quality Gate 验证链路均不再把 benchmark / CRG Quality Gate 当作现役能力。
- 高频历史入口文档也已补明确的退役提示，不再以当前口吻描述这些能力。
- 现在剩余的 benchmark / CRG Quality Gate 文本命中，属于更深层历史资料，且不再构成当前读者的主要误导源。

## 验证结果

- `npx jest tests/unit/quality-feedback.test.js tests/unit/ai-dev-quality-gate.test.js tests/integration/verification-gate.integration.test.js tests/unit/spec-graph-bootstrap-contracts.test.js --runInBand` ✅
- `npm run test:ai-dev:gate` ✅
- `npm run typecheck` ✅

## 结论

本轮 benchmark retirement 的当前真相面、高频治理文档与高频历史入口都已收口完成。现阶段可视为任务完成，下一步只需按需要审阅 diff 或提交变更。
