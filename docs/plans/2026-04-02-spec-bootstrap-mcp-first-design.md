---
title: "spec-bootstrap MCP-first 改造技术方案"
type: design
status: proposed
date: 2026-04-02
origin: docs/brainstorms/2026-04-02-spec-bootstrap-mcp-first-requirements.md
---

# spec-bootstrap MCP-first 改造技术方案

## 概述

本文提出一套面向 `spec-bootstrap` 的职责重划与执行链改造方案，核心目标是把当前混杂在 `spec-bootstrap` Phase 1 中的“环境准备”职责前移到 `mcp-setup`，形成清晰的主链：

`/spec:mcp-setup` → 重启宿主 → `/spec:bootstrap`

改造后：

- `mcp-setup` 负责**环境级准备**：依赖、工具安装、MCP 配置、宿主级验证
- `spec-bootstrap` 负责**项目级准备与上下文生成**：项目激活、工具就绪探测、分析模式选择、PRD 生成、worker 执行

该方案不改变 `docs/contexts/<slug>/` 的产物结构，也不改变 backup / restore 与 worker ownership 的核心设计；重点修复的是工具探测和模式选择的错误边界。

## Problem Frame

当前 `spec-bootstrap` 的 Phase 1 存在一个根本问题：它把“工具存在”近似当成了“当前项目可用”。

这会导致以下假阳性：

- `abcoder` 二进制存在，但当前项目不一定能成功 parse
- `serena` MCP 已配置，但当前项目不一定已 activate
- `gitnexus` MCP 已配置，但当前项目不一定已建立索引
- MySQL MCP 可连通，但不一定连接到目标项目数据库

本次真实运行还暴露出更具体的问题：

- Java 项目的 `ABCoder` 失败根因不是“仓库过大”，而是首次解析时需要准备 JDT Language Server，且当前执行环境无法写入其默认下载目录
- `ABCoder` 在 `list_repos()` 返回空时，编排器仍继续使用猜测的 `repo_name` 调用 `get_repo_structure`
- `Serena` 探测顺序不合理，先报 “No active project” 再 activate，给用户暴露了不必要的中间错误
- 工具并行探测之间存在相互取消或污染结果的风险，导致单项失败放大为模式误判

## 目标

### G1. 明确职责边界

把工具安装与宿主配置从 `spec-bootstrap` 中抽离，交给 `mcp-setup`；`spec-bootstrap` 不再承担“临时装工具”的职责。

### G2. 用运行态就绪替代安装态检测

分析模式选择必须建立在 probe 成功之上，而不是建立在“命令存在”或“配置存在”之上。

### G3. 为 Java / ABCoder 增加前置条件校验

在进入 Full mode 前，对 Java 项目执行专门的 preflight，避免把权限失败、LSP 缺失、缓存目录不可写等问题误归因为“项目过大”。

### G4. 保持现有产物契约稳定

不改变 `spec-bootstrap` 的产物目录、worker 拆分、Phase 2/3 的 ownership、backup/restore 和 README 装配逻辑。

## 非目标

- 不重写 `spec-bootstrap` 为 v2 两阶段模型
- 不修改 `docs/contexts/<slug>/` 的固定文件集合
- 不修改数据库 worker 的 ER 文档格式
- 不在本方案中引入新的 MCP 工具
- 不把 `mcp-setup` 扩展成项目分析器

## 现状职责与问题

### 当前 `mcp-setup` 的职责

`mcp-setup` 目前已经覆盖以下能力：

- 依赖检测：`node`、`go`、`uv`、`jq`
- 工具安装：`ABCoder` 二进制、`Serena` / `GitNexus` / `Context7` / `Sequential Thinking` MCP 配置
- `~/.claude.json` 的增量写入、备份和并发安全
- 安装结果汇总

它当前停留在**安装态 / 配置态**，尚未验证“工具在当前宿主是否可启动并可用于具体项目”。

### 当前 `spec-bootstrap` 的职责过重

`spec-bootstrap` 当前同时承担了两类职责：

1. 环境准备
2. 项目分析与上下文生成

这带来两个后果：

- 用户心智混乱：不知道什么时候该先跑 `mcp-setup`
- 执行路径混乱：Phase 1 一边探测，一边尝试修环境，一边开始分析项目

