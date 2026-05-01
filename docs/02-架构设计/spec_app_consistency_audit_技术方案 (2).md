# spec-app-consistency-audit 技术方案

> 文档定位：新增 `spec-first` Skill 的详细技术方案  
> Skill 名称：`spec-app-consistency-audit`  
> 适用场景：App 端产品 / 设计 / 架构 / 代码 / 交互 / 埋点 / 国际化 / 行业规则一致性审查  
> 默认模式：静态审查优先，不默认启动真机、模拟器或打包流程  
> 核心原则：Light Contract；Explicit Boundaries；Scripts prepare, LLM decides；Preview-first

---

## 1. 背景与问题

当前 App 端研发存在一个典型痛点：很多交互问题、业务状态问题、埋点缺失、国际化缺陷、平台差异和行业专业问题，往往需要等到真机、模拟器、测试包或线上反馈阶段才暴露。

但是移动端真机 / 模拟器验证成本高，尤其是：

- iOS / Android 环境准备成本高
- 真机矩阵覆盖成本高
- 打包和安装链路慢
- 产品需求文档、Figma 设计、KMP 共享逻辑、Android / iOS 端实现之间缺少统一审查
- 埋点、国际化、组件化、模块化通常在不同团队或不同文件中分散维护
- 行业知识没有进入代码审查流程，例如证券、电商、金融、医疗等行业有各自专业路径和风险点

因此，本 Skill 的目标不是替代真机测试，而是在 App 真正跑起来之前，提前通过 PRD、Figma MCP、本地源码和架构信息做专家级静态审查。

---

## 2. Skill 定位

### 2.1 一句话定义

`spec-app-consistency-audit` 是一个面向移动 App 的行业感知一致性审查 Skill。它基于 PRD、本地源码、Figma MCP、KMP + Clean Architecture、组件化 / 模块化结构、埋点、国际化和行业规则包，在不默认启动真机 / 模拟器的前提下，审查产品意图、设计状态、业务规则、架构边界、组件复用、平台适配、数据采集和多语言体验是否一致。

### 2.2 它不是

它不是：

- 普通代码 lint
- 自动化测试框架
- 真机测试工具
- UI 截图对比工具
- 单纯 Figma-to-code 检查器
- 单纯埋点扫描器
- 单纯 i18n 检查器
- 硬编码规则引擎

### 2.3 它是

它是：

- 产品 / 设计 / 架构 / 代码一致性审查 Skill
- 移动端交互风险静态发现 Skill
- KMP + Clean Architecture 架构边界审查 Skill
- 组件化、模块化、复用审查 Skill
- 埋点完整性和跨端一致性审查 Skill
- 国际化完整性和布局风险审查 Skill
- 行业感知的专业业务审查 Skill
- 可沉淀规范和回归建议的专家审查流程

---

## 3. 核心设计原则

### 3.1 静态优先

默认不启动：

- 真机
- 模拟器
- 打包流程
- 云真机
- Appium / Maestro 执行器

默认只读取：

- PRD 本地文件
- Figma MCP 设计上下文
- 本地源码
- 配置文件
- i18n 资源
- 埋点代码
- Gradle / Xcode / KMP 结构
- spec-first 已有产物

只有当某个问题静态证据不足，且对体验或业务风险较高时，才输出运行验证建议。

### 3.2 证据驱动

所有问题必须有证据。

问题至少应包含以下证据之一：

- PRD 证据
- Figma 证据
- Code 证据
- Contract 证据
- Architecture 证据
- Analytics 证据
- I18n 证据
- Industry Rule Pack 证据

原则：

```text
No evidence, no issue.
```

### 3.3 Scripts prepare, LLM decides

脚本职责：

- 读取文件
- 抽取结构
- 扫描代码
- 生成候选契约
- 建立索引
- 输出 JSON artifacts

LLM / Agent 职责：

- 判断一致性
- 识别风险
- 归因问题
- 区分严重等级
- 给出修复建议
- 判断是否需要运行验证

不要把 Skill 做成复杂规则引擎。规则包是审查参考，不是硬门禁。

### 3.4 Preview-first

任何写回行为必须走预览，不自动修改项目配置。

可以输出：

```text
.spec-first/app-audit/writeback-preview/repo-profile.patch.yaml
.spec-first/app-audit/writeback-preview/suggested-standards.md
```

但不能直接写入：

```text
.spec-first/specs/repo-profile.yaml
```

除非用户明确确认。

### 3.5 Expert Mode 是协议，不绑定运行时

不同环境对多 Agent 支持不同：

- Claude Code 可以走 subagent / Task 风格
- Codex 可以走顺序专家审查
- 普通 LLM 可以走单 Agent 多角色轮次

因此本 Skill 设计的是 Expert Mode 协议，而不是强依赖某一个 Agent runtime。

---

## 4. 总体架构

```text
/spec:app-consistency-audit
        ↓
Preflight 项目预检
        ↓
Contract Extraction 契约抽取
        ↓
Industry Profiling 行业画像识别
        ↓
Rule Pack Selection 规则包选择
        ↓
Expert Agent Review 领域专家审查
        ↓
Cross Review 交叉质询与问题合并
        ↓
Evidence Gate 证据门禁
        ↓
Final Report 最终报告
        ↓
Regression Suggestions 回归建议
        ↓
Writeback Preview 可沉淀规范预览
```

核心链路：

```text
PRD
  ↓
Product Contract
  ↓
Figma MCP → Design Contract
  ↓
Local Source → Code / Architecture / Component / Module Contracts
  ↓
Analytics / I18n Contracts
  ↓
Industry Profile + Rule Packs
  ↓
Expert Review
  ↓
Issues + Matrices + Report
```

---

## 5. 输入源设计

### 5.1 必选输入

```text
1. PRD 本地文件
2. 本地源码目录
3. Figma MCP 上下文，至少提供 frame / node / file 信息
```

### 5.2 可选输入

```text
1. 用户指定行业，例如 securities / ecommerce
2. 用户指定目标平台，例如 Android only / iOS only / Android + iOS
3. 用户指定审查范围，例如登录、交易、购物车、支付
4. 用户指定公司规范文件
5. 用户指定埋点规范文件
6. 用户指定 i18n 规范文件
7. 用户指定是否允许生成 Maestro / Appium 回归草案
```

### 5.3 支持的 PRD 文件类型

```text
.md
.txt
.docx
.pdf
.html
```

实现建议：

- MVP 优先支持 `.md` / `.txt`
- `.docx` / `.pdf` 可作为第二阶段支持
- 对 PDF 不要依赖 OCR，优先读取文本层

### 5.4 支持的源码形态

优先支持：

```text
KMP + Clean Architecture
Android Compose
SwiftUI / UIKit
Compose Multiplatform
```

也应兼容：

```text
纯 Android
纯 iOS
React Native
Flutter
```

但 MVP 应聚焦 KMP + Clean Architecture。

---

## 6. 目录结构设计

### 6.1 Skill 目录

建议新增：

```text
.claude/spec-first/workflows/spec-app-consistency-audit/
  SKILL.md

  scripts/
    preflight.js
    extract-prd-contract.js
    extract-figma-contract.js
    extract-code-contract.js
    extract-kmp-architecture.js
    extract-components.js
    extract-modules.js
    extract-analytics.js
    extract-i18n.js
    build-industry-profile.js
    select-rule-packs.js
    merge-contracts.js
    validate-artifacts.js
    build-audit-context.js

  prompts/
    orchestrator.md
    product-expert.md
    figma-design-expert.md
    mobile-ux-expert.md
    kmp-clean-architect.md
    component-module-expert.md
    analytics-expert.md
    i18n-expert.md
    industry-expert.md
    evidence-auditor.md
    regression-expert.md
    report-writer.md

  rule-packs/
    common-app/
      rules.yaml
      checklist.md
      examples.md
      severity.md
      terms.yaml
      anti-patterns.md

    kmp-clean-architecture/
      rules.yaml
      checklist.md
      examples.md
      severity.md

    component-module-reuse/
      rules.yaml
      checklist.md
      examples.md
      severity.md

    analytics/
      rules.yaml
      checklist.md
      examples.md
      severity.md

    i18n/
      rules.yaml
      checklist.md
      examples.md
      severity.md

    industries/
      finance-common/
        rules.yaml
        checklist.md
        terms.yaml
        examples.md
      securities/
        rules.yaml
        checklist.md
        terms.yaml
        examples.md
      ecommerce/
        rules.yaml
        checklist.md
        terms.yaml
        examples.md

  schemas/
    preflight.schema.json
    product-contract.schema.json
    figma-design-contract.schema.json
    codebase-contract.schema.json
    kmp-architecture-contract.schema.json
    component-contract.schema.json
    module-contract.schema.json
    reuse-contract.schema.json
    interaction-contract.schema.json
    analytics-contract.schema.json
    i18n-contract.schema.json
    industry-profile.schema.json
    rule-pack-selection.schema.json
    issue.schema.json
    audit-report.schema.json
```

