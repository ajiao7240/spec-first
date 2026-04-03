# DSPy.rb 核心概念

## 签名

签名定义应用程序代码和语言模型之间的接口。它们使用 Sorbet 类型指定输入、输出和任务描述，以实现编译时和运行时类型安全。

＃＃＃ 结构
```ruby
class ClassifyEmail < DSPy::Signature
  description "Classify customer support emails by urgency and category"

  input do
    const :subject, String
    const :body, String
  end

  output do
    const :category, String
    const :urgency, String
  end
end
```
### 支持的类型

|类型 | JSON 架构 |笔记|
|------|-------------|--------|
| `String` | `string` |必填字符串 |
| `Integer` | `integer` |整数 |
| `Float` | `number` |小数 |
| `T::Boolean` | `boolean` |真/假|
| `T::Array[X]` | `array` |类型化数组 |
| `T::Hash[K, V]` | `object` |类型键值映射 |
| `T.nilable(X)` |可为空 |可选字段 |
| `Date` | `string` (ISO 8601) |自动转换 |
| `DateTime` | `string` (ISO 8601) |保留时区 |
| `Time` | `string`（ISO 8601）|转换为 UTC |

### 日期和时间类型

Date、DateTime 和 Time 字段序列化为 ISO 8601 字符串，并在输出时自动转换回 Ruby 对象。
```ruby
class EventScheduler < DSPy::Signature
  description "Schedule events based on requirements"

  input do
    const :start_date, Date                  # ISO 8601: YYYY-MM-DD
    const :preferred_time, DateTime          # ISO 8601 with timezone
    const :deadline, Time                    # Converted to UTC
    const :end_date, T.nilable(Date)         # Optional date
  end

  output do
    const :scheduled_date, Date              # String from LLM, auto-converted to Date
    const :event_datetime, DateTime          # Preserves timezone info
    const :created_at, Time                  # Converted to UTC
  end
end

predictor = DSPy::Predict.new(EventScheduler)
result = predictor.call(
  start_date: "2024-01-15",
  preferred_time: "2024-01-15T10:30:45Z",
  deadline: Time.now,
  end_date: nil
)

result.scheduled_date.class  # => Date
result.event_datetime.class  # => DateTime
```
时区约定遵循 ActiveRecord：时间对象转换为 UTC，DateTime 对象保留时区，Date 对象与时区无关。

### 带有 T::Enum 的枚举

使用 `T::Enum` 类定义约束输出值。不要使用内联 `T.enum([...])` 语法。
```ruby
class SentimentAnalysis < DSPy::Signature
  description "Analyze sentiment of text"

  class Sentiment < T::Enum
    enums do
      Positive = new('positive')
      Negative = new('negative')
      Neutral = new('neutral')
    end
  end

  input do
    const :text, String
  end

  output do
    const :sentiment, Sentiment
    const :confidence, Float
  end
end

predictor = DSPy::Predict.new(SentimentAnalysis)
result = predictor.call(text: "This product is amazing!")

result.sentiment              # => #<Sentiment::Positive>
result.sentiment.serialize    # => "positive"
result.confidence             # => 0.92
```
枚举匹配不区分大小写。返回 `"POSITIVE"` 的 LLM 与 `new('positive')` 匹配。

### 默认值

默认值适用于输入和输出。输入默认值减少了调用者样板文件。当 LLM 省略可选字段时，输出默认值提供后备。
```ruby
class SmartSearch < DSPy::Signature
  description "Search with intelligent defaults"

  input do
    const :query, String
    const :max_results, Integer, default: 10
    const :language, String, default: "English"
  end

  output do
    const :results, T::Array[String]
    const :total_found, Integer
    const :cached, T::Boolean, default: false
  end
end

search = DSPy::Predict.new(SmartSearch)
result = search.call(query: "Ruby programming")
# max_results defaults to 10, language defaults to "English"
# If LLM omits `cached`, it defaults to false
```
### 字段说明

将 `description:` 添加到任何字段，以指导法学硕士了解预期内容。这些描述出现在发送到模型的生成的 JSON 架构中。
```ruby
class ASTNode < T::Struct
  const :node_type, String, description: "The type of AST node (heading, paragraph, code_block)"
  const :text, String, default: "", description: "Text content of the node"
  const :level, Integer, default: 0, description: "Heading level 1-6, only for heading nodes"
  const :children, T::Array[ASTNode], default: []
end

ASTNode.field_descriptions[:node_type]  # => "The type of AST node ..."
ASTNode.field_descriptions[:children]   # => nil (no description set)
```
字段描述也适用于签名 `input` 和 `output` 块内：
```ruby
class ExtractEntities < DSPy::Signature
  description "Extract named entities from text"

  input do
    const :text, String, description: "Raw text to analyze"
    const :language, String, default: "en", description: "ISO 639-1 language code"
  end

  output do
    const :entities, T::Array[String], description: "List of extracted entity names"
    const :count, Integer, description: "Total number of unique entities found"
  end
end
```
### 架构格式

