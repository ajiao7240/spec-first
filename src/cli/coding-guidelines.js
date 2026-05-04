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

### 1. 编码前思考

**不要假设。不要隐藏困惑。呈现权衡。**

LLM 经常默默选择一种解释然后执行。这个原则强制明确推理：

- 明确说明假设：如果不确定，询问而不是猜测。
- 呈现多种解释：当存在歧义时，不要默默选择。
- 适时提出异议：如果存在更简单的方法，说出来。
- 困惑时停下来：指出不清楚的地方并要求澄清。

### 2. 简洁优先

**用最少的代码解决问题。不要过度推测。**

对抗过度工程的倾向：

- 不要添加要求之外的功能。
- 不要为一次性代码创建抽象。
- 不要添加未要求的“灵活性”或“可配置性”。
- 不要为不可能发生的场景做错误处理。
- 如果 200 行代码可以写成 50 行，重写它。

检验标准：资深工程师会觉得这过于复杂吗？如果是，简化。

### 3. 精准修改

**只碰必须碰的。只清理自己造成的混乱。**

编辑已有代码时：
- 不要“改进”相邻的代码、注释或格式。
- 不要重构没坏的东西。
- 匹配现有风格，即使你更倾向于不同的写法。
- 如果注意到无关的死代码，提一下，不要删除它。

当你的改动产生孤儿代码时：
- 删除因你的改动而变得无用的导入 / 变量 / 函数。
- 不要删除预先存在的死代码，除非被要求。

检验标准：每一行修改都应该能直接追溯到用户的请求。

### 4. 目标驱动执行

**定义成功标准。循环直到验证通过。**

将指令式任务转化为可验证的目标：

- “添加验证” → “为无效输入编写测试，然后让它们通过”
- “修复 bug” → “编写重现 bug 的测试，然后让它通过”
- “重构 X” → “确保重构前后测试都能通过”

对于多步骤任务，说明一个简短的计划：
\`\`\`
1. [步骤] → 验证: [检查]
2. [步骤] → 验证: [检查]
3. [步骤] → 验证: [检查]
\`\`\`

强有力的成功标准让 LLM 能够独立循环执行。弱标准（“让它工作”）需要不断澄清。`;
}

function buildEnCodingGuidelinesBody() {
  return `## Coding Execution Guidelines (managed by spec-first)

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
\`\`\`
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
\`\`\`

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.`;
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
    ? '### 1. 编码前思考'
    : 'Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.';
  const sectionHeadings = isZh
    ? ['### 1. 编码前思考', '### 2. 简洁优先', '### 3. 精准修改', '### 4. 目标驱动执行']
    : ['### 1. Think Before Coding', '### 2. Simplicity First', '### 3. Surgical Changes', '### 4. Goal-Driven Execution'];
  const bulletCounts = [4, 5, 4, 3];

  let index = startIndex + 1;
  if (index < lines.length && lines[index].trim() === '') {
    index += 1;
  }

  if (index >= lines.length) {
    return -1;
  }

  if (isZh && lines[index].trim() === intro) {
    return matchStrictManagedCodingGuidelinesSections(lines, index, sectionHeadings, bulletCounts);
  }

  if (lines[index].trim() !== intro) {
    return -1;
  }
  index += 1;

  while (index < lines.length && lines[index].trim() !== sectionHeadings[0]) {
    index += 1;
  }

  return matchStrictManagedCodingGuidelinesSections(lines, index, sectionHeadings, bulletCounts);
}

function matchStrictManagedCodingGuidelinesSections(lines, startIndex, sectionHeadings, bulletCounts) {
  let index = startIndex;

  for (let sectionIndex = 0; sectionIndex < sectionHeadings.length; sectionIndex += 1) {
    if (index >= lines.length || lines[index].trim() !== sectionHeadings[sectionIndex]) {
      return -1;
    }
    index += 1;

    let bulletCount = 0;
    while (index < lines.length) {
      const trimmed = lines[index].trim();
      if (sectionHeadings.includes(trimmed)) {
        break;
      }
      if (trimmed.startsWith('<!-- spec-first:')) {
        break;
      }
      if (trimmed !== '' && /^(#|##)\s/.test(trimmed)) {
        break;
      }
      if (trimmed.startsWith('- ')) {
        bulletCount += 1;
      }
      index += 1;
    }

    if (bulletCount < bulletCounts[sectionIndex]) {
      return -1;
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
