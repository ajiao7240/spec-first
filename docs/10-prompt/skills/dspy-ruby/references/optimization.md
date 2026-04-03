# DSPy.rb 优化

## MIPROv2

MIPROv2（具有检索优化的多提示指令建议）是 DSPy.rb 中的主要指令调谐器。它为每个预测器提出新的指令和几次演示，对它们进行小批量评估，并保留改进指标的候选者。它作为一个单独的 gem 提供，以将高斯过程依赖树排除在不需要它的应用程序之外。

＃＃＃ 安装
```ruby
# Gemfile
gem "dspy"
gem "dspy-miprov2"
```
捆绑器自动需要 `dspy/miprov2`。不需要额外的 `require` 语句。

### 自动模式预设

对预配置优化器使用 `DSPy::Teleprompt::MIPROv2::AutoMode`：
```ruby
light  = DSPy::Teleprompt::MIPROv2::AutoMode.light(metric: metric)   # 6 trials, greedy
medium = DSPy::Teleprompt::MIPROv2::AutoMode.medium(metric: metric)  # 12 trials, adaptive
heavy  = DSPy::Teleprompt::MIPROv2::AutoMode.heavy(metric: metric)   # 18 trials, Bayesian
```
|预设|试验|战略|使用案例 |
|----------|--------|------------------------|--------------------------------------------------------|
| `light` | 6 | `:greedy` |在小型数据集或原型设计过程中快速获胜。 |
| `medium` | 12 | 12 `:adaptive`|对于大多数飞行员来说，平衡探索与运行时间。   |
| `heavy` | 18 | 18 `:bayesian`|最高精度的目标或多阶段程序。   |

### 手动配置与干配置

`DSPy::Teleprompt::MIPROv2` 包括`Dry::Configurable`。在类级别（所有实例的默认值）或实例级别（覆盖类默认值）进行配置。

**类级别默认值：**
```ruby
DSPy::Teleprompt::MIPROv2.configure do |config|
  config.optimization_strategy = :bayesian
  config.num_trials = 30
  config.bootstrap_sets = 10
end
```
**实例级覆盖：**
```ruby
optimizer = DSPy::Teleprompt::MIPROv2.new(metric: metric)
optimizer.configure do |config|
  config.num_trials = 15
  config.num_instruction_candidates = 6
  config.bootstrap_sets = 5
  config.max_bootstrapped_examples = 4
  config.max_labeled_examples = 16
  config.optimization_strategy = :adaptive       # :greedy, :adaptive, :bayesian
  config.early_stopping_patience = 3
  config.init_temperature = 1.0
  config.final_temperature = 0.1
  config.minibatch_size = nil                     # nil = auto
  config.auto_seed = 42
end
```
`optimization_strategy` 设置接受符号（`:greedy`、`:adaptive`、`:bayesian`）并在内部将它们强制为 `DSPy::Teleprompt::OptimizationStrategy` T::Enum 值。

旧的 `config:` 构造函数参数已被删除。通过 `config:` 会引发 `ArgumentError`。

### 通过配置自动预设

通过配置块设置预设，而不是 `AutoMode`：
```ruby
optimizer = DSPy::Teleprompt::MIPROv2.new(metric: metric)
optimizer.configure do |config|
  config.auto_preset = DSPy::Teleprompt::AutoPreset.deserialize("medium")
end
```
### 编译并检查
```ruby
program = DSPy::Predict.new(MySignature)

result = optimizer.compile(
  program,
  trainset: train_examples,
  valset: val_examples
)

optimized_program = result.optimized_program
puts "Best score: #{result.best_score_value}"
```
`result` 对象公开：
- `optimized_program`——即用型预测器，带有更新的指令和演示。
- `optimization_trace[:trial_logs]`——每次试验的说明、演示和分数记录。
- `metadata[:optimizer]` -- `"MIPROv2"`，在保留多个优化器的实验时很有用。

### 多阶段计划

MIPROv2 为每个预测器生成数据集摘要并提出每阶段指令。对于具有 `thought_generator` 和 `observation_processor` 预测器的 ReAct 代理，优化器在内部处理信用分配。该指标只需要评估最终输出。

### 自举采样

在引导阶段 MIPROv2：
1. 从训练集中生成数据集摘要。
2. 通过运行基线程序引导几次演示。
3. 根据摘要和引导示例提出候选说明。
4. 在从验证集中抽取的小批量中评估每个候选者。

使用 `bootstrap_sets`、`max_bootstrapped_examples` 和 `max_labeled_examples` 控制引导阶段。

### 贝叶斯优化

当 `optimization_strategy` 为 `:bayesian` 时（或使用 `heavy` 预设时），MIPROv2 在过去的试验分数上拟合高斯过程代理以选择下一个候选者。这用知情探索取代了随机搜索，减少了寻找高分指令所需的试验次数。

