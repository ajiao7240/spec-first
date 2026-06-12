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
  const entry = (name) => `${prefix}${name}`;
  const hostLine = hostId === 'claude'
    ? '- Claude workflow 入口使用 `/spec:*`'
    : '- Codex workflow 入口使用 `$spec-*`';
  const surfaceLine = hostId === 'claude'
    ? '- 不要把 `using-spec-first` 本身当作 command-backed workflow'
    : '- 不要把 `using-spec-first` 写成 `/spec:*` 或 command-backed workflow';
  const codexStartupReminderLines = hostId === 'codex'
    ? [
      '- Codex：进入公开 `$spec-*` 前可 best-effort 运行 `spec-first startup-reminder --codex`；失败/空输出不阻塞，只提示在终端运行 `spec-first update`，bounded subagents、leaf reviewers、worker agents 不运行',
      '- Codex：公开 `$spec-*` 调用即授权该 workflow 文档化的只读 reviewer/researcher phase；`$spec-doc-review` 默认多 persona dispatch，仅 report-only/no-agents、dispatch/runtime 缺失或安全边界不满足时降级',
    ].join('\n')
    : '';

  return `## Workflow 入口治理

- 本 block 是 using-spec-first 的核心决策集(随会话启动注入,启动即在场);完整路由策略与细节仍在 \`skills/using-spec-first/SKILL.md\`
- **何时进入 workflow**:substantial work（改代码/docs/config/runtime asset、启动 implementation/debug/review/plan/setup/update/optimization/知识沉淀、运行改状态命令、架构/prompt/workflow/contract 决策、durable knowledge 增删）前先判断是否进入公开 spec-first workflow
- **何时直接做**:轻量事实问答、窄定位查询（where is X used）、无 workflow 增益的简短解释可直接回答;workflow-first 不等于 brainstorming-first,不强制每个任务走 workflow
- **何时不重新分流**:已在公开 workflow 内（按其 SKILL 继续,仅在用户改目标/显式 handoff/明显越界时重路由）或作为 bounded subagent/worker 被派遣（完成 bounded 任务即可,不重启路由)
- **如何路由**:意图优先于关键词与主题域;选一个入口并说明一个理由,不默认进入 \`spec-brainstorm\`,不自动串联多个 workflow;用户显式调用某 workflow 时优先尊重;用户询问下一步时用 \`using-spec-first\` guide mode 给一个入口、一个理由、一个动作
- 用户可见输出语言以本文件的 \`spec-first:lang\` managed block 为准；skill/agent/template 原文语言和当前会话惯性不得覆盖该策略，除非用户明确要求其他语言
- **优先级(高→低)**:显式 route > 安全/修复(setup/update/缺 runtime) > 诊断(debug 先于 work,针对失败) > 评审(code/doc review 先于实现) > 定义(brainstorm/ideate/prd 先于 plan/work,WHAT 不清时) > 优化(可度量实验) > 执行(plan 先于 work) > 知识(compound/compound-refresh)
- 父级多仓 workspace：写入、修复、测试、review autofix 或 commit 前必须有明确 \`target_repo\` / per-child scope；只读定位也应使用 bounded direct reads 并说明目标 repo 假设
- Runtime context 默认排除 \`.spec-first/audits/**\` 和 generated mirrors（\`.claude/**\`、\`.codex/**\`、\`.agents/skills/**\`）;只有 setup/update/runtime-drift/audit 等明确运行时任务按需读取
- **反合理化红旗**(出现这些念头即停):「先改个文件就好」→ 先判断是否 work/debug/update/compound-refresh;「只是个快速架构/prompt 改动」→ 架构/prompt/workflow/contract 改动算 substantial;「得先看一堆文件再决定」→ 只做最小事实核查,已清晰则直接路由;「该评审但我口头答就行」→ 评审目标具体时用 code-review/doc-review;「helper skill 存在所以该暴露」→ 只有公开 workflow 是用户入口,internal helper 隐藏
${hostLine}
${surfaceLine}；不要直接暴露 internal-only skills,例如 \`git-worktree\`
${codexStartupReminderLines ? `${codexStartupReminderLines}\n` : ''}- 入口映射(意图→入口):环境/MCP/host readiness→\`${entry('mcp-setup')}\`;版本检查/刷新 runtime→终端运行 \`spec-first update\`;bug/失败/栈→\`${entry('debug')}\`;代码/PR/diff 评审→\`${entry('code-review')}\`;需求/计划/markdown 文档评审→\`${entry('doc-review')}\`;skill/agent 资产审计→\`${entry('skill-audit')}\`;app/PRD 一致性审计→\`${entry('app-consistency-audit')}\`;0-1 产品想法/要选项→\`${entry('ideate')}\`;定义 WHAT/问题框定→\`${entry('brainstorm')}\`;存量系统 PRD 撰写/校验→\`${entry('prd')}\`;可度量优化实验→\`${entry('optimize')}\`;目标清晰需执行计划→\`${entry('plan')}\`;计划拆任务→\`spec-write-tasks\`;计划/任务就绪可执行→\`${entry('work')}\`;沉淀已解决问题→\`${entry('compound')}\`;刷新/订正既有 docs/learnings→\`${entry('compound-refresh')}\`;过往 session 检索→\`${entry('sessions')}\`;发布说明→\`${entry('release-notes')}\``;
}

