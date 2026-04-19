# spec-first 项目全面分析报告

**分析日期**：2026-04-18  
**分析版本**：v1.5.1  
**分析视角**：顶尖软件工程审查专家 + AI Coding Workflow 架构师 + Specification Engineering 专家  
**分析方针**：偏向谨慎而非速度（caution over speed）

---

## 执行摘要

`spec-first` 是一个有明确架构意图的 AI 辅助开发工程化工具。它尝试把"对话式 AI 编程"收敛为"可治理的工程工作流"，这一核心定位是正确的。项目在工作流设计和模块分层上有显著优点，但在安全防护、接口规范化、文档完整性和错误处理上存在可观测的系统性缺口。

| 维度 | 评分 | 结论 |
|---|---|---|
| 架构设计 | 8/10 | 四层分工清晰，隐式契约是主要风险 |
| 代码质量 | 7/10 | 命名规范良好，但错误处理覆盖不全 |
| 工作流设计 | 7/10 | 契约详细，文档断裂和状态机模糊是隐患 |
| Specification Engineering | 7/10 | Schema 全面但版本管理缺失、Skill 间接口未形式化 |
| 双宿主适配 | 6/10 | 基本对称，但 Codex 侧复杂度不成比例 |
| 可观测性 | 7/10 | Telemetry 设计合理，但写入无保障、Doctor 结构分散 |
| 技术债务管理 | 8/10 | 近期修复了 5 个重大缺陷，记录充分 |
| 安全边界 | 6/10 | 文件操作缺原子性、symlink 防护缺失、权限处理粗糙 |

---

## 一、架构设计

### 优点

**1. 四层分工清晰**

项目按职责分为四个主模块，边界基本没有越权：

| 层 | 路径 | 职责 |
|---|---|---|
| CLI 治理层 | `src/cli/` (21 个文件) | 命令入口、平台适配、状态管理、资产同步 |
| 图分析引擎 | `src/crg/` (46 个文件) | AST 解析、图构建、社区检测、语义检索 |
| Bootstrap 编译器 | `src/bootstrap-compiler/` (19 个文件) | 工作流产物编译、manifest 生成、workspace 控制面 |
| 上下文路由 | `src/context-routing/` (14 个文件) | Stage-0 评估、injection-index 消费、token 预算裁剪 |

**2. Adapter Pattern 实现干净**

`src/cli/adapters/base.js` 定义 12 个方法/属性的统一接口，Claude 和 Codex 各自继承，init 逻辑与平台细节完全解耦。

**3. 上下文路由多层降级策略**

`src/context-routing/evaluator.js` 的 L0→L1→L2→L3 降级链（minimal-context → 固定集合 → 空回退）体现了"让系统在不完整上下文下仍可工作"的稳健设计思路。

**4. AI 决策输入原则贯彻**

CLAUDE.md 中明确的"轻 contract + 明确边界 + 让 LLM 决策"原则，在代码实现层面有对应：
- Verifier dispatch 是建议而非强制执行树
- Telemetry 只记录事实，不触发自动跳转
- context-routing 给模型提供分层上下文而不固化选择逻辑

### 问题

**P1. workspace 支持中存在隐式契约**

`src/bootstrap-compiler/workspace-registry.js` 第 62-95 行与 `run-bootstrap.js` 第 142-149 行之间，child slug 生成逻辑与 artifact anchor root 路径拼接存在隐式约定，未通过接口契约固化。若 slug 生成规则变更，两处需同步修改但没有编译期保障。

**P2. CRG 图数据层与分析层界线模糊**

- `analyze.js` 第 22 行：`STRUCTURAL_EDGE_KINDS` 常量在此处硬编码
- `graph.js` 中有相同语义的过滤逻辑
- 两处未抽取为 shared 常量，存在分叉风险

**P3. Verifier Registry 接口不对称**

- `src/context-routing/verifier-registry.js`（407 行）：定义 registry 结构与查询接口
- `src/bootstrap-compiler/compile-verification-profile.js`（399 行）：硬编码 test-browser/test-xcode 逻辑
- 两处在"验证器候选生成"上存在逻辑重复，不是单一事实源

**P4. `src/cli/index.js` 无显式依赖声明**

init 命令隐式依赖 13 个子模块（plugin.js、developer.js、state.js、adapters、lang-policy 等），没有依赖注入或注册机制，难以做单元 mock。

