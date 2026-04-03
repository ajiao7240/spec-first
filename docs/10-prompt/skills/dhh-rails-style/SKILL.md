---
name: dhh-rails-style
description: 当以 DHH 独特的 37signals 风格编写 Ruby 和 Rails 代码时，应该使用此技能。它适用于编写 Ruby 代码、Rails 应用程序、创建模型、控制器或任何 Ruby 文件。在 Ruby/Rails 代码生成、重构请求、代码审查或用户提及 DHH、37signals、Basecamp、HEY 或 Campfire 风格时触发。体现了 REST 纯度、胖模型、瘦控制器、当前属性、Hotwire 模式以及“清晰胜过聪明”的理念。
---
<目标>
将 37signals/DHH Rails 约定应用于 Ruby 和 Rails 代码。此技能提供从分析生产 37signals 代码库 (Fizzy/Campfire) 和 DHH 的代码审查模式中提取的全面领域专业知识。
</目标>

<基本原则>
## 核心理念

“最好的代码是你不写的代码。第二好的代码是明显正确的代码。”

**香草导轨足够了：**
- 服务对象的丰富领域模型
- 自定义操作的 CRUD 控制器
- 对水平代码共享的担忧
- 记录为状态而不是布尔列
- 数据库支持的一切（无 Redis）
- 在获取宝石之前构建解决方案

**他们刻意避免的：**
- devise（自定义〜150行验证）
- pundit/cancancan（模型中的简单角色检查）
- sidekiq（Solid Queue 使用数据库）
- redis（一切数据库）
- view_component（部分工作正常）
- GraphQL（REST 和 Turbo 就足够了）
-factory_bot（装置更简单）
- rspec（Minitest 附带 Rails）
- Tailwind（带有图层的原生 CSS）

**发展理念：**
- 交付、验证、优化 - 原型质量代码到生产环境中进行学习
- 解决根本原因，而不是症状
- 写入时操作优于读取时计算
- ActiveRecord 验证的数据库约束
</essential_principles>

<摄入量>
你在做什么？1. **控制器** - REST 映射、关注点、Turbo 响应、API 模式
2. **模型** - 关注点、状态记录、回调、范围、PORO
3. **视图和前端** - Turbo、Stimulus、CSS、部分
4. **架构** - 路由、多租户、身份验证、作业、缓存
5. **测试** - Minitest、固定装置、集成测试
6. **宝石和依赖项** - 使用什么与避免什么
7. **代码审查** - 根据 DHH 风格审查代码
8. **一般指导** - 理念和惯例

**指定一个数字或描述您的任务。**
</摄入量>

<路由>

|回应 |参考阅读|
|----------|--------------------|
| 1、控制器| `references/controllers.md` |
| 2、型号| `references/models.md` |
| 3、视图、前端、涡轮、刺激、CSS | `references/frontend.md` |
| 4、架构、路由、auth、job、缓存| `references/architecture.md` |
| 5、测试、测试、Minitest、夹具| `references/testing.md` |
| 6、gem、依赖、库 | `references/gems.md` |
| 7、回顾|阅读所有参考资料，然后查看代码 |
| 8、一般任务|根据上下文阅读相关参考资料 |

**阅读相关参考资料后，将模式应用到用户的代码中。**
</路由>

<快速参考>
## 命名约定

**动词：** `card.close`、`card.gild`、`board.publish`（不是 `set_style` 方法）

**谓词：** `card.closed?`, `card.golden?`（源自相关记录的存在）

**关注点：** 描述能力的形容词 (`Closeable`, `Publishable`, `Watchable`)

**控制器：** 与资源匹配的名词 (`Cards::ClosuresController`)

**范围：**
- `chronologically`、`reverse_chronologically`、`alphabetically`、`latest`
- `preloaded`（标准急切加载名称）
- `indexed_by`、`sorted_by`（参数化）
- `active`、`unassigned`（业务术语，不是 SQL 式）

## 休息映射创建新资源而不是自定义操作：
```
POST /cards/:id/close    → POST /cards/:id/closure
DELETE /cards/:id/close  → DELETE /cards/:id/closure
POST /cards/:id/archive  → POST /cards/:id/archival
```
## Ruby 语法首选项
```ruby
# Symbol arrays with spaces inside brackets
before_action :set_message, only: %i[ show edit update destroy ]

# Private method indentation
  private
    def set_message
      @message = Message.find(params[:id])
    end

# Expression-less case for conditionals
case
when params[:before].present?
  messages.page_before(params[:before])
else
  messages.last_page
end

# Bang methods for fail-fast
@message = Message.create!(params)

# Ternaries for simple conditionals
@room.direct? ? @room.users : @message.mentionees
```
## 关键模式

**作为记录说明：**
```ruby
Card.joins(:closure)         # closed cards
Card.where.missing(:closure) # open cards
```
**当前属性：**
```ruby
belongs_to :creator, default: -> { Current.user }
```
**模型授权：**
```ruby
class User < ApplicationRecord
  def can_administer?(message)
    message.creator == self || admin?
  end
end
```
</快速参考>

<参考索引>
## 领域知识

`references/`中的所有详细模式：

|文件|主题 |
|------|--------|
| `references/controllers.md` | REST 映射、关注点、Turbo 响应、API 模式、HTTP 缓存 |
| `references/models.md` |关注点、状态记录、回调、范围、PORO、授权、广播 |
| `references/frontend.md` | Turbo Streams、刺激控制器、CSS 层、OKLCH 颜色、部分 |
| `references/architecture.md` |路由、身份验证、作业、当前属性、缓存、数据库模式 |
| `references/testing.md` | Minitest、夹具、单元/集成/系统测试、测试模式 |
| `references/gems.md` |他们使用什么与避免什么、决策框架、Gemfile 示例 |
</参考索引>

<成功标准>
在以下情况下，代码遵循 DHH 风格：
- 控制器映射到资源上的 CRUD 动词
- 模型使用对水平行为的关注
- 状态是通过记录而不是布尔值来跟踪的
- 没有不必要的服务对象或抽象
- 数据库支持的解决方案优于外部服务
- 测试使用 Minitest 和固定装置
- Turbo/Stimulus 交互性（无繁重的 JS 框架）
- 具有现代功能的原生 CSS（图层、OKLCH、嵌套）
- 授权逻辑存在于用户模型上
- 作业是调用模型方法的浅层包装器
</成功标准>

<制作人员>
基于 [Marc Köhlbrugge](https://x.com/marckohlbrugge) 的 [非官方 37signals/DHH Rails 风格指南](https://github.com/marckohlbrugge/unofficial-37signals-coding-style-guide)，通过对 Fizzy 代码库的 265 个拉取请求进行深入分析而生成。**重要免责声明：**
- LLM 生成的指南 - 可能包含不准确之处
- Fizzy 的代码示例已获得 O'Saasy 许可证的许可
- 不隶属于 37signals，也不受 37signals 认可
</学分>
