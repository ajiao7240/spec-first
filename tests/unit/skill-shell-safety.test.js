'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SOURCE_ROOTS = [
  path.join(__dirname, '..', '..', 'skills'),
  path.join(__dirname, '..', '..', 'agents'),
];

function walkMarkdownFiles(dir) {
  const out = [];

  if (!fs.existsSync(dir)) return out;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkMarkdownFiles(full));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }

  return out;
}

function listSourceMarkdownFiles() {
  return SOURCE_ROOTS.flatMap(walkMarkdownFiles);
}

function findPreResolutionCommands(body) {
  const found = [];
  const regex = /!`([^`]*)`/g;
  let match;

  while ((match = regex.exec(body)) !== null) {
    const lineNumber = body.slice(0, match.index).split(/\r?\n/).length;
    found.push({ lineNumber, command: match[1] });
  }

  return found;
}

describe('findPreResolutionCommands', () => {
  test('captures single-line `!` blocks with correct line numbers', () => {
    const sample = 'intro\n!`echo hi` mid !`echo bye`\nend';
    expect(findPreResolutionCommands(sample)).toEqual([
      { lineNumber: 2, command: 'echo hi' },
      { lineNumber: 2, command: 'echo bye' },
    ]);
  });

  test('captures multi-line `!` blocks', () => {
    const sample = 'intro\n!`one`\ngap\n!`split\nover\nlines`\nend';
    expect(findPreResolutionCommands(sample)).toEqual([
      { lineNumber: 2, command: 'one' },
      { lineNumber: 4, command: 'split\nover\nlines' },
    ]);
  });
});

describe('skill and agent `!` pre-resolution commands avoid Claude Code shell denylist', () => {
  const files = listSourceMarkdownFiles();

  for (const filePath of files) {
    const rel = path.relative(path.join(__dirname, '..', '..'), filePath);
    const body = fs.readFileSync(filePath, 'utf8');
    const preResolutionCommands = findPreResolutionCommands(body);
    if (preResolutionCommands.length === 0) continue;

    test(`${rel} pre-resolution commands contain no case/esac`, () => {
      const offenders = preResolutionCommands.filter(({ command }) =>
        /\bcase\b/.test(command) && /\besac\b/.test(command),
      );
      const formatted = offenders
        .map(({ lineNumber, command }) => `  line ${lineNumber}: ${command}`)
        .join('\n');

      expect(offenders).toEqual([]);
      if (offenders.length > 0) {
        throw new Error([
          'Claude Code rejects `case ... esac` in `!` pre-resolution commands.',
          'Use if/then/else, &&/|| chaining, or `git rev-parse --path-format=absolute --git-common-dir`.',
          `Offending commands:\n${formatted}`,
        ].join('\n'));
      }
    });
  }
});