DSPy.rb 支持三种模式格式，用于将类型结构传递给 LLM。

#### JSON 架构（默认）

冗长但普遍支持。通过`YourSignature.output_json_schema`访问。

#### BAML 架构

紧凑格式，可减少 80-85% 的架构标记。需要 `sorbet-baml` 宝石。
```ruby
DSPy.configure do |c|
  c.lm = DSPy::LM.new('openai/gpt-4o-mini',
    api_key: ENV['OPENAI_API_KEY'],
    schema_format: :baml
  )
end
```
BAML 仅适用于增强提示模式 (`structured_outputs: false`)。当 `structured_outputs: true` 时，提供者直接接收 JSON Schema。

#### TOON 架构 + 数据格式

面向表的文本格式，可缩小架构定义和提示值。
```ruby
DSPy.configure do |c|
  c.lm = DSPy::LM.new('openai/gpt-4o-mini',
    api_key: ENV['OPENAI_API_KEY'],
    schema_format: :toon,
    data_format:   :toon
  )
end
```
`schema_format: :toon` 替换系统提示符中的架构块。 `data_format: :toon` 在 `toon` 栅栏内呈现输入值和输出模板。仅适用于增强提示模式。 `sorbet-toon` gem 作为依赖项自动包含在内。

### 递归类型

引用自身的结构在生成的 JSON 模式中生成 `$defs` 条目，使用 `$ref` 指针来避免无限递归。
```ruby
class ASTNode < T::Struct
  const :node_type, String
  const :text, String, default: ""
  const :children, T::Array[ASTNode], default: []
end
```
模式生成器检测 `T::Array[ASTNode]` 中的自引用并发出：
```json
{
  "$defs": {
    "ASTNode": { "type": "object", "properties": { ... } }
  },
  "properties": {
    "children": {
      "type": "array",
      "items": { "$ref": "#/$defs/ASTNode" }
    }
  }
}
```
通过 `YourSignature.output_json_schema_with_defs` 访问具有累积定义的模式。

### 与 T.any() 的联合类型

指定接受多种类型的字段：
```ruby
output do
  const :result, T.any(Float, String)
end
```
对于结构联合，DSPy.rb 会自动将 `_type` 鉴别器字段添加到每个结构的 JSON 架构中。 LLM 在其响应中返回 `_type`，DSPy 将哈希转换为正确的结构实例。
```ruby
class CreateTask < T::Struct
  const :title, String
  const :priority, String
end

class DeleteTask < T::Struct
  const :task_id, String
  const :reason, T.nilable(String)
end

class TaskRouter < DSPy::Signature
  description "Route user request to the appropriate task action"

  input do
    const :request, String
  end

  output do
    const :action, T.any(CreateTask, DeleteTask)
  end
end

result = DSPy::Predict.new(TaskRouter).call(request: "Create a task for Q4 review")
result.action.class  # => CreateTask
result.action.title  # => "Q4 Review"
```
模式匹配对结果起作用：
```ruby
case result.action
when CreateTask then puts "Creating: #{result.action.title}"
when DeleteTask then puts "Deleting: #{result.action.task_id}"
end
```
联合类型也适用于异构集合的数组：
```ruby
output do
  const :events, T::Array[T.any(LoginEvent, PurchaseEvent)]
end
```
将联合限制为 2-4 种类型，以实现可靠的 LLM 理解。使用明确的结构名称，因为它们成为 `_type` 鉴别器值。

---

## 模块

模块是包装预测器的可组合构建块。定义一个`forward`方法；使用 `.call()` 调用模块。

### 基本结构
```ruby
class SentimentAnalyzer < DSPy::Module
  def initialize
    super
    @predictor = DSPy::Predict.new(SentimentSignature)
  end

  def forward(text:)
    @predictor.call(text: text)
  end
end

analyzer = SentimentAnalyzer.new
result = analyzer.call(text: "I love this product!")

result.sentiment    # => "positive"
result.confidence   # => 0.9
```
**API规则：**
- 使用 `.call()` 调用模块和预测器，而不是 `.forward()`。
- 使用 `result.field` 访问结果字段，而不是 `result[:field]`。

