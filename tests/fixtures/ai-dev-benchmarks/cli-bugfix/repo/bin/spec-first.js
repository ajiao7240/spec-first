#!/usr/bin/env node
'use strict';

const { renderJson } = require('../src/cli/render-json');

if (process.argv.includes('--json')) {
  process.stdout.write(renderJson({ ok: true }));
}