### 6.2 输出目录

```text
.spec-first/app-audit/
  preflight.json

  product-contract.json
  figma-design-contract.json
  codebase-contract.json
  kmp-architecture-contract.json

  component-contract.json
  module-contract.json
  reuse-contract.json
  interaction-contract.json

  analytics-contract.json
  i18n-contract.json

  industry-profile.preview.json
  industry-evidence.json
  industry-rule-pack-selection.json

  expert-reviews/
    product-review.md
    design-review.md
    mobile-ux-review.md
    kmp-architecture-review.md
    component-module-review.md
    analytics-review.md
    i18n-review.md
    industry-review.md

  matrices/
    product-design-code-matrix.json
    figma-component-matrix.json
    component-reuse-matrix.json
    module-boundary-matrix.json
    analytics-coverage-matrix.json
    i18n-coverage-matrix.json
    industry-audit-matrix.json

  issues.json
  app-consistency-audit.md

  regression-suggestions/
    maestro/
    appium/

  writeback-preview/
    repo-profile.patch.yaml
    suggested-standards.md
```

---

## 7. Skill 工作流程

## Phase 0：Preflight / 项目预检

### 目标

确认项目形态、输入完整性、可审查范围和降级模式。

### 输入

```text
--prd <path>
--figma-node <node-id>
--source <repo-root>
--platform android|ios|both
--industry optional
--scope optional
```

### 检查项

```text
1. 是否存在 PRD 文件
2. 是否能读取 Figma MCP 上下文
3. 是否存在 KMP shared module
4. 是否存在 commonMain / androidMain / iosMain
5. 是否存在 Android App
6. 是否存在 iOS App
7. 是否存在 Gradle module 配置
8. 是否存在设计系统模块
9. 是否存在组件库
10. 是否存在 analytics 模块
11. 是否存在 i18n 资源
12. 是否存在导航 / 路由配置
13. 是否存在 ViewModel / UiState / UiEvent / UseCase
14. 是否存在已有 spec-first 图谱产物
```

### 输出

```json
{
  "schema_version": "spec-app-consistency-audit-preflight.v1",
  "project_type": "kmp_mobile_app",
  "platforms": ["android", "ios"],
  "architecture_candidates": ["kmp", "clean-architecture", "mvvm"],
  "has_prd": true,
  "has_figma_context": true,
  "has_analytics": true,
  "has_i18n": true,
  "has_component_system": true,
  "has_modular_structure": true,
  "default_runtime_mode": "static_only",
  "requires_device_by_default": false,
  "degraded_modes": []
}
```

### 降级策略

```text
PRD 缺失：只做 Design-Code-Architecture 审查
Figma 缺失：只做 PRD-Code-Architecture 审查
iOS 缺失：不做 Android/iOS 强一致性结论，只标记 iOS 缺证据
埋点模块缺失：输出 Analytics System Missing 类问题
i18n 资源缺失：输出 I18n System Missing 类问题
行业置信度低：只启用 common-app 和 architecture 规则包
```

---

## Phase 1：Product Contract Extraction / 产品需求契约抽取

### 目标

把 PRD 从自然语言文档转换为可审查契约。

### 抽取内容

```text
1. 产品目标
2. 用户角色
3. 用户旅程
4. 页面清单
5. 业务规则
6. 字段规则
7. 权限规则
8. 异常规则
9. 成功 / 失败状态
10. 埋点需求
11. 国际化需求
12. 行业术语
13. 合规要求
14. 平台差异要求
```

### 示例输出

```json
{
  "schema_version": "product-contract.v1",
  "features": [
    {
      "id": "trade_buy",
      "name": "股票买入",
      "journeys": [
        "open_trade_page",
        "input_price_quantity",
        "show_trade_confirmation",
        "submit_trade_order",
        "show_order_result"
      ],
      "business_rules": [
        {
          "id": "trade_submit_requires_confirmation",
          "description": "提交买入委托前必须展示确认弹窗"
        },
        {
          "id": "trade_failure_requires_reason",
          "description": "提交失败时必须展示明确失败原因"
        }
      ],
      "analytics_requirements": [
        "trade_page_view",
        "trade_confirm_view",
        "trade_submit",
        "trade_success",
        "trade_failed"
      ],
      "i18n_requirements": [
        "trade_confirm_title",
        "trade_submit_button",
        "trade_failed_reason"
      ],
      "industry_signals": ["trade", "order", "position", "risk"]
    }
  ]
}
```

---

## Phase 2：Figma Design Contract Extraction / 设计契约抽取

### 目标

从 Figma MCP 中抽取页面、组件、状态、文案、设计 token 和交互线索。

### 抽取内容

```text
1. Frame / Screen
2. Component
3. Variant
4. UI 状态
5. 文案
6. 按钮
7. 输入框
8. 弹窗
9. BottomSheet
10. Toast / Snackbar
11. Loading
12. Empty
13. Error
14. Disabled
15. Success
16. 设计 token
17. 布局约束
18. 可点击区域
19. 安全区风险
20. 多语言膨胀风险
```

### 输出重点

```text
Figma 有哪些页面？
Figma 有哪些状态？
Figma 有哪些组件 variants？
Figma 哪些文案应进入 i18n？
Figma 哪些交互节点应有埋点？
Figma 是否存在行业关键弹窗或确认流程？
```

### 示例输出

```json
{
  "schema_version": "figma-design-contract.v1",
  "screens": [
    {
      "name": "TradeBuyScreen",
      "states": ["default", "input", "confirming", "submitting", "success", "failed"],
      "components": ["PriceInput", "QuantityInput", "PrimaryButton", "TradeConfirmDialog"],
      "texts": [
        {
          "text": "买入",
          "suggested_i18n_key": "trade_buy_button"
        }
      ],
      "interaction_nodes": [
        {
          "type": "button",
          "name": "SubmitBuyButton",
          "suggested_analytics_event": "trade_submit_click"
        }
      ]
    }
  ]
}
```

---

## Phase 3：Codebase Contract Extraction / 源码契约抽取

### 目标

从本地源码中抽取代码实现事实，建立屏幕、路由、状态、事件、UseCase、Repository、平台能力的证据链。

### 抽取内容

```text
1. module graph
2. package graph
3. route graph
4. screen graph
5. ViewModel graph
6. UiState graph
7. UiEvent graph
8. Effect graph
9. UseCase graph
10. Repository graph
11. API path
12. platform service
13. analytics call
14. i18n usage
15. component usage
```

### 重点证据链

```text
Screen
  → ViewModel
  → UiState
  → UiEvent
  → UseCase
  → Repository
  → Platform Adapter
```

### 示例输出

```json
{
  "schema_version": "codebase-contract.v1",
  "screens": [
    {
      "name": "TradeBuyScreen",
      "file": "androidApp/src/main/.../TradeBuyScreen.kt",
      "view_model": "TradeBuyViewModel",
      "ui_state": "TradeBuyUiState",
      "ui_events": ["PriceChanged", "QuantityChanged", "SubmitClicked"],
      "use_cases": ["SubmitTradeOrderUseCase"],
      "components": ["PrimaryButton", "PriceInput", "QuantityInput"]
    }
  ]
}
```

---

## Phase 4：KMP + Clean Architecture Contract / 架构契约抽取

### 目标

审查 KMP source set 和 Clean Architecture 分层是否正确承载业务规则和平台差异。

### 抽取内容

```text
1. commonMain
2. androidMain
3. iosMain
4. domain
5. data
6. presentation
7. ui
8. platform
9. expect / actual
10. Repository interface
11. Repository implementation
12. UseCase
13. Result model
14. platform adapter
```

### 关键审查点

