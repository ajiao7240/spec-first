'use strict';

/**
 * CRG 输入收敛流水线
 *
 * 将仓库文件集合经过多阶段过滤，产出 final_inputs + presentLanguages + stats。
 * 流水线顺序：
 *   1. 获取候选文件（tracked-only / tracked+untracked / all-files）
 *   2. iOS 自动模式升级
 *   3. 内置默认排除规则（DEFAULT_EXCLUDES）
 *   4. .spec-firstignore 规则
 *   5. extraExcludes / extraIncludes（适配器注入）
 *   6. 安全硬规则（SENSITIVE_PATTERNS，不可被白名单绕过）
 *   7. 二进制扩展名过滤
 *   8. 语言过滤（EXT_TO_LANG，只保留可解析的代码文件）
 *   9. 输出排序
 *  10. 推导 presentLanguages
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { buildIndexableExts } = require('./lang-config');
const { GRAPH_IGNORE_FILE } = require('./artifact-paths');

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 内置默认排除规则（glob 风格） */
const DEFAULT_EXCLUDES = [
  '.git/**',
  '.claude/**',
  '.codex/**',
  '.agents/**',
  '.spec-first/**',
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
  'bin/Debug/**',
  'bin/Release/**',
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

/**
 * 扩展名 → 语言映射（宽口径，用于 detectPresentLanguages 报告）
 *
 * 设计说明：
 *   此表的"语言"是面向用户的语言族归属，与 lang-config.js 中 LANG_CONFIG 的 parser key 有意不同：
 *   - tsx → 'typescript'：TSX 在用户报告中归属 TypeScript 语系
 *   - LANG_CONFIG 中 tsx 是独立 key，因为 tree-sitter-typescript 导出 .typescript / .tsx 两个不同 grammar
 *   lua / dart 仅在此表用于报告，无对应 tree-sitter 包，不在 LANG_CONFIG 中。
 */
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
  lua: 'lua',   // 无 tree-sitter 包，仅用于 presentLanguages 报告
  dart: 'dart', // 同上
};

/**
 * 当前 parser 真正可索引的扩展名集合。
 *
 * 说明：
 * - EXT_TO_LANG 表示”语言识别口径”，可用于 presentLanguages 等轻量检测（含 lua/dart 等无 tree-sitter 的语言）。
 * - INDEXABLE_EXTS 表示”当前 parser 能实际入图的口径”，由 LANG_CONFIG 自动派生，与 parser.js 永远同步。
 */
