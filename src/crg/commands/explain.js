'use strict';

const { openDb } = require('../cli/open-db');
const { makeEnvelope } = require('../cli/envelope');

function parseArgs(argv) {
  const options = { node: null, detail: 'minimal' };
  for (const arg of argv) {
    if (arg.startsWith('--node=')) options.node = arg.slice('--node='.length);
    else if (arg.startsWith('--symbol=')) options.node = arg.slice('--symbol='.length);
    else if (arg.startsWith('--path=')) options.node = arg.slice('--path='.length);
    else if (arg.startsWith('--detail=')) options.detail = arg.slice('--detail='.length);
  }
  return options;
}

function resolveNode(db, value) {
  return db.prepare(`
    SELECT id, name, file_path, kind, line_start, line_end, community_id, is_test
    FROM nodes
    WHERE id = ? OR name = ? OR file_path = ?
    ORDER BY CASE WHEN id = ? THEN 0 WHEN file_path = ? THEN 1 ELSE 2 END
    LIMIT 1
  `).get(value, value, value, value, value);
}

function run(argv) {
  const options = parseArgs(argv);
  if (!options.node) {
    process.stderr.write('error: --node=<id|name|path> is required\n');
    process.exit(1);
  }
  if (!['minimal', 'standard'].includes(options.detail)) {
    process.stderr.write('error: --detail must be minimal or standard\n');
    process.exit(1);
  }

  const { db, repoRoot } = openDb(argv);
  const node = resolveNode(db, options.node);
  if (!node) {
    db.close();
    process.stdout.write(JSON.stringify(makeEnvelope(repoRoot, {
      query: options.node,
      node: null,
      limitations: [{ code: 'node-not-found', message: 'No CRG node matched the requested identifier.' }],
    })) + '\n');
    return;
  }

  const community = node.community_id
    ? db.prepare('SELECT id AS community_id, label, file_count FROM communities WHERE id = ?').get(node.community_id)
    : null;
  const neighbors = db.prepare(`
    SELECT e.kind AS relation, e.source_id, e.target_id,
           src.name AS source_name, src.file_path AS source_file_path,
           tgt.name AS target_name, tgt.file_path AS target_file_path
    FROM edges e
    JOIN nodes src ON src.id = e.source_id
    JOIN nodes tgt ON tgt.id = e.target_id
    WHERE e.source_id = ? OR e.target_id = ?
    LIMIT ?
  `).all(node.id, node.id, options.detail === 'standard' ? 30 : 8);
  const flows = db.prepare(`
    SELECT f.id AS flow_id, f.name, f.criticality, fn.position
    FROM flow_nodes fn
    JOIN flows f ON f.id = fn.flow_id
    WHERE fn.node_id = ?
    ORDER BY f.criticality DESC
    LIMIT ?
  `).all(node.id, options.detail === 'standard' ? 10 : 3);
  const candidateTests = db.prepare(`
    SELECT DISTINCT file_path
    FROM nodes
    WHERE is_test = 1 AND file_path LIKE ?
    LIMIT 10
  `).all(`%${node.name}%`);

  db.close();

  process.stdout.write(JSON.stringify(makeEnvelope(repoRoot, {
    detail_profile: options.detail,
    node: {
      ...node,
      decision_input_kind: 'observed',
      confidence: 'Observed',
      source_tier: 'crg_ast',
      evidence: [`matched ${options.node}`],
    },
    community,
    neighbors,
    flows,
    candidate_tests: candidateTests,
    limitations: [],
  })) + '\n');
}

module.exports = { run };
