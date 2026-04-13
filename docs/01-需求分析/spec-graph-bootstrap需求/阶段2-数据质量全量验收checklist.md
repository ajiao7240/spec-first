# `spec-graph-bootstrap` 阶段 2 数据质量全量验收 Checklist

> 适用范围：`spec-graph-bootstrap` 阶段 2
>
> 目标：对阶段 2 产物执行“全量核实”而不是“抽样核实”，判断其是否达到可进入阶段 3 的数据质量门槛。
>
> 边界：本文只验阶段 2 的事实层、文档层、路由层和稳定性，不验证 `plan / work / review` 的实际消费效果。消费效果验证属于阶段 3A。
>
> 依据文档：
> - [阶段2-事实抽取与文档生成需求.md](./阶段2-事实抽取与文档生成需求.md)
> - [阶段化开发与验证路线图.md](./阶段化开发与验证路线图.md)
> - [方案本质问题总结.md](./方案本质问题总结.md)

## 1. 使用说明

本 Checklist 用于回答两个问题：

1. 阶段 2 产物是否“全部生成且结构正确”。
2. 阶段 2 产物是否“全部可追溯、可解释、可重复”，足以作为阶段 3 的输入。

本 Checklist 明确采用以下验收原则：

- 不允许仅靠人工抽样给出“看起来差不多”的结论。
- 所有必需产物必须全量检查。
- 所有 `Observed` 事实必须全量回证。
- 所有 `Inferred` 事实必须全量校验规则、理由和证据链。
- 所有文档中的结构化陈述必须全量回溯到控制面事实。
- 所有路由规则必须全量求值和全量引用校验。
- 同一输入重跑两次后，除允许波动字段外，不得出现非预期漂移。

## 2. 验收对象

### 2.1 控制面产物

- [ ] `.context/spec-first/bootstrap/<slug>/fact-inventory.json`
- [ ] `.context/spec-first/bootstrap/<slug>/risk-signals.json`
- [ ] `.context/spec-first/bootstrap/<slug>/test-surface.json`
- [ ] `.context/spec-first/bootstrap/<slug>/fingerprints.json`

### 2.2 长期上下文产物

- [ ] `docs/contexts/<slug>/README.md`
- [ ] `docs/contexts/<slug>/00-summary.md`
- [ ] `docs/contexts/<slug>/architecture/module-map.md`
- [ ] `docs/contexts/<slug>/pitfalls/index.md`
- [ ] `docs/contexts/<slug>/code-facts/public-entrypoints.md`
- [ ] `docs/contexts/<slug>/code-facts/test-map.md`
- [ ] `docs/contexts/<slug>/code-facts/high-risk-modules.md`
- [ ] `docs/contexts/<slug>/context-packs/review-change.md`
- [ ] `docs/contexts/<slug>/injection-index.yaml`

## 3. 先决条件

在执行本 Checklist 前，先确认以下前提全部成立：

- [ ] 阶段 1 已完成，`spec-graph-bootstrap` 可在宿主中被调用。
- [ ] 目标仓库可稳定执行阶段 2。
- [ ] 当前验收使用固定 commit / 固定分支 / 固定工作区输入。
- [ ] 当前验收记录了 analyzer 版本、schema 版本、执行时间和目标 slug。
- [ ] 如阶段 2 依赖 CRG 图状态，已明确记录本次图状态来源。
- [ ] 本轮验收不将阶段 3 的消费效果混入 verdict。

## 4. Layer A：产物完整性全量核实

### 4.1 文件存在性

- [ ] 所有控制面产物都存在。
- [ ] 所有长期上下文产物都存在。
- [ ] 不存在“需求列为必需但本轮未生成”的文件。

### 4.2 文件非空性

- [ ] 所有 JSON 文件非空。
- [ ] 所有 Markdown 文件非空。
- [ ] `injection-index.yaml` 非空。
- [ ] 不存在只有标题、无正文的空壳文档。

### 4.3 可解析性

- [ ] `fact-inventory.json` 可解析。
- [ ] `risk-signals.json` 可解析。
- [ ] `test-surface.json` 可解析。
- [ ] `fingerprints.json` 可解析。
- [ ] `injection-index.yaml` 可解析为合法 YAML。

