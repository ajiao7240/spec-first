# DSPy.rb LLM 提供商

## 适配器架构

DSPy.rb 将提供者 SDK 作为单独的适配器 gem 提供。仅安装项目需要的适配器。每个适配器 gem 都依赖于其提供程序的官方 SDK，并在存在时自动加载 - 无需显式 `require`。
```ruby
# Gemfile
gem 'dspy'              # core framework (no provider SDKs)
gem 'dspy-openai'       # OpenAI, OpenRouter, Ollama
gem 'dspy-anthropic'    # Claude
gem 'dspy-gemini'       # Gemini
gem 'dspy-ruby_llm'     # RubyLLM unified adapter (12+ providers)
```
---

## Per-Provider Adapters

### dspy-openai

涵盖使用 OpenAI 聊天完成协议的任何端点：OpenAI 本身、OpenRouter 和 Ollama。

**SDK依赖：** `openai ~> 0.17`
```ruby
# OpenAI
lm = DSPy::LM.new('openai/gpt-4o-mini', api_key: ENV['OPENAI_API_KEY'])

# OpenRouter -- access 200+ models behind a single key
lm = DSPy::LM.new('openrouter/x-ai/grok-4-fast:free',
  api_key: ENV['OPENROUTER_API_KEY']
)

# Ollama -- local models, no API key required
lm = DSPy::LM.new('ollama/llama3.2')

# Remote Ollama instance
lm = DSPy::LM.new('ollama/llama3.2',
  base_url: 'https://my-ollama.example.com/v1',
  api_key: 'optional-auth-token'
)
```
所有三个子适配器共享相同的请求处理、结构化输出支持和错误报告。交换提供商而不更改更高级别的 DSPy 代码。

对于缺乏本机结构化输出支持的 OpenRouter 模型，请显式禁用它：
```ruby
lm = DSPy::LM.new('openrouter/deepseek/deepseek-chat-v3.1:free',
  api_key: ENV['OPENROUTER_API_KEY'],
  structured_outputs: false
)
```
### dspy-人类

提供克劳德适配器。为任何 `anthropic/*` 型号 ID 安装它。

**SDK依赖：** `anthropic ~> 1.12`
```ruby
lm = DSPy::LM.new('anthropic/claude-sonnet-4-20250514',
  api_key: ENV['ANTHROPIC_API_KEY']
)
```
结构化输出默认为基于工具的 JSON 提取 (`structured_outputs: true`)。设置 `structured_outputs: false` 以使用增强提示提取。
```ruby
# Tool-based extraction (default, most reliable)
lm = DSPy::LM.new('anthropic/claude-sonnet-4-20250514',
  api_key: ENV['ANTHROPIC_API_KEY'],
  structured_outputs: true
)

# Enhanced prompting extraction
lm = DSPy::LM.new('anthropic/claude-sonnet-4-20250514',
  api_key: ENV['ANTHROPIC_API_KEY'],
  structured_outputs: false
)
```
### dspy 双子座

提供 Gemini 适配器。为任何 `gemini/*` 型号 ID 安装它。

**SDK依赖：** `gemini-ai ~> 4.3`
```ruby
lm = DSPy::LM.new('gemini/gemini-2.5-flash',
  api_key: ENV['GEMINI_API_KEY']
)
```
**环境变量：** `GEMINI_API_KEY`（也接受`GOOGLE_API_KEY`）。

---

## RubyLLM 统一适配器

