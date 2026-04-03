# 架构 - DHH Rails 风格

<路由>
## 路由

一切都映射到 CRUD。相关操作的嵌套资源：
```ruby
Rails.application.routes.draw do
  resources :boards do
    resources :cards do
      resource :closure
      resource :goldness
      resource :not_now
      resources :assignments
      resources :comments
    end
  end
end
```
**动词到名词的转换：**
|行动|资源 |
|--------|----------|
|关闭卡片 | `card.closure` |
|看板| `board.watching` |
|标记为金色 | `card.goldness` |
|存档卡片 | `card.archival` |

**浅层嵌套** - 避免深层 URL：
```ruby
resources :boards do
  resources :cards, shallow: true  # /boards/:id/cards, but /cards/:id
end
```
**单一资源**，适用于每个家长一个：
```ruby
resource :closure   # not resources
resource :goldness
```
**解决 URL 生成：**
```ruby
# config/routes.rb
resolve("Comment") { |comment| [comment.card, anchor: dom_id(comment)] }

# Now url_for(@comment) works correctly
```
</路由>

<多租户>
## 多租户（基于路径）

**中间件从 URL 前缀中提取租户**：
```ruby
# lib/tenant_extractor.rb
class TenantExtractor
  def initialize(app)
    @app = app
  end

  def call(env)
    path = env["PATH_INFO"]
    if match = path.match(%r{^/(\d+)(/.*)?$})
      env["SCRIPT_NAME"] = "/#{match[1]}"
      env["PATH_INFO"] = match[2] || "/"
    end
    @app.call(env)
  end
end
```
**每个租户的 Cookie 范围**：
```ruby
# Cookies scoped to tenant path
cookies.signed[:session_id] = {
  value: session.id,
  path: "/#{Current.account.id}"
}
```
**后台作业上下文** - 序列化租户：
```ruby
class ApplicationJob < ActiveJob::Base
  around_perform do |job, block|
    Current.set(account: job.arguments.first.account) { block.call }
  end
end
```
**重复作业**必须迭代所有租户：
```ruby
class DailyDigestJob < ApplicationJob
  def perform
    Account.find_each do |account|
      Current.set(account: account) do
        send_digest_for(account)
      end
    end
  end
end
```
**控制器安全性** - 始终贯穿租户：
```ruby
# Good - scoped through user's accessible records
@card = Current.user.accessible_cards.find(params[:id])

# Avoid - direct lookup
@card = Card.find(params[:id])
```
</多租户>

<认证>
## 身份验证

自定义无密码魔术链接身份验证（总共约 150 行）：
```ruby
# app/models/session.rb
class Session < ApplicationRecord
  belongs_to :user

  before_create { self.token = SecureRandom.urlsafe_base64(32) }
end

# app/models/magic_link.rb
class MagicLink < ApplicationRecord
  belongs_to :user

  before_create do
    self.code = SecureRandom.random_number(100_000..999_999).to_s
    self.expires_at = 15.minutes.from_now
  end

  def expired?
    expires_at < Time.current
  end
end
```
**为什么不设计：**
- ~150 行 vs 大量依赖
- 没有密码存储责任
- 为用户提供更简单的用户体验
- 完全控制流量

API 的 **不记名令牌**：
```ruby
module Authentication
  extend ActiveSupport::Concern

  included do
    before_action :authenticate
  end

  private
    def authenticate
      if bearer_token = request.headers["Authorization"]&.split(" ")&.last
        Current.session = Session.find_by(token: bearer_token)
      else
        Current.session = Session.find_by(id: cookies.signed[:session_id])
      end

      redirect_to login_path unless Current.session
    end
end
```
</认证>

<背景工作>
## 后台作业

作业是调用模型方法的浅层包装器：
```ruby
class NotifyWatchersJob < ApplicationJob
  def perform(card)
    card.notify_watchers
  end
end
```
**命名约定：**
- `_later` 异步后缀：`card.notify_watchers_later`
- `_now` 立即数后缀：`card.notify_watchers_now`
```ruby
module Watchable
  def notify_watchers_later
    NotifyWatchersJob.perform_later(self)
  end

  def notify_watchers_now
    NotifyWatchersJob.perform_now(self)
  end

  def notify_watchers
    watchers.each do |watcher|
      WatcherMailer.notification(watcher, self).deliver_later
    end
  end
end
```
**数据库支持**，带有 Solid Queue：
- 不需要Redis
- 与您的数据相同的交易保证
- 更简单的基础设施