### 4.4 基本 contract

- [ ] `fingerprints.json` 顶层至少包含 `inputs`。
- [ ] `fingerprints.json` 顶层至少包含 `outputs`。
- [ ] `fingerprints.json` 顶层至少包含 `updated_at`。
- [ ] `injection-index.yaml` 至少包含 `always`。
- [ ] `injection-index.yaml` 至少包含 `plan`。
- [ ] `injection-index.yaml` 至少包含 `work`。
- [ ] `injection-index.yaml` 至少包含 `review`。
- [ ] `injection-index.yaml` 至少包含 `unknown`。

### 4.5 Layer A 通过条件

- [ ] 本层无缺失文件。
- [ ] 本层无空文件。
- [ ] 本层无不可解析文件。
- [ ] 本层无 contract 缺字段问题。

## 5. Layer B：事实字段合法性全量核实

本层针对控制面产物中的全部事实项执行字段和值域校验。

### 5.1 通用字段合法性

- [ ] 每条事实都具备 `path` 或等价定位字段。
- [ ] 每条事实的 `kind` 都在允许值域内。
- [ ] 每条事实的 `summary` 都非空。
- [ ] 每条事实的 `confidence` 都在允许值域内。
- [ ] 每条事实的 `evidence` 字段存在且类型正确。
- [ ] 每条事实的 `updated_at` 字段存在且格式合法。

### 5.2 `Observed` / `Inferred` 合同

- [ ] 所有 `confidence=Inferred` 的事实都包含 `inference_reason`。
- [ ] 所有 `confidence=Observed` 的事实没有伪装成推断型说明。
- [ ] 不存在未知或漂移的 `confidence` 枚举值。
- [ ] 不存在未知或漂移的 `inference_reason` 值域。

### 5.3 结构稳定性

- [ ] 同类事实的字段集合一致。
- [ ] 不存在同类事实一部分有证据、一部分无证据的结构漂移。
- [ ] 不存在渲染层私自追加的无 schema 字段。

### 5.4 Layer B 通过条件

- [ ] 事实字段合法性覆盖率为 100%。
- [ ] `Inferred` 理由缺失数为 0。
- [ ] 非法枚举值数量为 0。
- [ ] 结构漂移数量为 0。

## 6. Layer C：源码 / 图谱对账全量核实

本层是阶段 2 数据质量的核心 gate。

### 6.1 `Observed` 事实全量回证

对每一条 `Observed` 事实执行以下核实：

- [ ] `path` 指向的文件真实存在。
- [ ] `symbol` 在对应文件或图谱实体中真实存在。
- [ ] `kind` 与源码或图谱中的实体类型一致。
- [ ] `summary` 与源事实不冲突。
- [ ] `evidence` 中引用的文件、节点、边、命令输出真实存在。
- [ ] 若事实来自 CRG，能回溯到 graph.db 或对应 CRG 输出。

### 6.2 `Inferred` 事实全量规则校验

对每一条 `Inferred` 事实执行以下核实：

- [ ] 该事实的推断规则在系统中存在明确定义。
- [ ] `inference_reason` 与实际使用的规则一致。
- [ ] `evidence` 足以支撑该规则前提成立。
- [ ] 渲染后的结论没有超出规则允许范围。
- [ ] 相同规则生成的事实口径一致。

### 6.3 控制面内交叉一致性

- [ ] `fact-inventory.json` 中的入口点，与 `public-entrypoints.md` 的事实来源一致。
- [ ] `risk-signals.json` 中的高风险项，与 `high-risk-modules.md` 的事实来源一致。
- [ ] `test-surface.json` 中的测试覆盖信息，与 `test-map.md` 的事实来源一致。
- [ ] `fingerprints.json` 中登记的 outputs 与本轮真实产物一致。

### 6.4 Layer C 通过条件

- [ ] `Observed` 事实全量可回证。
- [ ] `Observed` 事实不可回证数量为 0。
- [ ] `Inferred` 事实全量具备合法推断链。
- [ ] 控制面交叉冲突数量为 0。

## 7. Layer D：文档层追溯性全量核实

