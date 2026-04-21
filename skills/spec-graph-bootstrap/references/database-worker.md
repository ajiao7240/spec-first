# Database Discovery Handoff

> 本文件不再定义一个脚本驱动的重型 database worker。
> 当前设计改为：**LLM 负责数据库发现与证据收集，CLI 只提供受限的只读执行能力。**

## 目标边界

- bootstrap 只落盘两个数据库相关 machine surfaces：
  - `fact-inventory.database[]`：repo 内部的数据库 hints
  - `fact-inventory.database_schema[]`：schema / migration / ER docs 线索
- `database-routing.json` 只回答：
  - 当前策略是 `llm-led`
  - 本机有哪些只读数据库工具可用
  - 哪些 env key 已存在 / 缺失
  - 建议下一步是 `llm-inspect-repo` 还是 `llm-readonly-introspect`
- bootstrap **不再**负责：
  - 选主连接
  - 维护 `selected_route`
  - 维护 route state machine
  - 直接生成 `database/` 文档族

## LLM-first 流程

1. LLM 读取：
   - `fact-inventory.database[]`
   - `fact-inventory.database_schema[]`
   - `database-routing.json`
   - 以及 repo 内它认为需要进一步查看的真实文件
2. LLM 自己判断：
   - 哪个配置来源最可信
   - 当前仓库是否真的有数据库
   - 是否应走 live introspection
   - 如果 live 不可行，是否可以走 schema-only
3. 当 `database-routing.json.recommended_action = llm-readonly-introspect` 时，
   LLM 可以选择只读 CLI 继续分析，例如 `mysql`。

## CLI 安全边界

- 仅允许只读探测
- 不落盘 secret 值
- 不自动执行写操作
- 工具不可用时，只在 `database-routing.json.blockers[]` 中记录事实

## 输出姿势

数据库分析结果应由调用当前 workflow 的 LLM 在后续阶段按需生成，而不是由 bootstrap 预生成一整套固定 `database/` 文档。

bootstrap 只提供：

- repo 内数据库 hints
- schema sources
- 只读工具可用性
- env key 可用性

这些信息足够支撑后续 `plan / work / review` 阶段做按需数据库分析。
