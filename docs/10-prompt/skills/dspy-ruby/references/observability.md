# DSPy.rb 可观察性

DSPy.rb 提供了一个基于 OpenTelemetry 的事件驱动的可观测系统。该系统用结构化事件发射、可插入侦听器、自动跨度创建和非阻塞 Langfuse 导出来取代猴子修补。

## 事件系统

### 发出事件

使用 `DSPy.event` 发出结构化事件：
```ruby
DSPy.event('lm.tokens', {
  'gen_ai.system' => 'openai',
  'gen_ai.request.model' => 'gpt-4',
  input_tokens: 150,
  output_tokens: 50,
  total_tokens: 200
})
```
事件名称是带有点分隔命名空间的**字符串**（例如，`'llm.generate'`、`'react.iteration_complete'`、`'chain_of_thought.reasoning_complete'`）。请勿使用符号作为事件名称。

属性必须是 JSON 可序列化的。 DSPy 自动合并上下文（跟踪 ID、模块堆栈）并创建 OpenTelemetry 跨度。

### 全球订阅

使用 `DSPy.events.subscribe` 订阅整个应用程序中的事件：
```ruby
# Exact event name
subscription_id = DSPy.events.subscribe('lm.tokens') do |event_name, attrs|
  puts "Tokens used: #{attrs[:total_tokens]}"
end

# Wildcard pattern -- matches llm.generate, llm.stream, etc.
DSPy.events.subscribe('llm.*') do |event_name, attrs|
  track_llm_usage(attrs)
end

# Catch-all wildcard
DSPy.events.subscribe('*') do |event_name, attrs|
  log_everything(event_name, attrs)
end
```
使用全局订阅来解决跨领域问题：可观测性导出器（Langfuse、Datadog）、集中式日志记录、指标收集。

### 模块范围的订阅

在 `DSPy::Module` 子类中声明侦听器。订阅自动作用于模块实例及其后代：
```ruby
class ResearchReport < DSPy::Module
  subscribe 'lm.tokens', :track_tokens, scope: :descendants

  def initialize
    super
    @outliner = DSPy::Predict.new(OutlineSignature)
    @writer   = DSPy::Predict.new(SectionWriterSignature)
    @token_count = 0
  end

  def forward(question:)
    outline = @outliner.call(question: question)
    outline.sections.map do |title|
      draft = @writer.call(question: question, section_title: title)
      { title: title, body: draft.paragraph }
    end
  end

  def track_tokens(_event, attrs)
    @token_count += attrs.fetch(:total_tokens, 0)
  end
end
```
`scope:` 参数接受：
- `:descendants`（默认）--接收来自模块**和**内部调用的每个嵌套模块的事件。
- `DSPy::Module::SubcriptionScope::SelfOnly` -- 限制传递由模块实例本身发出的事件；忽视后代。

使用 `registered_module_subscriptions` 检查活动订阅。用`unsubscribe_module_events`撕掉。

### 取消订阅和清理

通过订阅 ID 删除全局监听器：
```ruby
id = DSPy.events.subscribe('llm.*') { |name, attrs| }
DSPy.events.unsubscribe(id)
```
构建管理自己的订阅生命周期的跟踪器类：
```ruby
class TokenBudgetTracker
  def initialize(budget:)
    @budget = budget
    @usage  = 0
    @subscriptions = []
    @subscriptions << DSPy.events.subscribe('lm.tokens') do |_event, attrs|
      @usage += attrs.fetch(:total_tokens, 0)
      warn("Budget hit") if @usage >= @budget
    end
  end

  def unsubscribe
    @subscriptions.each { |id| DSPy.events.unsubscribe(id) }
    @subscriptions.clear
  end
end
```
### 在测试中清除监听器

在`before`/`after`块中调用`DSPy.events.clear_listeners`以防止测试用例之间的交叉污染：
```ruby
RSpec.configure do |config|
  config.after(:each) { DSPy.events.clear_listeners }
end
```
## dspy-o11y 宝石

可观察性堆栈由三个宝石组成：

|宝石 |目的|
|---|---|
| `dspy` |核心事件总线（`DSPy.event`、`DSPy.events`）——始终可用 |
| `dspy-o11y` | OpenTelemetry 跨度、`AsyncSpanProcessor`、`DSPy::Context.with_span` 助手 |
| `dspy-o11y-langfuse` | Langfuse 适配器——配置针对 Langfuse 端点的 OTLP 导出器 |

＃＃＃ 安装
```ruby
# Gemfile
gem 'dspy'
gem 'dspy-o11y'           # core spans + helpers
gem 'dspy-o11y-langfuse'  # Langfuse/OpenTelemetry adapter (optional)
```
如果可选 gem 不存在，DSPy 会回退到仅记录模式，不会出现错误。

## Langfuse集成