本层验证所有 Markdown 文档是否真正遵守 facts-first，而不是自行发明第二套事实世界。

### 7.1 文档结构化声明全量回溯

对下列文档中的结构化声明逐条回溯：

- [ ] `README.md`
- [ ] `00-summary.md`
- [ ] `architecture/module-map.md`
- [ ] `pitfalls/index.md`
- [ ] `code-facts/public-entrypoints.md`
- [ ] `code-facts/test-map.md`
- [ ] `code-facts/high-risk-modules.md`
- [ ] `context-packs/review-change.md`

### 7.2 回溯检查项

对每条结构化声明执行以下核对：

- [ ] 可回溯到控制面事实。
- [ ] 若为 `Inferred`，其推断属性未被文档伪装为 `Observed`。
- [ ] 文档未引入控制面中不存在的强结论。
- [ ] 多份文档对同一事实的表述不互相冲突。
- [ ] 文档没有通过“重新扫源码”偷偷补出控制面没有的事实。

### 7.3 文档职责边界

- [ ] `README.md` 主要承担导航与控制台职责，不大面积复制其他文档正文。
- [ ] `00-summary.md` 主要承担最小事实摘要职责，不替代模块图和风险页。
- [ ] `module-map.md` 主要承担结构理解职责，不与 `pitfalls/index.md` 重复堆叠。
- [ ] `review-change.md` 主要承担 review 最小上下文包职责，不扩写为通用项目总览。

### 7.4 Layer D 通过条件

- [ ] 文档结构化声明全量可追溯。
- [ ] 无法追溯的新增强结论数为 0。
- [ ] 文档间冲突数为 0。
- [ ] 文档职责边界混乱项为 0。

## 8. Layer E：路由正确性全量核实

本层针对 `injection-index.yaml` 执行全量 contract 验证。

### 8.1 结构检查

- [ ] `injection-index.yaml` 结构符合阶段 2 contract。
- [ ] 存在 `always` 集合。
- [ ] 存在 `plan` 集合。
- [ ] 存在 `work` 集合。
- [ ] 存在 `review` 集合。
- [ ] 存在 `unknown` 集合。
- [ ] 存在 `selection_rules`。
- [ ] 存在 `advice` 或等价说明区块。

### 8.2 引用完整性

- [ ] 路由中引用的所有文件路径都存在。
- [ ] `output_exists.*` 引用的目标文件路径都有效。
- [ ] 不存在悬空路径。
- [ ] 不存在拼写错误导致的无效目标。

### 8.3 求值 contract

- [ ] `selection_rules` 只使用阶段 2 允许的求值条件。
- [ ] `stage` 条件可读且可判定。
- [ ] `task_type` 条件可读且可判定。
- [ ] `fact.*` 条件可读且可判定。
- [ ] `output_exists.*` 条件表达的是消费期实时求值，不依赖额外状态文件。

### 8.4 回退与非阻断性

- [ ] `unknown` 存在最小回退集合。
- [ ] `unknown` 不阻断 workflow。
- [ ] 某个可选产物缺失时，路由仍有可读回退。
- [ ] 不存在“某文档缺失导致整套路由无法求值”的硬阻断。

### 8.5 全量场景求值

至少对以下场景逐一求值并记录结果：

- [ ] `task_type=plan`
- [ ] `task_type=work`
- [ ] `task_type=review`
- [ ] `task_type=unknown`
- [ ] 某个文档缺失时的降级路径
- [ ] 某个 `output_exists.*=false` 时的回退路径

### 8.6 Layer E 通过条件

- [ ] 路由引用有效率为 100%。
- [ ] 路由求值规则非法项为 0。
- [ ] `unknown` 阻断项为 0。
- [ ] 路由全量场景求值均得到确定结果。

## 9. Layer F：重跑稳定性与确定性全量核实

本层验证同一输入下阶段 2 产物是否稳定。

### 9.1 重跑条件固定

- [ ] 使用同一仓库状态。
- [ ] 使用同一 commit。
- [ ] 使用同一环境变量。
- [ ] 使用同一 analyzer 版本。
- [ ] 使用同一 slug 策略。

### 9.2 控制面 diff 对账

