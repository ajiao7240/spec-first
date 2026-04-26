'use strict';

const { openDb } = require('../cli/open-db');
const { makeEnvelope } = require('../cli/envelope');

function parseArgs(argv) {
  const options = { from: null, to: null, detail: 'minimal' };
  for (const arg of argv) {
    if (arg.startsWith('--from=')) options.from = arg.slice('--from='.length);
    else if (arg.startsWith('--to=')) options.to = arg.slice('--to='.length);
    else if (arg.startsWith('--detail=')) options.detail = arg.slice('--detail='.length);
  }
  return options;
}

function resolveNode(db, value) {
  return db.prepare(`
    SELECT id, name, file_path, kind
    FROM nodes
    WHERE id = ? OR name = ? OR file_path = ?
    ORDER BY CASE WHEN id = ? THEN 0 WHEN file_path = ? THEN 1 ELSE 2 END
    LIMIT 1
  `).get(value, value, value, value, value);
}

function shortestPath(db, fromId, toId, maxDepth = 6) {
  const rows = db.prepare('SELECT source_id, target_id, kind FROM edges').all();
  const adjacency = new Map();
  for (const row of rows) {
    if (!adjacency.has(row.source_id)) adjacency.set(row.source_id, []);
    adjacency.get(row.source_id).push(row);
  }

  const queue = [{ id: fromId, path: [] }];
  const visited = new Set([fromId]);
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    if (current.path.length >= maxDepth) continue;
    for (const edge of adjacency.get(current.id) || []) {
      const nextPath = current.path.concat(edge);
      if (edge.target_id === toId) return nextPath;
      if (!visited.has(edge.target_id)) {
        visited.add(edge.target_id);
        queue.push({ id: edge.target_id, path: nextPath });
      }
    }
  }
  return null;
}

function run(argv) {
  const options = parseArgs(argv);
  if (!options.from || !options.to) {
    process.stderr.write('error: --from=<node> and --to=<node> are required\n');
    process.exit(1);
  }
  if (!['minimal', 'standard'].includes(options.detail)) {
    process.stderr.write('error: --detail must be minimal or standard\n');
    process.exit(1);
  }

  const { db, repoRoot } = openDb(argv);
  const from = resolveNode(db, options.from);
  const to = resolveNode(db, options.to);
  const limitations = [];

  let pathSegments = null;
  if (!from || !to) {
    limitations.push({
      code: 'path-endpoint-not-found',
      message: 'Could not resolve one or both path endpoints.',
    });
  } else {
    pathSegments = shortestPath(db, from.id, to.id);
    if (!pathSegments) {
      limitations.push({
        code: 'no-path',
        message: 'No directed path found within the default depth.',
      });
    }
  }

  db.close();

  const segments = pathSegments
    ? pathSegments.map((edge) => ({
        relation: edge.kind,
        source_id: edge.source_id,
        target_id: edge.target_id,
        decision_input_kind: 'observed',
      }))
    : [];

  process.stdout.write(JSON.stringify(makeEnvelope(repoRoot, {
    detail_profile: options.detail,
    from,
    to,
    path: segments.length > 0 ? { segments, length: segments.length } : null,
    limitations,
  })) + '\n');
}

module.exports = { run };
