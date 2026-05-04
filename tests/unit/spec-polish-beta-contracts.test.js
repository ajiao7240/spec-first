'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SCRIPT_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-polish-beta',
  'scripts',
  'detect-project-type.sh',
);

describe('spec-polish-beta project detection contracts', () => {
  test('detect-project-type avoids Bash 4 associative arrays', () => {
    const text = fs.readFileSync(SCRIPT_PATH, 'utf8');

    expect(text).toContain('Bash 3.2');
    expect(text).toContain('add_mono_hit()');
    expect(text).toContain('paste -sd, -');
    expect(text).not.toContain('declare -A');
    expect(text).not.toContain('MONO_HITS[');
    expect(text).not.toContain('${!MONO_HITS[@]}');
  });

  test('detect-project-type preserves multiple monorepo hit output shape', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-polish-detect-'));

    try {
      execFileSync('git', ['init'], { cwd: tmpDir, stdio: 'ignore' });

      const webDir = path.join(tmpDir, 'apps', 'web');
      const apiDir = path.join(tmpDir, 'apps', 'api');
      fs.mkdirSync(webDir, { recursive: true });
      fs.mkdirSync(path.join(apiDir, 'bin'), { recursive: true });
      fs.writeFileSync(path.join(webDir, 'next.config.js'), 'module.exports = {};\n');
      fs.writeFileSync(path.join(apiDir, 'Gemfile'), 'source "https://rubygems.org"\n');
      fs.writeFileSync(path.join(apiDir, 'bin', 'dev'), '#!/usr/bin/env bash\n');

      const output = execFileSync('bash', [SCRIPT_PATH], {
        cwd: tmpDir,
        encoding: 'utf8',
      }).trim();

      expect(output).toBe('multiple:next@apps/web,rails@apps/api');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
