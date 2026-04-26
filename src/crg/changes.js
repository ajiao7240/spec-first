'use strict';

/**
 * CRG changes.js — git diff 解析 + 节点级风险评分
 *
 * 通过 git diff --name-only 获取变更文件，对文件内每个 function/method/class 节点
 * 进行 5因子风险评分（0.0-1.0），输出节点级 review_priorities 和 test_gaps。
 *
 * F1 flow_count      (0.25): 节点参与的执行流数量
 * F2 cross_community (0.15): 来自不同社区的调用方数量
 * F3 is_test_covered (0.30): 有 is_test 节点通过 imports_from 边指向该节点 → 0.05；无 → 0.30
 * F4 security_signal (0.20): 强安全信号，或带安全路径上下文的弱信号
 * F5 caller_count    (0.10): 入边总数（归一化，上限 20）
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { scoreSecuritySignal } = require('./constants');

const LANGUAGE_BY_EXTENSION = {
  '.js': 'javascript',
  '.cjs': 'javascript',
  '.mjs': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.java': 'java',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.swift': 'swift',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.php': 'php',
  '.proto': 'proto',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.md': 'markdown',
};
const DOC_LIKE_ROOT_FILES = new Set(['README.md', 'CHANGELOG.md', 'AGENTS.md', 'CLAUDE.md']);
const PLATFORM_PRIORITY = [
  'mobile-ios',
  'mobile-android',
  'web',
  'backend',
  'desktop',
  'shared-contract',
  'cli',
];

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function splitPath(filePath) {
  return normalizePath(filePath).split('/').filter(Boolean);
}

function sortStrings(values) {
  return unique(values).sort((left, right) => left.localeCompare(right));
}

function sortPlatforms(platforms) {
  return unique(platforms).sort((left, right) => {
    const leftPriority = PLATFORM_PRIORITY.indexOf(left);
    const rightPriority = PLATFORM_PRIORITY.indexOf(right);
    const safeLeft = leftPriority === -1 ? Number.MAX_SAFE_INTEGER : leftPriority;
    const safeRight = rightPriority === -1 ? Number.MAX_SAFE_INTEGER : rightPriority;
    return safeLeft - safeRight || left.localeCompare(right);
  });
}

function inferLanguage(filePath) {
  const normalized = normalizePath(filePath);
  if (!normalized) return null;
  const extension = normalized.includes('.')
    ? normalized.slice(normalized.lastIndexOf('.')).toLowerCase()
    : '';
  return LANGUAGE_BY_EXTENSION[extension] || null;
}

function isDocsLikeFile(filePath) {
  const normalized = normalizePath(filePath);
  if (!normalized) return false;
  return normalized.startsWith('docs/')
    || normalized.startsWith('.github/')
    || DOC_LIKE_ROOT_FILES.has(normalized)
    || normalized.endsWith('.md');
}

function isTestLikeFile(filePath) {
  const normalized = normalizePath(filePath);
  return /(^|\/)(tests?|__tests__)\//.test(normalized)
    || /\.(test|spec)\.[^/]+$/i.test(normalized);
}

function isPackagingFile(filePath) {
  const normalized = normalizePath(filePath);
  return normalized === 'package.json'
    || normalized.startsWith('bin/')
    || normalized.startsWith('scripts/release')
    || normalized.startsWith('.github/workflows/');
}

function isRuntimeRelevantFile(filePath) {
  if (!filePath) return false;
  if (isDocsLikeFile(filePath)) return false;
  if (isTestLikeFile(filePath)) return false;
  return true;
}

function inferModuleBucket(filePath) {
  const parts = splitPath(filePath);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  if (['src', 'tests', 'docs'].includes(parts[0]) && parts[1] && !parts[1].includes('.')) {
    return `${parts[0]}/${parts[1]}/`;
  }
  return `${parts[0]}/`;
}

function inferPlatformsForFile(filePath) {
  const platforms = [];
  const normalized = normalizePath(filePath);
  const parts = splitPath(normalized);
  const extension = normalized.includes('.')
    ? normalized.slice(normalized.lastIndexOf('.')).toLowerCase()
    : '';

  if (normalized.startsWith('ios/') || extension === '.swift') platforms.push('mobile-ios');
  if (normalized.startsWith('android/') || extension === '.kt' || extension === '.kts') platforms.push('mobile-android');
  if (
    normalized.startsWith('src/app/')
    || normalized.startsWith('app/')
    || normalized.startsWith('pages/')
    || normalized.startsWith('components/')
    || ['.tsx', '.jsx', '.css', '.scss', '.sass', '.less', '.html'].includes(extension)
  ) platforms.push('web');
  if (
    normalized.startsWith('server/')
    || normalized.startsWith('api/')
    || normalized.includes('/routes/')
    || normalized.includes('/controllers/')
    || normalized.startsWith('src/main/java/')
    || normalized.startsWith('src/main/kotlin/')
  ) platforms.push('backend');
  if (normalized.startsWith('desktop/') || normalized.includes('/electron/') || normalized.includes('/tauri/')) {
    platforms.push('desktop');
  }
  if (
    normalized.includes('/contracts/')
    || normalized.includes('/schemas/')
    || normalized.includes('/schema/')
    || normalized.includes('/openapi/')
    || extension === '.proto'
  ) platforms.push('shared-contract');
  if (
    normalized.startsWith('src/cli/')
    || normalized.startsWith('skills/')
    || normalized.startsWith('agents/')
    || normalized.startsWith('templates/')
    || normalized.startsWith('bin/')
    || normalized === 'package.json'
  ) platforms.push('cli');
  if (parts[0] === 'src' && platforms.length === 0) platforms.push('cli');
  return unique(platforms);
}

function inferPlatformsFromFiles(changedFiles) {
  const platforms = [];
  for (const filePath of changedFiles || []) platforms.push(...inferPlatformsForFile(filePath));
  return sortPlatforms(platforms);
}

function gateMatchesScope(scope, context) {
  switch (scope) {
    case 'repository':
      return context.runtimeChange;
    case 'cross-module':
      return context.runtimeChange && (
        context.impactedModules.length > 1
        || context.impactedPlatforms.length > 1
        || context.impactedPlatforms.includes('shared-contract')
        || context.impactedPlatforms.length === 1
      );
    case 'cli-surface':
      return context.impactedPlatforms.includes('cli');
    case 'web-surface':
      return context.impactedPlatforms.includes('web');
    case 'backend':
      return context.impactedPlatforms.includes('backend');
    case 'desktop':
      return context.impactedPlatforms.includes('desktop');
    case 'mobile-ios':
      return context.impactedPlatforms.includes('mobile-ios');
    case 'mobile-android':
      return context.impactedPlatforms.includes('mobile-android');
    case 'shared-contract':
      return context.impactedPlatforms.includes('shared-contract');
    case 'packaging':
      return context.changedFiles.some(isPackagingFile);
    case 'crg-surface':
      return context.impactedModules.some((item) => item === 'src/crg/' || item.startsWith('src/crg/'));
    default:
      return false;
  }
}

function selectRecommendedGates(gates, context) {
  if (!Array.isArray(gates) || gates.length === 0) return [];
  if (!context.runtimeChange) return [];

  const matched = gates.filter((gate) => gateMatchesScope(gate.scope, context));
  if (matched.length > 0) {
    return unique(matched.map((gate) => gate.id));
  }

  const fallback = gates.filter((gate) => gate.scope === 'repository' || gate.scope === 'cross-module');
  if (fallback.length > 0) {
    return unique(fallback.map((gate) => gate.id));
  }

  return unique(gates.map((gate) => gate.id));
}

function readPackageScripts(repoRoot) {
  if (!repoRoot) return null;
  try {
    const packagePath = path.join(repoRoot, 'package.json');
    if (!fs.existsSync(packagePath)) return null;
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return pkg && pkg.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : null;
  } catch (_) {
    return null;
  }
}

function inferVerificationProfileFromRepo(repoRoot, impactedPlatforms) {
  const scripts = readPackageScripts(repoRoot);
  if (!scripts) return null;

  const scriptNames = Object.keys(scripts);
  const required = [];
  const optional = [];

  if (scriptNames.some((name) => name === 'test' || /^test(:|$)/.test(name))) {
    required.push({ id: 'unit-tests', scope: 'repository' });
  }
  if (scriptNames.some((name) => /integration/.test(name))) {
    required.push({ id: 'integration-tests', scope: 'cross-module' });
  }
  if (impactedPlatforms.includes('web') && scriptNames.some((name) => /browser|e2e|playwright|smoke/.test(name))) {
    required.push({ id: 'browser-smoke', scope: 'web-surface' });
  }
  if (impactedPlatforms.includes('cli') && scriptNames.some((name) => /smoke|cli/.test(name))) {
    required.push({ id: 'cli-smoke', scope: 'cli-surface' });
  }
  if (scriptNames.some((name) => /contract/.test(name))) {
    optional.push({ id: 'contract-tests', scope: 'shared-contract' });
  }

  if (required.length === 0 && optional.length === 0) return null;
  return {
    platforms: impactedPlatforms,
    required_gates: required,
    optional_gates: optional,
  };
}

function inferFallbackVerificationProfile(impactedPlatforms) {
  const required = [{ id: 'unit-tests', scope: 'repository' }];
  const optional = [];

  if (impactedPlatforms.includes('web')) {
    required.push({ id: 'browser-smoke', scope: 'web-surface' });
    optional.push({ id: 'browser-evidence', scope: 'web-surface' });
  }
  if (impactedPlatforms.includes('cli')) {
    required.push({ id: 'cli-smoke', scope: 'cli-surface' });
  }
  if (impactedPlatforms.includes('shared-contract')) {
    optional.push({ id: 'contract-tests', scope: 'shared-contract' });
  }

  return {
    platforms: impactedPlatforms,
    required_gates: required,
    optional_gates: optional,
  };
}

function determineConfidence({ runtimeChange, impactedPlatforms, verificationProfile, inferredProfile }) {
  if (!runtimeChange) return 'low';
  if (verificationProfile) return impactedPlatforms.length > 0 ? 'high' : 'medium';
  if (inferredProfile) return impactedPlatforms.length > 0 ? 'high' : 'medium';
  return impactedPlatforms.length > 0 ? 'medium' : 'low';
}

function summarizeChangeSurface({
  repoRoot,
  changedFiles = [],
  verificationProfile = null,
} = {}) {
  const normalizedFiles = unique((changedFiles || []).map(normalizePath));
  const runtimeFiles = normalizedFiles.filter(isRuntimeRelevantFile);
  const runtimeChange = runtimeFiles.length > 0;
  const impactedModules = sortStrings(normalizedFiles.map(inferModuleBucket));
  const impactedLanguages = sortStrings(normalizedFiles.map(inferLanguage));
  const impactedPlatforms = runtimeChange ? inferPlatformsFromFiles(runtimeFiles) : [];
  const inferredProfile = runtimeChange
    ? (inferVerificationProfileFromRepo(repoRoot, impactedPlatforms) || inferFallbackVerificationProfile(impactedPlatforms))
    : null;
  const profile = verificationProfile || inferredProfile;
  const recommendationContext = {
    changedFiles: normalizedFiles,
    impactedModules,
    impactedPlatforms,
    runtimeChange,
  };

  return {
    impacted_modules: impactedModules,
    impacted_languages: impactedLanguages,
    impacted_platforms: impactedPlatforms,
    recommended_required_verifications: selectRecommendedGates(
      profile && profile.required_gates,
      recommendationContext
    ),
    recommended_optional_verifications: selectRecommendedGates(
      profile && profile.optional_gates,
      recommendationContext
    ),
    confidence: determineConfidence({
      runtimeChange,
      impactedPlatforms,
      verificationProfile,
      inferredProfile,
    }),
  };
}

/**
 * 获取自 since 以来的变更文件列表（相对于 repoRoot 的路径）
 *
 * @param {string} repoRoot - 仓库根目录
 * @param {string} since - git SHA 或 HEAD~N
 * @returns {{ files: string[], error?: string }}
 */
