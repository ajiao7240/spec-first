---
name: feature-video
description: 录制功能的视频演练并将其添加到 PR 描述中。当 PR 需要为审阅者提供视觉演示时、当用户要求演示某个功能、创建 PR 视频、录制演练、展示视觉上的更改或将视频添加到拉取请求时使用。
argument-hint: "[PR number or 'current' or path/to/video.mp4] [optional: base URL, default localhost:3000]"
---
# 专题视频演练

记录展示功能的浏览器交互，将屏幕截图拼接到 MP4 视频中，本地上传到 GitHub，并作为内嵌视频播放器嵌入 PR 描述中。

## 先决条件

- 正在运行的本地开发服务器（例如，`bin/dev`、`npm run dev`、`rails server`）
- `agent-browser` CLI已安装（加载`agent-browser`技能以获取详细信息）
- 安装`ffmpeg`（用于视频转换）
- `gh` CLI 通过对存储库的推送访问进行身份验证
- 功能分支上的 Git 存储库（PR 可选——技能可以创建草稿或仅记录）
- 一次性 GitHub 浏览器身份验证（请参阅第 6 步身份验证检查）

## 主要任务

### 1. 解析争论并解决 PR

**参数：** $ARGUMENTS

解析输入：
- 第一个参数：PR 编号、“当前”（默认为当前分支的 PR）或现有 `.mp4` 文件的路径（仅上传恢复模式）
- 第二个参数：基本 URL（默认为 `http://localhost:3000`）

**仅上传简历：** 如果第一个参数以 `.mp4` 结尾并且文件存在，请跳过步骤 2-5 并使用该文件直接进入步骤 6。从当前分支解析 PR 编号 (`gh pr view --json number -q '.number'`)。

如果提供了明确的 PR 编号，请验证它是否存在并直接使用它：
```bash
gh pr view [number] --json number -q '.number'
```
如果未提供明确的 PR 编号（或指定了“current”），请检查当前分支是否存在 PR：
```bash
gh pr view --json number -q '.number'
```
如果当前分支不存在 PR，请询问用户如何继续。 **使用平台的屏蔽提问工具**（Claude Code 中为 `AskUserQuestion`，Codex 中为 `request_user_input`，Gemini 中为 `ask_user`：
```
No PR found for the current branch.

1. Create a draft PR now and continue (recommended)
2. Record video only -- save locally and upload later when a PR exists
3. Cancel
```
如果选项 1：使用从分支名称派生的占位符标题创建草稿 PR，则继续使用新的 PR 编号：
```bash
gh pr create --draft --title "[branch-name-humanized]" --body "Draft PR for video walkthrough"
```
如果选择 2：设置 `RECORD_ONLY=true`。继续执行步骤 2-5（录制和编码），跳过步骤 6-7（上传和 PR 更新），并在最后报告本地视频路径和 `[RUN_ID]`。

**仅上传简历：** 要上传以前录制的视频，请将现有视频文件路径作为第一个参数传递（例如，`/feature-video .context/spec-first/feature-video/1711234567/videos/feature-demo.mp4`）。当第一个参数是 `.mp4` 文件的路径时，请跳过步骤 2-5，并使用该文件上传直接进入步骤 6。

### 1b。验证所需工具

在继续之前，请检查是否已安装所需的 CLI 工具。尽早失败并发出明确的消息，而不是在记录屏幕截图后在工作流程中失败：
```bash
command -v ffmpeg
```

```bash
command -v agent-browser
```

```bash
command -v gh
```
如果缺少任何工具，请停止并报告需要安装哪些工具：
- `ffmpeg`：`brew install ffmpeg` (macOS) 或同等版本
- `agent-browser`：加载`agent-browser`技能以获取安装说明
- `gh`：`brew install gh` (macOS) 或参见 https://cli.github.com

在所有工具都可用之前，请勿继续执行步骤 2。

### 2. 收集特征上下文

