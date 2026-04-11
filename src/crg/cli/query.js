'use strict';

/**
 * CRG query 子命令：8 种图查询 pattern
 *
 * pattern 列表：
 *   callers_of, callees_of       — 需要 --symbol
 *   importers_of, importees_of   — 需要 --module
 *   dependents_of, dependencies_of — 需要 --module
 *   tests_for                    — 需要 --subject
 *   similar_to                   — 需要 --symbol
 *
 * 查询结果以 FactItem 格式封装，输出标准 envelope JSON。
 */

const path = require('path');
const fs = require('fs');
const { makeEnvelope } = require('./envelope');

// ---------------------------------------------------------------------------
// pattern → 必需参数 映射
// ---------------------------------------------------------------------------

/**
 * 每个 pattern 需要的参数名
 * @type {Record<string, 'symbol'|'module'|'subject'>}
 */
const PATTERN_PARAM = {
  callers_of:      'symbol',
  callees_of:      'symbol',
  importers_of:    'module',
  importees_of:    'module',
  dependents_of:   'module',
  dependencies_of: 'module',
  tests_for:       'subject',
  similar_to:      'symbol',
};

/**
 * pattern → inference_reason 映射
 * @type {Record<string, string>}
 */
const PATTERN_REASON = {
  callers_of:      'call_graph_traversal',
  callees_of:      'call_graph_traversal',
  importers_of:    'import_analysis',
  importees_of:    'import_analysis',
  dependents_of:   'import_analysis',
  dependencies_of: 'import_analysis',
  tests_for:       'naming_convention',
  similar_to:      'directory_proximity',
};

// ---------------------------------------------------------------------------
// 加载 better-sqlite3
// ---------------------------------------------------------------------------

/**
 * 加载 better-sqlite3，失败时 exit 2
 */