---

## 二、代码质量

### 优点

**1. 命名规范清晰**

函数名普遍清晰表述意图：
- `resolveSelectionRule()`、`buildOutputExistsMap()`、`evaluateContext()` ✓
- `createBatchBackup()`、`restoreBootstrapBackup()` ✓
- 文件名与职责高度对应

**2. 状态形状校验规范**

`src/cli/state.js` 第 78-101 行的 `validateManagedStateShape()` 提供详细的结构化错误信息，这是防止 state 静默腐化的有效防线。

**3. 读取容错设计**

`readState()` 第 16-25 行有 try/catch + 返回空 state 的 fallback，避免读取失败级联崩溃。

### 问题

**P5. `init.js` 文件操作无异常处理**

```js
// src/cli/commands/init.js 第 60-61 行（示意）
fs.mkdirSync(destDir, { recursive: true });
fs.writeFileSync(destPath, content);
```

若磁盘满、权限不足或 destPath 是目录，当前代码会抛出未捕获异常，用户看到的是 Node.js 堆栈而非可理解的错误信息。

**P6. `rollback.js` 的 `force: true` 淹没权限错误**

```js
// src/bootstrap-compiler/rollback.js 第 9-15、27-35 行（示意）
fs.rmSync(targetPath, { recursive: true, force: true });
```

`force: true` 会在 EACCES/EPERM 时静默忽略，导致回滚失败但调用方无感知。

**P7. 缩写与全称混用**

`cmd` vs `command`、`prev` vs `previous` 在 `src/cli/commands/init.js` 第 44-55 行附近混用，增加阅读摩擦。

**P8. devDependencies 严重不足**

`package.json` 显示 `devDependencies` 仅 1 个，而测试文件达 139 个，说明大量测试工具依赖被放在 `dependencies` 里，或依赖 peer 安装，存在生产包体积膨胀风险。

---

## 三、工作流设计（Skill 契约）

### 优点

**1. `spec-plan` 契约成熟度高**

- Stage-0 预载路径明确（always → stages → selection_rules → advice）
- Execution Readiness 质量维度独立成节
- 非软件任务路由分离，防止通用规划被绑定到软件范式

**2. `spec-work` 的 `change-surface` 规则防回填陷阱**

`skills/spec-work/SKILL.md` 明确说明 `change-surface` source 处理规则，避免执行阶段把计划阶段的产物误当作已验证事实。

**3. `spec-review` Mode 检测明确**

模式（interactive / headless）检测规则和参数令牌系统在 SKILL.md 中有清晰定义，减少运行时歧义。

**4. `spec-brainstorm` 反模式说明**

明确列出"This Is Too Simple"场景，防止工作流被滥用于不需要发散的任务。

### 问题

**P9. `spec-brainstorm` Phase 1 完全缺失**

`skills/spec-brainstorm/SKILL.md` 第 81 行之后直接从"Phase 0"跳到"Phase 2"，Phase 1 内容完全不存在。这是文档完整性的严重断裂，会导致执行时 LLM 跳过该阶段或自行填充不一致的行为。

**P10. Workflow 间交接契约缺失**

`spec-plan` 产出 `plan.md`，`spec-work` 消费 `plan.md`，`spec-review` 消费 work 产物——但这三个 skill 间没有形式化的交接接口定义。缺少 `docs/contracts/skill-interfaces/` 层，交接规则全靠 SKILL.md prose，脆弱且难以机器验证。

**P11. `spec-plan` 验证摘要消费规则语义复杂**

"不要把它解释成'已经自动完成验证'"这类 prose 规则容易被模型误解，尤其在 context 不足时。建议提取为显式的 `verification_status: pending | satisfied | blocked` 枚举字段。

**P12. `spec-work` 验证检查清单状态机未定义**

`pending-vs-blocked-or-satisfied` 三状态在 SKILL.md 中描述，但与 `evidence_items` 的关系没有状态转移图，存在歧义区间。

---

## 四、Specification Engineering

### 优点

**1. JSON Schema 设计有层次**

- `artifact-manifest.schema.json`：通过 `depends_on` 字段显式追踪产物依赖 ✓
- `verification-profile.schema.json`：平台 focus、verifier 候选、confidence 三字段结构清晰
- `skills-governance.schema.json`：双宿主覆盖，standalone_skill / dual_host 语义明确

**2. Contract 集中管理**

