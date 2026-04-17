'use strict';

const fs = require('fs');
const path = require('path');

describe('CRG BFS queues', () => {
  test.each([
    'src/crg/flows.js',
    'src/crg/communities.js',
    'src/crg/commands/impact.js',
    'src/crg/commands/review-context.js',
  ])('%s 不再使用 O(n²) 的 queue.shift()', (relativePath) => {
    const absolutePath = path.resolve(__dirname, '..', '..', relativePath);
    const source = fs.readFileSync(absolutePath, 'utf8');
    expect(source).not.toMatch(/queue\.shift\(\)/);
  });
});