## 设计原则

### P1. 先准备环境，再进入 bootstrap

`spec-bootstrap` 默认假设宿主已完成 `mcp-setup`。如果基础工具链未准备好，应该明确提示用户先运行 `/spec:mcp-setup`，而不是在 bootstrap 中隐式补装。

### P2. 安装态与就绪态分离

引入两层状态：

- `installed/configured`
- `ready`

只有 `ready` 才能进入 `Full` / `Enhanced` 模式选择。

### P3. 单项 probe 独立失败

任一工具 probe 失败不能取消其他 probe，也不能直接中断 bootstrap；失败应被结构化记录并驱动降级。

### P4. 错误原因必须可解释

对用户输出的不是原始探测异常，而是结构化原因，例如：

- `abcoder: ready=no, reason=java-jdt-cache-not-writable`
- `serena: ready=no, reason=project-not-activated`
- `gitnexus: ready=no, reason=repo-not-indexed`

### P5. 项目级就绪校验优先于模式声明

先验证项目是否 ready，再决定 `Full / Enhanced / Basic`，而不是反过来。

## 目标架构

### 阶段 1：`mcp-setup`

负责环境级准备，输出以下状态：

- `dependency_ready`
- `tool_installed`
- `mcp_configured`
- `host_verified`

这里的 `host_verified` 只验证“在当前机器 / 宿主中可启动”，不验证“对某个具体 repo ready”。

### 阶段 2：宿主重启

`mcp-setup` 改写 `~/.claude.json` 后，需要显式要求用户重启宿主。未重启时不得假设新 MCP 配置立即生效。

### 阶段 3：`spec-bootstrap`

负责项目级准备与上下文生成，新增一层前置检查：

- `project_tool_ready`
- `analysis_mode_selected`

然后才进入：

- Phase 1 分析
- Phase 2 PRD 生成
- Phase 3 worker 执行

## 详细方案

## 1. `mcp-setup` 改造

### 1.1 明确主链输出

`mcp-setup` 完成后，输出不再只说“工具已安装”，而是明确提示下一步：

1. 已完成宿主级准备
2. 需要重启宿主
3. 重启后执行 `/spec:bootstrap`

标准输出建议：

```text
✅ MCP Tools Setup Complete

Host readiness:
- dependencies: ready
- mcp config: ready
- tool binaries: ready

Next:
1. restart Claude Code
2. run /spec:bootstrap
```

### 1.2 新增 `verify-tools.sh`

新增脚本：`skills/mcp-setup/scripts/verify-tools.sh`

**职责范围：仅验证安装态 / 配置态，不尝试启动 MCP server。**

原因：`serena`、`gitnexus` 是 stdio MCP server，由 Claude Code 通过 MCP 协议拉起，不通过 CLI 直接交互。在 shell 脚本层面无法可靠地用 `--help` 或启动命令验证它们"在当前宿主可用"，且这类命令可能触发网络下载（非轻量）。真正的"MCP server 可调用"验证由 `spec-bootstrap` 在运行时通过实际 MCP 工具调用完成。

宿主级验证策略：

| 工具 | 验证方式 | 理由 |
|---|---|---|
| `abcoder` | `abcoder version` | 二进制可直接调用，轻量 |
| `serena` | `~/.claude.json` 中对应 mcpServer 配置存在 | MCP server 配置态验证即可；运行态由 spec-bootstrap 探测 |
| `gitnexus` | `~/.claude.json` 中对应 mcpServer 配置存在 | 同上 |
| `context7` | `~/.claude.json` 中对应 mcpServer 配置存在 | 同上 |
| `java`（可选） | `java -version` | 仅检测存在性，供 ABCoder Java preflight 参考 |

输出建议：

```json
{
  "abcoder": { "installed": true, "binary_ok": true },
  "gitnexus": { "configured": true },
  "serena": { "configured": true },
  "context7": { "configured": true },
  "java_runtime": { "present": false, "reason": "java-not-found" }
}
```

**注意**：`binary_ok=true` 和 `configured=true` 均属于安装态，不代表 MCP server 在当前宿主可用。可用性验证在 `spec-bootstrap` 的项目级 probe 中进行。

