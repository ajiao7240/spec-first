# `spec-graph-bootstrap` 阶段 0：`code-review-graph` 安装接入 `mcp-setup` 技术方案

> 本文定义 `code-review-graph`（下文简称 `CRG`）如何以宿主级 MCP 工具的形式接入 `spec-first` 的 `mcp-setup` 能力。
>
> 本文是 `spec-graph-bootstrap` 阶段 1/2 之前的前置技术方案，目标是先解决“宿主如何安装并配置 CRG MCP”这一基础设施问题。
>
> 本文**不**定义 repo 级建图、事实抽取、文档生成、路由消费与 refresh 逻辑。

---

## 1. 目标

阶段 0 的目标是把 `code-review-graph` 纳入 `spec-first` 的标准 MCP 安装链，使其成为：

* 可由 `/spec:mcp-setup` 安装和配置的宿主级 MCP 工具
* 可被 Claude Code / Codex 宿主发现并加载的 MCP server
* 可被后续 `spec-graph-bootstrap` 在 Phase 0 中安全探测和调用的增强能力

阶段 0 完成后，系统应具备以下状态：

* `mcp-setup` 可以检测 `CRG` 是否已配置到当前宿主
* 用户可通过 `mcp-setup` 安装或补齐 `CRG` MCP 配置
* 宿主重启后，`CRG` 工具可被 MCP runtime 加载
* `spec-graph-bootstrap` 可以把 `CRG` 视为“可选增强能力”进行 probe

---

## 2. 为什么要单独做阶段 0

当前 `spec-graph-bootstrap` 阶段 2 集成方案已经默认：

* `CRG` 是 `Full` 模式的主工具栈
* Phase 0 需要直接调用 `list_graph_stats_tool`
* 当图未建时，需要调用 `build_or_update_graph_tool`

但这套前提成立的条件是：宿主里已经存在一个可运行、可被 MCP runtime 加载的 `code-review-graph` server。

如果不先把这件事纳入 `mcp-setup`：

* `spec-graph-bootstrap` 就必须自己承担“装工具、配宿主、验可用”的职责
* 宿主级准备和项目级分析会耦合
* 用户路径会从清晰的“先装环境，再分析项目”退化成“分析中途补环境”

这与既有原则冲突：

* `mcp-setup` 负责宿主级准备
* `spec-bootstrap / spec-graph-bootstrap` 负责项目级 readiness 与上下文生成

因此，`CRG` 的**宿主级安装与配置**应先被产品化为一个独立前置阶段。

---

## 3. 边界定义

### 3.1 阶段 0 负责什么

阶段 0 只负责以下宿主级能力：

* 检测宿主是否已配置 `code-review-graph` MCP
* 补齐 `code-review-graph` 的 MCP config
* 补齐其运行前置依赖
* 在宿主验证阶段确认其配置已可被当前宿主识别

### 3.2 阶段 0 不负责什么

以下职责**明确不属于**阶段 0：

* 对目标仓库执行 `build_or_update_graph_tool`
* 对目标仓库执行 `list_graph_stats_tool(repo_root=...)`
* 维护 `.code-review-graph/graph.db`
* 决定 `Full / Enhanced / Basic` 模式
* repo 级 stale 检测
* 事实层、文档层、路由层的任何产物生成

### 3.3 分层原则

建议固定以下分层：

* `mcp-setup`
  * 宿主级
  * 安装、配置、验证 MCP server 是否存在
* `spec-graph-bootstrap`
  * 项目级
  * 决定是否使用 CRG
  * 决定是否建图
  * 决定如何消费图能力生成事实产物

简化表达：

> `mcp-setup` 负责“让宿主能调用 `mcp__code-review-graph__*`”，`spec-graph-bootstrap` 负责“决定何时对当前 repo 调用这些工具”。

---

## 4. 参考事实来源

本方案基于 `code-review-graph` 仓库的公开事实整理而来：

* `README.md` 明确把流程拆成：
  * `pip install code-review-graph`
  * `code-review-graph install`
  * `code-review-graph build`
