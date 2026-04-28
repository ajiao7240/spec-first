const fs = require('node:fs');
const path = require('node:path');

const RUNTIME_TOOLS_START = '<!-- spec-first:runtime-tools:start -->';
const RUNTIME_TOOLS_END = '<!-- spec-first:runtime-tools:end -->';
const GITNEXUS_START = '<!-- gitnexus:start -->';

function writeRuntimeToolsIndexBlock(projectRoot, adapter, lang = 'zh') {
  const filePath = path.join(projectRoot, adapter.instructionFile);
  const block = buildRuntimeToolsBlock(adapter, lang);

  let existing = '';
  if (fs.existsSync(filePath)) {
    existing = fs.readFileSync(filePath, 'utf8');
  }

  const updated = applyManagedRuntimeToolsBlock(existing, block);
  writeAtomically(filePath, updated);
}

function inspectRuntimeToolsIndexBlock(projectRoot, adapter) {
  const filePath = path.join(projectRoot, adapter.instructionFile);
  if (!fs.existsSync(filePath)) {
    return {
      status: 'missing',
      message: `${adapter.instructionFile} is missing`,
    };
  }

  const existing = fs.readFileSync(filePath, 'utf8');
  const startIdx = existing.indexOf(RUNTIME_TOOLS_START);
  const endIdx = existing.indexOf(RUNTIME_TOOLS_END);

  if (startIdx === -1 && endIdx === -1) {
    return {
      status: 'missing',
      message: 'managed runtime-tools block missing',
    };
  }

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return {
      status: 'partial',
      message: 'managed runtime-tools markers are incomplete',
    };
  }

  const actual = existing.slice(startIdx, endIdx + RUNTIME_TOOLS_END.length);
  const expectedBlocks = [
    buildRuntimeToolsBlock(adapter, 'zh'),
    buildRuntimeToolsBlock(adapter, 'en'),
  ];

  if (expectedBlocks.includes(actual)) {
    return {
      status: 'installed',
      message: 'managed runtime-tools block present',
    };
  }

  return {
    status: 'drifted',
    message: 'managed runtime-tools block drifted from the bundled template',
  };
}

function applyManagedRuntimeToolsBlock(existing, block) {
  const startIdx = existing.indexOf(RUNTIME_TOOLS_START);
  const endIdx = existing.indexOf(RUNTIME_TOOLS_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + RUNTIME_TOOLS_END.length);
    return `${before}${block}${after}`;
  }

  const corrupted = startIdx !== -1 || endIdx !== -1;
  const cleaned = corrupted
    ? stripKnownRuntimeToolsBodies(stripStandaloneMarkerLines(existing))
    : existing;

  return insertRuntimeToolsBlock(cleaned, block);
}

function removeManagedRuntimeToolsBlock(existing) {
  const startIdx = existing.indexOf(RUNTIME_TOOLS_START);
  const endIdx = existing.indexOf(RUNTIME_TOOLS_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + RUNTIME_TOOLS_END.length);
    return normalizeRemovalResult(`${before}${after}`);
  }

  if (startIdx !== -1 || endIdx !== -1) {
    return normalizeRemovalResult(stripKnownRuntimeToolsBodies(stripStandaloneMarkerLines(existing)));
  }

  return normalizeRemovalResult(existing);
}

function buildRuntimeToolsBlock(adapterOrId, lang = 'zh') {
  const host = normalizeHost(adapterOrId);
  const body = lang === 'en' ? buildEnRuntimeToolsBody(host) : buildZhRuntimeToolsBody(host);
  return `${RUNTIME_TOOLS_START}\n${body}\n${RUNTIME_TOOLS_END}`;
}

