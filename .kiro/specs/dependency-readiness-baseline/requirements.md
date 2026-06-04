# Requirements Document

## Introduction

本特性是已校准的 SCALE 集成路线图中第一个 P0 切片「可信交付基线（Dependency Readiness Baseline）」，覆盖版本线 v1.11（依赖就绪基线，facts 生产者）+ v1.12（Host Projection / Doctor 消费，facts 消费者）。两个版本必须作为**同一个 producer→consumer 切片**规划，因为父方案 §9.0.1 的 consumer gate 规定：v1.11 是使能基建（enabling infrastructure），其 deterministic 消费者是 `spec-first doctor`（一个 CLI 检查命令，不是 §6 named workflow），因此 v1.11 不得在 v1.12 doctor rollup 落地前单独宣称完成。

本切片绝大部分是**重构而非从零开发**。`skills/spec-mcp-setup/scripts/` 当前已具备 detect/verify/write-setup-facts/check-health/install-helpers/install-mcp/configure-host/detect-host/render-status-block 全套脚本（含 PowerShell 对等实现）；`install-helpers.sh` 已有 install-source provenance、mirror fallback、stage timeout、`SPEC_FIRST_BROWSER_HELPER_REQUIRED` browser opt-in，但 helper 列表与 required/baseline 逻辑仍**内联在脚本中**。`src/cli/commands/doctor.js`（约 491 行）当前把 `decision_input_health` 硬编码为 `'not_checked'`。`mcp-tools.json` 当前只管理两个 required MCP server：`sequential-thinking`、`context7`。

生产侧（v1.11）目标：把内联 helper 列表抽取为 `helper-tools-registry.v1` registry、新增 `tool-facts.v2` 兼容 normalizer、新增 configured dependency scan、新增 install safety lens、扩展 status renderer 与 workflow mode/argument 写入边界语义。消费侧（v1.12）目标：把 `doctor.decision_input_health` 从硬编码常量演进为消费 setup facts 的 deterministic rollup，并输出 `decision_input_health_basis`。

边界约束遵循 `spec-first` 当前 source/runtime 边界与「Scripts prepare, LLM decides」哲学：脚本只产 deterministic facts 与 reason_code，不做 provider 语义可信判断；本特性不重命名 source 目录、不引入 optional provider 具体实现、不交付 v1.13 verification/honest-closeout、不交付 governance lens。

> 设计阶段待定项：本文档引用的「setup facts freshness window」具体时长属于设计决策；验收以「超过配置窗口」这一可判定条件为准，不在需求阶段固化具体数值。

## Glossary

