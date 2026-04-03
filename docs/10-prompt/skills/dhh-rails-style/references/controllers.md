# 控制器 - DHH Rails 风格

<休息映射>
## 一切都映射到 CRUD

自定义操作成为新资源。创建名词资源，而不是现有资源上的动词：
```ruby
# Instead of this:
POST /cards/:id/close
DELETE /cards/:id/close
POST /cards/:id/archive

# Do this:
POST /cards/:id/closure      # create closure
DELETE /cards/:id/closure    # destroy closure
POST /cards/:id/archival     # create archival
```
**来自 37signals 的真实示例：**
```ruby
resources :cards do
  resource :closure       # closing/reopening
  resource :goldness      # marking important
  resource :not_now       # postponing
  resources :assignments  # managing assignees
end
```
每个资源都有自己的控制器和标准 CRUD 操作。
</rest_mapping>

<控制器关注点>
## 对共同行为的担忧

控制者广泛使用关注点。常见模式：

**CardScoped** - 加载 @card、@board，提供 render_card_replacement
```ruby
module CardScoped
  extend ActiveSupport::Concern

  included do
    before_action :set_card
  end

  private
    def set_card
      @card = Card.find(params[:card_id])
      @board = @card.board
    end

    def render_card_replacement
      render turbo_stream: turbo_stream.replace(@card)
    end
end
```
**BoardScoped** - 加载@board
**CurrentRequest** - 使用请求数据填充 Current
**CurrentTimezone** - 将请求包装在用户的时区中
**FilterScoped** - 处理复杂的过滤
**TurboFlash** - 通过 Turbo Stream 闪现消息
**ViewTransitions** - 禁用页面刷新
**BlockSearchEngineIndexing** - 设置 X-Robots-Tag 标头
**RequestForgeryProtection** - Sec-Fetch-Site CSRF（现代浏览器）
</controller_concerns>

<授权模式>
## 授权模式

控制器通过 before_action 检查权限，模型定义权限的含义：
```ruby
# Controller concern
module Authorization
  extend ActiveSupport::Concern

  private
    def ensure_can_administer
      head :forbidden unless Current.user.admin?
    end

    def ensure_is_staff_member
      head :forbidden unless Current.user.staff?
    end
end

# Usage
class BoardsController < ApplicationController
  before_action :ensure_can_administer, only: [:destroy]
end
```
**车型级授权：**
```ruby
class Board < ApplicationRecord
  def editable_by?(user)
    user.admin? || user == creator
  end

  def publishable_by?(user)
    editable_by?(user) && !published?
  end
end
```
保持授权简单、可读、与域位于同一位置。
</授权模式>

<安全问题>
## 安全问题

**Sec-Fetch-Site CSRF 保护：**
现代浏览器发送 Sec-Fetch-Site 标头。将其用于纵深防御：
```ruby
module RequestForgeryProtection
  extend ActiveSupport::Concern

  included do
    before_action :verify_request_origin
  end

  private
    def verify_request_origin
      return if request.get? || request.head?
      return if %w[same-origin same-site].include?(
        request.headers["Sec-Fetch-Site"]&.downcase
      )
      # Fall back to token verification for older browsers
      verify_authenticity_token
    end
end
```
**速率限制（Rails 8+）：**
```ruby
class MagicLinksController < ApplicationController
  rate_limit to: 10, within: 15.minutes, only: :create
end
```
适用于：身份验证端点、电子邮件发送、外部 API 调用、资源创建。
</安全问题>

<请求上下文>
## 请求上下文问题

**CurrentRequest** - 使用 HTTP 元数据填充 Current：
```ruby
module CurrentRequest
  extend ActiveSupport::Concern

  included do
    before_action :set_current_request
  end

  private
    def set_current_request
      Current.request_id = request.request_id
      Current.user_agent = request.user_agent
      Current.ip_address = request.remote_ip
      Current.referrer = request.referrer
    end
end
```
**CurrentTimezone** - 将请求包装在用户的时区中：
```ruby
module CurrentTimezone
  extend ActiveSupport::Concern

  included do
    around_action :set_timezone
    helper_method :timezone_from_cookie
  end

  private
    def set_timezone
      Time.use_zone(timezone_from_cookie) { yield }
    end

    def timezone_from_cookie
      cookies[:timezone] || "UTC"
    end
end
```
**SetPlatform** - 检测移动/桌面：
```ruby
module SetPlatform
  extend ActiveSupport::Concern

  included do
    helper_method :platform
  end

  def platform
    @platform ||= request.user_agent&.match?(/Mobile|Android/) ? :mobile : :desktop
  end
end
```
</请求上下文>

<涡轮响应>
## Turbo 流响应

使用 Turbo Streams 进行部分更新：
```ruby
class Cards::ClosuresController < ApplicationController
  include CardScoped

  def create
    @card.close
    render_card_replacement
  end

  def destroy
    @card.reopen
    render_card_replacement
  end
end
```
对于复杂的更新，请使用变形：
```ruby
render turbo_stream: turbo_stream.morph(@card)
```
</turbo_responses>

<api_模式>
## API 设计

相同的控制器，不同的格式。回应约定：
```ruby
def create
  @card = Card.create!(card_params)

  respond_to do |format|
    format.html { redirect_to @card }
    format.json { head :created, location: @card }
  end
end

def update
  @card.update!(card_params)

  respond_to do |format|
    format.html { redirect_to @card }
    format.json { head :no_content }
  end
end

def destroy
  @card.destroy

  respond_to do |format|
    format.html { redirect_to cards_path }
    format.json { head :no_content }
  end
end
```
**状态代码：**
- 创建：201 创建 + 位置标题
- 更新：204 无内容
- 删除：204 无内容
- 不记名令牌认证
</api_patterns>

<http_缓存>
## HTTP 缓存

ETag 和条件 GET 的广泛使用：
```ruby
class CardsController < ApplicationController
  def show
    @card = Card.find(params[:id])
    fresh_when etag: [@card, Current.user.timezone]
  end

  def index
    @cards = @board.cards.preloaded
    fresh_when etag: [@cards, @board.updated_at]
  end
end
```
Key insight: Times render server-side in user's timezone, so timezone must affect the ETag to prevent serving wrong times to other timezones.

**ApplicationController全局etag：**
```ruby
class ApplicationController < ActionController::Base
  etag { "v1" }  # Bump to invalidate all caches
end
```
在关联上使用 `touch: true` 以使缓存失效。
</http_缓存>
