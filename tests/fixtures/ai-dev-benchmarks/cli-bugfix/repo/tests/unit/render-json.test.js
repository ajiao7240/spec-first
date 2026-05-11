'use strict';

const { renderJson } = require('../../src/cli/render-json');

describe('renderJson', () => {
  test('prints parseable JSON', () => {
    expect(() => JSON.parse(renderJson({ ok: true }))).not.toThrow();
  });
});