- **Spec_First**: `spec-first` Node.js CommonJS CLI 整体。
- **Init**: `spec-first init` 命令，负责 source-managed runtime projection。
- **Doctor**: `spec-first doctor` 命令，负责消费 setup facts 并输出 deterministic health rollup。
- **Runtime_Setup**: required harness runtime setup workflow，canonical 入口名 `$spec-runtime-setup` / `/spec:runtime-setup`，迁移期 deprecated alias `$spec-mcp-setup` / `/spec:mcp-setup`；source 实体路径在重命名 work 任务落地前保持 `skills/spec-mcp-setup/**` 现状。
- **Helper_Registry**: 新增 source 文件 `skills/spec-mcp-setup/helper-tools.json`，schema_version 为 `helper-tools-registry.v1`，描述 helper 的 deterministic readiness / install safety facts。
- **Setup_Scripts**: 从 Helper_Registry 派生 helper 列表的脚本集合，至少包含 `install-helpers`、`check-health`、`verify-tools`（及其 PowerShell 对等实现）。
- **Facts_Normalizer**: setup facts 兼容 normalizer（子方案 §4.1.1），读取 tool-facts.v1/v2 并输出 normalized projection。
- **Dependency_Scanner**: configured dependency scan（子方案 §4.7），把 runtime 会或可能调用的命令投影为 facts。
- **Install_Safety_Lens**: install safety lens（子方案 §4.2.1），对每个 registry item 输出安装风险字段。
- **Plan_Renderer**: read-only setup-plan renderer，消费 detect 结果并计算 `safety_result`、输出 planned operations / risk_flags / write set。
- **Status_Renderer**: 渲染 Runtime_Setup status table 的组件（现有 `render-status-block.cjs` 承载面）。
- **Tool_Facts**: 生成/本地 facts 文件 `.spec-first/config/tool-facts.json`（含 `tool-facts.v1` 与 `tool-facts.v2` 演进），由 Runtime_Setup 生产、Doctor 消费。
- **Profile**: 依赖/能力 profile，取值 `minimal` / `recommended` / `platform`（不使用 `team`）。
- **Scenario_Overlay**: 与 Profile 正交的场景能力开关，取值 `surface-ui` / `surface-data-security`。
- **Readiness_Status**: provider 机械新鲜度单字段，取值 `fresh` / `stale` / `degraded` / `not-run` / `unknown`（不使用 `unavailable`）。
- **Provider_Readiness**: `provider-readiness.v1` 合同（canonical 字段定义归父方案 §7.1），本特性只使用其 generic provider 槽位。
- **Decision_Input_Health**: `doctor --json` 字段，取值 `pass` / `warn` / `error` / `stale` / `missing` / `not_checked`。
- **Decision_Input_Health_Basis**: `doctor --json` 字段 `decision_input_health_basis`，machine-readable basis（canonical schema 见子方案 §5.3）。
- **Baseline_Blocking**: helper 字段，`true` 才会让 minimal Profile 进入 `action-required`；与 `required` 字段分离。
- **Consumer_Gate**: 父方案 §9.0.1 的基建消费侧验收门槛。

## Requirements

### Requirement 1: Helper 注册表抽取（helper-tools-registry.v1）

**User Story:** 作为 spec-first 维护者，我想把内联在 `install-helpers.sh` 中的 helper 列表与 required/baseline 逻辑抽取为单一 registry，以便 helper readiness 与 install 事实从同一 source 派生，避免 required / optional / baseline_blocking 口径漂移。

#### Acceptance Criteria

1. THE Helper_Registry SHALL 落盘为 `skills/spec-mcp-setup/helper-tools.json`，且其 `schema_version` 字段 SHALL 等于 `helper-tools-registry.v1`。
2. THE Helper_Registry SHALL 为每个 helper 条目提供字段：`id`、`kind`、`profiles`、`surface_overlays`、`baseline_blocking`、`required_for`、`recommended_for`、`demand_signals`、`detection`、`installation`、`safety`、`platform_required_tools`、`runner_kind`。
3. THE Helper_Registry SHALL 在每个 helper 条目的 `safety` 对象中提供字段：`risk_flags`、`source`、`source_repo`、`version_policy`、`review_required`、`install_effect`。
4. THE Helper_Registry SHALL 把 `required` 与 `baseline_blocking` 表达为两个独立字段。
5. WHEN Setup_Scripts 解析 helper 列表时，THE Setup_Scripts SHALL 从 Helper_Registry 读取 helper 条目，而非使用脚本内联列表。
6. THE Helper_Registry SHALL 把当前 `install-helpers.sh` 内联管理的 helper（至少包含 `agent-browser`、`gh`、`jq`、`vhs`、`silicon`、`ffmpeg`、`ast-grep` 及 `ast-grep` skill）登记为 registry 条目。
7. THE Helper_Registry SHALL 在每个 helper 条目通过 `runner_kind` 与 `platform_required_tools` 区分 shell 与 PowerShell 路径所需工具。

### Requirement 2: required 与 baseline_blocking 语义分离

**User Story:** 作为运行 setup 的开发者，我想让 minimal Profile 只在真正的 baseline blocker 缺失时才进入 `action-required`，以便不会被误导认为 minimal setup 必须安装 browser 等场景工具。

