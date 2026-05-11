const RUNTIME_TOOLS_START = '<!-- spec-first:runtime-tools:start -->';
const RUNTIME_TOOLS_END = '<!-- spec-first:runtime-tools:end -->';
const GITNEXUS_START = '<!-- gitnexus:start -->';

function removeManagedRuntimeToolsBlock(existing) {
  const startIdx = existing.indexOf(RUNTIME_TOOLS_START);
  const endIdx = existing.indexOf(RUNTIME_TOOLS_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + RUNTIME_TOOLS_END.length);
    return normalizeRemovalResult(`${before}${after}`);
  }

  if (startIdx !== -1 || endIdx !== -1) {
    return normalizeRemovalResult(stripManagedRuntimeToolsSections(stripStandaloneMarkerLines(existing)));
  }

  return normalizeRemovalResult(existing);
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
    heading !== '## 代码智能与运行时工具' &&
    heading !== '## 代码智能与运行时工具（由 spec-first 管理）' &&
    heading !== '## Runtime Code Intelligence Tools' &&
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

module.exports = {
  RUNTIME_TOOLS_END,
  RUNTIME_TOOLS_START,
  removeManagedRuntimeToolsBlock,
};