function buildZhRuntimeToolsBody(host) {
  const referencePath = runtimeToolsReferencePath(host);
  const graphBootstrapEntry = host.id === 'claude' ? '/spec:graph-bootstrap' : '$spec-graph-bootstrap';

  return `## 代码智能与运行时工具（由 spec-first 管理）

\`spec-mcp-setup\` 管理本项目推荐/必需的 MCP servers、graph-provider MCP servers 与 helper tooling。完整工具清单、安装命令、host-specific notes 与 readiness ledger 语义统一收口在 \`${referencePath}\`。

### 使用边界
- \`GitNexus\`：用于全局代码知识图谱、架构理解、自然语言代码咨询/搜索、相似模块查找、执行流查询、影响分析和提交前变更检测。咨询“X 怎么工作 / 在哪里实现 / 可复用什么”这类场景，优先用 \`gitnexus_query\`；需要单个符号上下文时用 \`gitnexus_context\`。若本文件存在 \`<!-- gitnexus:start -->\` 管理块，优先遵守该块的强制规则。
- \`code-review-graph\`：用于变更集影响分析、review context、相关测试和 graph stats。不要把它当作通用咨询/搜索入口，也不要恢复旧内置 CRG/runtime 图引擎；只有 canonical graph facts / provider readiness 已 query-ready 且未 stale 时使用；blocked、stale 或未 ready 时先运行 \`${graphBootstrapEntry}\`，或退回 bounded direct repo reads。
- \`Serena MCP\`：用于 symbol overview、symbol lookup、references、LSP 辅助定位和精确编辑。它是上下文/编辑辅助，适合在 GitNexus 或 direct repo reads 给出候选后做精确定位，不替代源码真相源、测试或 graph-level 影响分析。
- \`ast-grep\`：用于结构化代码搜索和安全 rewrite。简单文本/文件搜索仍优先 \`rg\` / \`rg --files\`；需要 AST 语义匹配时再使用 \`ast-grep\`。

### 咨询/搜索降级顺序
- 优先使用 \`GitNexus\`：用 \`gitnexus_query\` 做自然语言代码咨询/搜索，用 \`gitnexus_context\` 查看单个符号上下文。
- 当 \`GitNexus\` 不可用，或按 \`<!-- gitnexus:start -->\` 管理块完成必要刷新/重建后仍然 stale / query-unverified，或目标仓库未索引时，降级到 \`Serena MCP\` 做 symbol / references / LSP 级定位。
- 当 \`Serena MCP\` 也不可用时，降级到 bounded direct repo reads，并用 \`rg\` / \`rg --files\` 做文本与文件搜索；只有需要 AST 结构语义时才用 \`ast-grep\`。
- \`code-review-graph\` 不在通用咨询/搜索降级链路中；它只用于变更影响、review context、相关测试和 graph stats。

### 不要做
- 不要把 helper tools 当成 MCP server 写入 \`mcp-tools.json\`。
- 不要在本文件复制安装命令、版本号、完整工具表或动态 ready 状态。
- 不要让多个 graph provider 规则互相覆盖；明确的强制治理块优先，其余工具作为上下文增强 provider 使用。`;
}

function buildEnRuntimeToolsBody(host) {
  const referencePath = runtimeToolsReferencePath(host);
  const graphBootstrapEntry = host.id === 'claude' ? '/spec:graph-bootstrap' : '$spec-graph-bootstrap';

  return `## Runtime Code Intelligence Tools (managed by spec-first)

\`spec-mcp-setup\` manages the MCP servers, graph-provider MCP servers, and helper tooling recommended or required for this project. The complete tool catalog, install commands, host-specific notes, and readiness ledger semantics are centralized in \`${referencePath}\`.

### Usage Boundaries
- \`GitNexus\`: Use for global code knowledge, architecture understanding, natural-language code consultation/search, similar-module discovery, execution-flow lookup, impact analysis, and pre-commit change detection. For questions like "how does X work?", "where is X implemented?", or "what can I reuse?", prefer \`gitnexus_query\`; use \`gitnexus_context\` for one-symbol context. If this file contains a \`<!-- gitnexus:start -->\` managed block, follow that block's mandatory rules first.
- \`code-review-graph\`: Use for change-set impact analysis, review context, related tests, and graph stats. Do not use it as the general consultation/search entrypoint, and do not restore the retired internal CRG/runtime graph engine; use it only when canonical graph facts / provider readiness are query-ready and not stale. If readiness is blocked, stale, or not ready, run \`${graphBootstrapEntry}\` first or fall back to bounded direct repo reads.
- \`Serena MCP\`: Use for symbol overview, symbol lookup, references, LSP-assisted navigation, and precise edits. It is a context/editing aid for precise follow-up after GitNexus or direct repo reads identify candidates, not a replacement for source truth, tests, or graph-level impact analysis.
- \`ast-grep\`: Use for structural code search and safe rewrites. Keep using \`rg\` / \`rg --files\` for simple text/file search; use \`ast-grep\` when AST semantics are needed.

### Consultation/Search Fallback Order
- Prefer \`GitNexus\`: use \`gitnexus_query\` for natural-language code consultation/search, and \`gitnexus_context\` for one-symbol context.
- When \`GitNexus\` is unavailable, or after following the \`<!-- gitnexus:start -->\` block for required refresh/rebuild it is still stale / query-unverified, or the target repo is not indexed, fall back to \`Serena MCP\` for symbol / references / LSP-level navigation.
- When \`Serena MCP\` is also unavailable, fall back to bounded direct repo reads and use \`rg\` / \`rg --files\` for text and file search; use \`ast-grep\` only when AST structural semantics are needed.
- \`code-review-graph\` is not part of the general consultation/search fallback chain; it is reserved for change impact, review context, related tests, and graph stats.

### Do Not
- Do not write helper tools into \`mcp-tools.json\` as MCP servers.
- Do not duplicate install commands, versions, full tool tables, or dynamic ready state in this file.
- Do not let graph provider rules override each other; explicit mandatory governance blocks take precedence, and other tools act as context-enhancement providers.`;
}