#### Acceptance Criteria

1. THE Helper_Registry SHALL 把 `agent-browser` 条目的 `baseline_blocking` 设为 `false`。
2. WHILE Profile 为 `minimal`，IF 一个 `baseline_blocking=true` 的 helper 检测为缺失，THEN THE Runtime_Setup SHALL 把该 helper 的 `result` 计为 `action-required`。
3. WHILE Profile 为 `minimal`，IF 一个 `baseline_blocking=false` 的 helper 检测为缺失，THEN THE Runtime_Setup SHALL 把该 helper 的 `result` 计为 `degraded` 或 `skipped`。
4. WHERE `surface-ui` overlay 处于激活状态，THE Runtime_Setup SHALL 把 `agent-browser` 升级为 required action。
5. WHERE 环境变量 `SPEC_FIRST_BROWSER_HELPER_REQUIRED` 等于 `1`，THE Runtime_Setup SHALL 把 `agent-browser` 升级为 required action。
6. WHILE Profile 为 `minimal`，IF `ast-grep` 检测为缺失且 `rg` 可用，THEN THE Runtime_Setup SHALL 把 `ast-grep` 的 `result` 计为 `degraded` 并记录可回退到 `rg`。

### Requirement 3: tool-facts.v2 兼容 normalizer

**User Story:** 作为 Doctor 与下游 workflow 的开发者，我想让消费端只读 normalized projection 而非某个历史 facts 版本的原始字段，以便 schema 演进时消费端解读保持一致。

#### Acceptance Criteria

1. WHEN Facts_Normalizer 读取 `tool-facts.v1`，THE Facts_Normalizer SHALL 把缺失的新字段填充为 `unknown`、`not-checked` 或 `not-applicable`。
2. THE Facts_Normalizer SHALL 把 `tool-facts.v2` 作为 `items[]`、`configured_dependencies[]`、`schema_capabilities[]` 的主要承载位置。
3. IF setup facts 的 schema 校验失败，THEN THE Facts_Normalizer SHALL 输出 reason_code `setup-facts-invalid`。
4. IF setup facts 不可读，THEN THE Facts_Normalizer SHALL 输出 reason_code `setup-facts-unreadable`。
5. IF setup facts 的 schema 版本无法识别，THEN THE Facts_Normalizer SHALL 输出 reason_code `setup-facts-schema-unsupported`。
6. THE Facts_Normalizer SHALL 将其输出限定为字段归一化与 reason_code 计算，不对 provider 内容是否可信做判断。
7. WHEN 相同输入 setup facts 被归一化两次，THE Facts_Normalizer SHALL 产生相同的 normalized projection（deterministic）。
8. IF setup facts 同时满足不可读与 schema 版本无法识别，THEN THE Facts_Normalizer SHALL 优先输出 reason_code `setup-facts-unreadable`。

### Requirement 4: Configured dependency scan（runtime 配置依赖扫描）

**User Story:** 作为开发者，我想让 setup 把 host 配置中会或可能调用的命令投影为 facts，以便 runtime 真实调用未声明工具时能在 setup/doctor 中被发现，而不是运行时才失败。

#### Acceptance Criteria

1. WHEN Dependency_Scanner 运行，THE Dependency_Scanner SHALL 扫描 MCP 配置、hooks、permission allowlist、setup scripts、verification commands 五类 surface。
2. THE Dependency_Scanner SHALL 把扫描结果写入 `tool-facts.v2.configured_dependencies[]`。
3. THE Dependency_Scanner SHALL 把每个 hook 的提取范围限定为命令名与来源路径。
4. IF 扫描遇到 hook 定义，THEN THE Dependency_Scanner SHALL 仅提取命令名与来源，不执行该 hook。
5. THE Dependency_Scanner SHALL 为每个 `configured_dependencies[]` 条目提供字段：`id`、`kind`、`source_path`、`command`、`args_shape`、`declared_tool_id`、`declared_status`、`dependency_status`、`configured_status`、`result`、`reason_code`。
6. IF 一个被配置调用的命令未在 registry 中声明，THEN THE Dependency_Scanner SHALL 把该条目的 `result` 计为 `action-required` 并输出 reason_code `configured-dependency-undeclared`。

