---
name: dspy-ruby
description: 使用 DSPy.rb 构建类型安全的 LLM 应用程序 — 带有签名、模块、代理和优化的 Ruby 编程提示框架。在实现可预测的 AI 功能、创建 LLM 签名和模块、配置语言模型提供程序、使用工具构建代理系统、优化提示或在 Ruby 应用程序中测试 LLM 支持的功能时使用。
---
# DSPy.rb

> 像构建软件一样构建 LLM 应用程序。类型安全、模块化、可测试。

DSPy.rb 将软件工程最佳实践引入 LLM 开发。无需调整提示，而是使用 Ruby 类型定义您想要的内容，然后让 DSPy 处理其余的事情。

## 概述

DSPy.rb 是一个 Ruby 框架，用于构建具有编程提示的语言模型应用程序。它提供：

- **类型安全签名** — 使用 Sorbet 类型定义输入/输出
- **模块化组件** — 编写和重用 LLM 逻辑
- **自动优化** — 使用数据来改进提示，而不是猜测
- **生产就绪** — 内置可观察性、测试和错误处理

## 核心概念

### 1. 签名

使用 Ruby 类型定义应用程序和 LLM 之间的接口：
```ruby
class EmailClassifier < DSPy::Signature
  description "Classify customer support emails by category and priority"

  class Priority < T::Enum
    enums do
      Low = new('low')
      Medium = new('medium')
      High = new('high')
      Urgent = new('urgent')
    end
  end

  input do
    const :email_content, String
    const :sender, String
  end

  output do
    const :category, String
    const :priority, Priority  # Type-safe enum with defined values
    const :confidence, Float
  end
end
```
### 2. 模块

从简单的构建块构建复杂的工作流程：

- **预测** — 带签名的基本 LLM 通话
- **ChainOfThought** — 逐步推理
- **ReAct** — 使用工具的代理
- **CodeAct** — 动态代码生成代理（安装 `dspy-code_act` gem）

### 3. 工具和工具集

为具有全面 Sorbet 支持的代理创建类型安全的工具：
```ruby
# Enum-based tool with automatic type conversion
class CalculatorTool < DSPy::Tools::Base
  tool_name 'calculator'
  tool_description 'Performs arithmetic operations with type-safe enum inputs'

  class Operation < T::Enum
    enums do
      Add = new('add')
      Subtract = new('subtract')
      Multiply = new('multiply')
      Divide = new('divide')
    end
  end

  sig { params(operation: Operation, num1: Float, num2: Float).returns(T.any(Float, String)) }
  def call(operation:, num1:, num2:)
    case operation
    when Operation::Add then num1 + num2
    when Operation::Subtract then num1 - num2
    when Operation::Multiply then num1 * num2
    when Operation::Divide
      return "Error: Division by zero" if num2 == 0
      num1 / num2
    end
  end
end

# Multi-tool toolset with rich types
class DataToolset < DSPy::Tools::Toolset
  toolset_name "data_processing"

  class Format < T::Enum
    enums do
      JSON = new('json')
      CSV = new('csv')
      XML = new('xml')
    end
  end

  tool :convert, description: "Convert data between formats"
  tool :validate, description: "Validate data structure"

  sig { params(data: String, from: Format, to: Format).returns(String) }
  def convert(data:, from:, to:)
    "Converted from #{from.serialize} to #{to.serialize}"
  end

  sig { params(data: String, format: Format).returns(T::Hash[String, T.any(String, Integer, T::Boolean)]) }
  def validate(data:, format:)
    { valid: true, format: format.serialize, row_count: 42, message: "Data validation passed" }
  end
end
```
### 4. 类型系统和鉴别器

DSPy.rb 对复杂的数据结构使用复杂的类型区分：

- **自动 `_type` 字段注入** - DSPy 将鉴别器字段添加到结构中以实现类型安全
- **联合类型支持** — `T.any()` 类型由 `_type` 自动消除歧义
- **保留字段名称** - 避免在结构中定义自己的 `_type` 字段
- **递归过滤** - `_type` 字段在所有嵌套级别的反序列化期间被过滤

### 5.优化

利用真实数据提高准确性：

