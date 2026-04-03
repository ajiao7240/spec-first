# 角色目录

15 个审阅者角色组织成始终在线、横切条件和堆栈特定条件层，以及特定于 CE 的代理。编排器使用此目录来选择为每个审阅生成哪些审阅者。

## 始终在线（4 个角色 + 2 个 CE 代理）

无论内容如何，​​都会在每次评论中产生。

**角色代理（结构化 JSON 输出）：**

| 人格面具 | 代理人 | 重点 |
|---------|-------|-------|
| `correctness` | `spec-first:review:correctness-reviewer` | 逻辑错误、边缘情况、状态错误、错误传播、意图合规性 |
| `testing` | `spec-first:review:testing-reviewer` | 覆盖范围差距、弱断言、脆弱测试、缺少边缘情况测试 |
| `maintainability` | `spec-first:review:maintainability-reviewer` | 耦合、复杂性、命名、死代码、过早抽象 |
| `project-standards` | `spec-first:review:project-standards-reviewer` | CLAUDE.md 和 AGENTS.md 合规性——前言、参考文献、命名、跨平台可移植性、工具选择 |

**CE 代理（非结构化输出，单独合成）：**

| 代理人 | 重点 |
|-------|-------|
| `spec-first:review:agent-native-reviewer` | 验证新功能是否可供代理访问 |
| `spec-first:research:learnings-researcher` | 搜索 docs/solutions/ 以查找与此 PR 模块和模式相关的过去问题 |

## 有条件（6 个角色）

当协调器识别差异中的相关模式时生成。协调器读取完整的差异和选择的原因——这是代理判断，而不是关键字匹配。

| 人格面具 | 代理人 | 当 diff 接触时选择... |
|---------|-------|---------------------------|
| `security` | `spec-first:review:security-reviewer` | 身份验证中间件、公共端点、用户输入处理、权限检查、机密管理 |
| `performance` | `spec-first:review:performance-reviewer` | 数据库查询、ORM 调用、循环密集型数据转换、缓存层、异步/并发代码 |
| `api-contract` | `spec-first:review:api-contract-reviewer` | 路由定义、序列化器/接口更改、事件模式、导出类型签名、API 版本控制 |
| `data-migrations` | `spec-first:review:data-migrations-reviewer` | 迁移文件、架构更改、回填脚本、数据转换 |
| `reliability` | `spec-first:review:reliability-reviewer` | 错误处理、重试逻辑、断路器、超时、后台作业、异步处理程序、运行状况检查 |
| `adversarial` | `spec-first:review:adversarial-reviewer` | Diff 已更改 >=50 个非测试、非生成、非锁定文件行，或涉及身份验证、支付、数据突变、外部 API 集成或其他高风险域 |

## 堆栈特定条件（5 个角色）

这些评论家保留了他们最初固执己见的镜头。它们是上述交叉角色的补充，而不是替代品。

| 人格面具 | 代理人 | 当 diff 接触时选择... |
|---------|-------|---------------------------|
| `dhh-rails` | `spec-first:review:dhh-rails-reviewer` | Rails 架构、服务对象、身份验证/会话选择、Hotwire-vs-SPA 边界或可能违反 Rails 约定的抽象 |
| `kieran-rails` | `spec-first:review:kieran-rails-reviewer` | Rails 控制器、模型、视图、作业、组件、路由或其他应用程序层 Ruby 代码（其中清晰度和约定很重要） |
| `kieran-python` | `spec-first:review:kieran-python-reviewer` | Python 模块、端点、服务、脚本或类型化域代码 |
| `kieran-typescript` | `spec-first:review:kieran-typescript-reviewer` | TypeScript 组件、服务、挂钩、实用程序或共享类型 |
| `julik-frontend-races` | `spec-first:review:julik-frontend-races-reviewer` | Stimulus/Turbo 控制器、DOM 事件连接、计时器、异步 UI 流、动画或具有竞争潜力的前端状态转换 |

## CE 条件代理（特定于迁移）

这些 CE 本地代理提供超出角色代理所涵盖范围的专业分析。当差异包含数据库迁移、schema.rb 或数据回填时生成它们。

| 代理人 | 重点 |
|-------|-------|
| `spec-first:review:schema-drift-detector` | 交叉引用 schema.rb 针对包含的迁移进行更改以捕获不相关的漂移 |
| `spec-first:review:deployment-verification-agent` | 生成包含 SQL 验证查询和回滚过程的 Go/No-Go 部署清单 |

## 评选规则

1. **始终生成所有 4 个始终在线角色**以及 2 个 CE 始终在线代理。
2. **对于每个横切条件角色**，协调器读取差异并决定角色的域是否相关。这是一个判断调用，而不是关键字匹配。
3. **对于每个特定于堆栈的条件角色**，使用文件类型和更改的模式作为起点，然后确定差异是否实际上为该审阅者引入了有意义的工作。不要仅仅因为一个配置或生成的文件恰好与扩展名匹配而产生特定于语言的审阅者。
4. **对于 CE 条件代理**，当差异包含迁移文件（`db/migrate/*.rb`、`db/schema.rb`）或数据回填脚本时生成。
5. **在生成之前宣布团队**，并为每个选定的条件审核者提供一行理由。