**如果 PR 可用**，获取 PR 详细信息和更改的文件：
```bash
gh pr view [number] --json title,body,files,headRefName -q '.'
```

```bash
gh pr view [number] --json files -q '.files[].path'
```
**如果处于仅记录模式（无 PR）**，检测默认分支并从分支差异中派生上下文。在一个块中运行这两个命令，以便变量持续存在：
```bash
DEFAULT_BRANCH=$(gh repo view --json defaultBranchRef -q '.defaultBranchRef.name') && git diff --name-only "$DEFAULT_BRANCH"...HEAD && git log --oneline "$DEFAULT_BRANCH"...HEAD
```
将更改的文件映射到应演示的路由/页面。检查项目的路由配置（例如，`routes.rb`、`next.config.js`、`app/`目录结构）以确定哪些 URL 对应于已更改的文件。

### 3.规划视频流程

在录制之前，创建一个镜头列表：

1. **开场镜头**：主页或起点（2-3秒）
2. **导航**：用户如何访问该功能
3. **功能演示**：核心功能（重点）
4. **边缘情况**：错误状态、验证等（如果适用）
5. **成功状态**：已完成的操作/结果

在记录之前向用户展示建议的流程以供确认。

**使用平台的阻塞问题工具（如果可用）**（Claude Code 中的 `AskUserQuestion`、Codex 中的 `request_user_input`、Gemini 中的 `ask_user`。否则，请显示编号选项并等待用户回复，然后再继续：
```
Proposed Video Flow for PR #[number]: [title]

1. Start at: /[starting-route]
2. Navigate to: /[feature-route]
3. Demonstrate:
   - [Action 1]
   - [Action 2]
   - [Action 3]
4. Show result: [success state]

Estimated duration: ~[X] seconds

1. Start recording
2. Modify the flow (describe changes)
3. Add specific interactions to demonstrate
```
### 4. 记录演练

生成唯一的运行 ID（例如时间戳）并创建每次运行的输出目录。这可以防止先前运行的过时屏幕截图被拼接到新视频中。

**重要提示：** Shell 变量不会在单独的代码块中持续存在。生成运行 ID 后，将具体值替换到此工作流程中的所有后续命令中。例如，如果时间戳是 `1711234567`，则在下面的所有路径中使用该文字值 - 不要依赖 `[RUN_ID]` 在后面的块中扩展。
```bash
date +%s
```
使用输出作为 RUN_ID。创建具有具体值的目录：
```bash
mkdir -p .context/spec-first/feature-video/[RUN_ID]/screenshots
mkdir -p .context/spec-first/feature-video/[RUN_ID]/videos
```
执行计划的流程，使用代理浏览器捕获每个步骤。按顺序对屏幕截图进行编号以获得正确的帧顺序：
```bash
agent-browser open "[base-url]/[start-route]"
agent-browser wait 2000
agent-browser screenshot .context/spec-first/feature-video/[RUN_ID]/screenshots/01-start.png
```

```bash
agent-browser snapshot -i
agent-browser click @e1
agent-browser wait 1000
agent-browser screenshot .context/spec-first/feature-video/[RUN_ID]/screenshots/02-navigate.png
```

```bash
agent-browser snapshot -i
agent-browser click @e2
agent-browser wait 1000
agent-browser screenshot .context/spec-first/feature-video/[RUN_ID]/screenshots/03-feature.png
```

```bash
agent-browser wait 2000
agent-browser screenshot .context/spec-first/feature-video/[RUN_ID]/screenshots/04-result.png
```
### 5. 创建视频

使用步骤 4 中的相同 `[RUN_ID]` 将屏幕截图拼接到 MP4 中：
```bash
ffmpeg -y -framerate 0.5 -pattern_type glob -i ".context/spec-first/feature-video/[RUN_ID]/screenshots/*.png" \
  -c:v libx264 -pix_fmt yuv420p -vf "scale=1280:-2" \
  ".context/spec-first/feature-video/[RUN_ID]/videos/feature-demo.mp4"
```
注意事项：
- `-framerate 0.5` = 每帧 2 秒。调整以加快/减慢播放速度。
- 比例中的 `-2` 确保高度可被 2 整除（H.264 要求）。