```text
业务规则是否在 commonMain/domain？
UI 是否直接访问 data layer？
domain 是否出现 Android / iOS 类型？
平台能力是否通过 adapter 或 expect/actual 隔离？
UseCase 是否结构化表达成功 / 失败？
UiState 是否完整表达交互状态？
Android / iOS actual 是否对称？
```

### 示例问题

```text
问题：交易失败原因只在 UI catch Exception 后 Toast，未在 domain result 中结构化表达。
风险：Android/iOS 行为可能漂移；失败原因埋点无法稳定采集；错误态无法被测试。
建议：定义 SubmitTradeOrderResult sealed interface，并由 ViewModel 映射到 UiState 和 Analytics Event。
```

---

## Phase 5：Component / Module / Reuse Contract / 组件化、模块化、复用契约抽取

### 目标

审查设计组件是否正确落地到代码组件，业务组件是否合理复用，模块边界是否清晰，复用是否破坏语义。

### 5.1 组件化审查

#### 抽取内容

```text
1. Figma Component
2. Code Component
3. Component Variant
4. Component Props
5. Component Usage Sites
6. Component Token Usage
7. Accessibility Props
8. Analytics Props
9. I18n Props
```

#### 审查点

```text
Figma 有组件，代码是否有统一组件？
Figma variants 是否被代码组件覆盖？
组件是否硬编码颜色 / 字体 / spacing？
组件是否支持 loading / disabled / error？
组件是否支持 accessibility label？
组件是否错误内置业务埋点？
组件是否绑定具体业务页面过死？
```

#### 示例问题

```text
问题：PrimaryButton 组件未覆盖 Figma 中的 loading variant。
影响：提交中状态无法统一表达，防重复提交难以治理。
建议：PrimaryButton 增加 loading、disabled、accessibilityLabel、analyticsId 等标准参数。
```

### 5.2 模块化审查

#### 抽取内容

```text
1. Gradle module
2. source set
3. feature module
4. core module
5. design-system module
6. analytics module
7. i18n module
8. module dependency graph
```

#### 审查点

```text
feature 模块是否互相直接依赖？
core 模块是否反向依赖 feature？
domain 是否依赖 UI？
commonMain 是否依赖平台实现？
feature 是否绕过 UseCase 访问 Repository Impl？
analytics 是否散落在 feature 内？
i18n key 是否分散不可治理？
```

#### 示例问题

```text
问题：feature-trade 直接依赖 feature-market.ui.QuoteCard。
风险：交易模块和行情模块耦合，组件复用语义不清，后续独立测试和维护困难。
建议：将 QuoteCard 下沉为 core-business-ui 中的 QuoteSummaryCard，由 trade 模块注入上下文和埋点语义。
```

### 5.3 复用审查

#### 应该复用的内容

```text
业务规则
字段校验
UseCase
Result model
UiState pattern
基础 UI 组件
设计 token
埋点事件定义
i18n key
权限服务接口
错误处理模型
网络状态模型
分页模型
空态 / 错误态组件
```

#### 不应盲目复用的内容

```text
强业务页面
强行业流程
平台特有交互
不同上下文语义不同的组件
带隐式埋点的 UI 组件
带隐式导航的业务组件
```

---

## Phase 6：Interaction Contract Extraction / 交互契约抽取

### 目标

审查移动端交互状态是否完整建模和实现。

### 抽取内容

```text
1. loading
2. empty
3. error
4. offline
5. permission_denied
6. submitting
7. submitted
8. disabled
9. retry
10. refreshing
11. pagination
12. back
13. cancel
14. dismiss
15. input focus
16. keyboard sensitive form
17. safe area sensitive layout
```

### 审查点

```text
PRD 有流程，代码是否有 route？
Figma 有状态，UiState 是否表达？
页面有 TextInput，是否有键盘遮挡风险？
页面有提交按钮，是否有 loading / disabled / duplicate guard？
页面有表单，是否有 dirty check？
页面有列表，是否有 empty / error / retry？
页面涉及权限，是否有拒绝态和设置引导？
```

---

## Phase 7：Analytics Contract Extraction / 埋点契约抽取

### 目标

审查关键路径埋点是否完整、准确、跨端一致、可分析、可测试。

### 抽取内容

```text
1. page view event
2. click event
3. submit event
4. success event
5. failed event
6. exposure event
7. business params
8. failure reason
9. source page
10. platform field
11. dedup strategy
12. Android / iOS event mapping
```

### 审查点

```text
PRD 关键路径是否有埋点？
Figma 关键按钮是否有埋点？
事件名是否统一？
参数是否完整？
失败原因是否结构化？
Android / iOS 是否一致？
曝光是否可能重复？
UI 是否直接拼接埋点字符串？
通用组件是否内置业务埋点？
```

### 示例问题

```text
问题：trade_failed 事件缺少 failure_reason 参数。
风险：无法区分网络失败、资金不足、价格超限、交易密码错误等失败原因。
建议：将 SubmitTradeOrderResult 映射为结构化 AnalyticsParam.failureReason。
```

---

## Phase 8：I18n Contract Extraction / 国际化契约抽取

### 目标

审查用户可见文案、多语言资源、占位符、格式化和布局风险。

### 抽取内容

```text
1. PRD 文案
2. Figma 文案
3. 代码文案
4. strings.xml
5. Localizable.strings
6. shared resources
7. hardcoded text
8. placeholders
9. plural rules
10. date formatting
11. amount formatting
12. number formatting
13. RTL risk
14. accessibility label text
```

### 审查点

```text
用户可见文案是否硬编码？
Figma 文案是否有 i18n key？
Android / iOS key 是否一致？
占位符数量和类型是否一致？
是否存在字符串拼接？
是否支持复数？
日期 / 金额 / 数字是否 locale 化？
长文案是否存在布局膨胀风险？
left / right 是否影响 RTL？
错误提示是否多语言覆盖？
无障碍 label 是否多语言覆盖？
```

---

## Phase 9：Industry Profiler / 行业画像识别

### 目标

从 PRD、Figma、源码、埋点、i18n、模块名、接口路径中自动识别行业候选，并选择行业规则包。

### 证据来源

```text
PRD 术语
Figma 页面和文案
源码类名
UseCase 名称
Repository 名称
API path
埋点事件
i18n key
模块名
业务组件名
```

### 输出示例

```json
{
  "schema_version": "industry-profile.v1",
  "industry_candidates": [
    {
      "industry": "securities",
      "confidence": 0.87,
      "evidence": [
        "PRD contains: 行情, 买入, 卖出, 持仓, 委托, 撤单",
        "Code contains: TradeOrderUseCase, PositionRepository, KLineChart",
        "Figma contains: 交易确认弹窗, 自选股, 个股详情",
        "Analytics contains: trade_submit, quote_view"
      ],
      "recommended_rule_packs": [
        "common-app",
        "finance-common",
        "securities"
      ]
    }
  ],
  "requires_human_confirmation": true
}
```

### 设计约束

```text
1. 行业识别必须有证据。
2. 行业识别必须有置信度。
3. 行业识别只输出 preview。
4. 不自动写 repo-profile.yaml。
5. 低置信度时只启用通用规则包。
```

---

## Phase 10：Rule Pack Selection / 规则包选择

### 规则包分层

```text
L0 common-app
  - 通用移动端交互
  - 状态完整性
  - 键盘
  - 安全区
  - 无障碍
  - 国际化
  - 埋点基础

L1 kmp-clean-architecture
  - KMP source set
  - Clean Architecture
  - UseCase
  - Repository
  - ViewModel
  - UiState / UiEvent
  - expect / actual

L2 component-module-reuse
  - 组件化
  - 模块化
  - 复用
  - 设计系统
  - token
  - duplicate logic

L3 industry
  - finance-common
  - securities
  - ecommerce
  - healthcare
  - education
  - logistics

L4 company-specific
  - 公司埋点规范
  - 公司文案规范
  - 公司设计系统规范
  - 公司架构边界规范
```

---

## 8. Expert Agent 模式设计

## 8.1 总体策略

采用：

```text
固定专家 + 动态行业专家 + 证据审计专家
```

Expert Mode 不是强绑定多 Agent runtime，而是一套角色协议。

同一套协议可以运行在：

```text
1. 多 Agent 并发模式
2. 顺序专家模式
3. 单 Agent 多轮专家模式
```

