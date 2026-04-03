# DSPy.rb 工具集

## 工具::基础

`DSPy::Tools::Base` 是单一用途工具的基类。每个子类通过 `call` 方法向 LLM 代理公开一个操作。

### 定义工具

使用 `tool_name` 和 `tool_description` 类级 DSL 方法设置工具的标识。使用 Sorbet `sig` 声明定义 `call` 实例方法，以便 DSPy.rb 可以生成 LLM 用于调用该工具的 JSON 模式。
```ruby
class WeatherLookup < DSPy::Tools::Base
  extend T::Sig

  tool_name "weather_lookup"
  tool_description "Look up current weather for a given city"

  sig { params(city: String, units: T.nilable(String)).returns(String) }
  def call(city:, units: nil)
    # Fetch weather data and return a string summary
    "72F and sunny in #{city}"
  end
end
```
要点：

- 继承自`DSPy::Tools::Base`，而不是`DSPy::Tool`。
- 使用`tool_name`（类方法）设置LLM看到的名称。如果没有它，类名将小写作为后备。
- 使用`tool_description`（类方法）设置工具模式中显示的人类可读的描述。
- `call` 方法必须使用 **关键字参数**。支持位置参数，但关键字参数会产生更好的模式。
- 始终将冰糕 `sig` 连接到 `call`。如果没有签名，生成的模式具有空属性，并且 LLM 无法确定参数类型。

### 模式生成

`call_schema_object` 内省 `call` 上的 Sorbet 签名并返回表示 JSON 模式 `parameters` 对象的哈希值：
```ruby
WeatherLookup.call_schema_object
# => {
#   type: "object",
#   properties: {
#     city:  { type: "string", description: "Parameter city" },
#     units: { type: "string", description: "Parameter units (optional)" }
#   },
#   required: ["city"]
# }
```
`call_schema` 将其包装在完整的 LLM 工具调用格式中：
```ruby
WeatherLookup.call_schema
# => {
#   type: "function",
#   function: {
#     name: "call",
#     description: "Call the WeatherLookup tool",
#     parameters: { ... }
#   }
# }
```
### 将工具与 ReAct 一起使用

将数组中的工具实例传递给 `DSPy::ReAct`：
```ruby
agent = DSPy::ReAct.new(
  MySignature,
  tools: [WeatherLookup.new, AnotherTool.new]
)

result = agent.call(question: "What is the weather in Berlin?")
puts result.answer
```
使用点表示法 (`result.answer`) 访问输出字段，而不是散列访问 (`result[:answer]`)。

---

## 工具::工具集

`DSPy::Tools::Toolset` 将多个相关方法分组到一个类中。从法学硕士的角度来看，每个公开的方法都成为一个独立的工具。

### 定义工具集
```ruby
class DatabaseToolset < DSPy::Tools::Toolset
  extend T::Sig

  toolset_name "db"

  tool :query,  description: "Run a read-only SQL query"
  tool :insert, description: "Insert a record into a table"
  tool :delete, description: "Delete a record by ID"

  sig { params(sql: String).returns(String) }
  def query(sql:)
    # Execute read query
  end

  sig { params(table: String, data: T::Hash[String, String]).returns(String) }
  def insert(table:, data:)
    # Insert record
  end

  sig { params(table: String, id: Integer).returns(String) }
  def delete(table:, id:)
    # Delete record
  end
end
```
### DSL 方法

**`toolset_name(name)`** -- 设置所有生成的工具名称的前缀。如果省略，则类名减去 `Toolset` 后缀将小写（例如，`DatabaseToolset` 变为 `database`）。
```ruby
toolset_name "db"
# tool :query produces a tool named "db_query"
```
**`tool(method_name, tool_name:, description:)`** -- 将方法公开为工具。

