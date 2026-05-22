const fs = require('node:fs');
const path = require('node:path');
const { writeFileAtomic } = require('./atomic-write');

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
      '- Codex：进入公开 `$spec-*` 前可 best-effort 运行 `spec-first startup-reminder --codex`；失败/空输出不阻塞，只提示 `$spec-update`，bounded subagents、leaf reviewers、worker agents 不运行',
      '- Codex：公开 `$spec-*` 调用即授权该 workflow 文档化的只读 reviewer/researcher phase；`$spec-doc-review` 默认多 persona dispatch，仅 report-only/no-agents、dispatch/runtime 缺失或安全边界不满足时降级',
    ].join('\n')
    : '';

  return `## Workflow 入口治理

- 本 block 只做轻量 workflow entry context router；完整路由策略在 \`skills/using-spec-first/SKILL.md\`
- substantial work 前先判断是否进入公开 spec-first workflow；轻量问答和窄事实查询可直接回答；已在 workflow 或 bounded subagent 中时不重新分流
- 按当前意图选择一个入口；不要默认进入 \`spec-brainstorm\`，不要自动串联多个 workflow；用户询问下一步时，用 \`using-spec-first\` guide mode 推荐一个入口、一个理由、一个动作
- 父级多仓 workspace：只读代码问题可用 \`workspace-graph-targets.v1\` advisory facts 和 \`workspace-gitnexus-readiness.v1\` 的 group-ready / bounded-fallback 提示；写入、修复、测试、review autofix 或 commit 前必须有明确 \`target_repo\` / per-child scope
- Runtime context 默认排除 \`.spec-first/audits/**\` 和 generated mirrors（\`.claude/**\`、\`.codex/**\`、\`.agents/skills/**\`）；只有 setup/update/runtime-drift/audit 等明确运行时任务按需读取
${hostLine}
${surfaceLine}；不要直接暴露 internal-only skills，例如 \`git-worktree\`
${codexStartupReminderLines ? `${codexStartupReminderLines}\n` : ''}- 常见入口锚点：环境/MCP→\`${entry('mcp-setup')}\`；graph readiness→\`${entry('graph-bootstrap')}\`；更新/runtime 修复→\`${entry('update')}\`；bug/失败→\`${entry('debug')}\`；代码/文档评审→\`${entry('code-review')}\`/\`${entry('doc-review')}\`；需求/计划/任务/执行→\`${entry('brainstorm')}\`/\`${entry('plan')}\`/\`spec-write-tasks\`/\`${entry('work')}\`；可度量优化→\`${entry('optimize')}\``;
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
      '- Codex: before entering public `$spec-*`, a top-level orchestrator may best-effort run `spec-first startup-reminder --codex`; failure/empty output must not block routing, only points to `$spec-update`, and bounded subagents, leaf reviewers, and worker agents do not run it',
      '- Codex: invoking public `$spec-*` authorizes that workflow\'s documented read-only reviewer/researcher phase; `$spec-doc-review` defaults to multi-persona dispatch and falls back only for report-only/no-agents, missing dispatch/runtime, or unmet safety boundaries',
    ].join('\n')
    : '';

  return `## Workflow Entry Governance

- This block is only a thin workflow entry context router; the full routing policy lives in \`skills/using-spec-first/SKILL.md\`
- Before substantial work, decide whether to enter a public spec-first workflow; lightweight Q&A and narrow factual lookups may be answered directly; if already inside a workflow or bounded subagent, do not reroute
- Pick one entrypoint by current intent; do not default to \`spec-brainstorm\` or automatically chain workflows; when the user asks what to run next, use \`using-spec-first\` guide mode to recommend one entrypoint, one reason, and one action
- Parent multi-repo workspace: read-only code questions may use \`workspace-graph-targets.v1\` advisory facts and \`workspace-gitnexus-readiness.v1\` group-ready / bounded-fallback hints; writes, fixes, tests, review autofix, or commits require explicit \`target_repo\` / per-child scope
- Runtime context excludes \`.spec-first/audits/**\` and generated mirrors (\`.claude/**\`, \`.codex/**\`, \`.agents/skills/**\`) by default; only setup/update/runtime-drift/audit tasks read them when explicitly needed
${hostLine}
${surfaceLine}; do not expose internal-only skills directly, for example \`git-worktree\`
${codexStartupReminderLines ? `${codexStartupReminderLines}\n` : ''}- Common entry anchors: environment/MCP→\`${entry('mcp-setup')}\`; graph readiness→\`${entry('graph-bootstrap')}\`; update/runtime repair→\`${entry('update')}\`; bug/failure→\`${entry('debug')}\`; code/document review→\`${entry('code-review')}\`/\`${entry('doc-review')}\`; requirements/planning/tasks/execution→\`${entry('brainstorm')}\`/\`${entry('plan')}\`/\`spec-write-tasks\`/\`${entry('work')}\`; measurable optimization→\`${entry('optimize')}\``;
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
  const knownHeadings = [
    '## Workflow 入口治理',
    '## Workflow 入口治理（由 spec-first 管理）',
    '## Workflow Entry Governance',
    '## Workflow Entry Governance (managed by spec-first)',
  ];
  if (!knownHeadings.includes(heading)) {
    return -1;
  }

  let index = startIndex + 1;
  if (index < lines.length && lines[index].trim() === '') {
    index += 1;
  }

  let bulletCount = 0;
  let managedAnchorCount = 0;
  while (index < lines.length && lines[index].trim().startsWith('- ')) {
    if (isManagedBootstrapAnchor(lines[index])) {
      managedAnchorCount += 1;
    }
    bulletCount += 1;
    index += 1;
  }

  if (isLegacyManagedBootstrapHeading(heading)) {
    return bulletCount >= 4 ? index : -1;
  }

  return bulletCount >= 4 && managedAnchorCount >= 2 ? index : -1;
}

function isLegacyManagedBootstrapHeading(heading) {
  return heading === '## Workflow 入口治理（由 spec-first 管理）' ||
    heading === '## Workflow Entry Governance (managed by spec-first)';
}

function isManagedBootstrapAnchor(line) {
  return line.includes('using-spec-first') ||
    line.includes('spec-brainstorm') ||
    line.includes('Common entry anchors') ||
    line.includes('常见入口锚点') ||
    line.includes('spec-write-tasks') ||
    line.includes('internal-only skills') ||
    line.includes('workflow entry reminder') ||
    line.includes('workflow 入口提醒');
}

function normalizeRemovalResult(content) {
  return content
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '\n');
}

function writeAtomically(filePath, contents) {
  writeFileAtomic(filePath, contents);
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