### 模块组成

通过`forward`中的显式方法调用组合多个模块：
```ruby
class DocumentProcessor < DSPy::Module
  def initialize
    super
    @classifier = DocumentClassifier.new
    @summarizer = DocumentSummarizer.new
  end

  def forward(document:)
    classification = @classifier.call(content: document)
    summary = @summarizer.call(content: document)

    {
      document_type: classification.document_type,
      summary: summary.summary
    }
  end
end
```
### 生命周期回调

模块支持 `forward` 上的 `before`、`after` 和 `around` 回调。将它们声明为引用私有方法的类级宏。

#### 执行顺序

1. `before`回调（按注册顺序）
2. `around`回调（在`yield`之前）
3.`forward`方法
4. `around`回调（在`yield`之后）
5. `after`回调（按注册顺序）
```ruby
class InstrumentedModule < DSPy::Module
  before :setup_metrics
  after :log_metrics
  around :manage_context

  def initialize
    super
    @predictor = DSPy::Predict.new(MySignature)
    @metrics = {}
  end

  def forward(question:)
    @predictor.call(question: question)
  end

  private

  def setup_metrics
    @metrics[:start_time] = Time.now
  end

  def manage_context
    load_context
    result = yield
    save_context
    result
  end

  def log_metrics
    @metrics[:duration] = Time.now - @metrics[:start_time]
  end
end
```
相同类型的多个回调按注册顺序执行。回调继承自父类；父回调首先运行。

#### 围绕回调

周围回调必须调用 `yield` 来执行包装的方法并返回结果：
```ruby
def with_retry
  retries = 0
  begin
    yield
  rescue StandardError => e
    retries += 1
    retry if retries < 3
    raise e
  end
end
```
### 指令更新合约

提词器（GEPA、MIPROv2）需要模块公开不可变的更新挂钩。包含 `DSPy::Mixins::InstructionUpdatable` 并实现 `with_instruction` 和 `with_examples`，每个返回一个新实例：
```ruby
class SentimentPredictor < DSPy::Module
  include DSPy::Mixins::InstructionUpdatable

  def initialize
    super
    @predictor = DSPy::Predict.new(SentimentSignature)
  end

  def with_instruction(instruction)
    clone = self.class.new
    clone.instance_variable_set(:@predictor, @predictor.with_instruction(instruction))
    clone
  end

  def with_examples(examples)
    clone = self.class.new
    clone.instance_variable_set(:@predictor, @predictor.with_examples(examples))
    clone
  end
end
```
如果模块省略这些钩子，提词器会引发 `DSPy::InstructionUpdateError` 而不是默默地改变状态。

---

## 预测器

预测器是获取签名并从语言模型生成结构化结果的执行引擎。 DSPy.rb 提供四种预测器类型。

### 预测

通过输入/输出直接调用 LLM。最快的选项，最低的代币使用量。
```ruby
classifier = DSPy::Predict.new(ClassifyText)
result = classifier.call(text: "Technical document about APIs")

result.sentiment    # => #<Sentiment::Positive>
result.topics       # => ["APIs", "technical"]
result.confidence   # => 0.92
```
### 思想链

自动将 `reasoning` 字段添加到输出。该模型在最终答案之前生成逐步推理。使用 ChainOfThought 时，请勿在签名输出中定义 `:reasoning` 字段。
```ruby
class SolveMathProblem < DSPy::Signature
  description "Solve mathematical word problems step by step"

  input do
    const :problem, String
  end

  output do
    const :answer, String
    # :reasoning is added automatically by ChainOfThought
  end
end

solver = DSPy::ChainOfThought.new(SolveMathProblem)
result = solver.call(problem: "Sarah has 15 apples. She gives 7 away and buys 12 more.")

result.reasoning  # => "Step by step: 15 - 7 = 8, then 8 + 12 = 20"
result.answer     # => "20 apples"
```
使用 ChainOfThought 进行复杂分析、多步骤推理或当可解释性很重要时。

### 反应