- **MIPROv2** — 具有引导采样和贝叶斯优化的高级多重提示优化
- **GEPA** — 具有反馈图、实验跟踪和遥测功能的遗传帕累托反射提示进化
- **评估** — 具有内置和自定义指标、错误处理和批处理的综合框架

## 快速入门
```ruby
# Install
gem 'dspy'

# Configure
DSPy.configure do |c|
  c.lm = DSPy::LM.new('openai/gpt-4o-mini', api_key: ENV['OPENAI_API_KEY'])
end

# Define a task
class SentimentAnalysis < DSPy::Signature
  description "Analyze sentiment of text"

  input do
    const :text, String
  end

  output do
    const :sentiment, String  # positive, negative, neutral
    const :score, Float       # 0.0 to 1.0
  end
end

# Use it
analyzer = DSPy::Predict.new(SentimentAnalysis)
result = analyzer.call(text: "This product is amazing!")
puts result.sentiment  # => "positive"
puts result.score      # => 0.92
```
## 提供者适配器宝石

连接 LLM 提供商的两种策略：

### 每个提供商的适配器（直接 SDK 访问）
```ruby
# Gemfile
gem 'dspy'
gem 'dspy-openai'    # OpenAI, OpenRouter, Ollama
gem 'dspy-anthropic' # Claude
gem 'dspy-gemini'    # Gemini
```
每个适配器 gem 都会引入官方 SDK（`openai`、`anthropic`、`gemini-ai`）。

### 通过 RubyLLM 的统一适配器（推荐用于多提供商）
```ruby
# Gemfile
gem 'dspy'
gem 'dspy-ruby_llm'  # Routes to any provider via ruby_llm
gem 'ruby_llm'
```
RubyLLM 根据模型名称处理提供者路由。使用 `ruby_llm/` 前缀：
```ruby
DSPy.configure do |c|
  c.lm = DSPy::LM.new('ruby_llm/gemini-2.5-flash', structured_outputs: true)
  # c.lm = DSPy::LM.new('ruby_llm/claude-sonnet-4-20250514', structured_outputs: true)
  # c.lm = DSPy::LM.new('ruby_llm/gpt-4o-mini', structured_outputs: true)
end
```
## 活动系统

DSPy.rb 附带一个结构化事件总线，用于观察运行时行为。

### 模块范围的订阅（代理首选）
```ruby
class MyAgent < DSPy::Module
  subscribe 'lm.tokens', :track_tokens, scope: :descendants

  def track_tokens(_event, attrs)
    @total_tokens += attrs.fetch(:total_tokens, 0)
  end
end
```
### 全球订阅（用于可观察性/集成）
```ruby
subscription_id = DSPy.events.subscribe('score.create') do |event, attrs|
  Langfuse.export_score(attrs)
end

# Wildcards supported
DSPy.events.subscribe('llm.*') { |name, attrs| puts "[#{name}] tokens=#{attrs[:total_tokens]}" }
```
事件名称使用点分隔的命名空间（`llm.generate`、`react.iteration_complete`）。每个事件都包含用于过滤的模块元数据（`module_path`、`module_leaf`、`module_scope.ancestry_token`）。

## 生命周期回调

Rails 风格的生命周期钩子随每个 `DSPy::Module` 一起提供：

- **`before`** — 在 `forward` 之前运行进行设置（指标、上下文加载）
- **`around`** — 包装 `forward`，调用 `yield`，并让您配对设置/拆卸逻辑
- **`after`** — `forward` 返回进行清理或持久化后触发
```ruby
class InstrumentedModule < DSPy::Module
  before :setup_metrics
  around :manage_context
  after :log_metrics

  def forward(question:)
    @predictor.call(question: question)
  end

  private

  def setup_metrics
    @start_time = Time.now
  end

  def manage_context
    load_context
    result = yield
    save_context
    result
  end

  def log_metrics
    duration = Time.now - @start_time
    Rails.logger.info "Prediction completed in #{duration}s"
  end
end
```
执行顺序：before→around（yield之前）→forward→around（yield之后）→after。回调从父类继承并按注册顺序执行。

## 光纤本地 LM 上下文