function getChangedFilesFromGit(repoRoot, since) {
  try {
    const output = execFileSync(
      'git',
      ['diff', '--name-only', since, 'HEAD'],
      { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    const files = output.trim().split('\n').filter(Boolean);
    return { files };
  } catch (e) {
    return { files: [], error: e.message };
  }
}

/**
 * 获取自 since 以来的 hunk 行号范围（相对于变更后文件）
 *
 * @param {string} repoRoot
 * @param {string} since
 * @returns {Array<{ file: string, hunks: Array<{ start: number, end: number }> }>}
 */
function getChangedHunksFromGit(repoRoot, since) {
  try {
    const output = execFileSync(
      'git',
      ['diff', '--unified=0', since, 'HEAD'],
      { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    const result = [];
    let currentFile = null;
    let currentHunks = [];

    for (const line of output.split('\n')) {
      const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
      if (fileMatch) {
        if (currentFile) result.push({ file: currentFile, hunks: currentHunks });
        currentFile = fileMatch[1];
        currentHunks = [];
        continue;
      }

      const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      if (!hunkMatch) continue;
      const start = parseInt(hunkMatch[1], 10);
      const count = hunkMatch[2] === undefined ? 1 : parseInt(hunkMatch[2], 10);
      if (!Number.isFinite(start) || !Number.isFinite(count) || count <= 0) continue;
      currentHunks.push({ start, end: start + count - 1 });
    }

    if (currentFile) result.push({ file: currentFile, hunks: currentHunks });
    return result;
  } catch {
    return [];
  }
}

function intersectsHunks(node, hunks) {
  if (!Array.isArray(hunks) || hunks.length === 0) return true;
  const lineStart = Number.isFinite(node.line_start) ? node.line_start : 0;
  const lineEnd = Number.isFinite(node.line_end) && node.line_end >= lineStart
    ? node.line_end
    : lineStart;
  return hunks.some((hunk) => !(lineEnd < hunk.start || lineStart > hunk.end));
}

/**
 * 计算单个文件的风险等级（基于 fan-in：有多少边指向该文件的 module 节点）
 *
 * @param {string} filePath - 文件路径（与 nodes.file_path 匹配的格式）
 * @param {object} db - better-sqlite3 db 实例
 * @returns {'High'|'Medium'|'Low'}
 */
function assessFileRisk(filePath, db) {
  return assessFileRiskBatch([filePath], db).get(filePath) || 'Low';
}

function assessFileRiskBatch(filePaths, db) {
  const uniquePaths = Array.from(new Set(filePaths || []));
  const riskByFile = new Map(uniquePaths.map((filePath) => [filePath, 'Low']));
  if (!db || uniquePaths.length === 0) return riskByFile;

  try {
    const filePlaceholders = uniquePaths.map(() => '?').join(',');
    const moduleRows = db.prepare(
      `SELECT id, file_path FROM nodes WHERE kind = 'module' AND file_path IN (${filePlaceholders})`
    ).all(...uniquePaths);
    if (moduleRows.length === 0) return riskByFile;

    const moduleIds = moduleRows.map((row) => row.id);
    const moduleIdToFile = new Map(moduleRows.map((row) => [row.id, row.file_path]));
    const idPlaceholders = moduleIds.map(() => '?').join(',');
    const fanInRows = db.prepare(
      `SELECT target_id, COUNT(*) AS cnt FROM edges WHERE target_id IN (${idPlaceholders}) GROUP BY target_id`
    ).all(...moduleIds);
    const fanInByTarget = new Map(fanInRows.map((row) => [row.target_id, row.cnt]));

    for (const moduleId of moduleIds) {
      const filePath = moduleIdToFile.get(moduleId);
      const fanIn = fanInByTarget.get(moduleId) || 0;
      if (fanIn >= 10) riskByFile.set(filePath, 'High');
      else if (fanIn >= 3) riskByFile.set(filePath, 'Medium');
      else riskByFile.set(filePath, 'Low');
    }
  } catch {
    return riskByFile;
  }

  return riskByFile;
}

/**
 * 计算单个节点的5因子风险评分（0.0-1.0）
 *
 * F1 flow_count      (0.25): 节点参与的执行流数量（归一化，上限 10）
 * F2 cross_community (0.15): 来自不同社区的调用方社区数量（归一化，上限 5）
 * F3 is_test_covered (0.30): 有 is_test 节点通过 imports_from 边指向 → 0.05；无 → 0.30
 * F4 security_signal (0.20): 强安全信号 → 0.20；安全路径中的弱信号 → 0.10；否则 0
 * F5 caller_count    (0.10): 入边总数（归一化，上限 20）
 *
 * @param {string} nodeId
 * @param {object} db - better-sqlite3 db 实例
 * @returns {number} 0.0 - 1.0
 */
function assessNodeRisk(nodeId, db) {
  try {
    const node = db.prepare(
      'SELECT id, name, kind, file_path, community_id FROM nodes WHERE id = ?'
    ).get(nodeId);
    if (!node) return 0;

    // F1: 执行流参与数
    const flowCount = db.prepare(
      'SELECT COUNT(*) AS cnt FROM flow_nodes WHERE node_id = ?'
    ).get(nodeId)?.cnt || 0;
    const f1 = Math.min(flowCount / 10, 1.0) * 0.25;

    // F2: 跨社区调用方数量
    let crossCount = 0;
    if (node.community_id !== null && node.community_id !== undefined) {
      crossCount = db.prepare(`
        SELECT COUNT(DISTINCT n.community_id) AS cnt
        FROM edges e
        JOIN nodes n ON e.source_id = n.id
        WHERE e.target_id = ?
          AND n.community_id IS NOT NULL
          AND n.community_id != ?
      `).get(nodeId, node.community_id)?.cnt || 0;
    }
    const f2 = Math.min(crossCount / 5, 1.0) * 0.15;

    // F3: 测试覆盖
    // 先检查直接覆盖：is_test 节点通过 imports_from 边直接指向本节点
    let testCovered = db.prepare(`
      SELECT COUNT(*) AS cnt
      FROM edges e
      JOIN nodes n ON e.source_id = n.id
      WHERE e.target_id = ? AND e.kind = 'imports_from' AND n.is_test = 1
    `).get(nodeId)?.cnt || 0;

    // function/method/class：测试文件通常 import 的是 module 节点，而非直接 import 函数
    // fallback：检查同文件 module 节点是否被 is_test 节点通过 imports_from 覆盖
    if (testCovered === 0 &&
        (node.kind === 'function' || node.kind === 'method' || node.kind === 'class')) {
      testCovered = db.prepare(`
        SELECT COUNT(*) AS cnt
        FROM edges e
        JOIN nodes n ON e.source_id = n.id
        JOIN nodes m ON e.target_id = m.id
        WHERE m.file_path = ? AND m.kind = 'module'
          AND e.kind = 'imports_from' AND n.is_test = 1
      `).get(node.file_path)?.cnt || 0;
    }
    const f3 = testCovered > 0 ? 0.05 : 0.30;

    // F4: 安全信号（强信号与安全路径里的弱信号）
    const f4 = scoreSecuritySignal({ name: node.name, filePath: node.file_path }) * 0.20;

    // F5: 入边总数（caller count）
    const callerCount = db.prepare(
      'SELECT COUNT(*) AS cnt FROM edges WHERE target_id = ?'
    ).get(nodeId)?.cnt || 0;
    const f5 = Math.min(callerCount / 20, 1.0) * 0.10;

    return Math.min(f1 + f2 + f3 + f4 + f5, 1.0);
  } catch {
    return 0;
  }
}

/**
 * 批量计算多节点的5因子风险评分
 * 将 5×N 次查询压缩为 ~6 次批量查询，适合 review-context graph_expansion 场景
 *
 * @param {string[]} nodeIds
 * @param {import('better-sqlite3').Database} db
 * @returns {Map<string, number>} nodeId → 风险评分 (0-1)
 */
function assessNodeRiskBatch(nodeIds, db) {
  if (nodeIds.length === 0) return new Map();

  const CHUNK_SIZE = 900;
  const result = new Map();

  // 批量加载节点基本信息
  const nodeMap = new Map();
  for (let i = 0; i < nodeIds.length; i += CHUNK_SIZE) {
    const chunk = nodeIds.slice(i, i + CHUNK_SIZE);
    const ph = chunk.map(() => '?').join(',');
    db.prepare(
      `SELECT id, name, kind, file_path, community_id FROM nodes WHERE id IN (${ph})`
    ).all(...chunk).forEach(row => nodeMap.set(row.id, row));
  }

  // F1: flow 参与数
  const f1Map = new Map();
  for (let i = 0; i < nodeIds.length; i += CHUNK_SIZE) {
    const chunk = nodeIds.slice(i, i + CHUNK_SIZE);
    const ph = chunk.map(() => '?').join(',');
    db.prepare(
      `SELECT node_id, COUNT(*) AS cnt FROM flow_nodes WHERE node_id IN (${ph}) GROUP BY node_id`
    ).all(...chunk).forEach(row => f1Map.set(row.node_id, row.cnt));
  }

  // F2: 跨社区调用方数（单次 JOIN 查询，过滤 caller.community_id != target.community_id）
  const f2Map = new Map();
  for (let i = 0; i < nodeIds.length; i += CHUNK_SIZE) {
    const chunk = nodeIds.slice(i, i + CHUNK_SIZE);
    const ph = chunk.map(() => '?').join(',');
    db.prepare(`
      SELECT e.target_id, COUNT(DISTINCT caller.community_id) AS cnt
      FROM edges e
      JOIN nodes caller ON e.source_id = caller.id
      JOIN nodes tgt    ON e.target_id  = tgt.id
      WHERE e.target_id IN (${ph})
        AND caller.community_id IS NOT NULL
        AND tgt.community_id IS NOT NULL
        AND caller.community_id != tgt.community_id
      GROUP BY e.target_id
    `).all(...chunk).forEach(row => f2Map.set(row.target_id, row.cnt));
  }

  // F3 直接覆盖: is_test 节点 imports_from 直接指向本节点
  const f3DirectMap = new Map();
  for (let i = 0; i < nodeIds.length; i += CHUNK_SIZE) {
    const chunk = nodeIds.slice(i, i + CHUNK_SIZE);
    const ph = chunk.map(() => '?').join(',');
    db.prepare(`
      SELECT e.target_id, COUNT(*) AS cnt
      FROM edges e
      JOIN nodes n ON e.source_id = n.id
      WHERE e.target_id IN (${ph}) AND e.kind = 'imports_from' AND n.is_test = 1
      GROUP BY e.target_id
    `).all(...chunk).forEach(row => f3DirectMap.set(row.target_id, row.cnt));
  }

  // F3 module fallback: function/method/class 节点 → 同文件 module 的覆盖
  // 仅对无直接覆盖的 function/method/class 节点执行
  const f3ModuleMap = new Map(); // file_path → covered
  const fallbackFiles = new Set();
  for (const [nodeId, node] of nodeMap) {
    if ((node.kind === 'function' || node.kind === 'method' || node.kind === 'class') &&
        !(f3DirectMap.get(nodeId) > 0)) {
      fallbackFiles.add(node.file_path);
    }
  }
  if (fallbackFiles.size > 0) {
    const filePaths = Array.from(fallbackFiles);
    for (let i = 0; i < filePaths.length; i += CHUNK_SIZE) {
      const chunk = filePaths.slice(i, i + CHUNK_SIZE);
      const ph = chunk.map(() => '?').join(',');
      db.prepare(`
        SELECT m.file_path, COUNT(*) AS cnt
        FROM edges e
        JOIN nodes n ON e.source_id = n.id
        JOIN nodes m ON e.target_id = m.id
        WHERE m.file_path IN (${ph}) AND m.kind = 'module'
          AND e.kind = 'imports_from' AND n.is_test = 1
        GROUP BY m.file_path
      `).all(...chunk).forEach(row => f3ModuleMap.set(row.file_path, row.cnt > 0));
    }
  }

  // F5: 入边总数
  const f5Map = new Map();
  for (let i = 0; i < nodeIds.length; i += CHUNK_SIZE) {
    const chunk = nodeIds.slice(i, i + CHUNK_SIZE);
    const ph = chunk.map(() => '?').join(',');
    db.prepare(
      `SELECT target_id, COUNT(*) AS cnt FROM edges WHERE target_id IN (${ph}) GROUP BY target_id`
    ).all(...chunk).forEach(row => f5Map.set(row.target_id, row.cnt));
  }

  // 组合计算各节点评分
  for (const nodeId of nodeIds) {
    const node = nodeMap.get(nodeId);
    if (!node) { result.set(nodeId, 0); continue; }

    const f1 = Math.min((f1Map.get(nodeId) || 0) / 10, 1.0) * 0.25;
    const f2 = Math.min((f2Map.get(nodeId) || 0) / 5, 1.0) * 0.15;

    const directCovered = (f3DirectMap.get(nodeId) || 0) > 0;
    const moduleCovered = fallbackFiles.has(node.file_path)
      ? (f3ModuleMap.get(node.file_path) || false)
      : false;
    const f3 = (directCovered || moduleCovered) ? 0.05 : 0.30;

    const f4 = scoreSecuritySignal({ name: node.name, filePath: node.file_path }) * 0.20;
    const f5 = Math.min((f5Map.get(nodeId) || 0) / 20, 1.0) * 0.10;

    result.set(nodeId, Math.min(f1 + f2 + f3 + f4 + f5, 1.0));
  }

  return result;
}

/**
 * 获取变更文件中包含的函数/方法节点（风险等级继承文件级别）
 *
 * @param {string} filePath
 * @param {object} db
 * @returns {Array<{ name: string, kind: string, risk_level: string }>}
 */
function getAffectedFunctions(filePath, hunks, db) {
  try {
    const nodes = db.prepare(
      "SELECT name, kind, line_start, line_end FROM nodes WHERE file_path = ? AND kind IN ('function', 'method')"
    ).all(filePath);
    const scopedNodes = Array.isArray(hunks) && hunks.length > 0
      ? nodes.filter((node) => intersectsHunks(node, hunks))
      : nodes;

    const risk = assessFileRisk(filePath, db);
    return scopedNodes.map(n => ({
      name: n.name,
      kind: n.kind,
      risk_level: risk, // 函数级别暂继承文件级别风险
    }));
  } catch {
    return [];
  }
}

/**
 * 获取变更文件中节点级5因子评分，生成 review_priorities 和 test_gaps
 *
 * @param {string} filePath
 * @param {object} db
 * @returns {{ review_priorities: Array, test_gaps: Array }}
 */
function assessNodePriorities(filePath, hunks, db) {
  try {
    const nodes = db.prepare(
      `SELECT id, name, kind, line_start, line_end
       FROM nodes
       WHERE file_path = ? AND kind IN ('function', 'method', 'class')`
    ).all(filePath);

    const scopedNodes = Array.isArray(hunks) && hunks.length > 0
      ? nodes.filter((node) => intersectsHunks(node, hunks))
      : nodes;

    if (scopedNodes.length === 0) return { review_priorities: [], test_gaps: [] };

    // 批量评分，避免 N+1
    const nodeIds = scopedNodes.map(n => n.id);
    const riskScores = assessNodeRiskBatch(nodeIds, db);

    const scored = scopedNodes.map(n => ({
      id: n.id,
      name: n.name,
      kind: n.kind,
      score: riskScores.get(n.id) || 0,
    }));

    // review_priorities: 按 score 降序排列，取前 10
    const review_priorities = scored
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ name, kind, score }) => ({ name, kind, score }));

    // test_gaps: 直接覆盖 OR module 级覆盖均无的节点
    // 文件内所有节点共享同一 file_path，module 覆盖一次查询即可
    const stmtDirect = db.prepare(`
      SELECT COUNT(*) AS cnt FROM edges e
      JOIN nodes src ON e.source_id = src.id
      WHERE e.target_id = ? AND e.kind = 'imports_from' AND src.is_test = 1
    `);
    const moduleTestCovered = (db.prepare(`
      SELECT COUNT(*) AS cnt
      FROM edges e
      JOIN nodes n ON e.source_id = n.id
      JOIN nodes m ON e.target_id = m.id
      WHERE m.file_path = ? AND m.kind = 'module'
        AND e.kind = 'imports_from' AND n.is_test = 1
    `).get(filePath)?.cnt || 0) > 0;

    const test_gaps = scored
      .filter(n =>
        (stmtDirect.get(n.id)?.cnt || 0) === 0 && !moduleTestCovered
      )
      .map(({ name, kind }) => ({ name, kind }));

    return { review_priorities, test_gaps };
  } catch {
    return { review_priorities: [], test_gaps: [] };
  }
}

/**
 * 主入口：获取自 since 以来的变更分析结果
 *
 * @param {string} repoRoot - 仓库根目录
 * @param {string} since - git SHA 或 HEAD~N
 * @param {object|null} db - better-sqlite3 db 实例（null 时 risk_level='Unknown'）
 * @returns {Array<{ file: string, risk_level: string, functions: Array }>}
 * @throws {Error} since 为无效 git ref 时抛出，err.isUserError=true
 */
function detectChanges(repoRoot, since, db) {
  const { files, error } = getChangedFilesFromGit(repoRoot, since);
  const hunksByFile = new Map(
    getChangedHunksFromGit(repoRoot, since).map((item) => [item.file, item.hunks])
  );

  if (error) {
    // 无效 git ref — 用户输错了，语义上是 exit 1
    if (
      error.includes('unknown revision') ||
      error.includes('bad revision') ||
      error.includes('Not a valid object name')
    ) {
      const err = new Error(`invalid git ref: ${since}`);
      err.isUserError = true;
      throw err;
    }
    // 其他错误（如不在 git 仓库中）继续返回空列表，由调用方决定处理
  }

  const fileRiskLevels = db ? assessFileRiskBatch(files, db) : new Map();

  return files.map(file => {
    const hunks = hunksByFile.get(file) || [];
    const risk_level = db ? (fileRiskLevels.get(file) || 'Low') : 'Unknown';
    const functions = db ? getAffectedFunctions(file, hunks, db) : [];
    const { review_priorities, test_gaps } = db
      ? assessNodePriorities(file, hunks, db)
      : { review_priorities: [], test_gaps: [] };
    return { file, risk_level, functions, review_priorities, test_gaps, hunks };
  });
}

module.exports = {
  detectChanges,
  getChangedFilesFromGit,
  getChangedHunksFromGit,
  assessFileRisk,
  assessFileRiskBatch,
  assessNodeRisk,
  assessNodeRiskBatch,
  inferPlatformsFromFiles,
  summarizeChangeSurface,
};
