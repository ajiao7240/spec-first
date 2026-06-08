---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a88644969371398a873cabeac0a028ab_3cd83564631211f19fb15254006c9bbf
    ReservedCode1: YaGrOioWuLfaev8CylF8B5N1AGV3T7+u+b/ekOFuzvWo2k5hPBbm/zY2kZi8KlCOoPBfybAXYeiX9BlRFhSvNRiLojMpflLHPFomIclYjg/fQBqj/lKXOBZOoPPL1uMcMBFDCDyZNSj3MdkhT9dakvEJHzS9slq9O8RE9TyWr1WJ6HN7HOfELtTss9Y=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a88644969371398a873cabeac0a028ab_3cd83564631211f19fb15254006c9bbf
    ReservedCode2: YaGrOioWuLfaev8CylF8B5N1AGV3T7+u+b/ekOFuzvWo2k5hPBbm/zY2kZi8KlCOoPBfybAXYeiX9BlRFhSvNRiLojMpflLHPFomIclYjg/fQBqj/lKXOBZOoPPL1uMcMBFDCDyZNSj3MdkhT9dakvEJHzS9slq9O8RE9TyWr1WJ6HN7HOfELtTss9Y=
---

# OpenSpec + Superpowers 深度分析：大型项目 AI 编程的双层纪律

