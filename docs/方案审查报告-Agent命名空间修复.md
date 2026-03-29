# 方案审查报告：Agent 命名空间修复方案

**审查日期**：2026-03-29
**审查对象**：`docs/06-待办事项/02-Agent命名空间短期优化方案.md`
**审查结论**：⚠️ 方案基本可行，但存在 6 个关键缺陷需要补充

---

## 一、方案优点

### 1. 问题定位准确
- ✅ 已通过实际调用日志验证（0 tool uses）
- ✅ 根因分析清晰：命名空间不匹配导致 agent 无法加载

### 2. 架构设计合理
- ✅ 源码层保持 canonical（spec-first:xxx）
- ✅ 生成层负责适配（转换为 xxx）
- ✅ 平台差异隔离在 adapter

### 3. 技术实现可行
- ✅ 转换逻辑简单：删除 `spec-first:` 前缀
- ✅ 幂等性良好：多次执行不会出错
- ✅ 未来可扩展：为 Codex 等平台预留空间

---

## 二、关键缺陷

### 缺陷 1：命名空间覆盖不完整 ⚠️ 严重

**问题描述**：
方案只提到 4 个命名空间，但实际有 5 个：

| 命名空间 | 方案是否覆盖 | 实际引用数 |
|---------|------------|----------|
| `spec-first:research:` | ✅ 是 | 20+ |
| `spec-first:review:` | ✅ 是 | 40+ |
| `spec-first:workflow:` | ✅ 是 | 6+ |
| `spec-first:design:` | ✅ 是 | 2+ |
| `spec-first:document-review:` | ❌ **遗漏** | 7 |

**影响**：document-review 相关的 agent 仍然无法被调用

**修复建议**：转换规则中增加 `spec-first:document-review:` → `document-review:`

---

### 缺陷 2：增量更新场景未考虑 ⚠️ 中等

**问题描述**：
用户已执行过 `init --claude`，后续升级 CLI 版本后，旧的 `.claude/skills/` 不会自动更新。

**场景**：
```bash
# 用户使用旧版本
npm install -g spec-first@1.0.0
spec-first init --claude  # 生成了有问题的文件

# 升级到新版本
npm install -g spec-first@1.1.0
# 此时 .claude/skills/ 仍是旧版本，仍有 spec-first: 前缀
```

**修复建议**：
1. `init --claude` 增加 `--force` 选项强制覆盖
2. `doctor` 检测到版本不一致时提示重新 init
3. 提供 `spec-first upgrade` 命令原地更新

---

### 缺陷 3：doctor 缺少自动修复能力 ⚠️ 中等

**问题描述**：
方案中 `doctor` 只能检测问题，不能自动修复。用户仍需手动执行 `init --claude`。

**修复建议**：
```bash
# 检测问题
spec-first doctor

# 自动修复
spec-first doctor --fix
```

---

### 缺陷 4：转换边界定义不清晰 ⚠️ 轻微

**问题描述**：
方案提到"不要误伤 `/spec-first:*` slash command"，但实际 slash command 格式是 `/spec:xxx`。

**验证**：
```bash
grep -r "/spec-first:" .claude/skills/
# 结果：发现 5 处 slash command 使用 /spec-first: 格式
```

**实际情况**：
- lfg/SKILL.md: `/spec-first:todo-resolve`, `/spec-first:test-browser`, `/spec-first:feature-video`
- slfg/SKILL.md: `/spec-first:test-browser`, `/spec-first:todo-resolve`

**问题**：这些是 slash command 还是 agent 引用？需要明确区分。

**修复建议**：
1. 明确转换规则：只转换 agent type 引用（如 `subagent_type: "spec-first:xxx"`）
2. 保留 slash command 格式（如 `/spec-first:xxx`）
3. 或统一 slash command 为 `/spec:xxx` 格式

---

### 缺陷 5：smoke test 覆盖不足 ⚠️ 中等

**问题描述**：
方案提出的测试用例只覆盖了"转换后无残留"，未覆盖：
- 转换前后功能对比
- 各个命名空间的 agent 是否都能正常调用
- 错误场景处理（如 agent 文件不存在）

