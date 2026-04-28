#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

let stringWidth;
try {
  stringWidth = require('string-width');
} catch (error) {
  stringWidth = fallbackStringWidth;
}

function fallbackStringWidth(value) {
  let width = 0;
  for (const char of Array.from(String(value ?? ''))) {
    const code = char.codePointAt(0);
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
      continue;
    }
    if (
      code >= 0x1100 &&
      (
        code <= 0x115f ||
        code === 0x2329 ||
        code === 0x232a ||
        (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
        (code >= 0xac00 && code <= 0xd7a3) ||
        (code >= 0xf900 && code <= 0xfaff) ||
        (code >= 0xfe10 && code <= 0xfe19) ||
        (code >= 0xfe30 && code <= 0xfe6f) ||
        (code >= 0xff00 && code <= 0xff60) ||
        (code >= 0xffe0 && code <= 0xffe6) ||
        (code >= 0x20000 && code <= 0x3fffd)
      )
    ) {
      width += 2;
      continue;
    }
    width += 1;
  }
  return width;
}

function displayWidth(value) {
  return stringWidth(String(value ?? ''));
}

function padRight(value, width) {
  const text = String(value ?? '');
  const gap = Math.max(0, width - displayWidth(text));
  return text + ' '.repeat(gap);
}

function renderSeparator(widths) {
  return `| ${widths.map((width) => '-'.repeat(Math.max(3, width))).join(' | ')} |`;
}

function renderSection(section) {
  const title = String(section.title ?? '');
  const headers = Array.isArray(section.headers)
    ? section.headers.map((header) => String(header ?? ''))
    : [];
  const rows = Array.isArray(section.rows) ? section.rows : [];
  const widths = headers.map((header, index) => {
    let maxWidth = displayWidth(header);
    for (const row of rows) {
      const cell = Array.isArray(row) ? row[index] : '';
      maxWidth = Math.max(maxWidth, displayWidth(cell));
    }
    return maxWidth;
  });

  const lines = [title + ':', '```text'];
  lines.push(`| ${headers.map((header, index) => padRight(header, widths[index])).join(' | ')} |`);
  lines.push(renderSeparator(widths));
  for (const row of rows) {
    const cells = headers.map((_, index) => (Array.isArray(row) ? row[index] : ''));
    lines.push(`| ${cells.map((cell, index) => padRight(cell, widths[index])).join(' | ')} |`);
  }
  lines.push('```');
  return lines.join('\n');
}

function main() {
  const input = fs.readFileSync(0, 'utf8').trim();
  if (!input) {
    throw new Error('render-status-block: expected JSON input on stdin');
  }

  const payload = JSON.parse(input);
  const sections = Array.isArray(payload.sections) ? payload.sections : [];
  if (sections.length === 0) {
    return;
  }

  const output = sections.map(renderSection).join('\n\n');
  process.stdout.write(output + '\n');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
