---
title: "feat: mcp-setup + spec-bootstrap 语言矩阵与 ABCoder 探针优化"
type: feat
status: completed
date: 2026-04-03
origin: ABCoder JDT 缓存权限故障分析 + 跨 skill 协调优化
---

# feat: mcp-setup + spec-bootstrap 语言矩阵与 ABCoder 探针优化

## Overview

优化 mcp-setup 和 spec-bootstrap 两个 skill 的跨 skill 协作，解决三类问题：

1. **ABCoder 探针失败率高**：Java 项目因 JDT 缓存目录权限不足而 panic，非 ABCoder 支持语言也会触发无意义探测（~60s 浪费）
2. **mcp-setup 缺少语言环境预检**：安装阶段不检测目标项目语言运行时，导致 `host-setup.json` 缺少关键上下文
3. **spec-bootstrap 消费端信息不足**：Host Readiness Gate 不读取 `host-setup.json` 中的语言/JDT 信息，无法提前预警

核心设计原则：**安装时预防 > 运行时修补**、**单点修复**、**纯检测与修复分离**。

## Problem Frame

### 根因分析（来自 qianxi-wx-plat 实际执行）

```
ABCoder 探针执行链路（当前）：

list_repos() → null (未解析)
  → abcoder parse java /path/to/project
    → panic: mkdir .../abcoder@v0.3.1/lang/java/lsp/jdtls: permission denied
      → abcoder.ready=false, reason=parse-failed
        → Enhanced mode (仅 Serena)
```

三个故障点：

| 故障点 | 原因 | 影响范围 |
|--------|------|----------|
| 执行 agent 使用 `npx abcoder` | ABCoder 是 Go binary，不是 npm 包 | 所有项目 |
| JDT 缓存写入 Go module cache | `go/pkg/mod/` 是只读目录（Go 语言规范） | Java 项目 |
| 非 ABCoder 支持语言仍尝试 parse | 无语言匹配前置检查 | Go/Java/Python 以外的所有项目 |

### 设计缺陷

1. **verify-tools.sh 职责不清**：只检测 `abcoder_installed` 和 `java_present`，不检测 Python/Go 运行时、不检测 JDT 缓存可写性
2. **mcp-setup SKILL.md 无 Phase 4.3**：安装阶段不修复已知问题（JDT 缓存权限），留给运行时处理
3. **spec-bootstrap ABCoder probe Step 2 仅 Java preflight**：不区分语言是否被 ABCoder 支持，Go/Python 项目无 preflight 却能正常工作，其他语言浪费时间
4. **host-setup.json 缺少语言矩阵字段**：spec-bootstrap Host Readiness Gate 无法读取 JDT 缓存状态进行提前预警

## Requirements Trace

| ID | 需求 | 来源 |
|----|------|------|
| R1 | verify-tools.sh 扩展语言运行时检测（Go/Python/Java）+ JDT 缓存可写性检测 | 故障分析 |
| R2 | mcp-setup SKILL.md 新增 Phase 4.3：语言环境预检 + JDT 缓存 chmod 修复 | 安装时预防原则 |
| R3 | spec-bootstrap ABCoder probe 重构为"语言匹配优先"：Step 2 先判语言是否支持 | 避免无意义探测 |
| R4 | spec-bootstrap Step 3b 显式标注"Go binary, 禁止 npx" | 消除 agent 幻觉 |
| R5 | host-setup.json 新增 `language_runtime` 和 `jdt_cache` 字段 | 跨 skill 协调 |
| R6 | spec-bootstrap Host Readiness Gate 消费 `host-setup.json` JDT 状态 | 提前预警 |

## Scope Boundaries

**包含：**
- verify-tools.sh 语言运行时检测扩展
- mcp-setup SKILL.md Phase 4.3 新增
- spec-bootstrap SKILL.md ABCoder probe Step 2-3b 重构
- host-setup.json schema 扩展
- spec-bootstrap Host Readiness Gate JDT 预警
- mcp-setup / spec-bootstrap 单元测试扩展

**不包含：**
- ABCoder 上游 bug 修复（Go module cache 写入违反 Go 规范）
- verify-tools.sh 中执行 chmod 或任何修复动作（纯检测）
- 支持更多 ABCoder 语言（等上游支持）
- 修改 `mcp-tools.json` 的 ABCoder 条目
- 修改 `prd-template.md`（工具表格已在 Unit 1 更新）
- 修改 `database-prd-template.md`

## Key Technical Decisions

### KD-1: ABCoder 支持语言 = {Go, Java, Python}

ABCoder（v0.3.1）实际支持的语言：

| 语言 | LSP 依赖 | 特殊处理 |
|------|----------|----------|
| Go | 无（内置 gopls） | 无 |
| Python | 无（内置 pyright） | 无 |
| Java | JDT Language Server | 需下载 + 缓存目录可写 |