该脚本完成后，写入宿主状态标记文件（见 Section 1.3）。

### 1.3 宿主状态机与前置门检测

#### 状态机定义

`spec-bootstrap` 的前置门需要区分三个宿主状态：

| 状态 | 含义 | spec-bootstrap 行为 |
|---|---|---|
| `NOT_SETUP` | `mcp-setup` 从未执行过 | 提示用户先执行 `/spec:mcp-setup`，立即停止 |
| `SETUP_DONE_NOT_RESTARTED` | `mcp-setup` 已完成，但 Claude Code 尚未重启 | 提示用户重启 Claude Code，立即停止 |
| `READY` | `mcp-setup` 已完成且 Claude Code 已重启 | 继续进入项目级 readiness 检查 |

#### 状态记录：marker 文件

`mcp-setup` 完成后（`verify-tools.sh` 成功执行），写入：

```
~/.claude/spec-first/host-setup.json
```

内容：

```json
{
  "version": "1",
  "completed_at": "2026-04-02T10:00:00Z",
  "tools": {
    "abcoder": { "installed": true, "binary_ok": true },
    "gitnexus": { "configured": true },
    "serena": { "configured": true },
    "context7": { "configured": true }
  }
}
```

此文件的存在代表"mcp-setup 已执行"，与重启状态无关。

**写入失败处理**：若 `verify-tools.sh` 无法写入 `~/.claude/spec-first/host-setup.json`（目录不存在、权限不足等），脚本必须以非零 exit code 退出，并输出明确错误信息。`mcp-setup` 应将此视为宿主级失败，不得在未写入 marker 文件的情况下宣告 setup 完成。

#### 重启检测：以 MCP 工具可调用性为证明

Claude Code 重启后才会加载新写入的 `~/.claude.json` MCP 配置。因此：

- **若 MCP 工具可被正常调用** → 说明 Claude Code 已加载当前 MCP 配置，即已重启过
- **若 MCP 工具调用失败（tool not found / MCP server not available）** → 说明配置尚未生效，需要重启

spec-bootstrap 前置门的检测逻辑：

```
Step 1: 检查 ~/.claude/spec-first/host-setup.json 是否存在
  └─ 不存在 → 状态 NOT_SETUP → 阻断，提示 /spec:mcp-setup

Step 2: 执行轻量 MCP 可调用性探测，超时上限 10s（尝试调用任一已配置 MCP tool 的 ping 操作）
  └─ 调用失败或超时 → 状态 SETUP_DONE_NOT_RESTARTED → 阻断，提示重启 Claude Code
  └─ 调用成功 → 状态 READY → 继续

```

**轻量 MCP 探测建议**：调用 `context7` 的 `resolve-library-id` 或 `serena` 的 `get_current_config`，这两者不修改任何状态，调用开销小，适合作为 MCP 加载探针。

#### 注意事项

- marker 文件不能作为重启完成的凭据，只能作为"mcp-setup 是否执行过"的凭据
- 重启检测依赖 MCP 工具调用，因此必须在 Claude Code 会话中执行，不能在独立 shell 脚本中完成
- 若用户手动改过 `~/.claude.json` 导致 MCP 工具失效，状态会误判为 `NOT_RESTARTED`；这是可接受的误报，重启后会自行恢复
- marker 文件应在 `mcp-setup` 重新执行时覆盖更新，以便追踪最新安装状态

### 1.4 调整 `detect-tools.sh` 的语义

当前 `detect-tools.sh` 实际上检测的是“安装 / 配置存在性”，不应该再被描述为“Full mode 可用性检测”。

建议：

- 保留脚本
- 在 `SKILL.md` 中明确其语义是 `installed/configured`
- 不再把其结果直接用于 `spec-bootstrap` 的模式判定

### 1.5 Java 能力提示前移

对 `ABCoder` 增加文档说明：

- Java 项目 parse 依赖本地 Java 运行环境
- 首次 parse 可能需要准备 JDT Language Server
- 宿主级安装完成不代表 Java 项目级 parse 一定成功

如果 `java` 命令不存在，`verify-tools.sh` 应输出：