### 6. 验证并上传到 GitHub

上传会生成一个 `user-attachments/assets/` URL，GitHub 将其呈现为原生内联视频播放器 - 与手动将视频粘贴到 PR 编辑器中的结果相同。

方法：关闭任何现有的代理浏览器会话，使用保存的 GitHub 身份验证启动 Chrome 引擎会话，导航到 PR 页面，在评论表单的隐藏文件输入上设置视频文件，等待 GitHub 处理上传，提取生成的 URL，然后清除文本区域而不提交。

#### 检查现有会话

首先，检查保存的 GitHub 会话是否已存在：
```bash
agent-browser close
agent-browser --engine chrome --session-name github open https://github.com/settings/profile
agent-browser get title
```
如果页面标题包含用户的 GitHub 用户名或“个人资料”，则会话仍然有效 - 跳到下面的“上传视频”。如果它重定向到登录页面，则会话已过期或从未创建 - 继续“身份验证设置”。

#### 身份验证设置（一次性）

建立经过身份验证的 GitHub 会话。这只需要发生一次——会话 cookie 通过 `--session-name` 标志在运行中持续存在。

关闭当前会话并在带标题的 Chrome 窗口中打开 GitHub 登录页面：
```bash
agent-browser close
agent-browser --engine chrome --headed --session-name github open https://github.com/login
```
用户必须在浏览器窗口中手动登录（处理 2FA、SSO、OAuth - 任何登录方法）。 **使用平台的屏蔽问题工具**（Claude Code 中为 `AskUserQuestion`，Codex 中为 `request_user_input`，Gemini 中为 `ask_user`。否则，请显示消息并等待用户回复，然后再继续：
```
GitHub login required for video upload.

A Chrome window has opened to github.com/login. Please log in manually
(this handles 2FA/SSO/OAuth automatically). Reply when done.
```
登录后，验证会话是否有效：
```bash
agent-browser open https://github.com/settings/profile
```
如果配置文件页面加载，则身份验证得到确认。 `github` 会话现已保存并可重复使用。

####上传视频

导航到 PR 页面并滚动到评论表单：
```bash
agent-browser open "https://github.com/[owner]/[repo]/pull/[number]"
agent-browser scroll down 5000
```
上传前保存任何现有的文本区域内容（评论框可能包含未发送的草稿）：
```bash
agent-browser eval "document.getElementById('new_comment_field').value"
```
将此值存储为 `SAVED_TEXTAREA`。如果非空，则提取上传URL后恢复。

通过隐藏文件输入上传视频。如果处于仅上传恢复模式，则使用调用者提供的 `.mp4` 路径，否则使用当前运行的编码视频：
```bash
agent-browser upload '#fc-new_comment_field' [VIDEO_FILE_PATH]
```
其中 `[VIDEO_FILE_PATH]` 是：
- 作为第一个参数传递的 `.mp4` 路径（仅上传恢复模式）
- `.context/spec-first/feature-video/[RUN_ID]/videos/feature-demo.mp4`（正常录制流程）

等待 GitHub 处理上传（通常 3-5 秒），然后读取 textarea 值：
```bash
agent-browser wait 5000
agent-browser eval "document.getElementById('new_comment_field').value"
```
**验证提取的 URL。** 该值必须包含 `user-attachments/assets/` 以确认本机上传成功。如果文本区域为空、仅包含占位符文本或 URL 不匹配，则不要继续执行步骤 7。而是：

1. 检查`agent-browser get url`——如果显示`github.com/login`，则会话已过期。重新运行身份验证设置。
2. 如果仍在 PR 页面上，请再等待 5 秒并重新读取文本区域（GitHub 处理可能很慢）。
3. 如果重试后验证仍然失败，请报告失败并报告本地视频路径，以便用户手动上传。

