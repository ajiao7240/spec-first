const fs = require('node:fs');
const path = require('node:path');

const LANG_START = '<!-- spec-first:lang:start -->';
const LANG_END = '<!-- spec-first:lang:end -->';

/**
 * Idempotently write the language and governance policy block into the repo-root
 * instruction file (CLAUDE.md for Claude, AGENTS.md for Codex).
 *
 * - File absent: create it with just the managed block.
 * - File exists, no markers: append the block at end.
 * - File exists, markers present: replace the block in place (preserves surrounding content).
 * - Corrupted state (START without END): treat as "no markers" and append.
 *
 * @param {string} projectRoot
 * @param {{ lang: string }} developer
 * @param {import('./adapters/base')} adapter
 */
function writeLangPolicy(projectRoot, developer, adapter) {
  const filePath = path.join(projectRoot, adapter.instructionFile);
  const block = buildManagedBlock(developer.lang);

  let existing = '';
  if (fs.existsSync(filePath)) {
    existing = fs.readFileSync(filePath, 'utf8');
  }

  const updated = applyManagedBlock(existing, block);

  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, updated, 'utf8');
  fs.renameSync(tmpPath, filePath);

  console.log(`📋 Wrote language policy to ${adapter.instructionFile}`);
}

/**
 * Apply the managed block to existing file content, idempotently.
 * Exported for unit testing.
 *
 * @param {string} existing - Current file content (may be empty string).
 * @param {string} block    - Full managed block including START/END markers.
 * @returns {string}        - Updated content.
 */
function applyManagedBlock(existing, block) {
  const startIdx = existing.indexOf(LANG_START);
  const endIdx = existing.indexOf(LANG_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // Replace the existing managed section in place.
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + LANG_END.length);
    return `${before}${block}${after}`;
  }

  // No valid markers found (absent or corrupted): append at end.
  if (existing.length === 0) {
    return block;
  }
  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  return `${existing}${separator}${block}\n`;
}

/**
 * Build the full managed block for the given lang.
 *
 * @param {string} lang - 'zh' or 'en'
 * @returns {string}
 */
function buildManagedBlock(lang) {
  const policy = lang === 'en' ? buildEnPolicy() : buildZhPolicy();
  return `${LANG_START}\n${policy}\n${LANG_END}`;
}

function buildZhPolicy() {
  return `## 语言与治理策略（由 spec-first 管理）

**语言设置：** \`中文\`

### 语言规则
- 回复、状态更新、生成文档、评审意见、计划说明等所有自然语言输出使用**中文**
- 允许混用英文技术术语，不要求强行翻译常见技术词
- 代码标识符（变量、函数、类、模块、文件名中的技术标识）保持英文
- 新增代码注释使用中文，简洁清晰，不写空洞注释
- 代码、命令、路径、配置键、环境变量名、API 名称、协议名等技术标识不因语言偏好而被翻译

### Changelog 治理规则
**代码变动铁律（无例外）**
- 任何对项目源码的新增、删除、修改，必须同步在项目根目录 \`CHANGELOG.md\` 中添加一条记录
- 无此记录的代码变动，一律拒绝生成
- 记录格式以仓库现行格式为准
- \`作者\` 必须使用当前 host 的项目级 developer profile：Codex 读取 \`.codex/spec-first/.developer\`，Claude 读取 \`.claude/spec-first/.developer\`；如果缺失，先运行对应的 \`spec-first init --codex|--claude -u <name> --lang <zh|en>\`
- **示例：** \`- vX.Y.Z YYYY-MM-DD 作者: 一句话摘要\`
- 用户可见变更在末尾追加 \`(user-visible)\``;
}

function buildEnPolicy() {
  return `## Language and Governance Policy (managed by spec-first)

**Language setting:** \`English\`

### Language Rules
- All natural language output including responses, status updates, generated documentation, review comments, and plan notes must use **English**
- Code identifiers (variables, functions, classes, modules, technical identifiers in filenames) remain in English
- New code comments use English — concise and clear
- Technical identifiers such as code, commands, paths, config keys, env var names, API names, and protocol names are never translated

### Changelog Governance
**Code Change Iron Law (No Exceptions)**
- Any addition, deletion, or modification to project source code must include a matching entry in the repo-root \`CHANGELOG.md\`
- If no matching entry exists, refuse to generate the code change
- Use the repository's existing changelog format
- \`author\` must use the current host's project developer profile: Codex reads \`.codex/spec-first/.developer\`, Claude reads \`.claude/spec-first/.developer\`; if it is missing, first run the matching \`spec-first init --codex|--claude -u <name> --lang <zh|en>\`
- **Example:** \`- vX.Y.Z YYYY-MM-DD author: one-line summary\`
- Append \`(user-visible)\` for user-visible changes`;
}

module.exports = {
  writeLangPolicy,
  applyManagedBlock,
  buildManagedBlock,
};
