---
title: GitNexus native crash resilience for spec-graph-bootstrap
type: feat
status: active
date: 2026-05-28
spec_id: 2026-05-28-001-gitnexus-native-crash-resilience
origin: /tmp/spec-first-incident-2026-05-28-gitnexus-native-crash-resilience.md
---

# GitNexus native crash resilience for spec-graph-bootstrap

## Summary

在不绕过上游 GitNexus race 的前提下，让 `spec-graph-bootstrap` 在面对 GitNexus 1.6.5/1.6.6-rc 系列 worker-pool race 暴露的 native abort（SIGABRT/Napi::Error）时具备可解释、可重试、可对齐的容错能力：扩展 `classify_provider_failure` 识别 SIGABRT/Napi 痕迹、按 crash 类失败做一次有限次自动 retry、在 raw log 极短时附加诊断快照、并新增一个 readiness aggregate 的实时聚合路径，让 workspace summary 与子仓 status 不再漂移。

---

## Problem Frame

`/spec:graph-bootstrap --all-repos` 在 GitNexus 1.6.5（PR #1833 修复，1.6.6-rc.76 已含；origin document 中以 1.6.6-rc.75 做的对照实验同样适用）下对中等规模 child repo 高概率触发 worker idle timeout terminate native parser frames 导致的 process-fatal abort。该事件链在 spec-first 一侧暴露 4 个 Harness 空洞：

1. **Evidence Harness** — `bootstrap-providers` 把 stdout+stderr 合并到 raw log，native abort 时 stderr 仅 91 字节就 std::terminate；落到 `status.json` 的 raw log 没有可推理信息。
2. **Governance Harness** — `classify_provider_failure` 仅识别 exit_code=139 (SIGSEGV)；SIGABRT (134) 和 Python wrapper 转的 250 都退化为 `provider-command-failed`，next_action 不可执行。
3. **Governance Harness** — `provider-crash` 失败 0 重试。race 是概率事件（同仓 6 跑 race 2 次），单仓 retry 1 次实测 100% 消化；当前用户必须手动单仓 rerun。
4. **Evidence Harness** — `compile-workspace-gitnexus-readiness` 读取的是 `workspace-graph-targets.v1` 快照而非子仓 `status.json` 实时聚合，导致子仓修复完成后 workspace summary 仍显示 partial / unavailable，状态漂移。

详细 incident replay、上游 PR/issue 引用、6/6 vs 4/6 对照实验和 raw log 快照在 origin document 中保留（见下方 Sources）。

---

## Requirements

- R1. 用户跑 `/spec:graph-bootstrap` 触发 GitNexus native crash 时，`status.json.failure_class=provider-crash`、`reason_code=gitnexus-analyze-sigabrt`、`recommended_action` 明确指向已知 1.6.5 race 与升级 pin 路径，且最近一次 retry 的 raw log 完整保留 — 用户无需翻 GitHub issue 即可定位真因。
- R2. crash 类失败（且仅 crash 类）在 bootstrap 内自动 retry，默认 1 次，可通过 env 覆盖；retry 仍失败时把首次和重试的 raw log 全部保留到 `command_results[]`，并通过 `attempt_role` 标记 `primary` / `crash-retry-N`。
- R3. raw log < 200 字节时，bootstrap 在不重跑 provider command 的前提下追加一次诊断快照（node 版本、npx 版本、`gitnexus --version`、stderr 关键字片段）到 `command_results[].diagnostics_capture`，不污染原 raw log。
- R4. 用户在子仓修复 GitNexus 后，无需重新触发 child analyze 也能让 workspace summary / `gitnexus-readiness.json` 与子仓 `status.json` 对齐。
- R5. `provider-status.v1` 和 `command_results[]` 的 schema 扩展全部向后兼容，下游 consumer（spec-work、spec-debug、spec-code-review、spec-plan、`compile-workspace-gitnexus-readiness`、`graph-provider-consumption.md` 文档）继续可读旧 artifact，新枚举值在文档中明确登记。
- R6. 双宿主一致：Bash 和 PowerShell 实现产出相同 schema 与 reason_code，相同 stub crash provider 在两宿主下行为可断言。

---

## Scope Boundaries

- 不在 spec-first 端尝试 patch 或绕过 GitNexus 上游 race；retry/分类只是容错，不试图掩盖真因。
- 不自动升级 GitNexus pin；pin 升级仍走 `docs/plans/2026-05-07-002-feat-gitnexus-evidence-governance-plan.md` 治理流程。
- 不实现持续监控 race 频率（如 telemetry/上报）；该方向边际成本陡升，留给独立 plan。
- 不引入对其他 provider 的通用 crash retry；本 plan 只覆盖 gitnexus，避免过早抽象。下游若需要相同能力再单立 plan 抽公共骨架。
- 不修改 GitNexus 自身 npm 包内容；不写 `.gitnexus/`。
- 不重新设计 incremental→full fallback 路径，retry 是新维度，与 incremental fallback 解耦（见 U2 Approach）。
- 不在 `27-004 mixed-topology plan` Scope Boundaries 已声明的 advisory `provider_runtime_advisory.crash_frequency` 字段范围内做覆盖；该字段仍是 27-004 的产物，本 plan 不读不写它。

---

