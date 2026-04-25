const fs = require('node:fs');
const path = require('node:path');

const BOOTSTRAP_START = '<!-- spec-first:bootstrap:start -->';
const BOOTSTRAP_END = '<!-- spec-first:bootstrap:end -->';

function writeInstructionBootstrap(projectRoot, adapter, lang = 'zh') {
  const filePath = path.join(projectRoot, adapter.instructionFile);
  const block = buildBootstrapBlock(adapter, lang);

  let existing = '';
  if (fs.existsSync(filePath)) {
    existing = fs.readFileSync(filePath, 'utf8');
  }

  const updated = applyManagedBootstrapBlock(existing, block);
  writeAtomically(filePath, updated);
  console.log(`🧭 Wrote using-spec-first bootstrap to ${adapter.instructionFile}`);
}

function removeInstructionBootstrap(projectRoot, adapter) {
  const filePath = path.join(projectRoot, adapter.instructionFile);
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const existing = fs.readFileSync(filePath, 'utf8');
  const updated = removeManagedBootstrapBlock(existing);
  if (updated === existing) {
    return false;
  }

  writeAtomically(filePath, updated);
  return true;
}

function inspectInstructionBootstrap(projectRoot, adapter) {
  const filePath = path.join(projectRoot, adapter.instructionFile);
  if (!fs.existsSync(filePath)) {
    return {
      status: 'missing',
      message: `${adapter.instructionFile} is missing`,
    };
  }

  const existing = fs.readFileSync(filePath, 'utf8');
  const startIdx = existing.indexOf(BOOTSTRAP_START);
  const endIdx = existing.indexOf(BOOTSTRAP_END);

  if (startIdx === -1 && endIdx === -1) {
    return {
      status: 'missing',
      message: 'managed bootstrap block missing',
    };
  }

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return {
      status: 'partial',
      message: 'managed bootstrap markers are incomplete',
    };
  }

  const actual = existing.slice(startIdx, endIdx + BOOTSTRAP_END.length);
  const expectedBlocks = [
    buildBootstrapBlock(adapter, 'zh'),
    buildBootstrapBlock(adapter, 'en'),
  ];

  if (expectedBlocks.includes(actual)) {
    return {
      status: 'installed',
      message: 'managed bootstrap block present',
    };
  }

  return {
    status: 'drifted',
    message: 'managed bootstrap block drifted from the bundled template',
  };
}

function applyManagedBootstrapBlock(existing, block) {
  const startIdx = existing.indexOf(BOOTSTRAP_START);
  const endIdx = existing.indexOf(BOOTSTRAP_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + BOOTSTRAP_END.length);
    return `${before}${block}${after}`;
  }

  const corrupted = startIdx !== -1 || endIdx !== -1;
  const cleaned = corrupted
    ? stripKnownBootstrapBodies(stripStandaloneMarkerLines(existing))
    : existing;
  if (cleaned.length === 0) {
    return block;
  }

  const separator = cleaned.endsWith('\n') ? '\n' : '\n\n';
  return `${cleaned}${separator}${block}\n`;
}

function removeManagedBootstrapBlock(existing) {
  const startIdx = existing.indexOf(BOOTSTRAP_START);
  const endIdx = existing.indexOf(BOOTSTRAP_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + BOOTSTRAP_END.length);
    return normalizeRemovalResult(`${before}${after}`);
  }

  if (startIdx !== -1 || endIdx !== -1) {
    return normalizeRemovalResult(stripKnownBootstrapBodies(stripStandaloneMarkerLines(existing)));
  }

  return normalizeRemovalResult(existing);
}

function buildBootstrapBlock(adapterOrId, lang = 'zh') {
  const hostId = typeof adapterOrId === 'string' ? adapterOrId : adapterOrId.id;
  const body = lang === 'en'
    ? buildEnBootstrapBody(hostId)
    : buildZhBootstrapBody(hostId);
  return `${BOOTSTRAP_START}\n${body}\n${BOOTSTRAP_END}`;
}

function buildZhBootstrapBody(hostId) {
  const prefix = hostId === 'claude' ? '/spec:' : '$spec-';
  const entry = (name) => hostId === 'claude' ? `${prefix}${name}` : `${prefix}${name}`;
  const hostLine = hostId === 'claude'
    ? '- Claude workflow 入口使用 `/spec:*`'
    : '- Codex workflow 入口使用 `$spec-*`';
  const surfaceLine = hostId === 'claude'
    ? '- 不要把 `using-spec-first` 本身当作 command-backed workflow'
    : '- 不要把 `using-spec-first` 写成 `/spec:*` 或 command-backed workflow';

  return `## Workflow 入口治理（由 spec-first 管理）

- 当前项目已安装 \`using-spec-first\`
- 开始 substantial work 前，先按 \`using-spec-first\` 做 workflow 判定；轻量问答可直接回答
${hostLine}
${surfaceLine}
- 常用路由：setup/MCP→\`${entry('mcp-setup')}\`；更新/修复 runtime→\`${entry('update')}\`；历史会话→\`${entry('sessions')}\`；bug/失败→\`${entry('debug')}\`；代码评审→\`${entry('code-review')}\`；文档评审→\`${entry('doc-review')}\`；上下文构建→\`${entry('graph-bootstrap')}\`；需求不清→\`${entry('brainstorm')}\`；想法生成→\`${entry('ideate')}\`；计划→\`${entry('plan')}\`；执行→\`${entry('work')}\`；知识沉淀→\`${entry('compound')}\`；知识刷新→\`${entry('compound-refresh')}\`
- 高级路由：优化实验→\`${entry('optimize')}\`；Slack 组织上下文→\`${entry('slack-research')}\`；PR 描述→\`${entry('pr-description')}\`；发布说明→\`${entry('release-notes')}\`；UI polish→\`${entry('polish-beta')}\`；delegation beta→\`${entry('work-beta')}\`
- 不要直接暴露 internal-only skills：\`using-spec-first\`、\`spec-session-inventory\`、\`spec-session-extract\``;
}