使用光纤本地存储暂时覆盖语言模型：
```ruby
fast_model = DSPy::LM.new("openai/gpt-4o-mini", api_key: ENV['OPENAI_API_KEY'])

DSPy.with_lm(fast_model) do
  result = classifier.call(text: "test")  # Uses fast_model inside this block
end
# Back to global LM outside the block
```
**LM 解析层次结构**：实例级 LM → 光纤本地 LM (`DSPy.with_lm`) → 全局 LM (`DSPy.configure`)。

使用 `configure_predictor` 对代理内部进行细粒度控制：
```ruby
agent = DSPy::ReAct.new(MySignature, tools: tools)
agent.configure { |c| c.lm = default_model }
agent.configure_predictor('thought_generator') { |c| c.lm = powerful_model }
```
## 评估框架

使用 `DSPy::Evals` 系统地测试 LLM 申请表现：
```ruby
metric = DSPy::Metrics.exact_match(field: :answer, case_sensitive: false)
evaluator = DSPy::Evals.new(predictor, metric: metric)
result = evaluator.evaluate(test_examples, display_table: true)
puts "Pass Rate: #{(result.pass_rate * 100).round(1)}%"
```
内置指标：`exact_match`、`contains`、`numeric_difference`、`composite_and`。自定义指标返回 `true`/`false` 或带有 `score:` 和 `feedback:` 字段的 `DSPy::Prediction`。

使用 `DSPy::Example` 输入测试数据，使用 `export_scores: true` 将结果推送到 Langfuse。

## GEPA 优化

GEPA（Genetic-Pareto Reflective Prompt Evolution）使用反射驱动的指令重写：
```ruby
gem 'dspy-gepa'

teleprompter = DSPy::Teleprompt::GEPA.new(
  metric: metric,
  reflection_lm: DSPy::ReflectionLM.new('openai/gpt-4o-mini', api_key: ENV['OPENAI_API_KEY']),
  feedback_map: feedback_map,
  config: { max_metric_calls: 600, minibatch_size: 6 }
)

result = teleprompter.compile(program, trainset: train, valset: val)
optimized_program = result.optimized_program
```
该指标必须返回 `DSPy::Prediction.new(score:, feedback:)`，以便反射模型可以推断失败。使用 `feedback_map` 来定位复合模块中的各个预测变量。

## 类型化上下文模式

将不透明字符串上下文 blob 替换为 `T::Struct` 输入。每个字段在 LLM 看到的 JSON 模式中都有自己的 `description:` 注释：
```ruby
class NavigationContext < T::Struct
  const :workflow_hint, T.nilable(String),
        description: "Current workflow phase guidance for the agent"
  const :action_log, T::Array[String], default: [],
        description: "Compact one-line-per-action history of research steps taken"
  const :iterations_remaining, Integer,
        description: "Budget remaining. Each tool call costs 1 iteration."
end

class ToolSelectionSignature < DSPy::Signature
  input do
    const :query, String
    const :context, NavigationContext  # Structured, not an opaque string
  end

  output do
    const :tool_name, String
    const :tool_args, String, description: "JSON-encoded arguments"
  end
end
```
优点：编译时的类型安全、LLM 模式中的每个字段描述、易于作为值对象进行测试、可通过添加 `const` 声明进行扩展。

## 架构格式 (BAML / TOON)

控制 DSPy 如何向 LLM 描述签名结构：

- **JSON Schema**（默认）- 标准格式，适用于 `structured_outputs: true`
- **BAML** (`schema_format: :baml`) — 增强提示模式的标记减少 84%。需要 `sorbet-baml` 宝石。
- **TOON** (`schema_format: :toon, data_format: :toon`) — 模式和数据的面向表的格式。仅增强提示模式。

BAML 和 TOON 仅在 `structured_outputs: false` 时适用。使用 `structured_outputs: true`，提供者直接接收 JSON 模式。

## 存储系统

使用 `DSPy::Storage::ProgramStorage` 保留并重新加载优化的程序：
```ruby
storage = DSPy::Storage::ProgramStorage.new(storage_path: "./dspy_storage")
storage.save_program(result.optimized_program, result, metadata: { optimizer: 'MIPROv2' })
```
支持检查点管理、优化历史记录跟踪以及环境之间的导入/导出。

## Rails 集成

### 目录结构

