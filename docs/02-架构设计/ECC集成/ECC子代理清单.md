# ECC Agents 子代理清单

本文档基于仓库源码自动整理，扫描范围为 `agents/*.md`。

## 暴露规则

Claude Code 插件 manifest 当前不支持 `agents` 字段；仓库 `.claude-plugin/PLUGIN_SCHEMA_NOTES.md` 明确说明不要在 `plugin.json` 添加 `agents`，因为 agent `.md` 文件位于 `agents/` 目录下时会按约定自动发现。

因此本文将 `agents/*.md` 中格式有效的代理统一标记为：`对外可用（约定发现）`。

## 统计

- 源码代理定义总数：48
- 插件安装后对外可用：48
- 对外暴露依据：`agents/` 目录约定自动发现，而非 `plugin.json` 显式声明

## 准确性校验

校验日期：2026-05-05。

- `agents/*.md` 当前共 48 个。
- 48 个 agent 的 frontmatter `name` 均与文件名一致。
- `.claude-plugin/plugin.json` 当前没有 `agents` 字段，符合 `.claude-plugin/PLUGIN_SCHEMA_NOTES.md` 中“不要声明 agents，按目录约定自动发现”的规则。

## 字段说明

| 字段 | 来源 | 说明 |
|---|---|---|
| 暴露状态 | 插件约定 | `agents/*.md` 自动发现 |
| 代理名 | frontmatter `name` | Claude Code 调用代理时的名称 |
| 分类 | 分析辅助字段 | 基于代理名和描述关键词归类，不是官方元数据 |
| 描述 | 中文整理 | 基于 frontmatter `description` 翻译和归纳的中文用途说明 |
| 工具 | frontmatter `tools` | 代理允许使用的工具 |
| 模型 | frontmatter `model` | 代理偏好的模型档位 |

## 子代理总表