* `cli.py` 中 `install / serve / build / update / status` 为独立命令
* `main.py` 中 `code-review-graph` 以 FastMCP server 暴露 `build_or_update_graph_tool`、`list_graph_stats_tool` 等工具
* 图数据库保存在目标仓库内的 `.code-review-graph/graph.db`

这说明：

* 宿主级配置和 repo 级 graph lifecycle 在 `CRG` 自身设计中就是分层的
* `spec-first` 不应把这两个层级重新混在一起

---

## 5. 核心决策

### 5.1 决策一：`CRG` 接入 `mcp-setup`

**决策：** `code-review-graph` 作为 `mcp-setup` 可安装的 MCP tool 接入。

理由：

* 符合 `mcp-setup` 的既有职责边界
* 避免 `spec-graph-bootstrap` 承担宿主级安装责任
* 用户路径保持一致：
  * `/spec:mcp-setup`
  * 重启宿主
  * `/spec:graph-bootstrap`

### 5.2 决策二：`CRG` 在 `mcp-setup` 中默认建模为 `optional`

**决策：** 在 `mcp-tools.json` 中，`CRG` 不应作为与 `serena / context7 / sequential-thinking` 同等级的全局 `required` 工具，而应作为 `optional` 或单独的增强类目。

理由：

* `spec-graph-bootstrap` 允许在无 CRG 时降级到 `Enhanced / Basic`
* `CRG` 的安装成本和运行成本显著高于纯配置型 MCP 工具
* `CRG` 的语言支持与能力覆盖并不均衡
* 让所有用户默认安装 CRG 会抬高冷启动门槛

**v1 建议：**

* 保持当前 required baseline 不变：
  * `serena`
  * `sequential-thinking`
  * `context7`
* 将 `code-review-graph` 增加为 `optional`
* 当用户要使用 `spec-graph-bootstrap` Full mode 时，由文档和宿主 probe 引导安装

### 5.3 决策三：不复用 `code-review-graph install` 作为 `mcp-setup` 主实现

**决策：** `mcp-setup` 不直接调用 `code-review-graph install` 作为黑盒入口，而是像处理其他 MCP 工具一样，自行写入宿主配置。

理由：

* `mcp-setup` 已有统一的宿主配置模型和验证逻辑
* `code-review-graph install` 除了写 MCP 配置，还会做 hooks / rules 注入等平台特定行为
* 如果直接委托给 `CRG install`，会把 `spec-first` 自己的宿主管理模型变成“外部工具副作用驱动”
* 这会降低幂等性、可测性和配置回滚能力

因此建议：

* 使用 `CRG` 官方推荐的 server 启动命令
* 但由 `mcp-setup` 自己完成 host config merge

### 5.4 决策四：`CRG` 的 Python 版本要求由 `uvx` 内部管理，无需系统 Python 检测

**决策：** `CRG` 通过 `uvx code-review-graph serve` 启动，`uvx` 属于 `uv` 工具链，自 v0.4 起内置 Python 版本管理能力（`uv python install`）。当包的 `Requires-Python >=3.10` 约束无法被系统 Python 满足时，`uv` 会自动下载并使用隔离的 Python 3.10+ 环境。因此，`mcp-setup` **不需要**为 `CRG` 新增系统级 Python 检测。

理由：

* `uvx` 的核心价值就是无需系统 Python 即可运行 Python 包
* 强制要求系统 Python 3.10+ 与选用 `uvx` 的决策互相矛盾
* `uv` 已是 `required` baseline dependency（serena 依赖它），已被纳入依赖检测链
* 增加 python3 检测会引入不必要的复杂度和版本冲突风险

**约束：**

* `CRG` 的唯一新增系统依赖是 `uv`，而 `uv` 已在 baseline 检测中覆盖
* `mcp-setup` 不得新增 `python3` 版本检测项
* 若 `uv` 缺失，已有的 baseline 安装流程会给出提示，不需要为 `CRG` 单独处理

---

## 5.5 决策五：阶段 0 不引入新的 optional 细粒度交互模型

**决策：** 阶段 0 不要求把 `mcp-setup custom` 改造成“逐个 optional tool 选择安装”的复杂交互。

理由：

