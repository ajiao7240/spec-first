'use strict';

/**
 * CRG 安全关键词列表（共 25 个）
 * flows.js 的 security_score 和 changes.js 的 F4 因子均从此处引用，禁止各自内联。
 */
const SECURITY_KEYWORDS = new Set([
  'auth', 'login', 'password', 'token', 'session', 'crypt', 'secret',
  'credential', 'permission', 'sql', 'query', 'execute', 'connect',
  'socket', 'request', 'http', 'sanitize', 'validate', 'encrypt',
  'decrypt', 'hash', 'sign', 'verify', 'admin', 'privilege',
]);

module.exports = { SECURITY_KEYWORDS };
