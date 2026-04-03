---
name: rclone
description: 使用 rclone 在多种云存储之间上传、同步和管理文件。适用于上传图片、视频、文档到 S3、Cloudflare R2、Backblaze B2、Google Drive、Dropbox 或任意 S3 兼容存储。
---

# Rclone

使用 `rclone` 在本地与云存储之间传输文件。

## 适用场景

- 上传文件到对象存储或网盘
- 同步目录到远端
- 备份生成产物
- 校验远端文件是否存在

## 工作流

### 第 1 步：确认目标

明确以下信息：

- 要上传或同步的本地路径
- 目标 remote 名称
- bucket / 目录路径
- 期望动作：`copy`、`sync`、`move` 还是 `ls`

### 第 2 步：检查配置

先验证 `rclone` 是否可用，以及 remote 是否已配置。

常用命令：

```bash
rclone version
rclone listremotes
rclone config show
```

如果 remote 未配置，先提示用户完成配置，再继续。

### 第 3 步：执行操作

根据任务选择最小必要命令：

```bash
rclone copy <src> <remote>:<path>
rclone sync <src> <remote>:<path>
rclone move <src> <remote>:<path>
rclone ls <remote>:<path>
```

上传前，可先用：

```bash
rclone copy --dry-run <src> <remote>:<path>
```

### 第 4 步：验证结果

上传或同步后，检查：

- 命令退出状态
- 传输文件数量
- 目标路径中的文件是否存在
- 如有需要，比较文件大小或校验和

## 原则

- 默认优先 `copy`，除非用户明确要求删除源文件
- `sync` 可能删除远端多余文件，执行前必须确认
- 对大批量传输，优先先做 `--dry-run`
- 汇报时说明源路径、目标路径、实际执行命令和验证结果