`abcoder parse --help` 列出 7 种语言，但 Go/Java/Python 之外的语言 AST 质量未达可用级别。本次优化只对这 3 种语言启用 ABCoder probe。

### KD-2: verify-tools.sh 纯检测原则

verify-tools.sh **只做检测和记录**，不做任何修复：

```
✅ 检测 language runtime 是否存在
✅ 检测 JDT 缓存目录是否可写
✅ 记录检测结果到 host-setup.json
❌ 不执行 chmod/chown
❌ 不安装任何依赖
❌ 不修改任何文件（除了 host-setup.json 本身）
```

修复动作在 mcp-setup SKILL.md Phase 4.3 中执行，由 Claude agent 完成（可提示用户确认）。

### KD-3: 语言匹配前置（Language Match First）

当前 ABCoder probe 顺序：

```
Step 1: list_repos()          → 缓存未命中
Step 2: Java preflight only   → 仅检查 Java
Step 3: 检测语言 + parse      → 盲目尝试
Step 4: 验证                  → 可能永远到不了
```

优化后：

```
Step 1: list_repos()              → 缓存未命中
Step 2: Language Match First      → 不支持则直接跳过整个 ABCoder probe
Step 3: 语言环境预检（消费 host-setup.json）  → 已知问题提前预警
Step 4: parse + 验证              → 只在语言支持且环境就绪时执行
```

**收益**：不支持语言（Kotlin/Swift/Rust/C++/Ruby 等）跳过 ABCoder probe，节省 ~60s。

### KD-4: Serena 作为通用回退

ABCoder 不支持的语言直接进入 Enhanced mode（Serena 主导）：

| 场景 | ABCoder | Serena | 模式 |
|------|---------|--------|------|
| Go 项目 + Serena + ABCoder 就绪 | ✓ | ✓ | Full |
| Java 项目 + ABCoder 失败 | ✗ | ✓ | Enhanced |
| Kotlin 项目 | ✗（跳过 probe） | ✓ | Enhanced |
| Swift 项目 | ✗（跳过 probe） | ✓ | Enhanced |
| Python 项目 + ABCoder 就绪 | ✓ | ✓ | Full |
| 任何项目 + Serena 不可用 | ✗ | ✗ | Basic |

## Implementation Units

---

### Unit 1 (P0): mcp-setup — verify-tools.sh 语言矩阵 + SKILL.md Phase 4.3

**Goal:** 扩展 verify-tools.sh 检测 Go/Python/Java 运行时和 JDT 缓存可写性；新增 mcp-setup SKILL.md Phase 4.3 执行 JDT 缓存权限修复。

**Requirements:** R1, R2, R5

**Dependencies:** 无

**Files:**

- Modify: `skills/mcp-setup/scripts/verify-tools.sh`
- Modify: `skills/mcp-setup/SKILL.md`
- Modify: `tests/unit/mcp-setup.sh`
- Modify: `CHANGELOG.md`

#### Step 1: verify-tools.sh — 扩展语言运行时检测

在现有 `java_present` 检测块之后，新增 Go、Python 运行时检测和 JDT 缓存可写性检测：

```bash
# ---- Detect language runtimes ----

# Go
go_present=false
go_reason="go-not-found"
go_version=""
if command -v go >/dev/null 2>&1; then
  go_present=true
  go_reason="ok"
  go_version=$(go version 2>/dev/null | awk '{print $3}' || echo "unknown")
fi

# Python
python_present=false
python_reason="python-not-found"
python_version=""
if command -v python3 >/dev/null 2>&1; then
  python_present=true
  python_reason="ok"
  python_version=$(python3 --version 2>/dev/null | awk '{print $2}' || echo "unknown")
elif command -v python >/dev/null 2>&1; then
  python_present=true
  python_reason="ok"
  python_version=$(python --version 2>/dev/null | awk '{print $2}' || echo "unknown")
fi

# JDT cache writability (relevant only when abcoder is installed + Java present)
jdt_cache_writable=false
jdt_cache_path=""
jdt_cache_reason="not-applicable"

if [ "$abcoder_installed" = "true" ] && [ "$java_present" = "true" ]; then
  # ABCoder stores JDT under Go module cache; path: $GOMODCACHE/github.com/cloudwego/abcoder@<ver>/lang/java/lsp/jdtls
  # Note: Go module cache uses nested dirs (github.com/cloudwego/abcoder@ver), not a flat name — use ls -d glob, not find -name
  if [ -n "$go_version" ]; then
    gomodcache=$(go env GOMODCACHE 2>/dev/null || echo "")
    if [ -n "$gomodcache" ]; then
      # Find abcoder directory in module cache (Go module cache uses nested dirs, not flat names)
      abcoder_dir=$(ls -d "$gomodcache/github.com/cloudwego/abcoder@"* 2>/dev/null | head -1 || true)
      if [ -n "$abcoder_dir" ]; then
        jdt_cache_path="${abcoder_dir}/lang/java/lsp/jdtls"
        jdt_cache_reason="dir-exists"
        if [ -d "$jdt_cache_path" ] 2>/dev/null; then
          if [ -w "$jdt_cache_path" ]; then
            jdt_cache_writable=true
            jdt_cache_reason="writable"
          else
            jdt_cache_reason="not-writable"
          fi
        else
          # Directory doesn't exist yet — check if parent is writable
          parent_dir="${abcoder_dir}/lang/java/lsp"
          if [ -d "$parent_dir" ] && [ -w "$parent_dir" ]; then
            jdt_cache_writable=true
            jdt_cache_reason="parent-writable"
          elif [ ! -d "$parent_dir" ]; then
            # Check if we can create it (parent of parent writable)
            pop="${abcoder_dir}/lang/java"
            if [ -d "$pop" ] && [ -w "$pop" ]; then
              jdt_cache_writable=true
              jdt_cache_reason="ancestors-writable"
            else
              jdt_cache_reason="ancestor-not-writable"
            fi
          else
            jdt_cache_reason="parent-not-writable"
          fi
        fi
      else
        jdt_cache_reason="abcoder-not-in-modcache"
      fi
    else
      jdt_cache_reason="gomodcache-not-found"
    fi
  else
    jdt_cache_reason="go-not-available"
  fi
fi
```