### 环境变量
```bash
# Required
export LANGFUSE_PUBLIC_KEY=pk-lf-your-public-key
export LANGFUSE_SECRET_KEY=sk-lf-your-secret-key

# Optional (defaults to https://cloud.langfuse.com)
export LANGFUSE_HOST=https://us.cloud.langfuse.com

# Tuning (optional)
export DSPY_TELEMETRY_BATCH_SIZE=100        # spans per export batch (default 100)
export DSPY_TELEMETRY_QUEUE_SIZE=1000       # max queued spans (default 1000)
export DSPY_TELEMETRY_EXPORT_INTERVAL=60    # seconds between timed exports (default 60)
export DSPY_TELEMETRY_SHUTDOWN_TIMEOUT=10   # seconds to drain on shutdown (default 10)
```
### 自动配置

在启动时调用 `DSPy::Observability.configure!` 一次（当 `require 'dspy'` 运行并且存在 Langfuse 环境变量时，它已经被自动调用）：
```ruby
require 'dspy'
# If LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are set,
# DSPy::Observability.configure! runs automatically and:
#   1. Configures the OpenTelemetry SDK with an OTLP exporter
#   2. Creates dual output: structured logs AND OpenTelemetry spans
#   3. Exports spans to Langfuse using proper authentication
#   4. Falls back gracefully if gems are missing
```
使用 `DSPy::Observability.enabled?` 验证状态。

### 自动追踪

启用可观察性后，每个 `DSPy::Module#forward` 调用、LM 请求和工具调用都会创建正确的嵌套跨度。 Langfuse 接收分层跟踪：
```
Trace: abc-123-def
+-- ChainOfThought.forward [2000ms]  (observation type: chain)
    +-- llm.generate [1000ms]        (observation type: generation)
        Model: gpt-4-0613
        Tokens: 100 in / 50 out / 150 total
```
DSPy 通过 `DSPy::ObservationType.for_module_class` 自动将模块类映射到 Langfuse 观察类型：

|模块|观察类型|
|---|---|
| `DSPy::LM`（原始聊天）| `generation` |
| `DSPy::ChainOfThought` | `chain` |
| `DSPy::ReAct` | `agent` |
|工具调用 | `tool` |
|记忆/检索| `retriever` |
|嵌入引擎| `embedding` |
|评估模块| `evaluator` |
|通用操作| `span` |

## 成绩报告

### DSPy.score API

使用 `DSPy.score` 报告评估分数：
```ruby
# Numeric (default)
DSPy.score('accuracy', 0.95)

# With comment
DSPy.score('relevance', 0.87, comment: 'High semantic similarity')

# Boolean
DSPy.score('is_valid', 1, data_type: DSPy::Scores::DataType::Boolean)

# Categorical
DSPy.score('sentiment', 'positive', data_type: DSPy::Scores::DataType::Categorical)

# Explicit trace binding
DSPy.score('accuracy', 0.95, trace_id: 'custom-trace-id')
```
可用数据类型：`DSPy::Scores::DataType::Numeric`、`::Boolean`、`::Categorical`。

### Score.create 事件

每个 `DSPy.score` 调用都会发出一个 `'score.create'` 事件。订阅反应：
```ruby
DSPy.events.subscribe('score.create') do |event_name, attrs|
  puts "#{attrs[:score_name]} = #{attrs[:score_value]}"
  # Also available: attrs[:score_id], attrs[:score_data_type],
  # attrs[:score_comment], attrs[:trace_id], attrs[:observation_id],
  # attrs[:timestamp]
end
```
### 使用 DSPy::Scores::Exporter 进行异步 Langfuse 导出

配置导出器以在后台将分数发送到 Langfuse：
```ruby
exporter = DSPy::Scores::Exporter.configure(
  public_key: ENV['LANGFUSE_PUBLIC_KEY'],
  secret_key: ENV['LANGFUSE_SECRET_KEY'],
  host: 'https://cloud.langfuse.com'
)

# Scores are now exported automatically via a background Thread::Queue
DSPy.score('accuracy', 0.95)

# Shut down gracefully (waits up to 5 seconds by default)
exporter.shutdown
```
导出器在内部订阅 `'score.create'` 事件，将它们排队以进行异步处理，并在失败时以指数退避重试。

### 使用 DSPy::Evals 自动导出

将 `export_scores: true` 传递给 `DSPy::Evals` 以自动导出每个示例的分数和聚合批次分数：
```ruby
evaluator = DSPy::Evals.new(
  program,
  metric: my_metric,
  export_scores: true,
  score_name: 'qa_accuracy'
)

result = evaluator.evaluate(test_examples)
```
## DSPy::Context.with_span