**交易安全：**
```ruby
# config/application.rb
config.active_job.enqueue_after_transaction_commit = true
```
**错误处理**（按类型）：
```ruby
class DeliveryJob < ApplicationJob
  # Transient errors - retry with backoff
  retry_on Net::OpenTimeout, Net::ReadTimeout,
           Resolv::ResolvError,
           wait: :polynomially_longer

  # Permanent errors - log and discard
  discard_on Net::SMTPSyntaxError do |job, error|
    Sentry.capture_exception(error, level: :info)
  end
end
```
**批处理**可连续：
```ruby
class ProcessCardsJob < ApplicationJob
  include ActiveJob::Continuable

  def perform
    Card.in_batches.each_record do |card|
      checkpoint!  # Resume from here if interrupted
      process(card)
    end
  end
end
```
</background_jobs>

<数据库模式>
## 数据库模式

**UUID 作为主键**（可按时间排序的 UUIDv7）：
```ruby
# migration
create_table :cards, id: :uuid do |t|
  t.references :board, type: :uuid, foreign_key: true
end
```
优点：无 ID 枚举、分布式友好、客户端生成。

**状态为记录**（不是布尔值）：
```ruby
# Instead of closed: boolean
class Card::Closure < ApplicationRecord
  belongs_to :card
  belongs_to :creator, class_name: "User"
end

# Queries become joins
Card.joins(:closure)          # closed
Card.where.missing(:closure)  # open
```
**硬删除** - 无软删除：
```ruby
# Just destroy
card.destroy!

# Use events for history
card.record_event(:deleted, by: Current.user)
```
简化查询，使用事件日志进行审核。

**计数器缓存**以提高性能：
```ruby
class Comment < ApplicationRecord
  belongs_to :card, counter_cache: true
end

# card.comments_count available without query
```
**每张桌子上的帐户范围**：
```ruby
class Card < ApplicationRecord
  belongs_to :account
  default_scope { where(account: Current.account) }
end
```
</database_patterns>

<当前属性>
## 当前属性

使用 `Current` 作为请求范围的状态：
```ruby
# app/models/current.rb
class Current < ActiveSupport::CurrentAttributes
  attribute :session, :user, :account, :request_id

  delegate :user, to: :session, allow_nil: true

  def account=(account)
    super
    Time.zone = account&.time_zone || "UTC"
  end
end
```
在控制器中设置：
```ruby
class ApplicationController < ActionController::Base
  before_action :set_current_request

  private
    def set_current_request
      Current.session = authenticated_session
      Current.account = Account.find(params[:account_id])
      Current.request_id = request.request_id
    end
end
```
在整个应用程序中使用：
```ruby
class Card < ApplicationRecord
  belongs_to :creator, default: -> { Current.user }
end
```
</当前属性>

<缓存>
## 缓存

**带有 ETag 的 HTTP 缓存**：
```ruby
fresh_when etag: [@card, Current.user.timezone]
```
**片段缓存：**
```erb
<% cache card do %>
  <%= render card %>
<% end %>
```
**俄罗斯娃娃缓存：**
```erb
<% cache @board do %>
  <% @board.cards.each do |card| %>
    <% cache card do %>
      <%= render card %>
    <% end %>
  <% end %>
<% end %>
```
**通过 `touch: true` 使缓存失效**：
```ruby
class Card < ApplicationRecord
  belongs_to :board, touch: true
end
```
**实体缓存** - 数据库支持：
- 不需要Redis
- 与申请数据一致
- 更简单的基础设施
</缓存>

<配置>
## 配置

**ENV.fetch 默认值：**
```ruby
# config/application.rb
config.active_job.queue_adapter = ENV.fetch("QUEUE_ADAPTER", "solid_queue").to_sym
config.cache_store = ENV.fetch("CACHE_STORE", "solid_cache").to_sym
```
**多个数据库：**
```yaml
# config/database.yml
production:
  primary:
    <<: *default
  cable:
    <<: *default
    migrations_paths: db/cable_migrate
  queue:
    <<: *default
    migrations_paths: db/queue_migrate
  cache:
    <<: *default
    migrations_paths: db/cache_migrate
```
**通过 ENV 在 SQLite 和 MySQL 之间切换：**
```ruby
adapter = ENV.fetch("DATABASE_ADAPTER", "sqlite3")
```
**CSP 可通过 ENV 扩展：**
```ruby
config.content_security_policy do |policy|
  policy.default_src :self
  policy.script_src :self, *ENV.fetch("CSP_SCRIPT_SRC", "").split(",")
end
```
</配置>

<测试>
## 测试

