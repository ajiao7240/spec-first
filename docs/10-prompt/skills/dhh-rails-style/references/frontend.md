# 前端 - DHH Rails 风格

<涡轮模式>
## 涡轮模式

**Turbo Streams** 用于部分更新：
```erb
<%# app/views/cards/closures/create.turbo_stream.erb %>
<%= turbo_stream.replace @card %>
```
**变形**复杂的更新：
```ruby
render turbo_stream: turbo_stream.morph(@card)
```
**全局变形** - 在布局中启用：
```ruby
turbo_refreshes_with method: :morph, scroll: :preserve
```
**使用 `cached: true` 进行片段缓存**：
```erb
<%= render partial: "card", collection: @cards, cached: true %>
```
**没有 ViewComponents** - 标准部分工作正常。
</turbo_patterns>

<涡轮变形>
## Turbo 变形最佳实践

**监听变形事件**以恢复客户端状态：
```javascript
document.addEventListener("turbo:morph-element", (event) => {
  // Restore any client-side state after morph
})
```
**永久元素** - 使用数据属性跳过变形：
```erb
<div data-turbo-permanent id="notification-count">
  <%= @count %>
</div>
```
**帧变形** - 添加刷新属性：
```erb
<%= turbo_frame_tag :assignment, src: path, refresh: :morph %>
```
**常见问题及解决方案：**

|问题 |解决方案 |
|---------|----------|
|计时器未更新 |在 morph 事件侦听器中清除/重新启动 |
|表格重置 |在涡轮框架中包裹成型截面 |
|分页中断 |使用带有 `refresh: :morph` | 的 Turbo 帧
|更换时闪烁 |切换到变形而不是替换 |
|本地存储丢失 |听`turbo:morph-element`，恢复状态|
</turbo_morphing>

<turbo_frames>
## 涡轮框架

**带有微调器的延迟加载**：
```erb
<%= turbo_frame_tag "menu",
      src: menu_path,
      loading: :lazy do %>
  <div class="spinner">Loading...</div>
<% end %>
```
**内联编辑**，具有编辑/视图切换功能：
```erb
<%= turbo_frame_tag dom_id(card, :edit) do %>
  <%= link_to "Edit", edit_card_path(card),
        data: { turbo_frame: dom_id(card, :edit) } %>
<% end %>
```
**目标父框架**，无需硬编码：
```erb
<%= form_with model: @card, data: { turbo_frame: "_parent" } do |f| %>
```
**实时订阅：**
```erb
<%= turbo_stream_from @card %>
<%= turbo_stream_from @card, :activity %>
```
</turbo_frames>

<刺激控制器>
## 刺激控制器

Fizzy 中有 52 个控制器，其中 62% 是可重用的，38% 是特定于域的。

**特点：**
- 每个控制器单一责任
- 通过值/类进行配置
- 沟通活动
- 带有#的私有方法
- 大多数低于 50 行

**示例：**
```javascript
// copy-to-clipboard (25 lines)
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = { content: String }

  copy() {
    navigator.clipboard.writeText(this.contentValue)
    this.#showFeedback()
  }

  #showFeedback() {
    this.element.classList.add("copied")
    setTimeout(() => this.element.classList.remove("copied"), 1500)
  }
}
```

```javascript
// auto-click (7 lines)
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    this.element.click()
  }
}
```

```javascript
// toggle-class (31 lines)
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static classes = ["toggle"]
  static values = { open: { type: Boolean, default: false } }

  toggle() {
    this.openValue = !this.openValue
  }

  openValueChanged() {
    this.element.classList.toggle(this.toggleClass, this.openValue)
  }
}
```

```javascript
// auto-submit (28 lines) - debounced form submission
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = { delay: { type: Number, default: 300 } }

  connect() {
    this.timeout = null
  }

  submit() {
    clearTimeout(this.timeout)
    this.timeout = setTimeout(() => {
      this.element.requestSubmit()
    }, this.delayValue)
  }

  disconnect() {
    clearTimeout(this.timeout)
  }
}
```

```javascript
// dialog (45 lines) - native HTML dialog management
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  open() {
    this.element.showModal()
  }

  close() {
    this.element.close()
    this.dispatch("closed")
  }

  clickOutside(event) {
    if (event.target === this.element) this.close()
  }
}
```

```javascript
// local-time (40 lines) - relative time display
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = { datetime: String }

  connect() {
    this.#updateTime()
  }

  #updateTime() {
    const date = new Date(this.datetimeValue)
    const now = new Date()
    const diffMinutes = Math.floor((now - date) / 60000)

    if (diffMinutes < 60) {
      this.element.textContent = `${diffMinutes}m ago`
    } else if (diffMinutes < 1440) {
      this.element.textContent = `${Math.floor(diffMinutes / 60)}h ago`
    } else {
      this.element.textContent = `${Math.floor(diffMinutes / 1440)}d ago`
    }
  }
}
```
</stimulus_controllers>

<刺激最佳实践>
## 刺激最佳实践

**Values API** 通过 getAttribute：
```javascript
// Good
static values = { delay: { type: Number, default: 300 } }

// Avoid
this.element.getAttribute("data-delay")
```
**断开连接时的清理：**
```javascript
disconnect() {
  clearTimeout(this.timeout)
  this.observer?.disconnect()
  document.removeEventListener("keydown", this.boundHandler)
}
```
**动作过滤器** - `:self` 防止冒泡：
```erb
<div data-action="click->menu#toggle:self">
```
**助手提取** - 单独模块中的共享实用程序：
```javascript
// app/javascript/helpers/timing.js
export function debounce(fn, delay) {
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), delay)
  }
}
```
**松散耦合的事件调度**：
```javascript
this.dispatch("selected", { detail: { id: this.idValue } })
```
</stimulus_best_practices>