> 参考文章：[OpenSpec + Superpowers：AI 编程真正进项目的姿势](https://mp.weixin.qq.com/s/eMZeeC87nb1VvAVHF8sY4w)
> 分析日期：2026-06-08
> 前置系列：Harness Engineering → gstack×OpenSpec×Superpowers → CodeGraph → 本文

---

## 一、核心框架提炼

### 1.1 一句话定位

OpenSpec 和 Superpowers 不是互相替代的工具，而是大型项目 AI 编程的**两层纪律**：

| 层 | 工具 | 职责 | 核心产物 |
|----|------|------|---------|
| **契约层** | OpenSpec | 管"改什么、为什么改、验收标准是什么" | proposal.md / design.md / specs/ / tasks.md |
| **执行层** | Superpowers | 管"怎么拆、怎么测、怎么执行、怎么 review 到结束" | plan / TDD 循环 / subagent 执行 / code review / finish |

### 1.2 核心案例：一个"记住我"的翻车现场

文章用一个真实案例揭示了 AI 编程在大型项目中的典型失败模式：

```
需求："登录页加一个记住我"
  → Agent 十几分钟写完：session 逻辑 + cookie + checkbox + 测试
  → Code Review 暴露：
    1. token 过期时间写死 30 天，忽略租户安全策略
    2. 用户改密码后旧 cookie 仍然有效
    3. 移动端、三方登录、管理员禁用等场景未覆盖
  → 代码能跑、测试也有、页面正常——这才是最危险的
```

**核心诊断**：Agent 太会写代码了，反而把需求、设计、测试、评审这些慢变量绕过去了。它把"功能能跑"当成了"需求成立"，把"代码通过"当成了"系统正确"。

### 1.3 OpenSpec 的核心机制：从聊天语气到可审查的系统行为

OpenSpec 的关键不是 Markdown 格式，而是 **SHALL 和 Scenario 把需求从聊天语气变成了可审查的系统行为**：

```
聊天窗口里的需求 → 三天后没人敢说当时到底是什么意思
spec 里的需求     → 三个月后还能被 review、同步、归档、被新同事读到
```

一个健康的 change 目录结构：

```
openspec/
  changes/
    add-remember-me/
      proposal.md    ← 为什么改、改什么、不改什么
      design.md      ← 技术路线和取舍
      tasks.md       ← 实施清单
      specs/
        auth-session/
          spec.md    ← SHALL + Scenario 锁住验收行为
  specs/
    auth-session/
      spec.md        ← 归档后的系统规格
```

### 1.4 Superpowers 的核心机制：把 Agent 变成受约束的初级工程师

Superpowers 的基础流程：

```
brainstorming → git worktree → writing plans → subagent-driven-development
→ TDD → code review → finishing branch
```

关键原则：**每个任务 2-5 分钟可完成，带文件路径、代码边界和验证方式**。

对比两种任务粒度：

| 维度 | OpenSpec tasks.md（项目管理级） | Superpowers plan（执行级） |
|------|-------------------------------|--------------------------|
| 粒度 | "Add secret hashing and one-time display" | 拆成 3.1 失败测试 + 3.2 最小实现 |
| 文件路径 | 无 | 精确到具体文件 |
| 验证方式 | 无 | 带具体测试命令 |
| 执行顺序 | 无约束 | 先写失败测试，再写最小实现 |

### 1.5 四类失败信号

文章提出了一套**提前设计的失败检测信号**：

| 失败信号 | 表现 | 根因 |
|---------|------|------|
| 任务过大 | Agent 前 20 分钟厉害，40 分钟后自圆其说，60 分钟后没人敢合 | 上下文腐化 + 局部最优 |
| spec 漂移 | 代码实现了但 spec 没更新，下次改动时 spec 已过期 | 缺少 sync/archive 收口 |
| 职责混淆 | tasks.md 变成粗糙 todo，或 plan 替代了系统 spec | 两层边界模糊 |
| 缺少验收证据 | PR 只有 commit，没有 spec scenario 验证记录 | 缺少 PR 模板绑定 |

---

## 二、核心洞察

### 2.1 "Agent 太会写代码"悖论

这是本文最反直觉的洞察——AI 编程在大型项目中的最大风险不是 Agent 不够强，而是**它太强了，强到把慢变量绕过去了**。

传统软件开发中，需求分析、设计评审、测试用例编写这些"慢变量"天然构成了一道门槛——人写代码慢，所以有足够时间在这些环节暴露问题。Agent 把代码产出速度提升了 10 倍以上，但需求澄清、设计评审、测试覆盖这些环节的速度没有同步提升，于是"慢变量"被绕过去了。

### 2.2 两层纪律的必要性

OpenSpec 和 Superpowers 分别解决两个不同维度的问题：

| 问题维度 | 没有 OpenSpec | 没有 Superpowers |
|---------|-------------|-----------------|
| 需求可追溯 | 需求只活在聊天记录里 | 需求有 spec，但执行过程不可追溯 |
| 验收标准 | 靠感觉 review | 有 SHALL/Scenario，但不知道是否真的验证过 |
| 执行纪律 | 无 | Agent 自由发挥，任务粒度失控 |
| 长期上下文 | 三个月后只剩 commit | spec 归档了，但不知道当时怎么实现的 |

**两者缺一不可**：只有 OpenSpec 没有 Superpowers → 规格正确但执行失控；只有 Superpowers 没有 OpenSpec → 执行规范但需求漂移。

### 2.3 与 Harness Engineering 的深层联系

本文与 Harness Engineering 系列形成互补：

| Harness 原则 | OpenSpec + Superpowers 的体现 |
|-------------|------------------------------|
| 上下文胜过指令 | OpenSpec 的 spec 是持久化上下文，不是一次性 prompt |
| 规划与执行分离 | OpenSpec（规划/契约）与 Superpowers（执行）完全分离 |
| 反馈回路不可协商 | Superpowers 的 TDD + code review + finish 构成完整反馈回路 |
| 构建是为了删除 | OpenSpec 的 archive 机制——change 完成后归档，不残留临时工件 |

---

## 三、与 spec-first 的对照映射

### 3.1 全景对照

| spec-first 组件 | 对标 OpenSpec | 对标 Superpowers | 吻合度 | 差距 |
|----------------|-------------|-----------------|--------|------|
| spec-prd | proposal.md + design.md | brainstorming | 70% | 缺少 Non-Goals 显式声明、缺少 SHALL/Scenario 格式约束 |
| spec-plan | tasks.md | writing-plans | 50% | tasks 粒度是项目管理级，缺少 2-5 分钟执行级拆解 |
| spec-code-review | — | code review | 60% | 缺少 PR 模板绑定 spec scenario |
| Readiness Lens | verify | — | 40% | 缺少 completeness/correctness/coherence 三维检查 |
| — | archive | finish | 0% | **完全缺失**：没有 change 完成后的 sync/archive 收口 |
| — | — | TDD 循环 | 0% | **完全缺失**：没有强制"先写失败测试再写实现"的纪律 |
| — | — | subagent 执行 | 0% | **完全缺失**：没有小任务独立 subagent 执行机制 |

### 3.2 关键差距分析

**差距 1：spec-prd 缺少 SHALL/Scenario 格式约束（P0）**

当前 spec-prd 产出的是自然语言需求描述，缺少可机器审查的行为规格。OpenSpec 的 SHALL/Scenario 格式让 review 从"我感觉不对"变成"它违反了 Requirement X"。

**差距 2：spec-plan 的任务粒度太粗（P0）**

当前 spec-plan 的 tasks.md 是项目管理级粒度（"实现 API Key 管理"），缺少执行级拆解（文件路径 + 代码边界 + 验证命令）。这导致 Agent 执行时自由度过高，容易跑偏。

**差距 3：缺少 change 完成后的 sync/archive 收口（P1）**

spec-first 当前没有"change 生命周期"概念——需求实现了，spec 是否更新？是否归档？这导致 spec 漂移：代码在演进，spec 停留在创建时的状态。

**差距 4：缺少 TDD 执行纪律（P1）**

spec-first 的 code-review 是事后检查，Superpowers 的 TDD 是事前约束。两者互补但 spec-first 缺少事前约束层。

**差距 5：缺少 PR 模板绑定 spec + 执行证据（P2）**

当前 PR 描述是自由文本，缺少对 spec scenario 的显式引用和验证记录。

---

## 四、可操作集成建议

### 4.1 P0：spec-prd 引入 SHALL/Scenario 格式 + Non-Goals 声明

**参考 OpenSpec 的 proposal.md + spec.md 格式**。

在 spec-prd 的 Phase 2（需求细化）中增加：

```markdown
## Non-Goals（明确不改什么）
- 不改三方 OAuth 登录流程
- 不支持永久登录
- 不改变普通 session 的默认过期时间

## Requirements（SHALL + Scenario 格式）

### Requirement: Remember me session extension
The system SHALL allow password-login users to request an extended session.

#### Scenario: Extended session is created
- GIVEN a user logs in with username and password
- AND the user checks "Remember me"
- WHEN authentication succeeds
- THEN the system issues a refresh token with the tenant configured TTL
- AND records the device identifier

#### Scenario: Extended session is revoked after password change
- GIVEN a user has active remember-me tokens
- WHEN the user changes password
- THEN all remember-me tokens for that user are revoked
```

**预期效果**：
- Review 从"我感觉不安全"变成"它违反了 Requirement: API key secret visibility"
- Non-Goals 显式锁住 scope，防止 Agent 顺手做超出范围的事
- 三个月后新同事能读懂当时的设计意图

### 4.2 P0：spec-plan 增加执行级任务拆解（Plan Detail 子步骤）

**参考 Superpowers 的 writing-plans**。

在 spec-plan 的 tasks.md 之后增加 Plan Detail 子步骤，将每个项目管理级任务拆成执行级子任务：

```markdown
### Task 3: Add secret hashing and one-time display

#### 3.1: Add failing test for one-time secret visibility
- Files: `src/test/.../ApiKeyServiceTest.java`
- Steps:
  1. Create API key through service
  2. Assert returned DTO contains `plaintextSecret`
  3. Load API key again
  4. Assert detail DTO does NOT contain `plaintextSecret`
  5. Assert repository stores `secretHash`, not plaintext
- Verification: `./mvnw -Dtest=ApiKeyServiceTest#createsSecretVisibleOnlyOnce test`

#### 3.2: Implement hash-only storage
- Files: `src/main/.../ApiKeyService.java`, `src/main/.../ApiKeyEntity.java`
- Steps:
  1. Generate random secret
  2. Store hash and prefix
  3. Return plaintext only from create method
  4. Never expose plaintext in detail/list methods
- Verification: Run Task 3.1 test and full `ApiKeyServiceTest`
```

**关键约束**：每个子任务 2-5 分钟可完成，带文件路径、代码边界和验证命令。

### 4.3 P1：引入 Change Lifecycle（sync + archive 收口）

**参考 OpenSpec 的 apply → verify → archive 工作流**。

在 spec-first 中增加 Change Lifecycle 管理：

```
spec change 生命周期：
  propose → explore → plan → implement → verify → sync → archive

新增阶段：
  verify: 从 completeness/correctness/coherence 三维检查实现与工件一致性
  sync:   将 change 中的 spec delta 合并回主 specs/
  archive: 将完成的 change 移入 archive/，保留完整上下文
```

**verify 检查维度**：

| 维度 | 检查内容 |
|------|---------|
| completeness | 所有 tasks 是否完成？所有 scenarios 是否有对应测试？ |
| correctness | 实现是否满足 SHALL 约束？是否有违反 Non-Goals 的代码？ |
| coherence | spec 与代码是否一致？design.md 的假设是否仍然成立？ |

### 4.4 P1：spec-code-review 增加 TDD 前置检查

**参考 Superpowers 的 TDD 循环**。

在 spec-code-review 的 Stage 1（提交前检查）中增加：

```
Stage 1.5 TDD Gate:
- 每个业务逻辑变更是否有对应的失败测试先于实现提交？
- 测试是否覆盖了 spec 中所有 Scenario？
- 如果没有 → 拒绝进入 Stage 2，要求补充测试
```

### 4.5 P2：PR 模板绑定 spec + 执行证据

**参考文章的 PR 模板设计**。

为 spec-first 项目设计标准 PR 模板：

```markdown
## Spec Change
- Change ID: [add-organization-api-keys]
- Specs touched: [api-key-management], [audit-log]

## Scenarios Verified
- [ ] Secret is visible once
- [ ] Secret cannot be retrieved later
- [ ] Revoked key cannot authenticate
- [ ] API key creation emits audit event

## Execution Evidence
- [ ] All plan tasks completed
- [ ] Red/green tests included
- [ ] Code review issues resolved
- [ ] Final verification: `./mvnw test`

## Spec Lifecycle
- [ ] verify passed (completeness/correctness/coherence)
- [ ] sync completed
- [ ] archive ready
```

---

## 五、知识链收束

本系列已分析的五篇文章形成了一条完整的 AI 工程纪律演进链：

```
Harness Engineering（轮次 43）
  └─ 引入：Agent = Model + Harness，上下文胜过指令
  └─ 产出：Harness 全景映射 + 衰减检测机制

gstack × OpenSpec × Superpowers（轮次 44）
  └─ 引入：流程层/规范层/纪律层三层分工
  └─ 产出：spec-prd Value Reframe + spec-plan test-matrix

CodeGraph（轮次 45）
  └─ 引入：上下文工程 > 提示词工程，预索引图谱替代实时探索
  └─ 产出：spec-graph-bootstrap 自动保鲜 + MCP 化

OpenSpec + Superpowers 实战（本文）
  └─ 引入：契约层 + 执行层双层纪律，SHALL/Scenario 锁住验收行为
  └─ 产出：spec-prd SHALL 格式 + spec-plan 执行级拆解 + Change Lifecycle
```

五篇文章的深层联系：

| 主题 | 核心机制 | 对 spec-first 的启示 |
|------|---------|-------------------|
| Harness Engineering | 环境约束 > 模型能力 | 所有机制需要可移除性设计 |
| gstack 三层 | 角色分离 + 阶段门禁 | 需求阶段需要价值重定义 |
| CodeGraph | 预索引图谱 > 实时探索 | 代码理解需要预建索引 |
| **OpenSpec + Superpowers** | **契约层 + 执行层双层纪律** | **需求需要 SHALL/Scenario 锁住，执行需要 2-5 分钟粒度拆解** |

最后一条补上了此前系列缺失的关键维度——**执行纪律**。spec-first 的 harness 体系当前聚焦于"流程约束"（Phase 门禁、Readiness Lens）和"规范约束"（spec.md 格式、evidence tags），但缺少"执行约束"——即如何确保 Agent 在实现过程中不跑偏、不跳步、不把"能跑"当成"正确"。OpenSpec + Superpowers 的双层模型正好补上了这一块。

---

## 附录：OpenSpec + Superpowers 7 步落地路线图

| 步骤 | 动作 | 关键产出 |
|------|------|---------|
| 1 | 初始化 OpenSpec | 约定：所有跨模块需求必须有 OpenSpec change |
| 2 | 安装 Superpowers | 约定：review 发现 critical issue 必须停下来修 |
| 3 | 为一个 change 写四件套 | proposal.md + design.md + specs/ + tasks.md |
| 4 | Superpowers 生成执行计划 | 每个任务 2-5 分钟、带文件路径、带验证命令 |
| 5 | 按任务推进，不自由漫游 | 每任务结束检查：测试通过？scope 未超出？新事实需回写？ |
| 6 | PR 绑定 spec + 执行证据 | PR 描述引用 change id + scenarios + 验证命令 |
| 7 | sync + archive | verify → sync → archive，长期上下文不丢失 |
*（内容由AI生成，仅供参考）*
