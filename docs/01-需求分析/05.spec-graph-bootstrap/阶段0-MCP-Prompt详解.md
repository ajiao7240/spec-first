# MCP Prompt 详解：5 个 AI 工作流编排模板

**文档日期**：2026-04-12  
**参考实现**：`/Users/kuang/xiaobu/code-review-graph/code_review_graph/prompts.py`  
**测试文件**：`/Users/kuang/xiaobu/code-review-graph/tests/test_prompts.py`  
**注册入口**：`/Users/kuang/xiaobu/code-review-graph/code_review_graph/main.py`（`@mcp.prompt()` 装饰器）

---

## 一、MCP Prompt 是什么

### 1.1 Prompt vs Tool：本质区别

MCP 协议定义了三种原语：**Resources**（数据源）、**Tools**（可调用函数）、**Prompts**（预设消息模板）。

| 维度 | MCP Tool | MCP Prompt |
|------|---------|------------|
| 调用方式 | AI 主动调用（函数调用）| 用户主动触发（命令式快捷入口） |
| 输出 | 结构化 JSON 数据 | 预格式化的 `role/content` 消息列表 |
| 目的 | 执行单步操作 | 编排多步工作流（告诉 AI"怎么用这些工具"） |
| 参数化 | 每次调用时传参 | 通过 Prompt 参数预设上下文 |
| 消费方 | AI 的工具调用循环 | 直接注入 AI 的 system/user 消息列表 |

**类比**：MCP Tool 是"技能"，MCP Prompt 是"工作手册"——它告诉 AI 在什么场景下按什么顺序调用哪些技能。

### 1.2 在 AI 工作流中的位置

```
用户触发 Prompt（如 /review_changes）
         │
         ▼
MCP Server 返回预格式化消息列表
         │
         ▼
AI 收到消息，按 Prompt 中的工作流指令依次调用 Tools
  └─ get_minimal_context（必须第一步）
  └─ detect_changes / list_flows / ...（按风险条件分支）
         │
         ▼
AI 生成最终报告输出给用户
```

Prompt 的核心价值：**将最佳实践固化成可复现的工作流**，避免每次重新描述"先调哪个工具、低风险时怎么做、高风险时怎么做"。

### 1.3 注册方式（Python 实现）

```python
# main.py — 用 @mcp.prompt() 装饰器注册
@mcp.prompt()
def review_changes(base: str = "HEAD~1") -> list[dict]:
    """Pre-commit review workflow using detect_changes, affected_flows, and test gaps."""
    return review_changes_prompt(base=base)
```

返回值格式（MCP Messages 规范）：
```json
[
  {
    "role": "user",
    "content": "## Rules for Token-Efficient Graph Usage\n1. ALWAYS call..."
  }
]
```

---

## 二、Token 效率前置规则（所有 Prompt 共享）

所有 5 个 Prompt 都在头部注入以下 6 条规则（来自 `_TOKEN_EFFICIENCY_PREAMBLE`），是整个工具集的使用契约：

```
## Rules for Token-Efficient Graph Usage
1. ALWAYS call `get_minimal_context` first with a task description.
2. Use `detail_level="minimal"` on all tool calls unless the minimal output is insufficient.
3. Only escalate to `detail_level="standard"` or `"verbose"` for the specific entities that need deeper inspection.
4. Never request more than 3 tool calls per turn unless absolutely necessary.
5. Prefer targeted queries (query_graph with a specific symbol) over broad scans (list_communities with full members).
6. When reviewing changes: detect_changes(detail_level="minimal") → only expand on high-risk items.
```

**规则设计意图分析**：

