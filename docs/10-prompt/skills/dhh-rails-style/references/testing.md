# 测试 - DHH Rails 风格

## 核心理念

“使用固定装置进行最小化测试 - 简单、快速、确定性。”该方法优先考虑实用主义而不是惯例。

## 为什么 Minitest 优于 RSpec

- **更简单**：更少的 DSL 魔力，简单的 Ruby 断言
- **随 Rails 一起提供**：没有额外的依赖项
- **更快的启动时间**：更少的开销
- **Plain Ruby**：无需学习专门的语法

## 作为测试数据的赛程

装置提供预加载的数据，而不是工厂：
- 加载一次，在测试中重复使用
- 没有运行时对象创建开销
- 明确的关系可见性
- 确定性 ID 更容易调试

### 夹具结构
```yaml
# test/fixtures/users.yml
david:
  identity: david
  account: basecamp
  role: admin

jason:
  identity: jason
  account: basecamp
  role: member

# test/fixtures/rooms.yml
watercooler:
  name: Water Cooler
  creator: david
  direct: false

# test/fixtures/messages.yml
greeting:
  body: Hello everyone!
  room: watercooler
  creator: david
```
### 在测试中使用夹具
```ruby
test "sending a message" do
  user = users(:david)
  room = rooms(:watercooler)

  # Test with fixture data
end
```
### 动态夹具值
ERB 支持时间敏感数据：
```yaml
recent_card:
  title: Recent Card
  created_at: <%= 1.hour.ago %>

old_card:
  title: Old Card
  created_at: <%= 1.month.ago %>
```
## 测试组织

### 单元测试
使用设置块和标准断言验证业务逻辑：
```ruby
class CardTest < ActiveSupport::TestCase
  setup do
    @card = cards(:one)
    @user = users(:david)
  end

  test "closing a card creates a closure" do
    assert_difference -> { Card::Closure.count } do
      @card.close(creator: @user)
    end

    assert @card.closed?
    assert_equal @user, @card.closure.creator
  end

  test "reopening a card destroys the closure" do
    @card.close(creator: @user)

    assert_difference -> { Card::Closure.count }, -1 do
      @card.reopen
    end

    refute @card.closed?
  end
end
```
### 集成测试
测试完整的请求/响应周期：
```ruby
class CardsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:david)
    sign_in @user
  end

  test "closing a card" do
    card = cards(:one)

    post card_closure_path(card)

    assert_response :success
    assert card.reload.closed?
  end

  test "unauthorized user cannot close card" do
    sign_in users(:guest)
    card = cards(:one)

    post card_closure_path(card)

    assert_response :forbidden
    refute card.reload.closed?
  end
end
```
### 系统测试
使用 Capybara 基于浏览器的测试：
```ruby
class MessagesTest < ApplicationSystemTestCase
  test "sending a message" do
    sign_in users(:david)
    visit room_path(rooms(:watercooler))

    fill_in "Message", with: "Hello, world!"
    click_button "Send"

    assert_text "Hello, world!"
  end

  test "editing own message" do
    sign_in users(:david)
    visit room_path(rooms(:watercooler))

    within "#message_#{messages(:greeting).id}" do
      click_on "Edit"
    end

    fill_in "Message", with: "Updated message"
    click_button "Save"

    assert_text "Updated message"
  end

  test "drag and drop card to new column" do
    sign_in users(:david)
    visit board_path(boards(:main))

    card = find("#card_#{cards(:one).id}")
    target = find("#column_#{columns(:done).id}")

    card.drag_to target

    assert_selector "#column_#{columns(:done).id} #card_#{cards(:one).id}"
  end
end
```
## 高级模式

### 时间测试
使用 `travel_to` 进行确定性的时间相关断言：
```ruby
test "card expires after 30 days" do
  card = cards(:one)

  travel_to 31.days.from_now do
    assert card.expired?
  end
end
```
### 使用 VCR 进行外部 API 测试
记录并重放 HTTP 交互：
```ruby
test "fetches user data from API" do
  VCR.use_cassette("user_api") do
    user_data = ExternalApi.fetch_user(123)

    assert_equal "John", user_data[:name]
  end
end
```
### 后台作业测试
断言作业排队和电子邮件传送：
```ruby
test "closing card enqueues notification job" do
  card = cards(:one)

  assert_enqueued_with(job: NotifyWatchersJob, args: [card]) do
    card.close
  end
end

test "welcome email is sent on signup" do
  assert_emails 1 do
    Identity.create!(email: "new@example.com")
  end
end
```
### 测试 Turbo Streams
```ruby
test "message creation broadcasts to room" do
  room = rooms(:watercooler)

  assert_turbo_stream_broadcasts [room, :messages] do
    room.messages.create!(body: "Test", creator: users(:david))
  end
end
```
## 测试原理

### 1. 测试可观察的行为
关注代码的作用，而不是它是如何做的：
```ruby
# ❌ Testing implementation
test "calls notify method on each watcher" do
  card.expects(:notify).times(3)
  card.close
end

# ✅ Testing behavior
test "watchers receive notifications when card closes" do
  assert_difference -> { Notification.count }, 3 do
    card.close
  end
end
```
### 2. 不要嘲笑一切
```ruby
# ❌ Over-mocked test
test "sending message" do
  room = mock("room")
  user = mock("user")
  message = mock("message")

  room.expects(:messages).returns(stub(create!: message))
  message.expects(:broadcast_create)

  MessagesController.new.create
end

# ✅ Test the real thing
test "sending message" do
  sign_in users(:david)
  post room_messages_url(rooms(:watercooler)),
    params: { message: { body: "Hello" } }

  assert_response :success
  assert Message.exists?(body: "Hello")
end
```
### 3. 测试附带的功能
相同的提交，不是 TDD 优先，而是一起提交。既不在之前（严格 TDD），也不在之后（延迟测试）。

### 4. 安全修复始终包括回归测试
每个安全修复都必须包括能够捕获漏洞的测试。

### 5. 集成测试验证完整的工作流程
不要只测试单独的部分 - 测试它们是否可以协同工作。

## 文件组织
```
test/
├── controllers/         # Integration tests for controllers
├── fixtures/           # YAML fixtures for all models
├── helpers/            # Helper method tests
├── integration/        # API integration tests
├── jobs/               # Background job tests
├── mailers/            # Mailer tests
├── models/             # Unit tests for models
├── system/             # Browser-based system tests
└── test_helper.rb      # Test configuration
```
## 测试助手设置
```ruby
# test/test_helper.rb
ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

class ActiveSupport::TestCase
  fixtures :all

  parallelize(workers: :number_of_processors)
end

class ActionDispatch::IntegrationTest
  include SignInHelper
end

class ApplicationSystemTestCase < ActionDispatch::SystemTestCase
  driven_by :selenium, using: :headless_chrome
end
```
## 登录助手
```ruby
# test/support/sign_in_helper.rb
module SignInHelper
  def sign_in(user)
    session = user.identity.sessions.create!
    cookies.signed[:session_id] = session.id
  end
end
```