---

## 盖帕

GEPA（Genetic-Pareto Reflective Prompt Evolution）是一种反馈驱动的优化器。它小批量运行程序，收集分数和文本反馈，并要求反射 LM 重写指令。改进的候选者被保留在帕累托边界上。

＃＃＃ 安装
```ruby
# Gemfile
gem "dspy"
gem "dspy-gepa"
```
`dspy-gepa` gem 自动依赖于 `gepa` 核心优化器 gem。

### 公制合约

GEPA 指标返回 `DSPy::Prediction` 以及数字分数和反馈字符串。不要返回普通布尔值。
```ruby
metric = lambda do |example, prediction|
  expected  = example.expected_values[:label]
  predicted = prediction.label

  score = predicted == expected ? 1.0 : 0.0
  feedback = if score == 1.0
    "Correct (#{expected}) for: \"#{example.input_values[:text][0..60]}\""
  else
    "Misclassified (expected #{expected}, got #{predicted}) for: \"#{example.input_values[:text][0..60]}\""
  end

  DSPy::Prediction.new(score: score, feedback: feedback)
end
```
将分数保留在`[0, 1]`中。始终包含一条简短的反馈消息，解释发生的情况 - GEPA 将此文本传递给反射模型，以便它可以推理失败。

### 反馈图

`feedback_map` 针对复合模块内的各个预测变量。每个条目接收关键字参数并返回 `DSPy::Prediction`：
```ruby
feedback_map = {
  'self' => lambda do |predictor_output:, predictor_inputs:, module_inputs:, module_outputs:, captured_trace:|
    expected  = module_inputs.expected_values[:label]
    predicted = predictor_output.label

    DSPy::Prediction.new(
      score: predicted == expected ? 1.0 : 0.0,
      feedback: "Classifier saw \"#{predictor_inputs[:text][0..80]}\" -> #{predicted} (expected #{expected})"
    )
  end
}
```
对于单预测程序，请使用 `'self'` 对地图进行键入。对于多预测器链，为每个组件添加条目，以便反射 LM 在每个步骤看到本地化上下文。如果顶级指标已经涵盖了基础知识，则完全省略 `feedback_map`。

### 配置提词器
```ruby
teleprompter = DSPy::Teleprompt::GEPA.new(
  metric: metric,
  reflection_lm: DSPy::ReflectionLM.new('openai/gpt-4o-mini', api_key: ENV['OPENAI_API_KEY']),
  feedback_map: feedback_map,
  config: {
    max_metric_calls: 600,
    minibatch_size: 6,
    skip_perfect_score: false
  }
)
```
主要配置旋钮：

|旋钮|目的|
|----------------------|--------------------------------------------------------------------------------------------------------|
| `max_metric_calls` |评估电话的硬预算。至少设置为验证集大小加上一些小批量。 |
| `minibatch_size` |每个反射重播批次的示例。更小=更便宜的迭代，更嘈杂的分数。       |
| `skip_perfect_score` |设置 `true` 在考生达到分数 `1.0` 时提前停止。                            |

### 小批量调整

|目标|建议尺码 |理由|
|------------------------------------------------|----------------|------------------------------------------------------------------------|
|在紧张的预算内探索众多候选人 | 3--6 | 3--6廉价的迭代、更迅速的变体、更嘈杂的指标。   |
|每次部署成本高昂时的稳定指标 | 8--12 | 8--12除非增加预算，否则分数会更平稳，候选人会更少。 |
|调查特定的故障模式 | 3--4 然后 8+ |从广度开始，一旦模式出现就增加。         |

### 编译并评估
```ruby
program = DSPy::Predict.new(MySignature)

result = teleprompter.compile(program, trainset: train, valset: val)
optimized_program = result.optimized_program

test_metrics = evaluate(optimized_program, test)
```
`result` 对象公开：
- `optimized_program`——具有更新指令和少量示例的预测器。
- `best_score_value`——最佳候选者的验证分数。
- `metadata`——候选计数、跟踪哈希和遥测 ID。

### 反射LM

将 `DSPy::ReflectionLM` 交换为任何接受反射提示哈希并返回字符串的可调用对象。默认反射签名从响应中的三个反引号中提取新指令。

### 实验跟踪

将 `GEPA::Logging::ExperimentTracker` 插入持久层：
```ruby
tracker = GEPA::Logging::ExperimentTracker.new
tracker.with_subscriber { |event| MyModel.create!(payload: event) }

teleprompter = DSPy::Teleprompt::GEPA.new(
  metric: metric,
  reflection_lm: reflection_lm,
  experiment_tracker: tracker,
  config: { max_metric_calls: 900 }
)
```
跟踪器以 JSONL 形式发出 Pareto 更新事件、合并决策和候选演化记录。

### 帕累托前沿