| 规则 | 设计意图 | 违反的代价 |
|------|---------|---------|
| R1：先调 get_minimal_context | 建立全局风险视角，避免"盲目深挖低风险变更" | 浪费 token 在无需关注的代码上 |
| R2：默认 minimal | 大多数场景下 minimal 输出已够判断 | standard 输出约 3× token，大仓库会超出上下文窗口 |
| R3：按需升级 detail | 只对真正需要深挖的节点请求 standard | 全量 standard 会把上下文填满 |
| R4：每轮 ≤3 次工具调用 | 防止 AI 陷入"调用循环" | 超过 3 次通常意味着工作流设计错误 |
| R5：精准查询优先 | 精准：O(1) token；宽泛：O(n) token | 调 list_communities(include_members=True) 在大仓库可返回 10K token |
| R6：detect_changes 先 minimal | 99% 的变更不需要完整 schema | 节省 60-80% 的 review 工作流 token |

---

## 三、5 个 Prompt 详解

### 3.1 `review_changes` — 预提交代码审查

**触发场景**：开发者提交 PR 或 commit 前，请求 AI 自动审查代码变更。

**参数**：
- `base: str = "HEAD~1"` — Git diff 基准，默认对比上一个 commit；可传 `"main"` / `"origin/main"` 等

**工作流逻辑**（含条件分支）：

```
Step 1: get_minimal_context(task="review changes against {base}")
         → 获得：risk_level (low/medium/high)，changed_files 列表，全局统计
                │
       ┌────────┴────────┐
       ▼                 ▼
  risk == "low"    risk == "medium" / "high"
       │                 │
       ▼                 ▼
Step 2a:            Step 2b:
detect_changes      detect_changes(detail_level="standard")
(detail_level=      → 完整 changed functions 列表
 "minimal")
→ summary +         Step 3:（每个 high-risk function）
  test_gaps         query_graph(
                      pattern="callers_of",
                      target=<func>,
                      detail_level="minimal"
                    )
                    → 找出谁在调用高风险函数
                         │
                    （条件：changed_functions > 3）
                         ▼
                    Step 4:
                    get_affected_flows(detail_level="minimal")
                    → 哪些业务流程被本次变更触及

Step N: 输出报告
  - 风险级别
  - 变更摘要
  - test_gaps 列表
  - 具体改进建议
  - 若有 affected_flows → 影响范围警告
```

**关键设计决策**：
- `get_review_context` 被**显式排除**（"Do NOT call get_review_context unless you need source code snippets"）——它包含 source snippets，token 成本高，只在需要看具体代码时才用
- 调用链在低风险时仅需 2 步（约 200 tokens），高风险时最多 5 步（约 800 tokens）
- `callers_of` 查询限定 high-risk function——不对所有变更函数做全量 caller 分析

**源码**（`prompts.py:32-63`）：
```python
def review_changes_prompt(base: str = "HEAD~1") -> list[dict]:
    return [{
        "role": "user",
        "content": (
            f"{_TOKEN_EFFICIENCY_PREAMBLE}\n"
            f"## Review Workflow\n"
            f'1. Call `get_minimal_context(task="review changes against {base}")`...\n'
            ...
        )
    }]
```

**与 spec-first 的实现关系**：
- 需要工具：`context`（get_minimal_context）、`detect-changes`、`query`、`affected-flows`
- detect-changes 的 Blocker 级缺陷（无 test_gaps 输出）直接影响此 Prompt 的 Step 2 产出

---

### 3.2 `architecture_map` — 架构文档生成

**触发场景**：需要快速理解一个陌生代码库的模块划分、核心业务流程、模块间耦合关系；或为团队生成架构文档。

**参数**：无（无参数 Prompt）

**工作流逻辑**：

```
Step 1: get_minimal_context(task="map architecture")
         → 快速建立仓库基本轮廓（语言/节点数/社区数）

Step 2: get_architecture_overview(detail_level="minimal")
         → 社区耦合摘要
         → coupling warnings（哪些模块间依赖过重）
         → cross_community_edges 列表

Step 3: list_flows(detail_level="minimal")
         → 流名称 + criticality 分数
         → 识别最关键的 3-5 个业务入口

Step 4（按需，仅 1-2 个社区）:
         get_community(name=<X>, detail_level="standard")
         → 用户最关心的社区的详细成员列表

Step 5: 生成 Mermaid 图
  社区 → 箭头代表关键流
  graph LR
    Auth --> UserService
    UserService --> Database
    APIGateway --> Auth
    ...
```

