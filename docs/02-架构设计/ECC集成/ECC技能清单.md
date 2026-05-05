# ECC Skills 技能清单

本文档基于仓库源码自动整理，扫描范围为 `skills/*/SKILL.md`。

`.claude-plugin/plugin.json` 当前声明 `"skills": ["./skills/"]`，因此 Claude Code 插件安装面会导出整个 `skills/` 目录。根目录 `agent.yaml` 另有一份 `skills:` 清单，用于 gitagent/辅助导出表面；它不是 Claude Code 插件是否导出某个 skill 的唯一依据。

## 统计

- 源码技能定义总数：182
- Claude Code 插件目录导出：182
- 出现在 `agent.yaml` skills 清单中：133
- 源码存在但未在 `agent.yaml` skills 清单中声明：49

## 标识说明

| 标识 | 含义 | 判定依据 |
|---|---|---|
| agent.yaml 已声明 | 出现在 gitagent/辅助导出表面的 skill 清单中 | 技能名出现在 `agent.yaml` 的 `skills:` 中 |
| 未列入 agent.yaml | 源码中存在，但当前 `agent.yaml` 未声明 | 存在 `skills/<name>/SKILL.md`，但不在 `agent.yaml` |

## 准确性校验

校验日期：2026-05-05。

- `skills/*/SKILL.md` 当前共 182 个。
- `agent.yaml` 当前声明 133 个 skill，且这 133 个在源码中全部存在。
- 源码中另有 49 个 skill 未列入 `agent.yaml`；这表示未进入 gitagent/辅助导出清单，不表示 Claude Code 插件 manifest 不导出它们。
- `skills/repo-scan/SKILL.md` 当前没有 YAML frontmatter，因此表格中该项标题为空是源码事实，不是解析遗漏。

## 技能总表