GEPA 维护了一个多样化的候选池和来自帕累托前沿的样本，而不是只改变得分最高的程序。这平衡了探索并防止搜索崩溃到单一谱系。

在出现多个强谱系后启用合并提议者：
```ruby
config: {
  max_metric_calls: 900,
  enable_merge_proposer: true
}
```
过早合并饮食预算不会带来有意义的收益。首先在拥有几个经过验证的候选者时进行门合并。

### 高级选项

- `acceptance_strategy:` - 插入定制的帕累托过滤器或提前停止启发式算法。
- 遥测跨度通过 `GEPA::Telemetry` 发出。使用 `DSPy.configure { |c| c.observability = true }` 启用全局可观察性，将跨度流式传输到 OpenTelemetry 导出器。

---

## 评估框架

`DSPy::Evals` 使用内置和自定义指标，针对测试数据集提供预测变量的批量评估。

### 基本用法
```ruby
metric = proc do |example, prediction|
  prediction.answer == example.expected_values[:answer]
end

evaluator = DSPy::Evals.new(predictor, metric: metric)

result = evaluator.evaluate(
  test_examples,
  display_table: true,
  display_progress: true
)

puts "Pass rate: #{(result.pass_rate * 100).round(1)}%"
puts "Passed: #{result.passed_examples}/#{result.total_examples}"
```
### DSPy::示例

在传递给优化器或评估器之前，将原始数据转换为 `DSPy::Example` 实例。每个示例都带有 `input_values` 和 `expected_values`：
```ruby
examples = rows.map do |row|
  DSPy::Example.new(
    input_values: { text: row[:text] },
    expected_values: { label: row[:label] }
  )
end

train, val, test = split_examples(examples, train_ratio: 0.6, val_ratio: 0.2, seed: 42)
```
从优化循环中保留测试集。优化器在 train/val 上工作；只有测试集证明了泛化性。

### 内置指标
```ruby
# Exact match -- prediction must exactly equal expected value
metric = DSPy::Metrics.exact_match(field: :answer, case_sensitive: true)

# Contains -- prediction must contain expected substring
metric = DSPy::Metrics.contains(field: :answer, case_sensitive: false)

# Numeric difference -- numeric output within tolerance
metric = DSPy::Metrics.numeric_difference(field: :answer, tolerance: 0.01)

# Composite AND -- all sub-metrics must pass
metric = DSPy::Metrics.composite_and(
  DSPy::Metrics.exact_match(field: :answer),
  DSPy::Metrics.contains(field: :reasoning)
)
```
### 自定义指标
```ruby
quality_metric = lambda do |example, prediction|
  return false unless prediction

  score = 0.0
  score += 0.5 if prediction.answer == example.expected_values[:answer]
  score += 0.3 if prediction.explanation && prediction.explanation.length > 50
  score += 0.2 if prediction.confidence && prediction.confidence > 0.8
  score >= 0.7
end

evaluator = DSPy::Evals.new(predictor, metric: quality_metric)
```
使用点符号 (`prediction.answer`) 访问预测字段，而不是哈希符号。

### 可观察性挂钩

注册回调而不编辑评估器：
```ruby
DSPy::Evals.before_example do |payload|
  example = payload[:example]
  DSPy.logger.info("Evaluating example #{example.id}") if example.respond_to?(:id)
end

DSPy::Evals.after_batch do |payload|
  result = payload[:result]
  Langfuse.event(
    name: 'eval.batch',
    metadata: {
      total: result.total_examples,
      passed: result.passed_examples,
      score: result.score
    }
  )
end
```
可用挂钩：`before_example`、`after_example`、`before_batch`、`after_batch`。

### Langfuse分数导出

启用 `export_scores: true` 为每个评估的示例发出 `score.create` 事件，并在最后发出批量分数：
```ruby
evaluator = DSPy::Evals.new(
  predictor,
  metric: metric,
  export_scores: true,
  score_name: 'qa_accuracy'   # default: 'evaluation'
)

result = evaluator.evaluate(test_examples)
# Emits per-example scores + overall batch score via DSPy::Scores::Exporter
```
分数自动附加到当前跟踪上下文并异步流向 Langfuse。

### 评估结果
```ruby
result = evaluator.evaluate(test_examples)

result.score            # Overall score (0.0 to 1.0)
result.passed_count     # Examples that passed
result.failed_count     # Examples that failed
result.error_count      # Examples that errored

result.results.each do |r|
  r.passed              # Boolean
  r.score               # Numeric score
  r.error               # Error message if the example errored
end
```
### 与优化器集成
```ruby
metric = proc do |example, prediction|
  expected  = example.expected_values[:answer].to_s.strip.downcase
  predicted = prediction.answer.to_s.strip.downcase
  !expected.empty? && predicted.include?(expected)
end

optimizer = DSPy::Teleprompt::MIPROv2::AutoMode.medium(metric: metric)

result = optimizer.compile(
  DSPy::Predict.new(QASignature),
  trainset: train_examples,
  valset: val_examples
)

evaluator = DSPy::Evals.new(result.optimized_program, metric: metric)
test_result = evaluator.evaluate(test_examples, display_table: true)
puts "Test accuracy: #{(test_result.pass_rate * 100).round(2)}%"
```
---