**输出目标**：
1. **30 秒心智模型**：社区列表 + 每个社区 1 句话描述
2. **Mermaid 架构图**：社区作为框，关键流作为有向箭头
3. **耦合告警**：高耦合的模块对（Python 版 coupling > 10 条边时告警）

**关键设计决策**：
- Step 4 **严格限定为 1-2 个社区**——完整社区成员列表 token 成本极高
- `list_flows(minimal)` 只拿流名和 criticality，不拿完整调用路径——这是步骤 3 的关键 token 节省点
- Mermaid 图由 AI 根据 Step 2-3 的数据**生成**，不是工具输出；确保图质量依赖社区/流数据的准确性

**与 spec-first 的实现关系**：
- 需要工具：`context`、`architecture`、`flows`、`community`
- M-9（architecture 缺 coupling warnings）直接导致此 Prompt 的 Step 2 产出不完整
- M-8（communities schema 不同）导致 Step 4 的社区成员数据结构与 Python 期望不同

---

### 3.3 `debug_issue` — 引导式调试

**触发场景**：开发者遇到 bug（如"登录超时"、"数据未保存"），希望 AI 借助代码图定位根因。

**参数**：
- `description: str = ""` — 问题描述，可以是自然语言（如 "login fails with 500 error"）；不传时 AI 会提示用户补充

**工作流逻辑**：

```
Step 1: get_minimal_context(task="debug: {description}")
         → 建立仓库全局背景（社区结构、近期变更）

Step 2: semantic_search_nodes(
          query=<description 中的关键词>,
          detail_level="minimal",
          limit=5
        )
         → 从节点名称中找到与问题最相关的函数/类
         → 例："login fails" → 搜出 handle_login / authenticate / verify_token

Step 3（仅 top 1-2 结果）:
         query_graph(
           pattern="callers_of",
           target=<node_name>,
           detail_level="minimal"
         )
         → 找出谁在调用这些函数（调用方即为"可能的 bug 路径"）

Step 4（条件：issue 涉及执行流）:
         get_flow(name=<relevant_flow>)
         → 展开最相关的一条执行流的完整调用链
         → 沿链找到异常传播路径

Step 5（条件：需要追踪变更影响）:
         get_review_context / get_impact_radius
         → 仅在需要 blast radius 分析时调用
```

**关键设计决策**：
- `semantic_search_nodes` 是调试 Prompt 的**入口工具**，而不是 review Prompt 中的 `detect_changes`——因为调试时不一定有 git diff，入口是症状描述
- `callers_of` 模式是调试的核心：找到"谁调用了有问题的函数"，沿调用链反向定位
- `get_flow` 仅调用 **1 个最相关的流**——调试时不需要全部流，只需与问题症状匹配的那条
- `get_impact_radius` 被设为**最后手段**（"only if you need to trace blast radius"）——它是高 token 操作

**`description` 参数注入位置**：
```python
desc_part = description or "<description>"
# 注入到 task 参数：
f'1. Call `get_minimal_context(task="debug: {desc_part}")`.\n'
# 以及 search 关键词提示：
f"2. Call `semantic_search_nodes(query=<keywords from description>...)`\n"
```
即 description 既用于 task 描述，也暗示 AI 从中提取关键词做 search。

**与 spec-first 的实现关系**：
- 需要工具：`context`、`search`、`query`、`flow`、`review-context`（可选）
- N-2（search 无向量语义搜索）使 Step 2 退化为关键词匹配，可能漏掉语义相关的函数
- M-7（flow 不支持名称搜索）使 Step 4 必须知道确切 flow ID，降低可用性

---

### 3.4 `onboard_developer` — 新开发者入门引导

**触发场景**：新人加入团队，希望在 15 分钟内建立代码库心智模型——了解"这个仓库有哪些模块、哪些是核心流程、技术栈是什么"。

**参数**：无（无参数 Prompt）

**工作流逻辑**：