### Requirement 5: Install safety lens

**User Story:** 作为运行 setup 的开发者，我想在 plan 与 apply 之间获得轻量安装风险判断，以便区分普通 missing tool 与高风险安装，并避免静默执行高风险安装。

#### Acceptance Criteria

1. THE Install_Safety_Lens SHALL 为每个 registry item 输出字段：`risk_flags`、`source`、`version_policy.pin_status`、`review_required`、`install_effect`。
2. THE Plan_Renderer SHALL 为每个安装项计算 `safety_result`，取值限定为 `safe`、`review-required`、`unsupported`、`blocked`。
3. THE Plan_Renderer SHALL 为每个 `safety_result` 输出对应的 `reason_code`（如 `global-install`、`unpinned-npx`、`installer-script`、`unknown-source`）。
4. WHERE `safety_result` 为 `review-required`，THE Plan_Renderer SHALL 在 status table 中显示该项的风险与安装命令。
5. WHERE `safety_result` 为 `unsupported`，THE Plan_Renderer SHALL 仅输出手动安装建议。
6. IF 某安装项缺少 source、版本、权限或平台边界信息，THEN THE Install_Safety_Lens SHALL 把其 `safety_result` 计为 `blocked`。

### Requirement 6: Workflow mode/argument 写入边界

**User Story:** 作为运行 Runtime_Setup 的开发者，我想清楚每个 mode 会不会写 setup facts、改 host config 或安装工具，以便在不同阶段安全地只读检测、规划或显式安装。

#### Acceptance Criteria

1. WHEN Runtime_Setup 以 `--check` 运行，THE Runtime_Setup SHALL 把操作限定为检测与打印当前状态，不写 setup facts、不改 host config、不安装。
2. WHEN Runtime_Setup 以 `--verify-only` 或 `--refresh-facts` 运行，THE Runtime_Setup SHALL 写 setup facts，并且不安装、不改 host config。
3. WHEN Runtime_Setup 以 `--plan` 运行，THE Runtime_Setup SHALL 生成 install/config plan，并且不安装、不改 host config、不写 setup facts。
4. WHEN Runtime_Setup 以 `--install` 运行，THE Runtime_Setup SHALL 写 host config 并安装 required helper。
5. WHILE Runtime_Setup 以 `--install` 运行，IF 某安装项的 `safety_result` 为 `blocked`，THEN THE Runtime_Setup SHALL 跳过该安装项。
6. WHILE Runtime_Setup 以 `--install` 运行，WHERE 某安装项的 `safety_result` 为 `review-required`，THE Runtime_Setup SHALL 在执行前展示该项风险。

### Requirement 7: Status renderer 输出

**User Story:** 作为运行 setup 的开发者，我想从统一的 status table 看到每个依赖的 readiness、安装与安全状态，以便判断下一步动作。

#### Acceptance Criteria

1. THE Status_Renderer SHALL 输出 status table，分区至少包含：Execution result、MCP servers、Helper tools、Provider tools、Host configured dependencies、Install safety、Project setup facts、Verification profile、Next steps。
2. THE Status_Renderer SHALL 为每个工具/依赖行输出字段：`id`、`kind`、`profile`、`required`、`baseline_blocking`、`dependency`、`configured`、`allowed`、`install`、`safety`、`result`、`reason_code`、`next_action`。
3. WHEN Runtime_Setup 以 `--check` 运行，THE Status_Renderer SHALL 渲染 status table 而不触发任何写入。

### Requirement 8: Init 不安装边界