- [ ] 两次运行的 `fact-inventory.json` 除允许波动字段外无差异。
- [ ] 两次运行的 `risk-signals.json` 除允许波动字段外无差异。
- [ ] 两次运行的 `test-surface.json` 除允许波动字段外无差异。
- [ ] 两次运行的 `fingerprints.json` 除时间与快照类字段外无非预期差异。

### 9.3 文档层 diff 对账

- [ ] 两次运行的 `README.md` 无非预期差异。
- [ ] 两次运行的 `00-summary.md` 无非预期差异。
- [ ] 两次运行的 `module-map.md` 无非预期差异。
- [ ] 两次运行的 `pitfalls/index.md` 无非预期差异。
- [ ] 两次运行的 `public-entrypoints.md` 无非预期差异。
- [ ] 两次运行的 `test-map.md` 无非预期差异。
- [ ] 两次运行的 `high-risk-modules.md` 无非预期差异。
- [ ] 两次运行的 `review-change.md` 无非预期差异。
- [ ] 两次运行的 `injection-index.yaml` 无非预期差异。

### 9.4 漂移识别

- [ ] 不存在随机排序导致的条目漂移。
- [ ] 不存在统计值无原因变化。
- [ ] 不存在路由规则无原因变化。
- [ ] 不存在 narrative 文案无原因变化。

### 9.5 Layer F 通过条件

- [ ] 同输入重跑的非预期 diff 为 0。
- [ ] 随机性漂移项为 0。
- [ ] 路由漂移项为 0。

## 10. 汇总结论

### 10.1 硬性 blocker

出现以下任一项，直接判定阶段 2 数据质量验收失败：

- [ ] 必需产物缺失。
- [ ] 任一必需产物不可解析。
- [ ] 任一 `Observed` 事实不可回证。
- [ ] 任一文档存在无法追溯的新增强结论。
- [ ] 路由存在悬空引用或不可判定规则。
- [ ] 同输入重跑存在非预期漂移。

### 10.2 最终 verdict

- [ ] `PASS`
  说明：六层验收全部通过，可进入阶段 3A。

- [ ] `PASS_WITH_GAPS`
  说明：合同层成立，但存在非 blocker 的一致性或解释性缺口。原则上应先修复，再进入阶段 3A。

- [ ] `FAIL`
  说明：存在 blocker，不得进入阶段 3。

### 10.3 总结记录

- [ ] 记录本轮目标仓库与 commit。
- [ ] 记录本轮 analyzer / schema 版本。
- [ ] 记录本轮 slug。
- [ ] 记录本轮执行时间。
- [ ] 记录 blocker 列表。
- [ ] 记录非 blocker gap 列表。
- [ ] 记录最终 verdict。

## 11. 推荐的验收记录模板

可为每次阶段 2 验收附带一份记录文件，建议至少包含以下字段：

```md
# 阶段2数据质量验收记录

- 仓库：
- commit：
- slug：
- analyzer_version：
- schema_version：
- 执行时间：

## Layer A
- verdict:
- issues:

## Layer B
- verdict:
- issues:

## Layer C
- verdict:
- issues:

## Layer D
- verdict:
- issues:

## Layer E
- verdict:
- issues:

## Layer F
- verdict:
- issues:

## Final Verdict
- PASS / PASS_WITH_GAPS / FAIL
- blockers:
- gaps:
- next_actions:
```

## 12. 结论解释

阶段 2 的成功，不等于“后续 workflow 已经证明有效”，而等于以下命题成立：

- 所有阶段 2 产物都已生成。
- 所有阶段 2 事实都可追溯。
- 所有阶段 2 文档都以事实层为唯一正式来源。
- 所有阶段 2 路由都可判定、可降级、可人工消费。
- 同一输入下阶段 2 产物稳定，不依赖运气。

只有在这五点都成立时，阶段 2 才能作为阶段 3 的可靠输入层。

## 13. 本次自测记录（2026-04-13，`spec-first` 仓库）

> 说明：本节是按本文 Checklist 对当前仓库现有阶段 2 产物做的一次实际自测记录。
>
> 本次记录只勾选“已被真实验证通过”的项目；未执行、证据不足或已发现缺口的项目保持未通过。