**host-setup.json schema 扩展：**

在 `jq -n` 调用中新增参数和字段：

```bash
jq -n \
  --arg     completed_at        "$completed_at" \
  --argjson abcoder_installed   "$abcoder_installed" \
  --argjson abcoder_binary_ok   "$abcoder_binary_ok" \
  --argjson serena_configured   "$serena_configured" \
  --argjson gitnexus_configured "$gitnexus_configured" \
  --argjson context7_configured "$context7_configured" \
  --argjson java_present        "$java_present" \
  --arg     java_reason         "$java_reason" \
  --argjson go_present          "$go_present" \
  --arg     go_reason           "$go_reason" \
  --arg     go_version          "$go_version" \
  --argjson python_present      "$python_present" \
  --arg     python_reason       "$python_reason" \
  --arg     python_version      "$python_version" \
  --argjson jdt_cache_writable  "$jdt_cache_writable" \
  --arg     jdt_cache_path      "$jdt_cache_path" \
  --arg     jdt_cache_reason    "$jdt_cache_reason" \
  '{
    "version": "2",
    "completed_at": $completed_at,
    "setup_success": true,
    "tools": {
      "abcoder":  { "installed": $abcoder_installed, "binary_ok": $abcoder_binary_ok },
      "gitnexus": { "configured": $gitnexus_configured },
      "serena":   { "configured": $serena_configured },
      "context7": { "configured": $context7_configured }
    },
    "java_runtime": { "present": $java_present, "reason": $java_reason },
    "language_runtime": {
      "go":     { "present": $go_present,  "reason": $go_reason,  "version": $go_version },
      "python": { "present": $python_present, "reason": $python_reason, "version": $python_version }
    },
    "jdt_cache": { "writable": $jdt_cache_writable, "path": $jdt_cache_path, "reason": $jdt_cache_reason }
  }' > "$tmp"
```

**version 字段**从 `"1"` 升级到 `"2"`（向后兼容：旧字段名不变，只新增字段）。

#### Step 2: mcp-setup SKILL.md — 新增 Phase 4.3

在 Phase 4.2 之后追加：

```markdown
### 4.3 Language Environment Preflight

检测宿主语言运行时状态，对已知问题执行预防性修复。

#### 4.3.1 读取 host-setup.json

解析 `~/.claude/spec-first/host-setup.json` 中新增的字段：

- `language_runtime.go.present` — Go 运行时是否可用
- `language_runtime.python.present` — Python 运行时是否可用
- `jdt_cache.writable` — JDT 缓存目录是否可写（仅 abcoder 已安装 + Java 存在时有意义）
- `jdt_cache.path` — JDT 缓存路径（诊断用）
- `jdt_cache.reason` — 不可写原因

#### 4.3.2 JDT 缓存权限修复（仅当 abcoder 已安装 + Java 存在 + 缓存不可写）

**触发条件：** `jdt_cache.writable == false` AND `jdt_cache.reason == "not-writable"` (或 `"parent-not-writable"`)

**根因：** ABCoder v0.3.1 违反 Go module cache 只读规范，尝试在 `go/pkg/mod/` 下创建 JDT 缓存目录。

**修复方案：**

```bash
# 方案 A（推荐）：修复目录权限
sudo chown -R $(whoami) "$(dirname "$JDT_CACHE_PATH")"
# 或更精细：
chmod -R u+w "$ABCODER_MOD_DIR/lang/java/lsp"

