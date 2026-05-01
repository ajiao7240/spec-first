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
  const codexStartupReminderLines = hostId === 'codex'
    ? [
      '- 顶层 Codex orchestrator 在准备进入公开 `$spec-*` workflow 前，可 best-effort 运行 `spec-first startup-reminder --codex` 做只读版本提醒；缺失、失败或无输出都必须忽略，不阻塞路由',
      '- 该提醒只指向 `$spec-update` 由用户自主决策升级；bounded subagents、leaf reviewers、worker agents 不运行该检查，也不写 cooldown 状态',
    ].join('\n')
    : '';

  return `## Workflow 入口治理（由 spec-first 管理）

- 本 block 是 spec-first workflow 入口提醒；\`using-spec-first\` 是 standalone meta skill，不是 workflow command
- 修改文件、运行会改变状态的命令、或做架构/prompt/workflow 决策前，先判断是否应进入公开 spec-first workflow；轻量问答和窄事实查询可直接回答
- 按当前用户意图选择一个最匹配入口；不要默认进入 \`spec-brainstorm\`，也不要自动串联多个 workflow
- 如果用户询问下一步、该用哪个命令或不知道 workflow，按 \`using-spec-first\` 的 guide mode 推荐一个公开入口和一句理由
- 如果已经在 spec-first workflow 中或作为 bounded subagent 执行，遵循当前 workflow/父任务范围，不重新入口分流
${hostLine}
${surfaceLine}
${codexStartupReminderLines ? `${codexStartupReminderLines}\n` : ''}- 常见入口锚点：环境/MCP→\`${entry('mcp-setup')}\`；graph readiness 编译→\`${entry('graph-bootstrap')}\`；更新/runtime 修复→\`${entry('update')}\`；bug/失败→\`${entry('debug')}\`；代码/文档评审→\`${entry('code-review')}\`/\`${entry('doc-review')}\`；需求/计划/任务编译/执行→\`${entry('brainstorm')}\`/\`${entry('plan')}\`/\`spec-write-tasks\`（standalone skill）/\`${entry('work')}\`；可度量优化→\`${entry('optimize')}\`
- 完整选择策略、优先级和 red flags 由 spec-first 随包的 \`using-spec-first\` 维护；本 block 只保留启动提醒、host 入口边界和少量锚点
- 不要直接暴露 internal-only skills：\`spec-session-inventory\`、\`spec-session-extract\``;
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
  const codexStartupReminderLines = hostId === 'codex'
    ? [
      '- Before a top-level Codex orchestrator enters a public `$spec-*` workflow, it may best-effort run `spec-first startup-reminder --codex` for a read-only version reminder; missing CLI, failure, or empty output must be ignored and must not block routing',
      '- This reminder only points to `$spec-update` for user-decided upgrade work; bounded subagents, leaf reviewers, and worker agents must not run the check or write cooldown state',
    ].join('\n')
    : '';

  return `## Workflow Entry Governance (managed by spec-first)

- This block is the spec-first workflow entry reminder; \`using-spec-first\` is a standalone meta skill, not a workflow command
- Before editing files, running state-changing commands, or making architecture/prompt/workflow decisions, decide whether to enter a public spec-first workflow; lightweight Q&A and narrow factual lookups may be answered directly
- Pick one best-matching entrypoint by current user intent; do not default to \`spec-brainstorm\` or automatically chain workflows
- If the user asks what to run next, which command to use, or does not know the workflow, use \`using-spec-first\` guide mode to recommend one public entrypoint with one reason
- If already inside a spec-first workflow or running as a bounded subagent, follow the active workflow/parent scope instead of restarting entry routing
${hostLine}
${surfaceLine}
${codexStartupReminderLines ? `${codexStartupReminderLines}\n` : ''}- Common entry anchors: environment/MCP→\`${entry('mcp-setup')}\`; graph readiness compilation→\`${entry('graph-bootstrap')}\`; update/runtime repair→\`${entry('update')}\`; bug/failure→\`${entry('debug')}\`; code/document review→\`${entry('code-review')}\`/\`${entry('doc-review')}\`; requirements/planning/task compilation/execution→\`${entry('brainstorm')}\`/\`${entry('plan')}\`/\`spec-write-tasks\` (standalone skill)/\`${entry('work')}\`; measurable optimization→\`${entry('optimize')}\`
- The full selection policy, priority rules, and red flags are maintained by the bundled spec-first \`using-spec-first\`; this block only keeps the startup reminder, host entrypoint boundaries, and a few anchors
- Do not expose internal-only skills directly: \`spec-session-inventory\`, \`spec-session-extract\``;
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