```
Step 1: get_minimal_context(task="onboard developer")
         → 节点总数/边数/社区数/流数（仓库体量感知）

Step 2: list_graph_stats()
         → 技术全景：
           - 语言分布（Python 60% / TypeScript 30% / ...）
           - 节点 by kind（Function: 320, Class: 45, File: 89）
           - 边 by kind（calls: 1200, imports: 340）
           - 最近构建时间

Step 3: get_architecture_overview(detail_level="minimal")
         → 30 秒心智模型：
           - 模块划分（社区名称 + 简介）
           - 最关键的跨模块依赖

Step 4: list_communities(detail_level="minimal")
         → 展示为表格：
           | 社区名 | 大小 | 描述 |
           | auth   | 23  | 认证鉴权模块 |
           | api    | 45  | REST API 层 |

Step 5: list_flows(detail_level="minimal")
         → 突出显示 top 3 关键流（criticality 最高的 3 个）
         → 帮助新人快速理解"核心业务路径是什么"

Step N（仅当开发者追问时）:
         get_community / get_flow 深入某个模块/流
```

**输出目标**：
1. **技术栈全景**（来自 list_graph_stats）
2. **模块表格**（来自 list_communities，minimal 模式仅含名称和大小）
3. **Top 3 关键流**（来自 list_flows，帮助理解最重要的业务逻辑路径）
4. **架构图**（来自 get_architecture_overview）

**关键设计决策**：
- `list_graph_stats()` 用无 `detail_level` 参数版本（该工具本身输出就很紧凑）——Step 2 是唯一不用 minimal 的步骤
- `list_flows(minimal)` **只取名称和 criticality**，不取完整调用路径——新人只需知道"有哪些关键流"，不需要全部节点
- 深挖社区/流的操作**明确限定为"开发者追问时才做"**——防止一次 Prompt 触发大量工具调用
- 没有 `detect_changes` 调用——这是入门场景，不关心"最新变更"

**与 spec-first 的实现关系**：
- 需要工具：`context`、`stats`、`architecture`、`communities`、`flows`
- M-4（stats 缺 nodes_by_kind/edges_by_kind/languages）直接影响 Step 2 的"技术全景"质量
- M-8（communities schema 不同，无 cohesion/dominant_language）影响 Step 4 的信息完整度
- B-1（flows criticality 全相同）影响 Step 5 中"Top 3 关键流"的实际意义——所有流 criticality 相同时无法有效排序

---

### 3.5 `pre_merge_check` — PR 合并前就绪检查

**触发场景**：PR 准备合并到主干前，做最终质量把关——风险评分、测试缺口、dead code 检测，输出 GO/NO-GO 结论。

**参数**：
- `base: str = "HEAD~1"` — 基准分支；实际上 Prompt 正文为**通用工作流**，不直接嵌入 base 参数（与 review_changes 不同）

**工作流逻辑**：

```
Step 1: get_minimal_context(task="pre-merge check")
         → 快速建立变更上下文

Step 2: detect_changes(detail_level="minimal")
         → 获取：risk_score (0-1.0 浮点)
                 test_gap_count（无测试覆盖的高风险函数数）
                 changed_functions 摘要

                    ┌──────────────────┐
                    │   risk > 0.4?    │
                    └──────────────────┘
                         │
                    ┌────┴────┐
                    ▼         ▼
              YES             NO
               │              │
               ▼              跳过 Step 3
Step 3: get_affected_flows(detail_level="minimal")
         → 确认哪些业务流被触及
         → risk > 0.4 时才值得看 affected flows

                    ┌──────────────────────┐
                    │  test_gap_count > 0? │
                    └──────────────────────┘
                              │
                    ┌─────────┴────────┐
                    ▼                  ▼
              YES（最多3个）           NO
               │                      │
               ▼                      跳过 Step 4
Step 4: query_graph(
          pattern="tests_for",
          target=<untested_func>,
          detail_level="minimal"
        )
         → 验证"是否真的没有测试"（可能测试文件名不符合命名规则）

Step 5: refactor(mode="dead_code", detail_level="minimal")
         → 检测 PR 引入的新 dead code（函数合并/重命名后留下的孤立符号）

                    ┌──────────────────┐
                    │   risk > 0.7?    │
                    └──────────────────┘
                              │
                    ┌─────────┴───────┐
                    ▼                 ▼
              YES                    NO
               │                     │
               ▼                     跳过 Step 6
Step 6: find_large_functions / get_impact_radius
         → 仅极高风险时才做深度分析

Step N: 输出 GO/NO-GO 裁决
  - GO: 风险可控，测试充分，无 dead code
  - NO-GO: 附具体阻塞原因 + 必须解决的 follow-up 列表
```