# 方案 B（备选）：重建 abcoder 到可写路径
# 如果用户接受，在 GOPATH 外安装：
GOBIN=$HOME/.local/bin go install github.com/cloudwego/abcoder@latest
# 注意：这不能解决 JDT 缓存问题，因为 abcoder 仍在 modcache 内查找
```

**执行策略：**
1. 检测到 `jdt_cache.reason == "not-writable"` 时，输出诊断信息：

```
⚠️ ABCoder JDT 缓存目录权限不足（已知 bug）
   路径: /Users/xxx/go/pkg/mod/github.com/cloudwego/abcoder@v0.3.1/lang/java/lsp/jdtls
   原因: Go module cache 目录只读，abcoder 尝试写入 JDT 缓存失败
   影响: Java 项目无法使用 ABCoder AST 分析（将降级到 Serena Enhanced 模式）

   修复命令（推荐执行）:
   chmod -R u+w /Users/xxx/go/pkg/mod/github.com/cloudwego/abcoder@v0.3.1/lang/java/lsp
```

2. 使用 AskUserQuestion 询问用户是否执行修复
3. 用户确认后执行 `chmod -R u+w`
4. 修复后重新运行 verify-tools.sh 刷新 `host-setup.json`

#### 4.3.3 重新验证

修复完成后重新运行 `verify-tools.sh`，确认 `jdt_cache.writable == true`。

更新 Verification 章节的 summary：

```
Host readiness:
- dependencies: ready
- mcp config: ready
- tool binaries: ready
- language runtimes: go=1.22.0, python=3.12.0, java=17.0.11
- JDT cache: writable ✓ (或 "needs fix — see above")
- host marker: written (~/.claude/spec-first/host-setup.json)
```
```

#### Step 3: 测试扩展

在 `tests/unit/mcp-setup.sh` 的 Section 9 之后追加 Section 10：

