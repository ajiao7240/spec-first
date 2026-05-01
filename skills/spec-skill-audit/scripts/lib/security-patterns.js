'use strict';

const RUNTIME_PATH_PATTERN = '(?:\\.claude(?:/|\\b)|\\.codex(?:/|\\b)|\\.agents/skills(?:/|\\b))';
const RUNTIME_WRITE_VERB_PATTERN = '(?:\\b(?:modify|write|edit|patch|overwrite|fix|update|change|repair)\\b|(?:修改|编辑|覆盖|修复|更新|手改|写入|改动|直接改))';

const DANGEROUS_PATTERNS = [
  {
    code: 'REMOTE_SCRIPT_PIPE',
    severity: 'P0',
    category: 'security',
    regex: /\b(?:curl|wget)\b[^\n|]*\|\s*(?:sudo\s+)?(?:bash|sh)\b/i,
    title: 'Remote script pipe execution',
    recommendation: 'Require explicit human confirmation and avoid piping remote content directly into a shell.',
  },
  {
    code: 'SECRET_READ',
    severity: 'P1',
    category: 'security',
    regex: /(?:\.ssh\b|id_rsa\b|\.env\b|wallet|browser profile|Google\/Chrome|Login Data)/i,
    title: 'Potential secret or credential access',
    recommendation: 'Do not read credentials, browser profiles, wallet data, or environment secrets during skill execution.',
  },
  {
    code: 'GENERATED_RUNTIME_WRITE',
    severity: 'P0',
    category: 'runtime_governance',
    regex: new RegExp(`(?:${RUNTIME_WRITE_VERB_PATTERN}[^\\n]*${RUNTIME_PATH_PATTERN}|${RUNTIME_PATH_PATTERN}[^\\n]*${RUNTIME_WRITE_VERB_PATTERN})`, 'i'),
    title: 'Generated runtime assets may be modified directly',
    recommendation: 'Modify source-of-truth files and rerun init instead of editing generated runtime assets.',
  },
  {
    code: 'IGNORE_GOVERNANCE',
    severity: 'P0',
    category: 'instruction_security',
    regex: /(?:ignore (?:all )?(?:previous|system) instructions|bypass governance|disable guardrails|绕过(?:治理|规则)|忽略(?:系统|治理)指令)/i,
    title: 'Instruction attempts to bypass governance',
    recommendation: 'Remove instructions that ask the agent to ignore system, developer, or governance rules.',
  },
  {
    code: 'DESTRUCTIVE_RM',
    severity: 'P1',
    category: 'security',
    regex: /\brm\s+-[^\n]*r[^\n]*f\b/i,
    title: 'Destructive recursive remove command',
    recommendation: 'Avoid destructive deletion commands or require explicit scoped confirmation.',
  },
  {
    code: 'SUDO_USAGE',
    severity: 'P1',
    category: 'security',
    regex: /\bsudo\b/i,
    title: 'Privileged command usage',
    recommendation: 'Avoid privileged commands in skill automation unless the user explicitly requests them.',
  },
  {
    code: 'CHMOD_777',
    severity: 'P1',
    category: 'security',
    regex: /\bchmod\s+-R\s+777\b/i,
    title: 'Over-broad file permission change',
    recommendation: 'Use the narrowest required permission change and avoid recursive world-writable permissions.',
  },
  {
    code: 'UPLOAD_SECRETS',
    severity: 'P0',
    category: 'security',
    regex: /\b(?:upload|exfiltrate|send|post)\b[^\n]*(?:secret|token|credential|private key|ssh key)/i,
    title: 'Potential secret exfiltration instruction',
    recommendation: 'Never upload or transmit secrets from the user workspace.',
  },
];

const PROHIBITION_HINTS = [
  /\bdo not\b/i,
  /\bnever\b/i,
  /\bavoid\b/i,
  /\bmust not\b/i,
  /\bforbid/i,
  /禁止/,
  /不要/,
  /不得/,
  /避免/,
  /不允许/,
  /只建议/,
];

function classifyPatternContext(line) {
  const text = String(line || '');
  if (PROHIBITION_HINTS.some((hint) => hint.test(text))) {
    return {
      context: 'prohibited_pattern',
      severityOverride: 'P3',
      confidence: 'medium',
    };
  }

  if (/^\s*[-*]\s+/.test(text) && /pattern|风险|高危|danger|threat/i.test(text)) {
    return {
      context: 'documented_pattern',
      severityOverride: 'P3',
      confidence: 'medium',
    };
  }

  if (/^\s*(?:code|regex|title|recommendation|category|severity):/.test(text)) {
    return {
      context: 'documented_pattern',
      severityOverride: 'P3',
      confidence: 'medium',
    };
  }

  return {
    context: 'actionable_pattern',
    severityOverride: null,
    confidence: 'high',
  };
}

module.exports = {
  classifyPatternContext,
  DANGEROUS_PATTERNS,
};