**关键设计决策**：
- `risk > 0.4` 和 `risk > 0.7` 两个阈值设计：大多数 PR 不超过 0.4，这样 Step 3-6 大部分时候被跳过，节约 token
- `refactor(mode="dead_code")` 是 pre_merge_check **独有的步骤**，review_changes 不做 dead code 检测——只有"即将合并"时才值得检查
- `tests_for` 查询**限定最多 3 个函数**——防止 test_gap_count 很大时触发大量查询
- 最终输出格式强制要求：**GO/NO-GO + 1 句话理由 + 必须跟进的 follow-up 列表**（强结构化，便于 CI/CD 集成判断）

**`base` 参数特殊说明**：
```python
# pre_merge_check 接受 base 参数，但 Prompt 正文是通用工作流
# 不像 review_changes 那样把 base 嵌入步骤文字
# 测试注释说明了这一点：
# "pre_merge_check_prompt still accepts base but the workflow is now generic"
```
设计意图：pre-merge 通常针对整个 PR（多个 commits），base 由 detect_changes 工具自行处理，Prompt 保持通用性。

**与 spec-first 的实现关系**：
- 需要工具：`context`、`detect-changes`、`affected-flows`、`query`、`refactor`（**当前完全缺失**）、`large-functions`、`impact`
- `refactor(mode="dead_code")` 是 Step 5 的核心——而 `refactor` 命令是 8 个完全未实现的 MCP 工具之一，**此 Prompt 在 spec-first 实现之前无法完整运行**
- B-2（detect-changes 无 risk_score 浮点值）导致 Step 3-6 的条件分支（`risk > 0.4` / `risk > 0.7`）全部失效——JS 版只有 High/Medium/Low 三档枚举

---

## 四、工具依赖矩阵

各 Prompt 使用的工具汇总（✅=必须 / ⚙️=条件调用 / —=不使用）：

| MCP 工具 | review_changes | architecture_map | debug_issue | onboard_developer | pre_merge_check |
|---------|---------------|-----------------|------------|------------------|----------------|
| `get_minimal_context` | ✅ Step 1 | ✅ Step 1 | ✅ Step 1 | ✅ Step 1 | ✅ Step 1 |
| `detect_changes` | ✅ Step 2 | — | — | — | ✅ Step 2 |
| `get_affected_flows` | ⚙️ Step 4（>3函数时） | — | — | — | ⚙️ Step 3（risk>0.4） |
| `query_graph` | ⚙️ Step 3（高风险函数） | — | ✅ Step 3 | — | ⚙️ Step 4（test_gap>0） |
| `get_review_context` | ⚙️（仅需代码片段） | — | ⚙️ Step 5 | — | — |
| `get_impact_radius` | — | — | ⚙️ Step 5 | — | ⚙️ Step 6（risk>0.7） |
| `semantic_search_nodes` | — | — | ✅ Step 2 | — | — |
| `list_graph_stats` | — | — | — | ✅ Step 2 | — |
| `get_architecture_overview` | — | ✅ Step 2 | — | ✅ Step 3 | — |
| `list_communities` | — | — | — | ✅ Step 4 | — |
| `get_community` | — | ⚙️ Step 4（1-2个） | — | ⚙️（追问时） | — |
| `list_flows` | — | ✅ Step 3 | — | ✅ Step 5 | — |
| `get_flow` | — | — | ⚙️ Step 4 | ⚙️（追问时） | — |
| `refactor`（dead_code） | — | — | — | — | ✅ Step 5 |
| `find_large_functions` | — | — | — | — | ⚙️ Step 6（risk>0.7） |

