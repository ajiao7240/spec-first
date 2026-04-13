# 3A 验证记录：spec-plan Stage-0 消费

- task_name: `spec-plan` 消费 `spec-graph-bootstrap` Stage-0 产物，为阶段 3B 接入方案生成实施计划
- task_goal: 在不依赖 task pack 的前提下，验证 `plan` 阶段是否能靠 `always + stages.plan + output_exists.*` 获得足够上下文来支撑技术规划
- stage: `plan`
- task_type: `unknown`
- context_slug: `spec-first`
- expected_inputs:
  - `docs/contexts/spec-first/00-summary.md`
  - `docs/contexts/spec-first/README.md`
  - `docs/contexts/spec-first/architecture/module-map.md`
  - `docs/contexts/spec-first/code-facts/public-entrypoints.md`
- actual_inputs:
  - `docs/contexts/spec-first/00-summary.md`
  - `docs/contexts/spec-first/README.md`
  - `docs/contexts/spec-first/architecture/module-map.md`
  - `docs/contexts/spec-first/code-facts/public-entrypoints.md`
- fallback_triggered: `no`
- fallback_reason: `none`
- degrade_level: `none`
- missing_outputs: `[]`
- misleading_points:
  - `task_type` 在 v1 不参与实际路由，验证时保留为模板字段并显式填写 `unknown`
  - `selection_rules.output_exists.code_facts_public_entrypoints` 与 `stages.plan` 会命中同一文件，消费端需要去重，但不会形成关键误导
- useful_outputs:
  - `architecture/module-map.md` 帮助确认阶段 3B 应只改 skill 文档和治理文件，不触碰 command 层
  - `code-facts/public-entrypoints.md` 帮助确认 `spec-plan` 仍需围绕 `src/cli/index.js`、`bin/spec-first.js`、`src/crg/cli/router.js` 等真实入口制定消费建议
  - `00-summary.md` 和 `README.md` 提供仓库形态、运行时和测试层级的全局背景
- verdict: `pass`
- allow_enter_3b: `yes`
- gate_reason: `plan` 阶段主路径可工作，yaml 路由在无 task_type 参与的 v1 约束下仍能稳定提供规划所需上下文；弱点仅在于重复命中需消费端去重，属于可解释的实现细节，不构成关键误导

## 验证结论

本次验证证明 `spec-plan` 可仅依赖 `stage=plan` 和 `output_exists.*` 静态规则完成 v1 消费，不需要 `task_type` 契约即可支撑阶段 3B 最小化接入。
