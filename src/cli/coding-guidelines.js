const fs = require('node:fs');
const path = require('node:path');

const CODING_GUIDELINES_START = '<!-- spec-first:coding-guidelines:start -->';
const CODING_GUIDELINES_END = '<!-- spec-first:coding-guidelines:end -->';

function writeCodingGuidelinesBlock(projectRoot, adapter, lang = 'zh') {
  const filePath = path.join(projectRoot, adapter.instructionFile);
  const block = buildCodingGuidelinesBlock(lang);

  let existing = '';
  if (fs.existsSync(filePath)) {
    existing = fs.readFileSync(filePath, 'utf8');
  }

  const updated = applyManagedCodingGuidelinesBlock(existing, block);
  writeAtomically(filePath, updated);
}

function inspectCodingGuidelinesBlock(projectRoot, adapter) {
  const filePath = path.join(projectRoot, adapter.instructionFile);
  if (!fs.existsSync(filePath)) {
    return {
      status: 'missing',
      message: `${adapter.instructionFile} is missing`,
    };
  }

  const existing = fs.readFileSync(filePath, 'utf8');
  const startIdx = existing.indexOf(CODING_GUIDELINES_START);
  const endIdx = existing.indexOf(CODING_GUIDELINES_END);

  if (startIdx === -1 && endIdx === -1) {
    return {
      status: 'missing',
      message: 'managed coding-guidelines block missing',
    };
  }

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return {
      status: 'partial',
      message: 'managed coding-guidelines markers are incomplete',
    };
  }

  const actual = existing.slice(startIdx, endIdx + CODING_GUIDELINES_END.length);
  const expectedBlocks = [
    buildCodingGuidelinesBlock('zh'),
    buildCodingGuidelinesBlock('en'),
  ];

  if (expectedBlocks.includes(actual)) {
    return {
      status: 'installed',
      message: 'managed coding-guidelines block present',
    };
  }

  return {
    status: 'drifted',
    message: 'managed coding-guidelines block drifted from the bundled template',
  };
}

function applyManagedCodingGuidelinesBlock(existing, block) {
  const startIdx = existing.indexOf(CODING_GUIDELINES_START);
  const endIdx = existing.indexOf(CODING_GUIDELINES_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + CODING_GUIDELINES_END.length);
    return `${before}${block}${after}`;
  }

  const corrupted = startIdx !== -1 || endIdx !== -1;
  const cleaned = corrupted
    ? stripKnownCodingGuidelinesBodies(stripStandaloneMarkerLines(existing))
    : existing;
  if (cleaned.length === 0) {
    return block;
  }

  const separator = cleaned.endsWith('\n') ? '\n' : '\n\n';
  return `${cleaned}${separator}${block}\n`;
}

function removeManagedCodingGuidelinesBlock(existing) {
  const startIdx = existing.indexOf(CODING_GUIDELINES_START);
  const endIdx = existing.indexOf(CODING_GUIDELINES_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + CODING_GUIDELINES_END.length);
    return normalizeRemovalResult(`${before}${after}`);
  }

  if (startIdx !== -1 || endIdx !== -1) {
    return normalizeRemovalResult(stripKnownCodingGuidelinesBodies(stripStandaloneMarkerLines(existing)));
  }

  return normalizeRemovalResult(existing);
}

function buildCodingGuidelinesBlock(lang = 'zh') {
  const body = lang === 'en' ? buildEnCodingGuidelinesBody() : buildZhCodingGuidelinesBody();
  return `${CODING_GUIDELINES_START}\n${body}\n${CODING_GUIDELINES_END}`;
}

function buildZhCodingGuidelinesBody() {
  return `## 编码执行准则（由 spec-first 管理）

这些准则只约束进入工作后的执行姿势，不替代 \`using-spec-first\` 的 workflow 入口治理。

### 先想清楚再动手
- 当假设会影响实现或验证时，必须先显式说明假设。
- 如果存在 2 条及以上会实质影响行为、接口、数据结构或错误语义的路径，先说明 tradeoff，再继续执行。
- 如果更简单的做法能解决当前任务，优先采用更简单的做法。
- 如果不明确之处会实质影响实现或验证，先澄清，再编码。

### 先做最小可行改动
- 只实现当前任务真正需要的最小代码。
- 不新增未被请求的功能、配置项或单次使用的抽象。
- 不为当前任务没有证据支持的失败模式添加 speculative guard 或 fallback。

### 改动要保持手术式边界
- 只修改完成当前任务所必需的文件和行为切片。
- 遵循当前文件和局部模块的既有风格与模式。
- 清理本次改动自己引入且随即失效的 unused imports / variables / functions。
- 不要在未被请求时重构、删除或顺手清理无关的既有代码。

### 用可验证目标收口
- 在 substantial work 前先明确 done signals。
- 修 bug 或改行为时，优先使用测试或其他可重复验证方式证明变更。
- 先验证目标改动，再验证相邻受影响行为。`;
}

