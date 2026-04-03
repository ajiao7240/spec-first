# 模块组织模式

## 简单的 Gem 布局
```
lib/
├── gemname.rb          # Entry point, config, errors
└── gemname/
    ├── helper.rb       # Core functionality
    ├── engine.rb       # Rails engine (if needed)
    └── version.rb      # VERSION constant only
```
## 复杂的 Gem 布局（PgHero 模式）
```
lib/
├── pghero.rb
└── pghero/
    ├── database.rb     # Main class
    ├── engine.rb       # Rails engine
    └── methods/        # Functional decomposition
        ├── basic.rb
        ├── connections.rb
        ├── indexes.rb
        ├── queries.rb
        └── replication.rb
```
## 方法分解模式

按功能将大类分解为可包含的模块：
```ruby
# lib/pghero/database.rb
module PgHero
  class Database
    include Methods::Basic
    include Methods::Connections
    include Methods::Indexes
    include Methods::Queries
  end
end

# lib/pghero/methods/indexes.rb
module PgHero
  module Methods
    module Indexes
      def index_hit_rate
        # implementation
      end

      def unused_indexes
        # implementation
      end
    end
  end
end
```
## 版本文件模式

保持 version.rb 最小：
```ruby
# lib/gemname/version.rb
module GemName
  VERSION = "2.0.0"
end
```
## 需要在入口点下订单
```ruby
# lib/searchkick.rb

# 1. Standard library
require "forwardable"
require "json"

# 2. External dependencies (minimal)
require "active_support"

# 3. Internal files via require_relative
require_relative "searchkick/index"
require_relative "searchkick/model"
require_relative "searchkick/query"
require_relative "searchkick/version"

# 4. Conditional Rails loading (LAST)
require_relative "searchkick/railtie" if defined?(Rails)
```
## 自动加载与需要

Kane 使用显式 `require_relative`，而不是自动加载：
```ruby
# CORRECT
require_relative "gemname/model"
require_relative "gemname/query"

# AVOID
autoload :Model, "gemname/model"
autoload :Query, "gemname/query"
```
## 评论风格

仅最小节标题：
```ruby
# dependencies
require "active_support"

# adapters
require_relative "adapters/postgresql_adapter"

# modules
require_relative "migration"
```
