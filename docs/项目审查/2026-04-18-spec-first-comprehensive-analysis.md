# spec-first 项目全面分析报告

**分析日期**：2026-04-18
**分析版本**：v1.5.1
**分析视角**：顶尖软件工程审查专家 + AI Coding Workflow 架构师 + Specification Engineering 专家
**分析方针**：偏向谨慎而非速度（caution over speed）

---

## 分析框架

本报告以项目自身核心哲学为首要评判准则：

> **轻 contract + 明确边界 + 让 LLM 决策**
> 优先提高 LLM 决策输入质量，不把质量门做成"多状态流转 + 强编排"的状态机。

评判轴分四类，重要程度不同：

| 评判轴 | 含义 | 与哲学的关系 |
|---|---|---|
| 系统可靠性边界 | 文件操作、安全防护、错误处理 | 硬约束，与哲学无关 |
| LLM 决策输入质量 | 上下文信号是否准确、清晰、新鲜 | 本项目的核心价值轴 |
| 不必要的编排耦合 | 固化执行路径、状态机、强绑定调用树 | 应主动避免 |
| 哲学漂移风险 | 项目是否在积累与核心原则相悖的复杂度 | 长期健康度信号 |

"缺少形式化接口定义"或"缺少 Agent Capability Matrix"这类传统工程标准，在本项目里不是有效的批评角度——加入这类约束会减少 LLM 判断空间，与项目哲学相悖。

---

## 执行摘要

| 维度 | 评分 | 核心结论 |
|---|---|---|
| 架构设计 | 8/10 | 四层分工清晰，隐式契约是主要风险 |
| 代码质量 | 7/10 | 命名规范良好，系统边界错误处理存在缺口 |
| Skill 契约质量 | 7/10 | 信息密度高，Phase 缺失和否定式 prose 降低决策输入质量 |
| Specification Engineering | 7/10 | Schema 全面，版本管理缺失，过度形式化风险初现 |
| 双宿主适配 | 6/10 | 基本对称，Codex 侧 legacy workaround 积累值得审计 |
| 可观测性 | 7/10 | Telemetry 设计合理，写入可靠性待加固 |
| 技术债务管理 | 8/10 | 近期主动修复 5 个重大缺陷，记录文化良好 |
| 安全边界 | 6/10 | 文件操作缺原子性，symlink 防护缺失 |

---

## 一、架构设计

### 架构亮点

项目按职责分为四个主模块，边界基本没有越权：

| 层 | 路径 | 职责 |
|---|---|---|
| CLI 治理层 | `src/cli/` | 命令入口、平台适配、状态管理、资产同步 |
| 图分析引擎 | `src/crg/` | AST 解析、图构建、社区检测、语义检索 |
| Bootstrap 编译器 | `src/bootstrap-compiler/` | 工作流产物编译、manifest 生成、workspace 控制面 |
| 上下文路由 | `src/context-routing/` | Stage-0 评估、injection-index 消费、token 预算裁剪 |

`src/cli/adapters/base.js` 定义统一接口，CLI 逻辑与平台细节完全解耦。`src/context-routing/evaluator.js` 的 L0→L1→L2→L3 降级链让系统在不完整上下文下仍可工作，且每层降级都给 LLM 留了判断空间而非硬编码补偿行为。

"让 LLM 决策"在控制面层面落实良好：Verifier dispatch 是建议而非强制执行树；Telemetry 只记录事实，不触发自动跳转；`injection-index.yaml` 的 `always / stages / selection_rules / advice` 分层把决策信号暴露给模型，而不是把决策本身硬编码进 pipeline。

### 架构问题

#### P1. workspace 隐式契约无编译期保障

`src/bootstrap-compiler/workspace-registry.js:62-95` 与 `run-bootstrap.js:142-149` 之间，child slug 生成规则与 artifact anchor root 路径拼接是隐式约定。若 slug 生成逻辑变更，两处需同步修改但没有任何保障机制。

#### P2. STRUCTURAL_EDGE_KINDS 双重定义

`src/crg/analyze.js:22` 与 `src/crg/graph.js` 中有相同语义的结构边过滤逻辑，未抽取到 `src/crg/constants.js`。两处独立演化会产生静默分叉。

#### P3. Verifier Registry 双重事实源

`src/context-routing/verifier-registry.js`（407 行）与 `src/bootstrap-compiler/compile-verification-profile.js`（399 行）在"验证器候选生成"上存在逻辑重复，不是单一事实源。