| # | 暴露状态 | 代理名 | 分类 | 描述 | 工具 | 模型 | 源码路径 |
|---:|---|---|---|---|---|---|---|
| 1 | 对外可用（约定发现） | `harness-optimizer` | Agent / 自动化 / 实验 | Agent harness 优化代理，分析并改进本地代理运行配置的可靠性、成本和吞吐。 | Read, Grep, Glob, Bash, Edit | sonnet | `agents/harness-optimizer.md` |
| 2 | 对外可用（约定发现） | `loop-operator` | Agent / 自动化 / 实验 | 自主循环运行代理，负责监控长期 agent loop 的进度，并在停滞时安全介入。 | Read, Grep, Glob, Bash, Edit | sonnet | `agents/loop-operator.md` |
| 3 | 对外可用（约定发现） | `architect` | 代码审查 / 质量改进 | 软件架构专家，负责系统设计、可扩展性分析和技术决策，适用于新功能规划、大型重构和架构调整。 | Read, Grep, Glob | opus | `agents/architect.md` |
| 4 | 对外可用（约定发现） | `code-simplifier` | 代码审查 / 质量改进 | 代码简化与整理代理，在保持行为不变的前提下提升清晰度、一致性和可维护性。 | [Read, Write, Edit, Bash, Grep, Glob] | sonnet | `agents/code-simplifier.md` |
| 5 | 对外可用（约定发现） | `comment-analyzer` | 代码审查 / 质量改进 | 注释分析代理，检查代码注释的准确性、完整性、可维护性以及注释腐化风险。 | [Read, Grep, Glob, Bash] | sonnet | `agents/comment-analyzer.md` |
| 6 | 对外可用（约定发现） | `conversation-analyzer` | 代码审查 / 质量改进 | 会话分析代理，用于分析对话记录，找出值得通过 hooks 防止的行为模式。 | [Read, Grep] | sonnet | `agents/conversation-analyzer.md` |
| 7 | 对外可用（约定发现） | `cpp-reviewer` | 代码审查 / 质量改进 | C++ 代码审查专家，关注内存安全、现代 C++ 惯用法、并发和性能。 | Read, Grep, Glob, Bash | sonnet | `agents/cpp-reviewer.md` |
| 8 | 对外可用（约定发现） | `flutter-reviewer` | 代码审查 / 质量改进 | Flutter/Dart 代码审查专家，关注 widget 最佳实践、状态管理、Dart 惯用法、性能、无障碍和清洁架构。 | Read, Grep, Glob, Bash | sonnet | `agents/flutter-reviewer.md` |
| 9 | 对外可用（约定发现） | `gan-generator` | 代码审查 / 质量改进 | GAN Harness 生成代理，按规格实现功能，读取评估反馈并迭代到达质量门槛。 | Read, Write, Edit, Bash, Grep, Glob | opus | `agents/gan-generator.md` |
| 10 | 对外可用（约定发现） | `go-reviewer` | 代码审查 / 质量改进 | Go 代码审查专家，关注 Go 惯用法、并发模式、错误处理和性能。 | Read, Grep, Glob, Bash | sonnet | `agents/go-reviewer.md` |
| 11 | 对外可用（约定发现） | `kotlin-reviewer` | 代码审查 / 质量改进 | Kotlin/Android/KMP 代码审查专家，关注 Kotlin 惯用法、协程安全、Compose、清洁架构和 Android 常见问题。 | Read, Grep, Glob, Bash | sonnet | `agents/kotlin-reviewer.md` |
| 12 | 对外可用（约定发现） | `performance-optimizer` | 代码审查 / 质量改进 | 性能优化专家，负责定位瓶颈、优化慢代码、降低 bundle 体积、处理内存泄漏和渲染/算法性能问题。 | Read, Write, Edit, Bash, Grep, Glob | sonnet | `agents/performance-optimizer.md` |
| 13 | 对外可用（约定发现） | `planner` | 代码审查 / 质量改进 | 规划专家，负责复杂功能、架构调整和重构任务的需求分析、步骤拆分、依赖识别和实施计划。 | Read, Grep, Glob | opus | `agents/planner.md` |
| 14 | 对外可用（约定发现） | `pr-test-analyzer` | 代码审查 / 质量改进 | PR 测试覆盖分析代理，审查测试质量和完整性，重点关注行为覆盖和真实缺陷防护能力。 | [Read, Grep, Glob, Bash] | sonnet | `agents/pr-test-analyzer.md` |
| 15 | 对外可用（约定发现） | `refactor-cleaner` | 代码审查 / 质量改进 | 重构清理代理，负责移除死代码、重复代码和无用依赖，并使用分析工具辅助安全清理。 | Read, Write, Edit, Bash, Grep, Glob | sonnet | `agents/refactor-cleaner.md` |
| 16 | 对外可用（约定发现） | `rust-reviewer` | 代码审查 / 质量改进 | Rust 代码审查专家，关注所有权、生命周期、错误处理、unsafe 使用和惯用模式。 | Read, Grep, Glob, Bash | sonnet | `agents/rust-reviewer.md` |
| 17 | 对外可用（约定发现） | `seo-specialist` | 代码审查 / 质量改进 | SEO 专家，负责技术 SEO、页面优化、结构化数据、Core Web Vitals、站点地图和 robots 问题分析。 | Read, Grep, Glob, Bash, WebSearch, WebFetch | sonnet | `agents/seo-specialist.md` |
| 18 | 对外可用（约定发现） | `silent-failure-hunter` | 代码审查 / 质量改进 | 静默失败猎手，专门审查吞错、错误回退、缺少错误传播和不会显式失败的风险代码。 | [Read, Grep, Glob, Bash] | sonnet | `agents/silent-failure-hunter.md` |
| 19 | 对外可用（约定发现） | `tdd-guide` | 代码审查 / 质量改进 | TDD 指导代理，强制先写测试的方法论，适用于新功能、修 bug 和重构，并关注测试覆盖率。 | Read, Write, Edit, Bash, Grep | sonnet | `agents/tdd-guide.md` |
| 20 | 对外可用（约定发现） | `type-design-analyzer` | 代码审查 / 质量改进 | 类型设计分析代理，评估类型是否能表达和保护不变量、封装边界及实际使用价值。 | [Read, Grep, Glob, Bash] | sonnet | `agents/type-design-analyzer.md` |
| 21 | 对外可用（约定发现） | `chief-of-staff` | 发布 / 运营 / 项目管理 | 个人沟通幕僚，负责分拣邮件、Slack、LINE、Messenger 等多渠道消息，生成回复草稿并跟进后续事项。 | Read, Grep, Glob, Bash, Edit, Write | opus | `agents/chief-of-staff.md` |
| 22 | 对外可用（约定发现） | `opensource-packager` | 发布 / 运营 / 项目管理 | 开源打包代理，为已清理项目生成 CLAUDE.md、setup.sh、README、LICENSE、贡献指南和 issue 模板。 | Read, Write, Edit, Bash, Grep, Glob | sonnet | `agents/opensource-packager.md` |
| 23 | 对外可用（约定发现） | `code-reviewer` | 安全 / 合规 / 风险审查 | 通用代码审查专家，负责检查代码质量、安全性和可维护性，适合所有代码变更后的审查。 | Read, Grep, Glob, Bash | sonnet | `agents/code-reviewer.md` |
| 24 | 对外可用（约定发现） | `csharp-reviewer` | 安全 / 合规 / 风险审查 | C#/.NET 代码审查专家，关注 .NET 约定、异步模式、安全性、可空引用类型和性能。 | Read, Grep, Glob, Bash | sonnet | `agents/csharp-reviewer.md` |
| 25 | 对外可用（约定发现） | `database-reviewer` | 安全 / 合规 / 风险审查 | PostgreSQL 数据库专家，负责 SQL、迁移、schema 设计、查询优化、安全和性能审查。 | Read, Write, Edit, Bash, Grep, Glob | sonnet | `agents/database-reviewer.md` |
| 26 | 对外可用（约定发现） | `healthcare-reviewer` | 安全 / 合规 / 风险审查 | 医疗应用审查专家，关注临床安全、CDSS 准确性、PHI 合规和医疗数据完整性。 | Read, Grep, Glob | opus | `agents/healthcare-reviewer.md` |
| 27 | 对外可用（约定发现） | `java-reviewer` | 安全 / 合规 / 风险审查 | Java/Spring Boot 代码审查专家，关注分层架构、JPA 模式、安全性和并发。 | Read, Grep, Glob, Bash | sonnet | `agents/java-reviewer.md` |
| 28 | 对外可用（约定发现） | `opensource-forker` | 安全 / 合规 / 风险审查 | 开源分叉准备代理，复制项目并清理密钥、凭据、内部引用和 git 历史，生成公开发布前的安全副本。 | Read, Write, Edit, Bash, Grep, Glob | sonnet | `agents/opensource-forker.md` |
| 29 | 对外可用（约定发现） | `opensource-sanitizer` | 安全 / 合规 / 风险审查 | 开源发布净化审查代理，扫描泄露密钥、PII、内部引用和危险文件，并输出通过/失败/警告报告。 | Read, Grep, Glob, Bash | sonnet | `agents/opensource-sanitizer.md` |
| 30 | 对外可用（约定发现） | `python-reviewer` | 安全 / 合规 / 风险审查 | Python 代码审查专家，关注 PEP 8、Pythonic 写法、类型提示、安全性和性能。 | Read, Grep, Glob, Bash | sonnet | `agents/python-reviewer.md` |
| 31 | 对外可用（约定发现） | `security-reviewer` | 安全 / 合规 / 风险审查 | 安全漏洞检测与修复专家，审查用户输入、认证、API、敏感数据、密钥、SSRF、注入和 OWASP Top 10 风险。 | Read, Write, Edit, Bash, Grep, Glob | sonnet | `agents/security-reviewer.md` |
| 32 | 对外可用（约定发现） | `typescript-reviewer` | 安全 / 合规 / 风险审查 | TypeScript/JavaScript 代码审查专家，关注类型安全、异步正确性、Node/Web 安全和惯用模式。 | Read, Grep, Glob, Bash | sonnet | `agents/typescript-reviewer.md` |
| 33 | 对外可用（约定发现） | `doc-updater` | 探索 / 文档 / 上下文 | 文档和 codemap 更新代理，负责更新代码地图、README、指南等项目文档。 | Read, Write, Edit, Bash, Grep, Glob | haiku | `agents/doc-updater.md` |
| 34 | 对外可用（约定发现） | `docs-lookup` | 探索 / 文档 / 上下文 | 文档查询代理，在用户询问库、框架或 API 用法时，通过 Context7 获取最新文档和示例。 | Read, Grep, mcp__context7__resolve-library-id, mcp__context7__query-docs | sonnet | `agents/docs-lookup.md` |
| 35 | 对外可用（约定发现） | `build-error-resolver` | 构建 / 测试 / 故障修复 | 构建与 TypeScript 错误修复专家，专注用最小改动解决构建失败和类型错误。 | Read, Write, Edit, Bash, Grep, Glob | sonnet | `agents/build-error-resolver.md` |
| 36 | 对外可用（约定发现） | `code-architect` | 构建 / 测试 / 故障修复 | 功能架构设计代理，通过分析现有代码模式输出具体文件、接口、数据流和实现顺序蓝图。 | [Read, Grep, Glob, Bash] | sonnet | `agents/code-architect.md` |
| 37 | 对外可用（约定发现） | `cpp-build-resolver` | 构建 / 测试 / 故障修复 | C++ 构建修复专家，处理 CMake、编译、链接和模板错误，并尽量保持改动最小。 | Read, Write, Edit, Bash, Grep, Glob | sonnet | `agents/cpp-build-resolver.md` |
| 38 | 对外可用（约定发现） | `dart-build-resolver` | 构建 / 测试 / 故障修复 | Dart/Flutter 构建修复专家，处理 dart analyze、Flutter 编译、pub 依赖和 build_runner 问题。 | Read, Write, Edit, Bash, Grep, Glob | sonnet | `agents/dart-build-resolver.md` |
| 39 | 对外可用（约定发现） | `e2e-runner` | 构建 / 测试 / 故障修复 | 端到端测试代理，负责生成、维护和运行 E2E 测试，验证关键用户流程并管理截图、视频、trace 等产物。 | Read, Write, Edit, Bash, Grep, Glob | sonnet | `agents/e2e-runner.md` |
| 40 | 对外可用（约定发现） | `gan-evaluator` | 构建 / 测试 / 故障修复 | GAN Harness 评估代理，通过 Playwright 测试运行中的应用，按评分标准给出反馈。 | Read, Write, Bash, Grep, Glob | opus | `agents/gan-evaluator.md` |
| 41 | 对外可用（约定发现） | `go-build-resolver` | 构建 / 测试 / 故障修复 | Go 构建修复专家，处理 go build、go vet、编译错误和 lint 问题，并保持改动最小。 | Read, Write, Edit, Bash, Grep, Glob | sonnet | `agents/go-build-resolver.md` |
| 42 | 对外可用（约定发现） | `java-build-resolver` | 构建 / 测试 / 故障修复 | Java/Maven/Gradle 构建修复专家，处理 Java 编译、依赖和 Spring Boot 构建问题。 | Read, Write, Edit, Bash, Grep, Glob | sonnet | `agents/java-build-resolver.md` |
| 43 | 对外可用（约定发现） | `kotlin-build-resolver` | 构建 / 测试 / 故障修复 | Kotlin/Gradle 构建修复专家，处理 Kotlin 编译、Gradle 和依赖问题。 | Read, Write, Edit, Bash, Grep, Glob | sonnet | `agents/kotlin-build-resolver.md` |
| 44 | 对外可用（约定发现） | `pytorch-build-resolver` | 构建 / 测试 / 故障修复 | PyTorch 运行与训练错误修复专家，处理 tensor shape、设备、梯度、DataLoader 和混合精度问题。 | Read, Write, Edit, Bash, Grep, Glob | sonnet | `agents/pytorch-build-resolver.md` |
| 45 | 对外可用（约定发现） | `rust-build-resolver` | 构建 / 测试 / 故障修复 | Rust 构建修复专家，处理 cargo build、借用检查器错误和 Cargo.toml 问题。 | Read, Write, Edit, Bash, Grep, Glob | sonnet | `agents/rust-build-resolver.md` |
| 46 | 对外可用（约定发现） | `a11y-architect` | 规划 / 架构设计 | 无障碍架构专家，负责 Web 与原生平台的 WCAG 2.2 合规设计、组件无障碍方案和包容性体验审计。 | Read, Write, Edit, Bash, Grep, Glob | opus | `agents/a11y-architect.md` |
| 47 | 对外可用（约定发现） | `code-explorer` | 规划 / 架构设计 | 代码库探索代理，通过追踪执行路径、架构层和依赖关系来理解已有功能，为新开发提供上下文。 | [Read, Grep, Glob, Bash] | sonnet | `agents/code-explorer.md` |
| 48 | 对外可用（约定发现） | `gan-planner` | 规划 / 架构设计 | GAN Harness 规划代理，将一句需求扩展成完整产品规格、功能、冲刺计划、评估标准和设计方向。 | Read, Write, Grep, Glob | opus | `agents/gan-planner.md` |