- `method_name`（符号，必需）--要公开的实例方法。
- `tool_name:`（字符串，可选）--覆盖默认的 `<toolset_name>_<method_name>` 命名。
- `description:`（字符串，可选）--向法学硕士显示的描述。默认为方法名称的人性化版本。
```ruby
tool :word_count, tool_name: "text_wc", description: "Count lines, words, and characters"
# Produces a tool named "text_wc" instead of "text_word_count"
```
### 转换为工具数组

在类（不是实例）上调用 `to_tools` 来获取与 `DSPy::Tools::Base` 兼容的 `ToolProxy` 对象数组：
```ruby
agent = DSPy::ReAct.new(
  AnalyzeText,
  tools: DatabaseToolset.to_tools
)
```
每个 `ToolProxy` 包装一个方法，将 `call` 委托给底层工具集实例，并根据方法的 Sorbet 签名生成自己的 JSON 架构。

### 共享状态

来自单个 `to_tools` 调用的所有工具代理共享一个工具集实例。将共享状态（连接、缓存、配置）存储在工具集的 `initialize` 中：
```ruby
class ApiToolset < DSPy::Tools::Toolset
  extend T::Sig

  toolset_name "api"

  tool :get,  description: "Make a GET request"
  tool :post, description: "Make a POST request"

  sig { params(base_url: String).void }
  def initialize(base_url:)
    @base_url = base_url
    @client = HTTP.persistent(base_url)
  end

  sig { params(path: String).returns(String) }
  def get(path:)
    @client.get("#{@base_url}#{path}").body.to_s
  end

  sig { params(path: String, body: String).returns(String) }
  def post(path:, body:)
    @client.post("#{@base_url}#{path}", body: body).body.to_s
  end
end
```
---

## 类型安全

工具方法上的 Sorbet 签名驱动 JSON 模式生成和 LLM 响应的自动类型强制。

### 基本类型
```ruby
sig { params(
  text: String,
  count: Integer,
  score: Float,
  enabled: T::Boolean,
  threshold: Numeric
).returns(String) }
def analyze(text:, count:, score:, enabled:, threshold:)
  # ...
end
```
|冰糕类型| JSON 架构 |
|------------------|----------------------------------------------------------------|
| `String` | `{"type": "string"}` |
| `Integer` | `{"type": "integer"}` |
| `Float` | `{"type": "number"}` |
| `Numeric` | `{"type": "number"}` |
| `T::Boolean` | `{"type": "boolean"}` |
| `T::Enum` | `{"type": "string", "enum": [...]}` |
| `T::Struct` | `{"type": "object", "properties": {...}}` |
| `T::Array[Type]` | `{"type": "array", "items": {...}}` |
| `T::Hash[K, V]` | `{"type": "object", "additionalProperties": {...}}`|
| `T.nilable(Type)`| `{"type": [original, "null"]}` |
| `T.any(T1, T2)` | `{"oneOf": [{...}, {...}]}` |
| `T.class_of(X)` | `{"type": "string"}` |

### T::Enum 参数

定义 `T::Enum` 并在工具签名中引用它。 DSPy.rb 生成 JSON 模式 `enum` 约束并自动将 LLM 的字符串响应反序列化为正确的枚举实例。
```ruby
class Priority < T::Enum
  enums do
    Low = new('low')
    Medium = new('medium')
    High = new('high')
    Critical = new('critical')
  end
end

class Status < T::Enum
  enums do
    Pending = new('pending')
    InProgress = new('in-progress')
    Completed = new('completed')
  end
end

sig { params(priority: Priority, status: Status).returns(String) }
def update_task(priority:, status:)
  "Updated to #{priority.serialize} / #{status.serialize}"
end
```
生成的模式将参数限制为有效值：
```json
{
  "priority": {
    "type": "string",
    "enum": ["low", "medium", "high", "critical"]
  }
}
```
**不区分大小写的匹配**：当 LLM 返回 `"HIGH"` 或 `"High"` 而不是 `"high"` 时，DSPy.rb 首先尝试精确的 `try_deserialize`，然后回退到不区分大小写的查找。这可以防止因 LLM 外壳变化而导致的故障。

### T::结构参数