function requireSqlite() {
  try {
    return require('better-sqlite3');
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      process.stderr.write(
        'error: CRG native module (better-sqlite3) not installed. Run: npm install\n'
      );
      process.exit(2);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// FactItem 转换
// ---------------------------------------------------------------------------

/**
 * 将数据库节点行转换为 FactItem 格式
 *
 * @param {object} node          - 数据库节点行（至少含 id, name, file_path, kind）
 * @param {string} inferenceReason - 推断原因字符串
 * @returns {object}
 */
function nodeToFactItem(node, inferenceReason) {
  return {
    ...node,
    confidence: 'Inferred',
    source_tier: 'crg_ast',
    evidence: [`query result via ${inferenceReason}`],
    inference_reason: inferenceReason,
  };
}

// ---------------------------------------------------------------------------
// 各 pattern 的查询逻辑
// ---------------------------------------------------------------------------

/**
 * 执行指定 pattern 查询，返回节点行数组
 *
 * @param {object} db       - better-sqlite3 db 实例
 * @param {string} pattern  - 查询类型
 * @param {string} paramVal - 对应参数值（symbol/module/subject）
 * @returns {object[]}
 */
function executeQuery(db, pattern, paramVal) {
  switch (pattern) {
    case 'callers_of': {
      // 找所有调用了 symbol 的节点
      const rows = db
        .prepare(
          `SELECT DISTINCT n.*
           FROM edges e
           JOIN nodes n ON n.id = e.source_id
           WHERE e.target_id = ? AND e.kind = 'calls'`
        )
        .all(paramVal);
      return rows;
    }

    case 'callees_of': {
      // 找 symbol 调用的所有节点
      const rows = db
        .prepare(
          `SELECT DISTINCT n.*
           FROM edges e
           JOIN nodes n ON n.id = e.target_id
           WHERE e.source_id = ? AND e.kind = 'calls'`
        )
        .all(paramVal);
      return rows;
    }

    case 'importers_of': {
      // 找所有导入了 module 的源节点
      const rows = db
        .prepare(
          `SELECT DISTINCT n.*
           FROM edges e
           JOIN nodes n ON n.id = e.source_id
           WHERE e.target_id = ? AND e.kind = 'imports_from'`
        )
        .all(paramVal);
      return rows;
    }

    case 'importees_of': {
      // 找 module 导入的所有目标节点
      const rows = db
        .prepare(
          `SELECT DISTINCT n.*
           FROM edges e
           JOIN nodes n ON n.id = e.target_id
           WHERE e.source_id = ? AND e.kind = 'imports_from'`
        )
        .all(paramVal);
      return rows;
    }

    case 'dependents_of': {
      // 语义等同于 importers_of
      const rows = db
        .prepare(
          `SELECT DISTINCT n.*
           FROM edges e
           JOIN nodes n ON n.id = e.source_id
           WHERE e.target_id = ? AND e.kind = 'imports_from'`
        )
        .all(paramVal);
      return rows;
    }

    case 'dependencies_of': {
      // 语义等同于 importees_of
      const rows = db
        .prepare(
          `SELECT DISTINCT n.*
           FROM edges e
           JOIN nodes n ON n.id = e.target_id
           WHERE e.source_id = ? AND e.kind = 'imports_from'`
        )
        .all(paramVal);
      return rows;
    }

    case 'tests_for': {
      // 找通过 imports_from 边指向 subject 的测试节点
      const rows = db
        .prepare(
          `SELECT DISTINCT n.*
           FROM edges e
           JOIN nodes n ON n.id = e.source_id
           WHERE e.target_id = ? AND e.kind = 'imports_from' AND n.is_test = 1`
        )
        .all(paramVal);
      return rows;
    }

    case 'similar_to': {
      // 在同一社区中的其他节点（社区相似性）
      const rows = db
        .prepare(
          `SELECT *
           FROM nodes
           WHERE community_id = (
             SELECT community_id FROM nodes WHERE id = ?
           )
           AND kind != 'module'
           AND id != ?
           LIMIT 10`
        )
        .all(paramVal, paramVal);
      return rows;
    }

    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// argv 解析
// ---------------------------------------------------------------------------

/**
 * 解析 query 子命令参数
 *
 * @param {string[]} argv
 * @returns {{ repo: string|null, pattern: string|null, symbol: string|null, module: string|null, subject: string|null }}
 */
function parseQueryArgs(argv) {
  let repo = null;
  let pattern = null;
  let symbol = null;
  let mod = null;
  let subject = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--repo=')) {
      repo = arg.slice('--repo='.length);
    } else if (arg === '--repo' && i + 1 < argv.length) {
      repo = argv[++i];
    } else if (arg.startsWith('--pattern=')) {
      pattern = arg.slice('--pattern='.length);
    } else if (arg === '--pattern' && i + 1 < argv.length) {
      pattern = argv[++i];
    } else if (arg.startsWith('--symbol=')) {
      symbol = arg.slice('--symbol='.length);
    } else if (arg === '--symbol' && i + 1 < argv.length) {
      symbol = argv[++i];
    } else if (arg.startsWith('--module=')) {
      mod = arg.slice('--module='.length);
    } else if (arg === '--module' && i + 1 < argv.length) {
      mod = argv[++i];
    } else if (arg.startsWith('--subject=')) {
      subject = arg.slice('--subject='.length);
    } else if (arg === '--subject' && i + 1 < argv.length) {
      subject = argv[++i];
    }
  }

  return { repo, pattern, symbol, module: mod, subject };
}

// ---------------------------------------------------------------------------
// query 子命令入口
// ---------------------------------------------------------------------------

/**
 * query 子命令入口（由 router.js 调用）
 *
 * @param {string[]} argv - router.js 传入的参数
 */
function run(argv) {
  const { repo: repoRaw, pattern, symbol, module: mod, subject } = parseQueryArgs(argv);

  // --pattern 必填
  if (!pattern) {
    process.stderr.write(
      'error: --pattern=<pattern> is required for crg query\n' +
      `Available patterns: ${Object.keys(PATTERN_PARAM).join(', ')}\n`
    );
    process.exit(1);
  }

  // pattern 合法性校验
  if (!Object.prototype.hasOwnProperty.call(PATTERN_PARAM, pattern)) {
    process.stderr.write(
      `error: unknown pattern '${pattern}'\n` +
      `Available patterns: ${Object.keys(PATTERN_PARAM).join(', ')}\n`
    );
    process.exit(1);
  }

  // 参数矩阵校验：每个 pattern 需要特定参数
  const requiredParam = PATTERN_PARAM[pattern];
  const providedValue = requiredParam === 'symbol' ? symbol
    : requiredParam === 'module' ? mod
    : requiredParam === 'subject' ? subject
    : null;

  if (!providedValue) {
    process.stderr.write(
      `error: pattern '${pattern}' requires --${requiredParam}=<value>\n`
    );
    process.exit(1);
  }

  // 校验未期望的参数（参数不匹配时 exit 1）
  // 若传入了不期望的参数，给出警告（不 exit，但 exit 1 是验收标准）
  const unexpectedParams = [];
  if (requiredParam !== 'symbol' && symbol !== null) unexpectedParams.push('--symbol');
  if (requiredParam !== 'module' && mod !== null) unexpectedParams.push('--module');
  if (requiredParam !== 'subject' && subject !== null) unexpectedParams.push('--subject');

  if (unexpectedParams.length > 0) {
    process.stderr.write(
      `error: pattern '${pattern}' does not accept ${unexpectedParams.join(', ')}\n` +
      `It requires --${requiredParam}=<value>\n`
    );
    process.exit(1);
  }

  // --repo 必填
  if (!repoRaw) {
    process.stderr.write('error: --repo=<path> is required for crg query\n');
    process.exit(1);
  }

  const repoRoot = path.resolve(repoRaw);
  const dbPath = path.join(repoRoot, '.spec-first-graph', 'graph.db');

  // 检查图是否已构建
  if (!fs.existsSync(dbPath)) {
    process.stderr.write(
      `error: CRG graph not built. Run: spec-first crg build --repo=${repoRoot}\n`
    );
    process.exit(2);
  }

  // 延迟加载 better-sqlite3
  requireSqlite();

  const { initDatabase } = require('../migrations');

  try {
    const db = initDatabase(dbPath);

    const inferenceReason = PATTERN_REASON[pattern];
    const rows = executeQuery(db, pattern, providedValue);
    const items = rows.map((row) => nodeToFactItem(row, inferenceReason));

    const envelope = makeEnvelope(repoRoot, { items });
    process.stdout.write(JSON.stringify(envelope, null, 2) + '\n');
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    process.exit(2);
  }
}

module.exports = { run, PATTERN_PARAM, PATTERN_REASON, nodeToFactItem, parseQueryArgs };
