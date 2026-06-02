const RUNTIME_TOOLS_START = '<!-- spec-first:runtime-tools:start -->';
const RUNTIME_TOOLS_END = '<!-- spec-first:runtime-tools:end -->';

function removeManagedRuntimeToolsBlock(existing) {
  const startIdx = existing.indexOf(RUNTIME_TOOLS_START);
  const endIdx = existing.indexOf(RUNTIME_TOOLS_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + RUNTIME_TOOLS_END.length);
    return normalizeRemovalResult(`${before}${after}`);
  }

  if (startIdx !== -1 || endIdx !== -1) {
    return normalizeRemovalResult(stripStandaloneMarkerLines(existing));
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
