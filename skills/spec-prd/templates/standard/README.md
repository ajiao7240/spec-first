---
doc_role: packaged-template-index
artifact_kind: prd-template-guide
status: active
created: 2026-05-31
author: reviewer
---

# Standard PRD Templates

本目录是随 `spec-prd` workflow assets 打包分发的通用增量 PRD 模板集。打包后的运行时必须只依赖本目录即可加载模板；不要依赖仓库内 `docs/需求文档模版/标准模版/` 路径。

`docs/需求文档模版/标准模版/` 在本仓库保留为 human-facing mirror、设计种子和项目本地行业/team overlay 示例。具体行业内容不作为 packaged runtime 的默认模板。

## Template List

| 模板 | 用途 | 对应 lens |
| --- | --- | --- |
| `00-通用增量需求模板.md` | 默认通用骨架，适配所有 surface 的 80% 场景 | generic |
| `10-App客户端需求模板.md` | App/客户端增量需求 | App lens |
| `20-Admin中后台需求模板.md` | Admin/中后台增量需求 | Admin lens |
| `30-Backend中台服务需求模板.md` | 后台/中台服务增量需求 | Backend lens |

## How To Use

1. 先用 `00-通用增量需求模板.md` 建立 core PRD 骨架。
2. 按目标 surface 叠加一个或多个 surface 模板。
3. 若项目本地存在行业、团队、合规、术语或模板 overlay，只按需读取相关 section by-reference，并在 PRD 中记录 applied overlay。
4. 缺少项目本地 overlay 是正常情况；不得因此臆造行业规则。

## Core Sections

每份正常 PRD 至少包含：

- Summary
- Change Delta
- Requirements
- Acceptance Examples
- Scope Boundaries
- Evidence And Assumptions

## WHAT Not HOW

PRD 写产品行为、业务规则、范围、验收、证据和约束。不写 implementation units、接口字段设计、数据库 schema、文件改动计划或任务拆解。