## 8.2 专家清单

```text
1. Orchestrator Agent / 总编排专家
2. Product Expert / 产品需求专家
3. Figma Design Expert / 设计实现专家
4. Mobile UX Expert / 移动端交互专家
5. KMP Clean Architect / KMP + Clean 架构专家
6. Component Module Expert / 组件化模块化复用专家
7. Analytics Expert / 埋点专家
8. I18n Expert / 国际化专家
9. Industry Expert / 行业专家
10. Evidence Auditor / 证据审计专家
11. Regression Expert / 回归建议专家
12. Report Writer / 报告专家
```

---

## 8.3 Orchestrator Agent

### 输入

```text
preflight.json
all contracts
industry-profile.preview.json
rule-pack-selection.json
```

### 职责

```text
1. 决定审查范围
2. 选择专家
3. 分发上下文
4. 合并专家输出
5. 去重问题
6. 触发 Evidence Auditor
7. 触发 Report Writer
```

### 输出

```text
audit-plan.json
expert-task-list.json
```

---

## 8.4 Product Expert

### 职责

```text
1. 判断 PRD 关键路径是否完整落地
2. 识别需求遗漏
3. 识别异常路径缺失
4. 识别业务规则是否有设计 / 代码实现
5. 识别需求与设计不一致
```

### 不允许

```text
1. 脱离 PRD 编造需求
2. 对没有证据的业务规则下结论
3. 把代码风格问题当产品问题
```

---

## 8.5 Figma Design Expert

### 职责

```text
1. 审查设计状态是否完整
2. 审查组件 variants 是否映射到代码
3. 审查 token 是否一致
4. 审查空态 / 错误态 / loading / disabled 是否实现
5. 审查设计文案是否进入 i18n
```

---

## 8.6 Mobile UX Expert

### 职责

```text
1. 键盘遮挡风险
2. 安全区风险
3. 返回行为风险
4. 弱网和重试
5. 权限拒绝态
6. 重复提交
7. 空态 / 错误态
8. 手势冲突
9. 弹窗层级
10. 系统字体放大
11. 深色模式
```

### 输出要求

每个问题必须标记：

```text
static_confirmed
needs_runtime_verification
needs_real_device
```

---

## 8.7 KMP Clean Architect

### 职责

```text
1. commonMain/domain 是否承载业务规则
2. UI 是否直接依赖 data
3. platform adapter 是否正确隔离
4. expect/actual 是否一致
5. Android/iOS 行为是否漂移
6. UseCase 返回是否结构化
7. UiState/UiEvent 是否完整
```

---

## 8.8 Component Module Expert

### 职责

```text
1. 审查组件复用
2. 审查模块边界
3. 审查设计系统落地
4. 审查业务组件是否重复
5. 审查通用组件是否被业务污染
6. 审查 feature 模块是否互相耦合
7. 审查重复校验 / 重复错误处理 / 重复埋点
```

---

## 8.9 Engineering Quality Expert / 工程质量专家

### 职责

```text
1. 审查整洁架构三原则是否被破坏
2. 审查依赖环、稳定依赖、稳定抽象和扩展性
3. 审查代码上下文是否完整，避免只看 diff 局部导致误判
4. 审查异常是否被捕获、记录、处理和降级
5. 审查代码是否便于测试、隔离、定位和回归
6. 审查身份认证、授权、输入校验、敏感数据加密和线程安全
7. 审查重复代码、长函数、过大类、过长参数列等代码坏味道
8. 审查圈复杂度、嵌套复杂度和是否可通过卫语句简化
9. 审查性能问题，例如慢 SQL、循环内远程调用、重复计算、集合容量预估
10. 审查分布式事务、远程调用一致性、跨库更新和补偿机制
11. 审查防雪崩、防过载、超时、重试、熔断、限流、降级和幂等
```

### 审查原则

```text
1. 不只看变更附近几行，必须读取完整文件、完整方法、调用链和上下游语境。
2. 对复杂方法必须判断是否需要拆分，而不是只评价新增的几行代码。
3. 对远程调用、数据库操作、状态变更和关键业务提交，必须审查异常、幂等、事务和可用性。
4. 对安全相关逻辑，必须审查认证、授权、输入验证、敏感数据和日志脱敏。
5. 对高复杂度代码，必须给出可测试性和可维护性改造建议。
```

---

## 8.9 Analytics Expert

### 职责

```text
1. 审查关键路径埋点覆盖
2. 审查事件命名
3. 审查参数完整性
4. 审查失败原因
5. 审查曝光重复
6. 审查 Android/iOS 一致性
7. 审查埋点是否污染 UI / 组件
```

---

## 8.10 I18n Expert

### 职责

```text
1. 审查硬编码文案
2. 审查 Figma 文案到 i18n key 映射
3. 审查 Android/iOS key 一致性
4. 审查占位符
5. 审查复数
6. 审查日期 / 金额 / 数字本地化
7. 审查长文案布局风险
8. 审查 RTL 风险
```

---

## 8.11 Industry Expert

### 动态专家

根据 `industry-profile.preview.json` 选择：

```text
Securities Expert
Ecommerce Expert
Finance Common Expert
Healthcare Expert
Education Expert
Logistics Expert
```

### 证券专家重点

```text
行情
K线
自选股
买入
卖出
委托
撤单
持仓
成交
资金
风险测评
适当性提示
交易确认
交易密码
行情延迟
弱网恢复
重复提交防护
关键操作审计
```

### 电商专家重点

```text
商品详情
SKU
库存
价格
优惠券
购物车
订单确认
支付
退款
售后
物流
评价
活动
秒杀
```

---

## 8.12 Evidence Auditor

### 职责

```text
1. 检查每个问题是否有足够证据
2. 删除无证据猜测
3. 合并重复问题
4. 标记静态确认置信度
5. 标记是否需要运行验证
6. 检查文件路径 / PRD / Figma / Code 证据是否完整
```

### 原则

```text
No evidence, no issue.
Weak evidence, mark as risk not confirmed issue.
```

---

## 8.13 Regression Expert

### 职责

```text
1. 将高价值问题转成回归建议
2. 生成 Maestro flow 草案
3. 生成 Appium flow 草案
4. 标记是否需要模拟器
5. 标记是否需要真机
```

---

## 8.14 Report Writer

### 职责

```text
1. 汇总最终报告
2. 按严重等级排序
3. 按领域分类
4. 输出修复建议
5. 输出矩阵
6. 输出可沉淀规范
7. 输出 writeback preview
```

---

## 9. Issue 协议设计

所有专家输出问题必须符合统一结构。

```json
{
  "id": "APP-AUDIT-023",
  "title": "交易提交前确认状态未进入 UiState",
  "severity": "blocker",
  "category": "industry_interaction",
  "expert": "securities-expert",
  "confidence": 0.91,
  "static_confirmed": true,
  "requires_runtime_verification": false,
  "requires_real_device": false,
  "evidence": {
    "prd": [
      {
        "file": "docs/prd/trade.md",
        "summary": "PRD 要求买入前展示委托确认信息"
      }
    ],
    "figma": [
      {
        "node": "TradeConfirmDialog",
        "summary": "Figma 存在交易确认弹窗"
      }
    ],
    "code": [
      {
        "file": "shared/src/commonMain/kotlin/trade/TradeViewModel.kt",
        "summary": "未发现 ConfirmState 或 TradeOrderPreview 状态"
      }
    ]
  },
  "impact": [
    "用户可能未确认交易信息就提交委托",
    "交易确认曝光和确认提交埋点无法稳定采集",
    "Android/iOS 交易确认行为可能漂移"
  ],
  "recommendation": [
    "在 commonMain 建模 TradeOrderPreview",
    "增加 TradeUiState.Confirming",
    "提交前先进入确认态，再触发 SubmitTradeOrderUseCase",
    "补充 trade_confirm_view 和 trade_confirm_submit 埋点"
  ],
  "related_rule_packs": [
    "common-app",
    "finance-common",
    "securities"
  ]
}
```

---

## 10. 严重等级设计

### Blocker

```text
1. 核心业务流程缺失
2. 行业关键操作缺确认
3. 交易 / 支付 / 提交缺防重复
4. PRD 明确要求但代码完全没有
5. Android / iOS 核心行为明显不一致
6. 关键转化埋点缺失
7. 关键错误态无恢复路径
8. 合规 / 风险提示缺失
```