```bash
# ============================================================================
echo "10. Language runtime detection tests"
# ============================================================================

echo "10.1 go_present=true when go in PATH"
FH101="$TMP_DIR/fh101"
FAKEBIN101="$TMP_DIR/fakebin101"
mkdir -p "$FH101" "$FAKEBIN101"
echo '{"mcpServers":{}}' > "$FH101/.claude.json"
for cmd in bash jq date mkdir mktemp chmod mv cat awk find head ls; do
  if _p=$(command -v "$cmd" 2>/dev/null); then ln -sf "$_p" "$FAKEBIN101/$cmd"; fi
done
# Stub go binary
printf '#!/bin/sh\nif [ "$1" = "version" ]; then echo "go version go1.22.0 darwin/arm64"; elif [ "$1" = "env" ]; then echo "/fake/gomodcache"; fi\n' > "$FAKEBIN101/go"
chmod +x "$FAKEBIN101/go"
HOME="$FH101" PATH="$FAKEBIN101" bash "$VERIFY_SCRIPT" >/dev/null 2>&1
out101=$(jq -r '.language_runtime.go.present' "$FH101/.claude/spec-first/host-setup.json")
assert_output "10.1 go_present=true" "true" "$out101"

echo "10.2 python_present=false when python not in PATH"
FH102="$TMP_DIR/fh102"
FAKEBIN102="$TMP_DIR/fakebin102"
mkdir -p "$FH102" "$FAKEBIN102"
echo '{"mcpServers":{}}' > "$FH102/.claude.json"
for cmd in bash jq date mkdir mktemp chmod mv cat awk find head ls; do
  if _p=$(command -v "$cmd" 2>/dev/null); then ln -sf "$_p" "$FAKEBIN102/$cmd"; fi
done
# No python3 or python in PATH
HOME="$FH102" PATH="$FAKEBIN102" bash "$VERIFY_SCRIPT" >/dev/null 2>&1
out102=$(jq -r '.language_runtime.python.present' "$FH102/.claude/spec-first/host-setup.json")
assert_output "10.2 python_present=false" "false" "$out102"

echo "10.3 jdt_cache.reason=not-applicable when abcoder not installed"
FH103="$TMP_DIR/fh103"
FAKEBIN103="$TMP_DIR/fakebin103"
mkdir -p "$FH103" "$FAKEBIN103"
echo '{"mcpServers":{}}' > "$FH103/.claude.json"
for cmd in bash jq date mkdir mktemp chmod mv cat awk find head ls; do
  if _p=$(command -v "$cmd" 2>/dev/null); then ln -sf "$_p" "$FAKEBIN103/$cmd"; fi
done
# No abcoder in PATH
HOME="$FH103" PATH="$FAKEBIN103" bash "$VERIFY_SCRIPT" >/dev/null 2>&1
out103=$(jq -r '.jdt_cache.reason' "$FH103/.claude/spec-first/host-setup.json")
assert_output "10.3 jdt_cache.reason=not-applicable" "not-applicable" "$out103"

echo "10.4 host-setup.json version is 2"
FH104="$TMP_DIR/fh104"
mkdir -p "$FH104"
HOME="$FH104" bash "$VERIFY_SCRIPT" >/dev/null 2>&1
out104=$(jq -r '.version' "$FH104/.claude/spec-first/host-setup.json")
assert_output "10.4 version=2" "2" "$out104"

echo "10.5 host-setup.json has language_runtime field"
FH105="$TMP_DIR/fh105"
mkdir -p "$FH105"
HOME="$FH105" bash "$VERIFY_SCRIPT" >/dev/null 2>&1
out105=$(jq -e '.language_runtime' "$FH105/.claude/spec-first/host-setup.json")
assert "10.5 language_runtime field exists" test -n "$out105"

echo "10.6 host-setup.json has jdt_cache field"
FH106="$TMP_DIR/fh106"
mkdir -p "$FH106"
HOME="$FH106" bash "$VERIFY_SCRIPT" >/dev/null 2>&1
out106=$(jq -e '.jdt_cache' "$FH106/.claude/spec-first/host-setup.json")
assert "10.6 jdt_cache field exists" test -n "$out106"

echo "10.7 jdt_cache.writable=false when JDT dir exists but not writable"
FH107="$TMP_DIR/fh107"
FAKEBIN107="$TMP_DIR/fakebin107"
FAKE_MOD107="$TMP_DIR/fakemod107"
mkdir -p "$FH107" "$FAKEBIN107"
echo '{"mcpServers":{}}' > "$FH107/.claude.json"
for cmd in bash jq date mkdir mktemp chmod mv cat awk find head ls; do
  if _p=$(command -v "$cmd" 2>/dev/null); then ln -sf "$_p" "$FAKEBIN107/$cmd"; fi
done
# Setup: abcoder dir in fake modcache + unwritable JDT dir
mkdir -p "$FAKE_MOD107/github.com/cloudwego/abcoder@v0.3.1/lang/java/lsp/jdtls"
chmod 444 "$FAKE_MOD107/github.com/cloudwego/abcoder@v0.3.1/lang/java/lsp/jdtls"
printf '#!/bin/sh\necho "abcoder version v0.3.1"\n' > "$FAKEBIN107/abcoder"
chmod +x "$FAKEBIN107/abcoder"
printf '#!/bin/sh\nexit 0\n' > "$FAKEBIN107/java"
chmod +x "$FAKEBIN107/java"
printf '#!/bin/sh\nif [ "$1" = "version" ]; then echo "go version go1.22.0 darwin/arm64"; elif [ "$1" = "env" ]; then echo "'"$FAKE_MOD107"'"; fi\n' > "$FAKEBIN107/go"
chmod +x "$FAKEBIN107/go"
HOME="$FH107" PATH="$FAKEBIN107" bash "$VERIFY_SCRIPT" >/dev/null 2>&1
out107w=$(jq -r '.jdt_cache.writable' "$FH107/.claude/spec-first/host-setup.json")
assert_output "10.7 jdt_cache.writable=false" "false" "$out107w"
out107r=$(jq -r '.jdt_cache.reason' "$FH107/.claude/spec-first/host-setup.json")
assert_output "10.7 jdt_cache.reason=not-writable" "not-writable" "$out107r"
# Cleanup: restore permissions so TMP_DIR cleanup works
chmod 755 "$FAKE_MOD107/github.com/cloudwego/abcoder@v0.3.1/lang/java/lsp/jdtls"

echo "10.8 jdt_cache.writable=true when JDT parent dir is writable (jdtls not yet created)"
FH108="$TMP_DIR/fh108"
FAKEBIN108="$TMP_DIR/fakebin108"
FAKE_MOD108="$TMP_DIR/fakemod108"
mkdir -p "$FH108" "$FAKEBIN108"
echo '{"mcpServers":{}}' > "$FH108/.claude.json"
for cmd in bash jq date mkdir mktemp chmod mv cat awk find head ls; do
  if _p=$(command -v "$cmd" 2>/dev/null); then ln -sf "$_p" "$FAKEBIN108/$cmd"; fi
done
# Setup: abcoder dir exists, lsp/ parent is writable, jdtls dir not yet created
mkdir -p "$FAKE_MOD108/github.com/cloudwego/abcoder@v0.3.1/lang/java/lsp"
printf '#!/bin/sh\necho "abcoder version v0.3.1"\n' > "$FAKEBIN108/abcoder"
chmod +x "$FAKEBIN108/abcoder"
printf '#!/bin/sh\nexit 0\n' > "$FAKEBIN108/java"
chmod +x "$FAKEBIN108/java"
printf '#!/bin/sh\nif [ "$1" = "version" ]; then echo "go version go1.22.0 darwin/arm64"; elif [ "$1" = "env" ]; then echo "'"$FAKE_MOD108"'"; fi\n' > "$FAKEBIN108/go"
chmod +x "$FAKEBIN108/go"
HOME="$FH108" PATH="$FAKEBIN108" bash "$VERIFY_SCRIPT" >/dev/null 2>&1
out108=$(jq -r '.jdt_cache.writable' "$FH108/.claude/spec-first/host-setup.json")
assert_output "10.8 jdt_cache.writable=true (parent-writable)" "true" "$out108"
```

