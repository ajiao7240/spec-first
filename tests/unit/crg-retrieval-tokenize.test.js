'use strict';

const { tokenizeQuery } = require('../../src/crg/retrieval/tokenize');

describe('crg retrieval tokenizer', () => {
  test('支持 Unicode、PascalCase、snake_case 与路径分隔', () => {
    expect(tokenizeQuery('支付PaymentFlow auth_token src/api/user.ts')).toEqual([
      '支付payment',
      'flow',
      'auth',
      'token',
      'src',
      'api',
      'user',
      'ts',
    ]);
  });
});
