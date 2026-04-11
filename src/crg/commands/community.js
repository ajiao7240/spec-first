'use strict';

/**
 * spec-first crg community --id=<community_id> --repo=<path>
 *
 * 返回单个社区的详情，包含成员节点列表（FactItem 格式）。
 */

/**
 * @param {string[]} argv
 */
function run(argv) {
  const { openDb } = require('../cli/open-db');
  const { makeEnvelope } = require('../cli/envelope');

  // --id 参数是必填项
  const idArg = argv.find(a => a.startsWith('--id='));
  if (!idArg) {
    process.stderr.write('error: --id=<community_id> is required\n');
    process.exit(1);
  }
  const communityId = idArg.slice('--id='.length);

  const { db, repoRoot } = openDb(argv);

  // 查询社区基本信息
  const community = db.prepare(`
    SELECT id, label, file_count, health_status, health_density, health_independence
    FROM communities
    WHERE id = ?
  `).get(communityId);

  if (!community) {
    process.stderr.write(`error: community not found: ${communityId}\n`);
    db.close();
    process.exit(1);
  }

  // 查询该社区的成员节点
  const memberRows = db.prepare(`
    SELECT id, name, file_path, kind, line_start, line_end, is_test
    FROM nodes
    WHERE community_id = ?
    ORDER BY kind, name
  `).all(communityId);

  // 映射为 FactItem 格式（成员节点为 Observed，来源明确）
  const members = memberRows.map(row => ({
    id: row.id,
    name: row.name,
    file_path: row.file_path,
    kind: row.kind,
    line_start: row.line_start,
    line_end: row.line_end,
    is_test: row.is_test,
    confidence: 'Observed',
    source_tier: 'crg_ast',
    evidence: [`community membership from node ${row.id}`],
    inference_reason: null,
  }));

  db.close();

  process.stdout.write(
    JSON.stringify(makeEnvelope(repoRoot, {
      community_id: community.id,
      label: community.label,
      file_count: community.file_count,
      health: {
        status: community.health_status,
        density: community.health_density,
        independence: community.health_independence,
      },
      members,
    })) + '\n'
  );
}

module.exports = { run };