## 存储系统

`DSPy::Storage` 保留优化结果、跟踪历史记录并管理优化程序的多个版本。

### 程序存储（低级）
```ruby
storage = DSPy::Storage::ProgramStorage.new(storage_path: "./dspy_storage")

# Save
saved = storage.save_program(
  result.optimized_program,
  result,
  metadata: {
    signature_class: 'ClassifyText',
    optimizer: 'MIPROv2',
    examples_count: examples.size
  }
)
puts "Stored with ID: #{saved.program_id}"

# Load
saved = storage.load_program(program_id)
predictor = saved.program
score = saved.optimization_result[:best_score_value]

# List
storage.list_programs.each do |p|
  puts "#{p[:program_id]} -- score: #{p[:best_score]} -- saved: #{p[:saved_at]}"
end
```
### 存储管理器（推荐）
```ruby
manager = DSPy::Storage::StorageManager.new

# Save with tags
saved = manager.save_optimization_result(
  result,
  tags: ['production', 'sentiment-analysis'],
  description: 'Optimized sentiment classifier v2'
)

# Find programs
programs = manager.find_programs(
  optimizer: 'MIPROv2',
  min_score: 0.85,
  tags: ['production']
)

recent = manager.find_programs(
  max_age_days: 7,
  signature_class: 'ClassifyText'
)

# Get best program for a signature
best = manager.get_best_program('ClassifyText')
predictor = best.program
```
全局简写：
```ruby
DSPy::Storage::StorageManager.save(result, metadata: { version: '2.0' })
DSPy::Storage::StorageManager.load(program_id)
DSPy::Storage::StorageManager.best('ClassifyText')
```
### 检查点

在长时间运行的优化期间创建和恢复检查点：
```ruby
# Save a checkpoint
manager.create_checkpoint(
  current_result,
  'iteration_50',
  metadata: { iteration: 50, current_score: 0.87 }
)

# Restore
restored = manager.restore_checkpoint('iteration_50')
program = restored.program

# Auto-checkpoint every N iterations
if iteration % 10 == 0
  manager.create_checkpoint(current_result, "auto_checkpoint_#{iteration}")
end
```
### 导入和导出

在环境之间共享程序：
```ruby
storage = DSPy::Storage::ProgramStorage.new

# Export
storage.export_programs(['abc123', 'def456'], './export_backup.json')

# Import
imported = storage.import_programs('./export_backup.json')
puts "Imported #{imported.size} programs"
```
### 优化历史
```ruby
history = manager.get_optimization_history

history[:summary][:total_programs]
history[:summary][:avg_score]

history[:optimizer_stats].each do |optimizer, stats|
  puts "#{optimizer}: #{stats[:count]} programs, best: #{stats[:best_score]}"
end

history[:trends][:improvement_percentage]
```
### 程序比较
```ruby
comparison = manager.compare_programs(id_a, id_b)
comparison[:comparison][:score_difference]
comparison[:comparison][:better_program]
comparison[:comparison][:age_difference_hours]
```
### 存储配置
```ruby
config = DSPy::Storage::StorageManager::StorageConfig.new
config.storage_path = Rails.root.join('dspy_storage')
config.auto_save = true
config.save_intermediate_results = false
config.max_stored_programs = 100

manager = DSPy::Storage::StorageManager.new(config: config)
```
### 清理

删除旧程序。 Cleanup 使用加权分数（70% 性能，30% 新近度）保留性能最佳和最新的程序：
```ruby
deleted_count = manager.cleanup_old_programs
```
### 存储事件

存储系统发出结构化日志事件进行监控：
- `dspy.storage.save_start`、`dspy.storage.save_complete`、`dspy.storage.save_error`
- `dspy.storage.load_start`、`dspy.storage.load_complete`、`dspy.storage.load_error`
- `dspy.storage.delete`、`dspy.storage.export`、`dspy.storage.import`、`dspy.storage.cleanup`

### 文件布局
```
dspy_storage/
  programs/
    abc123def456.json
    789xyz012345.json
  history.json
```
---

## API 规则

- 使用 `.call()` 调用预测器，而不是 `.forward()`。
- 使用点符号 (`result.answer`) 访问预测字段，而不是哈希符号 (`result[:answer]`)。
- GEPA 指标返回 `DSPy::Prediction.new(score:, feedback:)`，而不是布尔值。
- MIPROv2 指标可能返回 `true`/`false`、数字分数或 `DSPy::Prediction`。