**Verification:**

- verify-tools.sh 输出的 host-setup.json 包含 `language_runtime` 和 `jdt_cache` 字段
- Go/Python/Java 运行时检测正确（有/无）
- JDT 缓存可写性检测正确（abcoder 未安装时为 not-applicable）
- host-setup.json version 升级到 "2"
- 旧字段（tools, java_runtime）保持不变（向后兼容）
- mcp-setup SKILL.md 包含 Phase 4.3 章节
- 新增测试 10.1-10.6 全部通过
- `bash tests/unit/mcp-setup.sh` 全量通过

---

### Unit 2 (P0): spec-bootstrap — ABCoder probe 重构

**Goal:** 重构 ABCoder probe 为"语言匹配优先"模式，消除 npx 幻觉，消费 host-setup.json 实现提前预警。

**Requirements:** R3, R4, R6

**Dependencies:** Unit 1（需要 host-setup.json v2 schema）

**Files:**

- Modify: `skills/spec-bootstrap/SKILL.md`
- Modify: `CHANGELOG.md`

#### Step 1: ABCoder probe Step 2 重构 — Language Match First

替换当前 Step 2（仅 Java preflight）为通用语言匹配：

**当前 Step 2（删除）：**

```markdown
Step 2 (if list_repos empty): Language preflight for Java projects
  - java -version accessible?
  - JAVA_HOME resolvable?
  - JDT cache directory writable?
  - (Optional) JDT download source network reachable?
  - Any failure → abcoder.ready=false, record reason
```

**新 Step 2（替换）：**

```markdown
Step 2 (if list_repos empty): Language Match First

  2a. Detect primary language (scan file extensions in project root):
  - `.go` → `go`, `.py` → `python`, `.java` → `java`
  - `.kt` → `kotlin`, `.swift` → `swift`, `.rs` → `rust`, `.ts/.tsx` → `typescript`, `.js/.jsx` → `javascript`
  - `.rb` → `ruby`, `.cs` → `csharp`, `.cpp/.cxx` → `cpp`
  - Pick the language with the most source files

  2b. Check language against ABCoder support matrix:
  - **ABCoder supports:** Go, Java, Python (v0.3.1)
  - If primary language NOT in support matrix → `abcoder.ready=false`, `reason=language-not-supported:<lang>`, skip Steps 3-4
  - Report: "ABCoder: skipped (项目语言 <lang> 不在支持列表: Go, Java, Python)"

  2c. For supported languages, check host-setup.json for pre-known issues:
  - Read `~/.claude/spec-first/host-setup.json`:
    - `language_runtime.<lang>.present` — runtime 是否已安装
    - For Java: `jdt_cache.writable` — JDT 缓存是否可写
  - If Go or Python AND runtime missing → **informational warning only**（ABCoder 内置 gopls/pyright，不依赖系统 runtime，probe 继续执行）
  - If Java AND runtime missing → `abcoder.ready=false`, `reason=java-runtime-missing`
  - If Java AND `jdt_cache.writable == false`:
    - Output warning to user with fix command
    - `abcoder.ready=false`, `reason=jdt-cache-not-writable`
  - If all checks pass → proceed to Step 3
```

**收益：**
- Kotlin/Swift/Rust/C++/Ruby 等语言直接跳过 ABCoder probe（节省 ~60s）
- Go/Python runtime 信息写入 host-setup.json 供诊断，不阻断 probe（ABCoder 内置 gopls/pyright）
- Java 项目消费 host-setup.json 的 JDT 缓存状态，避免重复检测

#### Step 2: Step 3a 移除（语言检测已在 Step 2a 完成）

当前 Step 3a（Detect primary language）已移入 Step 2a，删除 Step 3 中的 3a 子步骤。

Step 3 重命名为 "Trigger parse for supported languages"，仅保留 3b（重编号为 Step 3）：

