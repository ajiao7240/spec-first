# docs/contexts 版本控制策略

`docs/contexts/` 用于承载 `spec-graph-bootstrap` 生成的项目级上下文产物。

当前仓库中，`docs/contexts/spec-first/` 已被明确作为首个受控样本上下文，不再只被视为一次性的本地生成物，而是承担以下角色：

- `spec-first` 仓库自身的 Stage-0 样本上下文
- 阶段 3B 的 yaml 路由与消费契约示例
- 自动化测试与人工验收的稳定输入基线

当前 git 策略与约束如下：

- `docs/contexts/` 目录不再被 `.gitignore` 屏蔽，可按需要纳入版本控制
- `docs/contexts/spec-first/` 是当前仓库的 canonical 样本与测试基线，应长期受控
- 其他 `docs/contexts/<slug>/` 是否提交，由变更评审决定；如果只是临时本地生成物，不应随手入库

如果未来把其他项目的上下文也作为 fixture、回归输入或受控样本纳入版本控制，应在提交时显式说明其用途与维护边界，避免把一次性运行时产物和长期样本混在一起。