使用 Rails 约定组织 DSPy 组件：
```
app/
  entities/          # T::Struct types shared across signatures
  signatures/        # DSPy::Signature definitions
  tools/             # DSPy::Tools::Base implementations
    concerns/        # Shared tool behaviors (error handling, etc.)
  modules/           # DSPy::Module orchestrators
  services/          # Plain Ruby services that compose DSPy modules
config/
  initializers/
    dspy.rb          # DSPy + provider configuration
    feature_flags.rb # Model selection per role
spec/
  signatures/        # Schema validation tests
  tools/             # Tool unit tests
  modules/           # Integration tests with VCR
  vcr_cassettes/     # Recorded HTTP interactions
```
### 初始化器
```ruby
# config/initializers/dspy.rb
Rails.application.config.after_initialize do
  next if Rails.env.test? && ENV["DSPY_ENABLE_IN_TEST"].blank?

  RubyLLM.configure do |config|
    config.gemini_api_key = ENV["GEMINI_API_KEY"] if ENV["GEMINI_API_KEY"].present?
    config.anthropic_api_key = ENV["ANTHROPIC_API_KEY"] if ENV["ANTHROPIC_API_KEY"].present?
    config.openai_api_key = ENV["OPENAI_API_KEY"] if ENV["OPENAI_API_KEY"].present?
  end

  model = ENV.fetch("DSPY_MODEL", "ruby_llm/gemini-2.5-flash")
  DSPy.configure do |config|
    config.lm = DSPy::LM.new(model, structured_outputs: true)
    config.logger = Rails.logger
  end

  # Langfuse observability (optional)
  if ENV["LANGFUSE_PUBLIC_KEY"].present? && ENV["LANGFUSE_SECRET_KEY"].present?
    DSPy::Observability.configure!
  end
end
```
### 特征标记模型选择

对不同的角色使用不同的模型（快速/廉价的分类，强大的综合）：
```ruby
# config/initializers/feature_flags.rb
module FeatureFlags
  SELECTOR_MODEL = ENV.fetch("DSPY_SELECTOR_MODEL", "ruby_llm/gemini-2.5-flash-lite")
  SYNTHESIZER_MODEL = ENV.fetch("DSPY_SYNTHESIZER_MODEL", "ruby_llm/gemini-2.5-flash")
end
```
然后覆盖每个工具或每个预测器：
```ruby
class ClassifyTool < DSPy::Tools::Base
  def call(query:)
    predictor = DSPy::Predict.new(ClassifyQuery)
    predictor.configure { |c| c.lm = DSPy::LM.new(FeatureFlags::SELECTOR_MODEL, structured_outputs: true) }
    predictor.call(query: query)
  end
end
```
## 模式驱动的签名

**优先使用类型化模式而不是字符串描述。** 让类型系统向 LLM 传达结构，而不是签名描述中的散文。

### 作为共享类型的实体

在 `app/entities/` 中定义可重用的 `T::Struct` 和 `T::Enum` 类型并跨签名引用它们：
```ruby
# app/entities/search_strategy.rb
class SearchStrategy < T::Enum
  enums do
    SingleSearch = new("single_search")
    DateDecomposition = new("date_decomposition")
  end
end

# app/entities/scored_item.rb
class ScoredItem < T::Struct
  const :id, String
  const :score, Float, description: "Relevance score 0.0-1.0"
  const :verdict, String, description: "relevant, maybe, or irrelevant"
  const :reason, String, default: ""
end
```
### 模式与描述：何时使用每个模式

**使用模式 (T::Struct/T::Enum)** 用于：
- 具有特定类型的多字段输出
- 法学硕士必须从中选择具有定义值的枚举
- 嵌套结构、类型对象数组
- 代码消耗的输出（不向用户显示）

**使用字符串描述**用于：
- 简单的单字段输出，类型为 `String`
- 自然语言生成（摘要、答案）
- 约束指导有帮助的领域（例如，`description: "YYYY-MM-DD format"`）

**经验法则**：如果您在输出上写入 `case` 语句，则它应该是 `T::Enum`。如果你要调用 `.each`，它应该是 `T::Array[SomeStruct]`。

## 工具模式

### 包装预测的工具

