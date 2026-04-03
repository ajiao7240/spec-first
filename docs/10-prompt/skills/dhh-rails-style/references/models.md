# 型号 - DHH 导轨样式

<模型关注点>
## 对水平行为的担忧

模型大量使用关注点。典型的 Card 模型包含 14 个以上的问题：
```ruby
class Card < ApplicationRecord
  include Assignable
  include Attachments
  include Broadcastable
  include Closeable
  include Colored
  include Eventable
  include Golden
  include Mentions
  include Multistep
  include Pinnable
  include Postponable
  include Readable
  include Searchable
  include Taggable
  include Watchable
end
```
每个关注点都是独立的，具有关联、范围和方法。

**命名：** 描述能力的形容词（`Closeable`、`Publishable`、`Watchable`）
</模型关注点>

<状态记录>
## 状态为记录，而不是布尔值

创建单独的记录，而不是布尔列：
```ruby
# Instead of:
closed: boolean
is_golden: boolean
postponed: boolean

# Create records:
class Card::Closure < ApplicationRecord
  belongs_to :card
  belongs_to :creator, class_name: "User"
end

class Card::Goldness < ApplicationRecord
  belongs_to :card
  belongs_to :creator, class_name: "User"
end

class Card::NotNow < ApplicationRecord
  belongs_to :card
  belongs_to :creator, class_name: "User"
end
```
**好处：**
- 自动时间戳（发生时）
- 跟踪谁进行了更改
- 通过连接和 `where.missing` 轻松过滤
- 启用丰富的用户界面，显示时间/人物

**在模型中：**
```ruby
module Closeable
  extend ActiveSupport::Concern

  included do
    has_one :closure, dependent: :destroy
  end

  def closed?
    closure.present?
  end

  def close(creator: Current.user)
    create_closure!(creator: creator)
  end

  def reopen
    closure&.destroy
  end
end
```
**查询：**
```ruby
Card.joins(:closure)         # closed cards
Card.where.missing(:closure) # open cards
```
</状态记录>

<回调>
## 回调 - 谨慎使用

Fizzy 中 30 个文件中仅出现 38 次回调。指南：

**用于：**
- `after_commit` 用于异步工作
- `before_save` 用于导出数据
- `after_create_commit` 副作用

**避免：**
- 复杂的回调链
- 回调中的业务逻辑
- 同步外部呼叫
```ruby
class Card < ApplicationRecord
  after_create_commit :notify_watchers_later
  before_save :update_search_index, if: :title_changed?

  private
    def notify_watchers_later
      NotifyWatchersJob.perform_later(self)
    end
end
```
</回调>

<范围>
## 范围命名

标准范围名称：
```ruby
class Card < ApplicationRecord
  scope :chronologically, -> { order(created_at: :asc) }
  scope :reverse_chronologically, -> { order(created_at: :desc) }
  scope :alphabetically, -> { order(title: :asc) }
  scope :latest, -> { reverse_chronologically.limit(10) }

  # Standard eager loading
  scope :preloaded, -> { includes(:creator, :assignees, :tags) }

  # Parameterized
  scope :indexed_by, ->(column) { order(column => :asc) }
  scope :sorted_by, ->(column, direction = :asc) { order(column => direction) }
end
```
</范围>

<波罗斯>
## 普通旧 Ruby 对象

PORO 在父模型下命名：
```ruby
# app/models/event/description.rb
class Event::Description
  def initialize(event)
    @event = event
  end

  def to_s
    # Presentation logic for event description
  end
end

# app/models/card/eventable/system_commenter.rb
class Card::Eventable::SystemCommenter
  def initialize(card)
    @card = card
  end

  def comment(message)
    # Business logic
  end
end

# app/models/user/filtering.rb
class User::Filtering
  # View context bundling
end
```
**不用于服务对象。** 业务逻辑保留在模型中。
</孔隙>

<动词谓词>
## 方法命名

**动词** - 改变状态的动作：
```ruby
card.close
card.reopen
card.gild      # make golden
card.ungild
board.publish
board.archive
```
**谓词** - 从状态派生的查询：
```ruby
card.closed?    # closure.present?
card.golden?    # goldness.present?
board.published?
```
**避免**通用设置器：
```ruby
# Bad
card.set_closed(true)
card.update_golden_status(false)

# Good
card.close
card.ungild
```
</动词谓词>

<验证哲学>
## 验证理念

对模型进行最少的验证。对表单/操作对象使用上下文验证：
```ruby
# Model - minimal
class User < ApplicationRecord
  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
end

# Form object - contextual
class Signup
  include ActiveModel::Model

  attr_accessor :email, :name, :terms_accepted

  validates :email, :name, presence: true
  validates :terms_accepted, acceptance: true

  def save
    return false unless valid?
    User.create!(email: email, name: name)
  end
end
```
**为了数据完整性，优先选择数据库约束**而不是模型验证：
```ruby
# migration
add_index :users, :email, unique: true
add_foreign_key :cards, :boards
```
</validation_philosophy>

<错误处理>
## 让它崩溃哲学

使用 bang 方法在失败时引发异常：
```ruby
# Preferred - raises on failure
@card = Card.create!(card_params)
@card.update!(title: new_title)
@comment.destroy!

# Avoid - silent failures
@card = Card.create(card_params)  # returns false on failure
if @card.save
  # ...
end
```
让错误自然传播。 Rails 处理 ActiveRecord::RecordInvalid 的 422 响应。
</错误处理>

<默认值>
## Lambda 的默认值

使用 lambda 默认值与 Current 关联：
```ruby
class Card < ApplicationRecord
  belongs_to :creator, class_name: "User", default: -> { Current.user }
  belongs_to :account, default: -> { Current.account }
end

class Comment < ApplicationRecord
  belongs_to :commenter, class_name: "User", default: -> { Current.user }
end
```
Lambda 确保创建时的动态解析。
</默认值>

<rails_71_patterns>
## Rails 7.1+ 模型模式

**标准化** - 验证前清理数据：
```ruby
class User < ApplicationRecord
  normalizes :email, with: ->(email) { email.strip.downcase }
  normalizes :phone, with: ->(phone) { phone.gsub(/\D/, "") }
end
```
**委托类型** - 替换多态关联：
```ruby
class Message < ApplicationRecord
  delegated_type :messageable, types: %w[Comment Reply Announcement]
end

# Now you get:
message.comment?        # true if Comment
message.comment         # returns the Comment
Message.comments        # scope for Comment messages
```
**Store Accessor** - 结构化 JSON 存储：
```ruby
class User < ApplicationRecord
  store :settings, accessors: [:theme, :notifications_enabled], coder: JSON
end

user.theme = "dark"
user.notifications_enabled = true
```
</rails_71_patterns>

<关注指南>
## 关注指南

- **每个问题 50-150 行**（大多数约为 100 行）
- **内聚** - 仅相关功能
- **以功能命名** - `Closeable`、`Watchable`，而不是 `CardHelpers`
- **自包含** - 关联、范围、方法在一起
- **不仅仅用于组织** - 在真正需要重用时创建

**触摸链**用于缓存失效：
```ruby
class Comment < ApplicationRecord
  belongs_to :card, touch: true
end

class Card < ApplicationRecord
  belongs_to :board, touch: true
end
```
当评论更新时，卡片的`updated_at`会发生变化，并级联到棋盘上。

**相关更新的交易包装**：
```ruby
class Card < ApplicationRecord
  def close(creator: Current.user)
    transaction do
      create_closure!(creator: creator)
      record_event(:closed)
      notify_watchers_later
    end
  end
end
```
</关注指南>
