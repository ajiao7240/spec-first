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

**语言设置：** \`zh\`

### 语言规则
- 回复、状态更新、生成文档、评审意见、计划说明等所有自然语言输出使用**中文**
- 允许混用英文技术术语，不要求强行翻译常见技术词
- 代码标识符（变量、函数、类、模块、文件名中的技术标识）保持英文
- 新增代码注释使用中文，简洁清晰，不写空洞注释
- 代码、命令、路径、配置键、环境变量名、API 名称、协议名等技术标识不因语言偏好而被翻译

### Changelog 治理规则
在生成或修改源码前，先确认本次变更是否已有对应 \`CHANGELOG.md\` 条目。
若未同步，应提示用户补录后再继续，而非静默生成。
**条目格式：** \`- YYYY-MM-DD 作者: 一句话摘要 [(user-visible)]\`
版本发布时用 \`## vX.Y.Z - YYYY-MM-DD\` 作为 section 分隔线。

### 规范文件提交规则
当 \`CLAUDE.md\` 因规范初始化或规范升级而发生变化时，必须与相关代码变更一并提交。
规范未变化时不要求强行将其纳入 commit。`;
}

function buildEnPolicy() {
  return `## Language and Governance Policy (managed by spec-first)

**Language setting:** \`en\`

### Language Rules
- All natural language output including responses, status updates, generated documentation, review comments, and plan notes must use **English**
- Code identifiers (variables, functions, classes, modules, technical identifiers in filenames) remain in English
- New code comments use English — concise and clear
- Technical identifiers such as code, commands, paths, config keys, env var names, API names, and protocol names are never translated

### Changelog Governance
Before generating or modifying source code, confirm whether a corresponding \`CHANGELOG.md\` entry exists for the current change.
If not, prompt the user to add one before continuing — do not generate silently.
**Entry format:** \`- YYYY-MM-DD author: summary [(user-visible)]\`
Use \`## vX.Y.Z - YYYY-MM-DD\` as a section header for release versions.

### Governance File Commit Rule
When \`AGENTS.md\` changes due to spec-first initialization or upgrade, commit it together with the related code changes.
Do not force-include governance files in commits where they have not changed.`;
}

module.exports = {
  writeLangPolicy,
  applyManagedBlock,
  buildManagedBlock,
};