### High

```text
1. Figma 关键状态未实现
2. UseCase 未结构化表达失败
3. 业务规则落在 UI 层
4. 平台能力没有隔离
5. 核心文案硬编码
6. 埋点事件跨端不一致
7. 模块边界严重破坏
8. 行业关键异常未建模
```

### Medium

```text
1. 组件复用不足
2. 设计 token 不一致
3. 部分 error / empty 缺失
4. 曝光埋点可能重复
5. i18n key 不统一
6. 模块依赖不清晰
7. 多语言布局有风险
```

### Low

```text
1. 命名不统一
2. 轻微文案漂移
3. 组件 API 不够标准
4. 非核心埋点参数缺失
5. 建议补充回归 flow
```

---

## 11. Runtime Verification Policy / 运行验证策略

默认不运行设备，但每个问题必须给出运行验证判断。

### 11.1 静态可确认

```text
没有 UiState
没有 UseCase
没有 i18n key
没有 analytics event
没有组件 variant
模块依赖反向
UI 直接依赖 data
commonMain 出现 Android Context
```

这些问题不需要运行验证。

### 11.2 建议模拟器验证

```text
键盘遮挡
安全区遮挡
导航返回
深色模式
系统字体放大
多语言文案裁剪
弹窗层级
基础手势
```

### 11.3 建议真机验证

```text
相机
定位
蓝牙
推送
生物识别
支付
证券交易安全链路
性能
弱网
系统权限永久拒绝
```

### 11.4 输出字段

```json
{
  "runtime_verification": {
    "required": true,
    "level": "simulator",
    "reason": "静态证据显示存在键盘遮挡风险，但需要真实渲染确认"
  }
}
```

---

## 12. 审查矩阵设计

### 12.1 Product → Figma → Code 矩阵

```text
PRD 需求是否有设计？
设计状态是否有代码？
代码实现是否符合需求？
```

### 12.2 Figma → Component 矩阵

```text
Figma 组件是否有代码组件？
Variant 是否完整？
Token 是否一致？
组件是否复用？
```

### 12.3 PRD → Domain → UseCase 矩阵

```text
业务规则是否进入 commonMain/domain？
是否只写在 UI？
Android/iOS 是否共享？
```

### 12.4 Figma State → UiState 矩阵

```text
Figma 的 loading / error / empty / disabled / success 是否进入 UiState？
```

### 12.5 Module Boundary 矩阵

```text
模块依赖是否反向？
feature 是否互相耦合？
core 是否被污染？
```

### 12.6 Analytics Coverage 矩阵

```text
关键路径是否有埋点？
事件名是否一致？
参数是否完整？
失败原因是否结构化？
```

### 12.7 I18n Coverage 矩阵

```text
文案是否外置？
key 是否一致？
多语言是否完整？
布局是否有膨胀风险？
```

### 12.8 Industry-Aware 矩阵

```text
行业关键流程是否完整？
行业关键确认是否存在？
行业合规提示是否覆盖？
行业风险状态是否被建模？
```

---

## 12A. App 工程质量扩展审查域

除了产品、设计、交互、埋点、国际化和行业一致性审查外，App 代码审查还必须覆盖工程质量域。该域由 `Engineering Quality Expert` 负责，但必须聚焦 App 场景，不能把后端代码审查清单原样搬进移动端。

本 Skill 中的工程质量审查重点是：

```text
App 架构边界
移动端生命周期
UI 主线程与渲染性能
协程 / 异步任务取消
弱网与离线体验
本地缓存与远端状态一致性
权限与隐私
WebView / Deep Link / Scheme 安全
埋点与日志脱敏
KMP commonMain 与平台层隔离
Android / iOS 行为一致性
App 端可测性与回归成本
```

因此，原本偏后端的概念需要转换为 App 语境：

```text
慢 SQL             → 本地数据库查询、Room/SQLDelight 查询、列表加载和主线程 IO
分布式事务         → App 本地状态、缓存、远端提交、支付/交易/订单状态的最终一致性
防雪崩 / 防过载    → App 对高频点击、重复请求、弱网重试、并发刷新、接口失败的保护
服务可用性         → App 核心路径在弱网、接口失败、部分失败、缓存兜底下是否仍可用
安全性             → token、隐私数据、日志、WebView、Deep Link、剪贴板、截图录屏等移动端风险
```

---

## 12A.1 App 架构设计审查

### 审查目标

判断 App 代码是否符合移动端 Clean Architecture / KMP 分层原则，是否存在依赖方向错误、平台能力泄漏、模块耦合、扩展性不足，以及弱网、缓存、权限、生命周期等 App 场景下的可用性风险。

### 审查点

```text
1. 是否符合 App 端整洁架构原则：
   - UI 层只负责渲染状态和派发事件
   - Presentation 层负责状态编排，不直接持有平台细节
   - Domain 层承载业务规则，不依赖 UI、数据库、网络和平台 API
   - Data 层负责 repository 实现、remote/local/cache 编排
   - Platform 层隔离权限、定位、相机、推送、Keychain/Keystore 等能力

2. KMP source set 是否清晰：
   - commonMain 不应出现 Android Context / Activity / Intent
   - commonMain 不应出现 UIKit / UIViewController / Bundle 等 iOS 类型
   - androidMain / iosMain 只负责平台实现，不重复业务规则
   - expect/actual 或 interface adapter 是否表达平台差异

3. 是否存在依赖环：
   - feature 之间互相直接依赖
   - core 反向依赖 feature
   - domain 依赖 data / ui / platform
   - design-system 依赖业务 feature
   - analytics / i18n 模块被业务反向污染

4. 是否符合稳定依赖和稳定抽象：
   - 稳定 core 模块不应依赖高变化 feature
   - domain 应依赖 interface，而不是具体 remote/local 实现
   - 平台能力应通过 PermissionService / LocationService / SecureStorage 等抽象隔离
   - 可替换的数据源、埋点 SDK、i18n resolver 应通过接口注入

5. 是否具备 App 端扩展性：
   - 新页面是否能复用现有状态模型、组件和导航模式
   - 新平台能力是否能通过 adapter 扩展
   - 新行业规则是否能通过 rule pack 扩展
   - 新埋点 SDK 是否不影响业务层
   - 新语言资源是否不需要修改业务代码

6. 是否具备 App 可用性保护：
   - 远程请求是否有超时
   - 重试是否有上限和退避
   - 高频点击是否有防重复提交
   - 弱网是否有 loading / retry / offline / cached state
   - 接口失败是否支持部分失败和缓存兜底
   - 页面销毁后异步任务是否取消
   - 后台恢复后状态是否刷新或校验
```

### 示例问题

```text
问题：TradeUseCase 直接依赖 RemoteTradeApiImpl，未通过 Repository interface 隔离。
风险：domain 层依赖具体网络实现，难以测试；后续切换交易通道、增加 mock 环境或处理离线缓存成本高。
建议：在 domain 层定义 TradeRepository interface，由 data 层编排 remote/local/cache，并在测试中注入 fake repository。
```

---

## 12A.2 语境审查

### 审查目标

避免只看局部 diff 得出错误结论。对于 App 审查，必须读取完整文件、完整方法、调用链、状态流转和上下游模块。

### 审查点

```text
1. 修改是否放在正确方法中？
2. 新增几行代码是否隐藏在过长方法中？
3. 当前方法是否已经承担过多职责？
4. 修改是否破坏原有状态流转？
5. 修改是否和上下游调用方语义一致？
6. 是否需要查看完整类、完整 ViewModel、完整 UseCase、完整 Repository？
7. 是否需要查看对应测试、埋点、i18n、Figma 状态和 PRD 规则？
```

### 示例问题

```text
问题：新增的 4 行异常处理代码位于 80 行 submitOrder 方法中，方法同时负责校验、埋点、提交、导航和错误展示。
风险：职责过重，异常处理容易遗漏，后续修改难以测试。
建议：拆分为 validateInput、buildOrderPreview、submitOrder、handleSubmitResult，并将结果映射为 UiState。
```

---

## 12A.3 App 异常处理审查

### 审查点