**Minitest**，不是 RSpec：
```ruby
class CardTest < ActiveSupport::TestCase
  test "closing a card creates a closure" do
    card = cards(:one)

    card.close

    assert card.closed?
    assert_not_nil card.closure
  end
end
```
**固定装置**而不是工厂：
```yaml
# test/fixtures/cards.yml
one:
  title: First Card
  board: main
  creator: alice

two:
  title: Second Card
  board: main
  creator: bob
```
**控制器集成测试**：
```ruby
class CardsControllerTest < ActionDispatch::IntegrationTest
  test "closing a card" do
    card = cards(:one)
    sign_in users(:alice)

    post card_closure_path(card)

    assert_response :success
    assert card.reload.closed?
  end
end
```
**测试附带功能** - 相同的提交，不是 TDD 优先，而是一起提交。

**安全修复的回归测试** - 始终如此。
</测试>

<事件>
## 事件跟踪

事件是唯一的事实来源：
```ruby
class Event < ApplicationRecord
  belongs_to :creator, class_name: "User"
  belongs_to :eventable, polymorphic: true

  serialize :particulars, coder: JSON
end
```
**可关注事件：**
```ruby
module Eventable
  extend ActiveSupport::Concern

  included do
    has_many :events, as: :eventable, dependent: :destroy
  end

  def record_event(action, particulars = {})
    events.create!(
      creator: Current.user,
      action: action,
      particulars: particulars
    )
  end
end
```
**由事件驱动的 Webhooks** - 事件是规范源。
</事件>

<电子邮件模式>
## 电子邮件模式

**多租户 URL 帮助程序：**
```ruby
class ApplicationMailer < ActionMailer::Base
  def default_url_options
    options = super
    if Current.account
      options[:script_name] = "/#{Current.account.id}"
    end
    options
  end
end
```
**时区感知交付：**
```ruby
class NotificationMailer < ApplicationMailer
  def daily_digest(user)
    Time.use_zone(user.timezone) do
      @user = user
      @digest = user.digest_for_today
      mail(to: user.email, subject: "Daily Digest")
    end
  end
end
```
**批量发货：**
```ruby
emails = users.map { |user| NotificationMailer.digest(user) }
ActiveJob.perform_all_later(emails.map(&:deliver_later))
```
**一键取消订阅 (RFC 8058)：**
```ruby
class ApplicationMailer < ActionMailer::Base
  after_action :set_unsubscribe_headers

  private
    def set_unsubscribe_headers
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
      headers["List-Unsubscribe"] = "<#{unsubscribe_url}>"
    end
end
```
</电子邮件模式>

<安全模式>
## 安全模式

**XSS预防** - 在助手中逃脱：
```ruby
def formatted_content(text)
  # Escape first, then mark safe
  simple_format(h(text)).html_safe
end
```
**SSRF 保护：**
```ruby
# Resolve DNS once, pin the IP
def fetch_safely(url)
  uri = URI.parse(url)
  ip = Resolv.getaddress(uri.host)

  # Block private networks
  raise "Private IP" if private_ip?(ip)

  # Use pinned IP for request
  Net::HTTP.start(uri.host, uri.port, ipaddr: ip) { |http| ... }
end

def private_ip?(ip)
  ip.start_with?("127.", "10.", "192.168.") ||
    ip.match?(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
end
```
**内容安全政策：**
```ruby
# config/initializers/content_security_policy.rb
Rails.application.configure do
  config.content_security_policy do |policy|
    policy.default_src :self
    policy.script_src :self
    policy.style_src :self, :unsafe_inline
    policy.base_uri :none
    policy.form_action :self
    policy.frame_ancestors :self
  end
end
```
**ActionText 清理：**
```ruby
# config/initializers/action_text.rb
Rails.application.config.after_initialize do
  ActionText::ContentHelper.allowed_tags = %w[
    strong em a ul ol li p br h1 h2 h3 h4 blockquote
  ]
end
```
</安全模式>

<活动存储>
## 主动存储模式

**变体预处理：**
```ruby
class User < ApplicationRecord
  has_one_attached :avatar do |attachable|
    attachable.variant :thumb, resize_to_limit: [100, 100], preprocessed: true
    attachable.variant :medium, resize_to_limit: [300, 300], preprocessed: true
  end
end
```
**直接上传到期** - 针对慢速连接延长：
```ruby
# config/initializers/active_storage.rb
Rails.application.config.active_storage.service_urls_expire_in = 48.hours
```
**头像优化** - 重定向到 blob：
```ruby
def show
  expires_in 1.year, public: true
  redirect_to @user.avatar.variant(:thumb).processed.url, allow_other_host: true
end
```
**用于迁移的镜像服务**：
```yaml
# config/storage.yml
production:
  service: Mirror
  primary: amazon
  mirrors: [google]
```
</活动存储>
