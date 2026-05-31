---
name: s2-07-work-outline
description: 第二季第 7 篇大纲：work——让 AI 真正执行任务的五个关键控制点
metadata:
  type: article-outline
  series: s2
  series_index: "s2-07"
---

# Spec-First：AI 做着做着就偏了？五个控制点让它回到正轨

**状态：** 大纲
**内容类型：** 机制篇
**Harness 坐标：** Execution Harness（受控执行）

## 核心论点

work 不是"让 AI 自由发挥"，而是在 plan 边界内的受控执行。五个关键控制点：scope 验证、task identity 传递、vertical tracer bullet、review gate、handoff evidence。

## Evidence Ticket

- 本地证据：`skills/spec-work/SKILL.md`（Context Orientation Anchor、intake order、closeout）
- 本地证据：`docs/contracts/context-bundle.md`
- 本地证据：`docs/contracts/context-governance.md`
- 官网证据：`/Users/kuang/xiaobu/spec-first-official-website/website/docs/guide/work-guide.md`
- 回流资产：Work 执行控制点卡

## 大纲

### 1. 开场：为什么 AI 做着做着就变成了另一个任务

### 2. work 的输入：plan / task pack / bare prompt 三种模式

### 3. 控制点一：scope 验证——任务开始前确认边界

### 4. 控制点二：task identity——spec_id / source_plan_hash 防止过期链路

### 5. 控制点三：vertical tracer bullet——先关闭一个行为，再扩展

### 6. 控制点四：review gate——内置的质量检查点

### 7. 控制点五：handoff evidence——任务结束时留下可被下游消费的证据

### 8. scope 扩张时如何停止

### 9. 本篇小结：受控执行比快速执行更重要

## 可带走的判断

work 开始前先问：scope 清楚吗？task identity 可验证吗？完成信号是什么？