```text
1. 网络异常是否被结构化处理？
2. 业务异常是否和系统异常区分？
3. 协程 CancellationException 是否被错误吞掉？
4. 页面销毁、返回、切后台时异步任务是否取消？
5. 异常是否映射为用户可理解的 UiState，而不是只 toast？
6. 是否提供 retry / fallback / cached state / offline state？
7. 是否避免 catch Exception 后统一 UnknownError？
8. 是否记录必要日志，同时避免记录手机号、token、验证码、交易密码等敏感数据？
9. 失败原因是否进入 analytics params，支持问题定位和漏斗分析？
10. Android / iOS 对同一类失败是否映射一致？
11. App 启动、登录态恢复、页面刷新、支付/交易/订单提交等关键链路是否有兜底状态？
```

### 示例问题

```text
问题：SubmitTradeOrderUseCase catch Exception 后统一返回 UnknownError。
风险：无法区分网络失败、资金不足、交易密码错误、价格超限，UI 和埋点均无法准确表达失败原因。
建议：将异常映射为结构化 SubmitTradeOrderResult，并在 ViewModel 中转换为 UiState 和 AnalyticsEvent。
```

---

## 12A.4 可测性审查

### 审查目标

判断代码是否便于发现、隔离、定位故障，并能在合理时间和成本内设计和执行测试。

### 审查点

```text
1. 业务规则是否可单元测试？
2. UseCase 是否可注入 fake repository？
3. ViewModel 是否可以通过 UiState / UiEvent 测试？
4. 平台能力是否通过 interface / expect-actual 隔离？
5. 时间、随机数、网络状态、登录态是否可注入？
6. 是否有全局单例导致测试困难？
7. 是否存在静态方法强耦合？
8. 是否有过多副作用写在 UI 层？
9. 是否可以隔离失败原因？
10. 是否能做回归测试建议？
```

### 示例问题

```text
问题：验证码倒计时直接依赖系统时间和 UI timer，未通过 Clock / TimerProvider 注入。
风险：倒计时规则难以单元测试，弱网和后台恢复场景难以验证。
建议：抽象 ClockProvider，并将倒计时状态放入 ViewModel UiState。
```

---

## 12A.5 App 安全性审查

### 审查点

```text
1. App 登录态、token、refresh token 是否安全存储？
2. 是否使用 Keychain / Keystore / EncryptedSharedPreferences 等安全存储能力？
3. token、手机号、身份证号、验证码、交易密码、银行卡号等敏感数据是否避免明文日志？
4. 本地缓存是否有过期、清理和登录态切换隔离策略？
5. Deep Link / Scheme / Universal Link 是否校验来源和参数？
6. WebView 是否限制 JS bridge 暴露面，是否防止任意 URL、XSS、JS 注入和文件访问风险？
7. 输入数据是否校验，例如金额、数量、手机号、验证码、URL、HTML、搜索词？
8. 是否存在越权页面访问，例如未登录可进入资产、订单、交易、个人信息页面？
9. 截图、录屏、剪贴板、分享、日志中是否泄露敏感信息？
10. 网络通信是否使用 HTTPS，是否需要证书固定或防中间人策略？
11. 多线程 / 协程并发是否存在竞态条件，例如重复提交、状态覆盖、缓存污染？
12. Android / iOS 对敏感权限和隐私提示是否一致？
```

### 示例问题

```text
问题：登录失败日志记录了完整手机号和验证码。
风险：敏感数据进入日志系统，存在隐私和安全风险。
建议：手机号脱敏，验证码禁止记录，日志中仅保留 requestId 和 failureReason。
```

---

## 12A.6 代码坏味道审查

### 审查点

```text
1. 重复代码
2. 长函数
3. 过大的类
4. 过长参数列
5. 过深嵌套
6. 霰弹式修改
7. 发散式变化
8. 数据泥团
9. 过多 Boolean 参数
10. 神对象 / God ViewModel
11. UI 层承担业务规则
12. Repository 承担过多业务编排
```

### 示例问题

```text
问题：LoginViewModel 同时处理输入校验、验证码倒计时、登录请求、错误文案、埋点和导航。
风险：类职责过大，可测性和可维护性下降。
建议：拆分 PhoneValidator、CaptchaTimer、LoginUseCase、LoginAnalyticsMapper，并让 ViewModel 只负责状态编排。
```

---

## 12A.7 圈复杂度审查

### 审查点

```text
1. if / else 是否过多？
2. when / switch 分支是否过多？
3. for / while 是否嵌套？
4. 是否存在深层嵌套条件？
5. 是否可以用卫语句提前返回？
6. 是否可以拆分策略类 / mapper / validator？
7. 是否可以用 sealed result 替代散乱条件判断？
8. 是否可以将复杂 UI 状态映射拆成独立函数？
```

### 示例问题

```text
问题：mapTradeErrorToUiState 中存在 18 个 when 分支并嵌套权限、网络和业务状态判断。
风险：新增错误类型时容易遗漏，测试用例数量膨胀。
建议：按 error category 拆分 mapper，并使用 sealed interface 表达错误族。
```

---

## 12A.8 App 性能问题审查

### 审查点

```text
1. 是否在 UI 主线程执行数据库、文件、网络或大 JSON 解析？
2. Room / SQLDelight / SQLite 查询是否可能阻塞列表加载或页面打开？
3. 是否存在本地数据库查询无索引、无分页、一次加载过多数据？
4. 是否在循环中访问数据库、本地缓存或远程接口？
5. 是否存在 N+1 请求，例如逐个股票、逐个商品、逐个订单请求详情？
6. 是否重复调用同一接口，缺少请求合并、缓存或防抖？
7. 是否在频繁 recomposition / SwiftUI body / RecyclerView bind / Compose LazyList item 中做重计算？
8. 是否未预估集合大小导致频繁扩容？
9. 是否在循环中使用 try-catch 或创建大量临时对象？
10. 图片、图表、K线、长列表是否有懒加载、缓存、占位和降级？
11. 页面启动、首页加载、登录恢复是否有并发请求过载风险？
12. 是否有分页、缓存、节流、防抖、超时和取消？
13. App 进入后台或页面销毁后是否停止无意义轮询？
```

### 示例问题

```text
问题：PortfolioViewModel 在循环中逐个请求每只股票的实时行情。
风险：持仓数量增加时产生 N+1 远程调用，导致页面加载慢并放大后端压力。
建议：改为批量 quote API，增加缓存和超时控制，并在失败时返回部分可用状态。
```

---

## 12A.9 App 本地-远端一致性审查

> 注意：在 App 场景中，不应把“分布式事务”按后端跨库事务理解。这里关注的是 App 本地状态、缓存、远端提交结果、支付/交易/订单状态、离线操作和重试之间的一致性。

### 审查点

```text
1. 是否涉及远程提交后更新本地缓存？
2. 是否存在先更新 UI / 本地缓存，再等待远端确认的乐观更新？
3. 乐观更新失败后是否有回滚或重新同步？
4. 支付、交易、订单、退款、撤单等关键操作是否有 Pending / Submitting / Success / Failed / Unknown 状态？
5. 是否有幂等 key 或 requestId，避免重复点击和弱网重试导致重复提交？
6. App 断网、切后台、进程被杀后，未完成操作是否可恢复或查询最终状态？
7. 本地缓存和服务端状态冲突时，是否有明确合并策略？
8. 离线队列是否有重试、过期、取消和用户可见状态？
9. 失败重试是否可能导致重复扣款、重复下单、重复委托或重复埋点？
10. 是否有审计日志或关键操作流水，便于定位用户反馈？
11. 用户是否能理解“处理中 / 结果未知 / 可重试 / 已失败 / 已确认”的状态？
12. Android / iOS 对最终一致性状态是否一致？
```

### 示例问题

```text
问题：订单提交成功后立即更新本地缓存为已成交，但远程成交确认仍可能失败。
风险：本地状态与服务端状态不一致，用户看到错误交易状态。
建议：引入 Pending / Submitted / Confirmed / Failed 状态机，并通过订单查询或服务端回调确认最终状态。
```

---

## 12A.10 App 可用性、防过载与弱网审查

> App 端的“防雪崩、防过载”主要体现为：不要因为用户高频操作、页面并发刷新、弱网无限重试、接口部分失败或后台恢复，导致 App 卡死、请求风暴、状态错乱或核心路径不可用。

### 审查点