```json
{
  "abcoder_java_support": {
    "ready": false,
    "reason": "java-runtime-missing"
  }
}
```

这里仍不直接阻止 `mcp-setup` 成功，因为 TypeScript / Go / Python 项目不受影响。

## 2. `spec-bootstrap` 改造

### 2.1 改写 Phase 1 的前置语义

当前 `ABCoder auto-configuration` 语义太强，容易让 `spec-bootstrap` 继续承担安装器角色。

建议改成两层：

- `Host Readiness Check`
- `Project Tool Readiness`

只有 `Host Readiness Check` 通过后，才进入项目级 probe。

### 2.2 新增 `Project Tool Readiness` 小节

放在 Phase 1.3 开头，负责对目标项目做以下 probe。

#### Serena

检查顺序：

1. MCP 是否存在
2. 若当前无 active project，则先 activate 目标项目
3. activate 成功后，**验证 Serena 返回的 active project 路径与当前工作目录（`$CWD`）一致**；路径不一致时记录 `reason=serena-wrong-project-activated`，视为失败
4. 路径验证通过后，执行轻量操作，例如 `get_symbols_overview` 或 `search_for_pattern`

判定：

- 成功 → `serena.ready = true`
- 失败 → `serena.ready = false`，记录原因（`serena-activate-failed` / `serena-wrong-project-activated` / `serena-probe-failed`）

#### GitNexus

检查顺序：

1. MCP 是否存在
2. 当前 repo 是否已索引（通过轻量查询验证，如 `search_commits` 或 `get_file_history`）

判定：

- 已索引且可查询 → `gitnexus.ready = true`
- 查询返回空结果（repo 不在索引中）→ `gitnexus.ready = false`，`reason=repo-not-indexed`
- MCP 调用抛出异常 / 服务不可达 → `gitnexus.ready = false`，`reason=gitnexus-mcp-error`

两种失败的下游行为相同（均降级），但 reason 区分有助于用户排查是"repo 未提交索引"还是"MCP server 本身异常"。

**未索引时的处理策略**：

- `spec-bootstrap` **不等待索引完成**，直接判 `gitnexus.ready = false` 并降级
- 索引操作耗时不可控（从数分钟到数十分钟），不应阻塞 bootstrap 流程
- 用户提示应说明：当前 repo 未被 GitNexus 索引，Full 模式不可用；若需要 Full 模式，请先在 GitNexus 中完成 repo 索引，再重新运行 `/spec:bootstrap`
- `spec-bootstrap` 不主动触发 GitNexus 索引，该操作由用户在 GitNexus 中独立完成

#### ABCoder

完整检查流程：

```
Step 1: list_repos()
  └─ 返回该 repo → 已有 AST，直接进入 Step 4（probe 验证）
  └─ 返回空 → 尚未 parse，进入 Step 2

Step 2: 语言专项 preflight（见下文）
  └─ preflight 失败 → abcoder.ready = false，记录原因，退出
  └─ preflight 通过 → 进入 Step 3

Step 3: 触发 parse，等待完成（上限 60s）
  └─ 60s 内完成 → 进入 Step 4
  └─ 超时或 parse 失败 → abcoder.ready = false，reason=parse-timeout / parse-failed，退出

Step 4: 执行轻量结构验证
  ├─ list_repos() 确认 repo 可见
  ├─ 验证返回的 repo 根路径与当前工作目录（$CWD）一致；不一致 → ready=false，reason=abcoder-wrong-repo
  ├─ get_repo_structure 可返回
  └─ 以上全部通过 → abcoder.ready = true
  └─ 任一失败 → abcoder.ready = false，reason=repo-not-visible-in-abcoder 或 abcoder-wrong-repo
```

**parse 触发策略**：`spec-bootstrap` 在项目级 probe 阶段负责触发 ABCoder parse（若尚未 parse），以确保 Full 模式在首次运行时可达。这与 GitNexus 的策略不同——GitNexus 索引由用户外部完成，ABCoder parse 由 bootstrap 内部触发。

**parse 超时上限**：60s。超时不阻断整个 bootstrap，记录 `reason=parse-timeout`，降级处理。超时由 probe 外层计时器控制（记录开始时间，每次轮询时检查是否超限），不依赖 ABCoder 内部超时机制。