function buildEnBootstrapBody(hostId) {
  const prefix = hostId === 'claude' ? '/spec:' : '$spec-';
  const entry = (name) => hostId === 'claude' ? `${prefix}${name}` : `${prefix}${name}`;
  const hostLine = hostId === 'claude'
    ? '- Claude workflow entrypoints use `/spec:*`'
    : '- Codex workflow entrypoints use `$spec-*`';
  const surfaceLine = hostId === 'claude'
    ? '- Do not treat `using-spec-first` itself as a command-backed workflow'
    : '- Do not write `using-spec-first` as `/spec:*` or as a command-backed workflow';

  return `## Workflow Entry Governance (managed by spec-first)

- This project installs \`using-spec-first\`
- Before substantial work, route the request with \`using-spec-first\`; lightweight Q&A may be answered directly
${hostLine}
${surfaceLine}
- Common routes: setup/MCP→\`${entry('mcp-setup')}\`; update/runtime repair→\`${entry('update')}\`; session history→\`${entry('sessions')}\`; bug/failure→\`${entry('debug')}\`; code review→\`${entry('code-review')}\`; document review→\`${entry('doc-review')}\`; context build→\`${entry('graph-bootstrap')}\`; unclear requirements→\`${entry('brainstorm')}\`; idea generation→\`${entry('ideate')}\`; planning→\`${entry('plan')}\`; execution→\`${entry('work')}\`; knowledge capture→\`${entry('compound')}\`; knowledge refresh→\`${entry('compound-refresh')}\`
- Advanced routes: optimization experiments→\`${entry('optimize')}\`; Slack organizational context→\`${entry('slack-research')}\`; PR description→\`${entry('pr-description')}\`; release notes→\`${entry('release-notes')}\`; UI polish→\`${entry('polish-beta')}\`; delegation beta→\`${entry('work-beta')}\`
- Do not expose internal-only skills directly: \`using-spec-first\`, \`spec-session-inventory\`, \`spec-session-extract\``;
}

function stripStandaloneMarkerLines(content) {
  return content
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed !== BOOTSTRAP_START && trimmed !== BOOTSTRAP_END;
    })
    .join('\n');
}

function stripKnownBootstrapBodies(content) {
  let next = content;
  for (const body of buildKnownBootstrapBodies()) {
    next = next
      .replace(`\n${body}\n`, '\n')
      .replace(`\n${body}`, '\n')
      .replace(`${body}\n`, '')
      .replace(body, '');
  }
  return stripManagedBootstrapSections(next);
}

function buildKnownBootstrapBodies() {
  const bodies = [];
  for (const hostId of ['claude', 'codex']) {
    bodies.push(buildZhBootstrapBody(hostId));
    bodies.push(buildEnBootstrapBody(hostId));
  }
  return [...new Set(bodies)];
}

function stripManagedBootstrapSections(content) {
  const lines = content.split('\n');
  const next = [];

  for (let index = 0; index < lines.length; index += 1) {
    const skipTo = matchManagedBootstrapSection(lines, index);
    if (skipTo !== -1) {
      index = skipTo - 1;
      continue;
    }

    next.push(lines[index]);
  }

  return next.join('\n');
}

function matchManagedBootstrapSection(lines, startIndex) {
  const heading = lines[startIndex] ? lines[startIndex].trim() : '';
  if (
    heading !== '## Workflow 入口治理（由 spec-first 管理）' &&
    heading !== '## Workflow Entry Governance (managed by spec-first)'
  ) {
    return -1;
  }

  let index = startIndex + 1;
  if (index < lines.length && lines[index].trim() === '') {
    index += 1;
  }

  let bulletCount = 0;
  while (index < lines.length && lines[index].trim().startsWith('- ')) {
    bulletCount += 1;
    index += 1;
  }

  return bulletCount >= 4 ? index : -1;
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
  BOOTSTRAP_END,
  BOOTSTRAP_START,
  applyManagedBootstrapBlock,
  buildBootstrapBlock,
  inspectInstructionBootstrap,
  removeInstructionBootstrap,
  removeManagedBootstrapBlock,
  writeInstructionBootstrap,
};