常见模式：工具封装 DSPy 预测，添加错误处理、模型选择和序列化：
```ruby
class RerankTool < DSPy::Tools::Base
  tool_name "rerank"
  tool_description "Score and rank search results by relevance"

  MAX_ITEMS = 200
  MIN_ITEMS_FOR_LLM = 5

  sig { params(query: String, items: T::Array[T::Hash[Symbol, T.untyped]]).returns(T::Hash[Symbol, T.untyped]) }
  def call(query:, items: [])
    return { scored_items: items, reranked: false } if items.size < MIN_ITEMS_FOR_LLM

    capped_items = items.first(MAX_ITEMS)
    predictor = DSPy::Predict.new(RerankSignature)
    predictor.configure { |c| c.lm = DSPy::LM.new(FeatureFlags::SYNTHESIZER_MODEL, structured_outputs: true) }

    result = predictor.call(query: query, items: capped_items)
    { scored_items: result.scored_items, reranked: true }
  rescue => e
    Rails.logger.warn "[RerankTool] LLM rerank failed: #{e.message}"
    { error: "Rerank failed: #{e.message}", scored_items: items, reranked: false }
  end
end
```
**关键模式：**
- 不必要时（小数据、琐碎案例）短路LLM调用
- 限制输入大小以防止令牌溢出
- 通过 `configure` 选择每个工具的模型
- 使用后备数据进行优雅的错误处理

### 错误处理问题
```ruby
module ErrorHandling
  extend ActiveSupport::Concern

  private

  def safe_predict(signature_class, **inputs)
    predictor = DSPy::Predict.new(signature_class)
    yield predictor if block_given?
    predictor.call(**inputs)
  rescue Faraday::Error, Net::HTTPError => e
    Rails.logger.error "[#{self.class.name}] API error: #{e.message}"
    nil
  rescue JSON::ParserError => e
    Rails.logger.error "[#{self.class.name}] Invalid LLM output: #{e.message}"
    nil
  end
end
```
## 可观察性

### 使用 DSPy::Context 进行跟踪

将操作包装在跨度中以实现 Langfuse/OpenTelemetry 可见性：
```ruby
result = DSPy::Context.with_span(
  operation: "tool_selector.select",
  "dspy.module" => "ToolSelector",
  "tool_selector.tools" => tool_names.join(",")
) do
  @predictor.call(query: query, context: context, available_tools: schemas)
end
```
### Langfuse 设置
```ruby
# Gemfile
gem 'dspy-o11y'
gem 'dspy-o11y-langfuse'

# .env
LANGFUSE_PUBLIC_KEY=pk-...
LANGFUSE_SECRET_KEY=sk-...
DSPY_TELEMETRY_BATCH_SIZE=5
```
配置可观测性后，将自动跟踪每个 `DSPy::Predict`、`DSPy::ReAct` 和工具调用。

### 成绩报告

向Langfuse报告评估分数：
```ruby
DSPy.score(name: "relevance", value: 0.85, trace_id: current_trace_id)
```
## 测试

### 导轨 VCR 设置
```ruby
VCR.configure do |config|
  config.cassette_library_dir = "spec/vcr_cassettes"
  config.hook_into :webmock
  config.configure_rspec_metadata!
  config.filter_sensitive_data('<GEMINI_API_KEY>') { ENV['GEMINI_API_KEY'] }
  config.filter_sensitive_data('<OPENAI_API_KEY>') { ENV['OPENAI_API_KEY'] }
end
```
### 签名模式测试

测试签名是否生成有效的模式而不调用任何 LLM：
```ruby
RSpec.describe ClassifyResearchQuery do
  it "has required input fields" do
    schema = described_class.input_json_schema
    expect(schema[:required]).to include("query")
  end

  it "has typed output fields" do
    schema = described_class.output_json_schema
    expect(schema[:properties]).to have_key(:search_strategy)
  end
end
```
### 带有模拟预测的工具测试
```ruby
RSpec.describe RerankTool do
  let(:tool) { described_class.new }

  it "skips LLM for small result sets" do
    expect(DSPy::Predict).not_to receive(:new)
    result = tool.call(query: "test", items: [{ id: "1" }])
    expect(result[:reranked]).to be false
  end

  it "calls LLM for large result sets", :vcr do
    items = 10.times.map { |i| { id: i.to_s, title: "Item #{i}" } }
    result = tool.call(query: "relevant items", items: items)
    expect(result[:reranked]).to be true
  end
end
```
## 资源

