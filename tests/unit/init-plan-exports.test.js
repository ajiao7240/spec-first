'use strict';

const path = require('node:path');

const pkg = require('../../package.json');

describe('init plan package export', () => {
  test('package exports expose only the documented init plan subpath', () => {
    expect(pkg.exports).toMatchObject({
      '.': './bin/spec-first.js',
      './src/cli/init-plan': './src/cli/init-plan.js',
      './src/cli/init-plan.js': './src/cli/init-plan.js',
      './package.json': './package.json',
    });
  });

  test('self-reference require resolves buildInitPlan/applyInitPlan', () => {
    const exported = require('spec-first/src/cli/init-plan');

    expect(typeof exported.buildInitPlan).toBe('function');
    expect(typeof exported.applyInitPlan).toBe('function');
    expect(require.resolve('spec-first/src/cli/init-plan')).toBe(
      path.join(__dirname, '..', '..', 'src', 'cli', 'init-plan.js'),
    );
  });
});
