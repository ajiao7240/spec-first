'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'workflow-invariants');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listFixturePaths() {
  return fs.readdirSync(FIXTURE_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => path.join(FIXTURE_DIR, name));
}

function headingLevel(line) {
  const match = /^(#{1,6})\s+/.exec(line);
  return match ? match[1].length : 0;
}

function headingTitle(line) {
  return line.trim().replace(/\s+#+\s*$/, '');
}

function anchorBlock(markdown, anchor) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => headingTitle(line) === anchor);
  if (start === -1) {
    return {
      ok: false,
      reason: `anchor not found: ${anchor}`,
      block: '',
    };
  }

  const level = headingLevel(lines[start]);
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const currentLevel = headingLevel(lines[index]);
    if (currentLevel > 0 && currentLevel <= level) {
      end = index;
      break;
    }
  }

  return {
    ok: true,
    reason: '',
    block: lines.slice(start, end).join('\n'),
  };
}

function validateInvariant(invariant, fixturePath, index) {
  const prefix = `${path.relative(REPO_ROOT, fixturePath)}[${index}]`;
  const errors = [];
  if (!invariant || typeof invariant !== 'object' || Array.isArray(invariant)) {
    return [`${prefix} must be an object`];
  }
  if (typeof invariant.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(invariant.id)) {
    errors.push(`${prefix}.id must be kebab-case`);
  }
  if (typeof invariant.gate_phrase !== 'string' || invariant.gate_phrase.trim() === '') {
    errors.push(`${prefix}.gate_phrase must be a non-empty canonical phrase`);
  }
  if (Object.prototype.hasOwnProperty.call(invariant, 'aliases')) {
    errors.push(`${prefix}.aliases is not supported in the pilot lens`);
  }
  if (!Array.isArray(invariant.must_appear_in) || invariant.must_appear_in.length === 0 || invariant.must_appear_in.length > 4) {
    errors.push(`${prefix}.must_appear_in must contain 1-4 anchors`);
  } else {
    invariant.must_appear_in.forEach((entry, entryIndex) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        errors.push(`${prefix}.must_appear_in[${entryIndex}] must be an object`);
        return;
      }
      if (typeof entry.file !== 'string' || entry.file.startsWith('/') || entry.file.includes('..') || entry.file.trim() === '') {
        errors.push(`${prefix}.must_appear_in[${entryIndex}].file must be repo-relative`);
      }
      if (typeof entry.anchor !== 'string' || !/^#{1,6}\s+\S/.test(entry.anchor)) {
        errors.push(`${prefix}.must_appear_in[${entryIndex}].anchor must be a markdown heading`);
      }
    });
  }
  return errors;
}

describe('workflow invariant lens', () => {
  test('fixtures stay intentionally small and canonical', () => {
    const errors = [];
    for (const fixturePath of listFixturePaths()) {
      const invariants = readJson(fixturePath);
      if (!Array.isArray(invariants)) {
        errors.push(`${path.relative(REPO_ROOT, fixturePath)} must be an array`);
        continue;
      }
      invariants.forEach((invariant, index) => {
        errors.push(...validateInvariant(invariant, fixturePath, index));
      });
    }

    expect(errors).toEqual([]);
  });

  test('critical workflow invariants appear in every declared anchor block', () => {
    const failures = [];
    for (const fixturePath of listFixturePaths()) {
      const invariants = readJson(fixturePath);
      for (const invariant of invariants) {
        for (const target of invariant.must_appear_in) {
          const absolutePath = path.join(REPO_ROOT, target.file);
          const text = fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : '';
          const block = anchorBlock(text, target.anchor);
          if (!block.ok) {
            failures.push(`${invariant.id}: ${target.file} ${target.anchor}: ${block.reason}`);
            continue;
          }
          if (!block.block.toLowerCase().includes(invariant.gate_phrase.toLowerCase())) {
            failures.push(`${invariant.id}: ${target.file} ${target.anchor}: missing "${invariant.gate_phrase}"`);
          }
        }
      }
    }

    expect(failures).toEqual([]);
  });
});
