const fs = require('node:fs');
const path = require('node:path');
const { writeFileAtomic } = require('./atomic-write');

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

  writeFileAtomic(filePath, updated);

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
  return `## 语言与治理策略

**语言设置：** \`Chinese / 中文\`

- 默认用中文生成回复、状态更新、澄清、生成文档、需求/计划/任务、评审、总结、变更说明和 commit/PR 文案；用户明确要求翻译、双语或其他语言时例外。
- 输入、工具输出或引用材料可保留原文；新生成的说明和结论仍按语言设置输出。
- 代码标识符、命令、路径、配置键、环境变量、API/协议名保持原文；常见英文技术术语可混用。
- 新增代码注释使用中文，只说明非显然意图。

### Changelog
- 任何项目 source 新增、删除或修改，都必须同步更新根目录 \`CHANGELOG.md\`；记录格式以仓库现行格式为准。
- \`作者\` 使用当前 host developer profile：Codex 读 \`.codex/spec-first/.developer\`，Claude 读 \`.claude/spec-first/.developer\`；缺失时先运行 \`spec-first init\` 并按引导选择当前宿主、开发者姓名与语言。
- 用户可见变更追加 \`(user-visible)\`；缺少对应记录时，拒绝生成 source 变更。`;
}

function buildEnPolicy() {
  return `## Language and Governance Policy

**Language setting:** \`English / 英文\`

- Generate responses, status updates, clarifications, documentation, requirements/plans/tasks, reviews, summaries, change notes, and commit/PR text in English unless the user explicitly asks for translation, bilingual output, or another language.
- Input, tool output, and quoted material may keep their original language; new explanations and conclusions still follow the language setting.
- Keep code identifiers, commands, paths, config keys, env vars, API/protocol names, and common technical terms unchanged.
- New code comments use English and explain only non-obvious intent.

### Changelog
- Any project source addition, deletion, or modification must update the repo-root \`CHANGELOG.md\`; follow the repository's existing format.
- \`author\` uses the current host developer profile: Codex reads \`.codex/spec-first/.developer\`, Claude reads \`.claude/spec-first/.developer\`; if missing, run \`spec-first init\` first and choose the current host, developer name, and language when prompted.
- Append \`(user-visible)\` for user-visible changes; if the matching entry is missing, refuse to generate the source change.`;
}

module.exports = {
  writeLangPolicy,
  applyManagedBlock,
  buildManagedBlock,
};