**JDT 冷启动风险**：Java 项目首次 parse 时，JDT Language Server 可能需要从网络下载，实际耗时可能超过 60s。60s 上限为"合理等待上限"，超时即降级，不因项目类型延长。需在用户提示中说明：Java 项目首次分析可能因 JDT 初始化超时而降级，建议在网络良好的环境重试。

#### Java 专项 preflight

对 Java 项目（Step 2）增加以下检查，在触发 parse 前执行：

- `java -version` 可执行
- `JAVA_HOME` 可解析或 Java 可自动发现
- JDT 缓存目录可写
- 首次下载 / 初始化所需目录可写
- （建议）网络可达性：轻量探测 JDT LS 下载源是否可访问；不可达时输出 `reason=jdt-network-unreachable` 并降级，不等待超时

若任一条件失败，必须输出明确 reason，例如：

- `java-runtime-missing`
- `java-home-missing`
- `jdt-cache-not-writable`
- `jdt-download-failed`

不得再使用”项目过大”作为默认解释。preflight 失败直接判 `abcoder.ready = false`，不触发 parse。

### 2.3 改写模式选择算法

新算法：

```
if gitnexus.ready == true AND abcoder.ready == true:
    mode = Full
elif serena.ready == true:
    mode = Enhanced
else:
    mode = Basic
```

**歧义情况说明**：当 `abcoder.ready == true` 但 `gitnexus.ready == false` 时，模式为 `Enhanced`（因不满足 Full 条件）。此时 ABCoder 能力**仍可在 Enhanced 模式下使用**——Enhanced 模式不排除 ABCoder，只是缺少 GitNexus 索引覆盖。分析模式的上限是 `Full`（需要 GitNexus + ABCoder），而非下限。

各工具在不同模式下的使用关系：

| 工具 | Full | Enhanced | Basic |
|---|---|---|---|
| GitNexus | ✅ 必须 ready | ❌ 不可用 | ❌ 不可用 |
| ABCoder | ✅ 必须 ready | ✅ 若 ready 则使用 | ❌ 不使用 |
| Serena | ✅ 若 ready 则使用 | ✅ 必须 ready | ❌ 不使用 |

这里的关键是：

- 只接受 `ready`，不接受仅 `installed` 或”配置存在但 probe 未做”
- Enhanced 模式下 ABCoder 的可用性取决于 probe 结果，不影响模式判定本身
- 模式决定**最低可用工具集**，不排除附加工具

**Basic 模式行为**：当所有 ready 工具 probe 均失败（Serena、GitNexus、ABCoder 均不可用）时进入 Basic 模式。Basic 模式下：
- 不使用任何 MCP 工具进行代码结构分析
- 依靠 `Read`、`Grep`、`Glob` 等通用文件系统工具对项目进行浅层分析
- 生成的 PRD / 上下文产物质量较低，不包含跨文件调用链、历史 commit 语义、完整类型图等深度信息
- 用户提示应明确说明当前为 Basic 模式及其局限性

### 2.4 增加 `repo_name handshake`

任何 ABCoder API 调用必须遵循以下顺序，禁止用目录名猜测 `repo_name`：

1. 调用 `list_repos()`
2. 从返回结果中选取真实 `repo_name`
3. 再用该 `repo_name` 调用 `get_repo_structure` / `get_file_structure`

**`list_repos()` 返回空的两种情形及处理**：

| 时机 | 含义 | 处理 |
|---|---|---|
| probe Step 1（parse 前首次调用） | 项目尚未 parse | 进入 preflight → 触发 parse 流程（见 Section 2.2） |
| probe Step 4（parse 完成后再次调用） | parse 成功但 repo 不可见，或 parse 失败 | `abcoder.ready = false`，`reason=repo-not-visible-in-abcoder`，降级，不继续调用后续 ABCoder API |

**在任何情况下**，Step 4 的 `list_repos()` 仍为空时，才终止调用链。Step 1 的空结果不直接触发失败。

### 2.5 探测执行模型改为 best-effort

工具 probe 应并行，使用 **all-settled 语义**：等待所有 probe 完成（成功或失败），不因任一 probe 失败而取消其余 probe。

要求：