function buildEnBootstrapBody(hostId) {
  const prefix = hostId === 'claude' ? '/spec:' : '$spec-';
  const entry = (name) => `${prefix}${name}`;
  const hostLine = hostId === 'claude'
    ? '- Claude workflow entrypoints use `/spec:*`'
    : '- Codex workflow entrypoints use `$spec-*`';
  const surfaceLine = hostId === 'claude'
    ? '- Do not treat `using-spec-first` itself as a command-backed workflow'
    : '- Do not write `using-spec-first` as `/spec:*` or as a command-backed workflow';
  const codexStartupReminderLines = hostId === 'codex'
    ? [
      '- Codex: before entering public `$spec-*`, a top-level orchestrator may best-effort run `spec-first startup-reminder --codex`; failure/empty output must not block routing, only points to running `spec-first update` in the terminal, and bounded subagents, leaf reviewers, and worker agents do not run it',
      '- Codex: invoking public `$spec-*` authorizes that workflow\'s documented read-only reviewer/researcher phase; `$spec-doc-review` defaults to multi-persona dispatch and falls back only for report-only/no-agents, missing dispatch/runtime, or unmet safety boundaries',
    ].join('\n')
    : '';

  return `## Workflow Entry Governance

- This block is the using-spec-first core decision set (injected at session start, present from the start); the full routing policy and details still live in \`skills/using-spec-first/SKILL.md\`
- **When to enter a workflow**: before substantial work (editing code/docs/config/runtime assets; starting implementation/debug/review/plan/setup/update/optimization/knowledge capture; running state-changing commands; architecture/prompt/workflow/contract decisions; adding/removing durable knowledge), decide whether to enter a public spec-first workflow
- **When to just answer**: lightweight factual Q&A, narrow lookups (where is X used), and brief explanations with no workflow leverage may be answered directly; workflow-first does NOT mean brainstorming-first, and you do not force every task through a workflow
- **When NOT to reroute**: if already inside a public workflow (follow its SKILL; reroute only when the user changes the goal, the workflow explicitly hands off, or the request is clearly out of scope) or dispatched as a bounded subagent/worker (complete the bounded task; do not restart routing)
- **How to route**: immediate intent beats keywords and broad subject area; pick one entrypoint and state one reason; do not default to \`spec-brainstorm\` or chain workflows automatically; honor an explicitly invoked workflow; when the user asks what's next, use \`using-spec-first\` guide mode for one entrypoint, one reason, one action
- User-visible output language follows this file's \`spec-first:lang\` managed block; skill/agent/template source language and conversation inertia must not override it unless the user explicitly requests another language
- **Priority (high→low)**: explicit route > safety/repair (setup/update/missing runtime) > diagnostic (debug before work, for failures) > evaluation (code/doc review before implementation) > definition (brainstorm/ideate/prd before plan/work, when WHAT is unclear) > optimization (measurable experiments) > execution (plan before work) > knowledge (compound/compound-refresh)
- Parent multi-repo workspace: writes, fixes, tests, review autofix, or commits require explicit \`target_repo\` / per-child scope; read-only orientation should use bounded direct reads and state target-repo assumptions
- Runtime context excludes \`.spec-first/audits/**\` and generated mirrors (\`.claude/**\`, \`.codex/**\`, \`.agents/skills/**\`) by default; only setup/update/runtime-drift/audit tasks read them when explicitly needed
- **Anti-rationalization red flags** (stop when these thoughts appear): "I'll just edit the file first" → first check whether this is work/debug/update/compound-refresh; "just a quick architecture/prompt change" → architecture/prompt/workflow/contract changes ARE substantial; "I need to inspect a bunch of files first" → do a minimal fact check only, route if already clear; "review needed but I'll answer informally" → use code-review/doc-review when the target is concrete; "a helper skill exists so I should expose it" → only public workflows are user entrypoints, internal helpers stay hidden
${hostLine}
${surfaceLine}; do not expose internal-only skills directly, for example \`git-worktree\`
${codexStartupReminderLines ? `${codexStartupReminderLines}\n` : ''}- Entry map (intent→entrypoint): environment/MCP/host readiness→\`${entry('mcp-setup')}\`; version check/refresh runtime→run \`spec-first update\` in the terminal; bug/failure/stack→\`${entry('debug')}\`; code/PR/diff review→\`${entry('code-review')}\`; requirements/plan/markdown doc review→\`${entry('doc-review')}\`; skill/agent asset audit→\`${entry('skill-audit')}\`; app/PRD consistency audit→\`${entry('app-consistency-audit')}\`; 0-1 product idea/options→\`${entry('ideate')}\`; define WHAT/problem framing→\`${entry('brainstorm')}\`; brownfield PRD authoring/validation→\`${entry('prd')}\`; measurable optimization→\`${entry('optimize')}\`; clear outcome needs a plan→\`${entry('plan')}\`; split plan into tasks→\`spec-write-tasks\`; plan/tasks ready to execute→\`${entry('work')}\`; capture a solved problem→\`${entry('compound')}\`; refresh/correct existing docs/learnings→\`${entry('compound-refresh')}\`; retrieve past sessions→\`${entry('sessions')}\`; release notes→\`${entry('release-notes')}\``;
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
