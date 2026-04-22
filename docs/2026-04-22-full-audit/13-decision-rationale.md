# 主裁决理由

## 最终裁决摘要

### 事实层

- `docs/10-prompt/项目角色.md` 已明确仓库哲学基线。
- `docs/10-prompt/项目治理-agent.md` 与这套哲学同向。
- 该文档当前是 `git` 未跟踪草案，不是已提交治理真源。
- 仓内没有与其一一对应的 workflow command、contract schema 或自动检查器来强制执行其 full-audit 流程。
- 当前代码现实中还存在 dual-host governance、single source of truth、verification 语义、sample/live 漂移、review-context 越界等明确缺口。

### 判断层

- 该文档**不能以“现行治理真源”身份直接纳入基线**。
- 它的正确定位应是：
  - `应保留` 哲学与审计骨架
  - `应重构` 为“审计作战手册 / 候选治理草案”
  - `应强化` 前提与检查清单
  - `应轻量化` 理想化表述
  - `应删除` 与仓库现实不符的既成事实语气
  - `应实验化` 高成本全量审计流程

## 争议点与裁决理由

### 争议点 1：哲学是否有效

#### 事实层

- CLI、verification read model、fallback、CRG 内核等多处实现都与 `项目角色.md` 一致。

#### 裁决

- `应保留`

#### 理由

- 哲学没有被代码推翻。
- 问题出在治理落地与文档定位，而不是方向。

### 争议点 2：文档能否直接成为治理真源

#### 事实层

- 文档未被跟踪。
- 无配套 checker / schema / workflow entry。

#### 裁决

- `应重构`

#### 理由

- 真源必须可追踪、可版本化、可被仓库机制消费。
- 当前前提不成立。

### 争议点 3：文档是否缺少最关键的现实治理项

#### 事实层

- dual-host governance drift、mirror drift、agent reachability、sample/live 漂移、review-context 越界均已被代码审计证实。

#### 裁决

- `应强化`

#### 理由

- 这些都是当前仓库真实存在的治理风险，但文档未把它们显式写成必查项。

### 争议点 4：是否应默认强制 full audit / 多 Agent

#### 事实层

- 当前无配套 workflow/contract/checker。
- 执行成本高。

#### 裁决

- `应实验化`

#### 理由

- 直接制度化会把 aspirational playbook 变成强编排。
- 与 `Light contract / Let the LLM decide` 有冲突风险。

### 争议点 5：是否应接受当前 `doctor verified` 作为真实可运行证明

#### 事实层

- 当前只基于 runtime 资产与 evidence 文件推断。

#### 裁决

- `应轻量化` 当前表述
- `应强化` 语义分层

#### 理由

- 不应把推断性状态写成宿主级真实 probe 事实。

## 全局分类

### `应保留`

- `Light contract / Explicit boundaries / Let the LLM decide`
- `先 evidence 后 judgment`
- 多 Agent 审计骨架
- 输出分类、矩阵、路线图的结构化产出方式

### `应强化`

- 文档前提：真源必须已提交、可追踪、可版本化
- dual-host governance checklist
- single-source-of-truth / freshness checklist
- verification 语义分层
- 文档的“草案 / 真源”身份声明

### `应轻量化`

- 对 full audit、最佳实践辩论、多 Agent 的默认强制语气
- 对“关键链路已可验证”的理想化表述
- 对 prompt prose / 正文锚点做大范围 CLI 检查的倾向

### `应重构`

- 文档整体定位
- 文档结构中的治理清单与适用范围
- 对 review-context 越界、manifest 双语义、sample/live 漂移这类问题的审计条目

### `应删除`

- 任何暗示“仓库已全面按本文落地执行”的表述
- 任何暗示“未跟踪草案可直接充当治理真源”的隐含前提
- 任何把 `doctor verified` 等同于真实 probe 的表述

### `应实验化`

- full-audit workflow 的制度化入口
- 高成本 prompt 语义守卫
- 宿主级 runnable probe

## 优先级路线图

### P0

- 重写文档定位
- 加入治理真源前提
- 加入 dual-host governance checklist
- 拆分验证语义

### P1

- 加入 single-source-of-truth / freshness / review-context 越界检查项
- 修 setup/MCP setup route drift、命名漂移、mirror drift
- 处理 manifest 双语义、sample 发布、tests/contracts 接线、rollback 测试、release 白名单

### P2

- 试点 runnable probe
- 试点少量 workflow 的 metadata 守卫
- 试点 full-audit workflow

## 未采纳意见与原因

### 未采纳 1：直接升级为现行治理真源

- 原因：事实前提不成立

### 未采纳 2：把 full audit / 多 Agent 设为默认前置流程

- 原因：成本高，且易走向强编排

### 未采纳 3：扩大 CLI 侧 prompt 正文锚点检查

- 原因：会增强语义耦合，削弱显式边界

### 未采纳 4：继续把 `doctor verified` 当成真实可运行证明

- 原因：当前仅属推断，不是真实 probe

### 未采纳 5：一次性大重写全部问题

- 原因：问题分层明显，按 P0/P1/P2 分阶段收口更符合最小可维护方案

## 最终裁决

本次不建议立即将 `docs/10-prompt/项目治理-agent.md` 纳入正式治理基线。建议先按本审计文档完成 `P0` 与关键 `P1` 校正，把它从“高强度理想化草案”收口为“可追踪、可解释、能对准当前仓库现实的治理手册”，再决定是否升级为正式真源。