- 每个 probe 单独捕获成功 / 失败，互不影响
- 所有 probe 完成后再进行模式选择
- 汇总时按工具维度输出
- 任一 probe 的失败不得取消其他 probe
- ABCoder parse（Step 3）的等待不阻塞 GitNexus 或 Serena 的 probe

### 2.6 用户可见输出改造

把原始异常折叠成能力报告：

```text
🔍 检测分析工具...

GitNexus: detected=yes, ready=no, reason=repo-not-indexed
ABCoder:  detected=yes, ready=no, reason=jdt-cache-not-writable
Serena:   detected=yes, ready=yes, project=qianxi-wx-plat

📊 分析模式: Enhanced
```

这样用户能理解降级原因，但不会被中间错误栈污染。

## 3. `mcp-setup → spec-bootstrap` 的契约

### 3.1 环境级契约

`mcp-setup` 对 `spec-bootstrap` 提供以下保证：

- 基础依赖已准备
- MCP 配置已写入
- 宿主级命令可启动

不保证：

- 当前项目已被 Serena activate
- 当前项目已被 GitNexus 索引
- 当前项目已被 ABCoder 成功 parse

### 3.2 项目级契约

`spec-bootstrap` 对自身后续 Phase 2/3 提供以下保证：

- 已完成目标项目激活
- 已完成工具就绪探测
- 已选定分析模式
- PRD 中声明的 `Tools Available` 基于真实 ready 状态，而不是安装态

## 4. 失败分类与降级策略

### 4.1 宿主级失败

包括：

- 缺少 `node` / `go` / `uv` / `jq`
- `~/.claude.json` 写入失败
- `abcoder` 安装失败
- `serena` / `gitnexus` 配置失败

处理：

- 由 `mcp-setup` 处理
- 未修复前 `spec-bootstrap` **必须阻断**，不得进入任何项目级 probe 或分析逻辑（见 §1.3 宿主状态机）

### 4.2 项目级失败

包括：

- Serena 未 activate 当前项目
- GitNexus 未索引当前项目
- ABCoder 对当前项目 parse 失败
- MySQL MCP 与项目数据库不一致

处理：

- 由 `spec-bootstrap` 处理
- 按规则降级 `Full → Enhanced → Basic`

### 4.3 Java 专项失败

包括：

- 本地无 Java 运行环境
- `JAVA_HOME` 不可用
- JDT 缓存目录不可写
- 首次下载受权限 / 网络限制失败

处理：

- 不阻断 bootstrap 全流程
- 阻断 `ABCoder.ready`
- 记录具体 reason，优先降级到 `Enhanced`

## 5. 文档与脚本改动清单

### 5.1 `skills/mcp-setup/SKILL.md`

调整点：

- 明确其职责是环境级准备
- 补充 `verify-tools.sh` 阶段
- 输出标准化下一步指引：重启后执行 `/spec:bootstrap`
- 补充 Java / ABCoder 的宿主级限制说明

### 5.2 `skills/mcp-setup/scripts/verify-tools.sh`

新增脚本，负责宿主级安装态 / 配置态验证。

验证策略：
- `abcoder`：执行 `abcoder version`
- `serena` / `gitnexus` / `context7`：检查 `~/.claude.json` 中对应 mcpServer 配置是否存在
- 不尝试启动任何 MCP server（见 Section 1.2 的说明）

脚本完成后，写入 `~/.claude/spec-first/host-setup.json`（见 Section 1.3）。

### 5.3 `~/.claude/spec-first/host-setup.json`（新增运行时文件）

由 `mcp-setup` 的 `verify-tools.sh` 写入，用于：

- 标记 `mcp-setup` 是否执行过（`NOT_SETUP` 判定依据）
- 记录安装态快照（工具版本、配置状态）

不记录重启状态；重启完成由 `spec-bootstrap` 通过 MCP 工具可调用性判断（见 Section 1.3）。

### 5.4 `skills/spec-bootstrap/SKILL.md`

调整点：

