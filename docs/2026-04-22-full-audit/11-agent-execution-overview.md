# 多 Agent 执行总览

## 执行配置

- 分域 agent：5 个
- 主裁决 agent：1 个
- 主线程：承担文档辩论、整合写作、测试执行
- 平台限制：同时在线 agent 上限为 6，因此“文档治理与辩论”由主线程承担，释放名额给主裁决 agent

## Agent 角色边界

| Agent | 职责边界 | 不负责 |
| --- | --- | --- |
| Agent A | `src/cli`、`bin/`、`package.json`、`.claude-plugin/plugin.json`、根治理文件 | 不审 bootstrap-compiler、CRG、tests |
| Agent B | `src/bootstrap-compiler`、`src/context-routing`、相关 schema | 不审 CLI、skills、tests |
| Agent C | `src/crg` 全量 | 不审 CLI、bootstrap、tests |
| Agent D | `skills/`、`agents/`、dual-host governance、mirror | 不审源码实现深处 |
| Agent E | `tests/`、测试脚本接线、发布验证链 | 不重做所有业务代码审查 |
| Agent G | 主裁决，归并冲突、输出最终分类与路线图 | 不新增代码事实采集 |

## 主线程职责

- 读取 `项目角色.md` 与 `项目治理-agent.md`
- 建立全量代码地图
- 实跑 `npm test`
- 识别被审文档是未跟踪草案
- 汇总 5 个分域 agent 的事实结论
- 把统一输入交给主裁决 agent
- 生成 15 份审计文档草案

## 执行顺序

1. 主线程完成 workflow 判定与强制前置阅读
2. 主线程建立目录级覆盖地图
3. 5 个分域 agent 并行采集事实
4. 主线程并行读取关键入口代码并运行测试
5. 主线程统一压缩事实结论
6. 主裁决 agent 输出最终裁决
7. 主线程生成审计文档草案

## 协作原则

- 单一真相源：代码与 contract 优先，文档辅助
- 先事实，后判断
- 每个 agent 的职责不漂移
- 主裁决 agent 不改写事实，只归并分歧
- 主线程只在平台限制下接管一个角色，不影响多 agent 要求

## 覆盖完整性说明

- Agent A-E 的边界相加，覆盖了本次审计所需的代码、contract、asset、测试、文档镜像全部核心区域。
- `vendor/` 作为第三方边界说明纳入地图，不纳入设计优劣主审。

## 产出分工

- Agent A：CLI/control-plane 发现
- Agent B：control-plane/read-model/contract 发现
- Agent C：CRG 发现
- Agent D：workflow asset/governance drift 发现
- Agent E：测试与工程质量发现
- Agent G：最终裁决
- 主线程：辩论、整合、文档落盘
