'use strict';

function splitMarkdownFrontmatter(content) {
  const text = String(content || '');
  if (!/^---\r?\n/.test(text)) {
    return { frontmatter: '', body: text, hasFrontmatter: false };
  }

  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return { frontmatter: '', body: text, hasFrontmatter: false, warning: 'UNCLOSED_FRONTMATTER' };
  }

  return {
    frontmatter: match[1],
    body: text.slice(match[0].length),
    hasFrontmatter: true,
  };
}

function parseSimpleFrontmatterFields(frontmatter) {
  const fields = {};
  const warnings = [];

  for (const [index, line] of String(frontmatter || '').split(/\r?\n/).entries()) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) {
      warnings.push({
        code: 'UNPARSED_FRONTMATTER_LINE',
        line: index + 1,
        content: line,
      });
      continue;
    }

    fields[match[1]] = unquoteFrontmatterScalar(match[2].trim());
  }

  return { fields, warnings };
}

function unquoteFrontmatterScalar(value) {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  return value;
}

module.exports = {
  parseSimpleFrontmatterFields,
  splitMarkdownFrontmatter,
};