- 删除”bootstrap 自己补环境”的强预期
- 新增前置门检测逻辑（对应 Section 1.3 状态机）
- 把 `ABCoder auto-configuration` 改为 `Project Tool Readiness`
- 新增 Java preflight
- 新增 `repo_name handshake`
- 重写模式判定规则（包含 Enhanced 模式下 ABCoder 可用性说明）
- 重写用户可见探测输出格式
- 明确 GitNexus 未索引时不等待、直接降级

### 5.5 `skills/mcp-setup/mcp-tools.json`

若 `verify-tools.sh` 需要读取工具元数据（如 lightweight command 名称），则补充以下字段：

- 每个工具的 `verify_command`（`abcoder version`）或 `config_key`（`~/.claude.json` 的 mcpServer key）
- Java 能力标注字段（`requires_java_runtime: true`）

## 6. 迁移步骤

### Step 1. 先改 `mcp-setup`

先把环境级输出与验证做完整，确保用户可以明确知道：

- 是否已经完成宿主准备
- 是否必须重启
- 下一步是不是该进入 `spec-bootstrap`

### Step 2. 再改 `spec-bootstrap` Phase 1

把环境准备逻辑剥离出去，只保留项目级就绪和模式选择。

### Step 3. 最后补充验证文档

为 `spec-bootstrap` 补一段使用说明：

```text
推荐执行顺序：
1. /spec:mcp-setup
2. restart Claude Code
3. /spec:bootstrap
```

## 7. 验收标准

满足以下条件可认为改造完成：

**前置门（状态机）**
- 当 `~/.claude/spec-first/host-setup.json` 不存在时，`spec-bootstrap` 阻断并输出含三要素（原因 / 行动 / 下一步）的提示，引导用户执行 `/spec:mcp-setup`
- 当 `host-setup.json` 存在但 MCP 工具不可调用时，`spec-bootstrap` 阻断并输出含三要素的提示，引导用户重启 Claude Code
- 上述两类阻断均不进入任何项目级 probe 或分析逻辑

**工具探测**
- `mcp-setup` 完成后，输出中明确包含”重启宿主”和”执行 `/spec:bootstrap`”
- `spec-bootstrap` 不再把 `detect-tools.sh` 结果直接视为分析模式依据
- `Tools Available` 基于 `ready` 状态，而不是命令或配置存在性
- 任一单项 probe 失败不会取消其他 probe

**ABCoder**
- Java 项目上的 `ABCoder` 失败能输出明确 reason，不再误报”项目过大”
- `list_repos()` 在 parse 触发前为空时，`spec-bootstrap` 执行 preflight 并尝试触发 parse，而不是直接降级
- `list_repos()` 在 parse 完成后仍为空时，`spec-bootstrap` 判 `abcoder.ready = false`，不继续调用 `get_repo_structure`
- ABCoder parse 触发后超过 60s 未完成，`spec-bootstrap` 记录 `reason=parse-timeout` 并降级，而不是无限等待

## 8. 风险与权衡

### 风险 1：职责分离后，用户需要多一步操作

从“bootstrap 内部自动尝试补环境”变成“先 mcp-setup，再 bootstrap”，用户路径更显式，但步骤变多。

权衡：

- 这会让失败边界更清楚
- 也更利于后续排查问题

### 风险 2：宿主级验证可能带来更多网络 / 启动开销

`verify-tools.sh` 若做得过重，会延长 `mcp-setup` 时间。

权衡：

- 宿主级验证应只做 lightweight probe
- repo 级索引与 parse 不应放在 `mcp-setup`

### 风险 3：Java 项目仍可能因外部限制无法进入 Full mode

即使改造后，Java 项目在权限受限或网络受限环境中，仍可能无法完成 ABCoder parse。

权衡：

- 这是可接受的真实降级，不应被伪装成“可用”
- 方案的目标是让降级可解释，而不是强行避免所有降级

## 结论

这次改造的关键不在于“让 `spec-bootstrap` 更聪明地装工具”，而在于让整个链路的职责边界更清楚：

- `mcp-setup` 解决宿主环境问题
- `spec-bootstrap` 解决目标项目问题

只有把“安装态”和“就绪态”拆开，`Full / Enhanced / Basic` 才能成为可信的模式声明。对 Java 项目、对 `ABCoder`、对 `Serena`、对数据库路径，这都是同一个原则的落地：**先证明 ready，再使用能力。**
