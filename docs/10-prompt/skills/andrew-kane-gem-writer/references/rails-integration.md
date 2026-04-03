# Rails 集成模式

## 黄金法则

**永远不要直接需要 Rails gem。**这会导致加载顺序问题。
```ruby
# WRONG - causes premature loading
require "active_record"
ActiveRecord::Base.include(MyGem::Model)

# CORRECT - lazy loading
ActiveSupport.on_load(:active_record) do
  extend MyGem::Model
end
```
## ActiveSupport.on_load 挂钩

常见的钩子及其用途：
```ruby
# Models
ActiveSupport.on_load(:active_record) do
  extend GemName::Model        # Add class methods (searchkick, has_encrypted)
  include GemName::Callbacks   # Add instance methods
end

# Controllers
ActiveSupport.on_load(:action_controller) do
  include Ahoy::Controller
end

# Jobs
ActiveSupport.on_load(:active_job) do
  include GemName::JobExtensions
end

# Mailers
ActiveSupport.on_load(:action_mailer) do
  include GemName::MailerExtensions
end
```
## 行为修改前

当重写现有的 Rails 方法时：
```ruby
ActiveSupport.on_load(:active_record) do
  ActiveRecord::Migration.prepend(StrongMigrations::Migration)
  ActiveRecord::Migrator.prepend(StrongMigrations::Migrator)
end
```
## 铁路领带图案

不可安装宝石的最小拉杆：
```ruby
# lib/gemname/railtie.rb
module GemName
  class Railtie < Rails::Railtie
    initializer "gemname.configure" do
      ActiveSupport.on_load(:active_record) do
        extend GemName::Model
      end
    end

    # Optional: Add to controller runtime logging
    initializer "gemname.log_runtime" do
      require_relative "controller_runtime"
      ActiveSupport.on_load(:action_controller) do
        include GemName::ControllerRuntime
      end
    end

    # Optional: Rake tasks
    rake_tasks do
      load "tasks/gemname.rake"
    end
  end
end
```
## 引擎图案（可安装宝石）

对于带有 Web 界面的 gem（PgHero、Blazer、Ahoy）：
```ruby
# lib/pghero/engine.rb
module PgHero
  class Engine < ::Rails::Engine
    isolate_namespace PgHero

    initializer "pghero.assets", group: :all do |app|
      if app.config.respond_to?(:assets) && defined?(Sprockets)
        app.config.assets.precompile << "pghero/application.js"
        app.config.assets.precompile << "pghero/application.css"
      end
    end

    initializer "pghero.config" do
      PgHero.config = Rails.application.config_for(:pghero) rescue {}
    end
  end
end
```
## 引擎路线
```ruby
# config/routes.rb (in engine)
PgHero::Engine.routes.draw do
  root to: "home#index"
  resources :databases, only: [:show]
end
```
在应用程序中安装：
```ruby
# config/routes.rb (in app)
mount PgHero::Engine, at: "pghero"
```
## 使用 ERB 进行 YAML 配置

对于需要配置文件的复杂 gem：
```ruby
def self.settings
  @settings ||= begin
    path = Rails.root.join("config", "blazer.yml")
    if path.exist?
      YAML.safe_load(ERB.new(File.read(path)).result, aliases: true)
    else
      {}
    end
  end
end
```
## 生成器模式
```ruby
# lib/generators/gemname/install_generator.rb
module GemName
  module Generators
    class InstallGenerator < Rails::Generators::Base
      source_root File.expand_path("templates", __dir__)

      def copy_initializer
        template "initializer.rb", "config/initializers/gemname.rb"
      end

      def copy_migration
        migration_template "migration.rb", "db/migrate/create_gemname_tables.rb"
      end
    end
  end
end
```
## 条件特征检测
```ruby
# Check for specific Rails versions
if ActiveRecord.version >= Gem::Version.new("7.0")
  # Rails 7+ specific code
end

# Check for optional dependencies
def self.client
  @client ||= if defined?(OpenSearch::Client)
    OpenSearch::Client.new
  elsif defined?(Elasticsearch::Client)
    Elasticsearch::Client.new
  else
    raise Error, "Install elasticsearch or opensearch-ruby"
  end
end
```