**User Story:** 作为开发者，我想确认 `spec-first init` 只做 source-managed runtime projection，以便 init 不会意外安装依赖或生产 setup facts。

#### Acceptance Criteria

1. WHEN Init 运行，THE Init SHALL 把副作用限定为 source-managed runtime projection 与 managed state 写入。
2. WHEN Init 运行，THE Init SHALL 不安装 MCP server、helper CLI 或 provider。
3. WHEN Init 运行，THE Init SHALL 不写 `.spec-first/config/tool-facts.json`。
4. WHEN Init 运行，THE Init SHALL 不把 Helper_Registry 解析结果写入 managed runtime state。

### Requirement 9: Doctor decision_input_health rollup

**User Story:** 作为运行 doctor 的开发者，我想让 `decision_input_health` 从硬编码 `not_checked` 演进为消费 setup facts 的 deterministic rollup，以便从 doctor 看出 MCP/helper/provider readiness。

#### Acceptance Criteria

1. IF 未选择或未检测到 Claude / Codex host，THEN THE Doctor SHALL 把 `decision_input_health` 计为 `not_checked` 并输出 reason_code `no-host-selected`。
2. IF setup facts 缺失，THEN THE Doctor SHALL 把 `decision_input_health` 计为 `missing` 并输出 reason_code `setup-facts-missing`。
3. IF setup facts 不可读或 schema invalid，THEN THE Doctor SHALL 把 `decision_input_health` 计为 `error` 并输出 reason_code `setup-facts-invalid`。
4. IF required MCP/helper 缺失或 `baseline_ready=false`，THEN THE Doctor SHALL 把 `decision_input_health` 计为 `error` 并输出 reason_code `required-runtime-action-required`。
5. IF setup facts 的 `generated_at` 超过配置的 freshness window，THEN THE Doctor SHALL 把 `decision_input_health` 计为 `stale` 并输出 reason_code `setup-facts-stale`。
6. WHILE required runtime ready 且 setup facts fresh，IF 存在 optional provider/helper 缺失或 stale，THEN THE Doctor SHALL 把 `decision_input_health` 计为 `warn` 并输出 reason_code `optional-capability-degraded`。
7. WHILE required runtime ready 且 setup facts fresh 且无 optional 降级，THE Doctor SHALL 把 `decision_input_health` 计为 `pass` 并输出 reason_code `setup-facts-ready`。
8. THE Doctor SHALL 仅由 deterministic facts 汇总 `decision_input_health`，不由语义判断填充。
9. WHEN Doctor 读取 setup facts，THE Doctor SHALL 先经 Facts_Normalizer 归一化再计算 rollup。

### Requirement 10: decision_input_health_basis

**User Story:** 作为消费 `doctor --json` 的下游 workflow，我想获得 machine-readable 的 health basis，以便据 artifact refs、freshness 与 counts 做 advisory 判断。

#### Acceptance Criteria

1. THE Doctor SHALL 输出 `decision_input_health_basis` 字段，且其结构遵循子方案 §5.3 canonical schema。
2. THE Decision_Input_Health_Basis SHALL 包含字段：`reason_code`、`artifact_refs`、`schema_versions`、`freshness`、`required_action_count`、`degraded_count`、`skipped_count`、`configured_dependency_counts`、`provider_counts`。
3. THE Decision_Input_Health_Basis SHALL 在 `configured_dependency_counts` 中提供 `action_required` 与 `undeclared` 计数。
4. THE Decision_Input_Health_Basis SHALL 在 `provider_counts` 中提供 `missing`、`stale`、`fresh` 计数。
5. WHERE Doctor 输出 human-readable 形式，THE Doctor SHALL 在 JSON 中保留 `reason_code`、`artifact_refs` 与各类 counts。

### Requirement 11: Doctor 不安装/不写 host config 边界

**User Story:** 作为开发者，我想确认 doctor 只消费 facts 不产生副作用，以便 doctor 是安全的只读诊断命令。