* 当前 `mcp-setup` 的交互模型是“required 先安装，再统一询问 optional tools”
* 如果在阶段 0 同时引入 CRG 和新的 per-tool 选择模型，会把一次基础接入升级成一次交互系统改造
* 这会不必要地扩大实施范围

**v1 约束：**

* `quick` 模式保持当前语义：跳过 optional tools
* `custom` 模式可以继续沿用现有“是否安装 optional tools”交互
* 若安装 optional tools，`CRG` 与 `Playwright MCP` 可以整体进入 optional 安装集合
* 如后续需要 `baseline only / baseline + CRG / baseline + all optional` 这类细粒度选择，另立后续优化项

---

## 6. 技术设计

### 6.1 `mcp-tools.json` 扩展

在 [`skills/mcp-setup/mcp-tools.json`](/Users/kuang/xiaobu/spec-first/skills/mcp-setup/mcp-tools.json) 中新增 `code-review-graph` 条目。

建议结构：

```json
{
  "id": "code-review-graph",
  "name": "Code Review Graph",
  "category": "optional",
  "description": "AST 级代码图与 blast-radius 分析，spec-graph-bootstrap Full mode 增强能力",
  "dependencies": ["uv"],
  "mcp_config": {
    "command": "uvx",
    "args": ["code-review-graph", "serve"],
    "startup_timeout_sec": 120
  },
  "detect": {
    "method": "mcp_config",
    "key": "code-review-graph"
  }
}
```

> **注意**：`startup_timeout_sec` 字段由 `install-coordinator.sh` 的 `ensure_codex_startup_timeout()` 函数写入，该函数仅对 Codex 宿主生效；Claude Code 宿主不支持此字段，忽略即可。

### 6.2 启动命令策略

CRG 文档显示推荐路径为：

* Python 包安装后可用 `code-review-graph serve`
* 若宿主有 `uvx`，其安装逻辑会优先使用 `uvx`

因此 `spec-first` 的 v1 策略建议为：

**默认策略**

```text
command = "uvx"
args = ["code-review-graph", "serve"]
```

**不建议在 `mcp-tools.json` 中同时表达多套回退命令**，因为现有工具元数据模型是静态的。

因此更稳妥的办法是：

* 由依赖检测阶段确认 `uvx` 是否存在
* 若 `uvx` 不存在，则不自动配置 `CRG`
* 明确提示用户先安装 `uv`

这是比“动态在配置里混入多套入口”更可控的做法。

**阶段 0 明确约束：**

* `detect-tools` 与 `verify-tools` 在 v1 中只承认由 `spec-first` 标准写入的 `CRG` 入口
* 不要求识别用户手工写入的 `pip` / `pipx` / 自定义 shell wrapper 等等价配置
* 多入口兼容识别属于后续增强，不属于阶段 0 范围

### 6.3 依赖检测：无需扩展

`CRG` 通过 `uvx` 启动，`uv` 工具链内置 Python 版本管理，无需系统 Python 3.10+。

当前 `check-deps.sh` / `check-deps.ps1` 检测的依赖：

* `node`
* `uv`
* `jq`

**阶段 0 不新增任何依赖检测项。** `uv` 已在 baseline 中被检测，CRG 的运行时依赖完全由 `uvx` 内部管理。

依赖分级（保持不变）：

* `uv`：`safe_auto`
* `jq`：`safe_auto`
* `node`：`gated_auto`

### 6.4 工具检测：仅修改 `mcp-tools.json`，无需改动脚本

`detect-tools.sh` / `detect-tools.ps1` 已经完全数据驱动：脚本动态读取 `mcp-tools.json` 中所有工具 ID，逐一按 `detect.method` 进行检测。**只要把 `code-review-graph` 条目加入 `mcp-tools.json`，检测逻辑自动覆盖，无需修改任何脚本代码。**

同理，`install-coordinator.sh` / `.ps1` 也是数据驱动的，通过 `--install=code-review-graph` 参数即可触发 optional 工具安装，无需修改安装逻辑。

检测判断标准（沿用现有逻辑）：

* 宿主 config 中存在对应 key
* `command` / `args` 与 `mcp-tools.json` 中声明的 `mcp_config` 一致

不检测的内容（明确边界）：

* repo 级 graph 数据库是否存在
* `build_or_update_graph_tool` 对特定 repo 是否成功