在迭代循环中使用工具的推理 + 行动代理。通过子类化 `DSPy::Tools::Base` 来定义工具。将相关工具分组为 `DSPy::Tools::Toolset`。
```ruby
class WeatherTool < DSPy::Tools::Base
  extend T::Sig

  tool_name "weather"
  tool_description "Get weather information for a location"

  sig { params(location: String).returns(String) }
  def call(location:)
    { location: location, temperature: 72, condition: "sunny" }.to_json
  end
end

class TravelSignature < DSPy::Signature
  description "Help users plan travel"

  input do
    const :destination, String
  end

  output do
    const :recommendations, String
  end
end

agent = DSPy::ReAct.new(
  TravelSignature,
  tools: [WeatherTool.new],
  max_iterations: 5
)

result = agent.call(destination: "Tokyo, Japan")
result.recommendations  # => "Visit Senso-ji Temple early morning..."
result.history          # => Array of reasoning steps, actions, observations
result.iterations       # => 3
result.tools_used       # => ["weather"]
```
使用工具集公开单个类中的多个工具方法：
```ruby
text_tools = DSPy::Tools::TextProcessingToolset.to_tools
agent = DSPy::ReAct.new(MySignature, tools: text_tools)
```
### 代码法案

Think-Code-Observe 代理，用于合成和执行 Ruby 代码。作为单独的宝石发货。
```ruby
# Gemfile
gem 'dspy-code_act', '~> 0.29'
```

```ruby
programmer = DSPy::CodeAct.new(ProgrammingSignature, max_iterations: 10)
result = programmer.call(task: "Calculate the factorial of 20")
```
### 预测器比较

|预测器 |速度|代币使用 |最适合 |
|------------|---------|-------------|---------|
|预测|最快|低|分类、提取|
|思想链|中等|中高|复杂推理、分析 |
|反应 |慢一点 |高|使用工具执行多步骤任务 |
|法典 |最慢|非常高 |动态规划、计算 |

### 并发预测

使用 `Async::Barrier` 同时处理多个独立预测：
```ruby
require 'async'
require 'async/barrier'

analyzer = DSPy::Predict.new(ContentAnalyzer)
documents = ["Text one", "Text two", "Text three"]

Async do
  barrier = Async::Barrier.new

  tasks = documents.map do |doc|
    barrier.async { analyzer.call(content: doc) }
  end

  barrier.wait
  predictions = tasks.map(&:wait)

  predictions.each { |p| puts p.sentiment }
end
```
将 `gem 'async', '~> 2.29'` 添加到 Gemfile 中。处理每个 `barrier.async` 块内的错误，以防止一个故障取消其他故障：
```ruby
barrier.async do
  begin
    analyzer.call(content: doc)
  rescue StandardError => e
    nil
  end
end
```
### 少量示例和指令调整
```ruby
classifier = DSPy::Predict.new(SentimentAnalysis)

examples = [
  DSPy::FewShotExample.new(
    input: { text: "Love it!" },
    output: { sentiment: "positive", confidence: 0.95 }
  )
]

optimized = classifier.with_examples(examples)
tuned = classifier.with_instruction("Be precise and confident.")
```
---

## 类型系统

### 自动类型转换

DSPy.rb v0.9.0+ 自动将 LLM JSON 响应转换为类型化 Ruby 对象：

- **枚举**：字符串值变为 `T::Enum` 实例（不区分大小写）
- **结构**：嵌套哈希成为 `T::Struct` 对象
- **数组**：元素递归转换
- **默认值**：缺少的字段使用声明的默认值

### 联合类型的鉴别器

当字段使用具有结构类型的 `T.any()` 时，DSPy 会向每个结构的架构添加一个 `_type` 字段。反序列化时，`_type` 选择正确的结构类：
```json
{
  "action": {
    "_type": "CreateTask",
    "title": "Review Q4 Report"
  }
}
```
DSPy 将 `"CreateTask"` 与联合成员进行匹配并实例化正确的结构。不需要手动鉴别器字段。

### 递归类型

支持引用自身的结构。模式生成器跟踪访问的类型并在 `$defs` 下生成 `$ref` 指针：
```ruby
class TreeNode < T::Struct
  const :label, String
  const :children, T::Array[TreeNode], default: []
end
```
生成的模式使用 `"$ref": "#/$defs/TreeNode"` 作为子数组项，防止无限模式扩展。

### 嵌套深度

- 1-2 级：在所有提供商中均可靠。
- 3-4 级：有效，但会增加模式复杂性。
- 5 个以上级别：可能会触发 OpenAI 深度验证警告并降低 LLM 准确性。展平深层嵌套结构或拆分为多个签名。

### 提示

- 优先选择 `T::Array[X], default: []` 而不是 `T.nilable(T::Array[X])`——nilable 形式会导致 OpenAI 结构化输出出现架构问题。
- 对联合类型使用清晰的结构名称，因为它们成为 `_type` 鉴别器值。
- 将联合类型限制为 2-4 个成员，以实现可靠的模型理解。
- 检查与 `DSPy::OpenAI::LM::SchemaConverter.validate_compatibility(schema)` 的架构兼容性。