const INDEXABLE_EXTS = buildIndexableExts();

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
  // 有 /：从路径开头根锚点匹配（gitignore 语义：/foo 只匹配仓库根下的 foo）
  return new RegExp(`^${regexBody}(/|$)`);
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
      maxBuffer: 256 * 1024 * 1024, // 256 MB：大型 monorepo（万级文件）不 ENOBUFS
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
      maxBuffer: 256 * 1024 * 1024,
    });
    const entries = output
      .split('\n')
      .filter((line) => line.startsWith('??'))
      .map((line) => line.slice(3).trim())
      .filter(Boolean);

    const files = [];
    for (const entry of entries) {
      const normalized = entry.replace(/\\/g, '/').replace(/\/+$/, '');
      const absPath = path.join(repoRoot, normalized);

      let stat;
      try {
        stat = fs.statSync(absPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        walkDir(absPath, repoRoot, files);
      } else {
        files.push(normalized);
      }
    }

    return files;
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

  // 策略：Pods/** 兜底排除，仅白名单本地 :path: Pod
  //
  // 设计依据（业界实践）：
  //   CocoaPods 项目的 Podfile.lock 只在 EXTERNAL SOURCES 段列出非 registry Pod。
  //   PODS 段列出所有 Pod，但数量可达数百，且子 spec（AFNetworking/NSURLSession）
  //   与顶级目录（Pods/AFNetworking/）共用一个物理目录，无法一一枚举安全。
  //   最稳健的方案：blanket exclude Pods/**，仅 include 有业务价值的本地 :path: Pod。
  //
  // 与旧策略对比：
  //   旧策略：枚举 EXTERNAL SOURCES 中的 11 个 Pod → 遗漏 100+ 三方 Pod
  //   新策略：Pods/** → 覆盖所有三方 Pod；:path: 白名单 → 保留本地业务 Pod

  // 解析 EXTERNAL SOURCES 段，提取 :path: 本地 Pod
  const externalSourcesMatch = content.match(
    /^EXTERNAL SOURCES:\n((?:  \S[^\n]*\n(?:    [^\n]*\n)*)*)/m
  );

  const localPods = new Set();

  if (externalSourcesMatch) {
    const block = externalSourcesMatch[1];
    const podBlockRegex = /^  (\S+):\n((?:    [^\n]*\n)*)/gm;
    let podMatch;
    while ((podMatch = podBlockRegex.exec(block)) !== null) {
      const podName = podMatch[1].replace(/:$/, '');
      const attrs = podMatch[2];
      if (/:path:/i.test(attrs)) {
        localPods.add(podName);
      }
    }
  }

  // 兜底排除 Pods/**；仅白名单本地 Pod
  const includes = [...localPods].map((p) => `Pods/${p}/**`);
  return { excludes: ['Pods/**'], includes };
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
  const { includes } = computePodExcludePaths(repoRoot);
  return includes.length > 0;
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
    extraExcludes: baseExtraExcludes = [],
    extraIncludes: baseExtraIncludes = [],
    isIos = false,
  } = options;

  // 跟踪是否为用户显式设置（用于 iOS 升级逻辑）
  const modeExplicit = options.mode !== undefined;

  // iOS Pod 排除：isIos=true 时解析 Podfile.lock，注入三方 Pod 排除 / 本地 Pod 保留规则
  let extraExcludes = baseExtraExcludes;
  let extraIncludes = baseExtraIncludes;
  if (isIos) {
    const { excludes: podExcludes, includes: podIncludes } = computePodExcludePaths(repoRoot);
    extraExcludes = [...baseExtraExcludes, ...podExcludes];
    extraIncludes = [...baseExtraIncludes, ...podIncludes];
  }

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
  // 步骤 3.5：.gitignore 过滤（仅 all-files 模式）
  //
  // tracked-only / tracked+untracked 模式下 git ls-files 天然跳过 gitignored 文件，
  // 无需重复解析。all-files 模式（git 不可用时的 fallback）需手动读取 .gitignore 补偿。
  //
  // 仅读取仓库根目录的 .gitignore，嵌套子目录的 .gitignore 由 DEFAULT_EXCLUDES
  // 与 graphignore 兜底（复杂的嵌套 .gitignore 语义依赖完整 git 实现，超出 fallback 范围）。
  // -------------------------------------------------------------------------
  let gitignoreFilter = null;
  if (effectiveMode === 'all-files') {
    const gitignorePath = path.join(repoRoot, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      try {
        const raw = fs.readFileSync(gitignorePath, 'utf8');
        gitignoreFilter = buildIgnoreFilter(raw.split('\n'));
      } catch {
        // 读取失败，跳过，不影响其余过滤链
      }
    }
  }

  // -------------------------------------------------------------------------
  // 步骤 4：解析 .spec-firstignore
  // -------------------------------------------------------------------------
  const graphignorePath = path.join(repoRoot, GRAPH_IGNORE_FILE);
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

    // 步骤 3.5：.gitignore 过滤（all-files 模式；tracked 模式由 git 天然处理）
    if (gitignoreFilter && gitignoreFilter.ignores(normalizedFp)) {
      recordIgnored('gitignore', normalizedFp);
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

    // 步骤 4：.spec-firstignore 排除
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

    // 步骤 8：语言过滤（只保留当前 parser 真正可入图的文件）
    // detectPresentLanguages 可识别更宽的语言集合；但阶段0 finalInputs 必须与 parser 能力一致。
    if (!INDEXABLE_EXTS.has(ext)) {
      recordIgnored('no_language', normalizedFp);
      continue;
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
  INDEXABLE_EXTS,
};
