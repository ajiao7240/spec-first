# 安德鲁·凯恩资源

## 主要文档

- **宝石图案文章**：https://ankane.org/gem-patterns
  - 凯恩自己的宝石图案记录
  - 涵盖配置、Rails 集成、错误处理

## 明星顶级红宝石

### 搜索和数据

|宝石 |明星|描述 |来源 |
|-----|--------|-------------|--------|
| **搜索踢** | 6.6k+ |智能搜索Rails | https://github.com/ankane/searchkick |
| **图表踢** | 6.4k+ | Ruby 中的漂亮图表 | https://github.com/ankane/chartkick |
| **集体约会** | 3.8k+ |按日、周、月分组 | https://github.com/ankane/groupdate |
| **西装外套** | 4.6k+ | Rails 的 SQL 仪表板 | https://github.com/ankane/blazer |

### 数据库和迁移

|宝石 |明星|描述 |来源 |
|-----|--------|-------------|--------|
| **PgHero** | 8.2k+ | PostgreSQL 见解 | https://github.com/ankane/pghero |
| **强劲的迁移** | 4.1k+ |安全迁移检查| https://github.com/ankane/strong_migrations |
| **德克斯特** | 1.8k+ |自动指数顾问| https://github.com/ankane/dexter |
| **PgSync** | 1.5k+ |同步 Postgres 数据 | https://github.com/ankane/pgsync |

### 安全与加密

|宝石 |明星|描述 |来源 |
|-----|--------|-------------|--------|
| **密码箱** | 1.5k+ |应用级加密 | https://github.com/ankane/lockbox |
| **盲索引** | 1.0k+ |加密搜索 | https://github.com/ankane/blind_index |
| **安全标头** | — |贡献模式 |宝石中引用 |

### 分析和机器学习|宝石 |明星|描述 |来源 |
|-----|--------|-------------|--------|
| **啊嘿** | 4.2k+ | Rails 分析 | https://github.com/ankane/ahoy |
| **邻居** | 1.1k+ | Rails 的矢量搜索 | https://github.com/ankane/neighbor |
| **漫游者** | 700+ | Ruby 的数据框架 | https://github.com/ankane/rover |
| **托本** | 200+ |主题建模| https://github.com/ankane/tomoto-ruby |

### 实用程序

|宝石 |明星|描述 |来源 |
|-----|--------|-------------|--------|
| **伪装者** | 2.0k+ |以其他用户身份登录 | https://github.com/ankane/pretender |
| **Authtrail** | 900+ |登录活动跟踪 | https://github.com/ankane/authtrail |
| **值得注意** | 200+ |跟踪重要请求 | https://github.com/ankane/notable |
| **日志停止** | 200+ |过滤敏感日志 | https://github.com/ankane/logstop |

## 需要学习的关键源文件

### 入口点模式
- https://github.com/ankane/searchkick/blob/master/lib/searchkick.rb
- https://github.com/ankane/pghero/blob/master/lib/pghero.rb
- https://github.com/ankane/strong_migrations/blob/master/lib/strong_migrations.rb
- https://github.com/ankane/lockbox/blob/master/lib/lockbox.rb

### 类宏实现
- https://github.com/ankane/searchkick/blob/master/lib/searchkick/model.rb
- https://github.com/ankane/lockbox/blob/master/lib/lockbox/model.rb
- https://github.com/ankane/neighbor/blob/master/lib/neighbor/model.rb
- https://github.com/ankane/blind_index/blob/master/lib/blind_index/model.rb### Rails 集成（Railtie/Engine）
- https://github.com/ankane/pghero/blob/master/lib/pghero/engine.rb
- https://github.com/ankane/searchkick/blob/master/lib/searchkick/railtie.rb
- https://github.com/ankane/ahoy/blob/master/lib/ahoy/engine.rb
- https://github.com/ankane/blazer/blob/master/lib/blazer/engine.rb

### 数据库适配器
- https://github.com/ankane/strong_migrations/tree/master/lib/strong_migrations/adapters
- https://github.com/ankane/groupdate/tree/master/lib/groupdate/adapters
- https://github.com/ankane/neighbor/tree/master/lib/neighbor

### 错误消息（模板模式）
- https://github.com/ankane/strong_migrations/blob/master/lib/strong_migrations/error_messages.rb

### Gemspec 示例
- https://github.com/ankane/searchkick/blob/master/searchkick.gemspec
- https://github.com/ankane/neighbor/blob/master/neighbor.gemspec
- https://github.com/ankane/ahoy/blob/master/ahoy_matey.gemspec

### 测试设置
- https://github.com/ankane/searchkick/tree/master/test
- https://github.com/ankane/lockbox/tree/master/test
- https://github.com/ankane/strong_migrations/tree/master/test

## GitHub 简介

- **简介**：https://github.com/ankane
- **所有 Ruby 存储库**：https://github.com/ankane?tab=repositories&q=&type=&language=ruby&sort=stargazers
- **RubyGems 简介**：https://rubygems.org/profiles/ankane

## 博客文章和文章

- **ankane.org**：https://ankane.org/
- **宝石图案**：https://ankane.org/gem-patterns（必读）
- **Postgres 性能**：https://ankane.org/introducing-pghero
- **搜索提示**：https://ankane.org/search-rails

## 设计理念总结

通过研究 100 多种宝石，凯恩的一贯原则：1. **尽可能零依赖** - 每个 dep 都是维护负担
2. **ActiveSupport.on_load 总是** - 从不直接需要 Rails gem
3. **类宏 DSL** - 单一方法配置一切
4. **Explicit over magic** - 无method_missing，直接定义方法
5. **仅限最小测试** - 简单、足够、无 RSpec
6. **多版本测试** - 支持广泛的Rails/Ruby版本
7. **有用的错误** - 基于模板的消息以及修复建议
8. **抽象适配器** - 干净的多数据库支持
9. **引擎隔离** - 可安装gem的isolate_namespace
10. **最少的文档** - 代码是自记录的，自述文件是示例
