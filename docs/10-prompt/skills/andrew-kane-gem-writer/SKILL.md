---
name: andrew-kane-gem-writer
description: 在遵循 Andrew Kane 经过验证的模式和理念编写 Ruby gem 时，应该使用此技能。它适用于创建新的 Ruby gem、重构现有 gem、设计 gem API，或者需要干净、最小、可用于生产的 Ruby 库代码时。触发“创建 gem”、“编写 Ruby 库”、“设计 gem API”或提及 Andrew Kane 的风格等请求。
---
# 安德鲁·凯恩 宝石作家

遵循 Andrew Kane 久经考验的模式，从 100 多个 gems 中编写 Ruby gems，下载次数超过 374M（Searchkick、PgHero、Chartkick、Strong Migrations、Lockbox、Ahoy、Blazer、Groupdate、Neighbor、Blind Index）。

## 核心理念

**简单胜过聪明。** 零依赖或最小依赖。显式代码优于元编程。无需 Rails 耦合的 Rails 集成。每个模式都服务于生产用例。

## 入口点结构

每颗宝石都遵循 `lib/gemname.rb` 中的精确模式：
```ruby
# 1. Dependencies (stdlib preferred)
require "forwardable"

# 2. Internal modules
require_relative "gemname/model"
require_relative "gemname/version"

# 3. Conditional Rails (CRITICAL - never require Rails directly)
require_relative "gemname/railtie" if defined?(Rails)

# 4. Module with config and errors
module GemName
  class Error < StandardError; end
  class InvalidConfigError < Error; end

  class << self
    attr_accessor :timeout, :logger
    attr_writer :client
  end

  self.timeout = 10  # Defaults set immediately
end
```
## 类宏 DSL 模式

标志性的 Kane 模式——单一方法调用即可配置一切：
```ruby
# Usage
class Product < ApplicationRecord
  searchkick word_start: [:name]
end

# Implementation
module GemName
  module Model
    def gemname(**options)
      unknown = options.keys - KNOWN_KEYWORDS
      raise ArgumentError, "unknown keywords: #{unknown.join(", ")}" if unknown.any?

      mod = Module.new
      mod.module_eval do
        define_method :some_method do
          # implementation
        end unless method_defined?(:some_method)
      end
      include mod

      class_eval do
        cattr_reader :gemname_options, instance_reader: false
        class_variable_set :@@gemname_options, options.dup
      end
    end
  end
end
```
## Rails 集成

**始终使用 `ActiveSupport.on_load` - 永远不要直接需要 Rails gem：**
```ruby
# WRONG
require "active_record"
ActiveRecord::Base.include(MyGem::Model)

# CORRECT
ActiveSupport.on_load(:active_record) do
  extend GemName::Model
end

# Use prepend for behavior modification
ActiveSupport.on_load(:active_record) do
  ActiveRecord::Migration.prepend(GemName::Migration)
end
```
## 配置模式

将 `class << self` 与 `attr_accessor` 一起使用，而不是配置对象：
```ruby
module GemName
  class << self
    attr_accessor :timeout, :logger
    attr_writer :master_key
  end

  def self.master_key
    @master_key ||= ENV["GEMNAME_MASTER_KEY"]
  end

  self.timeout = 10
  self.logger = nil
end
```
## 错误处理

带有信息性消息的简单层次结构：
```ruby
module GemName
  class Error < StandardError; end
  class ConfigError < Error; end
  class ValidationError < Error; end
end

# Validate early with ArgumentError
def initialize(key:)
  raise ArgumentError, "Key must be 32 bytes" unless key&.bytesize == 32
end
```
## 测试（仅限最小测试）
```ruby
# test/test_helper.rb
require "bundler/setup"
Bundler.require(:default)
require "minitest/autorun"
require "minitest/pride"

# test/model_test.rb
class ModelTest < Minitest::Test
  def test_basic_functionality
    assert_equal expected, actual
  end
end
```
## Gemspec 模式

尽可能零运行时依赖：
```ruby
Gem::Specification.new do |spec|
  spec.name = "gemname"
  spec.version = GemName::VERSION
  spec.required_ruby_version = ">= 3.1"
  spec.files = Dir["*.{md,txt}", "{lib}/**/*"]
  spec.require_path = "lib"
  # NO add_dependency lines - dev deps go in Gemfile
end
```
## 要避免的反模式

- `method_missing`（使用`define_method`代替）
- 配置对象（使用类访问器）
- `@@class_variables`（使用`class << self`）
- 直接需要 Rails gem
- 许多运行时依赖项
- 在 gems 中提交 Gemfile.lock
- RSpec（使用 Minitest）
- 重型 DSL（更喜欢显式 Ruby）

## 参考文件

对于更深层次的模式，请参阅：
- `references/module-organization.md` - 目录布局、方法分解
- `references/rails-integration.md` - Railtie、引擎、on_load 模式
- `references/database-adapters.md` - 多数据库支持模式
- `references/testing-patterns.md` - 多版本测试、CI 设置
- `references/resources.md` - 凯恩的存储库和文章的链接