### 13.1 基本信息

- [x] 仓库：`/Users/kuang/xiaobu/spec-first`
- [x] slug：`spec-first`
- [x] commit：`7fe35b01f061d57ce95c0eb189b30b7844b04fef`
- [x] 验证时间：`2026-04-13 11:32:33 +0800`
- [x] 控制面目录：`.context/spec-first/bootstrap/spec-first/`
- [x] 长期上下文目录：`docs/contexts/spec-first/`

### 13.2 Layer A 实测结果

#### 13.2.1 文件存在性

- [x] 所有控制面产物都存在。
- [x] 所有长期上下文产物都存在。
- [x] 不存在“需求列为必需但本轮未生成”的文件。

#### 13.2.2 文件非空性

- [x] 所有 JSON 文件非空。
- [x] 所有 Markdown 文件非空。
- [x] `injection-index.yaml` 非空。
- [x] 不存在只有标题、无正文的空壳文档。

#### 13.2.3 可解析性

- [x] `fact-inventory.json` 可解析。
- [x] `risk-signals.json` 可解析。
- [x] `test-surface.json` 可解析。
- [x] `fingerprints.json` 可解析。
- [x] `injection-index.yaml` 可解析为合法 YAML。

#### 13.2.4 基本 contract

- [x] `fingerprints.json` 顶层至少包含 `inputs`。
- [x] `fingerprints.json` 顶层至少包含 `outputs`。
- [x] `fingerprints.json` 顶层至少包含 `updated_at`。
- [x] `injection-index.yaml` 至少包含 `always`。
- [x] `injection-index.yaml` 至少包含 `plan`。
- [x] `injection-index.yaml` 至少包含 `work`。
- [x] `injection-index.yaml` 至少包含 `review`。
- [x] `injection-index.yaml` 至少包含 `unknown`。

#### 13.2.5 Layer A 小结

- [x] 本层无缺失文件。
- [x] 本层无空文件。
- [x] 本层无不可解析文件。
- [x] 本层无 contract 缺字段问题。

### 13.3 Layer B 实测结果

#### 13.3.1 已通过项

- [x] 所有 `confidence=Inferred` 的事实都包含 `inference_reason`。
- [x] 不存在未知或漂移的 `confidence` 枚举值。

#### 13.3.2 未通过项

- [ ] 每条事实的 `evidence` 字段存在且类型正确。
  说明：全量机检发现 26 条带 `confidence` 的对象缺少 `evidence` 数组，集中在 `test-surface.json` 的 `test_files[*]` 与 `coverage_gaps[*]`。

- [ ] 每条事实都具备 `path` 或等价定位字段。
- [ ] 每条事实的 `kind` 都在允许值域内。
- [ ] 每条事实的 `summary` 都非空。
- [ ] 每条事实的 `updated_at` 字段存在且格式合法。
  说明：按当前控制面对象做全量机检，存在多类事实对象未统一到“最小字段集合”；当前产物更接近“控制面专用 schema”，未完全收敛到本文 Checklist 中的统一事实 contract。

#### 13.3.3 Layer B 小结

- [ ] 事实字段合法性覆盖率为 100%。
- [x] `Inferred` 理由缺失数为 0。
- [x] 非法枚举值数量为 0。
- [ ] 结构漂移数量为 0。

### 13.4 Layer C 实测结果

#### 13.4.1 已通过项

- [x] `fingerprints.json` 中登记的 outputs 与本轮真实产物数量一致。
  说明：`fingerprints.json.outputs` 共 9 项，与 `docs/contexts/spec-first/` 下本轮最小闭环产物数量一致。

#### 13.4.2 尚未完成项

- [ ] `Observed` 事实全量可回证。
- [ ] `Observed` 事实不可回证数量为 0。
- [ ] `Inferred` 事实全量具备合法推断链。
- [ ] `fact-inventory.json` 中的入口点，与 `public-entrypoints.md` 的事实来源一致。
- [ ] `risk-signals.json` 中的高风险项，与 `high-risk-modules.md` 的事实来源一致。
- [ ] `test-surface.json` 中的测试覆盖信息，与 `test-map.md` 的事实来源一致。