对于复杂的嵌套对象，请使用 `T::Struct`。 DSPy.rb 生成嵌套的 JSON 模式属性，并递归地将 LLM 的哈希响应强制转换为结构实例。
```ruby
class TaskMetadata < T::Struct
  prop :id, String
  prop :priority, Priority
  prop :tags, T::Array[String]
  prop :estimated_hours, T.nilable(Float), default: nil
end

class TaskRequest < T::Struct
  prop :title, String
  prop :description, String
  prop :status, Status
  prop :metadata, TaskMetadata
  prop :assignees, T::Array[String]
end

sig { params(task: TaskRequest).returns(String) }
def create_task(task:)
  "Created: #{task.title} (#{task.status.serialize})"
end
```
LLM 可查看完整的嵌套对象模式，DSPy.rb 根据 JSON 响应重建结构树，包括嵌套结构内的枚举字段。

### 可空参数

用 `T.nilable(...)` 标记可选参数，并在方法签名中提供默认值 `nil`。这些参数不包含在 JSON 架构 `required` 数组中。
```ruby
sig { params(
  query: String,
  max_results: T.nilable(Integer),
  filter: T.nilable(String)
).returns(String) }
def search(query:, max_results: nil, filter: nil)
  # query is required; max_results and filter are optional
end
```
### 收藏

类型化数组和哈希生成精确的项/值模式：
```ruby
sig { params(
  tags: T::Array[String],
  priorities: T::Array[Priority],
  config: T::Hash[String, T.any(String, Integer, Float)]
).returns(String) }
def configure(tags:, priorities:, config:)
  # Array elements and hash values are validated and coerced
end
```
### 联合类型

`T.any(...)` 生成 `oneOf` JSON 架构。当联合成员之一是 `T::Struct` 时，DSPy.rb 在强制转换期间使用 `_type` 鉴别器字段来选择正确的结构类。
```ruby
sig { params(value: T.any(String, Integer, Float)).returns(String) }
def handle_flexible(value:)
  # Accepts multiple types
end
```
---

## 内置工具集

### 文本处理工具集

`DSPy::Tools::TextProcessingToolset` 提供 Unix 风格的文本分析和操作操作。工具集名称前缀：`text`。

|工具名称|方法|描述 |
|------------------------------------------------|--------------------------------|--------------------------------------------------------|
| `text_grep` | `grep` |使用可选的不区分大小写和仅计数模式搜索模式 |
| `text_wc` | `word_count` |计算行数、单词数和字符数 |
| `text_rg` | `ripgrep` |使用上下文线进行快速模式搜索 |
| `text_extract_lines` | `extract_lines` |按编号提取一系列行 |
| `text_filter_lines` | `filter_lines` |保留或拒绝与正则表达式匹配的行 |
| `text_unique_lines` | `unique_lines` |删除重复行，可选择保留顺序 |
| `text_sort_lines` | `sort_lines` |按字母或数字对行进行排序 |
| `text_summarize_text` | `summarize_text` |生成统计摘要（计数、平均值、常用词）|

用法：
```ruby
agent = DSPy::ReAct.new(
  AnalyzeText,
  tools: DSPy::Tools::TextProcessingToolset.to_tools
)

result = agent.call(text: log_contents, question: "How many error lines are there?")
puts result.answer
```
### GitHubCLI工具集

`DSPy::Tools::GitHubCLIToolset` 包装 `gh` CLI 以进行面向读取的 GitHub 操作。工具集名称前缀：`github`。

|工具名称|方法|描述 |
|------------------------------------|--------------------------------|----------------------------------------------------------------|
| `github_list_issues` | `list_issues` |列出按状态、标签、受让人过滤的问题 |
| `github_list_prs` | `list_prs` |列出按状态、作者、基础过滤的拉取请求|
| `github_get_issue` | `get_issue` |检索单个问题的详细信息 |
| `github_get_pr` | `get_pr` |检索单个拉取请求的详细信息 |
| `github_api_request` | `api_request` |向 GitHub API 发出任意 GET 请求 |
| `github_traffic_views` | `traffic_views` |获取存储库流量查看计数 |
| `github_traffic_clones`| `traffic_clones` |获取存储库流量克隆计数 |