`docs/contracts/` 目录集中存放所有 CLI/API 契约 Schema，避免契约散落各处。

**3. Agent 定义带 Frontmatter**

每个 agent 的 SKILL.md 都有 `name`、`description`、`argument-hint` 前置 frontmatter，支持自动发现和 lint 守护。

### 问题

**P13. Schema 缺版本字段**

除 `artifact-manifest` 外，其余 schema 内容无 `$schema_version` 字段。当 schema 演进时，消费方无法区分新旧版本，难以做兼容性检查。

**P14. `skills-governance.schema.json` 约束不足**

```json
// src/cli/contracts/dual-host-governance/skills-governance.schema.json
"skill_name": { "type": "string" }  // 缺 maxLength
"host_delivery.codex": { "enum": ["command", "skill", "internal", "none"] }  // 缺 "plugin" 等值
// 顶层缺 "additionalProperties": false
```

**P15. Verification Contract 三层冗余**

`evidence.schema`、`gate-state.schema`、`dispatch` 三层都包含 `evidence_items`，但结构略有不同，没有单一规范定义，三处可能出现分叉。

**P16. Agent Capability Matrix 缺失**

没有形式化定义各 agent 的输入 token 上限、输出格式、失败处理协议。48 个 skills 的能力边界完全靠 prose 描述，无法机器校验。

---

## 五、双宿主适配（Claude vs Codex）

### 优点

**1. Adapter Pattern 保证了基础对称**

Claude 和 Codex 都继承 `base.js` 接口，runtimeRoot、commandRoot、stateFile 等核心属性有统一定义。

**2. Legacy 清理机制**

Codex 适配器定义 6 个 legacy 路径（legacyCommandRoot、legacyCodexSkillsRoot 等），保证跨版本升级时旧产物能被清理。

### 问题

**P17. Codex 适配复杂度不成比例**

- Claude 适配器：1 个 legacy 路径，`rewriteCanonicalAgentNamesForSkills()` 简单 strip prefix
- Codex 适配器：6 个 legacy 路径，`transformCodexContent()` 包含 6 处正则替换

这种不对称说明 Codex 侧积累了更多 workaround，而不是真正的平台差异导致的必然复杂度。

**P18. Codex Content 转换正则过于宽松**

```js
// src/cli/adapters/codex.js 第 177-179 行（示意）
@([a-z][a-z0-9-]*-(?:agent|reviewer|...))
```

Pattern 过宽，可能误匹配非 agent 引用（如邮件地址、markdown 链接中的 `@`）。

**P19. 双宿主同时 init 的冲突检测缺失**

没有测试用例覆盖 Claude 和 Codex 同时 init 同一目录的冲突场景（state.json 写入竞争）。

---

## 六、可观测性

### 优点

**1. Telemetry Schema 信息密度高**

`src/context-routing/telemetry.js` 记录 workflow、stage、profile、level、selected_assets、verification_summary、verifier_dispatch，足以重建一次执行的决策链。

**2. Doctor 检查点覆盖全面**

`src/cli/commands/doctor.js`（577 行）包含 20+ 项检查，分级输出（PASS/WARNING/ERROR），覆盖 platform-specific 和通用检查。

**3. State 向后兼容检查**

`state.js` 的 `isLegacyManagedState()` 保障旧版 state 可读，不会因版本升级导致 init 失败。

### 问题

**P20. Telemetry 写入无 error handling**

```js
// src/context-routing/telemetry.js 第 65 行（示意）
fs.writeFileSync(telemetryPath, JSON.stringify(record));
```

若磁盘满或路径不存在，直接抛异常，可能导致工作流执行中断。Telemetry 写入失败不应中断主流程。

**P21. 时间戳文件名映射不可逆**

```js
generatedAt.replace(/[:.]/g, '-')
// "2026-04-18T21:23:12.123Z" → "2026-04-18T21-23-12-123Z"
// "2026-04-18T21-23-12.123Z" 也会映射到相同结果
```

若时间戳本身含连字符，会产生文件名冲突。建议改用 `Date.now()` 或 UUID。

**P22. Doctor 检查逻辑缺 centralized registry**

577 行的 doctor.js 全部是 if/else 堆砌，没有注册式检查器机制，新增检查项只能继续堆砌，难以维护和测试。

**P23. State 写入无 journal 机制**