```markdown
Step 3: Trigger parse, wait ≤ 60s (outer timer)

  **重要：ABCoder 是 Go 二进制文件，不是 npm 包。**
  - 正确命令：`abcoder parse <language> <project-root>`
  - 禁止使用：`npx abcoder ...`（npm 上不存在此包）
  - 禁止使用：`abcoder parse <language> <project-root> -o <dir>`（ABCoder MCP server 从内部存储读取）

  - Timeout → `abcoder.ready=false`, `reason=parse-timeout`
  - Parse failure → `abcoder.ready=false`, `reason=parse-failed`
  - Java JDT cold-start 可能超过 60s → inform user to retry
```

#### Step 3: Host Readiness Gate JDT 预警

在 Host Readiness Gate Step 2（MCP runtime probe）之后追加 JDT 预警子步骤：

```markdown
### Step 2b: JDT Cache Warning (after MCP runtime probe succeeds)

If `~/.claude/spec-first/host-setup.json` exists and `jdt_cache.writable == false`:

Output to user:
```
⚠️ ABCoder JDT 缓存目录不可写（Java 项目将受影响）。

检测到 jdt_cache.reason: <reason>
路径: <jdt_cache.path>

修复方法：
  chmod -R u+w <jdt_cache.path 的父目录>

或重新运行 /spec:mcp-setup，Phase 4.3 会自动修复。
```

This is a non-blocking warning. Bootstrap continues.
If the project is not Java, this warning is informational only.
```

**注意：** 此预警不阻断 bootstrap 流程。它仅在 Step 2（MCP probe）成功后显示，作为 Phase 1.3 ABCoder probe 的补充预警。

#### Step 4: Report 格式更新

ABCoder probe 报告新增 language-not-supported 场景：

```markdown
ABCoder:  ready=no,  reason=language-not-supported:kotlin
          (项目语言 kotlin 不在 ABCoder 支持列表: Go, Java, Python。Serena 将作为主要分析工具。)
```

**Verification:**

- SKILL.md ABCoder probe Step 2 重构为 Language Match First
- Step 3 不再包含语言检测（已在 Step 2a）
- Step 3 包含"Go binary, 禁止 npx"显式标注
- Host Readiness Gate 包含 JDT 缓存预警子步骤
- Kotlin/Swift/Rust 项目 ABCoder probe 被跳过，报告 language-not-supported
- Go/Python/Java 项目 ABCoder probe 正常执行

---

### Unit 3 (P1): 跨 skill 协调强化

**Goal:** 确保 host-setup.json 作为 mcp-setup 和 spec-bootstrap 之间的唯一协调数据源，schema 稳定且文档完整。

**Requirements:** R5

**Dependencies:** Unit 1 + Unit 2

**Files:**

- Modify: `skills/mcp-setup/SKILL.md`（Verification 章节更新）
- Modify: `skills/spec-bootstrap/SKILL.md`（Host Readiness Gate Step 1 增强）
- Modify: `CHANGELOG.md`

#### Step 1: host-setup.json v2 schema 文档化

在 mcp-setup SKILL.md 的 Verification 章节之后新增 Appendix：

```markdown
## Appendix: host-setup.json Schema

`~/.claude/spec-first/host-setup.json` 是 mcp-setup 和 spec-bootstrap 之间的协调数据文件。

### Schema v2

```json
{
  "version": "2",
  "completed_at": "2026-04-03T12:00:00Z",
  "setup_success": true,
  "tools": {
    "abcoder":  { "installed": true,  "binary_ok": true },
    "gitnexus": { "configured": true },
    "serena":   { "configured": true },
    "context7": { "configured": true }
  },
  "java_runtime": { "present": true, "reason": "ok" },
  "language_runtime": {
    "go":     { "present": true,  "reason": "ok", "version": "go1.22.0" },
    "python": { "present": true,  "reason": "ok", "version": "3.12.0" }
  },
  "jdt_cache": {
    "writable": true,
    "path": "/Users/xxx/go/pkg/mod/github.com/cloudwego/abcoder@v0.3.1/lang/java/lsp/jdtls",
    "reason": "writable"
  }
}
```

### 消费方

| 字段 | 消费方 | 用途 |
|------|--------|------|
| `setup_success` | spec-bootstrap Host Readiness Gate Step 1 | 判断 mcp-setup 是否已完成 |
| `tools.*.configured` | spec-bootstrap Phase 1.3 probe | 跳过已知不可用的工具 |
| `java_runtime.present` | spec-bootstrap ABCoder probe Step 2c | Java runtime 预检 |
| `language_runtime.*` | spec-bootstrap ABCoder probe Step 2c | 语言 runtime 预检 |
| `jdt_cache.writable` | spec-bootstrap Host Readiness Gate Step 2b + ABCoder probe Step 2c | JDT 缓存预警 |
| `jdt_cache.reason` | mcp-setup Phase 4.3 | JDT 修复诊断 |

### 向后兼容

- v1 字段（`version`, `setup_success`, `tools`, `java_runtime`）保持不变
- v2 新增字段（`language_runtime`, `jdt_cache`）对 v1 消费方透明
- spec-bootstrap 应容忍 v1 格式（缺少新字段时使用默认值）
```

