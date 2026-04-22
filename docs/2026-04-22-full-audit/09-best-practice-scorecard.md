# 09 Best Practice Scorecard

| 维度 | 评级 | 依据 | 备注 |
|---|---|---|---|
| 哲学一致性 | A- | `docs/10-prompt/项目角色.md:7-22,42-63`、`src/context-routing/evaluator.js:233-264`、`skills/spec-graph-bootstrap/SKILL.md` | 方向正确，但多层投影增长形成张力 |
| 边界清晰度 | B+ | `src/cli/index.js:10-49` 薄入口；`src/context-routing/loader.js:14-62` 与 `evaluator.js:149-284` 分层清晰；CRG 主要生产事实 | `init`/`doctor`/`workspace-compiler` 等热点正在增厚 |
| 工程可维护性 | B | `src/cli/state.js:16-315`、`src/cli/plugin.js:111-335`、adapter 收口较好 | 共享枢纽过重、同步面较多 |
| 测试与可验证性 | A- | `package.json:14-27` 的测试塔、`tests/unit/doctor-json-contract.test.js`、tarball install smoke、Stage-0 contracts | 失败路径验证仍不够完整 |
| 运行时治理成熟度 | A- | runtime drift、doctor diagnostics、dual-host governance | 维护税较高 |
| 输入质量体系 | A | fallback_reason / confidence / provenance / freshness / coverage_gaps | 这是仓库最强项之一 |
| 单一真相源健康度 | B | source-of-truth 原则明确，manifest/governance 分工清楚 | source/mirror/runtime/sample 多层表达增加张力 |
| 最佳实践接近度 | B+ | 明显高于普通 workflow CLI，但尚未稳定收口 | 接近最佳实践，不是最终形态 |

## 总评

### 强项
- 哲学落地不是口号
- 输入质量体系成熟
- deterministic control plane 明确
- 测试与契约守护较强

### 扣分点
- 少数共享枢纽复杂度过高
- source/mirror/runtime/sample 同步面偏多
- release/rollback/postinstall 等失败路径仍有验证断层

## 当前阶段总体结论

> 项目已达到“高质量、强哲学一致性、明显高于平均水平”的状态，但尚未达到“复杂度已稳定收口”的最佳实践终态。