为自定义操作创建手动范围。需要`dspy-o11y`。
```ruby
DSPy::Context.with_span(operation: 'custom.retrieval', 'retrieval.source' => 'pinecone') do |span|
  results = pinecone_client.query(embedding)
  span&.set_attribute('retrieval.count', results.size) if span
  results
end
```
将语义属性作为关键字参数与 `operation:` 一起传递。该块接收 OpenTelemetry span 对象（或当可观察性被禁用时 `nil`）。该跨度自动嵌套在当前父跨度下并记录 `duration.ms`、`langfuse.observation.startTime` 和 `langfuse.observation.endTime`。

将 Langfuse 观察类型分配给自定义跨度：
```ruby
DSPy::Context.with_span(
  operation: 'evaluate.batch',
  **DSPy::ObservationType::Evaluator.langfuse_attributes,
  'batch.size' => examples.length
) do |span|
  run_evaluation(examples)
end
```
`with_span` 块内报告的分数自动继承当前跟踪上下文。

## Module Stack Metadata

当`DSPy::Module#forward`运行时，上下文层维护一个模块堆栈。 Every event includes:
```ruby
{
  module_path: [
    { id: "root_uuid",    class: "DeepSearch",    label: nil },
    { id: "planner_uuid", class: "DSPy::Predict", label: "planner" }
  ],
  module_root: { id: "root_uuid", class: "DeepSearch", label: nil },
  module_leaf: { id: "planner_uuid", class: "DSPy::Predict", label: "planner" },
  module_scope: {
    ancestry_token: "root_uuid>planner_uuid",
    depth: 2
  }
}
```
|关键|意义|
|---|---|
| `module_path` |从根到叶的 `{id, class, label}` 条目的有序数组 |
| `module_root` |当前调用链中最外层的模块 |
| `module_leaf` |最里面的（当前正在执行的）模块 |
| `module_scope.ancestry_token` |表示嵌套路径的连接 UUID 的稳定字符串 |
| `module_scope.depth` |堆栈中当前模块的整数深度 |

标签通过模块实例上的 `module_scope_label=` 设置或从命名预测器自动派生。使用此元数据为 Langfuse 过滤器、范围指标或自定义事件路由提供支持。

## 专门的出口工人

`DSPy::Observability::AsyncSpanProcessor`（来自 `dspy-o11y`）使遥测导出远离热路径：

- 在 `Concurrent::SingleThreadExecutor` 上运行 - LLM 工作流程永远不会与 OTLP 网络竞争。
- 在 `Thread::Queue` 中缓冲完成的跨度（最大大小可通过 `DSPY_TELEMETRY_QUEUE_SIZE` 配置）。
- 以 `DSPY_TELEMETRY_BATCH_SIZE` 为批次排出跨度（默认 100）。当队列达到批量大小时，立即触发异步导出。
- 后台计时器线程每 `DSPY_TELEMETRY_EXPORT_INTERVAL` 秒（默认 60）触发定期导出。
- 对导出失败应用指数退避（`0.1 * 2^attempt` 秒），最多 `DEFAULT_MAX_RETRIES` (3)。
- 关闭时，在 `DSPY_TELEMETRY_SHUTDOWN_TIMEOUT` 秒内刷新所有剩余的跨度，然后终止执行器。
- 当队列已满时，删除最旧的跨度，记录 `'observability.span_dropped'`。

没有应用程序代码直接与处理器交互。完全通过环境变量进行配置。

## 内置事件参考|活动名称 |发射者 |关键属性|
|---|---|---|
| `lm.tokens` | `DSPy::LM` | `gen_ai.system`、`gen_ai.request.model`、`input_tokens`、`output_tokens`、`total_tokens` |
| `chain_of_thought.reasoning_complete` | `DSPy::ChainOfThought` | `dspy.signature`、`cot.reasoning_steps`、`cot.reasoning_length`、`cot.has_reasoning` |
| `react.iteration_complete` | `DSPy::ReAct` | `iteration`、`thought`、`action`、`observation` |
| `codeact.iteration_complete` | `dspy-code_act` 宝石 | `iteration`、`code_executed`、`execution_result` |
| `optimization.trial_complete` |提词器 (MIPROv2) | `trial_number`、`score` |
| `score.create` | `DSPy.score` | `score_name`、`score_value`、`score_data_type`、`trace_id` |
| `span.start` | `DSPy::Context.with_span` | `trace_id`、`span_id`、`parent_span_id`、`operation` |

## 最佳实践

- 对事件使用点分隔的字符串名称。遵循 LLM 属性的 OpenTelemetry `gen_ai.*` 约定。
- 当不再需要跟踪器时，始终调用 `unsubscribe`（或 `unsubscribe_module_events` 用于范围订阅）以防止内存泄漏。
- 在测试拆卸中调用`DSPy.events.clear_listeners`以避免交叉污染。
- 将有风险的侦听器逻辑包装在救援块中。事件系统隔离侦听器故障，但显式救援可防止无声吞没域错误。
- 对于代理内部结构，首选模块范围的 `subscribe`。为基础设施层面的问题保留全球`DSPy.events.subscribe`。