**修复建议**：
补充测试用例：
```bash
# 测试 1：所有命名空间的 agent 都能调用
for ns in research review workflow design document-review; do
  # 调用该命名空间的一个 agent，验证 tool uses > 0
done

# 测试 2：转换幂等性
spec-first init --claude
spec-first init --claude  # 再次执行
# 验证结果一致

# 测试 3：版本升级场景
# 模拟旧版本 -> 新版本升级
```

---

### 缺陷 6：文档同步风险 ⚠️ 轻微

**问题描述**：
方案要求更新 3 个文档，但未明确更新内容和顺序，容易导致文档不一致。

**需要更新的文档**：
1. `docs/Agent命名空间错误修复指南.md` - 需要说明这是运行态问题，不是源码问题
2. `docs/02-架构设计/02-目录结构.md` - 需要说明源码层 vs 运行态层的区别
3. `docs/05-用户手册/06-本地源码安装.md` - 需要说明 init 会自动转换

**修复建议**：
在方案中明确每个文档的具体修改点，避免遗漏。

---

## 三、补充建议

### 1. 增加转换日志
```bash
spec-first init --claude
# 输出：
# ✓ 转换 spec-first:research: -> research: (20 处)
# ✓ 转换 spec-first:review: -> review: (40 处)
# ✓ 转换 spec-first:workflow: -> workflow: (6 处)
# ✓ 转换 spec-first:design: -> design: (2 处)
# ✓ 转换 spec-first:document-review: -> document-review: (7 处)
```

### 2. 增加回滚机制
```bash
spec-first init --claude --backup
# 自动备份到 .claude.backup/
# 如果出问题可以回滚
```

### 3. 提供诊断命令
```bash
spec-first diagnose agents
# 输出：
# ✓ research:repo-research-analyst - 文件存在，名称正确
# ✗ spec-first:research:learnings-researcher - 命名空间错误
```

---

## 四、修复优先级

### P0 - 必须修复（阻塞发布）
1. ✅ 补充 document-review 命名空间转换
2. ✅ 明确 slash command vs agent 引用的转换规则

### P1 - 应该修复（影响用户体验）
3. ✅ 增加 doctor --fix 自动修复
4. ✅ 处理增量更新场景

### P2 - 可以延后（优化项）
5. ⚪ 补充完整的 smoke test
6. ⚪ 文档同步检查清单

---

## 五、修订后的转换规则

### 完整的命名空间列表
```javascript
const NAMESPACE_MAPPINGS = {
  'spec-first:research:': 'research:',
  'spec-first:review:': 'review:',
  'spec-first:workflow:': 'workflow:',
  'spec-first:design:': 'design:',
  'spec-first:document-review:': 'document-review:',
};
```

### 转换规则
1. **转换对象**：agent type 引用
   - `subagent_type: "spec-first:xxx"`
   - `Task spec-first:xxx`
   - `Spawn spec-first:xxx`
   - 表格中的 agent 名称

2. **不转换对象**：
   - Slash command：`/spec-first:xxx` → 需要单独评估
   - 文档说明中的示例代码
   - 注释中的历史记录

---

## 六、总体评估

| 维度 | 评分 | 说明 |
|-----|------|------|
| 问题定位 | ⭐⭐⭐⭐⭐ | 准确，有实证 |
| 架构设计 | ⭐⭐⭐⭐⭐ | 合理，可扩展 |
| 实现完整性 | ⭐⭐⭐ | 遗漏 document-review |
| 边界处理 | ⭐⭐⭐ | slash command 未明确 |
| 测试覆盖 | ⭐⭐ | 测试用例不足 |
| 文档质量 | ⭐⭐⭐⭐ | 清晰，但需补充细节 |

**综合评分**：⭐⭐⭐⭐ (4/5)

**结论**：方案整体可行，但需要补充 P0 和 P1 的修复项才能彻底解决问题。

---

**审查人**：代码审查系统
**建议**：补充缺陷修复后再实施