function insertRuntimeToolsBlock(existing, block) {
  if (existing.length === 0) {
    return block;
  }

  const gitnexusIdx = findStandaloneGitNexusStart(existing);
  if (gitnexusIdx !== -1) {
    const before = existing.slice(0, gitnexusIdx).replace(/\n+$/, '');
    const after = existing.slice(gitnexusIdx);
    if (before.length === 0) {
      return `${block}\n\n${after}`;
    }
    return `${before}\n\n${block}\n\n${after}`;
  }

  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  return `${existing}${separator}${block}\n`;
}

function findStandaloneGitNexusStart(content) {
  const match = /(^|\n)<!-- gitnexus:start -->/.exec(content);
  if (!match) {
    return -1;
  }

  return match.index + match[1].length;
}

function runtimeToolsReferencePath(host) {
  const root = host.id === 'claude' ? host.workflowsRoot : host.skillsRoot;
  return `${root}/spec-mcp-setup/references/supported-mcp-tools.md`;
}

function normalizeHost(adapterOrId) {
  if (adapterOrId && typeof adapterOrId === 'object') {
    return {
      id: adapterOrId.id,
      skillsRoot: adapterOrId.skillsRoot,
      workflowsRoot: adapterOrId.workflowsRoot,
    };
  }

  if (adapterOrId === 'claude') {
    return {
      id: 'claude',
      skillsRoot: '.claude/skills',
      workflowsRoot: '.claude/spec-first/workflows',
    };
  }

  return {
    id: 'codex',
    skillsRoot: '.agents/skills',
    workflowsRoot: '.agents/skills',
  };
}

function stripStandaloneMarkerLines(content) {
  return content
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed !== RUNTIME_TOOLS_START && trimmed !== RUNTIME_TOOLS_END;
    })
    .join('\n');
}

function stripKnownRuntimeToolsBodies(content) {
  let next = content;
  for (const body of buildKnownRuntimeToolsBodies()) {
    next = next
      .replace(`\n${body}\n`, '\n')
      .replace(`\n${body}`, '\n')
      .replace(`${body}\n`, '')
      .replace(body, '');
  }
  return stripManagedRuntimeToolsSections(next);
}

function buildKnownRuntimeToolsBodies() {
  const bodies = [];
  for (const hostId of ['claude', 'codex']) {
    bodies.push(buildZhRuntimeToolsBody(normalizeHost(hostId)));
    bodies.push(buildEnRuntimeToolsBody(normalizeHost(hostId)));
  }
  return [...new Set(bodies)];
}

function stripManagedRuntimeToolsSections(content) {
  const lines = content.split('\n');
  const next = [];

  for (let index = 0; index < lines.length; index += 1) {
    const skipTo = matchManagedRuntimeToolsSection(lines, index);
    if (skipTo !== -1) {
      index = skipTo - 1;
      continue;
    }

    next.push(lines[index]);
  }

  return next.join('\n');
}

function matchManagedRuntimeToolsSection(lines, startIndex) {
  const heading = lines[startIndex] ? lines[startIndex].trim() : '';
  if (
    heading !== '## 代码智能与运行时工具（由 spec-first 管理）' &&
    heading !== '## Runtime Code Intelligence Tools (managed by spec-first)' &&
    !isLooseManagedRuntimeToolsHeading(heading)
  ) {
    return -1;
  }

  let index = startIndex + 1;
  const requiredHeadings = [
    heading,
    heading.startsWith('## Runtime') ? '### Usage Boundaries' : '### 使用边界',
    heading.startsWith('## Runtime') ? '### Do Not' : '### 不要做',
  ];
  let headingCount = 1;
  let bulletCount = 0;

  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (trimmed.startsWith('<!-- spec-first:') || trimmed === GITNEXUS_START) {
      break;
    }
    if (/^#{1,2}\s/.test(trimmed) && trimmed !== heading) {
      break;
    }
    if (trimmed.startsWith('### ')) {
      if (requiredHeadings.includes(trimmed)) {
        headingCount += 1;
      }
    }
    if (trimmed.startsWith('- ')) {
      bulletCount += 1;
    }
    index += 1;
  }

  return headingCount >= 3 && bulletCount >= 5 ? index : -1;
}

function isLooseManagedRuntimeToolsHeading(heading) {
  if (!heading.startsWith('## ')) {
    return false;
  }

  return heading.includes('（由 spec-first 管理）') ||
    heading.includes('(managed by spec-first)');
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
  RUNTIME_TOOLS_END,
  RUNTIME_TOOLS_START,
  applyManagedRuntimeToolsBlock,
  buildRuntimeToolsBlock,
  inspectRuntimeToolsIndexBlock,
  removeManagedRuntimeToolsBlock,
  writeRuntimeToolsIndexBlock,
};