#### Step 2: spec-bootstrap Host Readiness Gate Step 1 增强

在 Step 1 的 `setup_success == true` 分支中追加 host-setup.json version 检查：

```markdown
- **文件存在且 `setup_success == true`** → Check schema version:
  - `version == "2"` → Full capability (language_runtime + jdt_cache available)
  - `version == "1"` or absent → Legacy mode (language/JDT info not available, ABCoder probe will self-detect)
  - Either way → Continue to Step 2.
```

**注意：** 这不是阻断条件。旧版 host-setup.json 仍然通过 Host Readiness Gate，只是 ABCoder probe Step 2c 需要自行检测语言 runtime 和 JDT 缓存状态。

**Verification:**

- mcp-setup SKILL.md 包含 host-setup.json v2 schema 文档
- schema 文档列出所有字段、消费方和向后兼容策略
- spec-bootstrap Host Readiness Gate Step 1 包含 version 检查逻辑
- 旧版 host-setup.json（v1）不会阻断 bootstrap 流程

---

## System-Wide Impact

| 维度 | 影响 |
|------|------|
| host-setup.json schema | v1 → v2（新增字段，向后兼容） |
| verify-tools.sh | 检测能力扩展（+Go/Python runtime, +JDT cache） |
| mcp-setup 执行时间 | Phase 4.3 新增 ≤ 30s（仅 Java + abcoder 场景） |
| spec-bootstrap 执行时间 | 非支持语言节省 ~60s（跳过 ABCoder probe） |
| 模式选择准确性 | 提高（避免因已知问题尝试注定失败的 probe） |
| 用户感知 | Java 项目：修复 JDT 缓存后可进入 Full 模式；非支持语言：不再等待无意义超时 |

## Risks & Dependencies

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| JDT 缓存路径在不同 Go 版本/OS 下不同 | Medium | Low | verify-tools.sh 使用 `go env GOMODCACHE` 动态获取路径 |
| ABCoder v0.4+ 修复 JDT bug 导致 chmod 多余 | Low | None | chmod 是幂等操作，不造成副作用 |
| host-setup.json v1 消费方不支持新字段 | None | None | 新字段为新增，v1 消费方忽略未知字段 |
| verify-tools.sh 复杂度增加 | Medium | Medium | 保持纯检测原则，修复逻辑在 SKILL.md Phase 4.3 |
| `ls -d` glob 无匹配时返回非零 | Low | None | `2>/dev/null \|\| true` 已处理；macOS/Linux 行为一致 |

## Sync Protocol

每个 Unit 完成后：

```bash
# 同步到 .claude/ 运行时副本
cp skills/mcp-setup/SKILL.md .claude/skills/mcp-setup/SKILL.md
cp skills/mcp-setup/scripts/verify-tools.sh .claude/skills/mcp-setup/scripts/verify-tools.sh
cp skills/spec-bootstrap/SKILL.md .claude/skills/spec-bootstrap/SKILL.md

# 或使用 init（推荐）
node src/cli/index.js init --claude

# 验证同步
diff skills/mcp-setup/scripts/verify-tools.sh .claude/skills/mcp-setup/scripts/verify-tools.sh
```

## Execution Order

```
Unit 1 (mcp-setup: verify-tools.sh + Phase 4.3)
  ↓
Unit 2 (spec-bootstrap: ABCoder probe 重构)  ← 依赖 Unit 1 的 host-setup.json v2
  ↓
Unit 3 (跨 skill 协调: schema 文档 + version 检查)  ← 依赖 Unit 1 + Unit 2
```

Unit 1 和 Unit 2 可以在确认 schema 后并行开发，Unit 3 最后收尾。

## Documentation / Operational Notes

- CHANGELOG.md 每个 Unit 追加一条，格式：`- vX.Y.Z YYYY-MM-DD HH:MM:SS kuang: 摘要 (user-visible)`
- 三个 Unit 均为用户可见变更（执行时间变化 + Java 项目可进入 Full 模式）

## Sources & References

- **故障日志:** `/Users/kuang/xiaobu/qianxi-wx-plat/2026-04-03-123413-command-messagespecbootstrapcommand-message.txt`
- **ABCoder probe 当前逻辑:** `skills/spec-bootstrap/SKILL.md:261-289`
- **verify-tools.sh 当前逻辑:** `skills/mcp-setup/scripts/verify-tools.sh`
- **host-setup.json 当前 schema:** `skills/mcp-setup/scripts/verify-tools.sh:69-89`
- **mcp-setup Phase 4:** `skills/mcp-setup/SKILL.md:166-196`
- **ABCoder 工具定义:** `skills/mcp-setup/mcp-tools.json:35-46`