## Graph Readiness

- target_repo: spec-first
- status: stale
- source_revision: 16b0cf203a10ac223a3a0112ffa6eea96f48896c
- current_revision: 待 plan 执行时由 `spec-graph-bootstrap` 重新校验
- stale: true（worktree dirty + bootstrap-providers.{sh,ps1} 已在 graph-affecting 列表中）
- primary_providers: [gitnexus]
- degraded_providers: []
- fallback_capabilities: bounded direct repo reads + 已读源文件
- runtime_mcp_evidence: not-evaluated（本 plan 阶段未调用 live MCP）
- confidence: high — 核心证据来自直接读源文件（`bootstrap-providers.sh`、`compile-workspace-gitnexus-readiness.js`、`provider-status.v1` 实例、`tests/unit/spec-graph-bootstrap.sh`）和 origin document 中 6/6 vs 4/6 实测对照
- limitations: graph-facts.json 的 graph-affecting 列表已包含本 plan 即将修改的 `bootstrap-providers.{sh,ps1}`；执行前建议 `/spec:graph-bootstrap` 重新刷新一遍，但本 plan 的设计不依赖图证据 — 所有断言均可由 LLM 直接读源验证

---

## Context & Research

### Relevant Code and Patterns

- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh:2111-2179` — `classify_provider_failure` 当前实现；新增 SIGABRT/Napi/SIGTERM 分支的延伸点。
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh:2181-2244` — `append_command_result` / `append_bootstrap_command_result`；schema 已经预留 `attempt_role` 字段（U2 直接复用，无需扩 schema）。
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh:2604-2643` — analyze 调用现场（incremental → full fallback 路径）；crash retry 应该挂在 full attempt 失败之后、`refresh_process_failed=true` 之前。
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1:1932` — PowerShell 端的 `classify_provider_failure` 等价实现，需要同步。
- `skills/spec-graph-bootstrap/scripts/compile-workspace-gitnexus-readiness.sh` + `src/cli/helpers/compile-workspace-gitnexus-readiness.js` — 当前从 `workspace-graph-targets.v1` 快照计算 readiness；U4 在此扩 `--from-child-status` 模式。
- `tests/unit/spec-graph-bootstrap.sh:65-92, 1335, 1781-1783` — 已有的 `make_fake_bin` + `FAIL_GITNEXUS_ANALYZE_SIGSEGV` 模板；新 stub 直接套用这套范式（新增 `FAIL_GITNEXUS_ANALYZE_SIGABRT`、`FAIL_GITNEXUS_NAPI_FATAL`、`FLAKY_GITNEXUS_ANALYZE_FIRST_N`）。
- `docs/contracts/graph-provider-consumption.md:74` — `command_results[].refresh_mode` 与 `command_results[].attempt_role` 已被声明为下游可消费字段；本 plan 在文档侧补 `attempt_role` 的合法值集合（`primary` / `crash-retry-N`）。
- `.spec-first/providers/gitnexus/status.json:113-126` — 真实 `command_results[].attempt_role: primary` 实例，确认字段已经在产线生成。

### Institutional Learnings

- `docs/plans/2026-05-27-004-feat-mixed-topology-broken-worktree-optimization-plan.md:79` — 已显式排除"GitNexus 1.6.5 native crash 兜底"，本 plan 与之互补且不重叠。
- `docs/plans/2026-05-07-002-feat-gitnexus-evidence-governance-plan.md` — pin 升级治理；本 plan 治理"pin 升级前的容错"。
- `docs/plans/2026-05-09-001-fix-graph-bootstrap-gitnexus-repair-preflight-plan.md` — gitnexus repair preflight；可借鉴的失败分类设计经验。

### External References