<视图助手>
## 查看助手（刺激集成）

**对话助手：**
```ruby
def dialog_tag(id, &block)
  tag.dialog(
    id: id,
    data: {
      controller: "dialog",
      action: "click->dialog#clickOutside keydown.esc->dialog#close"
    },
    &block
  )
end
```
**自动提交表单助手：**
```ruby
def auto_submit_form_with(model:, delay: 300, **options, &block)
  form_with(
    model: model,
    data: {
      controller: "auto-submit",
      auto_submit_delay_value: delay,
      action: "input->auto-submit#submit"
    },
    **options,
    &block
  )
end
```
**复制按钮助手：**
```ruby
def copy_button(content:, label: "Copy")
  tag.button(
    label,
    data: {
      controller: "copy",
      copy_content_value: content,
      action: "click->copy#copy"
    }
  )
end
```
</view_helpers>

<css_架构>
## CSS 架构

具有现代功能的 Vanilla CSS，无需预处理器。

**CSS @layer** 用于级联控制：
```css
@layer reset, base, components, modules, utilities;

@layer reset {
  *, *::before, *::after { box-sizing: border-box; }
}

@layer base {
  body { font-family: var(--font-sans); }
}

@layer components {
  .btn { /* button styles */ }
}

@layer modules {
  .card { /* card module styles */ }
}

@layer utilities {
  .hidden { display: none; }
}
```
**OKLCH 颜色系统** 用于感知均匀性：
```css
:root {
  --color-primary: oklch(60% 0.15 250);
  --color-success: oklch(65% 0.2 145);
  --color-warning: oklch(75% 0.15 85);
  --color-danger: oklch(55% 0.2 25);
}
```
**深色模式**通过 CSS 变量：
```css
:root {
  --bg: oklch(98% 0 0);
  --text: oklch(20% 0 0);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: oklch(15% 0 0);
    --text: oklch(90% 0 0);
  }
}
```
**原生 CSS 嵌套：**
```css
.card {
  padding: var(--space-4);

  & .title {
    font-weight: bold;
  }

  &:hover {
    background: var(--bg-hover);
  }
}
```
**~60 个最小实用程序** 与 Tailwind 的数百个相比。

**使用的现代功能：**
- `@starting-style` 用于输入动画
- `color-mix()` 用于颜色处理
- `:has()` 用于家长选择
- 逻辑属性（`margin-inline`、`padding-block`）
- 容器查询
</css_架构>

<视图模式>
## 查看模式

**标准部分** - 无 ViewComponents：
```erb
<%# app/views/cards/_card.html.erb %>
<article id="<%= dom_id(card) %>" class="card">
  <%= render "cards/header", card: card %>
  <%= render "cards/body", card: card %>
  <%= render "cards/footer", card: card %>
</article>
```
**片段缓存：**
```erb
<% cache card do %>
  <%= render "cards/card", card: card %>
<% end %>
```
**集合缓存：**
```erb
<%= render partial: "card", collection: @cards, cached: true %>
```
**简单的组件命名** - 没有严格的 BEM：
```css
.card { }
.card .title { }
.card .actions { }
.card.golden { }
.card.closed { }
```
</view_patterns>

<带有个性化的缓存>
## 缓存中的用户特定内容

将个性化移至客户端 JavaScript 以保留缓存：
```erb
<%# Cacheable fragment %>
<% cache card do %>
  <article class="card"
           data-creator-id="<%= card.creator_id %>"
           data-controller="ownership"
           data-ownership-current-user-value="<%= Current.user.id %>">
    <button data-ownership-target="ownerOnly" class="hidden">Delete</button>
  </article>
<% end %>
```

```javascript
// Reveal user-specific elements after cache hit
export default class extends Controller {
  static values = { currentUser: Number }
  static targets = ["ownerOnly"]

  connect() {
    const creatorId = parseInt(this.element.dataset.creatorId)
    if (creatorId === this.currentUserValue) {
      this.ownerOnlyTargets.forEach(el => el.classList.remove("hidden"))
    }
  }
}
```
**提取动态内容**以单独的框架：
```erb
<% cache [card, board] do %>
  <article class="card">
    <%= turbo_frame_tag card, :assignment,
          src: card_assignment_path(card),
          refresh: :morph %>
  </article>
<% end %>
```
分配下拉列表独立更新，不会使父缓存失效。
</caching_with_personalization>

<广播>
## 使用 Turbo Streams 进行广播

**模型回调**用于实时更新：
```ruby
class Card < ApplicationRecord
  include Broadcastable

  after_create_commit :broadcast_created
  after_update_commit :broadcast_updated
  after_destroy_commit :broadcast_removed

  private
    def broadcast_created
      broadcast_append_to [Current.account, board], :cards
    end

    def broadcast_updated
      broadcast_replace_to [Current.account, board], :cards
    end

    def broadcast_removed
      broadcast_remove_to [Current.account, board], :cards
    end
end
```
**按租户划分的范围**使用 `[Current.account, resource]` 模式。
</广播>
