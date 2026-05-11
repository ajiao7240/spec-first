# Standards / Glue-Map Consumption Examples

本文件展示下游 workflow 如何消费 `spec-standards` 生成的 standards candidates 与 `glue-map.json`。它是人读示例，不是新的 schema、producer、规则引擎或 workflow state machine。

## Consumption Modes

| Candidate / artifact signal | Consumption mode | Downstream meaning |
| --- | --- | --- |
| `confirmed` | hard context | 可作为 plan constraint、task constraint、work constraint 或 hard review criterion，前提是仍与当前 source plan / diff scope 一致。 |
| `observed` | advisory context | 可提示既有实践和实现偏好，不能升级为 hard rule，不能扩大 source scope。 |
| `imported` | advisory context | 可提示 shared standards alignment，项目确认前不能当作 project policy。 |
| `suggested` | advisory context | 可作为 LLM suggestion 或 planning consideration，不能成为 hard constraint。 |
| `conflict` | risk context | 必须在 plan / work / review 中 call out、解决或显式接受风险，不能静默覆盖当前证据。 |
| `deprecated` | risk context | 表示潜在 drift 或过期约定，应作为风险处理，不能继续当作 hard rule。 |
| `drifted` | risk context | 表示 baseline 与当前事实不一致，应作为风险处理，不能继续当作 hard rule。 |
| `unknown` | question context | 应转成问题、明确假设或 deferred implementation question。 |
| validator fail | degraded/advisory only | 结构或合同未通过，不能产生 hard constraints 或 hard findings。 |
| missing validation result | degraded/advisory only | 缺少 validator 证明时只能 advisory consumption。 |
| `trust_level=degraded` | degraded/advisory only | 只能证明 artifacts 可读，不能证明 trusted baseline。 |
| `consumption_boundary=advisory_only` | degraded/advisory only | producer 已声明 advisory-only，不能升级为 confirmed baseline。 |
| `workspace-advisory-only` | degraded/advisory only | 父 workspace advisory baseline 不能当作 child repo confirmed standards。 |

`advisory` 不是 candidate status。它只是 `observed`、`imported`、`suggested` 以及 degraded/workspace advisory 情况的消费模式。

## Workflow Examples

### `spec-plan`

Good:

- 把 `confirmed` 的 "source-first runtime regeneration" 写入 scope boundary 或 implementation constraint。
- 把 `observed` 的 "tests usually cover CLI contracts" 写成 Context & Research，提示实现者优先查现有测试。
- 把 `conflict` 写入 Risks & Dependencies 或 Open Questions，说明需要用户/project evidence 决定。
- 用 `glue-map.json` 中的 reusable capability 提醒 "先复用现有 graph readiness compiler"，但仍由 plan 根据 origin scope 决定要改哪些文件。

Bad:

- 把 `observed` 或 `suggested` 直接写成 "必须" 的 plan requirement。
- 因为 `glue-map.json` 提到某个 capability，就把计划范围扩大到 origin document 没有要求的模块。
- 把 `workspace-advisory-only` 的父级 baseline 当成 child repo confirmed standard。

### `spec-write-tasks`

Good:

- 只有 `confirmed` 且与 source plan 一致的标准，才进入 task constraint。
- `observed` / `imported` / `suggested` 只进入 `context_refs` 或 `risk_note`。
- `unknown` 转成 task `stop_if` 或 planning handoff 问题，而不是隐式决定。
- `glue-map.json` 可帮助 task shaping，例如先定位可复用 helper，再拆任务；它不能改变 source plan scope。

Bad:

- 从 `observed` candidate 生成新的 task requirement。
- 把 `glue-map.json` 当作 dependency graph、progress ledger 或 wave state machine。
- validator fail 后仍把 standards task constraint 标成 hard。

### `spec-work`

Good:

- 执行时遵守 `confirmed` standards，并在实现中优先复用 `glue-map.json` 指出的已有能力。
- 把 advisory candidates 当作实现提示或 review context；实现选择仍受 plan/task-pack scope 和实际代码证据约束。
- 当 baseline 为 degraded/advisory only 时，在最终说明或 review context 中记录限制，而不是声称 standards 已被确认。

Bad:

- 因为 advisory candidate 看起来合理，就改动计划外文件或重构计划外模块。
- 用 `glue-map.json` 判断 task 已完成、跳过验证或覆盖 `stop_if`。
- 把父 workspace advisory baseline 当作当前 child repo 的 hard coding standard。

### `spec-code-review`

Good:

- 只有 `confirmed` standards 可以成为 hard project-standards findings。
- `observed` / `imported` / `suggested` 只能产生 advisory question、context note 或低强度建议。
- `conflict` / `deprecated` / `drifted` 应作为风险或 follow-up 问题，不应直接判定 diff 违反硬规则。
- `glue-map.json` 可以支持 reuse-first review question，例如 "这里是否应复用已有 helper？"

Bad:

- 对 advisory 或 degraded baseline 产出 P0/P1 hard finding。
- 把 `unknown` 当作 reviewer 已确认事实。
- 用 `glue-map.json` 要求作者实现计划外 capability。

## Workspace Advisory Example

父 workspace 明确运行 `$spec-standards --workspace` 时，父级 `.spec-first/standards/` artifacts 只用于 workspace routing、child repo 摘要和 shared alignment 问题。即使其中出现某条看起来像标准的 candidate，它也不是任何 child repo 的 confirmed standards baseline。

正确处理方式：

- 对 plan/work/review：把它当 degraded/advisory context。
- 如果某个 child repo 需要本地 confirmed baseline：建议运行 `$spec-standards --repo <child>`，让 child repo 写入自己的 `.spec-first/standards/` baseline facts。
- 如果当前工作只涉及 child repo：以 child-local source、plan/task-pack scope、validated child baseline 和实际 diff 为准。

错误处理方式：

- 直接把父 workspace advisory artifacts 里的 candidate 写入 child repo hard constraints。
- 用父级 `workspace-advisory-only` baseline 生成 child repo P0/P1 standards findings。

## Glue-Map Boundary

`glue-map.json` 只支持 reuse-first 判断：它帮助下游 workflow 找到已有 capability、owner、entrypoint、output 和 "do not reimplement" 线索。

可以：

- 在 plan 中收窄实现边界，优先复用已有 capability。
- 在 task pack 中把 reuse target 放进 `context_refs`。
- 在 work 中先检查已有 helper / script / contract。
- 在 review 中提出 reuse-first question。

不可以：

- 作为 workflow state machine。
- 覆盖 plan、task pack、work scope 或 review judgment。
- 判断 task 是否完成、review 是否通过、或某个标准是否 confirmed。
- 让 advisory facts 升级为 hard rule。
