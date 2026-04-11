'use strict';

/**
 * spec-first crg affected-flows --since=<sha> --repo=<path>
 *
 * 找出自指定 git commit 以来变更文件所影响的执行流。
 * 若 simple-git 未安装，降级为直接调用 git CLI（通过 child_process）。
 */

const { execFileSync } = require('child_process');

/**
 * 获取自 <sha> 以来变更的文件列表
 *
 * @param {string} repoRoot - 仓库根目录
 * @param {string} since    - 基准 commit SHA
 * @returns {string[]} 变更文件路径列表（相对路径）
 */
function getChangedFiles(repoRoot, since) {
  try {
    const output = execFileSync(
      'git',
      ['diff', '--name-only', since, 'HEAD'],
      { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    return output
      .split('\n')
      .map(f => f.trim())
      .filter(Boolean);
  } catch (err) {
    process.stderr.write(`error: git command failed: ${err.message}\n`);
    process.exit(2);
  }
}

/**
 * @param {string[]} argv
 */
function run(argv) {
  const { openDb } = require('../cli/open-db');
  const { makeEnvelope } = require('../cli/envelope');

  // --since 参数是必填项
  const sinceArg = argv.find(a => a.startsWith('--since='));
  if (!sinceArg) {
    process.stderr.write('error: --since=<sha> is required\n');
    process.exit(1);
  }
  const since = sinceArg.slice('--since='.length);

  const { db, repoRoot } = openDb(argv);

  // 获取变更文件列表
  const changedFiles = getChangedFiles(repoRoot, since);

  if (changedFiles.length === 0) {
    db.close();
    process.stdout.write(
      JSON.stringify(makeEnvelope(repoRoot, { items: [] })) + '\n'
    );
    return;
  }

  // 分块查询（避免超出 SQLite SQLITE_MAX_VARIABLE_NUMBER=999）
  const CHUNK_SIZE = 900;
  const allAffectedRows = [];
  for (let i = 0; i < changedFiles.length; i += CHUNK_SIZE) {
    const chunk = changedFiles.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map(() => '?').join(', ');
    const rows = db.prepare(`
      SELECT DISTINCT
        f.id AS flow_id,
        f.entry_node_id,
        f.criticality,
        n.id AS node_id,
        n.name AS node_name,
        n.file_path,
        n.kind,
        fn.position
      FROM flow_nodes fn
      JOIN nodes n ON fn.node_id = n.id
      JOIN flows f ON fn.flow_id = f.id
      WHERE n.file_path IN (${placeholders})
      ORDER BY f.criticality DESC, fn.position ASC
    `).all(...chunk);
    allAffectedRows.push(...rows);
  }
  const affectedRows = allAffectedRows;

  // 按 flow 分组
  const flowMap = new Map();
  for (const row of affectedRows) {
    if (!flowMap.has(row.flow_id)) {
      flowMap.set(row.flow_id, {
        flow_id: row.flow_id,
        entry_node: row.entry_node_id,
        criticality: row.criticality,
        affected_nodes: [],
      });
    }
    flowMap.get(row.flow_id).affected_nodes.push({
      id: row.node_id,
      name: row.node_name,
      file_path: row.file_path,
      kind: row.kind,
      position: row.position,
      confidence: 'Inferred',
      source_tier: 'crg_ast',
      inference_reason: 'call_graph_traversal',
    });
  }

  db.close();

  const items = Array.from(flowMap.values());

  process.stdout.write(
    JSON.stringify(makeEnvelope(repoRoot, { since, changed_files: changedFiles, items })) + '\n'
  );
}

module.exports = { run };