**覆盖统计**：
- 5 个 Prompt 共涉及 15/24 个 MCP 工具
- `build_or_update_graph`、`run_postprocess`、`embed_graph`、`generate_wiki`、`get_wiki_page`、`list_repos`、`cross_repo_search`、`get_docs_section`、`apply_refactor` 未被任何 Prompt 使用（它们是独立操作型工具，不属于分析工作流）

---

## 五、设计模式总结

### 5.1 三层工作流结构

所有 5 个 Prompt 遵循相同的三层结构：

```
Layer 1 - 全局感知（必须）
  └─ get_minimal_context（1 次调用，~100 tokens）

Layer 2 - 场景特定分析（1-3 次调用）
  └─ detect_changes / architecture_overview / semantic_search...

Layer 3 - 条件深挖（0-3 次，仅高风险/用户追问时）
  └─ query_graph / get_flow / get_community...
```

### 5.2 条件分支触发阈值

| Prompt | 触发深挖的条件 | 深挖操作 |
|--------|-------------|---------|
| review_changes | risk == high | callers_of + affected_flows |
| review_changes | changed_functions > 3 | affected_flows |
| debug_issue | issue 涉及执行流 | get_flow |
| pre_merge_check | risk > 0.4 | affected_flows |
| pre_merge_check | test_gap > 0（最多3个） | tests_for |
| pre_merge_check | risk > 0.7 | find_large_functions + impact_radius |

### 5.3 Prompt 输出格式约定

| Prompt | 输出格式 |
|--------|---------|
| review_changes | 风险等级 + 变更摘要 + test_gaps + 具体建议 |
| architecture_map | Mermaid 图 + 社区表格 + 耦合告警 |
| debug_issue | 根因定位路径 + 调用链分析 |
| onboard_developer | 技术栈表格 + 模块表格 + Top 3 流 |
| pre_merge_check | **GO/NO-GO** + 1 句理由 + follow-up 列表 |

---

## 六、spec-first 实现指南

### 6.1 前提条件

实现 Prompt 之前**必须先实现 `serve` 命令**（MCP stdio 传输）。Prompt 是 MCP 服务器的一等公民，只有服务器运行时才能注册和响应 Prompt 请求。

### 6.2 实现方案（Node.js）

MCP SDK 的 JS 版支持通过 `server.setRequestHandler` 注册 Prompt：

```javascript
// src/crg/serve.js（新建）
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

const TOKEN_EFFICIENCY_PREAMBLE = `
## Rules for Token-Efficient Graph Usage
1. ALWAYS call \`get_minimal_context\` first with a task description.
2. Use \`detail_level="minimal"\` on all tool calls unless the minimal output is insufficient.
3. Only escalate to \`detail_level="standard"\` or \`"verbose"\` for specific entities.
4. Never request more than 3 tool calls per turn unless absolutely necessary.
5. Prefer targeted queries over broad scans.
6. When reviewing changes: detect_changes(detail_level="minimal") → only expand on high-risk items.
`;

// Prompt 注册（ListPromptsRequest）
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    { name: 'review_changes',    description: 'Pre-commit review workflow',         arguments: [{ name: 'base', required: false }] },
    { name: 'architecture_map',  description: 'Architecture documentation workflow', arguments: [] },
    { name: 'debug_issue',       description: 'Guided debugging workflow',           arguments: [{ name: 'description', required: false }] },
    { name: 'onboard_developer', description: 'New developer orientation workflow',  arguments: [] },
    { name: 'pre_merge_check',   description: 'PR merge readiness check',            arguments: [{ name: 'base', required: false }] },
  ],
}));

