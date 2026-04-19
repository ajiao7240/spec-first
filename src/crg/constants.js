'use strict';

/**
 * CRG 安全信号：显式区分强信号与带上下文的弱信号。
 *
 * 原则：
 * - 不把 `request/http/query` 这类 Web 高频词直接当安全事实
 * - 弱信号只有在 auth/security/crypto 等安全路径语境里才生效
 * - 这里只提供轻量启发式，供 LLM 消费，不伪装成确定判决
 */
const STRONG_SECURITY_KEYWORDS = new Set([
  'auth', 'login', 'password', 'token', 'session', 'crypt', 'secret',
  'credential', 'permission', 'sanitize', 'encrypt', 'decrypt', 'hash',
  'admin', 'privilege', 'csrf', 'xss', 'jwt', 'oauth', 'rbac', 'acl',
]);

const WEAK_SECURITY_KEYWORDS = new Set([
  'sql', 'verify', 'validate', 'sign', 'connect',
]);

const SECURITY_PATH_HINTS = [
  'auth', 'security', 'crypto', 'permission', 'admin',
  'credential', 'token', 'oauth', 'jwt', 'rbac', 'acl', 'sql',
];

function scoreSecuritySignal({ name, filePath }) {
  const normalizedName = String(name || '').toLowerCase();
  const normalizedPath = String(filePath || '').toLowerCase();
  if (!normalizedName) return 0;

  if ([...STRONG_SECURITY_KEYWORDS].some((keyword) => normalizedName.includes(keyword))) {
    return 1;
  }

  const hasSecurityPathHint = SECURITY_PATH_HINTS.some((hint) => normalizedPath.includes(hint));
  if (
    hasSecurityPathHint &&
    [...WEAK_SECURITY_KEYWORDS].some((keyword) => normalizedName.includes(keyword))
  ) {
    return 0.5;
  }

  return 0;
}

module.exports = {
  STRONG_SECURITY_KEYWORDS,
  WEAK_SECURITY_KEYWORDS,
  SECURITY_PATH_HINTS,
  scoreSecuritySignal,
};