`dspy-ruby_llm` gem 提供了一个适配器，可通过 [RubyLLM](https://rubyllm.com) 路由到 12 个以上的提供商。当项目与多个提供商对话或需要访问 Bedrock、VertexAI、DeepSeek 或 Mistral 而无需专用适配器 gem 时，请使用它。

**SDK依赖：** `ruby_llm ~> 1.3`

### 型号 ID 格式

每个模型 ID 前面加上 `ruby_llm/` 前缀：
```ruby
lm = DSPy::LM.new('ruby_llm/gpt-4o-mini')
lm = DSPy::LM.new('ruby_llm/claude-sonnet-4-20250514')
lm = DSPy::LM.new('ruby_llm/gemini-2.5-flash')
```
适配器自动从 RubyLLM 的模型注册表中检测提供程序。对于不在注册表中的模型，请显式传递 `provider:`：
```ruby
lm = DSPy::LM.new('ruby_llm/llama3.2', provider: 'ollama')
lm = DSPy::LM.new('ruby_llm/anthropic/claude-3-opus',
  api_key: ENV['OPENROUTER_API_KEY'],
  provider: 'openrouter'
)
```
### 使用现有的 RubyLLM 配置

当 RubyLLM 已全局配置时，请省略 `api_key:` 参数。 DSPy 自动重用全局配置：
```ruby
RubyLLM.configure do |config|
  config.openai_api_key = ENV['OPENAI_API_KEY']
  config.anthropic_api_key = ENV['ANTHROPIC_API_KEY']
end

# No api_key needed -- picks up the global config
DSPy.configure do |c|
  c.lm = DSPy::LM.new('ruby_llm/gpt-4o-mini')
end
```
当传递 `api_key:`（或 `base_url:`、`timeout:`、`max_retries:` 中的任何一个）时，DSPy 会创建一个**作用域上下文**，而不是重用全局配置。

### 云托管提供商（Bedrock、VertexAI）

首先全局配置RubyLLM，然后引用模型：
```ruby
# AWS Bedrock
RubyLLM.configure do |c|
  c.bedrock_api_key = ENV['AWS_ACCESS_KEY_ID']
  c.bedrock_secret_key = ENV['AWS_SECRET_ACCESS_KEY']
  c.bedrock_region = 'us-east-1'
end
lm = DSPy::LM.new('ruby_llm/anthropic.claude-3-5-sonnet', provider: 'bedrock')

# Google VertexAI
RubyLLM.configure do |c|
  c.vertexai_project_id = 'your-project-id'
  c.vertexai_location = 'us-central1'
end
lm = DSPy::LM.new('ruby_llm/gemini-pro', provider: 'vertexai')
```
### 支持的提供商表

|供应商|型号 ID 示例 |笔记|
|------------------------|--------------------------------------------------------|--------------------------------|
|开放人工智能 | `ruby_llm/gpt-4o-mini` |从注册表自动检测 |
|人择 | `ruby_llm/claude-sonnet-4-20250514` |从注册表自动检测 |
|双子座| `ruby_llm/gemini-2.5-flash` |从注册表自动检测 |
|深度搜索 | `ruby_llm/deepseek-chat` |从注册表自动检测 |
|米斯特拉尔| `ruby_llm/mistral-large` |从注册表自动检测 |
|奥拉玛 | `ruby_llm/llama3.2` |使用`provider: 'ollama'` |
| AWS 基岩 | `ruby_llm/anthropic.claude-3-5-sonnet` |全局配置RubyLLM |
|顶点人工智能 | `ruby_llm/gemini-pro` |全局配置RubyLLM |
|开放路由器| `ruby_llm/anthropic/claude-3-opus` |使用`provider: 'openrouter'` |
|困惑| `ruby_llm/llama-3.1-sonar-large` |使用`provider: 'perplexity'` |
| GPU堆栈| `ruby_llm/model-name` |使用`provider: 'gpustack'`|

---

## Rails 初始化器模式

在 `after_initialize` 块内配置 DSPy，以便完全加载 Rails 凭证和环境：
```ruby
# config/initializers/dspy.rb
Rails.application.config.after_initialize do
  return if Rails.env.test? # skip in test -- use VCR cassettes instead

  DSPy.configure do |config|
    config.lm = DSPy::LM.new(
      'openai/gpt-4o-mini',
      api_key: Rails.application.credentials.openai_api_key,
      structured_outputs: true
    )

    config.logger = if Rails.env.production?
      Dry.Logger(:dspy, formatter: :json) do |logger|
        logger.add_backend(stream: Rails.root.join("log/dspy.log"))
      end
    else
      Dry.Logger(:dspy) do |logger|
        logger.add_backend(level: :debug, stream: $stdout)
      end
    end
  end
end
```
要点：

- 包裹在 `after_initialize` 中，以便 `Rails.application.credentials` 可用。
- 尽早返回测试环境。依靠 VCR 磁带来获得确定性的 LLM 响应。
- 设置 `structured_outputs: true`（默认值）以进行提供商本机 JSON 提取。
- 在生产中使用 `Dry.Logger` 和 `:json` 格式化程序进行结构化日志解析。

---

## 光纤本地 LM 上下文

`DSPy.with_lm` 设置范围为当前 Fiber 的临时语言模型覆盖。块内的每个预测器调用都使用覆盖；在区块之外，先前的 LM 再次生效。
```ruby
fast = DSPy::LM.new('openai/gpt-4o-mini', api_key: ENV['OPENAI_API_KEY'])
powerful = DSPy::LM.new('anthropic/claude-sonnet-4-20250514', api_key: ENV['ANTHROPIC_API_KEY'])

classifier = Classifier.new

# Uses the global LM
result = classifier.call(text: "Hello")

# Temporarily switch to the fast model
DSPy.with_lm(fast) do
  result = classifier.call(text: "Hello")   # uses gpt-4o-mini
end

# Temporarily switch to the powerful model
DSPy.with_lm(powerful) do
  result = classifier.call(text: "Hello")   # uses claude-sonnet-4
end
```
### LM 解析层次结构

DSPy 按以下顺序解析活动语言模型：

1. **实例级LM**——通过`configure`直接在模块实例上设置
2. **光纤本地 LM** -- 通过 `DSPy.with_lm` 设置
3. **全局 LM** -- 通过 `DSPy.configure` 设置

实例级配置总是获胜，即使在 `DSPy.with_lm` 块内：
```ruby
classifier = Classifier.new
classifier.configure { |c| c.lm = DSPy::LM.new('anthropic/claude-sonnet-4-20250514', api_key: ENV['ANTHROPIC_API_KEY']) }

fast = DSPy::LM.new('openai/gpt-4o-mini', api_key: ENV['OPENAI_API_KEY'])

DSPy.with_lm(fast) do
  classifier.call(text: "Test")  # still uses claude-sonnet-4 (instance-level wins)
end
```
###用于细粒度代理控制的configure_predictor

复杂智能体（`ReAct`、`CodeAct`、`DeepResearch`、`DeepSearch`）包含内部预测变量。使用 `configure` 进行覆盖覆盖，使用 `configure_predictor` 来定位特定的子预测器：
```ruby
agent = DSPy::ReAct.new(MySignature, tools: tools)

# Set a default LM for the agent and all its children
agent.configure { |c| c.lm = DSPy::LM.new('openai/gpt-4o-mini', api_key: ENV['OPENAI_API_KEY']) }

# Override just the reasoning predictor with a more capable model
agent.configure_predictor('thought_generator') do |c|
  c.lm = DSPy::LM.new('anthropic/claude-sonnet-4-20250514', api_key: ENV['ANTHROPIC_API_KEY'])
end

result = agent.call(question: "Summarize the report")
```
两种方法都支持链接：
```ruby
agent
  .configure { |c| c.lm = cheap_model }
  .configure_predictor('thought_generator') { |c| c.lm = expensive_model }
```
#### 按代理类型划分的可用预测器

|代理|内部预测器 |
|----------------------------------|--------------------------------------------------------------------------------|
| `DSPy::ReAct` | `thought_generator`、`observation_processor` |
| `DSPy::CodeAct` | `code_generator`、`observation_processor` |
| `DSPy::DeepResearch` | `planner`、`synthesizer`、`qa_reviewer`、`reporter` |
| `DSPy::DeepSearch` | `seed_predictor`、`search_predictor`、`reader_predictor`、`reason_predictor` |

#### 传播规则

- 配置递归地传播到子代和孙代。
- 具有已配置 LM 的子级不会被稍后的父级 `configure` 调用覆盖。
- 首先配置父级，然后覆盖特定的子级。

---

## 特征标记模型选择

使用 ENV 变量支持的 `FeatureFlags` 模块来集中模型选择。每个工具或代理从标志中读取其模型，回退到全局默认值。
```ruby
module FeatureFlags
  module_function

  def default_model
    ENV.fetch('DSPY_DEFAULT_MODEL', 'openai/gpt-4o-mini')
  end

  def default_api_key
    ENV.fetch('DSPY_DEFAULT_API_KEY') { ENV.fetch('OPENAI_API_KEY', nil) }
  end

  def model_for(tool_name)
    env_key = "DSPY_MODEL_#{tool_name.upcase}"
    ENV.fetch(env_key, default_model)
  end

  def api_key_for(tool_name)
    env_key = "DSPY_API_KEY_#{tool_name.upcase}"
    ENV.fetch(env_key, default_api_key)
  end
end
```
### 每个工具模型覆盖

覆盖单个工具的模型而不触及应用程序代码：
```bash
# .env
DSPY_DEFAULT_MODEL=openai/gpt-4o-mini
DSPY_DEFAULT_API_KEY=sk-...

# Override the classifier to use Claude
DSPY_MODEL_CLASSIFIER=anthropic/claude-sonnet-4-20250514
DSPY_API_KEY_CLASSIFIER=sk-ant-...

# Override the summarizer to use Gemini
DSPY_MODEL_SUMMARIZER=gemini/gemini-2.5-flash
DSPY_API_KEY_SUMMARIZER=...
```
在初始化时将每个代理连接到其标志：
```ruby
class ClassifierAgent < DSPy::Module
  def initialize
    super
    model = FeatureFlags.model_for('classifier')
    api_key = FeatureFlags.api_key_for('classifier')

    @predictor = DSPy::Predict.new(ClassifySignature)
    configure { |c| c.lm = DSPy::LM.new(model, api_key: api_key) }
  end

  def forward(text:)
    @predictor.call(text: text)
  end
end
```
此模式保持模型路由声明性，并避免在代码库中分散 `DSPy::LM.new` 调用。

---

## 兼容性矩阵

跨直接适配器 gem 的功能支持。列出的所有功能均采用 `structured_outputs: true`（默认值）。

|特色 |开放人工智能 |人择 |双子座|奥拉玛 |开放路由器| Ruby 法学硕士 |
|----------------------|--------|------------|--------|---------|------------|----------|
|结构化输出|原生JSON模式|基于工具的提取 |原生 JSON 架构 |兼容 OpenAI 的 JSON |因型号而异 |通过 `with_schema` |
|愿景（图像）|文件 + 网址 |文件 + Base64 |文件 + Base64 |有限公司|变化 |委托给底层提供商 |
|图像 URL |是的 |没有 |没有 |没有 |变化 |取决于提供商 |
|工具调用|是的 |是的 |是的 |变化 |变化 |是的 |
|流媒体|是的 |是的 |是的 |是的 |是的 |是的 |

**注释：**

- **结构化输出** 默认情况下在每个适配器上启用。设置 `structured_outputs: false` 以退回到增强提示提取。
- **视觉/图像 URL：** 只有 OpenAI 支持直接传递 URL。对于 Anthropic 和 Gemini，从文件或 Base64 加载图像：
  ```ruby
  DSPy::Image.from_url("https://example.com/img.jpg")    # OpenAI only
  DSPy::Image.from_file("path/to/image.jpg")             # all providers
  DSPy::Image.from_base64(data, mime_type: "image/jpeg")  # all providers
  ```
- **RubyLLM** 委托给底层提供商，因此功能支持与表中的提供商列相匹配。

### 选择适配器策略|场景|推荐适配器 |
|--------------------------------------------------------|--------------------------------|
|单一提供商（OpenAI、Claude 或 Gemini）|专用宝石 (`dspy-openai`, `dspy-anthropic`, `dspy-gemini`) |
|具有每个代理模型路由的多提供商 | `dspy-ruby_llm` |
| AWS Bedrock 或 Google VertexAI | `dspy-ruby_llm` |
|与 Ollama 一起进行本地开发 | `dspy-openai`（Ollama 子适配器）或 `dspy-ruby_llm` |
| OpenRouter 用于成本优化 | `dspy-openai`（OpenRouter 子适配器）|

### 当前推荐型号

|供应商|型号 ID |使用案例|
|----------|----------------------------------------------------|------------------------|
|开放人工智能 | `openai/gpt-4o-mini` |速度快，性价比高|
|人择 | `anthropic/claude-sonnet-4-20250514` |平衡推理 |
|双子座| `gemini/gemini-2.5-flash` |速度快，性价比高|
|奥拉玛 | `ollama/llama3.2` |本地化，零 API 成本 |