// Prompt 内容（GetPromptRequest）
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const base = args?.base || 'HEAD~1';
  const description = args?.description || '';
  
  const prompts = {
    review_changes:    buildReviewChangesPrompt(base),
    architecture_map:  buildArchitectureMapPrompt(),
    debug_issue:       buildDebugIssuePrompt(description),
    onboard_developer: buildOnboardDeveloperPrompt(),
    pre_merge_check:   buildPreMergeCheckPrompt(base),
  };
  
  return { messages: prompts[name] };
});
```

### 6.3 实现阻塞项

| Prompt | 阻塞项 | 阻塞原因 |
|--------|--------|---------|
| `review_changes` | B-2 detect-changes（Blocker） | 无 test_gaps 输出、无 risk_score 浮点值，Step 2 产出不完整 |
| `architecture_map` | M-8 communities（Major）、M-9 architecture（Major） | coupling warnings 缺失；communities 字段不完整 |
| `debug_issue` | M-7 flow（Major）、N-2 search（Minor） | flow 需 ID 查询；search 无语义搜索 |
| `onboard_developer` | M-4 stats（Major）、B-1 flows（Blocker） | stats 缺字段；flows criticality 全相同无法排序 Top 3 |
| `pre_merge_check` | `refactor` 命令（Missing）、B-2（Blocker） | Step 5 dead_code 检测完全无法运行；风险阈值条件失效 |

**可以先实现 Prompt 骨架，但以下步骤在上游工具修复前会产出不完整结果**：
- review_changes Step 2（test_gaps 字段缺失）
- pre_merge_check Step 5（refactor 调用会失败）
- onboard_developer Step 5（flows 排序无意义）

### 6.4 实现优先级建议

```
Phase 1（即可实现，产出有价值）：
  └─ architecture_map（依赖 context/architecture/flows/community，均有 CLI 等价，M-9 是小缺陷）
  └─ onboard_developer（依赖 context/stats/architecture/communities/flows，均有 CLI 等价，缺陷可接受）
  └─ debug_issue（依赖 context/search/query/flow，均有 CLI 等价，缺陷可接受）

Phase 2（P0 修复完成后）：
  └─ review_changes（需 B-2 detect-changes 提供 test_gaps 和 risk_score）
  └─ pre_merge_check（需 B-2 + refactor 命令实现）
```

---

## 七、附录：Prompt 完整源码

### review_changes（精简版，展示结构）

```python
[{
  "role": "user",
  "content": """
## Rules for Token-Efficient Graph Usage
1. ALWAYS call `get_minimal_context` first with a task description.
...（6条规则）

## Review Workflow
1. Call `get_minimal_context(task="review changes against HEAD~1")` to get risk overview.
2. If risk is "low": call `detect_changes(detail_level="minimal")` → report summary + any test gaps.
3. If risk is "medium" or "high":
   a. Call `detect_changes(detail_level="standard")` for full change list.
   b. For each high-risk function, call `query_graph(pattern="callers_of", target=<func>, detail_level="minimal")`.
   c. Call `get_affected_flows(detail_level="minimal")` only if >3 changed functions.
4. Summarize: risk level, what changed, test gaps, specific improvements needed.

Do NOT call get_review_context unless you need source code snippets for a specific function.
  """
}]
```

### pre_merge_check（精简版）

```python
[{
  "role": "user",
  "content": """
...（TOKEN_EFFICIENCY_PREAMBLE）

## Pre-Merge Check Workflow
1. Call `get_minimal_context(task="pre-merge check")`.
2. Call `detect_changes(detail_level="minimal")` for risk score and test gaps.
3. If risk > 0.4: call `get_affected_flows(detail_level="minimal")`.
4. If test_gap_count > 0: call `query_graph(pattern="tests_for", target=<each untested function>, detail_level="minimal")` for up to 3 functions.
5. Call `refactor(mode="dead_code", detail_level="minimal")` to check for newly dead code.
6. Only call `find_large_functions` or `get_impact_radius` if risk > 0.7.
7. Output: GO/NO-GO recommendation with 1-sentence justification + list of required follow-ups.
  """
}]
```