恢复原始文本区域内容（如果为空则清除）。 JSON 编码的字符串也是有效的 JavaScript 字符串文字，因此直接分配它而不使用 `JSON.parse`：
```bash
agent-browser eval "const ta = document.getElementById('new_comment_field'); ta.value = [SAVED_TEXTAREA_AS_JS_STRING]; ta.dispatchEvent(new Event('input', { bubbles: true }))"
```
要准备该值：获取 SAVED_TEXTAREA 字符串并从中生成 JS 字符串文字 - 转义反斜杠、双引号和换行符（例如 `"text with \"quotes\" and\nnewlines"`）。如果 SAVED_TEXTAREA 为空，则使用 `""`。结果直接嵌入到赋值的右侧——不需要 `JSON.parse` 调用。

### 7.更新PR描述

获取当前 PR 正文：
```bash
gh pr view [number] --json body -q '.body'
```
附加演示部分（或替换现有的演示部分）。当视频 URL 放置在自己的行上时，会呈现为内联播放器：
```markdown
## Demo

https://github.com/user-attachments/assets/[uuid]

*Automated video walkthrough*
```
更新 PR：
```bash
gh pr edit [number] --body "[updated body with demo section]"
```
### 8. 清理

删除临时文件之前询问用户。如果确认，仅清理当前运行的暂存目录（其他运行可能仍在进行中或等待上传）。

**如果视频上传成功**，删除整个运行目录：
```bash
rm -r .context/spec-first/feature-video/[RUN_ID]
```
**如果处于仅记录模式或上传失败**，仅删除屏幕截图但保留视频，以便用户稍后上传：
```bash
rm -r .context/spec-first/feature-video/[RUN_ID]/screenshots
```
呈现完成摘要：
```
Feature Video Complete

PR: #[number] - [title]
Video: [VIDEO_URL]

Shots captured:
1. [description]
2. [description]
3. [description]
4. [description]

PR description updated with demo section.
```
## 用法示例
```bash
# Record video for current branch's PR
/feature-video

# Record video for specific PR
/feature-video 847

# Record with custom base URL
/feature-video 847 http://localhost:5000

# Record for staging environment
/feature-video current https://staging.example.com
```
## 提示

- 保持简短：10-30 秒是 PR 演示的理想选择
- 专注于改变：不包含不相关的UI
- 显示之前/之后：如果修复错误，首先显示损坏的状态（如果可能）
- 当 GitHub 使 cookie 失效时（通常是几周），`--session-name github` 会话就会过期。如果上传因登录重定向而失败，请重新运行身份验证设置。
- 如果 GitHub 更新其 UI，GitHub DOM 选择器（`#fc-new_comment_field`、`#new_comment_field`）可能会更改。如果上传失败，请检查 PR 页面是否有更新的选择器。

## 故障排除

|症状|原因 |修复 |
|---|---|---|
| `ffmpeg: command not found` |未安装 ffmpeg |通过 `brew install ffmpeg` (macOS) 或同等方式安装 |
| `agent-browser: command not found` |代理浏览器未安装 |加载`agent-browser`技能以获取安装说明 |
|上传等待后文本区域为空 |会话已过期，或 GitHub 处理速度缓慢 |检查会话有效性（步骤 6 身份验证检查）。如果有效，请增加等待时间并重试。 |
|文本区域为空，URL 为 `github.com/login` |会话已过期 |重新运行身份验证设置（第 6 步）|
| `gh pr view` 失败 |当前分支没有 PR |第 1 步处理此问题 - 选择创建草稿 PR 或仅记录模式 |
|视频文件太大，无法上传 |超过 GitHub 的 10MB（免费）或 100MB（付费）限制 |重新编码：降低帧速率 (`-framerate 0.33`)、降低分辨率 (`scale=960:-2`) 或增加 CRF (`-crf 28`) |
|上传网址不包含`user-attachments/assets/` |上传方式错误或GitHub更改 |通过检查 PR 页面来验证文件输入选择器是否仍然正确 |