如后续需放宽匹配，可增加”兼容入口”等价列表，但阶段 0 先不做。

### 6.5 宿主验证重构（`verify-tools.sh` / `verify-tools.ps1`）

> ⚠️ **这是重构任务，不是局部扩展。** 当前 `verify-tools.sh` 完全硬编码（固定检测 serena / context7 / sequential-thinking，输出 JSON schema 也是静态的）。要支持 `optional_tools` 分区，必须将脚本改为**数据驱动**：从 `mcp-tools.json` 动态读取工具列表，按 `category` 分组，分别构建 `required_tools` 和 `optional_tools` 两个 JSON section。

重构后的行为：

* `setup_success == true` 的最低条件仍然是所有 `category: required` 工具已配置
* optional tools（`playwright`、`code-review-graph` 等）的配置状态记录到 `optional_tools`，不影响 `setup_success`
* 后续新增 optional tool 只需修改 `mcp-tools.json`，不再需要改脚本

目标 host marker 结构（**schema v5**）：

```json
{
  "version": "5",
  "host": "claude",
  "completed_at": "2026-04-10T12:00:00Z",
  "setup_success": true,
  "required_tools": {
    "serena": { "configured": true },
    "context7": { "configured": true },
    "sequential-thinking": { "configured": true }
  },
  "optional_tools": {
    "playwright": { "configured": false },
    "code-review-graph": { "configured": true }
  }
}
```

#### Schema 版本兼容策略

* 本次变更将 host marker 版本从 `v4` bump 到 `v5`
* `spec-graph-bootstrap` 读取 marker 时必须处理向后兼容：
  * 读到 v4 marker（无 `optional_tools` 字段）→ 视 CRG 为未安装 → 降级到 Enhanced / Basic，不得报错
  * 读到 v5 marker 且 `optional_tools.code-review-graph.configured == false` → 同样降级
  * 只有 v5 marker 且 `optional_tools.code-review-graph.configured == true` → 进入 CRG probe 流程

### 6.6 用户交互策略

在 `mcp-setup` 的 optional tools 阶段，将 `CRG` 与 `Playwright MCP` 并列展示。

建议文案：

* `Playwright MCP`：前端自动化测试
* `Code Review Graph`：代码图、依赖关系、blast-radius 分析，供 `spec-graph-bootstrap` Full mode 使用

在 `quick` 模式下：

* 保持当前行为，不主动安装 optional tools

在 `custom` 模式下：

* 阶段 0 默认沿用现有“是否安装 optional tools”交互
* 不要求实现 per-tool 粒度选择

对于未来如需更强产品引导，可在后续版本中再考虑：

* baseline only
* baseline + CRG
* baseline + all optional

---

## 7. 与 `spec-graph-bootstrap` 的协作 contract

### 7.1 `mcp-setup` 提供的保证

阶段 0 完成后，`mcp-setup` 只保证：

* 当前宿主配置中已存在 `code-review-graph` MCP 条目
* 用户重启宿主后，MCP runtime 有机会加载该 server
* host marker（v5）的 `optional_tools.code-review-graph.configured` 可被 `spec-graph-bootstrap` 读取

### 7.2 `spec-graph-bootstrap` 仍需自行完成的动作

`spec-graph-bootstrap` 仍必须在项目执行期完成：

* 读取 host marker，确认宿主是否完成 `mcp-setup`
* 对 `code-review-graph` MCP 做 runtime probe
* 调用 `list_graph_stats_tool(repo_root=...)` 判断目标 repo 是否已有图
* 必要时询问用户是否执行 `build_or_update_graph_tool`
* 决定 `Full / Enhanced / Basic`

### 7.3 不允许跨层泄漏的状态

以下状态**不得**写入 host marker：

* 某个 repo 的 `graph_mtime`
* 某个 repo 的 `indexed / not-indexed`
* 某个 repo 的 node / edge 统计
* 某个 repo 的 stale 状态

原因：

* 这些都属于项目状态，不属于宿主状态

---

## 8. 实施范围

### 8.1 需要修改的文件