| # | agent.yaml 状态 | 技能名 | 分类 | 标题 | 用途说明 | 来源 | 源码路径 |
|---:|---|---|---|---|---|---|---|
| 1 | agent.yaml 已声明 | `agent-harness-construction` | Agent / 工具链 / 运维 | Agent Harness Construction | 设计并优化 AI Agent 的行动空间、工具定义和观察结果格式，以提升任务完成率。 | ECC | `skills/agent-harness-construction/SKILL.md` |
| 2 | agent.yaml 已声明 | `agent-payment-x402` | Agent / 工具链 / 运维 | Agent Payment Execution (x402) | 为 AI Agent 添加 x402 支付执行能力，包括单任务预算、支出控制，以及通过 MCP 工具使用非托管钱包；适用于 Agent 需要为 API、服务或其他 Agent 付费的场景。 | community | `skills/agent-payment-x402/SKILL.md` |
| 3 | agent.yaml 已声明 | `agentic-engineering` | Agent / 工具链 / 运维 | Agentic Engineering | 以评估优先、任务拆解和成本感知模型路由的方式，按 Agentic Engineering 模式执行工程任务。 | ECC | `skills/agentic-engineering/SKILL.md` |
| 4 | agent.yaml 已声明 | `autonomous-loops` | Agent / 工具链 / 运维 | Autonomous Loops Skill | 提供自主 Claude Code 循环的模式和架构，从简单顺序流水线到基于 RFC 的多 Agent DAG 系统。 | ECC | `skills/autonomous-loops/SKILL.md` |
| 5 | agent.yaml 已声明 | `claude-devfleet` | Agent / 工具链 / 运维 | Claude DevFleet Multi-Agent Orchestration | 通过 Claude DevFleet 编排多 Agent 编码任务，包括规划项目、在隔离 worktree 中并行派发 Agent、监控进度并读取结构化报告。 | community | `skills/claude-devfleet/SKILL.md` |
| 6 | agent.yaml 已声明 | `configure-ecc` | Agent / 工具链 / 运维 | Configure Everything Claude Code (ECC) | Everything Claude Code 的交互式安装器，引导用户选择并安装技能和规则到用户级或项目级目录，校验路径，并可选择优化已安装文件。 | ECC | `skills/configure-ecc/SKILL.md` |
| 7 | agent.yaml 已声明 | `context-budget` | Agent / 工具链 / 运维 | Context Budget | 审计 Claude Code 在 Agent、技能、MCP 服务器和规则上的上下文窗口消耗，识别臃肿与冗余组件，并给出按优先级排序的 token 节省建议。 | ECC | `skills/context-budget/SKILL.md` |
| 8 | agent.yaml 已声明 | `continuous-agent-loop` | Agent / 工具链 / 运维 | Continuous Agent Loop | 提供带质量门、评估和恢复控制的连续自主 Agent 循环模式。 | ECC | `skills/continuous-agent-loop/SKILL.md` |
| 9 | agent.yaml 已声明 | `cost-aware-llm-pipeline` | Agent / 工具链 / 运维 | Cost-Aware LLM Pipeline | 提供 LLM API 使用成本优化模式，包括按任务复杂度路由模型、预算跟踪、重试逻辑和提示缓存。 | ECC | `skills/cost-aware-llm-pipeline/SKILL.md` |
| 10 | agent.yaml 已声明 | `data-scraper-agent` | Agent / 工具链 / 运维 | Data Scraper Agent | 构建全自动 AI 数据采集 Agent，用于从招聘、价格、新闻、GitHub、体育等任意公开来源定时抓取数据，用免费 LLM 丰富内容，存入 Notion、Sheets 或 Supabase，并从用户反馈中学习；适用于自动监控、收集或跟踪公开数据。 | community | `skills/data-scraper-agent/SKILL.md` |
| 11 | agent.yaml 已声明 | `deployment-patterns` | Agent / 工具链 / 运维 | Deployment Patterns | 提供 Web 应用的部署工作流、CI/CD 流水线模式、Docker 容器化、健康检查、回滚策略和生产就绪清单。 | ECC | `skills/deployment-patterns/SKILL.md` |
| 12 | agent.yaml 已声明 | `dmux-workflows` | Agent / 工具链 / 运维 | dmux Workflows | 使用 dmux（面向 AI Agent 的 tmux 面板管理器）进行多 Agent 编排，支持 Claude Code、Codex、OpenCode 等环境下的并行 Agent 工作流；适用于并行运行多个 Agent 会话或协调多 Agent 开发。 | ECC | `skills/dmux-workflows/SKILL.md` |
| 13 | agent.yaml 已声明 | `enterprise-agent-ops` | Agent / 工具链 / 运维 | Enterprise Agent Ops | 以可观测性、安全边界和生命周期管理来运行长期 Agent 工作负载。 | ECC | `skills/enterprise-agent-ops/SKILL.md` |
| 14 | agent.yaml 已声明 | `git-workflow` | Agent / 工具链 / 运维 | Git Workflow Patterns | 提供 Git 工作流模式，包括分支策略、提交约定、合并与 rebase 选择、冲突解决，以及适合不同规模团队的协作开发最佳实践。 | ECC | `skills/git-workflow/SKILL.md` |
| 15 | agent.yaml 已声明 | `mcp-server-patterns` | Agent / 工具链 / 运维 | MCP Server Patterns | 使用 Node/TypeScript SDK 构建 MCP 服务器，涵盖工具、资源、提示、Zod 校验、stdio 与 Streamable HTTP；最新 API 请结合 Context7 或官方 MCP 文档。 | ECC | `skills/mcp-server-patterns/SKILL.md` |
| 16 | agent.yaml 已声明 | `prompt-optimizer` | Agent / 工具链 / 运维 | Prompt Optimizer | 分析原始提示词，识别意图和缺口，匹配 ECC 组件（技能、命令、Agent、Hook），并输出可直接粘贴的优化提示词。仅提供建议，不执行任务。触发：用户要求优化、改写或改进提示词，或询问如何为某任务写提示词。不要在用户要求直接执行任务、说“直接做”，或讨论代码/性能优化时触发。 | community | `skills/prompt-optimizer/SKILL.md` |
| 17 | agent.yaml 已声明 | `rules-distill` | Agent / 工具链 / 运维 | Rules Distill | 扫描技能以提取跨技能通用原则，并将其沉淀为规则；可追加、修订或创建规则文件。 | ECC | `skills/rules-distill/SKILL.md` |
| 18 | agent.yaml 已声明 | `skill-comply` | Agent / 工具链 / 运维 | skill-comply: Automated Compliance Measurement | 可视化技能、规则和 Agent 定义是否被实际遵循：自动生成三种提示严格度的场景，运行 Agent，分类行为序列，并以完整工具调用时间线报告遵循率。 | ECC | `skills/skill-comply/SKILL.md` |
| 19 | agent.yaml 已声明 | `skill-stocktake` | Agent / 工具链 / 运维 | skill-stocktake | 用于审计 Claude 技能和命令质量，支持只检查变更技能的快速扫描，以及通过顺序子 Agent 批量评估的完整盘点模式。 | ECC | `skills/skill-stocktake/SKILL.md` |
| 20 | agent.yaml 已声明 | `token-budget-advisor` | Agent / 工具链 / 运维 | Token Budget Advisor (TBA) | 在回答前帮助用户有意识地选择响应深度和 token 消耗。适用于用户明确想控制回答长度、深度或 token 预算的场景；当用户已指定深度、请求明显只需单词回答，或 token 指认证/会话/支付令牌时不触发。 | community | `skills/token-budget-advisor/SKILL.md` |
| 21 | agent.yaml 已声明 | `carrier-relationship-management` | 业务运营 | Carrier Relationship Management | 沉淀承运商组合管理、运价谈判、绩效跟踪、运力分配和战略承运商关系维护经验，包含评分卡、RFP、市场情报和合规审查框架；适用于管理承运商、谈判费率、评估绩效或制定货运策略。 | ECC | `skills/carrier-relationship-management/SKILL.md` |
| 22 | agent.yaml 已声明 | `energy-procurement` | 业务运营 | Energy Procurement | 沉淀电力和天然气采购、费率优化、需量电费管理、可再生能源 PPA 评估和多设施能源成本管理经验，包含市场结构分析、对冲策略、负荷画像和可持续发展报告框架；适用于能源采购、费率优化、需量管理、PPA 评估和能源策略制定。 | ECC | `skills/energy-procurement/SKILL.md` |
| 23 | agent.yaml 已声明 | `inventory-demand-planning` | 业务运营 | Inventory Demand Planning | 沉淀多门店零售场景下的需求预测、安全库存优化、补货计划和促销提升估算经验，包含预测方法选择、ABC/XYZ 分析、季节切换管理和供应商谈判框架；适用于预测需求、设定安全库存、规划补货、管理促销或优化库存水平。 | ECC | `skills/inventory-demand-planning/SKILL.md` |
| 24 | agent.yaml 已声明 | `logistics-exception-management` | 业务运营 | Logistics Exception Management | 沉淀货运异常、延迟、破损、丢失和承运商争议处理经验，包含升级协议、承运商行为模式、索赔流程和判断框架；适用于处理运输异常、货运索赔、交付问题或承运商争议。 | ECC | `skills/logistics-exception-management/SKILL.md` |
| 25 | agent.yaml 已声明 | `production-scheduling` | 业务运营 | Production Scheduling | 沉淀离散制造和批量制造中的生产排程、作业排序、产线平衡、换线优化和瓶颈解决经验，包含 TOC/鼓-缓冲-绳、SMED、OEE 分析、扰动响应框架和 ERP/MES 交互模式；适用于排产、解决瓶颈、优化换线、响应扰动或平衡产线。 | ECC | `skills/production-scheduling/SKILL.md` |
| 26 | agent.yaml 已声明 | `returns-reverse-logistics` | 业务运营 | Returns & Reverse Logistics | 沉淀退货授权、收货检验、处置决策、退款处理、欺诈检测和保修索赔管理经验，包含分级框架、处置经济性、欺诈模式识别和供应商追偿流程；适用于处理产品退货、逆向物流、退款决策、退货欺诈检测或保修索赔。 | ECC | `skills/returns-reverse-logistics/SKILL.md` |
| 27 | agent.yaml 已声明 | `article-writing` | 内容 / 媒体 / 增长 | Article Writing | 撰写文章、指南、博客、教程、通讯和其他长篇内容，并依据示例或品牌指南形成独特文风；适用于用户需要段落以上的成稿，尤其重视语气一致、结构清晰和可信度的场景。 | ECC | `skills/article-writing/SKILL.md` |
| 28 | agent.yaml 已声明 | `content-engine` | 内容 / 媒体 / 增长 | Content Engine | 为 X、LinkedIn、TikTok、YouTube、通讯及多平台复用活动创建平台原生内容系统；适用于社交帖、长帖、脚本、内容日历，或将单一素材清晰改写为多平台内容。 | ECC | `skills/content-engine/SKILL.md` |
| 29 | agent.yaml 已声明 | `content-hash-cache-pattern` | 内容 / 媒体 / 增长 | Content-Hash File Cache Pattern | 使用 SHA-256 内容哈希缓存昂贵的文件处理结果，具备路径无关、自动失效和服务层隔离等特性。 | ECC | `skills/content-hash-cache-pattern/SKILL.md` |
| 30 | agent.yaml 已声明 | `crosspost` | 内容 / 媒体 / 增长 | Crosspost | 跨 X、LinkedIn、Threads 和 Bluesky 分发多平台内容，并按平台调整表达方式，避免简单复制；适用于用户希望将内容分发到多个社交平台的场景。 | ECC | `skills/crosspost/SKILL.md` |
| 31 | agent.yaml 已声明 | `fal-ai-media` | 内容 / 媒体 / 增长 | fal.ai Media Generation | 通过 fal.ai MCP 统一生成图片、视频和音频，涵盖文生图、文/图生视频、文本转语音和视频转音频；适用于用户希望用 AI 生成图片、视频或音频的场景。 | ECC | `skills/fal-ai-media/SKILL.md` |
| 32 | agent.yaml 已声明 | `investor-materials` | 内容 / 媒体 / 增长 | Investor Materials | 创建和更新融资演示文稿、一页纸、投资人备忘录、加速器申请、财务模型和募资材料；适用于需要面向投资人的文档、预测、资金用途表、里程碑计划，或要求多份募资材料保持一致的场景。 | ECC | `skills/investor-materials/SKILL.md` |
| 33 | agent.yaml 已声明 | `investor-outreach` | 内容 / 媒体 / 增长 | Investor Outreach | 为募资撰写冷邮件、熟人引荐文案、跟进邮件、进展更新和投资人沟通内容；适用于面向天使投资人、VC、战略投资者或加速器的简洁、个性化投资人沟通。 | ECC | `skills/investor-outreach/SKILL.md` |
| 34 | agent.yaml 已声明 | `video-editing` | 内容 / 媒体 / 增长 | Video Editing | 提供 AI 辅助视频剪辑工作流，用于裁剪、结构化和增强真实素材，覆盖从原始拍摄到 FFmpeg、Remotion、ElevenLabs、fal.ai，再到 Descript 或 CapCut 精修的完整流程；适用于剪视频、裁素材、制作 vlog 或搭建视频内容。 | ECC | `skills/video-editing/SKILL.md` |
| 35 | agent.yaml 已声明 | `videodb` | 内容 / 媒体 / 增长 | VideoDB Skill | 看见、理解并处理视频和音频：可从本地文件、URL、RTSP/直播源或桌面录制导入，返回实时上下文和可播放流链接；可抽帧、构建视觉/语义/时间索引并按时间戳搜索片段；可转码规范化、进行时间线编辑、生成媒体资产，并为直播或桌面捕获中的事件创建实时告警。 | ECC | `skills/videodb/SKILL.md` |
| 36 | agent.yaml 已声明 | `x-api` | 内容 / 媒体 / 增长 | X API | 集成 X/Twitter API，用于发推、发布长帖、读取时间线、搜索和分析，涵盖 OAuth 认证模式、速率限制和平台原生内容发布；适用于需要以编程方式操作 X 的场景。 | ECC | `skills/x-api/SKILL.md` |
| 37 | agent.yaml 已声明 | `api-design` | 前端 / UI / 体验 | API Design Patterns | 提供生产级 REST API 设计模式，包括资源命名、状态码、分页、过滤、错误响应、版本控制和限流。 | ECC | `skills/api-design/SKILL.md` |
| 38 | agent.yaml 已声明 | `browser-qa` | 前端 / UI / 体验 | Browser QA — Automated Visual Testing & Interaction | 用于在功能部署后通过浏览器自动化执行视觉测试和 UI 交互验证。 | ECC | `skills/browser-qa/SKILL.md` |
| 39 | agent.yaml 已声明 | `click-path-audit` | 前端 / UI / 体验 | /click-path-audit — Behavioural Flow Audit | 跟踪每个面向用户的按钮或触点的完整状态变化序列，以发现单个函数可用但相互抵消、产生错误最终状态或让 UI 不一致的问题；适用于系统性调试无果但用户反馈按钮异常，或大型重构触及共享状态存储之后。 | community | `skills/click-path-audit/SKILL.md` |
| 40 | agent.yaml 已声明 | `design-system` | 前端 / UI / 体验 | Design System — Generate & Audit Visual Systems | 用于生成或审计设计系统，检查视觉一致性，并审查涉及样式变更的 PR。 | ECC | `skills/design-system/SKILL.md` |
| 41 | agent.yaml 已声明 | `frontend-patterns` | 前端 / UI / 体验 | Frontend Development Patterns | 提供 React、Next.js、状态管理、性能优化和 UI 最佳实践等前端开发模式。 | ECC | `skills/frontend-patterns/SKILL.md` |
| 42 | agent.yaml 已声明 | `frontend-slides` | 前端 / UI / 体验 | Frontend Slides | 从零创建精美且动画丰富的 HTML 演示文稿，或将 PowerPoint 转为 Web 演示；适用于构建演示、转换 PPT/PPTX，或为演讲/路演制作幻灯片，并帮助非设计师通过视觉探索找到审美方向。 | ECC | `skills/frontend-slides/SKILL.md` |
| 43 | agent.yaml 已声明 | `liquid-glass-design` | 前端 / UI / 体验 | Liquid Glass Design System (iOS 26) | iOS 26 Liquid Glass 设计系统：面向 SwiftUI、UIKit 和 WidgetKit 的动态玻璃材质、模糊、反射和交互式变形。 |  | `skills/liquid-glass-design/SKILL.md` |
| 44 | agent.yaml 已声明 | `swiftui-patterns` | 前端 / UI / 体验 | SwiftUI Patterns | SwiftUI 架构模式，包括 @Observable 状态管理、视图组合、导航、性能优化，以及现代 iOS/macOS UI 最佳实践。 |  | `skills/swiftui-patterns/SKILL.md` |
| 45 | agent.yaml 已声明 | `team-builder` | 前端 / UI / 体验 | Team Builder | 交互式 Agent 选择器，用于组合并派发并行团队。 | community | `skills/team-builder/SKILL.md` |
| 46 | agent.yaml 已声明 | `customs-trade-compliance` | 安全 / 合规 | Customs & Trade Compliance | 沉淀多司法辖区下的海关单证、税则归类、关税优化、受限方筛查和法规合规经验，包含 HS 归类逻辑、Incoterms 应用、FTA 利用和罚款缓释；适用于清关、税则归类、贸易合规、进出口单证或关税优化。 | ECC | `skills/customs-trade-compliance/SKILL.md` |
| 47 | agent.yaml 已声明 | `django-security` | 安全 / 合规 | Django Security Best Practices | Django 安全最佳实践，包括认证、授权、CSRF 防护、SQL 注入防护、XSS 防护和安全部署配置。 | ECC | `skills/django-security/SKILL.md` |
| 48 | agent.yaml 已声明 | `healthcare-phi-compliance` | 安全 / 合规 | Healthcare PHI/PII Compliance Patterns | 面向医疗应用的受保护健康信息（PHI）和个人身份信息（PII）合规模式，涵盖数据分类、访问控制、审计日志、加密和常见泄漏路径。 | Health1 Super Speciality Hospitals — contributed by Dr. Keyur Patel | `skills/healthcare-phi-compliance/SKILL.md` |
| 49 | agent.yaml 已声明 | `laravel-security` | 安全 / 合规 | Laravel Security Best Practices | Laravel 安全最佳实践，涵盖认证/授权、验证、CSRF、批量赋值、文件上传、密钥、限流和安全部署。 | ECC | `skills/laravel-security/SKILL.md` |
| 50 | agent.yaml 已声明 | `perl-security` | 安全 / 合规 | Perl Security Patterns | 全面的 Perl 安全模式，涵盖 taint 模式、输入验证、安全进程执行、DBI 参数化查询、Web 安全（XSS/SQLi/CSRF）和 perlcritic 安全策略。 | ECC | `skills/perl-security/SKILL.md` |
| 51 | agent.yaml 已声明 | `ralphinho-rfc-pipeline` | 安全 / 合规 | Ralphinho RFC Pipeline | 基于 RFC 的多 Agent DAG 执行模式，包含质量门、合并队列和工作单元编排。 | ECC | `skills/ralphinho-rfc-pipeline/SKILL.md` |
| 52 | agent.yaml 已声明 | `repo-scan` | 安全 / 合规 | repo-scan |  |  | `skills/repo-scan/SKILL.md` |
| 53 | agent.yaml 已声明 | `safety-guard` | 安全 / 合规 | Safety Guard — Prevent Destructive Operations | 用于在生产系统或自主运行 Agent 时防止破坏性操作。 | ECC | `skills/safety-guard/SKILL.md` |
| 54 | agent.yaml 已声明 | `security-review` | 安全 / 合规 | Security Review Skill | 适用于添加认证、处理用户输入、管理密钥、创建 API 端点或实现支付/敏感功能的场景，提供全面的安全检查清单和模式。 | ECC | `skills/security-review/SKILL.md` |
| 55 | agent.yaml 已声明 | `security-scan` | 安全 / 合规 | Security Scan Skill | 使用 AgentShield 扫描 Claude Code 配置（.claude/ 目录）中的安全漏洞、错误配置和注入风险，检查 CLAUDE.md、settings.json、MCP 服务器、Hook 和 Agent 定义。 | ECC | `skills/security-scan/SKILL.md` |
| 56 | agent.yaml 已声明 | `springboot-security` | 安全 / 合规 | Spring Boot Security Review | Java Spring Boot 服务中的 Spring Security 最佳实践，涵盖认证/授权、验证、CSRF、密钥、响应头、限流和依赖安全。 | ECC | `skills/springboot-security/SKILL.md` |
| 57 | agent.yaml 已声明 | `clickhouse-io` | 数据库 / 持久化 | ClickHouse Analytics Patterns | ClickHouse 数据库模式、查询优化、分析和数据工程最佳实践，面向高性能分析型工作负载。 | ECC | `skills/clickhouse-io/SKILL.md` |
| 58 | agent.yaml 已声明 | `database-migrations` | 数据库 / 持久化 | Database Migration Patterns | 跨 PostgreSQL、MySQL 和常见 ORM（Prisma、Drizzle、Kysely、Django、TypeORM、golang-migrate）的数据库迁移最佳实践，涵盖模式变更、数据迁移、回滚和零停机部署。 | ECC | `skills/database-migrations/SKILL.md` |
| 59 | agent.yaml 已声明 | `jpa-patterns` | 数据库 / 持久化 | JPA/Hibernate Patterns | Spring Boot 中的 JPA/Hibernate 模式，涵盖实体设计、关系、查询优化、事务、审计、索引、分页和连接池。 | ECC | `skills/jpa-patterns/SKILL.md` |
| 60 | agent.yaml 已声明 | `postgres-patterns` | 数据库 / 持久化 | PostgreSQL Patterns | PostgreSQL 数据库模式，用于查询优化、模式设计、索引和安全，基于 Supabase 最佳实践。 | ECC | `skills/postgres-patterns/SKILL.md` |
| 61 | agent.yaml 已声明 | `agent-eval` | 测试 / 评估 / 质量 | Agent Eval Skill | 在自定义任务上对 Claude Code、Aider、Codex 等编码 Agent 进行正面对比，评估通过率、成本、耗时和一致性指标。 | ECC | `skills/agent-eval/SKILL.md` |
| 62 | agent.yaml 已声明 | `ai-regression-testing` | 测试 / 评估 / 质量 | AI Regression Testing | AI 辅助开发的回归测试策略，包括无数据库依赖的沙箱模式 API 测试、自动化缺陷检查工作流，以及捕捉同一模型编写并审查代码时盲点的模式。 | ECC | `skills/ai-regression-testing/SKILL.md` |
| 63 | agent.yaml 已声明 | `cpp-testing` | 测试 / 评估 / 质量 | C++ Testing (Agent Skill) | 仅在编写、更新或修复 C++ 测试，配置 GoogleTest/CTest，诊断失败或不稳定测试，或添加覆盖率/消毒器时使用。 | ECC | `skills/cpp-testing/SKILL.md` |
| 64 | agent.yaml 已声明 | `django-tdd` | 测试 / 评估 / 质量 | Django Testing with TDD | Django 测试策略，涵盖 pytest-django、TDD 方法、factory_boy、mock、覆盖率和 Django REST Framework API 测试。 | ECC | `skills/django-tdd/SKILL.md` |
| 65 | agent.yaml 已声明 | `django-verification` | 测试 / 评估 / 质量 | Django Verification Loop | Django 项目的验证循环：发布或提交 PR 前检查迁移、lint、带覆盖率测试、安全扫描和部署就绪情况。 | ECC | `skills/django-verification/SKILL.md` |
| 66 | agent.yaml 已声明 | `e2e-testing` | 测试 / 评估 / 质量 | E2E Testing Patterns | Playwright E2E 测试模式，涵盖页面对象模型、配置、CI/CD 集成、产物管理和不稳定测试策略。 | ECC | `skills/e2e-testing/SKILL.md` |
| 67 | agent.yaml 已声明 | `eval-harness` | 测试 / 评估 / 质量 | Eval Harness Skill | 面向 Claude Code 会话的正式评估框架，贯彻评估驱动开发（EDD）原则。 | ECC | `skills/eval-harness/SKILL.md` |
| 68 | agent.yaml 已声明 | `golang-testing` | 测试 / 评估 / 质量 | Go Testing Patterns | Go 测试模式，包括表驱动测试、子测试、基准测试、模糊测试和测试覆盖率，并遵循 TDD 方法和惯用 Go 实践。 | ECC | `skills/golang-testing/SKILL.md` |
| 69 | agent.yaml 已声明 | `healthcare-eval-harness` | 测试 / 评估 / 质量 | Healthcare Eval Harness — Patient Safety Verification | 医疗应用部署的患者安全评估框架，包含 CDSS 准确性、PHI 暴露、临床工作流完整性和集成合规的自动化测试套件，并在安全失败时阻断部署。 | Health1 Super Speciality Hospitals — contributed by Dr. Keyur Patel | `skills/healthcare-eval-harness/SKILL.md` |
| 70 | agent.yaml 已声明 | `iterative-retrieval` | 测试 / 评估 / 质量 | Iterative Retrieval Pattern | 通过渐进式优化上下文检索来解决子 Agent 上下文问题的模式。 | ECC | `skills/iterative-retrieval/SKILL.md` |
| 71 | agent.yaml 已声明 | `kotlin-testing` | 测试 / 评估 / 质量 | Kotlin Testing Patterns | Kotlin 测试模式，涵盖 Kotest、MockK、协程测试、基于属性的测试和 Kover 覆盖率，并遵循 TDD 方法和惯用 Kotlin 实践。 | ECC | `skills/kotlin-testing/SKILL.md` |
| 72 | agent.yaml 已声明 | `laravel-tdd` | 测试 / 评估 / 质量 | Laravel TDD Workflow | Laravel 的测试驱动开发，使用 PHPUnit 和 Pest，涵盖工厂、数据库测试、fake 和覆盖率目标。 | ECC | `skills/laravel-tdd/SKILL.md` |
| 73 | agent.yaml 已声明 | `laravel-verification` | 测试 / 评估 / 质量 | Laravel Verification Loop | Laravel 项目的验证循环：环境检查、lint、静态分析、带覆盖率测试、安全扫描和部署就绪检查。 | ECC | `skills/laravel-verification/SKILL.md` |
| 74 | agent.yaml 已声明 | `perl-testing` | 测试 / 评估 / 质量 | Perl Testing Patterns | 使用 Test2::V0、Test::More、prove 运行器、mock 和 Devel::Cover 覆盖率的 Perl 测试模式，并结合 TDD 方法。 | ECC | `skills/perl-testing/SKILL.md` |
| 75 | agent.yaml 已声明 | `plankton-code-quality` | 测试 / 评估 / 质量 | Plankton Code Quality Skill | 使用 Plankton 在编写时强制代码质量，通过 Hook 在每次文件编辑时自动格式化、lint，并由 Claude 辅助修复。 | community | `skills/plankton-code-quality/SKILL.md` |
| 76 | agent.yaml 已声明 | `python-testing` | 测试 / 评估 / 质量 | Python Testing Patterns | 使用 pytest 的 Python 测试策略，涵盖 TDD 方法、fixture、mock、参数化和覆盖率要求。 | ECC | `skills/python-testing/SKILL.md` |
| 77 | agent.yaml 已声明 | `quality-nonconformance` | 测试 / 评估 / 质量 | Quality & Non-Conformance Management | 沉淀受监管制造业中的质量控制、不合格调查、根因分析、纠正措施和供应商质量管理经验，覆盖 FDA、IATF 16949 和 AS9100 环境，包含 NCR 生命周期、CAPA 系统、SPC 解读和审计方法；适用于调查不合格、根因分析、管理 CAPA、解读 SPC 数据或处理供应商质量问题。 | ECC | `skills/quality-nonconformance/SKILL.md` |
| 78 | agent.yaml 已声明 | `rust-testing` | 测试 / 评估 / 质量 | Rust Testing Patterns | Rust 测试模式，包括单元测试、集成测试、异步测试、基于属性的测试、mock 和覆盖率，并遵循 TDD 方法。 | ECC | `skills/rust-testing/SKILL.md` |
| 79 | agent.yaml 已声明 | `springboot-tdd` | 测试 / 评估 / 质量 | Spring Boot TDD Workflow | Spring Boot 的测试驱动开发，使用 JUnit 5、Mockito、MockMvc、Testcontainers 和 JaCoCo；适用于添加功能、修复缺陷或重构。 | ECC | `skills/springboot-tdd/SKILL.md` |
| 80 | agent.yaml 已声明 | `springboot-verification` | 测试 / 评估 / 质量 | Spring Boot Verification Loop | Spring Boot 项目的验证循环：发布或提交 PR 前执行构建、静态分析、带覆盖率测试、安全扫描和 diff 审查。 | ECC | `skills/springboot-verification/SKILL.md` |
| 81 | agent.yaml 已声明 | `swift-protocol-di-testing` | 测试 / 评估 / 质量 | Swift Protocol-Based Dependency Injection for Testing | 基于协议的 Swift 依赖注入，用于可测试代码；通过聚焦协议和 Swift Testing 模拟文件系统、网络和外部 API。 | ECC | `skills/swift-protocol-di-testing/SKILL.md` |
| 82 | agent.yaml 已声明 | `tdd-workflow` | 测试 / 评估 / 质量 | Test-Driven Development Workflow | 用于编写新功能、修复缺陷或重构代码，强制执行测试驱动开发，并要求单元、集成和 E2E 测试整体覆盖率达到 80% 以上。 | ECC | `skills/tdd-workflow/SKILL.md` |
| 83 | agent.yaml 已声明 | `verification-loop` | 测试 / 评估 / 质量 | Verification Loop Skill | 面向 Claude Code 会话的综合验证系统。 | ECC | `skills/verification-loop/SKILL.md` |
| 84 | agent.yaml 已声明 | `codebase-onboarding` | 研究 / 搜索 / 知识 | Codebase Onboarding | 分析陌生代码库，并生成结构化上手指南，包括架构地图、关键入口、约定和初始 CLAUDE.md；适用于加入新项目或首次为仓库设置 Claude Code。 | ECC | `skills/codebase-onboarding/SKILL.md` |
| 85 | agent.yaml 已声明 | `deep-research` | 研究 / 搜索 / 知识 | Deep Research | 使用 firecrawl 和 exa MCP 进行多来源深度研究，搜索 Web、综合发现，并提供带来源归因的引用报告；适用于用户需要围绕任意主题进行有证据、有引用的深入研究。 | ECC | `skills/deep-research/SKILL.md` |
| 86 | agent.yaml 已声明 | `documentation-lookup` | 研究 / 搜索 / 知识 | Documentation Lookup (Context7) | 通过 Context7 MCP 使用最新库和框架文档，而不是依赖训练数据；适用于安装配置问题、API 参考、代码示例，或用户提到 React、Next.js、Prisma 等框架时。 | ECC | `skills/documentation-lookup/SKILL.md` |
| 87 | agent.yaml 已声明 | `exa-search` | 研究 / 搜索 / 知识 | Exa Search | 通过 Exa MCP 进行 Web、代码和公司研究的神经搜索；适用于需要 Web 搜索、代码示例、公司情报、人物查询，或基于 Exa 神经搜索引擎进行 AI 深度研究。 | ECC | `skills/exa-search/SKILL.md` |
| 88 | agent.yaml 已声明 | `market-research` | 研究 / 搜索 / 知识 | Market Research | 开展市场研究、竞争分析、投资人尽调和行业情报整理，提供来源归因和面向决策的摘要；适用于市场规模测算、竞品比较、基金研究、技术扫描或支持商业决策的研究。 | ECC | `skills/market-research/SKILL.md` |
| 89 | agent.yaml 已声明 | `search-first` | 研究 / 搜索 / 知识 | /search-first — Research Before You Code | 编码前先研究的工作流：在编写自定义代码前搜索现有工具、库和模式，并调用 researcher Agent。 | ECC | `skills/search-first/SKILL.md` |
| 90 | agent.yaml 已声明 | `healthcare-cdss-patterns` | 行业领域 | Healthcare CDSS Development Patterns | 临床决策支持系统（CDSS）开发模式，包括药物相互作用检查、剂量验证、临床评分（NEWS2、qSOFA）、告警严重程度分级，以及集成到 EMR 工作流。 | Health1 Super Speciality Hospitals — contributed by Dr. Keyur Patel | `skills/healthcare-cdss-patterns/SKILL.md` |
| 91 | agent.yaml 已声明 | `healthcare-emr-patterns` | 行业领域 | Healthcare EMR Development Patterns | 医疗应用的 EMR/EHR 开发模式，涵盖临床安全、就诊流程、处方生成、临床决策支持集成，以及面向医疗数据录入的无障碍优先 UI。 | Health1 Super Speciality Hospitals — contributed by Dr. Keyur Patel | `skills/healthcare-emr-patterns/SKILL.md` |
| 92 | agent.yaml 已声明 | `android-clean-architecture` | 语言 / 框架工程 | Android Clean Architecture | Android 与 Kotlin Multiplatform 项目的 Clean Architecture 模式，包括模块结构、依赖规则、UseCase、Repository 和数据层模式。 | ECC | `skills/android-clean-architecture/SKILL.md` |
| 93 | agent.yaml 已声明 | `bun-runtime` | 语言 / 框架工程 | Bun Runtime | Bun 作为运行时、包管理器、打包器和测试运行器的使用方式，涵盖何时选择 Bun 而非 Node、迁移注意事项和 Vercel 支持。 | ECC | `skills/bun-runtime/SKILL.md` |
| 94 | agent.yaml 已声明 | `cpp-coding-standards` | 语言 / 框架工程 | C++ Coding Standards (C++ Core Guidelines) | 基于 C++ Core Guidelines 的 C++ 编码标准；适用于编写、审查或重构 C++ 代码，以执行现代、安全且符合惯用法的实践。 | ECC | `skills/cpp-coding-standards/SKILL.md` |
| 95 | agent.yaml 已声明 | `django-patterns` | 语言 / 框架工程 | Django Development Patterns | Django 架构模式，涵盖使用 DRF 的 REST API 设计、ORM 最佳实践、缓存、信号、中间件和生产级 Django 应用。 | ECC | `skills/django-patterns/SKILL.md` |
| 96 | agent.yaml 已声明 | `docker-patterns` | 语言 / 框架工程 | Docker Patterns | Docker 与 Docker Compose 模式，涵盖本地开发、容器安全、网络、卷策略和多服务编排。 | ECC | `skills/docker-patterns/SKILL.md` |
| 97 | agent.yaml 已声明 | `flutter-dart-code-review` | 语言 / 框架工程 | Flutter/Dart Code Review Best Practices | 与具体库无关的 Flutter/Dart 代码审查清单，涵盖 widget 最佳实践、状态管理模式（BLoC、Riverpod、Provider、GetX、MobX、Signals）、Dart 惯用法、性能、无障碍、安全和 Clean Architecture。 | ECC | `skills/flutter-dart-code-review/SKILL.md` |
| 98 | agent.yaml 已声明 | `golang-patterns` | 语言 / 框架工程 | Go Development Patterns | 用于构建健壮、高效、可维护 Go 应用的惯用 Go 模式、最佳实践和约定。 | ECC | `skills/golang-patterns/SKILL.md` |
| 99 | agent.yaml 已声明 | `java-coding-standards` | 语言 / 框架工程 | Java Coding Standards | Spring Boot 服务的 Java 编码标准，涵盖命名、不可变性、Optional 使用、stream、异常、泛型和项目布局。 | ECC | `skills/java-coding-standards/SKILL.md` |
| 100 | agent.yaml 已声明 | `kotlin-coroutines-flows` | 语言 / 框架工程 | Kotlin Coroutines & Flows | Android 与 KMP 中的 Kotlin 协程和 Flow 模式，涵盖结构化并发、Flow 操作符、StateFlow、错误处理和测试。 | ECC | `skills/kotlin-coroutines-flows/SKILL.md` |
| 101 | agent.yaml 已声明 | `kotlin-exposed-patterns` | 语言 / 框架工程 | Kotlin Exposed Patterns | JetBrains Exposed ORM 模式，包括 DSL 查询、DAO 模式、事务、HikariCP 连接池、Flyway 迁移和 Repository 模式。 | ECC | `skills/kotlin-exposed-patterns/SKILL.md` |
| 102 | agent.yaml 已声明 | `kotlin-ktor-patterns` | 语言 / 框架工程 | Ktor Server Patterns | Ktor 服务端模式，包括路由 DSL、插件、认证、Koin 依赖注入、kotlinx.serialization、WebSocket 和 testApplication 测试。 | ECC | `skills/kotlin-ktor-patterns/SKILL.md` |
| 103 | agent.yaml 已声明 | `kotlin-patterns` | 语言 / 框架工程 | Kotlin Development Patterns | 用于构建健壮、高效、可维护 Kotlin 应用的惯用 Kotlin 模式、最佳实践和约定，涵盖协程、空安全和 DSL 构建器。 | ECC | `skills/kotlin-patterns/SKILL.md` |
| 104 | agent.yaml 已声明 | `laravel-patterns` | 语言 / 框架工程 | Laravel Development Patterns | Laravel 架构模式，涵盖路由/控制器、Eloquent ORM、服务层、队列、事件、缓存和生产应用的 API Resource。 | ECC | `skills/laravel-patterns/SKILL.md` |
| 105 | agent.yaml 已声明 | `laravel-plugin-discovery` | 语言 / 框架工程 | Laravel Plugin Discovery | 通过 LaraPlugins.io MCP 发现并评估 Laravel 包；适用于用户想查找插件、检查包健康度或评估 Laravel/PHP 兼容性。 | ECC | `skills/laravel-plugin-discovery/SKILL.md` |
| 106 | agent.yaml 已声明 | `nextjs-turbopack` | 语言 / 框架工程 | Next.js and Turbopack | Next.js 16+ 与 Turbopack，涵盖增量打包、文件系统缓存、开发速度，以及何时使用 Turbopack 而不是 webpack。 | ECC | `skills/nextjs-turbopack/SKILL.md` |
| 107 | agent.yaml 已声明 | `nuxt4-patterns` | 语言 / 框架工程 | Nuxt 4 Patterns | Nuxt 4 应用模式，涵盖 hydration 安全、性能、路由规则、懒加载，以及使用 useFetch 和 useAsyncData 的 SSR 安全数据获取。 | ECC | `skills/nuxt4-patterns/SKILL.md` |
| 108 | agent.yaml 已声明 | `perl-patterns` | 语言 / 框架工程 | Modern Perl Development Patterns | 现代 Perl 5.36+ 惯用法、最佳实践和约定，用于构建健壮、可维护的 Perl 应用。 | ECC | `skills/perl-patterns/SKILL.md` |
| 109 | agent.yaml 已声明 | `python-patterns` | 语言 / 框架工程 | Python Development Patterns | Pythonic 惯用法、PEP 8 标准、类型提示和最佳实践，用于构建健壮、高效、可维护的 Python 应用。 | ECC | `skills/python-patterns/SKILL.md` |
| 110 | agent.yaml 已声明 | `pytorch-patterns` | 语言 / 框架工程 | PyTorch Development Patterns | PyTorch 深度学习模式和最佳实践，用于构建健壮、高效、可复现的训练流水线、模型架构和数据加载流程。 | ECC | `skills/pytorch-patterns/SKILL.md` |
| 111 | agent.yaml 已声明 | `rust-patterns` | 语言 / 框架工程 | Rust Development Patterns | 惯用 Rust 模式，涵盖所有权、错误处理、trait、并发和最佳实践，用于构建安全高性能应用。 | ECC | `skills/rust-patterns/SKILL.md` |
| 112 | agent.yaml 已声明 | `springboot-patterns` | 语言 / 框架工程 | Spring Boot Development Patterns | Spring Boot 架构模式，涵盖 REST API 设计、分层服务、数据访问、缓存、异步处理和日志；适用于 Java Spring Boot 后端工作。 | ECC | `skills/springboot-patterns/SKILL.md` |
| 113 | agent.yaml 已声明 | `swift-actor-persistence` | 语言 / 框架工程 | Swift Actors for Thread-Safe Persistence | 使用 actor 在 Swift 中实现线程安全的数据持久化，包括带文件后端的内存缓存，并通过设计消除数据竞争。 | ECC | `skills/swift-actor-persistence/SKILL.md` |
| 114 | agent.yaml 已声明 | `swift-concurrency-6-2` | 语言 / 框架工程 | Swift 6.2 Approachable Concurrency | Swift 6.2 Approachable Concurrency：默认单线程、通过 @concurrent 显式后台卸载，以及 main actor 类型的隔离一致性。 |  | `skills/swift-concurrency-6-2/SKILL.md` |
| 115 | agent.yaml 已声明 | `ai-first-engineering` | 通用 / 其他 | AI-First Engineering | 面向由 AI Agent 生成大量实现产出的团队的工程运营模型。 | ECC | `skills/ai-first-engineering/SKILL.md` |
| 116 | agent.yaml 已声明 | `architecture-decision-records` | 通用 / 其他 | Architecture Decision Records | 将 Claude Code 会话中的架构决策记录为结构化 ADR，自动识别决策时刻，记录背景、备选方案和理由，并维护 ADR 日志，帮助未来开发者理解代码库为何如此演进。 | ECC | `skills/architecture-decision-records/SKILL.md` |
| 117 | agent.yaml 已声明 | `backend-patterns` | 通用 / 其他 | Backend Development Patterns | 后端架构模式、API 设计、数据库优化，以及 Node.js、Express 和 Next.js API routes 的服务端最佳实践。 | ECC | `skills/backend-patterns/SKILL.md` |
| 118 | agent.yaml 已声明 | `benchmark` | 通用 / 其他 | Benchmark — Performance Baseline & Regression Detection | 用于测量性能基线、在 PR 前后检测回归，并比较不同技术栈方案。 | ECC | `skills/benchmark/SKILL.md` |
| 119 | agent.yaml 已声明 | `blueprint` | 通用 / 其他 | Blueprint — Construction Plan Generator | 将一句话目标转化为适合多会话、多 Agent 工程项目的分步施工计划；每一步都有自包含上下文简报，方便新 Agent 冷启动执行，并包含对抗式审查门、依赖图、并行步骤识别、反模式目录和计划变更协议。适用于复杂多 PR 任务的计划、蓝图或路线图请求；单 PR 或很少工具调用即可完成的任务不触发。 | community | `skills/blueprint/SKILL.md` |
| 120 | agent.yaml 已声明 | `canary-watch` | 通用 / 其他 | Canary Watch — Post-Deploy Monitoring | 用于在部署、合并或依赖升级后监控已部署 URL 是否出现回归。 | ECC | `skills/canary-watch/SKILL.md` |
| 121 | agent.yaml 已声明 | `ck` | 通用 / 其他 | ck — Context Keeper | Claude Code 的项目级持久记忆：会话开始时自动加载项目上下文，跟踪带 git 活动的会话，并写入原生 memory；命令运行确定性的 Node.js 脚本，确保不同模型版本下行为一致。 | community | `skills/ck/SKILL.md` |
| 122 | agent.yaml 已声明 | `coding-standards` | 通用 / 其他 | Coding Standards & Best Practices | 跨项目基础编码约定，涵盖命名、可读性、不可变性和代码质量审查；框架特定模式请使用更细的前端或后端技能。 | ECC | `skills/coding-standards/SKILL.md` |
| 123 | agent.yaml 已声明 | `compose-multiplatform-patterns` | 通用 / 其他 | Compose Multiplatform Patterns | KMP 项目的 Compose Multiplatform 与 Jetpack Compose 模式，涵盖状态管理、导航、主题、性能和平台特定 UI。 | ECC | `skills/compose-multiplatform-patterns/SKILL.md` |
| 124 | agent.yaml 已声明 | `continuous-learning` | 通用 / 其他 | Continuous Learning Skill | 从 Claude Code 会话中自动提取可复用模式，并保存为已学习技能供未来使用。 | ECC | `skills/continuous-learning/SKILL.md` |
| 125 | agent.yaml 已声明 | `continuous-learning-v2` | 通用 / 其他 | Continuous Learning v2.1 - Instinct | 基于 Instinct 的学习系统，通过 Hook 观察会话，创建带置信度评分的原子 instinct，并将其演化为技能、命令或 Agent；v2.1 增加项目级 instinct，防止跨项目污染。 | ECC | `skills/continuous-learning-v2/SKILL.md` |
| 126 | agent.yaml 已声明 | `foundation-models-on-device` | 通用 / 其他 | FoundationModels: On-Device LLM (iOS 26) | Apple FoundationModels 端侧 LLM 框架，面向 iOS 26+ 的文本生成、使用 @Generable 的引导生成、工具调用和快照流式输出。 |  | `skills/foundation-models-on-device/SKILL.md` |
| 127 | agent.yaml 已声明 | `nanoclaw-repl` | 通用 / 其他 | NanoClaw REPL | 操作并扩展 NanoClaw v2，即 ECC 基于 claude -p 构建的零依赖、会话感知 REPL。 | ECC | `skills/nanoclaw-repl/SKILL.md` |
| 128 | agent.yaml 已声明 | `nutrient-document-processing` | 通用 / 其他 | Nutrient Document Processing | 使用 Nutrient DWS API 处理、转换、OCR、提取、脱敏、签署和填写文档，支持 PDF、DOCX、XLSX、PPTX、HTML 和图片。 | ECC | `skills/nutrient-document-processing/SKILL.md` |
| 129 | agent.yaml 已声明 | `product-lens` | 通用 / 其他 | Product Lens — Think Before You Build | 用于在构建前验证“为什么要做”，执行产品诊断，并在需求成为实现契约前压力测试产品方向。 | ECC | `skills/product-lens/SKILL.md` |
| 130 | agent.yaml 已声明 | `regex-vs-llm-structured-text` | 通用 / 其他 | Regex vs LLM for Structured Text Parsing | 在解析结构化文本时选择正则还是 LLM 的决策框架：优先使用正则，只在低置信度边界情况引入 LLM。 | ECC | `skills/regex-vs-llm-structured-text/SKILL.md` |
| 131 | agent.yaml 已声明 | `santa-method` | 通用 / 其他 | Santa Method | 多 Agent 对抗式验证与收敛循环：两个独立审查 Agent 都必须通过，结果才可交付。 | Ronald Skelton - Founder, RapportScore.ai | `skills/santa-method/SKILL.md` |
| 132 | agent.yaml 已声明 | `strategic-compact` | 通用 / 其他 | Strategic Compact Skill | 建议在逻辑阶段边界手动压缩上下文，以跨任务阶段保留上下文，而不是依赖任意自动压缩。 | ECC | `skills/strategic-compact/SKILL.md` |
| 133 | agent.yaml 已声明 | `visa-doc-translate` | 通用 / 其他 |  | 将签证申请文档图片翻译为英文，并生成包含原文和译文的双语 PDF。 |  | `skills/visa-doc-translate/SKILL.md` |
| 134 | 未列入 agent.yaml | `agent-introspection-debugging` | Agent / 工具链 / 运维 | Agent Introspection Debugging | 针对 AI Agent 失败的结构化自调试工作流，包含捕获、诊断、受控恢复和内省报告。 | ECC | `skills/agent-introspection-debugging/SKILL.md` |
| 135 | 未列入 agent.yaml | `agent-sort` | Agent / 工具链 / 运维 | Agent Sort | 为特定仓库生成有证据支撑的 ECC 安装计划，通过并行且理解仓库上下文的审查，把技能、命令、规则、Hook 和扩展项分入 DAILY 与 LIBRARY 桶；适用于希望按项目实际需要裁剪 ECC，而不是加载完整套件的场景。 | ECC | `skills/agent-sort/SKILL.md` |
| 136 | 未列入 agent.yaml | `autonomous-agent-harness` | Agent / 工具链 / 运维 | Autonomous Agent Harness | 将 Claude Code 转换为具备持久记忆、定时运行、计算机使用和任务队列的全自主 Agent 系统；通过 Claude Code 原生 cron、dispatch、MCP 工具和 memory 替代 Hermes、AutoGPT 等独立 Agent 框架；适用于连续自主运行、定时任务或自我驱动 Agent 循环。 | ECC | `skills/autonomous-agent-harness/SKILL.md` |
| 137 | 未列入 agent.yaml | `ecc-tools-cost-audit` | Agent / 工具链 / 运维 | ECC Tools Cost Audit | ECC Tools 的证据优先成本消耗与账单审计工作流；适用于调查失控创建 PR、绕过配额、高级模型泄漏、重复任务或 GitHub App 成本激增。 | ECC | `skills/ecc-tools-cost-audit/SKILL.md` |
| 138 | 未列入 agent.yaml | `gan-style-harness` | Agent / 工具链 / 运维 | GAN-Style Harness Skill | 受 GAN 启发的生成器-评估器 Agent Harness，用于自主构建高质量应用；基于 Anthropic 2026 年 3 月的 harness 设计论文。 | ECC-community | `skills/gan-style-harness/SKILL.md` |
| 139 | 未列入 agent.yaml | `github-ops` | Agent / 工具链 / 运维 | GitHub Operations | GitHub 仓库运营、自动化和管理，使用 gh CLI 处理 issue 分流、PR 管理、CI/CD 运维、发布管理和安全监控；适用于超出简单 git 命令的 GitHub issue、PR、CI 状态、发布、贡献者和过期项管理。 | ECC | `skills/github-ops/SKILL.md` |
| 140 | 未列入 agent.yaml | `hookify-rules` | Agent / 工具链 / 运维 | Writing Hookify Rules | 用于用户要求创建 hookify 规则、编写 Hook 规则、配置 hookify、添加 hookify 规则，或需要了解 hookify 规则语法和模式的场景。 |  | `skills/hookify-rules/SKILL.md` |
| 141 | 未列入 agent.yaml | `terminal-ops` | Agent / 工具链 / 运维 | Terminal Ops | ECC 的证据优先仓库执行工作流；适用于用户希望运行命令、检查仓库、调试 CI 失败，或以确切执行和验证证据完成小范围修复的场景。 | ECC | `skills/terminal-ops/SKILL.md` |
| 142 | 未列入 agent.yaml | `automation-audit-ops` | 业务运营 | Automation Audit Ops | ECC 的证据优先自动化清单与重叠审计工作流；适用于在修复前了解哪些任务、Hook、连接器、MCP 服务器或包装器正在运行、失效、重复或缺失。 | ECC | `skills/automation-audit-ops/SKILL.md` |
| 143 | 未列入 agent.yaml | `customer-billing-ops` | 业务运营 | Customer Billing Ops | 使用 Stripe 等已连接计费工具处理客户计费工作流，包括订阅、退款、流失分流、账单门户恢复和套餐分析；适用于帮助客户、检查订阅状态或管理影响收入的计费操作。 | ECC | `skills/customer-billing-ops/SKILL.md` |
| 144 | 未列入 agent.yaml | `email-ops` | 业务运营 | Email Ops | ECC 的证据优先邮箱分流、草稿、发送验证和安全跟进工作流；适用于整理邮件、通过真实邮件界面起草或发送，或证明邮件已进入已发送。 | ECC | `skills/email-ops/SKILL.md` |
| 145 | 未列入 agent.yaml | `finance-billing-ops` | 业务运营 | Finance Billing Ops | ECC 的证据优先收入、定价、退款、团队计费和计费模型事实核查工作流；适用于用户需要销售快照、价格比较、重复扣费诊断，或基于代码的真实计费情况，而非泛泛支付建议。 | ECC | `skills/finance-billing-ops/SKILL.md` |
| 146 | 未列入 agent.yaml | `google-workspace-ops` | 业务运营 | Google Workspace Ops | 将 Google Drive、Docs、Sheets 和 Slides 作为统一工作流界面来处理计划、跟踪器、演示文稿和共享文档；适用于查找、总结、编辑、迁移或清理 Google Workspace 资产，而无需直接使用底层工具调用。 | ECC | `skills/google-workspace-ops/SKILL.md` |
| 147 | 未列入 agent.yaml | `jira-integration` | 业务运营 | Jira Integration Skill | 用于检索 Jira 工单、分析需求、更新工单状态、添加评论或流转问题，提供通过 MCP 或直接 REST 调用的 Jira API 模式。 | ECC | `skills/jira-integration/SKILL.md` |
| 148 | 未列入 agent.yaml | `knowledge-ops` | 业务运营 | Knowledge Operations | 跨本地文件、MCP memory、向量库和 Git 仓库等多种存储层进行知识库管理、摄取、同步和检索；适用于保存、组织、同步、去重或搜索知识系统。 | ECC | `skills/knowledge-ops/SKILL.md` |
| 149 | 未列入 agent.yaml | `messages-ops` | 业务运营 | Messages Ops | ECC 的证据优先即时消息工作流；适用于读取短信或私信、恢复近期一次性验证码、回复前检查会话，或证明实际检查了哪个消息来源。 | ECC | `skills/messages-ops/SKILL.md` |
| 150 | 未列入 agent.yaml | `project-flow-ops` | 业务运营 | Project Flow Ops | 跨 GitHub 和 Linear 运营执行流，通过分流 issue 与 PR、关联活跃工作，并保持 GitHub 面向公众、Linear 作为内部执行层；适用于待办控制、PR 分流或 GitHub 到 Linear 协调。 | ECC | `skills/project-flow-ops/SKILL.md` |
| 151 | 未列入 agent.yaml | `unified-notifications-ops` | 业务运营 | Unified Notifications Ops | 将 GitHub、Linear、桌面提醒、Hook 和已连接沟通界面的通知作为 ECC 原生统一工作流处理；适用于告警路由、去重、升级或收件箱坍塌等真实问题。 | ECC | `skills/unified-notifications-ops/SKILL.md` |
| 152 | 未列入 agent.yaml | `workspace-surface-audit` | 业务运营 | Workspace Surface Audit | 审计当前仓库、MCP 服务器、插件、连接器、环境暴露面和 harness 设置，并推荐最高价值的 ECC 原生技能、Hook、Agent 和操作工作流；适用于设置 Claude Code 或理解当前环境实际可用能力。 | ECC | `skills/workspace-surface-audit/SKILL.md` |
| 153 | 未列入 agent.yaml | `brand-voice` | 内容 / 媒体 / 增长 | Brand Voice | 基于真实帖子、文章、发布说明、文档或站点文案构建来源驱动的写作风格画像，并在内容、外联和社交流程中复用；适用于想保持语气一致且避免通用 AI 写作套路的场景。 | ECC | `skills/brand-voice/SKILL.md` |
| 154 | 未列入 agent.yaml | `manim-video` | 内容 / 媒体 / 增长 | Manim Video | 为技术概念、图表、系统图和产品演示构建可复用 Manim 解释动画，必要时再交接给更广的 ECC 视频栈；适用于需要清爽动画讲解，而非通用真人讲述脚本的场景。 | ECC | `skills/manim-video/SKILL.md` |
| 155 | 未列入 agent.yaml | `remotion-video-creation` | 内容 / 媒体 / 增长 |  | Remotion 视频创作最佳实践：在 React 中制作视频，涵盖 3D、动画、音频、字幕、图表、转场等 29 条领域规则。 |  | `skills/remotion-video-creation/SKILL.md` |
| 156 | 未列入 agent.yaml | `seo` | 内容 / 媒体 / 增长 | SEO | 审计、规划并实施 SEO 改进，涵盖技术 SEO、页面优化、结构化数据、Core Web Vitals 和内容策略；适用于提升搜索可见度、修复 SEO 问题、添加 schema、处理 sitemap/robots 或关键词映射。 | ECC | `skills/seo/SKILL.md` |
| 157 | 未列入 agent.yaml | `social-graph-ranker` | 内容 / 媒体 / 增长 | Social Graph Ranker | 用于跨 X 和 LinkedIn 的暖引荐发现、桥接评分和网络缺口分析的加权社交图排序；适用于需要可复用图排序引擎本身，而不是其上层外联或关系维护工作流的场景。 | ECC | `skills/social-graph-ranker/SKILL.md` |
| 158 | 未列入 agent.yaml | `accessibility` | 前端 / UI / 体验 | Accessibility (WCAG 2.2) | 使用 WCAG 2.2 AA 标准设计、实现和审计包容性数字产品；用于为 Web 生成语义化 ARIA，为 Web 与原生平台（iOS/Android）生成无障碍 traits。 | ECC | `skills/accessibility/SKILL.md` |
| 159 | 未列入 agent.yaml | `api-connector-builder` | 前端 / UI / 体验 | API Connector Builder | 通过精确匹配目标仓库现有集成模式来构建新的 API 连接器或 provider；适用于添加一个新集成而不发明第二套架构。 | ECC direct-port adaptation | `skills/api-connector-builder/SKILL.md` |
| 160 | 未列入 agent.yaml | `dashboard-builder` | 前端 / UI / 体验 | Dashboard Builder | 为 Grafana、SigNoz 等平台构建能回答真实运营问题的监控看板；适用于把指标转化为可用看板，而不是虚荣指标展示。 | ECC direct-port adaptation | `skills/dashboard-builder/SKILL.md` |
| 161 | 未列入 agent.yaml | `ui-demo` | 前端 / UI / 体验 | UI Demo Video Recorder | 使用 Playwright 录制精致的 UI 演示视频；适用于为 Web 应用创建演示、 walkthrough、屏幕录制或教程视频，输出带可见光标、自然节奏和专业质感的 WebM。 | ECC | `skills/ui-demo/SKILL.md` |
| 162 | 未列入 agent.yaml | `defi-amm-security` | 安全 / 合规 | DeFi AMM Security | Solidity AMM 合约、流动性池和交换流程的安全检查清单，涵盖重入、CEI 顺序、捐赠或通胀攻击、预言机操纵、滑点、管理员控制和整数数学。 | ECC direct-port adaptation | `skills/defi-amm-security/SKILL.md` |
| 163 | 未列入 agent.yaml | `evm-token-decimals` | 安全 / 合规 | EVM Token Decimals | 防止 EVM 多链中的静默小数位不匹配缺陷，涵盖运行时小数位查询、链感知缓存、桥接代币精度漂移，以及面向机器人、看板和 DeFi 工具的安全归一化。 | ECC direct-port adaptation | `skills/evm-token-decimals/SKILL.md` |
| 164 | 未列入 agent.yaml | `gateguard` | 安全 / 合规 | GateGuard — Fact-Forcing Pre-Action Gate | 事实强制门：阻断 Edit/Write/Bash（包括 MultiEdit），并要求在行动前完成具体调查（调用方、数据模式、用户指令）；相较无门禁 Agent，可显著提升输出质量。 | community | `skills/gateguard/SKILL.md` |
| 165 | 未列入 agent.yaml | `hipaa-compliance` | 安全 / 合规 | HIPAA Compliance | 面向医疗隐私与安全工作的 HIPAA 专用入口；适用于任务明确围绕 HIPAA、PHI 处理、covered entity、BAA、泄露态势或美国医疗合规要求展开的场景。 | ECC direct-port adaptation | `skills/hipaa-compliance/SKILL.md` |
| 166 | 未列入 agent.yaml | `llm-trading-agent-security` | 安全 / 合规 | LLM Trading Agent Security | 具备钱包或交易权限的自主交易 Agent 安全模式，涵盖提示注入、支出限额、发送前模拟、熔断器、MEV 防护和密钥处理。 | ECC direct-port adaptation | `skills/llm-trading-agent-security/SKILL.md` |
| 167 | 未列入 agent.yaml | `nodejs-keccak256` | 安全 / 合规 | Node.js Keccak-256 | 防止 JavaScript 和 TypeScript 中的以太坊哈希错误：Node 的 sha3-256 是 NIST SHA3，不是以太坊 Keccak-256，会悄然破坏选择器、签名、存储槽和地址派生。 | ECC direct-port adaptation | `skills/nodejs-keccak256/SKILL.md` |
| 168 | 未列入 agent.yaml | `security-bounty-hunter` | 安全 / 合规 | Security Bounty Hunter | 在仓库中寻找可利用且符合赏金报告价值的安全问题，聚焦远程可达漏洞，而不是噪声很大的仅本地问题。 | ECC direct-port adaptation | `skills/security-bounty-hunter/SKILL.md` |
| 169 | 未列入 agent.yaml | `csharp-testing` | 测试 / 评估 / 质量 | C# Testing Patterns | C# 与 .NET 测试模式，涵盖 xUnit、FluentAssertions、mock、集成测试和测试组织最佳实践。 | ECC | `skills/csharp-testing/SKILL.md` |
| 170 | 未列入 agent.yaml | `code-tour` | 研究 / 搜索 / 知识 | Code Tour | 创建 CodeTour `.tour` 文件：带真实文件和行号锚点、面向特定角色的分步导览；适用于入门导览、架构 walkthrough、PR 导览、RCA 导览和结构化“解释其工作原理”请求。 | ECC | `skills/code-tour/SKILL.md` |
| 171 | 未列入 agent.yaml | `hexagonal-architecture` | 研究 / 搜索 / 知识 | Hexagonal Architecture | 设计、实现并重构 Ports & Adapters 系统，在 TypeScript、Java、Kotlin 和 Go 服务中建立清晰领域边界、依赖倒置和可测试的用例编排。 | ECC | `skills/hexagonal-architecture/SKILL.md` |
| 172 | 未列入 agent.yaml | `research-ops` | 研究 / 搜索 / 知识 | Research Ops | ECC 的证据优先现状研究工作流；适用于用户需要基于当前公开证据和本地上下文获取新事实、比较、信息补全或建议。 | ECC | `skills/research-ops/SKILL.md` |
| 173 | 未列入 agent.yaml | `dart-flutter-patterns` | 语言 / 框架工程 | Dart/Flutter Patterns | 生产级 Dart 与 Flutter 模式，涵盖空安全、不可变状态、异步组合、widget 架构、流行状态管理框架（BLoC、Riverpod、Provider）、GoRouter 导航、Dio 网络、Freezed 代码生成和 Clean Architecture。 | ECC | `skills/dart-flutter-patterns/SKILL.md` |
| 174 | 未列入 agent.yaml | `dotnet-patterns` | 语言 / 框架工程 | .NET Development Patterns | 惯用 C# 与 .NET 模式、约定、依赖注入、async/await 和最佳实践，用于构建健壮、可维护的 .NET 应用。 | ECC | `skills/dotnet-patterns/SKILL.md` |
| 175 | 未列入 agent.yaml | `nestjs-patterns` | 语言 / 框架工程 | NestJS Development Patterns | NestJS 架构模式，涵盖模块、控制器、provider、DTO 验证、guard、interceptor、配置和生产级 TypeScript 后端。 | ECC | `skills/nestjs-patterns/SKILL.md` |
| 176 | 未列入 agent.yaml | `connections-optimizer` | 通用 / 其他 | Connections Optimizer | 以先审查后裁剪、添加/关注建议和符合用户真实语气的分渠道暖外联草稿，重组用户的 X 与 LinkedIn 网络；适用于清理关注列表、围绕当前优先事项增长人脉或让社交图更高信号。 | ECC | `skills/connections-optimizer/SKILL.md` |
| 177 | 未列入 agent.yaml | `council` | 通用 / 其他 | Council | 为模糊决策、权衡和是否推进的判断召集四种声音的委员会；适用于存在多条可行路径且需要结构化分歧后再选择的场景。 | ECC | `skills/council/SKILL.md` |
| 178 | 未列入 agent.yaml | `hermes-imports` | 通用 / 其他 | Hermes Imports | 将本地 Hermes 操作工作流转换为脱敏后的 ECC 技能和发布包产物；适用于准备将 Hermes 工作流公开复用，同时避免泄漏私有工作区状态、凭据或本地路径。 | ECC | `skills/hermes-imports/SKILL.md` |
| 179 | 未列入 agent.yaml | `lead-intelligence` | 通用 / 其他 | Lead Intelligence | AI 原生线索情报和外联流水线，以 Agent 驱动的信号评分、相互排序、暖路径发现、来源驱动语气建模，以及跨邮件、LinkedIn 和 X 的分渠道外联，替代 Apollo、Clay 和 ZoomInfo；适用于寻找、筛选并触达高价值联系人。 | ECC | `skills/lead-intelligence/SKILL.md` |
| 180 | 未列入 agent.yaml | `openclaw-persona-forge` | 通用 / 其他 | 龙虾灵魂锻造炉 | 为 OpenClaw AI Agent 锻造完整的龙虾灵魂方案：根据用户偏好或随机抽卡，输出身份定位、SOUL.md 灵魂描述、角色化底线规则、名字和头像生图提示词；如环境提供已审核的生图技能，可自动生成统一风格头像。适用于创建、设计或定制 OpenClaw 龙虾灵魂；不适用于微调已有 SOUL.md、非 OpenClaw 平台角色设计或纯工具型无性格 Agent。 | community | `skills/openclaw-persona-forge/SKILL.md` |
| 181 | 未列入 agent.yaml | `opensource-pipeline` | 通用 / 其他 | Open-Source Pipeline Skill | 开源流水线：安全地 fork、脱敏并打包私有项目以公开发布，串联 forker、sanitizer、packager 三个 Agent；适用于“开源这个项目”“让它公开”“准备开源”等请求。 | ECC | `skills/opensource-pipeline/SKILL.md` |
| 182 | 未列入 agent.yaml | `product-capability` | 通用 / 其他 | Product Capability | 将 PRD 意图、路线图需求或产品讨论转化为可实施的能力计划，在多服务工作开始前暴露约束、不变量、接口和未决问题；适用于需要 ECC 原生 PRD 到 SRS 通道，而不是模糊规划文字的场景。 | ECC | `skills/product-capability/SKILL.md` |