`state.json` 写入失败或中途崩溃后，无法恢复到上一个一致状态。建议使用 temp + rename 原子写入模式。

---

## 七、技术债务管理

### 优点（近期主动修复）

以下 5 个重大缺陷在 v1.6.0（2026-04-18）前已修复，说明项目有主动偿还债务的文化：

1. **CRG 算法 5 处正确性缺陷**：`surprising_connections` F3 cross_community 门控解除 + 阈值 30→40，in_degree/god_nodes 过滤修复
2. **stage0-workspace 回归**：freshness 聚合 `healthy` 误写成 `fresh`
3. **双宿主 Agent 引用未转换**：Claude runtime canonical 名称 regression
4. **workspace entry-resolver 相对路径 miss**：changedFiles 按 workspaceRoot 锚点解析
5. **rerun prune 逻辑**：`prunedChildSlugs` + `failedPrunes` 审计返回

**CHANGELOG 治理铁律**：CLAUDE.md 明确要求任何源码变动必须同步写 CHANGELOG，这是罕见的显式记录文化。

### 尚未解决的已知问题

来源：`docs/plans/` 目录（41 个计划文档）中的未完成项：

| 优先级 | 问题 | 计划文档 |
|---|---|---|
| 高 | Workspace mode 的完整 verify 覆盖（多仓聚合 validation 语义未定义）| 2026-04-16-014 |
| 高 | Verifier dispatch 与 AI dev quality gate 的编排语义（排他性冲突风险）| 2026-04-18-001 |
| 中 | Non-software brainstorm 参考实现完整性 | 2026-04-17-* |
| 中 | `spec-brainstorm` Phase 1 文档缺失（见 P9）| 未追踪 |

---

## 八、安全边界

### 优点

- CLI 主命令仅接受 3 个已知子命令，未知命令返回错误 ✓
- `--claude && --codex` 互斥检查 ✓
- `readState()` 有 try/catch + fallback，避免读取失败级联 ✓
- `developer.js` 对 lang 取值有枚举校验 ✓

### 问题

**P24. symlink 遍历无防护**

```js
// src/bootstrap-compiler/workspace-registry.js 第 62-95 行
discoverChildGitRepos()  // BFS 遍历
```

BFS 遍历时未检测 symlink，symlink 可能指向仓库外目录，在 monorepo 中存在路径逃逸风险。maxDepth=3 是 hardcode，无法配置。

**P25. 文件操作缺原子性**

bootstrap 产物写入（telemetry.js、run-bootstrap.js、rollback.js）均非原子操作，若中途崩溃会留下部分文件。建议关键写入使用 temp + rename 模式。

**P26. `rollback.js` 的 `force: true` 隐藏权限问题**

见 P6。生产场景下权限问题被静默忽略，会导致回滚后系统处于半清理状态。

**P27. CLI 尾部参数未校验**

```bash
spec-first init --claude /some/unexpected/path
```

`/some/unexpected/path` 会被 silent 忽略，而不是报错。可能导致用户误以为指定了目标路径。

**P28. state.json 无 integrity check**

state.json 被损坏（磁盘错误、手动编辑）后，虽然 `validateManagedStateShape()` 会报错，但 doctor 命令无法自动修复（只能提示用户），且没有 backup state 可以恢复。

---

## 九、测试覆盖评估

### 现状

- **139 个测试文件**（unit + integration + e2e + smoke）
- **覆盖类型**：contract 守护 + characterization + CLI smoke + 集成流程

### 覆盖优点

- `tests/unit/spec-*-contracts.test.js` 系列：工作流 SKILL.md 契约关键字段守护 ✓
- `tests/unit/crg-*.test.js` 系列：图分析引擎各层独立测试 ✓
- `tests/unit/dual-host-governance-contracts.test.js`：双宿主基本对称性守护 ✓
- `tests/unit/workspace-context.test.js`：workspace freshness 聚合守护 ✓

### 覆盖缺口

**C1. `surprising_connections()` 边界 case 测试薄弱**

`tests/unit/crg-analyze.test.js` 仅覆盖基本路径，未覆盖：
- F3 cross_community 独立加分与阈值 40 的临界场景
- peripheral_to_hub F4 confidence_weight 的权重组合
- 空图、全孤立节点、单社区等退化场景

**C2. 文件操作权限/原子性无单元测试**

`chmod`、`rmSync force:true`、`writeFileSync` 无权限失败路径的测试覆盖。

