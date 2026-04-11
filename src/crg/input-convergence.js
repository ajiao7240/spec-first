'use strict';

/**
 * CRG 输入收敛流水线
 *
 * 将仓库文件集合经过多阶段过滤，产出 final_inputs + presentLanguages + stats。
 * 流水线顺序：
 *   1. 获取候选文件（tracked-only / tracked+untracked / all-files）
 *   2. iOS 自动模式升级
 *   3. 内置默认排除规则（DEFAULT_EXCLUDES）
 *   4. .spec-first-graphignore 规则
 *   5. extraExcludes / extraIncludes（适配器注入）
 *   6. 安全硬规则（SENSITIVE_PATTERNS，不可被白名单绕过）
 *   7. 二进制扩展名过滤
 *   8. 输出排序
 *   9. 推导 presentLanguages
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 内置默认排除规则（glob 风格） */
const DEFAULT_EXCLUDES = [
  '.git/**',
  '.spec-first-graph/**',
  '.code-review-graph/**',
  'graphify-out/**',
  'node_modules/**',
  'dist/**',
  'build/**',
  '.next/**',
  '.nuxt/**',
  '.turbo/**',
  '.cache/**',
  'coverage/**',
  '.nyc_output/**',
  'DerivedData/**',
  'Carthage/**',
  '.gradle/**',
  '.m2/**',
  'vendor/**',
  'bin/**',
  'target/**',
  '__pycache__/**',
  '.venv/**',
  'venv/**',
  '.pytest_cache/**',
];

/**
 * 安全硬规则（匹配 basename），不可被白名单绕过
 */
const SENSITIVE_PATTERNS = [
  /^\.env(\.|$)/i,               // .env, .env.local, .env.production
  /credentials?\.(json|ya?ml)$/i, // credentials.json, credential.yml
  /secrets?\.(json|ya?ml)$/i,    // secrets.json, secret.yaml
  /\.pem$/i,                     // private keys
  /private[\s_-]?key/i,          // private_key.pem, privatekey.json
];

/** 二进制扩展名集合（小写） */
const BINARY_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'mp4', 'mp3', 'mov', 'avi', 'mkv',
  'zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar',
  'pdf',
  // .lock 排除，但 package-lock.json 和 Podfile.lock 豁免
  'lock',
]);

/** 豁免二进制排除的文件名（basename 精确匹配） */
const BINARY_EXT_EXEMPTIONS = new Set(['package-lock.json', 'podfile.lock']);

/** 扩展名 → 语言 映射 */
const EXT_TO_LANG = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  py: 'python', pyw: 'python',
  go: 'go',
  java: 'java', kt: 'kotlin', kts: 'kotlin',
  rs: 'rust',
  c: 'c', cc: 'cpp', cpp: 'cpp', cxx: 'cpp',
  m: 'objc', mm: 'objc',
  swift: 'swift',
  h: 'c',      // 默认 c，解析层做启发式路由
  hpp: 'cpp', hxx: 'cpp',
  rb: 'ruby',
  php: 'php',
  cs: 'csharp',
  scala: 'scala',
  lua: 'lua',
  dart: 'dart',
};

// ---------------------------------------------------------------------------
// ignore 包懒加载（npm install 后可用）
// ---------------------------------------------------------------------------
let ignoreLib;
try {
  ignoreLib = require('ignore');
} catch {
  // ignore 包未安装，将在 npm install 后可用；此处退化为简单前缀匹配
  ignoreLib = null;
}

// ---------------------------------------------------------------------------
// 纯工具函数（可直接导出用于单元测试）
// ---------------------------------------------------------------------------

/**
 * 判断文件 basename 是否命中安全硬规则
 * @param {string} basename - 文件名（可含路径，取 basename）
 * @returns {boolean}
 */
function isSensitiveFile(basename) {
  const name = path.basename(basename);
  return SENSITIVE_PATTERNS.some((re) => re.test(name));
}

/**
 * 从文件路径列表推导语言集合（基于扩展名，不做第二次扫描）
 * @param {string[]} filePaths - 相对路径数组
 * @returns {Set<string>}
 */