```text
1. 远程请求是否有 timeout？
2. retry 是否有最大次数、退避策略和取消条件？
3. 是否避免弱网下无限重试或页面反复触发请求？
4. 下拉刷新、Tab 切换、页面返回、App 前后台切换是否会重复触发请求？
5. 是否有请求合并、去重、节流、防抖？
6. 核心接口失败时是否支持缓存兜底或部分失败展示？
7. 首页、多模块页面、行情页、订单页是否支持部分模块失败而不是整页失败？
8. 高频点击是否有防重复提交和幂等？
9. WebSocket / 轮询是否在页面离开或 App 后台时暂停？
10. App 启动或登录态恢复时是否避免同时打爆多个接口？
11. 是否有 offline / degraded / cached / retrying 等用户可理解状态？
12. Android / iOS 在弱网和后台恢复场景下是否表现一致？
```

### 示例问题

```text
问题：首页多个模块启动时并发请求且无超时、无降级、无部分失败策略。
风险：单个接口慢或失败会拖垮首页体验，弱网下可能造成级联失败。
建议：为每个模块设置独立 timeout，支持部分失败和缓存兜底，并在 UiState 中表达 degraded 状态。
```

---

## 12A.11 工程质量产物

新增输出：

```text
.spec-first/app-audit/engineering-quality-contract.json
.spec-first/app-audit/matrices/engineering-quality-matrix.json
.spec-first/app-audit/expert-reviews/engineering-quality-review.md
```

`engineering-quality-contract.json` 建议包含：

```json
{
  "schema_version": "engineering-quality-contract.v1",
  "architecture": {
    "dependency_cycles": [],
    "unstable_dependencies": [],
    "layer_violations": []
  },
  "complexity": {
    "long_functions": [],
    "large_classes": [],
    "high_cyclomatic_complexity": []
  },
  "exceptions": {
    "uncaught": [],
    "swallowed": [],
    "unstructured_failures": []
  },
  "security": {
    "sensitive_logs": [],
    "missing_input_validation": [],
    "unsafe_storage": []
  },
  "performance": {
    "loop_remote_calls": [],
    "loop_db_calls": [],
    "duplicate_requests": [],
    "main_thread_io": []
  },
  "availability": {
    "missing_timeout": [],
    "missing_idempotency": [],
    "missing_degrade": [],
    "weak_network_risks": [],
    "background_resume_risks": [],
    "local_remote_consistency_risks": []
  }
}
```

---

## 13. 最终报告结构

```markdown
# App Consistency Audit Report

## 1. 审查结论
- 总体风险等级
- Blocker / High / Medium / Low 数量
- 静态可确认问题数量
- 需要模拟器验证问题数量
- 需要真机验证问题数量

## 2. 输入源
- PRD 文件
- Figma frame / node
- 源码目录
- KMP 模块
- Android / iOS 平台
- 埋点资源
- 国际化资源

## 3. 行业画像
- 候选行业
- 置信度
- 证据
- 启用规则包

## 4. 产品-设计-代码覆盖矩阵

## 5. KMP + Clean Architecture 审查

## 6. 组件化审查

## 7. 模块化审查

## 8. 复用审查

## 9. 移动端交互审查

## 10. 埋点审查

## 11. 国际化审查

## 12. 行业专项审查

## 13. 跨域问题

## 14. Blocker 问题

## 15. High 问题

## 16. Runtime Verification 建议

## 17. Regression Suggestions

## 18. 可沉淀为项目规范的建议
```

---

## 14. SKILL.md 设计草案

`SKILL.md` 应包含：

```markdown
# spec-app-consistency-audit

## Purpose

基于 PRD、Figma MCP、本地 App 源码、KMP + Clean Architecture、组件化/模块化结构、埋点、国际化和行业规则包，进行产品-设计-架构-代码一致性审查。

## When to Use

- App 端功能开发前 / 开发中 / 提测前
- PRD 和 Figma 已具备，但真机测试成本高
- 需要审查 Android / iOS 跨端一致性
- 需要审查 KMP shared 业务逻辑是否完整承载需求
- 需要审查埋点和国际化
- 需要识别行业专业风险

## When Not to Use

- 只想运行自动化测试
- 没有 PRD / Figma / 源码任何输入
- 只想做代码格式检查
- 需要直接操作真机进行性能测试

## Default Mode

static_only。
默认不启动真机、模拟器或打包流程。

## Workflow

1. Preflight
2. Extract Product Contract
3. Extract Figma Design Contract
4. Extract Codebase Contract
5. Extract KMP Architecture Contract
6. Extract Component / Module / Reuse Contracts
7. Extract Analytics Contract
8. Extract I18n Contract
9. Build Industry Profile
10. Select Rule Packs
11. Run Expert Reviews
12. Evidence Gate
13. Generate Final Report
14. Generate Regression Suggestions
15. Generate Writeback Preview

## Evidence Policy

No evidence, no issue.
所有问题必须绑定 PRD / Figma / Code / Contract / Rule Pack 中至少一种证据。

## Runtime Verification Policy

所有问题必须标记：
- static_confirmed
- needs_runtime_verification
- needs_real_device

## Writeback Policy

只输出 writeback preview，不自动修改 repo-profile.yaml。
```

---

## 15. 脚本职责设计

### preflight.js

职责：

```text
1. 检查输入文件
2. 检查源码结构
3. 检查 KMP source set
4. 检查 analytics / i18n / component / module 线索
5. 输出 preflight.json
```

### extract-prd-contract.js

职责：

```text
1. 读取 PRD 文本
2. 按标题、表格、列表切分
3. 抽取业务流程、规则、异常、埋点、i18n、行业术语
4. 输出 product-contract.json 草案
```

注意：复杂语义抽取交给 LLM，脚本主要做结构化预处理。

### extract-figma-contract.js

职责：

```text
1. 调用 Figma MCP 读取设计上下文
2. 抽取 Frame / Component / Variant / Text / Token
3. 输出 figma-design-contract.json 草案
```

### extract-code-contract.js

职责：

```text
1. 扫描源码文件
2. 识别路由、Screen、ViewModel、UiState、UiEvent、UseCase、Repository
3. 建立基础引用关系
4. 输出 codebase-contract.json
```

### extract-kmp-architecture.js

职责：

```text
1. 识别 commonMain / androidMain / iosMain
2. 识别 domain / data / presentation / ui / platform
3. 识别 expect / actual
4. 检查明显 source set 边界问题
5. 输出 kmp-architecture-contract.json
```

### extract-components.js

职责：

```text
1. 识别 UI 组件
2. 识别业务组件
3. 建立 Figma Component → Code Component 候选映射
4. 扫描 variant props
5. 输出 component-contract.json
```

### extract-modules.js

职责：

```text
1. 读取 Gradle / Xcode / package 结构
2. 生成 module dependency graph
3. 识别 feature/core/design-system/analytics/i18n 模块
4. 输出 module-contract.json
```

### extract-analytics.js

职责：

```text
1. 扫描 analytics call
2. 提取 event name
3. 提取 params
4. 提取 page view / click / submit / success / failed
5. 输出 analytics-contract.json
```

### extract-i18n.js

职责：

```text
1. 扫描 strings.xml / Localizable.strings / shared resources
2. 扫描硬编码文案
3. 扫描占位符和复数
4. 输出 i18n-contract.json
```

### build-industry-profile.js

职责：

```text
1. 从 PRD / Figma / Code / Analytics / I18n 聚合行业证据
2. 计算候选行业置信度
3. 推荐规则包
4. 输出 industry-profile.preview.json
```

### select-rule-packs.js

职责：

```text
1. 根据 preflight 和 industry profile 选择规则包
2. 输出 industry-rule-pack-selection.json
```

### validate-artifacts.js

职责：

```text
1. 校验所有 JSON artifacts schema
2. 检查缺失字段
3. 检查降级模式
4. 输出 validation summary
```

---

## 16. Rule Pack 设计

### 16.1 通用结构

每个 rule pack 包含：

```text
rules.yaml
checklist.md
examples.md
severity.md
terms.yaml
anti-patterns.md
```

### 16.2 securities rule pack 示例

