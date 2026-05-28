'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const isolatedHome = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-jest-home-'));
process.env.HOME = isolatedHome;
process.env.USERPROFILE = isolatedHome;