function buildEnCodingGuidelinesBody() {
  return `## Coding Execution Guidelines (managed by spec-first)

These guidelines shape execution posture after workflow routing; they do not replace spec-first workflow entry governance.

### Think Before Coding
- State assumptions explicitly when they materially affect implementation or verification.
- If two or more materially different approaches would change behavior, API shape, data structures, or error semantics, state the tradeoffs before proceeding.
- If a simpler approach can solve the current task, prefer the simpler approach.
- If an unclear point would materially change implementation or verification, clarify it before coding.

### Implement the Minimum Necessary Change
- Implement only the minimum code the current task requires.
- Do not add unrequested features, configurability, or single-use abstractions.
- Do not add speculative guards or fallbacks for failure modes the current task does not justify.

### Keep Changes Surgical
- Touch only the files and behavior slices required for the current task.
- Follow the local style and established patterns of the file or module you are changing.
- Clean up unused imports, variables, or functions created by your own change.
- Do not refactor, delete, or opportunistically clean up unrelated existing code unless explicitly requested.

### Verify Against Concrete Goals
- Define done signals before substantial work.
- When fixing bugs or changing behavior, prefer tests or other reproducible verification.
- Verify the target change first, then verify nearby affected behavior.`;
}

function stripStandaloneMarkerLines(content) {
  return content
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed !== CODING_GUIDELINES_START && trimmed !== CODING_GUIDELINES_END;
    })
    .join('\n');
}

function stripKnownCodingGuidelinesBodies(content) {
  let next = content;
  for (const body of buildKnownCodingGuidelinesBodies()) {
    next = next
      .replace(`\n${body}\n`, '\n')
      .replace(`\n${body}`, '\n')
      .replace(`${body}\n`, '')
      .replace(body, '');
  }
  return stripManagedCodingGuidelinesSections(next);
}

function buildKnownCodingGuidelinesBodies() {
  return [
    buildZhCodingGuidelinesBody(),
    buildEnCodingGuidelinesBody(),
  ];
}

function stripManagedCodingGuidelinesSections(content) {
  const lines = content.split('\n');
  const next = [];

  for (let index = 0; index < lines.length; index += 1) {
    const skipTo = matchManagedCodingGuidelinesSection(lines, index);
    if (skipTo !== -1) {
      index = skipTo - 1;
      continue;
    }

    next.push(lines[index]);
  }

  return next.join('\n');
}

function matchManagedCodingGuidelinesSection(lines, startIndex) {
  const heading = lines[startIndex] ? lines[startIndex].trim() : '';
  if (
    heading !== '## 编码执行准则（由 spec-first 管理）' &&
    heading !== '## Coding Execution Guidelines (managed by spec-first)'
  ) {
    return -1;
  }

  const strictMatch = matchStrictManagedCodingGuidelinesSection(lines, startIndex, heading);
  if (strictMatch !== -1) {
    return strictMatch;
  }

  return matchLooseManagedCodingGuidelinesSection(lines, startIndex);
}

function matchStrictManagedCodingGuidelinesSection(lines, startIndex, heading) {
  const isZh = heading === '## 编码执行准则（由 spec-first 管理）';
  const intro = isZh
    ? '这些准则只约束进入工作后的执行姿势，不替代 `using-spec-first` 的 workflow 入口治理。'
    : 'These guidelines shape execution posture after workflow routing; they do not replace spec-first workflow entry governance.';
  const sectionHeadings = isZh
    ? ['### 先想清楚再动手', '### 先做最小可行改动', '### 改动要保持手术式边界', '### 用可验证目标收口']
    : ['### Think Before Coding', '### Implement the Minimum Necessary Change', '### Keep Changes Surgical', '### Verify Against Concrete Goals'];
  const bulletCounts = [4, 3, 4, 3];

  let index = startIndex + 1;
  if (index < lines.length && lines[index].trim() === '') {
    index += 1;
  }

  if (index >= lines.length || lines[index].trim() !== intro) {
    return -1;
  }
  index += 1;

  if (index < lines.length && lines[index].trim() === '') {
    index += 1;
  }

  for (let sectionIndex = 0; sectionIndex < sectionHeadings.length; sectionIndex += 1) {
    if (index >= lines.length || lines[index].trim() !== sectionHeadings[sectionIndex]) {
      return -1;
    }
    index += 1;

    let bulletCount = 0;
    while (index < lines.length && lines[index].trim().startsWith('- ')) {
      bulletCount += 1;
      index += 1;
    }

    if (bulletCount < bulletCounts[sectionIndex]) {
      return -1;
    }

    if (index < lines.length && lines[index].trim() === '') {
      index += 1;
    }
  }

  return index;
}

function matchLooseManagedCodingGuidelinesSection(lines, startIndex) {
  let index = startIndex + 1;

  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (trimmed.startsWith('<!-- spec-first:')) {
      break;
    }
    if (trimmed !== '' && /^(#|##)\s/.test(trimmed)) {
      break;
    }
    index += 1;
  }

  return index;
}

function normalizeRemovalResult(content) {
  return content
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '\n');
}

function writeAtomically(filePath, contents) {
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, contents, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

module.exports = {
  CODING_GUIDELINES_END,
  CODING_GUIDELINES_START,
  applyManagedCodingGuidelinesBlock,
  buildCodingGuidelinesBlock,
  inspectCodingGuidelinesBlock,
  removeManagedCodingGuidelinesBlock,
  writeCodingGuidelinesBlock,
};