```yaml
industry: securities
terms:
  - 行情
  - K线
  - 自选股
  - 买入
  - 卖出
  - 委托
  - 撤单
  - 持仓
  - 成交
  - 交易密码
  - 风险测评
  - 适当性

critical_flows:
  - quote_view
  - stock_search
  - trade_buy
  - trade_sell
  - order_confirm
  - order_submit
  - order_cancel
  - position_view
  - risk_assessment

required_states:
  trade_submit:
    - editing
    - confirming
    - submitting
    - success
    - failed
    - network_error
    - duplicate_blocked

analytics_expectations:
  trade_submit:
    - trade_page_view
    - trade_confirm_view
    - trade_confirm_submit
    - trade_submit_success
    - trade_submit_failed

high_risk_patterns:
  - submit_trade_without_confirmation
  - missing_duplicate_submit_guard
  - missing_failure_reason
  - platform_specific_trade_logic
```

### 16.3 ecommerce rule pack 示例

```yaml
industry: ecommerce
terms:
  - 商品
  - SKU
  - 购物车
  - 优惠券
  - 订单
  - 支付
  - 退款
  - 售后
  - 物流
  - 库存
  - 秒杀

critical_flows:
  - product_view
  - sku_select
  - add_to_cart
  - checkout
  - payment
  - refund
  - logistics_view

required_states:
  sku_select:
    - available
    - unavailable
    - selected
    - out_of_stock
    - price_changed

analytics_expectations:
  checkout:
    - product_view
    - sku_select
    - add_to_cart
    - checkout_submit
    - payment_success
    - payment_failed

high_risk_patterns:
  - out_of_stock_without_disabled_state
  - price_changed_without_confirmation
  - coupon_failure_without_reason
  - payment_failed_without_retry
```

---

## 17. MVP 分期计划

## v0.1：静态审查 MVP

### 目标

跑通最小闭环。

### 支持能力

```text
1. PRD 本地文件读取
2. Figma MCP 设计契约读取
3. KMP 源码结构识别
4. Product Contract
5. Design Contract
6. Codebase Contract
7. KMP Architecture Contract
8. Interaction Issues
9. Final Report
```

### 专家

```text
Product Expert
Design Expert
KMP Architect
Mobile UX Expert
Evidence Auditor
Report Writer
```

### 暂不做

```text
行业规则包全量
真机验证
自动生成 Maestro / Appium
复杂公司规则
完整埋点审查
完整 i18n 审查
```

---

## v0.2：组件化、模块化、复用

新增：

```text
Component Expert
Module Expert
Reuse Contract
Figma Component → Code Component mapping
module dependency graph
duplicate logic scan
```

---

## v0.3：埋点和国际化

新增：

```text
Analytics Expert
I18n Expert
analytics matrix
i18n matrix
hardcoded text scan
analytics event scan
```

---

## v0.4：行业画像和行业规则包

新增：

```text
Industry Profiler
Industry Expert
finance-common rule pack
securities rule pack
ecommerce rule pack
industry-audit-matrix
```

---

## v0.5：回归建议

新增：

```text
Regression Expert
Maestro flow draft
Appium flow draft
runtime verification plan
```

---

## 18. 与 spec-first 现有体系的关系

### 18.1 与 repo-profile.yaml 的关系

本 Skill 可以读取：

```text
.spec-first/specs/repo-profile.yaml
```

但默认不写入。

可生成：

```text
.spec-first/app-audit/writeback-preview/repo-profile.patch.yaml
```

示例：

```yaml
project_intent:
  domain: securities
  subdomains:
    - market_quote
    - trading
    - portfolio
    - risk_assessment

review_defaults:
  industry_rule_packs:
    - common-app
    - finance-common
    - securities

non_negotiables:
  - trade_submit_requires_confirmation
  - trade_flow_requires_structured_failure
  - analytics_events_must_be_cross_platform_consistent
  - i18n_no_hardcoded_user_facing_text
```

### 18.2 与 graph artifacts 的关系

如果项目已有 spec-first graph artifacts，可以优先读取：

```text
.spec-first/graph/graph-facts.json
.spec-first/graph/bootstrap-impact-capabilities.json
.spec-first/graph/reuse-candidates.json
.spec-first/graph/architecture-facts.json
```

用途：

```text
1. 辅助定位模块依赖
2. 辅助定位复用候选
3. 辅助定位架构事实
4. 辅助减少重复扫描
```

### 18.3 与 spec-plan / spec-code-review 的关系

本 Skill 的输出可以作为后续输入：

```text
spec-app-consistency-audit
  → app-consistency-audit.md
  → issues.json
  → suggested-standards.md
  → spec-plan 生成修复计划
  → spec-work 执行修复
  → spec-code-review 验证修复
```

---

## 19. 示例问题：跨域问题表达

### 示例：提交按钮缺少 loading / disabled

这不是一个单点 UI 问题，而是跨域问题。

证据链：

```text
PRD：要求提交中不能重复点击
Figma：PrimaryButton 有 loading / disabled variant
Code：PrimaryButton 只支持 enabled
UiState：没有 submitting 字段
Analytics：submit_click 可能重复上报
Industry：交易 / 支付 / 下单属于关键操作，必须防重复
```

报告表达：

```text
问题：关键提交操作缺少统一 submitting / disabled 状态建模。
严重等级：High / Blocker，取决于业务是否涉及交易、支付、资金或关键提交。
影响：重复提交、重复埋点、用户状态不明确、跨端行为漂移。
建议：
1. 在 UiState 中增加 submitting / canSubmit
2. PrimaryButton 支持 loading / disabled
3. ViewModel 在 SubmitClicked 后立即进入 submitting
4. UseCase 返回结构化结果
5. Analytics 去重 submit_click / submit_success / submit_failed
```

---

## 20. 风险与边界

### 20.1 静态审查不能确认的内容

```text
真实键盘弹出后是否遮挡
不同机型安全区是否真的压住按钮
动画是否卡顿
列表滚动是否掉帧
实际文案是否裁剪
真实权限弹窗行为
推送 / 蓝牙 / 相机 / 定位真实能力
读屏顺序是否符合用户预期
```

这些只能标记为运行验证建议。

### 20.2 行业识别误判风险

控制方式：

```text
1. 输出候选行业，不强制唯一结果
2. 输出置信度
3. 输出证据
4. 低置信度不启用行业强规则
5. 写入 repo-profile 前必须人工确认
```

### 20.3 Agent 幻觉风险

控制方式：

```text
1. Evidence Auditor 统一审计
2. 每个 issue 必须有证据
3. 弱证据只能标记 risk，不标记 confirmed issue
4. 报告中区分 static_confirmed 和 needs_runtime_verification
```

---

## 21. 实施建议

### 第一阶段优先做

```text
1. SKILL.md
2. preflight.js
3. extract-code-contract.js
4. extract-kmp-architecture.js
5. product-expert.md
6. figma-design-expert.md
7. kmp-clean-architect.md
8. mobile-ux-expert.md
9. evidence-auditor.md
10. report-writer.md
```

### 第一阶段不要做

```text
1. 不接真机
2. 不接云真机
3. 不做复杂规则引擎
4. 不自动写 repo-profile
5. 不一口气覆盖所有行业
```

### 最小闭环目标

一次执行可以输出：

```text
.spec-first/app-audit/preflight.json
.spec-first/app-audit/product-contract.json
.spec-first/app-audit/figma-design-contract.json
.spec-first/app-audit/codebase-contract.json
.spec-first/app-audit/kmp-architecture-contract.json
.spec-first/app-audit/issues.json
.spec-first/app-audit/app-consistency-audit.md
```

---

## 22. 最终结论

`spec-app-consistency-audit` 应设计为：

```text
Skill 流程 + Agent 领域专家模式 + Rule Pack 知识增强 + Evidence Gate 证据门禁
```

其中：

```text
Skill 负责：
- 输入读取
- 预检
- 契约抽取
- 规则包选择
- 专家调度
- 证据门禁
- 报告输出
- writeback preview

Agent 专家负责：
- 产品一致性判断
- Figma 设计状态判断
- KMP + Clean 架构判断
- 组件化 / 模块化 / 复用判断
- 移动端交互判断
- 埋点完整性判断
- 国际化判断
- 行业专项判断
```

这个 Skill 的核心价值是：

```text
在 App 跑起来之前，
先把需求、设计、架构、组件、模块、交互、埋点、国际化、行业规则之间的断点审出来。
```

它不是为了替代真机测试，而是为了把真机测试前置为更高质量、更低成本、更有证据的静态专家审查流程。