#### Acceptance Criteria

1. WHEN Doctor 运行，THE Doctor SHALL 把操作限定为读取 facts 与输出 health rollup。
2. WHEN Doctor 运行，THE Doctor SHALL 不调用 `install-mcp` 或 `install-helpers --install`。
3. WHEN Doctor 运行，THE Doctor SHALL 不写 host config。
4. WHEN Doctor 运行，THE Doctor SHALL 不刷新 provider、不运行项目验证命令。

### Requirement 12: Provider 缺失/stale 不阻塞 minimal workflow

**User Story:** 作为在 minimal Profile 下工作的开发者，我想让 optional provider 缺失或 stale 不把 minimal workflow 推入 error，以便缺 provider 时仍能继续工作。

#### Acceptance Criteria

1. IF optional provider 的 Readiness_Status 为 `not-run` 或 `stale`，THEN THE Doctor SHALL 不仅因该 provider 而把 `decision_input_health` 计为 `error`。
2. WHILE Profile 为 `minimal`，IF optional provider/helper 缺失或 stale 而 required runtime ready，THEN THE Doctor SHALL 把 `decision_input_health` 计为 `warn`。
3. THE Doctor SHALL 仅报告 provider readiness 与 reason_code，把是否继续、降级、刷新或安装的决定留给用户与下游 workflow。

### Requirement 13: Provider readiness generic 槽位（provider-readiness.v1）

**User Story:** 作为 readiness baseline 的开发者，我想提供 generic 的 `provider-readiness.v1` 槽位而不绑定具体 provider 实现，以便 v1.11 baseline 不反向依赖 v1.16 的 CodeGraph/Graphify/GBrain 具体能力。

#### Acceptance Criteria

1. THE Provider_Readiness SHALL 使用单字段 `readiness_status`，其取值限定为 `fresh` / `stale` / `degraded` / `not-run` / `unknown`。
2. THE Provider_Readiness SHALL 把生命周期阶段表达为 `lifecycle` 对象内的独立布尔位，而非塞入 `readiness_status`。
3. THE Provider_Readiness SHALL 包含字段 `fallback`，用于表达 provider 不可用或 stale 时的 direct-source 回退方法与 reason_code。
4. THE Provider_Readiness SHALL 仅承载机械 readiness 与 fallback 事实，不写入 `advisory` / `evidence_candidate` / `confirmed_context` 等语义信任等级。
5. THE 本特性 SHALL 仅实现 generic provider 槽位，不实现 CodeGraph / Graphify / GBrain 的具体 provider 逻辑。

### Requirement 14: Honest-closeout 接口预留（tool-existence → not-run reason）

**User Story:** 作为后续 v1.13 honest-closeout 的开发者，我想让 v1.11 facts 暴露工具存在性检测结果作为未来 not-run reason 的读取点，以便 honest-closeout 能在不重复检测的情况下读取该子集。

#### Acceptance Criteria

1. THE Tool_Facts SHALL 为每个工具暴露工具存在性检测结果（installed / missing）。
2. WHERE 一个工具检测为缺失，THE Tool_Facts SHALL 暴露可被未来 honest-closeout 读取为 `not-run: missing_dependency` 依据的字段。
3. THE 本特性 SHALL 不交付 `honest-closeout.v1`、`verification-profile.v1` 或 `verification-run-summary.v1` 合同本身。

### Requirement 15: Consumer gate 验收

**User Story:** 作为切片负责人，我想以 doctor 消费 v1.11 facts 作为本切片的完成验收，以便满足父方案 §9.0.1「无消费方 = 不交付」并避免造出无人消费的 facts。

#### Acceptance Criteria