---

## 二、代码质量

### 代码亮点

函数名清晰表述意图：`resolveSelectionRule`、`buildOutputExistsMap`、`createBatchBackup`。文件名与职责高度对应。`state.js` 的 `validateManagedStateShape()` 有详细结构化错误信息，`readState()` 有 try/catch + fallback 降级。

### 代码问题

#### P4. `init.js` 文件操作无异常处理

`src/cli/commands/init.js:60-61` 附近的 `fs.mkdirSync` 和 `fs.writeFileSync` 无 try/catch。磁盘满或权限不足（`EACCES`/`EPERM`）时，用户看到的是 Node.js 堆栈而非可理解的错误信息。这是系统边界的可靠性问题。

#### P5. `rollback.js` 的 `force: true` 淹没权限错误

`src/bootstrap-compiler/rollback.js:9-15, 27-35`：`fs.rmSync({ force: true })` 在权限拒绝时静默忽略，导致回滚失败但调用方无感知。应改为 `force: false` 并在 caller 处理 `ENOENT`。

#### P6. devDependencies 仅 1 项

`package.json` 显示 `devDependencies` 仅 1 个，而测试文件达 139 个。大量测试工具放在 `dependencies` 里，用户生产安装体积不必要地膨胀。

---

## 三、Skill 契约质量（LLM 决策输入视角）

这是本项目最核心的评判维度。Skill 的 SKILL.md 不是 API 文档，而是 LLM 的决策上下文来源。评判标准只有一个：这段内容是否让模型做出更好的判断？

### Skill 契约亮点

`spec-plan` 的 Stage-0 预载路径清晰（always → stages → selection_rules → advice），降级策略明确，非软件任务路由分离——这些都是高质量决策输入的设计。`spec-work` 的 `change-surface` 规则防止执行阶段把计划产物误当已验证事实，是此类设计的典范。`spec-code-review` 的 mode 检测规则（interactive vs headless）减少了运行时歧义。

### Skill 契约问题

#### P7. `spec-brainstorm` Phase 1 完全缺失（高优先级）

`skills/spec-brainstorm/SKILL.md` 第 81 行之后直接从 Phase 0 跳到 Phase 2，Phase 1 内容不存在。这是 LLM 决策输入的严重缺口：模型拿不到该阶段的行为指引，只能自行填充，造成不可预测的执行差异。

#### P8. 验证摘要的否定式 prose 产生歧义

`spec-plan` 里"不要把它解释成已经自动完成验证"这类否定式禁令，在上下文不足时容易被误解。真正需要的不是把它换成枚举状态机（那是反模式），而是用更清晰的正向陈述替代否定禁令，给模型更确定的决策信号。

#### P9. 过度指令化风险初现

部分 SKILL.md（尤其 `spec-code-review`）的规则层数已较深：Mode 检测 → 参数令牌 → autofix class → reviewer catalog → Stage 4 model tiering → Stage 5 merge rules。暂时不是问题，但若继续堆叠，会从"提供决策上下文"滑向"替模型做流程编排"，触碰"多状态流转"反模式边界。需要持续关注。

#### P10. CRG 图分析到 LLM 决策质量的转化链路未验证

CRG 引擎（`surprising_connections`、`god_nodes`、社区检测）生成了丰富的图分析结果，但没有系统性评估：这些分析实际上是否提升了 `spec-code-review` 的代码评审决策质量？这是整个 Stage-0 投资回报的核心问题，目前缺乏可观测性。

---

## 四、Specification Engineering

### Schema 亮点

`artifact-manifest.schema.json` 通过 `depends_on` 字段显式追踪产物依赖，`verification-profile.schema.json` 的三字段结构（平台 focus、verifier 候选、confidence）清晰，`docs/contracts/` 目录集中管理所有契约 Schema 是良好实践。

### Schema 问题

#### P11. Schema 缺版本字段

除 `artifact-manifest` 外，其余 Schema 无 `$schema_version` 字段。Schema 演进后消费方无法区分版本，难以做兼容性检查。

#### P12. `skills-governance.schema.json` 约束过松

`src/cli/contracts/dual-host-governance/skills-governance.schema.json`：`skill_name` 缺 `maxLength`，`host_delivery.codex` enum 值不完整，顶层缺 `additionalProperties: false`。约束越松，contract 守护越弱。