| 文件 | 变更类型 | 说明 |
|------|------|------|
| `skills/mcp-setup/mcp-tools.json` | 新增条目 | 添加 `code-review-graph`（optional），**不改脚本** |
| `skills/mcp-setup/SKILL.md` | 内容更新 | Phase 3 optional tools 列表补充 CRG；Phase 1 dependency 表格确认无需新增 python3 |
| `skills/mcp-setup/scripts/verify-tools.sh` | **重构** | 硬编码 → 数据驱动；schema v4 → v5；增加 `optional_tools` 分区 |
| `skills/mcp-setup/scripts/verify-tools.ps1` | **重构** | 同上，Windows 端同步改造 |
| `tests/unit/mcp-setup.sh` | 新增测试 | 见 Step 5 |
| `CHANGELOG.md` | 记录 | 版本变更记录 |
| `docs/08-版本更新/README.md` | 记录 | 版本说明更新 |

### 8.2 不需要修改的文件

以下文件确认**不需要修改**（含原因）：

| 文件 | 原因 |
|------|------|
| `scripts/check-deps.sh` / `.ps1` | CRG 依赖（uv）已在 baseline 检测中覆盖，无需新增 python3 |
| `scripts/detect-tools.sh` / `.ps1` | 已数据驱动，添加 JSON 条目即自动覆盖 |
| `scripts/install-coordinator.sh` / `.ps1` | 已支持 optional tool 安装（`--install` 参数），无需修改 |
| `skills/spec-graph-bootstrap/` | 项目级逻辑，不属于阶段 0 范围 |
| `spec-bootstrap` / `spec-graph-bootstrap` 的项目级 probe 实现 | 同上 |
| 任何事实提取 / 文档生成逻辑 | 同上 |

---

## 9. 实施步骤

### Step 1. 扩展工具元数据（仅改 JSON）

在 `mcp-tools.json` 中增加 `code-review-graph` 条目（见 Section 6.1）。

输出结果：

* `detect-tools.sh` / `.ps1` 自动覆盖，无需改脚本（已数据驱动）
* `install-coordinator.sh` / `.ps1` 通过 `--install=code-review-graph` 即可触发，无需改脚本

### Step 2. 更新 `SKILL.md` Phase 3

在 `SKILL.md` Phase 3 optional tools 列表中添加 `Code Review Graph`，注明描述与使用场景。

输出结果：

* `quick` 模式不自动装
* `custom` 模式允许选择装
* 用户看到 CRG 的描述与使用场景提示

> 注：`check-deps` 脚本**无需修改**——`uv` 已在 baseline 检测中覆盖，`uvx` 自行管理 Python 版本。

### Step 3. 重构 `verify-tools.sh` / `verify-tools.ps1`（最重工作量）

将硬编码脚本改为数据驱动：从 `mcp-tools.json` 动态读取工具列表，按 `category` 分组，构建 `required_tools` / `optional_tools` JSON。同步将 marker schema 从 **v4 升级到 v5**（见 Section 6.5）。

输出结果：

* optional tools（含 CRG）的配置状态写入 `optional_tools` 分区
* `setup_success` 规则不变：仍由 required tools 决定
* 后续新增 optional tool 无需再改脚本

### Step 4. 增加单元测试

在 `tests/unit/mcp-setup.sh` 中增加：

* `mcp-tools.json` 包含 `code-review-graph`，`category` 为 `optional`
* optional tool 数量变化符合预期
* host config 中存在 `code-review-graph` 条目时，detect / verify 能识别
* host marker v5 中能正确记录 `optional_tools.code-review-graph.configured`
* v4 旧 marker（无 `optional_tools`）不导致消费方报错

### Step 5. 文档与版本记录

同步更新：

* `CHANGELOG.md`
* `docs/08-版本更新/README.md`
* `mcp-setup` skill 文档

---

## 10. 验收标准

### 10.1 元数据验收

* `mcp-tools.json` 中存在 `code-review-graph`
* `category` 为 `optional`
* 描述明确绑定 `spec-graph-bootstrap Full mode`

### 10.2 依赖检测验收

* `check-deps` 输出保持现有三项（`node`、`uv`、`jq`），**不新增 `python3`**
* `uv` 存在时，CRG 依赖视为满足（`uvx` 自行管理 Python 版本）
* `uv` 缺失时，CRG 安装被跳过；此情形已由现有 baseline 依赖检测覆盖

