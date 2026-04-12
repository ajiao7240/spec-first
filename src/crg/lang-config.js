'use strict';

/**
 * CRG 语言配置中心
 *
 * 每种语言一条记录：{ exts, pkg, load }
 *   - exts : 文件扩展名列表（小写，不含点）
 *   - pkg  : 对应的 tree-sitter npm 包名
 *   - load : 从 require(pkg) 结果提取语言对象的函数
 *
 * 设计说明：
 *   - TypeScript / TSX 共享同一 pkg，load 函数分别取 .typescript / .tsx
 *   - PHP 需取 .php 子对象（含 nodeTypeInfo）
 *   - C# 需传整个模块对象（binding 需要 nodeTypeInfo 做 nodeSubclasses 查表）
 *   - lua / dart 没有稳定可用的 tree-sitter 包，不在此表；
 *     input-convergence.js 的 EXT_TO_LANG 保留这两条用于 presentLanguages 检测。
 */
const LANG_CONFIG = {
  javascript: {
    exts: ['js', 'jsx', 'mjs', 'cjs'],
    pkg: 'tree-sitter-javascript',
    load: (m) => m,
  },
  typescript: {
    exts: ['ts', 'mts', 'cts'],
    pkg: 'tree-sitter-typescript',
    load: (m) => m.typescript,
  },
  tsx: {
    exts: ['tsx'],
    pkg: 'tree-sitter-typescript',
    load: (m) => m.tsx,
  },
  python: {
    exts: ['py', 'pyw'],
    pkg: 'tree-sitter-python',
    load: (m) => m,
  },
  go: {
    exts: ['go'],
    pkg: 'tree-sitter-go',
    load: (m) => m,
  },
  java: {
    exts: ['java'],
    pkg: 'tree-sitter-java',
    load: (m) => m,
  },
  rust: {
    exts: ['rs'],
    pkg: 'tree-sitter-rust',
    load: (m) => m,
  },
  c: {
    exts: ['c', 'h'],           // .h 默认路由到 c；parseFile 中做 ObjC 启发式升级
    pkg: 'tree-sitter-c',
    load: (m) => m,
  },
  cpp: {
    exts: ['cc', 'cpp', 'cxx', 'hpp', 'hxx'],
    pkg: 'tree-sitter-cpp',
    load: (m) => m,
  },
  objc: {
    exts: ['m', 'mm'],
    pkg: 'tree-sitter-objc',
    load: (m) => m,
  },
  swift: {
    exts: ['swift'],
    pkg: 'tree-sitter-swift',
    load: (m) => m,
  },
  kotlin: {
    exts: ['kt', 'kts'],
    pkg: 'tree-sitter-kotlin',
    load: (m) => m,
  },
  ruby: {
    exts: ['rb'],
    pkg: 'tree-sitter-ruby',
    load: (m) => m,
  },
  php: {
    exts: ['php'],
    pkg: 'tree-sitter-php',
    // tree-sitter-php 导出 { php, php_only }，各为 { name, language, nodeTypeInfo }
    load: (m) => m.php,
  },
  csharp: {
    exts: ['cs'],
    pkg: 'tree-sitter-c-sharp',
    // 必须传整个模块对象：binding 需要 nodeTypeInfo 做 nodeSubclasses 查表
    load: (m) => m,
  },
  scala: {
    exts: ['scala', 'sc'],
    pkg: 'tree-sitter-scala',
    load: (m) => m,
  },
};

// ---------------------------------------------------------------------------
// 派生工具函数
// ---------------------------------------------------------------------------

/**
 * 从 LANG_CONFIG 构建扩展名 → 语言名映射。
 * 用于替换 parser.js 中的 extMap 和 input-convergence.js 中 EXT_TO_LANG 的
 * 可解析语言部分（lua / dart 等无 tree-sitter 的条目由调用方自行补充）。
 *
 * @returns {{ [ext: string]: string }}
 */
function buildExtToLang() {
  const map = Object.create(null);
  for (const [lang, cfg] of Object.entries(LANG_CONFIG)) {
    for (const ext of cfg.exts) {
      map[ext] = lang;
    }
  }
  return map;
}

/**
 * 从 LANG_CONFIG 构建"当前 parser 可实际入图"的扩展名 Set。
 * 与 LANG_CONFIG 保持同步，无需手动维护。
 *
 * @returns {Set<string>}
 */
function buildIndexableExts() {
  const s = new Set();
  for (const cfg of Object.values(LANG_CONFIG)) {
    for (const ext of cfg.exts) {
      s.add(ext);
    }
  }
  return s;
}

module.exports = { LANG_CONFIG, buildExtToLang, buildIndexableExts };