#### P13. Verification contract 三层冗余

`evidence.schema`、`gate-state.schema`、dispatch 三处都有 `evidence_items`，结构略有不同，没有单一规范定义。会在演进时悄悄分叉。

#### P14. 警惕过度形式化的漂移方向

当前 contracts/ 层已有验证 profile、evidence、gate-state、dispatch 多层定义。如果继续向"agent capability matrix"、"skill interface contracts"等方向扩展，会把 LLM 判断空间切割成越来越小的格子——这与项目哲学相悖。演进时需要持续问：这个新 contract 是在提升 LLM 决策输入质量，还是在替 LLM 做决策？

---

## 五、双宿主适配

### 适配亮点

Adapter Pattern 保证基础对称，`base.js` 统一接口有效。legacy 清理机制保障跨版本升级时旧产物被清理。

### 适配问题

#### P15. Codex 侧适配复杂度不成比例

Claude 适配器：1 个 legacy 路径，agent 名称 strip prefix。Codex 适配器：6 个 legacy 路径，`transformCodexContent()` 包含 6 处正则替换。这种不对称通常意味着 Codex 侧积累了更多 workaround 而非真实平台差异。建议审计这 6 个 legacy 路径，明确哪些是平台必要，哪些是历史包袱。

#### P16. Codex content 转换正则过于宽松

`src/cli/adapters/codex.js:177-179` 附近的 agent 名称匹配 pattern 过宽，可能误匹配邮件地址或 markdown 链接中的 `@` 符号。

---

## 六、可观测性

### 可观测性亮点

`src/context-routing/telemetry.js` 记录 workflow、stage、profile、selected\_assets、verification\_summary、verifier\_dispatch，信息密度足以重建一次执行的决策链。`doctor.js` 的 20+ 项分级检查（PASS/WARNING/ERROR）覆盖全面。

### 可观测性问题

#### P17. Telemetry 写入失败会中断主流程

`src/context-routing/telemetry.js:65` 附近的 `fs.writeFileSync` 无 try/catch。磁盘满时会抛未捕获异常，中断工作流执行。Telemetry 写入失败不应影响主流程，应降级为 warning。

#### P18. 时间戳文件名存在冲突风险

`generatedAt.replace(/[:.]/g, '-')` 产生不可逆映射：若时间戳本身含连字符，多个不同时间戳可能映射到同一文件名。建议改用 `Date.now()` 拼接。

#### P19. `doctor.js` 检查器无注册机制

`src/cli/commands/doctor.js`（577 行）全部是 if/else 堆砌，无法以注册方式扩展新检查项，也难以单独测试某项检查。

#### P20. state.json 无原子写入

`src/cli/state.js` 写入 state.json 时非原子操作。中途崩溃后 state 损坏，doctor 能报告但无法自动恢复。

---

## 七、技术债务管理

### 近期主动修复（值得肯定）

v1.6.0 前修复了以下 5 个问题，说明项目有主动偿还债务的工程文化：

- CRG 算法 5 处正确性缺陷（`surprising_connections` F3 门控解除、in\_degree/god\_nodes 过滤、社区密度分母）
- stage0-workspace 回归（freshness 聚合 `healthy` 误写成 `fresh`）
- 双宿主 Agent 引用 canonical 名称未转换 regression
- workspace entry-resolver 相对路径 miss
- rerun prune 的 `prunedChildSlugs` / `failedPrunes` 审计返回

### 尚未解决的已知问题

来自 `docs/plans/`（41 个计划文档）中的未完成项：

| 优先级 | 问题 | 风险 |
|---|---|---|
| 高 | workspace 多仓聚合 validation 语义未定义 | workspace 用户无法信任 verify 结果 |
| 高 | verifier dispatch 与 AI dev quality gate 排他性冲突风险 | 两者同时触发时行为不确定 |
| 中 | `spec-brainstorm` Phase 1 缺失（见 P7） | LLM 执行不可预测 |

---

## 八、安全边界

### 安全亮点

CLI 主命令仅接受已知子命令，`--claude && --codex` 互斥检查，`readState()` 有 try/catch + fallback，`developer.js` 对 lang 取值有枚举校验。

### 安全问题

#### P21. symlink 遍历无防护