- 上游 PR：[GitNexus#1833](https://github.com/abhigyanpatwari/GitNexus/pull/1833) (2026-05-26 merge) — worker idle timeout race 修复
- 上游 issue：[GitNexus#1848](https://github.com/abhigyanpatwari/GitNexus/issues/1848) (OPEN, 2026-05-27 仍在更新)、[#1665](https://github.com/abhigyanpatwari/GitNexus/issues/1665) (CLOSED) — 多平台多次复现
- 上游修复版本：1.6.6-rc.76（截至 2026-05-28 的最新版本，含 PR #1833 修复）；origin document 用 1.6.6-rc.75 做了 6/6 通过的对照实验，rc.76 在同一修复线上

---

## Key Technical Decisions

- **Retry 仅识别 `failure_class: provider-crash`**：通用 retry 会掩盖真正命令失败（配置错误、权限错误、网络错误）；只在 process-fatal 类失败上做有限次重试，避免误伤可执行下游修复路径。
- **Retry 计数与 base sleep 通过 env 覆盖**：默认 1 次重试 + 2 秒 base sleep；用 `GRAPH_BOOTSTRAP_PROVIDER_CRASH_RETRY` (整数) 与 `GRAPH_BOOTSTRAP_PROVIDER_CRASH_RETRY_BASE_SLEEP_SECONDS` 控制。两个 env 的默认值在脚本顶部以 readonly 常量声明，避免下游意外覆盖；负数与非数字 fallback 到默认。
- **`attempt_role` 复用现有 schema 字段**：当前 schema 已经支持 `primary` 值，扩枚举到 `crash-retry-1`、`crash-retry-2` 等，自然向后兼容；不引入并行字段。
- **Diagnostics capture 不污染 raw log**：raw log 是 provider stdout+stderr 的可信镜像；诊断信息走新字段 `command_results[].diagnostics_capture`（结构化 object），保持 raw log 的"原始输出"语义。
- **`diagnostics_capture` 仅在 raw log 字节数 < 阈值且 exit_code != 0 时触发**：避免成功路径上无意义的 cost；阈值（默认 200）可通过 `GRAPH_BOOTSTRAP_DIAGNOSTICS_CAPTURE_RAW_LOG_BYTES` 调整。
- **Crash retry 与 incremental→full fallback 解耦**：incremental fallback 已经是"业务路径上"的兜底（incremental 失败转 full），它不应当被视为 crash；retry 只挂在最终的 full 调用失败之后；如果 incremental 调用 crash，先按现有逻辑落到 full，full crash 再触发 crash retry。
- **`compile-workspace-gitnexus-readiness` 新增独立模式 `--from-child-status`**：作为现有 `script` / `skill-prose` 的同级 mode（详见 U4），输入是子仓 status 文件列表（由 caller 列出，避免 helper 自行扫描文件系统）；workspace-targets snapshot 仍是 fallback。同级 mode 的好处：与现有 mode 隔离，不影响 `workspace-graph-targets.v1` 快照消费链路。
- **Git 行为信号识别 SIGABRT 跨平台 exit code**：macOS/Linux native abort 报 134（128+6），Python `subprocess` wrapper 的 npx 链路报 250（-6 转 unsigned 0xFA），共同表征同一信号；分类逻辑同时处理两个 exit code。
- **diagnostic 关键字白名单**：`libc++abi`、`Napi::Error`、`uncaught exception of type Napi`、`abort()` 任一命中即归入 `gitnexus-analyze-sigabrt`，不依赖 exit_code（防御不同 wrapper 把 SIGABRT 转成其他 code）。
- **Recommended action 文案显式提到 1.6.6+**：让 LLM/用户拿到 status.json 时不需要追溯 PR；reason_code 不写死版本号，文案承担版本提示职责，避免每次升级 pin 都改 reason_code 枚举。

---

## Open Questions

### Resolved During Planning

- 是否扩 `provider-status.v1` 到 `v2`？— 不需要。`failure_class`/`reason_code` 是开放枚举，新增值是兼容扩展；`attempt_role` 字段已在 schema 中并已写入 production status.json。文档侧（`docs/contracts/graph-provider-consumption.md`）补登记新枚举即可。
- retry 应该在 `bootstrap` 阶段还是 `status` 阶段？— 仅 bootstrap 阶段。`status`/`query_probe` 是诊断阶段，不是 race 触发面；强行 retry 会延长失败 latency。
- diagnostics_capture 是否应该跑 `gitnexus query` 复现 race？— 不应该。该 query 命中同一 worker pool 路径会再次触发 race（origin doc 第 4 段实验证据）；capture 限定为只读元数据采集（version、env），不重跑 provider command。
- workspace readiness 是否应该自动扫描所有子仓 status.json？— 不自动扫。helper 接受 caller 显式提供的子仓 status 路径列表，避免文件系统副作用、避免 graph-targets 之外的语义入侵。caller（脚本或 LLM 工作流）拥有"哪些子仓属于本次决策"的语义。

### Deferred to Implementation

- crash retry 之间是否需要 jitter？— 默认固定 sleep 即可；若 V3 集成测试显示 1 仓 retry 仍有概率连击 race，再追加 jitter（execution-time 信号驱动）。
- `diagnostics_capture` 的 stderr fragment 截取上界是多少？— 默认与 raw log 的 1024 字节同步，但实际值由实现时取舍 stub fixture 与真实 race 输出确定。
- PowerShell 端 `Start-Sleep -Seconds` 在 1.6.5 race 期间是否需要 `[GC]::Collect()` 类显式资源回收？— 优先简单 sleep；只有 V4 双宿主对照测试显示 Windows 上仍有概率连击 race 时再加。

---

## Implementation Units

### U1. classify_provider_failure 扩 SIGABRT / Napi / SIGTERM 识别（双宿主）

**Goal:** 让 `classify_provider_failure` 把 GitNexus native abort（SIGABRT 134/250、Napi 关键字、SIGTERM 143）识别为可执行的 `provider-crash` / `provider-terminated` 分类，next_action 文案明确指向已知 1.6.5 race 与升级 pin 路径。

**Requirements:** R1, R5, R6

**Dependencies:** None

**Files:**
- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh` (`classify_provider_failure` 函数体，~2117 起)
- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1` (`classify_provider_failure` 等价 PowerShell 函数，~1932 起)
- Test: `tests/unit/spec-graph-bootstrap.sh` (扩展 `make_fake_bin` 增加 SIGABRT/Napi/SIGTERM stub；新增分类断言)
- Test: `tests/unit/bootstrap-providers-powershell-contracts.test.js`（如已有 ps1 等价测试，沿用；否则在 .sh 测试里加 PowerShell 等价 case）

**Approach:**
- 复用现有 SIGSEGV 分支的 jq 输出结构，新增三个分支：
  - exit_code in {134, 250} 或 diagnostic 命中 `libc\+\+abi|Napi::Error|uncaught exception of type Napi|abort\(\)` 关键字白名单 → `failure_class=provider-crash`, `reason_code=gitnexus-analyze-sigabrt`
  - exit_code=143 (SIGTERM) → `failure_class=provider-terminated`, `reason_code=gitnexus-analyze-sigterm`
  - 关键字白名单优先于 exit_code 判断（防御 npx wrapper 把信号转码成不同 exit code）
- recommended_action 文案直接引用"已知 1.6.5 worker-pool race（PR #1833 在 1.6.6+ 修复），bootstrap 已自动 retry 一次（如适用），如 retry 仍失败请升级 pin 至 1.6.6+ 或单仓 rerun"
- PowerShell 端用 `-match` regex 与 `-in` 集合做等价匹配
- 不动 SIGSEGV / 124 / 网络 / lbug / 通用 fallback 分支顺序，新分支插在 SIGSEGV 之后、 124 之前

**Patterns to follow:**
- 现有 SIGSEGV 分支的 jq output shape（`failed_phase`, `failure_class`, `reason_code`, `exit_code`, `recommended_action` 五字段）
- `provider-storage-write-failed` 分支的 grep -Eiq 关键字匹配范式

**Test scenarios:**
- Happy path: stub 返回 exit_code=134 + 91 字节 stderr `libc++abi: terminating due to uncaught exception of type Napi::Error` → `failure_class=provider-crash`, `reason_code=gitnexus-analyze-sigabrt`, recommended_action 提及 "1.6.6"
- Edge case: stub 返回 exit_code=250 但 stderr 空 → 仍归 `gitnexus-analyze-sigabrt`（exit_code 已足够）
- Edge case: stub 返回 exit_code=1 但 stderr 含 `Napi::Error` → 归 `gitnexus-analyze-sigabrt`（关键字优先）
- Edge case: stub 返回 exit_code=143 + stderr 空 → `failure_class=provider-terminated`, `reason_code=gitnexus-analyze-sigterm`
- Edge case: 现有 SIGSEGV (139) 路径不变 → 回归 `gitnexus-analyze-sigsegv`，原断言全部通过
- Error path: 普通 exit_code=1 + 普通 stderr → 仍走 `provider-command-failed` 兜底（不被新分支误命中）
- Integration: PowerShell 与 Bash 在同一 stub 输入下产出相同 reason_code 与 recommended_action 子串

**Verification:**
- `tests/unit/spec-graph-bootstrap.sh` 全部既有断言通过 + 新增 5 个分类断言通过
- `bootstrap-providers-powershell-contracts.test.js`（或扩展的 ps1 case）通过
- `node -c` 语法检查 + `bash -n` 通过

---

### U2. crash 类失败有限次自动 retry（双宿主）

**Goal:** 在 full bootstrap attempt 失败且 `failure_class=provider-crash` 时，按 env 配置自动 retry N 次（默认 1 次），retry 之间 base sleep N 秒；保留所有 attempt 的 raw log 与 `command_results[]` 条目，并通过 `attempt_role` 字段标记。

**Requirements:** R1, R2, R5, R6

**Dependencies:** U1（依赖 `failure_class=provider-crash` 的可识别）

**Files:**
- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`（在 ~2632-2643 full primary 执行块后插入 crash retry 循环；`incremental-fallback-full` 路径上的 fallback 调用同步处理）
- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`（PowerShell 等价 retry 循环）
- Test: `tests/unit/spec-graph-bootstrap.sh`（新增 stub `FLAKY_GITNEXUS_ANALYZE_FIRST_N=K`：前 K 次返回 SIGABRT，第 K+1 次返回 0；端到端验证 retry 行为）

**Approach:**
- 在脚本顶部以 readonly 常量声明默认值：`GRAPH_BOOTSTRAP_PROVIDER_CRASH_RETRY_DEFAULT=1`、`GRAPH_BOOTSTRAP_PROVIDER_CRASH_RETRY_BASE_SLEEP_SECONDS_DEFAULT=2`
- 用辅助函数 `resolve_crash_retry_config` 读 env override，做整数与非负校验，非法值 fallback 到默认
- 在 full attempt（无论是 primary 路径还是 incremental fallback 路径）的 RUN_EXIT_CODE != 0 后调用 `classify_provider_failure`；若 `failure_class=provider-crash` 且仍有 retry quota，sleep 后重跑相同 command；重跑前重置 raw log 路径到独立文件（`analyze.crash-retry-N.log`），避免覆盖前一次证据
- 每次 attempt 通过 `append_bootstrap_command_result` 单独写入 `command_results[]`，`attempt_role` 取值 `primary`（首次）或 `crash-retry-N`（N=1..M）
- retry 成功 → 走原有 `final_full_attempt_succeeded=true` 路径
- retry 耗尽仍失败 → 走原有 `refresh_process_failed=true` 路径，`failure_info` 取最后一次 attempt 的分类
- raw log 路径辅助：扩展 `provider_bootstrap_log_for_mode` 接受 attempt-suffix 参数，或在 caller 端拼接 `${bootstrap_log%.log}.crash-retry-${N}.log` — 实现时取更短一条
- PowerShell 端用 `for ($i=1; $i -le $retryCount; $i++)` 等价循环，sleep 用 `Start-Sleep -Seconds`

**Patterns to follow:**
- `incremental-fallback-full` 块（2613-2630）的 RUN_EXIT_CODE 检查 + 多次 `append_bootstrap_command_result` 调用
- `attempt_role` 已有的 `primary` / `fallback` 取值约定

**Test scenarios:**
- Happy path: stub 第 1 次 SIGABRT，第 2 次成功 → status=ready, `command_results[]` 包含两条 bootstrap entry，`attempt_role` 分别为 `primary` 和 `crash-retry-1`，最终 `failure_class=null`（成功路径）
- Edge case: `GRAPH_BOOTSTRAP_PROVIDER_CRASH_RETRY=2`，stub 前 2 次 SIGABRT，第 3 次成功 → 三条 bootstrap entry，`attempt_role` = primary / crash-retry-1 / crash-retry-2
- Edge case: `GRAPH_BOOTSTRAP_PROVIDER_CRASH_RETRY=0` → crash 立即 status=failed，零 retry，行为与现状等价
- Edge case: `GRAPH_BOOTSTRAP_PROVIDER_CRASH_RETRY=abc`（非法）→ fallback 到默认 1 次
- Edge case: `GRAPH_BOOTSTRAP_PROVIDER_CRASH_RETRY=-1`（负数）→ fallback 到默认 1 次
- Error path: stub 始终 SIGABRT → retry 耗尽后 status=failed, `command_results[]` 包含 1+default_retry 条 bootstrap entry，所有 raw log 文件落地，`reason_code=gitnexus-analyze-sigabrt`
- Error path: stub 第 1 次 SIGABRT，第 2 次普通 exit=1（非 crash）→ `attempt_role=crash-retry-1`，但 retry 不再继续（非 crash 失败立即终止），最终 `failure_class=provider-command-failed`
- Integration: incremental→full fallback 路径上，full attempt SIGABRT → retry 在 full attempt 上生效（不在 incremental 上），retry 成功后 `fallback_from_incremental=true` 与 `attempt_role=crash-retry-N` 同时存在
- Integration: PowerShell 与 Bash 同 stub 输入下产出 `command_results[]` 长度与 `attempt_role` 序列一致

**Verification:**
- 上述 8 个 scenario 端到端通过
- `command_results[]` 字段顺序、`attempt_role` 取值集合与 `docs/contracts/graph-provider-consumption.md` 文档登记一致
- 成功路径下 `bootstrap_fingerprint` 仍正确（最后一次 attempt 的状态，不被中间失败 attempt 干扰）

---

### U3. raw log 极短时附加 diagnostics_capture（双宿主）

**Goal:** 当 bootstrap exit_code != 0 且 raw log 字节数低于阈值（默认 200B）时，附加一次只读诊断快照（node 版本、npx 版本、`gitnexus --version`、stderr 关键字命中标记）到 `command_results[].diagnostics_capture`，不重跑 provider analyze command，不污染原 raw log。

**Requirements:** R3, R5, R6

**Dependencies:** U1（关键字命中标记复用 U1 的关键字白名单）

**Files:**
- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`（新增 `capture_provider_diagnostics` 辅助函数；在 `append_bootstrap_command_result` 调用现场判定阈值并调用 capture）
- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`（PowerShell 等价 capture）
- Test: `tests/unit/spec-graph-bootstrap.sh`（新增 stub 模拟 91 字节 stderr crash；断言 `diagnostics_capture` 字段存在与字段集合）

**Approach:**
- `capture_provider_diagnostics()` 输入：provider 名、原 raw log 路径、关键字白名单结果；输出：JSON object `{node_version, npx_version, provider_version, raw_log_bytes, raw_log_keyword_hits[], captured_at}`
  - `node_version`: `node --version 2>/dev/null || echo "unknown"`
  - `npx_version`: `npx --version 2>/dev/null || echo "unknown"`
  - `provider_version`: 仅对 gitnexus 调用 `npx -y gitnexus@${pinned_version} --version --no-update-notifier`（短命令，**不**触发 analyze worker pool；timeout 5s 兜底）
  - `raw_log_bytes`: `wc -c < "$raw_log"`
  - `raw_log_keyword_hits`: 数组，列出命中的关键字（`libc++abi`、`Napi::Error`、`abort()`、`SIGABRT`、`SIGSEGV`、`uncaught exception`）
- 触发条件：`exit_code != 0` 且 `raw_log_bytes < ${GRAPH_BOOTSTRAP_DIAGNOSTICS_CAPTURE_RAW_LOG_BYTES:-200}`；阈值通过 env 覆盖
- `append_bootstrap_command_result` 扩展可选 `diagnostics_capture` 参数；通过 `+ (if $diagnostics_capture != "" then {diagnostics_capture:$diagnostics_capture|fromjson} else {} end)` 合并到 entry
- 不写入 raw log 文件本身（保持 raw log 的"原始 stdout+stderr 镜像"语义）
- PowerShell 端用 `Get-Item ... | Select-Object Length`、`node --version`、`npx --version` 等价命令；timeout 用 `Start-Process` + `WaitForExit(5000)` 兜底

**Patterns to follow:**
- `append_command_result` 现有的 `+ (if $field != "" then {...} else {} end)` 可选字段合并范式
- `provider-storage-write-failed` 分支的 grep 关键字白名单语法

**Test scenarios:**
- Happy path: stub crash + 91 字节 stderr → `diagnostics_capture.node_version` 非空，`raw_log_bytes=91`，`raw_log_keyword_hits` 包含 `libc++abi` 与 `Napi::Error`
- Edge case: stub crash + raw log 500 字节（超阈值）→ 不附加 `diagnostics_capture` 字段
- Edge case: stub crash + raw log 199 字节（恰在阈值边界）→ 附加 `diagnostics_capture`
- Edge case: stub 成功 exit=0 + raw log 50 字节 → 不附加（成功路径不 capture）
- Edge case: `GRAPH_BOOTSTRAP_DIAGNOSTICS_CAPTURE_RAW_LOG_BYTES=0` → 永不 capture（开关）
- Error path: `node --version` 命令缺失 → `node_version=unknown`，capture 字段仍生成（不阻塞 status 写入）
- Error path: `gitnexus --version` 超时 5s → `provider_version=timeout`，capture 字段仍生成
- Integration: U2 retry 路径上每次 crash attempt 都独立 capture（每条 `command_results[]` entry 各自带自己的 `diagnostics_capture`）

**Verification:**
- 7 个 scenario 端到端通过
- `provider-status.v1` schema 文档（`docs/contracts/graph-provider-consumption.md`）登记新字段及触发条件
- 真实 GitNexus 1.6.5 race 复现一次后，status.json 中 `diagnostics_capture.raw_log_keyword_hits` 应至少包含 `Napi::Error`

---

### U4. workspace readiness 实时聚合模式（compile-workspace-gitnexus-readiness）

**Goal:** 给 `compile-workspace-gitnexus-readiness` 增加 `--from-child-status` 模式（与现有 `script` / `skill-prose` 同级），输入为 caller 显式提供的子仓 status.json 路径列表，输出与现有 `workspace-gitnexus-readiness.v1` 同 schema；让用户在子仓修复 GitNexus 后无需重跑 child analyze 也能让 workspace summary 与子仓 status 对齐。

**Requirements:** R4, R5

**Dependencies:** None（可与 U1-U3 并行；与 U2 retry 写入的子仓 status 路径形态兼容）

**Files:**
- Modify: `src/cli/helpers/compile-workspace-gitnexus-readiness.js`（增加 `from-child-status` mode 分支与 args parser）
- Modify: `skills/spec-graph-bootstrap/scripts/compile-workspace-gitnexus-readiness.sh`（薄 wrapper，无逻辑变化）
- Modify: `bin/spec-first.js` 或对应 internal command 注册点（如已有 `internal workspace-gitnexus-readiness` 子命令，扩 args；如无则新增 args 转发）
- Modify: `docs/contracts/workspace-gitnexus-consumption.md`（登记新 mode、入参、限制）
- Test: `tests/unit/workspace-gitnexus-readiness.test.js`（新增 mode 端到端 case）
- Test: `tests/unit/workspace-gitnexus-contracts.test.js`（schema 不变断言；新 mode 的 query_usability_counts 计算口径回归）

**Approach:**
- CLI 接受 `--mode from-child-status --child-status <repo:path/to/status.json> [--child-status ...]`，每条 entry 用 `repo:path` 形式显式声明子仓 id 与 status 文件路径，避免 helper 自行扫描
- 新 mode 与 `script` 互斥：从 child status 直接计算 `query_usability` / `freshness_state` / `query_usability_counts`，不读 `workspace-graph-targets.v1`；workspace-targets 仍通过 `--workspace-targets` 提供，仅用于 group/repo 元数据（topology、repo 列表对齐）
- 校验：每个 `--child-status` 必须存在、必须是 `provider-status.v1`、必须 `provider=gitnexus`；缺失/异常的子仓在输出中标 `query_usability=stale-advisory` + 在 limitations 列出原因，不让单子仓失败拖崩整体
- 输出 schema 不变（仍是 `workspace-gitnexus-readiness.v1`），但 `runtime_mcp_evidence` 字段标 `child-status-aggregate` 而非 `not-evaluated`，让下游知道这是实时聚合而非快照
- `--write-artifact` 在新 mode 下允许（与 `script` mode 行为一致），输出到 `.spec-first/workspace/gitnexus-readiness.json`
- `bootstrap-providers.sh --all-repos` 主路径不调用新 mode（避免循环：bootstrap 完成自然走 workspace-targets 链路）；新 mode 主要供"修复后单仓 rerun"或 LLM 主动重新对齐场景使用

**Patterns to follow:**
- 现有 `script` / `skill-prose` mode 的 args 校验互斥逻辑（`script-mode-mcp-input-forbidden` 等）
- `validateWorkspaceTargets` 与 `validateArtifactOutputPath` 的错误抛出 + reason_code 设计

**Test scenarios:**
- Happy path: 6 个子仓 status 全部 `query_ready=true` → 输出 `query_usability_counts.fresh-primary=6`，`group.status` 与现有逻辑一致，`runtime_mcp_evidence=child-status-aggregate`
- Happy path: 4 个子仓 ready + 2 个子仓 status 文件缺失 → 4 ready，2 个标 `stale-advisory` 并在 limitations 列出 missing 原因
- Edge case: `--child-status` 指向非 `provider-status.v1` 文件 → 报错 `invalid-child-status`，不污染输出
- Edge case: `--child-status` 指向的 provider 不是 gitnexus → 报错 `unsupported-child-status-provider`
- Edge case: 不传 `--child-status` 但 mode=from-child-status → 报错 `missing-required-option`
- Edge case: 同时传 `--mode from-child-status` 和 `--registry-list`/`--group-list` → 报错（互斥）
- Edge case: workspace-targets 列出 6 个子仓，但 caller 只提供 4 个 `--child-status` → 缺失的 2 个标 `stale-advisory`，不静默丢弃
- Integration: `--write-artifact` 写入 `.spec-first/workspace/gitnexus-readiness.json`，schema 与 `script` mode 输出可 diff 对齐
- Integration: 用同一组子仓在 `script` mode（读 workspace-targets 快照）与 `from-child-status` mode 下产出对比；当子仓真实 status 与 workspace-targets 快照一致时，两模式输出一致

**Verification:**
- 9 个 scenario 端到端通过
- `docs/contracts/workspace-gitnexus-consumption.md` 文档登记新 mode、`runtime_mcp_evidence` 取值、互斥规则
- `npm run test:unit` 全绿（含新 mode 与现有 mode 的回归）

---

### U5. 文档与下游消费者契约同步

**Goal:** 把 U1-U4 引入的新 reason_code 枚举值、新 attempt_role 取值、`diagnostics_capture` 字段、`from-child-status` mode 与 env 配置同步到下游契约文档与 CHANGELOG，让 spec-work / spec-debug / spec-code-review / spec-plan 在读旧 artifact 的同时能正确解释新字段。

**Requirements:** R5, R6

**Dependencies:** U1, U2, U3, U4（文档需要稳定的字段名与触发条件）

**Files:**
- Modify: `docs/contracts/graph-provider-consumption.md`（登记 `failure_class=provider-crash` 新增 reason_code、`attempt_role=crash-retry-N`、`command_results[].diagnostics_capture` 字段触发条件）
- Modify: `docs/contracts/workspace-gitnexus-consumption.md`（登记 `from-child-status` mode 与 `runtime_mcp_evidence=child-status-aggregate` 取值）
- Modify: `skills/spec-graph-bootstrap/SKILL.md`（如该文档列出 reason_code 集合，则同步；若仅作 prose 引用则补一条提示）
- Modify: `CHANGELOG.md`（新增条目，标 `(user-visible)`：`failure_class`/`reason_code` 新枚举对下游 LLM workflow 可见；作者从 `.claude/spec-first/.developer` 读取）
- Modify: `README.md` 与 `README.zh-CN.md`（如已存在 graph-bootstrap 故障容错说明则补 SIGABRT 路径；否则不动）

**Approach:**
- 先扫描每个文档，确认本 plan 覆盖到的字段与现状的差集
- 文档变更与代码变更**同 PR / 同 commit**（避免 source/runtime drift 造成下游 LLM 引用错误字段）
- CHANGELOG 条目使用仓库现行格式（参照 README.md 顶部或最近一条 entry）
- 如 `docs/05-用户手册/14-GitNexus-全流程执行分析.md` 中提到 race 兜底，则在该处补 cross-link

**Patterns to follow:**
- `docs/contracts/graph-provider-consumption.md` 现有的"字段 + 用途 + 反模式"三栏表格风格
- CHANGELOG.md 现有 `(user-visible)` 标记惯例

**Test scenarios:**
- Test expectation: none -- 纯文档变更，由 U1-U4 的代码 + 测试承担行为正确性；本 unit 的"测试"由 review 与下游消费者交叉验证（例如 spec-code-review 读 status.json 后能正确解释新枚举）

**Verification:**
- `docs/contracts/graph-provider-consumption.md` 登记新 reason_code、新 `attempt_role` 取值集合（`primary`、`crash-retry-N`）、`diagnostics_capture` 字段
- `docs/contracts/workspace-gitnexus-consumption.md` 登记 `from-child-status` mode 与 `runtime_mcp_evidence` 新取值
- CHANGELOG.md 含 `(user-visible)` 标记的新条目，作者字段对齐当前 host developer profile
- `npm run lint:skill-entrypoints` 通过（如 SKILL.md 有结构性变更）

---

## System-Wide Impact

- **Interaction graph:** `bootstrap-providers.{sh,ps1}` 的 `classify_provider_failure` 与 `append_bootstrap_command_result` 是 status.json 的唯一写入入口，本 plan 集中改这两处；下游 `spec-work`、`spec-debug`、`spec-code-review`、`spec-plan` 通过读 status.json 间接消费新字段；`compile-workspace-gitnexus-readiness` 是独立链路，U4 不与 U1-U3 直接耦合。
- **Error propagation:** crash retry 内的失败收敛到现有 `failure_info` 链路（最后一次 attempt 决定最终分类），`refresh_process_failed` / `incremental-and-full-failed` 上层逻辑不变；diagnostics_capture 任何子步骤失败（如 `gitnexus --version` 超时）都 fallback 为 `unknown`/`timeout` 字符串，不阻塞 status.json 落盘。
- **State lifecycle risks:** retry 之间 sleep 期间不持久化中间状态；中断（Ctrl-C / SIGTERM）走现有 trap 路径，已落地的 attempt raw log 文件保留；新增的 `analyze.crash-retry-N.log` 与原 `analyze.log` 共存，删除策略同既有 raw log。
- **API surface parity:** `provider-status.v1` 与 `workspace-gitnexus-readiness.v1` schema 不升版本号（开放枚举扩展 + 可选字段添加均是兼容变更）；下游消费者继续可读旧 artifact。
- **Integration coverage:** mock unit test 不能完全证明 native crash 在真实 1.6.5 worker pool race 下的 retry 行为；用 origin document 中已实测过的 race 路径在 V3 集成测试场景中做端到端验证。
- **Unchanged invariants:** `incremental → full` fallback 路径、`bootstrap_fingerprint` 计算、`query_probe` 链路、`host_instruction_normalization` 链路、`graph-bootstrap-result.v1` 上层 schema、`workspace-graph-targets.v1` schema、`provider-status.v1` 与 `workspace-gitnexus-readiness.v1` 的 schema_version 字段值均不变。

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| crash retry 在 race 仍未规避时反而拉长失败 latency | 默认 retry=1，base sleep=2s；env 可调 0 关闭；retry 仅对 crash 类失败生效，命令失败/网络/权限路径无 retry |
| diagnostics_capture 调用 `gitnexus --version` 触发同一 worker pool race | `--version` 是元数据短命令，不进入 analyze worker pool（origin doc 实验证据）；但仍以 5s timeout 兜底，超时即 fallback `timeout` 字符串 |
| `from-child-status` mode 与 `script` mode 输出在边界情况下产出不同的 group.status | U4 测试矩阵覆盖一致性场景；文档中显式声明：当子仓 status 与 workspace-targets 快照不一致时（即子仓刚修复但快照未刷新），新 mode 是更"实时"的，旧 mode 是更"快照"的，downstream 自行选择 |
| PowerShell 与 Bash 在 retry sleep / timeout 行为上有微差 | U1-U3 双宿主测试矩阵显式断言 reason_code、attempt_role 序列、`diagnostics_capture` 字段集合一致 |
| 1.6.6+ 升级 pin 后本 plan 的 SIGABRT 识别可能"显得不再必要" | reason_code 不写死版本号，文案承担版本提示；保留分类是"未来上游可能再回归"的兜底；不会引入死代码 |
| stub 测试通不过等价于真实 race 不存在 | V3 在执行阶段补一次"在 1.6.5 真实 race 上跑 retry 是否消化 race"的实测，作为 release acceptance 而非阻塞 plan |

---

## Documentation / Operational Notes

- 本 plan 不涉及配置文件迁移、env 默认值变化（默认 retry=1 是新增能力，不会改变成功路径行为）；现有用户升级到本 plan 后无感，crash 场景下行为变好。
- CHANGELOG 必须含 `(user-visible)` 标记（参照 CLAUDE.md changelog 治理段）；reason_code 与 attempt_role 新枚举对下游 LLM workflow 可见。
- runbook：crash retry 频繁触发 → 给用户的 next_action 提示升级 GitNexus pin（U1 的 recommended_action 文案承担此职责）；运维侧无新增告警/监控。
- 如未来再扩 retry 到其他 provider，预期至少抽 `resolve_crash_retry_config` + `capture_provider_diagnostics` 为通用 helper；本 plan 不预先抽，避免过早抽象。
- 测试 stub 命名规范：新增 stub env 一律 `FAIL_GITNEXUS_*` 或 `FLAKY_GITNEXUS_*` 前缀，与既有 `FAIL_GITNEXUS_ANALYZE_SIGSEGV` 保持一致。

---

## Sources & References

- **Origin document:** `/tmp/spec-first-incident-2026-05-28-gitnexus-native-crash-resilience.md`
- 相邻 plan: `docs/plans/2026-05-27-004-feat-mixed-topology-broken-worktree-optimization-plan.md`（Scope Boundaries 显式排除本 plan 范围）
- 相邻 plan: `docs/plans/2026-05-07-002-feat-gitnexus-evidence-governance-plan.md`（pin 升级治理）
- 相邻 plan: `docs/plans/2026-05-09-001-fix-graph-bootstrap-gitnexus-repair-preflight-plan.md`（失败分类设计参考）
- 关键代码:
  - `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`
  - `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`
  - `src/cli/helpers/compile-workspace-gitnexus-readiness.js`
  - `tests/unit/spec-graph-bootstrap.sh`
- 现有契约文档:
  - `docs/contracts/graph-provider-consumption.md`
  - `docs/contracts/workspace-gitnexus-consumption.md`
- 上游修复:
  - PR https://github.com/abhigyanpatwari/GitNexus/pull/1833
  - Issue https://github.com/abhigyanpatwari/GitNexus/issues/1848
  - Issue https://github.com/abhigyanpatwari/GitNexus/issues/1665
- 角色契约: `docs/10-prompt/结构化项目角色契约.md`（"Light contract + Explicit boundaries + Let the LLM decide"）
