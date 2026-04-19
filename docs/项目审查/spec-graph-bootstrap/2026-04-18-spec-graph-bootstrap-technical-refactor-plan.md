# `spec-graph-bootstrap` 技术改造方案

日期：`2026-04-18`  
状态：`方案设计，待进入实施`

---

## 问题

当 `factInventory` 数据稀薄或为空时，渲染出来的文档是空列表，但 manifest 仍显示 `status: complete`，evaluator 给出 L0，下游以高信任度消费了空文件。

具体表现：

**1. `status: complete` 无法区分"数据充分"和"数据为空"**

`compile-human-assets.js:41-48` 的 `renderModuleMap`：

```js
function renderModuleMap({ factInventory }) {
  const modules = Array.isArray(factInventory?.modules) ? factInventory.modules : [];
  return ['# Module Map', '', ...modules.map((item) => `- ${item.path}`), ''].join('\n');
}
```

当 `factInventory.modules` 为空时，输出是 `# Module Map\n\n`。但 manifest 的 `status` 仍是 `complete`。

**2. evaluator L0 不区分内容质量**

`evaluator.js:132`：

```js
let level = minimalContextMissing ? 'L1' : 'L0';
```

文件存在即 L0，不管内容是否有意义。

**3. minimal-context 没有 provenance 信号**

`compile-minimal-context.js` 产出的 plan/work/review.json 没有"这些信息是否来自真实分析"的元信号，下游 spec-plan/work/review 无法感知数据质量。

---

## 改动 1：`artifact-manifest` 加 `data_quality` 字段

**位置**：`src/bootstrap-compiler/compile-routing.js`，`buildArtifactManifest` 函数

```js
const dataQuality =
  modules.length > 0 && entrypoints.length > 0 ? 'fact-backed' :
  modules.length > 0 || entrypoints.length > 0 ? 'partial'     : 'empty';

return {
  // ...原有字段...
  data_quality: dataQuality,
};
```

| 值 | 触发条件 |
|---|---|
| `fact-backed` | modules > 0 且 entrypoints > 0 |
| `partial` | modules 或 entrypoints 之一有数据 |
| `empty` | 均为空 |

---

## 改动 2：`evaluator.js` L0 加内容非空门控

**位置**：`src/context-routing/evaluator.js:132`

```js
// 改动前
let level = minimalContextMissing ? 'L1' : 'L0';
let fallbackReason = minimalContextMissing ? 'minimal_context_missing' : null;

// 改动后
const qualitySufficient = (manifest.data_quality ?? 'empty') !== 'empty';

let level = minimalContextMissing ? 'L1' :
            !qualitySufficient    ? 'L1' : 'L0';
let fallbackReason = minimalContextMissing ? 'minimal_context_missing' :
                     !qualitySufficient    ? 'empty_fact_inventory'    : null;
```

---

## 改动 3：`minimal-context` 加 `provenance` 和 `confidence`

**位置**：`src/bootstrap-compiler/compile-minimal-context.js`

```js
function deriveContextMeta(factInventory, testSurface) {
  const moduleCount = Array.isArray(factInventory?.modules)     ? factInventory.modules.length    : 0;
  const testCount   = Array.isArray(testSurface?.test_files)    ? testSurface.test_files.length   : 0;
  return {
    provenance: moduleCount > 0 ? 'fact-inventory' : 'empty-fallback',
    confidence: moduleCount > 0 && testCount > 0 ? 'high'   :
                moduleCount > 0                  ? 'medium' : 'low',
  };
}
```

plan/work/review 三个 context 的构建函数各自追加 `...deriveContextMeta(factInventory, testSurface)`。

---

## 验收标准

- 传入空 factInventory 时，manifest `data_quality` 为 `'empty'`，evaluator 返回 L1
- 传入有真实 modules + entrypoints 的 factInventory 时，`data_quality` 为 `'fact-backed'`，L0 行为与改动前一致
- plan/work/review.json 顶层出现 `provenance` 和 `confidence` 字段
- 现有 contract tests 全部通过，新增三处字段断言