`src/bootstrap-compiler/workspace-registry.js:62-95` 的 `discoverChildGitRepos()` BFS 遍历未检测 symlink，可能在 monorepo 场景下遍历到仓库外目录。`maxDepth=3` 是 hardcode，无法配置。

#### P22. 文件写入缺原子性保障

bootstrap 产物写入（telemetry.js、run-bootstrap.js、rollback.js）均非原子操作，中途崩溃会留下不一致的部分文件。关键写入应使用 temp + rename 模式。

#### P23. CLI 尾部参数未校验

`spec-first init --claude /unexpected/path` 中的尾部参数会被 silent 忽略，用户误以为指定了目标路径。应加 strict 参数解析或明确报错。

---

## 九、改进建议（按优先级）

### P0 — 立即修复（正确性 / 可靠性）

| # | 问题 | 位置 | 建议 |
|---|---|---|---|
| 1 | `spec-brainstorm` Phase 1 完全缺失 | `skills/spec-brainstorm/SKILL.md` | 补全内容并加 contract 测试守护 |
| 2 | `rollback.js` force:true 淹没权限错误 | `src/bootstrap-compiler/rollback.js:9-35` | 改为 `force: false`，caller 处理 `ENOENT` |
| 3 | `init.js` 文件操作无异常处理 | `src/cli/commands/init.js:60-61` | 包裹 try/catch，输出用户可理解的错误 |
| 4 | Telemetry 写入失败中断主流程 | `src/context-routing/telemetry.js:65` | try/catch 包裹，失败降级为 warning |

### P1 — 短期修复（稳定性）

| # | 问题 | 建议 |
|---|---|---|
| 5 | STRUCTURAL_EDGE_KINDS 双重定义 | 提取到 `src/crg/constants.js` |
| 6 | 时间戳文件名冲突风险 | 改用 `Date.now()` |
| 7 | Schema 缺版本字段 | 所有 contract schema 加 `$schema_version` |
| 8 | `skills-governance.schema.json` 约束过松 | 加 `maxLength`、`additionalProperties: false` |
| 9 | state.json 无原子写入 | 改用 temp + rename 模式 |
| 10 | symlink 遍历无防护 | 加 `lstatSync` 检测，symlink 跳过或报警 |

### P2 — 中期（LLM 决策输入质量）

| # | 问题 | 建议 |
|---|---|---|
| 11 | 验证摘要否定式 prose 歧义 | 改为正向陈述，不换成状态机枚举 |
| 12 | CRG 到决策质量转化链路未验证 | 建立可观测指标（评审质量打分 vs 无 CRG 基线） |
| 13 | Verifier Registry 双重事实源 | 合并为单一来源，删除重复逻辑 |
| 14 | `doctor.js` 无注册机制 | 重构为数组 + `runCheck()` 扫描模式 |

### P3 — 持续关注（哲学一致性）

| # | 问题 | 建议 |
|---|---|---|
| 15 | Codex 侧 legacy workaround 积累 | 审计 6 个 legacy 路径，清理历史包袱 |
| 16 | spec-code-review 规则层数持续增长 | 每次新增规则前问：是提升决策输入质量，还是替 LLM 做编排？ |
| 17 | contracts/ 层过度形式化漂移风险 | 定期审查：新增 contract 是否真正提升 LLM 决策输入，而非切割判断空间 |

---

## 附录：关键文件速查

| 文件 | 行号参考 | 问题类型 |
|---|---|---|
| `src/bootstrap-compiler/rollback.js` | 9-15, 27-35 | force:true 淹没权限错误 |
| `src/cli/commands/init.js` | 60-61 | 文件操作无异常处理 |
| `src/context-routing/telemetry.js` | 65 | 写入失败中断主流程 |
| `src/crg/analyze.js` | 22 | STRUCTURAL_EDGE_KINDS 重复定义 |
| `src/cli/adapters/codex.js` | 177-179 | 转换正则过于宽松 |
| `src/bootstrap-compiler/workspace-registry.js` | 62-95 | symlink 遍历无防护 |
| `src/bootstrap-compiler/run-bootstrap.js` | 142-149 | workspace 隐式契约 |
| `skills/spec-brainstorm/SKILL.md` | Phase 1 节点 | 内容完全缺失 |
| `src/cli/contracts/.../skills-governance.schema.json` | 20-80 | Schema 约束过松 |

---

*本报告基于 v1.5.1 源码静态分析，行号为估算参考值，修复前请先读取文件确认。*