1. WHEN 选择了 host 且 v1.11 producer facts 存在，THE Doctor SHALL 由 setup facts 计算出 `decision_input_health` 值，而非返回此前硬编码的 `not_checked` 常量。
2. THE Doctor SHALL 作为 v1.11 readiness facts 的 deterministic consumer，把 `decision_input_health_basis.artifact_refs` 指向被消费的 setup facts 文件。
3. THE 本特性的完成验收 SHALL 要求 v1.12 doctor rollup 已落地并消费 v1.11 facts；在 v1.12 doctor consumer 落地前，v1.11 SHALL 不被宣称完成。

### Requirement 16: Regression guard（现状不回归）

**User Story:** 作为维护者，我想确保本切片不破坏现有已验证的 doctor 与 run-artifact 行为，以便内化改动安全落地。

#### Acceptance Criteria

1. WHEN Doctor 以 `--json` 运行，THE Doctor SHALL 仍输出 `workflow_runnability`，其取值属于 `{verified, simulated, not_verified}`，且 `workflow_runnability_basis` 字段不缺失。
2. THE Doctor SHALL 保持 verification evidence 的 7 天 freshness 阈值与 `fresh/stale/unknown/missing` 判定不变。
3. WHEN 同一 workspace 与 run-id 重复写入 run artifact，THE Spec_First SHALL 返回 `artifact-already-exists`（immutable 不被破坏）。
4. THE Spec_First SHALL 保持 `spec-work-run-artifact` 的 `script_confirmed`/`llm_asserted`/`provider_untrusted`/`direct_evidence_used` 四分区与 schema enum 不被新字段污染。
5. THE Spec_First SHALL 保持 generated runtime 路径（`.claude/`、`.codex/`、`.agents/skills/`）仍被 source refs 拒绝。
6. WHEN 运行 `npm test`（unit + smoke + integration），THE 测试套件 SHALL 全部通过。

### Requirement 17: 命名与路径 canonical 约束

**User Story:** 作为跨三份文档协作的维护者，我想让 profile、readiness、schema 归属遵循父方案 §0.4 总表，以便避免出现第二套路径或第二套词表。

#### Acceptance Criteria

1. THE Profile 字段 SHALL 仅取值 `minimal` / `recommended` / `platform`，不使用 `team`。
2. THE Readiness_Status 字段 SHALL 仅取 5 值 `fresh` / `stale` / `degraded` / `not-run` / `unknown`，不使用 `unavailable`。
3. THE Provider_Readiness SHALL 把 provider 生命周期表达为布尔位，不混入 Readiness_Status enum。
4. THE 本特性新增的每个 `*.v1` schema SHALL 只有一处 canonical 字段定义，且落盘到 `docs/contracts/**` 单一 schema source。
5. THE 本特性新增 schema 校验 SHALL 复用现有 `src/contracts/schema-validator.js` 的 `validateAgainstSchema()`，不自带第二套校验实现。

### Requirement 18: 双宿主 parity 与跨平台 runner

**User Story:** 作为同时使用 Claude 与 Codex 宿主、跨 macOS/Linux/Windows 的开发者，我想让 setup 在双宿主与 shell/PowerShell 路径下保持一致行为，以便 Windows 原生 PowerShell 路径不因 Bash-only 依赖失败。

#### Acceptance Criteria

1. THE Runtime_Setup SHALL 在 Claude 与 Codex 双宿主下提供对等的 detect / plan / verify / status 行为。
2. THE Helper_Registry SHALL 允许同一 helper 的 shell 与 PowerShell 路径声明不同的 `platform_required_tools`。
3. WHILE 运行于 Windows 原生 PowerShell 路径，IF `jq` 不可用，THEN THE Runtime_Setup SHALL 不因缺少 `jq` 而失败。
4. WHERE 运行于 Bash / Git Bash / WSL 路径，THE Runtime_Setup SHALL 把 `jq` 作为该路径的 required tool 检测。
5. THE 新增脚本逻辑 SHALL 同时提供 shell 与 PowerShell 对等实现，与现有脚本 parity 保持一致。
