'use strict';

/**
 * spec-first crg communities --repo=<path>
 *
 * 列出所有社区，附带健康指标（R6）和统计信息。
 */

/**
 * @param {string[]} argv
 */
function run(argv) {
  const { openDb } = require('../cli/open-db');
  const { makeEnvelope } = require('../cli/envelope');

  const { db, repoRoot } = openDb(argv);

  // 查询所有社区，包含健康字段（R6: health.status, health.density, health.independence）
  const rows = db.prepare(`
    SELECT id, label, file_count,
           health_status, health_density, health_independence,
           algorithm, community_source, cohesion, health_note
    FROM communities
    ORDER BY file_count DESC
  `).all();

  // 统计 by_status
  const byStatus = {};
  for (const row of rows) {
    byStatus[row.health_status] = (byStatus[row.health_status] || 0) + 1;
  }

  // 映射为带 health 对象的输出格式
  const items = rows.map(row => ({
    community_id: row.id,
    label: row.label,
    file_count: row.file_count,
    health: {
      status: row.health_status,
      density: row.health_density,
      independence: row.health_independence,
    },
    algorithm: row.algorithm || 'directory',
    community_source: row.community_source || 'directory',
    cohesion: row.cohesion,
    health_note: row.health_note || null,
  }));

  db.close();

  process.stdout.write(
    JSON.stringify(makeEnvelope(repoRoot, {
      items,
      stats: {
        total: items.length,
        by_status: byStatus,
      },
    })) + '\n'
  );
}

module.exports = { run };
