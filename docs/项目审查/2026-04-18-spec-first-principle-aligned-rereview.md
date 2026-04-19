# Spec-First 原则对齐版复审

文档角色：`补充复审 / principle-aligned rereview`  
上位文档：[2026-04-18-spec-first-code-audit-report.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/2026-04-18-spec-first-code-audit-report.md)  
相关文档：[2026-04-18-spec-first-strengths-weaknesses-summary.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/2026-04-18-spec-first-strengths-weaknesses-summary.md)  
相关路线图：[2026-04-18-spec-graph-bootstrap-optimization-roadmap.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/spec-graph-bootstrap/2026-04-18-spec-graph-bootstrap-optimization-roadmap.md)  
复审准绳：`轻 contract + 明确边界 + 让 LLM 决策`  
日期：`2026-04-18`

## 1. 本次复审的目的

这次复审不是重新推翻主报告，而是用仓库在 [AGENTS.md](/Users/kuang/xiaobu/spec-first/AGENTS.md) 中已经明确写下的原则，重新检查原报告的判断和整改建议是否完全对齐。

重点只审三件事：

1. 原报告有没有把“质量提升”误写成“更强门禁、更强编排、更像状态机”
2. 哪些建议应保留，但要改写成“提升 LLM 决策输入质量”的表述
3. 哪些整改方向要明确禁止，避免系统被推向“多状态流转 + 强编排”的方向

## 2. 复审结论

结论很明确：

- 原主报告的大方向是对的
- 原主报告已经多次强调“问题不在于没做状态机”，这一判断应当保留
- 但部分整改建议如果继续外推，存在被实现成“更重 gate、更强 flow-control、更高 orchestration coupling”的风险

所以，本次复审后的主判断应当进一步收紧为：

> `spec-first` 的质量提升主线，必须来自**更真实的上下文、更清楚的来源、更锋利的验证信号、更显式的 fallback 语义、更低的上下文漂移**；  
> 不能来自把 workflow 变成一套多状态流转、审批分支和强执行树。

## 3. 对原主报告的再判断

## 3.1 哪些核心判断应保持不变

以下判断在本次复审后仍然成立，而且应该作为后续所有整改的上位约束：

1. `spec-first` 更像一个 `LLM 决策输入平台 + workflow governance layer`，而不是重状态机编排器。
2. 当前最关键的质量面不是“流程是否足够硬”，而是“输入是否足够真、足够稳、足够可解释”。
3. `verification_summary / verifier_dispatch / verification_gate_state / telemetry` 的问题，本质是**边界与消费口径漂移**，不是“状态不够多”。
4. `bootstrap / Stage-0` 的核心风险在于“样子完整但事实不够真”，不是“状态推进不够严格”。
5. `.claude/tasks` 旧控制面问题，本质是**双重心智模型和治理边界不清**，不是单纯“缺一条更强的迁移状态”。

## 3.2 哪些地方需要进一步改写

原报告里有些建议虽然方向没错，但表达上仍容易让后续实现者滑向“更强控制流”：

- “冻结 contract 边界”
- “收紧 L0 判断标准”
- “增加 runnable probe”
- “明确阶段整改顺序”

这些表述本身没有错，但若实现时缺少原则约束，很容易被做成：

- 更多枚举状态
- 更多 gate 分支
- 更多前置/后置审批
- 一个合并式 orchestration object
- 用状态机替代 LLM 的判断空间

因此，它们都需要改写成“提供更好的独立事实结构”，而不是“提供更强的执行编排”。

## 4. 原则对齐后的质量模型

按照仓库原则，质量不应主要由“流程推进是否更硬”来定义，而应主要由以下输入质量维度定义：

1. **Truthfulness**
   当前输入是否忠实反映仓库真实情况，而不是模板、sample 或推测。

2. **Provenance**
   每个结论、建议、验证项、上下文资产来自哪里，能否追到代码、文档、测试、命令或运行时信号。

3. **Confidence**
   系统不是只给内容，还应告诉 LLM 这个内容有多可信、哪些是高信号、哪些只是弱提示。

4. **Fallback semantics**
   当真实分析不足时，必须显式告诉 LLM：这里是退化结果、占位结果还是 sample-backed 结果。

5. **Boundary clarity**
   每个结构只回答自己的问题，不混答别的问题。

6. **Low context drift**
   同一事实不能在多个结构中被不同命名、不同口径、不同层次重复表达。

这六项，才是 `spec-first` 质量提升的主轴。

## 5. 明确禁止的整改方向

为了避免后续整改偏航，下面这些方向应该被视为**反模式**：

1. 把 `verification_summary / verifier_dispatch / verification_gate_state / telemetry` 合并成一个“大统一编排对象”。
2. 把 quality gate 扩成“多阶段审批流”，让每一步都带状态跃迁和强制转场。
3. 为了解决输入不真，反而引入更多 gate 状态、approval 分支和 orchestration layer。
4. 让 `doctor` 从“报告事实与证据”滑向“统一执行总控器”。
5. 把 workflow 质量问题误判成“LLM 自由度过高”，然后用更重的执行树去替代决策输入优化。

一句话：

> 不要为了减少不确定性，就把系统做成强编排状态机。  
> 应该做的是提高不确定性的可见性、来源清晰度和可消费性。