function detectPresentLanguages(filePaths) {
  const langs = new Set();
  for (const fp of filePaths) {
    const ext = fp.split('.').pop().toLowerCase();
    const lang = EXT_TO_LANG[ext];
    if (lang) langs.add(lang);
  }
  return langs;
}

// ---------------------------------------------------------------------------
// glob 匹配（内联轻量实现，处理 ignore 包缺失场景）
// ---------------------------------------------------------------------------

/**
 * 将 gitignore 风格的 glob 模式转为 RegExp
 * 支持：* / ** / ? / 末尾 / / 前缀 /
 *
 * 使用逐字符处理，避免转义链的顺序问题。
 * @param {string} pattern
 * @returns {RegExp}
 */
function globToRegex(pattern) {
  // 末尾 / 表示仅目录，去掉后当作目录前缀匹配（下游 (/|$) 处理）
  const normalized = pattern.replace(/\/+$/, '');

  // 需要判断是否含 /（含 / 的模式从路径根匹配，不含 / 的匹配任意层级）
  // 注意：前导 / 会被去掉，所以先记录再剥离
  const stripped = normalized.startsWith('/') ? normalized.slice(1) : normalized;
  const hasSlash = stripped.includes('/');

  // 逐字符构建正则片段，正确处理 ** 和 *
  let regexBody = '';
  let i = 0;
  while (i < stripped.length) {
    const ch = stripped[i];
    if (ch === '*') {
      if (stripped[i + 1] === '*') {
        // ** → 匹配任意路径（含 /）
        regexBody += '.*';
        i += 2;
        // 跳过紧跟的 /
        if (stripped[i] === '/') i++;
      } else {
        // * → 匹配单段（不含 /）
        regexBody += '[^/]*';
        i++;
      }
    } else if (ch === '?') {
      regexBody += '[^/]';
      i++;
    } else if (/[.+^${}()|[\]\\]/.test(ch)) {
      // 转义正则特殊字符
      regexBody += '\\' + ch;
      i++;
    } else {
      regexBody += ch;
      i++;
    }
  }

  // 无 /（或只含前导 /）：匹配任意层级下的同名文件/目录
  if (!hasSlash) {
    return new RegExp(`(^|/)${regexBody}(/|$)`);
  }
  // 有 /：从路径开头匹配（允许有上层目录前缀）
  return new RegExp(`(^|/)${regexBody}(/|$)`);
}

/**
 * 轻量 gitignore 规则集（当 ignore 包不可用时的 fallback）
 */
class SimpleIgnore {
  constructor() {
    /** @type {Array<{regex: RegExp, negated: boolean}>} */
    this._rules = [];
  }

  /** @param {string[]} lines */
  add(lines) {
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const negated = line.startsWith('!');
      const pattern = negated ? line.slice(1) : line;
      try {
        this._rules.push({ regex: globToRegex(pattern), negated });
      } catch {
        // 无法解析的 pattern 跳过
      }
    }
    return this;
  }

  /**
   * 判断路径是否应被忽略（正向规则排除，! 规则白名单）
   * @param {string} filePath - 相对路径（正斜杠）
   * @returns {boolean}
   */
  ignores(filePath) {
    let ignored = false;
    for (const { regex, negated } of this._rules) {
      if (regex.test(filePath)) {
        ignored = !negated;
      }
    }
    return ignored;
  }
}

/**
 * 构建一个 ignore 实例（优先使用 ignore 包，否则 fallback）
 * @param {string[]} lines
 * @returns {{ ignores: (path: string) => boolean }}
 */
function buildIgnoreFilter(lines) {
  if (ignoreLib) {
    return ignoreLib().add(lines);
  }
  return new SimpleIgnore().add(lines);
}

// ---------------------------------------------------------------------------
// 文件收集（git ls-files / all-files fallback）
// ---------------------------------------------------------------------------

/**
 * 获取 tracked 文件列表；git 不可用时返回 null
 * @param {string} repoRoot
 * @returns {string[] | null}
 */
