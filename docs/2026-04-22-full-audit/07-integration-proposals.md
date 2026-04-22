# 详细集成提案

## 提案 1：重写 `项目治理-agent.md` 的文档定位

### 问题定义

- 当前问题：文档是未跟踪草案，却以现行治理真源的口吻书写。
- 影响层：治理层、审计层、团队认知层。

### 事实依据

- 文档未被 git 跟踪。
- 仓内没有对应 workflow command / checker / schema。

### 哲学兼容性

- 符合 `Explicit boundaries`
- 不引入状态机
- 提升决策输入清晰度

### 最小集成路径

1. 文档首页加入：
   - `状态：draft`
   - `用途：审计操作手册`
   - `不是现行治理真源`
2. 新增“升级为治理真源的门槛”章节。
3. 等 P0 清单完成后，再决定是否升级。

### 收益与代价

- 收益：消除身份错位
- 代价：需要重写文案，但不需要改运行时代码

### 最终建议

- `立即做`

## 提案 2：为治理文档补一套 dual-host governance checklist

### 问题定义

- 当前文档没有覆盖当前仓库最真实的入口治理风险。

### 事实依据

- `setup` Codex 入口 drift
- `using-spec-first` 错路由 `spec-mcp-setup`
- 11 个 skill 命名漂移
- mirror drift
- agent reachability 不完整

### 哲学兼容性

- 符合 `Light contract`
- 属于显式边界补充，不是编排增强

### 最小集成路径

1. 在文档中新增 `Dual-Host Governance Checklist`
2. 最少包含：
   - 用户可见入口
   - route ownership
   - 命名一致性
   - mirror 一致性
   - agent reachability
3. 只要求列出检查项，不要求新增复杂执行引擎

### 收益与代价

- 收益：直接覆盖当前高频 drift
- 代价：维护清单，但成本低

### 最终建议

- `立即做`

## 提案 3：把 single-source-of-truth / freshness 审计项前置

### 问题定义

- 当前 control-plane 可信度缺口没有进入审计文档的显式检查面。

### 事实依据

- manifest 双语义
- ownership/review-queue sample 发布
- workspace readiness freshness 漂移
- sample/live drift

### 哲学兼容性

- 强化 `Light contract`
- 强化 `Explicit boundaries`
- 不替代 LLM 判断

### 最小集成路径

1. 在文档加入 `真相源与时效性检查`
2. 检查项固定回答：
   - 这个 artifact 的真相源是谁
   - 是否存在同名双语义
   - 是否由 sample 伪造
   - freshness 何时计算
3. 文档层先验证，再决定是否补 runtime checker

### 收益与代价

- 收益：提高 control-plane 可信度
- 代价：文档和 reviewer 需要多看几份 contract

### 最终建议

- `立即做`

## 提案 4：将 `doctor` 验证语义分层

### 问题定义

- 当前 `verified` 容易被误解为真实宿主 probe。

### 事实依据

- 当前依赖 runtime 资产 + evidence 文件推断。

### 哲学兼容性

- 符合“事实先于判断”
- 属于语义精炼，而不是流程增加

### 最小集成路径

1. 文档先改成两层：
   - `inferred verified`
   - `probed runnable`
2. 代码层后续再评估是否加可选 probe
3. 不把 probe 设为所有场景必跑

### 收益与代价

- 收益：避免误报
- 代价：术语略复杂，但更真实

### 最终建议

- `立即做文档`
- `代码侧实验化`

## 提案 5：把 prompt 正文锚点守卫收缩成结构化 metadata 试点

### 问题定义

- 当前 `plugin.js` 直接持有部分 prompt 正文锚点，耦合偏重。

### 事实依据

- Agent A 已确认 CLI 对多个 workflow 正文短语进行完整性检查。

### 哲学兼容性

- 直接扩大当前做法不兼容
- 先以 metadata 试点更兼容

### 最小集成路径

1. 只在少数高价值 workflow 试点
2. 用少量稳定 metadata 替代正文短语
3. 观察一轮，再决定是否推广

### 收益与代价

- 收益：减少语义耦合
- 代价：需要重新定义 metadata

### 最终建议

- `应实验化`
