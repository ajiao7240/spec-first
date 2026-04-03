# Gems - DHH 导轨风格

<他们用什么>
## 37signals 使用什么

**核心Rails堆栈：**
- 涡轮轨道、刺激轨道、导入地图轨道
- 传动轴（资产管道）

**数据库支持的服务（Solid 套件）：**
-solid_queue - 后台作业
-solid_cache-缓存
-solid_cable - WebSockets/动作电缆

**身份验证和安全性：**
- bcrypt（用于任何需要的密码散列）

**他们自己的宝石：**
- geared_pagination（基于光标的分页）
- lexxy（富文本编辑器）
- 手套（邮寄工具）

**公用事业：**
- rqrcode（二维码生成）
- 红地毯 + 胭脂（Markdown 渲染）
- 网络推送（推送通知）

**部署和操作：**
-kamal（Docker 部署）
- 推进器（HTTP/2 代理）
- Mission_control-jobs（作业监控）
- 自动调谐器（GC 调谐）
</他们用什么>

<他们避免什么>
## 他们故意避免什么

**身份验证：**
```
devise → Custom ~150-line auth
```
原因：完全控制，没有密码责任，带有魔术链接，更简单。

**授权：**
```
pundit/cancancan → Simple role checks in models
```
原因：大多数应用程序不需要策略对象。模型上的方法就足够了：
```ruby
class Board < ApplicationRecord
  def editable_by?(user)
    user.admin? || user == creator
  end
end
```
**后台工作：**
```
sidekiq → Solid Queue
```
原因：数据库支持意味着没有 Redis，但事务保证相同。

**缓存：**
```
redis → Solid Cache
```
原因：数据库已经存在，基础设施更简单。

**搜索：**
```
elasticsearch → Custom sharded search
```
原因：完全按照他们的需要构建，不依赖外部服务。

**视图层：**
```
view_component → Standard partials
```
原因：部分工作正常。 ViewComponents 增加了复杂性，但对其用例没有明显的好处。

**API：**
```
GraphQL → REST with Turbo
```
原因：当您控制两端时，REST 就足够了。 GraphQL 的复杂性不合理。

**工厂：**
```
factory_bot → Fixtures
```
原因：装置更简单、更快，并且鼓励预先考虑数据关系。

**服务对象：**
```
Interactor, Trailblazer → Fat models
```
原因：业务逻辑保留在模型中。像 `card.close` 这样的方法而不是 `CardCloser.call(card)`。

**表单对象：**
```
Reform, dry-validation → params.expect + model validations
```
原因：Rails 7.1 的 `params.expect` 足够干净。模型的上下文验证。

**装饰器：**
```
Draper → View helpers + partials
```
原因：助手和部分更简单。没有装饰器间接。

**CSS：**
```
Tailwind, Sass → Native CSS
```
原因：现代 CSS 有嵌套、变量、层。无需构建步骤。

**前端：**
```
React, Vue, SPAs → Turbo + Stimulus
```
原因：服务器渲染的 HTML，带有少量 JS。 SPA 复杂性不合理。

**测试：**
```
RSpec → Minitest
```
原因：更简单、更快的启动、更少的 DSL 魔力，随 Rails 一起提供。
</他们要避免什么>

<测试哲学>
## 测试理念

**Minitest** - 更简单、更快：
```ruby
class CardTest < ActiveSupport::TestCase
  test "closing creates closure" do
    card = cards(:one)
    assert_difference -> { Card::Closure.count } do
      card.close
    end
    assert card.closed?
  end
end
```
**夹具** - 加载一次，确定性：
```yaml
# test/fixtures/cards.yml
open_card:
  title: Open Card
  board: main
  creator: alice

closed_card:
  title: Closed Card
  board: main
  creator: bob
```
**带有 ERB 的动态时间戳**：
```yaml
recent:
  title: Recent
  created_at: <%= 1.hour.ago %>

old:
  title: Old
  created_at: <%= 1.month.ago %>
```
**时间旅行**用于时间相关测试：
```ruby
test "expires after 15 minutes" do
  magic_link = MagicLink.create!(user: users(:alice))

  travel 16.minutes

  assert magic_link.expired?
end
```
**VCR** 用于外部 API：
```ruby
VCR.use_cassette("stripe/charge") do
  charge = Stripe::Charge.create(amount: 1000)
  assert charge.paid
end
```
**测试附带功能** - 相同的提交，而不是之前或之后。
</测试哲学>

<决策框架>
## 决策框架

在添加 gem 之前，询问：

1. **普通 Rails 可以做到这一点吗？**
   - ActiveRecord 可以做 Sequel 可以做的大部分事情
   - ActionMailer 可以很好地处理电子邮件
   - ActiveJob 适合大多数工作需求

2. **复杂性值得吗？**
   - 150 行自定义代码与 10,000 行 gem
   - 你会更好地理解你的代码
   - 更少的升级难题

3. **它是否增加了基础设施？**
   - 雷迪斯？考虑数据库支持的替代方案
   - 外部服务？考虑内部建设
   - 更简单的基础设施=更少的故障模式

4. **是来自您信任的人吗？**
   - 37 个信号宝石：经过大规模战斗测试
   - 保养良好、专注的宝石：通常都很好
   - 厨房水槽宝石：可能有点矫枉过正

**理念：**
> “在获取宝石之前先制定解决方案。”

不是反对宝石，而是支持理解。当宝石真正解决您遇到的问题而不是您可能遇到的问题时，请使用宝石。
</决策框架>

<宝石图案>
## 宝石使用模式

**分页：**
```ruby
# geared_pagination - cursor-based
class CardsController < ApplicationController
  def index
    @cards = @board.cards.geared(page: params[:page])
  end
end
```
**降价：**
```ruby
# redcarpet + rouge
class MarkdownRenderer
  def self.render(text)
    Redcarpet::Markdown.new(
      Redcarpet::Render::HTML.new(filter_html: true),
      autolink: true,
      fenced_code_blocks: true
    ).render(text)
  end
end
```
**后台工作：**
```ruby
# solid_queue - no Redis
class ApplicationJob < ActiveJob::Base
  queue_as :default
  # Just works, backed by database
end
```
**缓存：**
```ruby
# solid_cache - no Redis
# config/environments/production.rb
config.cache_store = :solid_cache_store
```
</宝石图案>