## 6. 对主报告整改建议的原则化改写

## 6.1 关于 `verification_summary / verifier_dispatch / verification_gate_state / telemetry`

原始风险判断是对的，但整改表达应进一步收口：

不应理解为：

- 再做一层统一 gate 状态机
- 给这些结构补更多流转状态
- 用 central orchestrator 决定所有 verifier 下一步执行

应理解为：

- `verification_summary` 只回答“当前建议看哪些验证面、为什么”
- `verifier_dispatch` 只回答“若要执行验证，候选 verifier、阻塞条件和 handoff posture 是什么”
- `verification_gate_state` 只回答“当前证据状态是什么，还缺什么”
- `telemetry` 只回答“本次系统观察到了什么事实、走了什么降级路径”

优化目标不是“把四者串成一棵流程树”，而是“让四者成为互相独立、可组合、低漂移的事实结构”。

## 6.2 关于 `bootstrap / Stage-0`

原报告要求修复“产物装配成功被误读成真实分析成功”，这个判断完全正确。  
但整改重点应当是：

- 增强 truthfulness
- 暴露 provenance
- 显式 fallback
- 区分 assembly success 和 evidence quality

而不是：

- 再发明更多 bootstrap 状态
- 再增加一层 stage approval
- 再加一个 orchestrator 决定能不能进入下游

更好的做法是让下游 `plan/work/review` 明确看到：

- 这份输入来自 sample、mixed 还是 analyzer-backed
- 关键字段置信度是多少
- 哪些资产只是 skeletal
- 哪些 verifier 建议只是 repo baseline，不等于当前改动必须执行

## 6.3 关于 `doctor`

原报告建议加入 runnable probe，这个方向可以保留，但应明确边界：

`doctor` 的目标应是：

- 增加 evidence
- 提高 runnable truth
- 减少 “PASS 但其实跑不动” 的误导

而不是：

- 演化成执行编排中心
- 统一驱动所有宿主 workflow
- 负责做复杂状态转移与审批判断

也就是说，probe 应该是**证据提供器**，不是**流程总控器**。

## 6.4 关于旧 `.claude/tasks` 控制面

这个问题的整改重点不是再给旧路径补一层迁移状态，而是要明确：

- 它是否仍是正式产品表面
- 如果不是，应视为兼容遗产并逐步退出主叙事
- 如果是，应重新解释它与新 control plane 的关系

本质仍然是边界治理问题，不是状态数量不够的问题。

## 7. 复审后的优先级重排

按原则对齐后，优先级应这样排序：

### P0：提升决策输入真值

- 让 bootstrap / Stage-0 输出明确区分 `assembly` 与 `evidence`
- 给关键输入补 `provenance / confidence / fallback_reason / freshness`
- 让 skeletal / sample-backed 结果显式可见，而不是伪装成完整成功

### P1：降低上下文漂移

- 彻底收口 `verification_summary / verifier_dispatch / verification_gate_state / telemetry` 的职责
- 减少同一事实跨结构重复表达
- 让命名、schema、telemetry 和 workflow 消费口径一致

### P2：补运行时真实证据

- 给 `doctor` 增加可选 runnable probe
- 增加 host discovery / execution 的真实验证
- 增加针对“LLM 实际拿到什么”的输入一致性测试

### P3：收维护复杂度

- 清理旧控制面定位
- 缩减 mirror 真相源
- 改善老脚本可移植性

这套排序的关键变化是：

> 先补输入质量，再补输入消费边界，最后才补更多运行时证据。  
> 而不是先补更多 gate、更多状态、更多流程控制。

## 8. 对现有路线图的优化解释

[2026-04-18-spec-graph-bootstrap-optimization-roadmap.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/spec-graph-bootstrap/2026-04-18-spec-graph-bootstrap-optimization-roadmap.md) 的总体方向仍然正确，尤其是以下几点应保留：

- 区分 `assembly_status` 与 `evidence_status`
- 给 minimal context 补 `provenance / confidence / freshness`
- 让 human assets 成为事实投影层
- 收紧 `L0` 的“真实性前提”而不是只看文件存在

但在执行时，必须加上两条护栏：

1. `L0 / L1` 只能是**事实表达层级**，不能膨胀成执行审批流。
2. 任何新增字段都应该优先服务于 **LLM 更好地理解输入质量**，而不是服务于控制器更强地驱动流程。

## 9. 原则对齐后的最终判断

如果严格按 `轻 contract + 明确边界 + 让 LLM 决策` 来看，`spec-first` 当前最值得继续坚持的，不是它的 ceremony，而是它已经开始搭出来的这条主线：

- 不去幻想用强编排消灭不确定性
- 承认宿主与 LLM 仍有自由决策空间
- 用更高质量、更可解释、更可追踪的输入去提高判断质量

这条路线是对的。

当前真正需要优化的，不是把它做得更像 BPM、审批流或状态机，而是让它的关键输入层更配得上这条路线。

## 10. 一句收口

本次复审后的结论可以压缩成一句话：

> `spec-first` 后续所有质量整改，都应该优先增加“事实质量”，而不是增加“流程控制”。  
> 如果某项改动主要增加状态流转、审批分支或编排耦合，却没有明显提升输入真实性、来源清晰度、验证信号质量和 fallback 可见性，那就是错误方向。
