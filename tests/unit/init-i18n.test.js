'use strict';

const { getInitMessages } = require('../../src/cli/init-i18n');

describe('init i18n messages', () => {
  test('zh and en expose the same message keys', () => {
    expect(Object.keys(getInitMessages('zh')).sort()).toEqual(Object.keys(getInitMessages('en')).sort());
  });

  test('zh prompt messages are localized', () => {
    const messages = getInitMessages('zh');

    expect(messages.selectHosts).toContain('宿主');
    expect(messages.selectHosts).not.toContain('Select host');
    expect(messages.developerName).toContain('开发者');
    expect(messages.confirmApply).toContain('应用');
  });

  test('en prompt messages are localized', () => {
    const messages = getInitMessages('en');

    expect(messages.selectHosts).toContain('Select host');
    expect(messages.developerName).toContain('Developer name');
    expect(messages.confirmApply).toContain('Apply these changes');
  });

  test('invalid language falls back to zh', () => {
    expect(getInitMessages('invalid')).toBe(getInitMessages('zh'));
  });

  test('minSelectedError includes the requested count', () => {
    expect(getInitMessages('zh').minSelectedError(2)).toContain('2');
    expect(getInitMessages('zh').minSelectedError(2)).toContain('至少');
    expect(getInitMessages('en').minSelectedError(2)).toContain('2');
    expect(getInitMessages('en').minSelectedError(2)).toContain('at least');
  });
});