- `references/core-concepts.md` — 签名、模块、预测器、类型系统深入研究
- `references/toolsets.md` — 工具::基础、工具::工具集 DSL、类型安全、测试
- `references/providers.md` — 提供商适配器、RubyLLM、光纤本地 LM 上下文、兼容性矩阵
- `references/optimization.md` — MIPROv2、GEPA、评估框架、存储系统
- `references/observability.md` — 事件系统、dspy-o11y gems、Langfuse、分数报告
- `assets/signature-template.rb` — 带有 T::Enum、日期/时间、默认值、联合类型的签名支架
- `assets/module-template.rb` — 具有 .call() 的模块支架、生命周期回调、光纤本地 LM
- `assets/config-template.rb` — Rails 初始化程序，带有 RubyLLM、可观察性、功能标志

## 关键 URL

- 主页：https://oss.vicente.services/dspy.rb/
- GitHub：https://github.com/vicentereig/dspy.rb
- 文档：https://oss.vicente.services/dspy.rb/getting-started/

## 克劳德指南

在帮助用户使用 DSPy.rb 时：1. **散文上的模式** — 使用 `T::Struct` 和 `T::Enum` 类型定义输出结构，而不是字符串描述
2. **`app/entities/`** 中的实体 - 提取共享类型，使签名保持精简
3. **每个工具模型选择** — 使用 `predictor.configure { |c| c.lm = ... }` 为每个任务选择正确的模型
4. **短路 LLM 调用** — 对于琐碎的情况（小数据、缓存结果）跳过 LLM
5. **限制输入大小** — 在发送到 LLM 之前限制数组大小，防止令牌溢出
6. **在没有 LLM 的情况下测试模式** — 在单元测试中验证 `input_json_schema` 和 `output_json_schema`
7. **用于集成测试的 VCR** — 记录真实的 HTTP 交互，切勿手动模拟 LLM 响应
8. **Trace with spans** - 将工具调用包装在 `DSPy::Context.with_span` 中以实现可观察性
9. **优雅降级** — 始终挽救 LLM 错误并返回后备数据

### 签名最佳实践

**保持描述简洁** — 签名 `description` 应说明目标，而不是字段详细信息：
```ruby
# Good — concise goal
class ParseOutline < DSPy::Signature
  description 'Extract block-level structure from HTML as a flat list of skeleton sections.'

  input do
    const :html, String, description: 'Raw HTML to parse'
  end

  output do
    const :sections, T::Array[Section], description: 'Block elements: headings, paragraphs, code blocks, lists'
  end
end
```
**使用可空数组的默认值** — 对于 OpenAI 结构化输出兼容性：
```ruby
# Good — works with OpenAI structured outputs
class ASTNode < T::Struct
  const :children, T::Array[ASTNode], default: []
end
```
### 带有 `$defs` 的递归类型

DSPy.rb 使用 JSON Schema `$defs` 支持结构化输出中的递归类型：
```ruby
class TreeNode < T::Struct
  const :value, String
  const :children, T::Array[TreeNode], default: []  # Self-reference
end
```
模式生成器自动为递归类型创建 `#/$defs/TreeNode` 引用，与 OpenAI 和 Gemini 结构化输出兼容。

### T::Struct 的字段描述

DSPy.rb 扩展了 T::Struct 以支持流向 JSON 模式的字段级 `description:` kwargs：
```ruby
class ASTNode < T::Struct
  const :node_type, NodeType, description: 'The type of node (heading, paragraph, etc.)'
  const :text, String, default: "", description: 'Text content of the node'
  const :level, Integer, default: 0  # No description — field is self-explanatory
  const :children, T::Array[ASTNode], default: []
end
```
**何时使用字段描述**：复杂的字段语义、类似枚举的字符串、受约束的值、名称不明确的嵌套结构。 **何时跳过**：不言自明的字段，例如 `name`、`id`、`url` 或布尔标志。

## 版本

当前：0.34.3