该工具集使用 `T::Enum` 参数（`IssueState`、`PRState`、`ReviewState` 进行状态过滤器，在实践中演示基于枚举的工具签名。
```ruby
agent = DSPy::ReAct.new(
  RepoAnalysis,
  tools: DSPy::Tools::GitHubCLIToolset.to_tools
)
```
---

## 测试

### 单元测试单个工具

通过直接实例化和调用 `call` 来测试 `DSPy::Tools::Base` 子类：
```ruby
RSpec.describe WeatherLookup do
  subject(:tool) { described_class.new }

  it "returns weather for a city" do
    result = tool.call(city: "Berlin")
    expect(result).to include("Berlin")
  end

  it "exposes the correct tool name" do
    expect(tool.name).to eq("weather_lookup")
  end

  it "generates a valid schema" do
    schema = described_class.call_schema_object
    expect(schema[:required]).to include("city")
    expect(schema[:properties]).to have_key(:city)
  end
end
```
### 单元测试工具集

直接在实例上测试工具集方法。使用 `to_tools` 验证工具生成：
```ruby
RSpec.describe DatabaseToolset do
  subject(:toolset) { described_class.new }

  it "executes a query" do
    result = toolset.query(sql: "SELECT 1")
    expect(result).to be_a(String)
  end

  it "generates tools with correct names" do
    tools = described_class.to_tools
    names = tools.map(&:name)
    expect(names).to contain_exactly("db_query", "db_insert", "db_delete")
  end

  it "generates tool descriptions" do
    tools = described_class.to_tools
    query_tool = tools.find { |t| t.name == "db_query" }
    expect(query_tool.description).to eq("Run a read-only SQL query")
  end
end
```
### 模拟工具内部的预测

当工具在内部调用 DSPy 预测器时，对预测器进行存根以将工具逻辑与 LLM 调用隔离：
```ruby
class SmartSearchTool < DSPy::Tools::Base
  extend T::Sig

  tool_name "smart_search"
  tool_description "Search with query expansion"

  sig { void }
  def initialize
    @expander = DSPy::Predict.new(QueryExpansionSignature)
  end

  sig { params(query: String).returns(String) }
  def call(query:)
    expanded = @expander.call(query: query)
    perform_search(expanded.expanded_query)
  end

  private

  def perform_search(query)
    # actual search logic
  end
end

RSpec.describe SmartSearchTool do
  subject(:tool) { described_class.new }

  before do
    expansion_result = double("result", expanded_query: "expanded test query")
    allow_any_instance_of(DSPy::Predict).to receive(:call).and_return(expansion_result)
  end

  it "expands the query before searching" do
    allow(tool).to receive(:perform_search).with("expanded test query").and_return("found 3 results")
    result = tool.call(query: "test")
    expect(result).to eq("found 3 results")
  end
end
```
### 测试枚举强制

验证 LLM 响应中的字符串值是否反序列化为正确的枚举实例：
```ruby
RSpec.describe "enum coercion" do
  it "handles case-insensitive enum values" do
    toolset = GitHubCLIToolset.new
    # The LLM may return "OPEN" instead of "open"
    result = toolset.list_issues(state: IssueState::Open)
    expect(result).to be_a(String)
  end
end
```
---

## 约束条件

- 所有公开的工具方法必须使用**关键字参数**。仅位置参数生成模式，但关键字参数生成更可靠的 LLM 交互。
- 每个公开的方法都成为**单独的、独立的工具**。不支持单个工具调用中的方法链接或多步骤序列。
- 工具代理之间的共享状态仅限于单个 `to_tools` 调用。单独的 `to_tools` 调用创建单独的工具集实例。
- 没有 Sorbet `sig` 的方法会产生空参数模式。法学硕士不知道要通过什么论据。
