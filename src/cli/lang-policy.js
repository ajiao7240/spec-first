const fs = require('node:fs');
const path = require('node:path');
const { writeFileAtomic } = require('./atomic-write');

const LANG_START = '<!-- spec-first:lang:start -->';
const LANG_END = '<!-- spec-first:lang:end -->';
const USER_LANGUAGE_START = '<!-- spec-first:user-language:start -->';
const USER_LANGUAGE_END = '<!-- spec-first:user-language:end -->';

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
  return upsertMarkerBlock(existing, block, LANG_START, LANG_END);
}

function upsertMarkerBlock(existing, block, startMarker, endMarker) {
  const pair = findCompleteMarkerPair(existing, startMarker, endMarker);
  if (pair) {
    const before = existing.slice(0, pair.startIdx);
    const after = existing.slice(pair.endIdx + endMarker.length);
    return `${before}${block}${after}`;
  }

  if (existing.length === 0) {
    return block;
  }
  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  return `${existing}${separator}${block}\n`;
}

function removeMarkerBlock(existing, startMarker, endMarker) {
  const pair = findCompleteMarkerPair(existing, startMarker, endMarker);
  if (!pair) {
    return existing;
  }

  const before = existing.slice(0, pair.startIdx);
  const after = existing.slice(pair.endIdx + endMarker.length);
  return `${before}${after}`;
}

function findCompleteMarkerPair(contents, startMarker, endMarker) {
  let searchFrom = 0;
  while (searchFrom < contents.length) {
    const startIdx = contents.indexOf(startMarker, searchFrom);
    if (startIdx === -1) {
      return null;
    }

    const afterStart = startIdx + startMarker.length;
    const nextStartIdx = contents.indexOf(startMarker, afterStart);
    const endIdx = contents.indexOf(endMarker, afterStart);
    if (endIdx !== -1 && (nextStartIdx === -1 || endIdx < nextStartIdx)) {
      return { startIdx, endIdx };
    }

    searchFrom = nextStartIdx === -1 ? afterStart : nextStartIdx;
  }

  return null;
}

/**
 * Build the full managed block for the given lang.
 *
 * @param {string} lang - 'zh' or 'en'
 * @returns {string}
 */
function buildManagedBlock(lang) {
  const policy = lang === 'en' ? buildEnProjectPolicy() : buildZhProjectPolicy();
  return `${LANG_START}\n${policy}\n${LANG_END}`;
}

function buildUserLanguageBlock(lang) {
  const policy = lang === 'en' ? buildEnUserLanguagePolicy() : buildZhUserLanguagePolicy();
  return `${USER_LANGUAGE_START}\n${policy}\n${USER_LANGUAGE_END}`;
}

function buildZhProjectPolicy() {
  return `## 语言与治理策略

**语言设置：** \`Chinese / 中文\`

${buildZhLanguageRules()}

### Changelog
- 任何项目 source 新增/删除/修改都必须同步更新根目录 \`CHANGELOG.md\`；记录格式以仓库现行为准。
- \`作者\` 读全局 developer profile \`~/.spec-first/.developer\`；取不到时回退 git 提交身份或留空，不阻断变更。
- 用户可见变更追加 \`(user-visible)\`；缺少 changelog 记录时拒绝生成 source 变更。`;
}

function buildEnProjectPolicy() {
  return `## Language and Governance Policy

**Language setting:** \`English / 英文\`

${buildEnLanguageRules()}

### Changelog
- Any project source addition, deletion, or modification must update the repo-root \`CHANGELOG.md\`; follow the repository's existing format.
- \`author\` reads the global developer profile \`~/.spec-first/.developer\`; if it is unavailable, fall back to the git commit identity or leave it blank, and do not block the change.
- Append \`(user-visible)\` for user-visible changes; if the changelog entry is missing, refuse to generate the source change.`;
}

function buildZhUserLanguagePolicy() {
  return `## Language

${buildZhLanguageRules()}`;
}

function buildEnUserLanguagePolicy() {
  return `## Language

${buildEnLanguageRules()}`;
}

function buildZhLanguageRules() {
  return `语言规则为绝对硬执行要求：所有面向用户的新生成自然语言内容必须使用简体中文。

适用范围包括但不限于：回答、状态更新、澄清问题、总结、评审、生成文档、需求、计划、任务、变更说明、commit message 和 PR 文案。

只有用户在当前请求中明确要求其他语言、翻译、双语输出或保留原文时，才允许切换语言。

代码标识符、命令、路径、配置键、环境变量、API 名称、协议名、日志、工具输出和引用材料可以保留原文；围绕它们新增的解释、结论和说明仍必须使用简体中文。

新增代码注释使用简体中文，只说明非显然意图。

如果 skill、agent、模板、历史上下文或示例文本使用英文，但用户当前请求没有明确要求英文，最终面向用户的新生成内容仍必须使用简体中文。`;
}

function buildEnLanguageRules() {
  return `Language rules are an absolute hard-execution requirement: all newly generated natural-language content intended for the user must be in English.

This applies to, without limitation: responses, status updates, clarification questions, summaries, reviews, generated documents, requirements, plans, tasks, change notes, commit messages, and PR text.

Only when the user explicitly asks in the current request for another language, translation, bilingual output, or preserving original text may you switch languages.

Code identifiers, commands, paths, config keys, environment variables, API names, protocol names, logs, tool output, and quoted material may remain in their original language; any new explanation, conclusion, or surrounding guidance must still be in English.

New code comments use English and explain only non-obvious intent.

If a skill, agent, template, historical context, or example text uses another language, but the user's current request does not explicitly ask for that language, the final newly generated user-facing content must still be in English.`;
}

module.exports = {
  writeLangPolicy,
  applyManagedBlock,
  buildManagedBlock,
  buildUserLanguageBlock,
  upsertMarkerBlock,
  removeMarkerBlock,
  USER_LANGUAGE_START,
  USER_LANGUAGE_END,
};