function getTrackedFiles(repoRoot) {
  try {
    const output = execSync('git ls-files', {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return null; // 非 git 仓库或 git 不可用
  }
}

/**
 * 获取 untracked 文件列表（git status --porcelain 中 ?? 开头）
 * @param {string} repoRoot
 * @returns {string[]}
 */
function getUntrackedFiles(repoRoot) {
  try {
    const output = execSync('git status --porcelain', {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output
      .split('\n')
      .filter((line) => line.startsWith('??'))
      .map((line) => line.slice(3).trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * 递归枚举目录下所有文件（返回相对路径，正斜杠）
 * @param {string} dir - 绝对路径
 * @param {string} base - 基准目录（用于计算相对路径）
 * @param {string[]} result
 */
function walkDir(dir, base, result) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue; // 跳过符号链接，避免循环
    if (entry.isDirectory()) {
      walkDir(full, base, result);
    } else {
      result.push(path.relative(base, full).replace(/\\/g, '/'));
    }
  }
}

/**
 * all-files 模式：递归枚举
 * @param {string} repoRoot
 * @returns {string[]}
 */
function getAllFiles(repoRoot) {
  const result = [];
  walkDir(repoRoot, repoRoot, result);
  return result;
}

// ---------------------------------------------------------------------------
// iOS Podfile.lock 解析
// ---------------------------------------------------------------------------

/**
 * 解析 Podfile.lock，返回三方 Pod 排除路径和本地 Pod 保留路径
 *
 * @param {string} repoRoot
 * @param {string} podlockPath - 相对于 repoRoot 的 Podfile.lock 路径（默认 'Podfile.lock'）
 * @returns {{ excludes: string[], includes: string[] }}
 */
function computePodExcludePaths(repoRoot, podlockPath = 'Podfile.lock') {
  const absPath = path.join(repoRoot, podlockPath);

  // 文件不存在 → 安全降级
  if (!fs.existsSync(absPath)) {
    return { excludes: ['Pods/**'], includes: [] };
  }

  let content;
  try {
    content = fs.readFileSync(absPath, 'utf8');
  } catch {
    return { excludes: ['Pods/**'], includes: [] };
  }

  // 解析 EXTERNAL SOURCES 段
  // 格式示例：
  //   EXTERNAL SOURCES:
  //     MyLocalPod:
  //       :path: ../MyLocalPod
  //     SomePod:
  //       :git: https://...
  const externalSourcesMatch = content.match(
    /^EXTERNAL SOURCES:\n((?:  \S.*\n(?:    .*\n)*)*)/m
  );

  if (!externalSourcesMatch) {
    // 无 EXTERNAL SOURCES 段 → 降级
    return { excludes: ['Pods/**'], includes: [] };
  }

  const block = externalSourcesMatch[1];
  const localPods = new Set();
  const allPods = new Set();

  // 匹配每个 Pod 名称和其属性
  const podBlockRegex = /^  (\S+):\n((?:    .*\n)*)/gm;
  let podMatch;
  while ((podMatch = podBlockRegex.exec(block)) !== null) {
    const podName = podMatch[1].replace(/:$/, '');
    const attrs = podMatch[2];
    allPods.add(podName);
    if (/:path:/i.test(attrs)) {
      localPods.add(podName);
    }
  }

  if (allPods.size === 0) {
    return { excludes: ['Pods/**'], includes: [] };
  }

  const excludes = [];
  const includes = [];

  for (const pod of allPods) {
    if (localPods.has(pod)) {
      // 本地 Pod → 保留
      includes.push(`Pods/${pod}/**`);
    } else {
      // 三方 Pod → 排除
      excludes.push(`Pods/${pod}/**`);
    }
  }

  // 如果没有三方 Pod，也不需要排除整个 Pods/
  return { excludes, includes };
}

// ---------------------------------------------------------------------------
// iOS 自动模式升级检测
// ---------------------------------------------------------------------------

/**
 * 检测 Podfile.lock 中是否存在 EXTERNAL SOURCES 中的 :path: 条目
 * @param {string} repoRoot
 * @returns {boolean}
 */
function hasLocalPods(repoRoot) {
  const absPath = path.join(repoRoot, 'Podfile.lock');
  if (!fs.existsSync(absPath)) return false;
  try {
    const content = fs.readFileSync(absPath, 'utf8');
    const externalSourcesMatch = content.match(
      /^EXTERNAL SOURCES:\n([\s\S]*?)(?=^\S|\Z)/m
    );
    if (!externalSourcesMatch) return false;
    return /:path:/i.test(externalSourcesMatch[1]);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 主函数
// ---------------------------------------------------------------------------

/**
 * 输入收敛流水线：计算 final_inputs
 *
 * @param {string} repoRoot - 仓库根目录绝对路径
 * @param {object} [options]
 * @param {'tracked-only'|'tracked+untracked'|'all-files'} [options.mode='tracked-only']
 * @param {string[]} [options.extraExcludes=[]] - 适配器注入的额外排除规则
 * @param {string[]} [options.extraIncludes=[]] - 适配器注入的额外包含规则（强制保留，但不绕过安全硬规则）
 * @param {boolean} [options.isIos=false] - iOS 项目标志
 * @returns {Promise<{ finalInputs: string[], presentLanguages: Set<string>, stats: object }>}
 */
async function collectInputFiles(repoRoot, options = {}) {
  const startTime = Date.now();

  const {
    mode: userMode = 'tracked-only',
    extraExcludes = [],
    extraIncludes = [],
    isIos = false,
  } = options;

  // 跟踪是否为用户显式设置（用于 iOS 升级逻辑）
  const modeExplicit = options.mode !== undefined;

  // -------------------------------------------------------------------------
  // 步骤 1：获取候选文件集合
  // -------------------------------------------------------------------------
  let effectiveMode = userMode;
  let candidates = [];

  // iOS 自动升级（步骤 2，在候选文件获取前判断）
  // 条件：isIos=true + Podfile.lock 存在 + 有 :path: 本地 Pod + 用户未显式设置 mode
  if (isIos && !modeExplicit && hasLocalPods(repoRoot)) {
    process.stderr.write(
      '[CRG] warn: iOS project with local Pods detected, switching to tracked+untracked mode\n'
    );
    effectiveMode = 'tracked+untracked';
  }

  if (effectiveMode === 'all-files') {
    candidates = getAllFiles(repoRoot);
  } else {
    // tracked-only 或 tracked+untracked：先尝试 git ls-files
    const tracked = getTrackedFiles(repoRoot);
    if (tracked === null) {
      // 非 git 仓库，自动回退到 all-files
      candidates = getAllFiles(repoRoot);
      effectiveMode = 'all-files';
    } else {
      candidates = [...tracked];
      if (effectiveMode === 'tracked+untracked') {
        const untracked = getUntrackedFiles(repoRoot);
        // 合并去重
        const seen = new Set(candidates);
        for (const f of untracked) {
          if (!seen.has(f)) {
            candidates.push(f);
            seen.add(f);
          }
        }
      }
    }
  }

  const inputTotal = candidates.length;

  // 统计被规则排除的文件计数
  const ignoredByRule = {};

  function recordIgnored(rule, filePath) {
    if (!ignoredByRule[rule]) ignoredByRule[rule] = 0;
    ignoredByRule[rule]++;
    void filePath; // 仅统计数量
  }

  // -------------------------------------------------------------------------
  // 步骤 3：应用内置默认排除规则
  // -------------------------------------------------------------------------
  const defaultFilter = buildIgnoreFilter(DEFAULT_EXCLUDES);

  // -------------------------------------------------------------------------
  // 步骤 4：解析 .spec-first-graphignore
  // -------------------------------------------------------------------------
  const graphignorePath = path.join(repoRoot, '.spec-first-graphignore');
  let graphignoreLines = [];
  if (fs.existsSync(graphignorePath)) {
    try {
      const raw = fs.readFileSync(graphignorePath, 'utf8');
      graphignoreLines = raw.split('\n');
    } catch {
      // 文件存在但读取失败，跳过
    }
  }

  // 分离白名单规则（! 开头）和排除规则
  const graphignoreExcludeLines = graphignoreLines.filter(
    (l) => !l.trim().startsWith('!')
  );
  const graphignoreIncludeLines = graphignoreLines
    .filter((l) => l.trim().startsWith('!'))
    .map((l) => l.trim().slice(1)); // 去掉 !，得到需要白名单的模式

  const graphignoreExcludeFilter = buildIgnoreFilter(graphignoreExcludeLines);
  const graphignoreIncludeFilter =
    graphignoreIncludeLines.length > 0
      ? buildIgnoreFilter(graphignoreIncludeLines)
      : null;

  // -------------------------------------------------------------------------
  // 步骤 5：extraExcludes / extraIncludes
  // -------------------------------------------------------------------------
  const extraExcludeFilter =
    extraExcludes.length > 0 ? buildIgnoreFilter(extraExcludes) : null;
  const extraIncludeFilter =
    extraIncludes.length > 0 ? buildIgnoreFilter(extraIncludes) : null;

  // -------------------------------------------------------------------------
  // 步骤 6-7：过滤循环
  // -------------------------------------------------------------------------
  const filtered = [];

  for (const fp of candidates) {
    const normalizedFp = fp.replace(/\\/g, '/');
    const basename = path.basename(normalizedFp);

    // 步骤 6：安全硬规则（最高优先级，不可绕过）
    if (isSensitiveFile(basename)) {
      recordIgnored('sensitive_pattern', normalizedFp);
      continue;
    }

    // 步骤 7：二进制扩展名过滤
    const ext = basename.split('.').pop().toLowerCase();
    if (
      BINARY_EXTS.has(ext) &&
      !BINARY_EXT_EXEMPTIONS.has(basename.toLowerCase())
    ) {
      recordIgnored('binary_ext', normalizedFp);
      continue;
    }

    // 步骤 3：内置默认排除
    if (defaultFilter.ignores(normalizedFp)) {
      recordIgnored('default_exclude', normalizedFp);
      continue;
    }

    // 步骤 5：extraExcludes（在 graphignore 之前处理）
    if (extraExcludeFilter && extraExcludeFilter.ignores(normalizedFp)) {
      // 检查 extraIncludes 能否挽救
      if (extraIncludeFilter && extraIncludeFilter.ignores(normalizedFp)) {
        // extraIncludes 强制保留（已跳过安全硬规则，安全）
      } else {
        recordIgnored('extra_exclude', normalizedFp);
        continue;
      }
    }

    // 步骤 4：.spec-first-graphignore 排除
    if (graphignoreExcludeFilter.ignores(normalizedFp)) {
      // 检查白名单（! 规则）
      if (
        graphignoreIncludeFilter &&
        graphignoreIncludeFilter.ignores(normalizedFp)
      ) {
        // 白名单保留
      } else {
        recordIgnored('graphignore', normalizedFp);
        continue;
      }
    }

    filtered.push(normalizedFp);
  }

  // -------------------------------------------------------------------------
  // 步骤 8：排序（稳定性）
  // -------------------------------------------------------------------------
  filtered.sort();

  // -------------------------------------------------------------------------
  // 步骤 9：推导 presentLanguages
  // -------------------------------------------------------------------------
  const presentLanguages = detectPresentLanguages(filtered);

  // 按语言统计文件数
  const byLanguage = {};
  for (const fp of filtered) {
    const ext = fp.split('.').pop().toLowerCase();
    const lang = EXT_TO_LANG[ext];
    if (lang) {
      byLanguage[lang] = (byLanguage[lang] || 0) + 1;
    }
  }

  const stats = {
    input_files_total: inputTotal,
    input_files_after_ignore: filtered.length,
    input_files_by_language: byLanguage,
    ignored_files_by_rule: ignoredByRule,
    build_duration_ms: Date.now() - startTime,
    effective_mode: effectiveMode,
  };

  return {
    finalInputs: filtered,
    presentLanguages,
    stats,
  };
}

// ---------------------------------------------------------------------------
// 导出
// ---------------------------------------------------------------------------
module.exports = {
  collectInputFiles,
  detectPresentLanguages,
  isSensitiveFile,
  computePodExcludePaths,
  // 导出常量供测试用
  DEFAULT_EXCLUDES,
  SENSITIVE_PATTERNS,
  EXT_TO_LANG,
};
