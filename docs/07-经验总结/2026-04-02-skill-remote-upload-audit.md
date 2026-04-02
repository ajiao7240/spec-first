# skill 远程上传脚本审计

- 审计日期：2026-04-02
- 范围：`skills/**/SKILL.md`、`skills/**/scripts/*`
- 结论口径：只统计 skill 里明确出现的远程上传、发布、同步、回写命令或工作流；纯只读脚本不计入

## 结论

- 直接包含远程上传/发布命令的 skill：`11`
- 只包含远程推送/PR 写入动作的 skill：`3`
- 仅提到上传模式，但没有给出可执行上传脚本的 skill：`1`

## 直接上传/发布

### `proof`

- `skills/proof/SKILL.md:25`、`skills/proof/SKILL.md:161` 使用 `curl -X POST https://www.proofeditor.ai/share/markdown` 创建共享文档
- `skills/proof/SKILL.md:49`、`skills/proof/SKILL.md:145`、`skills/proof/SKILL.md:174` 使用 `curl -X POST https://www.proofeditor.ai/api/agent/{slug}/ops` 回写、评论、建议修改

### `spec-brainstorm`

- `skills/spec-brainstorm/SKILL.md:294` 使用 Proof 的 `share/markdown` 接口把需求文档上传为可分享链接

### `spec-plan`

- `skills/spec-plan/SKILL.md:918` 使用 Proof 的 `share/markdown` 接口把计划文档上传为可分享链接

### `onboarding`

- `skills/onboarding/SKILL.md:401` 使用 Proof 的 `share/markdown` 接口上传 `ONBOARDING.md`

### `rclone`

- `skills/rclone/SKILL.md:78`、`skills/rclone/SKILL.md:83` 使用 `rclone copy` 上传文件和目录到远程存储
- `skills/rclone/SKILL.md:88`、`skills/rclone/SKILL.md:123` 使用 `rclone sync` 和分块上传同步到远端 bucket

### `feature-video`

- `skills/feature-video/SKILL.md:263` 使用 `agent-browser upload '#fc-new_comment_field' [VIDEO_FILE_PATH]` 把视频上传到 GitHub PR 评论框
- `skills/feature-video/SKILL.md:304` 生成的是 `github.com/user-attachments/assets/...` 形式的 GitHub 原生附件链接

### `spec-work`

- `skills/spec-work/SKILL.md:326`-`330` 使用 `imgup -h pixhost screenshot.png` 上传截图
- `skills/spec-work/SKILL.md:344` 之后还会 `git push -u origin feature-branch-name` 把变更推到远端

### `spec-work-beta`

- `skills/spec-work-beta/SKILL.md:335`-`339` 使用 `imgup -h pixhost screenshot.png` 上传截图
- `skills/spec-work-beta/SKILL.md:353` 之后还会 `git push -u origin feature-branch-name`

### `resolve-pr-feedback`

- `skills/resolve-pr-feedback/scripts/reply-to-pr-thread:22` 使用 `gh api graphql` 给 review thread 写回复
- `skills/resolve-pr-feedback/scripts/resolve-pr-thread:13` 使用 `gh api graphql` 把 thread 标记为已解决
- `skills/resolve-pr-feedback/SKILL.md:176` 还会用 `gh pr comment` 把非 thread 类型反馈回写到 PR

### `deploy-docs`

- `skills/deploy-docs/SKILL.md:90`、`skills/deploy-docs/SKILL.md:93` 使用 GitHub Actions 的 `actions/upload-pages-artifact@v3` 和 `actions/deploy-pages@v4` 发布到 GitHub Pages

### `changelog`

- `skills/changelog/SKILL.md:112`-`117` 使用 Discord webhook 的 `curl` 请求把 changelog 发到远程频道

## 仅远程推送 / PR 写入

这些 skill 有 `git push`、`gh pr create`、`gh pr comment` 之类的远程写入动作，但没有独立的“文件上传脚本”：

- `git-commit-push-pr`：`skills/git-commit-push-pr/SKILL.md:152`
- `spec-review`：`skills/spec-review/SKILL.md:521`-`522`
- `todo-resolve`：`skills/todo-resolve/SKILL.md:41`

## 灰区项

- `spec-ideate`：`skills/spec-ideate/SKILL.md:347` 只引用“标准 Proof 上传模式”，但当前文件里没有单独列出可执行脚本，因此不计入正式清单
- `resolve-pr-feedback/scripts/get-pr-comments`、`resolve-pr-feedback/scripts/get-thread-for-comment`：这两个脚本只读，不属于上传脚本

## 简短结论

如果只看“真正会把内容送到远端”的 skill，命中最多的是 `proof` 系列、`rclone`、`feature-video`、`spec-work` / `spec-work-beta`、`resolve-pr-feedback` 和 `deploy-docs`。  
如果把 `git push` 也算上传，那 `git-commit-push-pr`、`spec-review`、`todo-resolve` 也应纳入远程写入类清单。
