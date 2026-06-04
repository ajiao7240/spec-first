#!/usr/bin/env node
'use strict';

const { normalizeSetupFactsFile } = require('../../../src/cli/helpers/setup-facts');

const factsFileIndex = process.argv.indexOf('--facts-file');
const factsFile = factsFileIndex >= 0 ? process.argv[factsFileIndex + 1] : process.argv[2];

if (!factsFile) {
  console.error('normalize-setup-facts: --facts-file required');
  process.exit(2);
}

const normalized = normalizeSetupFactsFile(factsFile);
process.stdout.write(`${JSON.stringify(normalized, null, 2)}\n`);
