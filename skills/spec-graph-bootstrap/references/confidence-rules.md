# 置信度与严重度规则

## 置信度分级

### Observed（确定性来源）

- `crg flows`/`crg communities`/`crg community` 直接返回的 AST 节点
- `crg large-functions`/`crg impact` 统计数据
- `Read(package.json/go.mod)` 等元文件

### Inferred（推断性来源，必须附 `inference_reason`）

**CRG Tier（Full 模式）：**
- `crg query`（CLI 内部固定输出 Inferred）→ `"crg-importers-evidence"` / `"crg-dependents-evidence"` / `"crg-tests-for-evidence"`
- `crg search` 节点的 kind 分类 → `"crg-semantic-search-evidence"`
- `crg impact` / `crg large-functions` → `"crg-blast-radius-threshold"` / `"crg-large-function-heuristic"`

**Serena Tier（Enhanced 模式）：**
- Serena 模式搜索 → `"serena-pattern-match"`
- Serena symbol 定位 → `"serena-symbol-evidence"`

**Built-in Tier（所有模式均可作 fallback）：**
- 路径/目录命名模式 → `"directory-naming-pattern"`
- 文件路径中的 test_kind 分类 → `"path-naming-pattern"`
- Grep import 推断 → `"grep-import-pattern"`
- Read 工具直接读取源码推断 → `"read-source-code"`
- package.json / go.mod / pom.xml 依赖字段推断 → `"package-json-analysis"`
- Glob 文件发现 → `"glob-pattern-match"`

## 约束

1. `inference_reason` 必须使用上述枚举值之一，不得使用自由描述性文字（如 `"direct-code-reading"`）
2. `crg query` 全系列固定输出 `Inferred`
3. 单条 `inferred` 事实不得触发 `high` severity，除非 ≥2 个独立信号支持
4. `crg query` 的 `--symbol`/`--module`/`--subject` 须为**节点 ID 字符串**（symbol_key 格式：`<file_path>#<kind>#<name>#L<line_start>`），不接受裸名称
5. `crg search` 底层 FTS5：多词须各自独立调用，空格=短语匹配（phrase），不支持多词 OR

## 降级链路

```
Full (CRG CLI)       crg.indexed=false
confidence: high ──→  Enhanced (Serena)      serena.ready=false
severity: 无上限       confidence: medium ──→  Basic (Built-in)
                      severity 上限: medium    confidence: low
                                              severity 上限: medium
```

降级规则：
- 降级事件写入 `generation_errors[]`
- `analyzer_mode` 字段记录最终模式
- `README.md` Freshness 章节体现降级原因

**Enhanced/Basic 模式 severity 约束**：
- 单一信号命中 → `medium`
- ≥2 个独立信号同时命中 → `high` 可用
