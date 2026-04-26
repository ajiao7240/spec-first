'use strict';

/**
 * spec-first crg architecture --repo=<path>
 *
 * 输出架构全景：hub 节点（god nodes）+ 跨社区边。
 * R8：hub_nodes 排除 kind=module 的文件级节点（godNodes 函数已内置此过滤）。
 */

/**
 * @param {string[]} argv
 */
function run(argv) {
  const { openDb } = require('../cli/open-db');
  const { makeEnvelope } = require('../cli/envelope');
  const { godNodes } = require('../analyze');
  const { readGraphQuality, summarizeGraphQuality } = require('../quality/report');

  const { db, repoRoot } = openDb(argv);

  // hub_nodes：调用 godNodes，结果已是 FactItem[]，已排除 kind=module
  const hubNodes = godNodes(db);

  // 跨社区边：source 和 target 所属社区不同
  const crossEdges = db.prepare(`
    SELECT e.id, e.source_id, e.target_id, e.kind,
           ns.community_id AS source_community,
           nt.community_id AS target_community
    FROM edges e
    JOIN nodes ns ON e.source_id = ns.id
    JOIN nodes nt ON e.target_id = nt.id
    WHERE ns.community_id IS NOT NULL
      AND nt.community_id IS NOT NULL
      AND ns.community_id != nt.community_id
    ORDER BY e.kind, e.source_id
    LIMIT 200
  `).all();

  // 映射字段名匹配 schema（source_id/target_id → source/target）
  const crossEdgeMapped = crossEdges.map(e => ({
    source: e.source_id,
    target: e.target_id,
    kind: e.kind,
    source_community: e.source_community,
    target_community: e.target_community,
  }));

  // coupling warnings：同一对社区间跨边数量 > 10 时告警
  const couplingRows = db.prepare(`
    SELECT ns.community_id AS source_community,
           nt.community_id AS target_community,
           COUNT(*) AS edge_count
    FROM edges e
    JOIN nodes ns ON e.source_id = ns.id
    JOIN nodes nt ON e.target_id = nt.id
    WHERE ns.community_id IS NOT NULL
      AND nt.community_id IS NOT NULL
      AND ns.community_id != nt.community_id
    GROUP BY ns.community_id, nt.community_id
    HAVING COUNT(*) > 10
    ORDER BY edge_count DESC
  `).all();

  const couplingWarnings = couplingRows.map(r =>
    `HIGH_COUPLING: ${r.source_community} ↔ ${r.target_community} (${r.edge_count} edges)`
  );

  db.close();

  process.stdout.write(
    JSON.stringify(makeEnvelope(repoRoot, {
      graph_quality: summarizeGraphQuality(readGraphQuality(repoRoot)),
      hub_nodes: hubNodes,
      cross_community_edges: crossEdgeMapped,
      coupling_warnings: couplingWarnings,
    })) + '\n'
  );
}

module.exports = { run };