说明：本轮未执行“逐条事实回源到源码 / graph.db / CRG 输出”的全量对账，因此 Layer C 不能判定通过。

### 13.5 Layer D 实测结果

#### 13.5.1 已通过项

- [x] 所有阶段 2 Markdown 文档均为非空正文文档，且具有明确标题与章节结构。

#### 13.5.2 尚未完成项

- [ ] 文档结构化声明全量可追溯。
- [ ] 无法追溯的新增强结论数为 0。
- [ ] 文档间冲突数为 0。
- [ ] 文档职责边界混乱项为 0。

说明：本轮只验证了文档存在、非空和结构完整，未执行“逐条结构化声明回溯到控制面事实”的全量对账，因此 Layer D 不能判定通过。

### 13.6 Layer E 实测结果

#### 13.6.1 已通过项

- [x] `injection-index.yaml` 结构符合阶段 2 基本 contract。
- [x] 存在 `always` 集合。
- [x] 存在 `stages.plan`。
- [x] 存在 `stages.work`。
- [x] 存在 `stages.review`。
- [x] 存在 `task_types.always`。
- [x] 存在 `task_types.plan`。
- [x] 存在 `task_types.work`。
- [x] 存在 `task_types.review`。
- [x] 存在 `task_types.unknown`。
- [x] 存在 `selection_rules`。
- [x] 路由中引用的所有 Markdown 路径均存在。
- [x] 不存在悬空路径。

#### 13.6.2 未通过项

- [ ] 存在 `advice` 或等价说明区块。
  说明：当前 `injection-index.yaml` 仅包含 `always / stages / task_types / selection_rules`，未检测到 `advice`。

#### 13.6.3 尚未完成项

- [ ] `selection_rules` 只使用阶段 2 允许的求值条件。
- [ ] `stage` 条件可读且可判定。
- [ ] `task_type` 条件可读且可判定。
- [ ] `fact.*` 条件可读且可判定。
- [ ] `output_exists.*` 条件表达的是消费期实时求值，不依赖额外状态文件。
- [ ] `unknown` 存在最小回退集合。
- [ ] `unknown` 不阻断 workflow。
- [ ] 某个可选产物缺失时，路由仍有可读回退。
- [ ] 不存在“某文档缺失导致整套路由无法求值”的硬阻断。
- [ ] `task_type=plan` 全量场景求值得到确定结果。
- [ ] `task_type=work` 全量场景求值得到确定结果。
- [ ] `task_type=review` 全量场景求值得到确定结果。
- [ ] `task_type=unknown` 全量场景求值得到确定结果。

说明：本轮完成了结构和引用完整性检查，但未对规则表达式和降级路径做逐条求值模拟。

### 13.7 Layer F 实测结果

- [ ] 同输入重跑的非预期 diff 为 0。
- [ ] 随机性漂移项为 0。
- [ ] 路由漂移项为 0。

说明：本轮未执行阶段 2 的二次重跑，因此稳定性层未验证。

### 13.8 当前 verdict

- [ ] `PASS`
- [ ] `PASS_WITH_GAPS`
- [x] `FAIL`

判定理由：

1. Layer A 已整体通过，说明产物完整性、非空性、可解析性和最小 contract 已成立。
2. Layer B 存在已确认缺口：`test-surface.json` 内 26 条带 `confidence` 的对象缺少 `evidence` 数组，且控制面事实尚未统一到本文要求的最小事实字段集合。
3. Layer C、Layer D、Layer F 所要求的“全量回证 / 全量追溯 / 重跑稳定性”本轮尚未完成，不能按“严格按照文档”判定通过。

### 13.9 下一步最小动作

- [ ] 先补齐 `test-surface.json` 中 `test_files[*]` 与 `coverage_gaps[*]` 的 `evidence` 字段。
- [ ] 明确哪些控制面对象属于“正式 FactItem”，哪些属于“专用控制面 schema”，避免 Checklist 与产物 contract 口径不一致。
- [ ] 对 Layer C 执行逐条事实回源对账。
- [ ] 对 Layer D 执行逐条结构化声明追溯。
- [ ] 真实重跑阶段 2 两次，完成 Layer F 稳定性验证。