**C3. Codex 适配器转换正则无 fuzz 测试**

6 处正则替换（见 P18）无覆盖边界输入（特殊字符、空字符串、超长 agent 名称）的测试。

**C4. 双宿主同时 init 无并发测试**

见 P19。

**C5. `devDependencies` 只有 1 项**

大量测试工具（Jest 等）被列在 `dependencies` 中，生产安装包含开发工具，影响用户安装体积。

---

## 十、综合改进建议（按优先级）

### P0 — 立即修复（正确性 / 安全）

| # | 问题 | 位置 | 建议 |
|---|---|---|---|
| 1 | `spec-brainstorm` Phase 1 完全缺失 | `skills/spec-brainstorm/SKILL.md` | 补全 Phase 1 内容并加 contract 测试守护 |
| 2 | `rollback.js` force:true 淹没权限错误 | `src/bootstrap-compiler/rollback.js:9-35` | 改为 `force:false`，caller 处理 ENOENT |
| 3 | `init.js` 文件操作无异常处理 | `src/cli/commands/init.js:60-61` | 包裹 try/catch，输出用户可理解的错误 |
| 4 | Telemetry 写入无 error handling | `src/context-routing/telemetry.js:65` | try/catch 包裹，失败时 log warning 不中断流程 |

### P1 — 短期修复（稳定性 / 可维护性）

| # | 问题 | 建议 |
|---|---|---|
| 5 | STRUCTURAL_EDGE_KINDS 双重定义 | 提取到 `src/crg/constants.js` 统一管理 |
| 6 | 时间戳文件名不可逆映射 | 改用 `Date.now()` 或 UUID |
| 7 | Schema 缺 version 字段 | 所有 contract schema 加 `$schema_version` |
| 8 | skills-governance schema 约束不足 | 加 `maxLength`、`additionalProperties: false` |
| 9 | state.json 无原子写入 | temp + rename 模式 |
| 10 | symlink 遍历无防护 | `discoverChildGitRepos()` 加 `lstatSync` 检测 |

### P2 — 中期改进（架构 / 规范化）

| # | 问题 | 建议 |
|---|---|---|
| 11 | Workflow 间交接契约缺失 | 建立 `docs/contracts/skill-interfaces/` 层 |
| 12 | Verifier Registry 接口不对称 | 统一为单一事实源 |
| 13 | Doctor 检查器无注册机制 | 重构为数组 + `runCheck()` 模式 |
| 14 | Agent Capability Matrix 缺失 | 定义 agent capability schema |
| 15 | workspace 隐式契约 | 提取 `WorkspaceContract` 接口 |

### P3 — 长期优化（工程成熟度）

| # | 问题 | 建议 |
|---|---|---|
| 16 | devDependencies 仅 1 项 | 整理依赖分类，降低生产包体积 |
| 17 | Codex 适配复杂度不成比例 | 审计 legacy workaround，评估是否可简化 |
| 18 | CLI 尾部参数未校验 | 加 strict mode 参数解析 |
| 19 | surprising_connections 边界测试 | 补充 F3/F4 权重组合 + 退化场景用例 |
| 20 | Codex 转换正则 fuzz 测试 | 加 property-based 测试覆盖边界输入 |

---

## 附录：关键文件速查

| 文件 | 行号参考 | 问题类型 |
|---|---|---|
| `src/bootstrap-compiler/run-bootstrap.js` | 142-149 | 隐式 workspace 契约 |
| `src/cli/commands/init.js` | 60-61 | 文件操作无异常处理 |
| `src/bootstrap-compiler/rollback.js` | 9-15, 27-35 | force:true 淹没权限错误 |
| `src/context-routing/telemetry.js` | 65 | Telemetry 写入无保障 |
| `src/crg/analyze.js` | 22 | STRUCTURAL_EDGE_KINDS 重复定义 |
| `src/cli/adapters/codex.js` | 177-179 | 转换正则过于宽松 |
| `src/bootstrap-compiler/workspace-registry.js` | 62-95 | symlink 遍历无防护 |
| `skills/spec-brainstorm/SKILL.md` | Phase 1 节点 | 内容完全缺失 |
| `src/cli/contracts/.../skills-governance.schema.json` | 20-80 | Schema 约束不足 |

---

*本报告基于 v1.5.1 源码静态分析生成，行号为估算参考值，实际修复前请先 Read 文件确认。*