### 10.3 宿主配置验收

当用户选择安装 `CRG` 后：

* Claude 宿主配置中存在 `code-review-graph`
* Codex 宿主配置中存在 `code-review-graph`
* 配置写入保持幂等
* 不覆盖已有其他 MCP entries

### 10.4 检测与验证验收

* `detect-tools` 能区分 `code-review-graph` 已配置 / 未配置
* `verify-tools` 能在 marker 中记录 `optional_tools.code-review-graph`
* `setup_success` 逻辑不因 optional tool 缺失而失败
* `detect-tools` 与 `verify-tools` 在 v1 中只要求识别 `spec-first` 标准写入的 `CRG` 配置，不要求识别用户手工等价配置

### 10.5 边界验收

* `mcp-setup` 不会触发任何 repo 级 `build`
* `mcp-setup` 不会创建 `.code-review-graph/graph.db`
* `mcp-setup` 不会要求用户提供 repo_root

---

## 11. 风险与缓解

### 风险 1：CRG 启动命令与本地安装方式不一致

**问题**

用户可能不是通过 `uvx` 安装 `CRG`，而是 `pip install` 或 `pipx install`。

**缓解**

阶段 0 先收敛到一种官方支持路径：

* 要求 `uvx`
* 由 `mcp-setup` 明确提示依赖

后续再考虑多入口兼容。

### 风险 2：把 CRG 设成 required 会抬高冷启动成本

**缓解**

明确将其建模为 `optional`，只对有 `spec-graph-bootstrap Full mode` 需求的用户暴露。

### 风险 3：直接调用 `code-review-graph install` 带来额外副作用

**缓解**

不走黑盒安装命令，由 `mcp-setup` 自己写 host config。

### 风险 4：宿主已配置 CRG，但用户未重启

**缓解**

沿用 `mcp-setup` 现有流程：

* 配置完成后明确提示必须重启宿主
* 不把“配置已写入”误当成“当前会话已可用”

### 风险 5：`verify-tools.sh` 重构范围超出预期

**问题**

将硬编码脚本改为数据驱动的工作量可能比预期大，尤其是 Windows PowerShell 端（`.ps1`）需要同步改造，且 schema bump 需要与 `spec-graph-bootstrap` 消费方对齐。

**缓解**

* 明确定义 v5 schema（见 Section 6.5）作为合同，保证改造目标清晰
* 重构时先在测试环境验证 v4 向后兼容（`optional_tools` 缺失不报错）
* PowerShell 端可与 Shell 端并行实施，不构成串行依赖

### 风险 7：阶段 0 同时修改 optional 交互模型会扩大范围

**缓解**

* 阶段 0 不引入 per-tool optional 选择模型
* 保持现有 optional tools 整体安装交互
* 将细粒度选择留到后续产品化迭代

---

## 12. 后续阶段如何承接

### 对阶段 1 的意义

阶段 1 仍然只解决 `spec-graph-bootstrap` skill 的安装与入口并行，不承担 CRG 安装。

### 对阶段 2 的意义

阶段 2 可以在 Phase 0 中把 `CRG` 视为一个清晰的宿主级增强能力：

* 已配置且可调用 → 进入 `CRG probe`
* 未配置 → 直接降级，不再承担“补装工具”职责

### 对用户路径的意义

推荐用户路径收敛为：

1. `/spec:mcp-setup`
2. 重启宿主
3. `/spec:graph-bootstrap`
4. 在 repo 级 Phase 0 中决定是否建图

---

## 13. 最终结论

`code-review-graph` 应该接入 `skills/mcp-setup`，但接入范围必须严格限制在**宿主级安装、配置、检测、验证**。

不应把 repo 级建图、graph 状态探测、facts 抽取、模式判定塞进 `mcp-setup`。

阶段 0 的价值，不是让 `spec-first` “开始使用 CRG”，而是先让系统具备一个清晰、可测、可复用的宿主能力前置层。只有这层收敛了，后续阶段 1/2 的产品路径和架构边界才不会继续漂移。
