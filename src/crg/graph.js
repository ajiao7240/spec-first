'use strict';

/**
 * CRG 图数据层（SQLite CRUD）
 *
 * 功能：
 *   - upsertNodes：批量写入/更新节点
 *   - deleteStaleNodes：删除已删除文件对应的节点（级联删 edges/flow_nodes）
 *   - resolveEdges：将 rawEdges 的 target_name/target_path_raw 解析为 target_id
 *   - upsertEdges：批量写入/更新边
 *   - setUnresolvedEdgeCount：更新 graph_meta 中的未解析边计数
 *
 * 设计原则：
 *   - 外键安全顺序由 build 编排层负责，本模块只管 CRUD
 *   - resolveEdges 两阶段查找 + 缓存，避免 N+1 查询
 *   - community_id 默认 NULL，由后续社区检测步骤填充
 */

/**
 * 批量 upsert 节点到 SQLite nodes 表
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object[]} nodes - parseFile 返回的 nodes 数组
 */
function upsertNodes(db, nodes) {
  if (nodes.length === 0) return;

  const stmt = db.prepare(`
    INSERT INTO nodes (
      id, file_path, name, kind,
      line_start, line_end, is_test, community_id,
      confidence, source_tier, evidence, inference_reason
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      file_path       = excluded.file_path,
      name            = excluded.name,
      kind            = excluded.kind,
      line_start      = excluded.line_start,
      line_end        = excluded.line_end,
      is_test         = excluded.is_test,
      confidence      = excluded.confidence,
      source_tier     = excluded.source_tier,
      evidence        = excluded.evidence,
      inference_reason = excluded.inference_reason
  `);

  const insertAll = db.transaction((nodeList) => {
    for (const node of nodeList) {
      stmt.run(
        node.id,
        node.file_path,
        node.name,
        node.kind,
        node.line_start   ?? 0,
        node.line_end     ?? 0,
        node.is_test      ?? 0,
        node.confidence   ?? 'Observed',
        node.source_tier  ?? 'crg_ast',
        JSON.stringify(node.evidence ?? []),
        node.inference_reason ?? null
      );
    }
  });

  insertAll(nodes);
}

/**
 * 删除 stale 节点（文件已删除时）
 *
 * edges、flow_nodes 通过 ON DELETE CASCADE 自动级联删除。
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string[]} deletedPaths - 被删除的文件路径数组（相对路径）
 */
function deleteStaleNodes(db, deletedPaths) {
  if (deletedPaths.length === 0) return;

  const del = db.prepare(`DELETE FROM nodes WHERE file_path = ?`);

  const deleteAll = db.transaction((paths) => {
    for (const fp of paths) {
      del.run(fp);
    }
  });

  deleteAll(deletedPaths);
}

/**
 * 将 rawEdges 解析为可入库的 canonical edges
 *
 * 四阶段解析策略（含缓存，避免 N+1 查询）：
 *   1. 若 raw edge 已带 target_id，则直接校验该节点是否存在
 *   2. 否则优先按 target_path_raw 精确匹配 module 节点（file_path + kind='module'）
 *   3. 再退而按 target_name 全局查找：唯一匹配直接使用；重名时进入阶段4
 *   4. 重名消歧：过滤与 source 同文件的候选，唯一则采用，否则视为 unresolved
 *   5. 四阶段均失败 → unresolvedCount++，跳过该边（不阻塞构建）
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object[]} rawEdges - parseFile 返回的 rawEdges 数组
 * @param {string} repoRoot - 仓库根目录（当前未使用，预留扩展）
 * @returns {{ resolved: object[], unresolvedCount: number }}
 */
function resolveEdges(db, rawEdges, repoRoot) {
  const resolved = [];
  let unresolvedCount = 0;
  // 使用 Object.create(null) 避免原型链污染：
  //   普通 {} 继承 Object.prototype，symbolCache['toString'] 会返回原生函数而非 undefined
  const nodeIdCache = Object.create(null);

  // ------------------------------------------------------------------
  // 阶段1 缓存：file_path → module 节点 id
  //   key = 文件路径（正斜杠），value = node.id 或 null
  // ------------------------------------------------------------------
  const moduleCache = Object.create(null);
  const hasNode = (nodeId) => {
    if (!nodeId) return false;
    if (nodeIdCache[nodeId] !== undefined) return nodeIdCache[nodeId];
    const row = db.prepare(`SELECT 1 FROM nodes WHERE id = ? LIMIT 1`).get(nodeId);
    nodeIdCache[nodeId] = Boolean(row);
    return nodeIdCache[nodeId];
  };

  const getModuleId = (filePath) => {
    if (moduleCache[filePath] !== undefined) return moduleCache[filePath];
    const normalized = filePath.replace(/\\/g, '/');
    const row = db
      .prepare(
        `SELECT id FROM nodes WHERE file_path = ? AND kind = 'module' LIMIT 1`
      )
      .get(normalized);
    moduleCache[filePath] = row ? row.id : null;
    return moduleCache[filePath];
  };

  // ------------------------------------------------------------------
  // 阶段2 缓存：symbol name → 唯一 node id（非 module 节点）
  //   key = name，value = node.id、null（无匹配）或 '__AMBIGUOUS__'
  //   若全局重名，再尝试同文件精确匹配（同文件优先消歧）
  // ------------------------------------------------------------------
  const symbolCache = Object.create(null);
  const AMBIGUOUS = '__AMBIGUOUS__';

  // 全局查询：返回所有同名节点（非 module）
  const getAllSymbolRows = db.prepare(
    `SELECT id, file_path FROM nodes WHERE name = ? AND kind != 'module'`
  );

  const getSymbolId = (name, srcFile) => {
    if (symbolCache[name] !== undefined) {
      const cached = symbolCache[name];
      // 全局唯一或全局为空：直接返回缓存
      if (cached !== AMBIGUOUS) return cached;
      // 全局重名：尝试同文件精确匹配
      const rows = getAllSymbolRows.all(name);
      const sameFile = rows.filter((r) => r.file_path === srcFile);
      return sameFile.length === 1 ? sameFile[0].id : null;
    }

    const rows = getAllSymbolRows.all(name);
    if (rows.length === 1) {
      symbolCache[name] = rows[0].id;
    } else if (rows.length === 0) {
      symbolCache[name] = null;
    } else {
      symbolCache[name] = AMBIGUOUS;
    }

    const cached = symbolCache[name];
    if (cached !== AMBIGUOUS) return cached;
    // 全局重名：同文件优先消歧
    const sameFile = rows.filter((r) => r.file_path === srcFile);
    return sameFile.length === 1 ? sameFile[0].id : null;
  };

  // ------------------------------------------------------------------
  // 逐条解析
  // ------------------------------------------------------------------
  for (const raw of rawEdges) {
    let targetId = null;

    // 阶段0：raw edge 已自带 target_id
    if (raw.target_id && hasNode(raw.target_id)) {
      targetId = raw.target_id;
    }

    // 阶段1：target_path_raw → module 节点
    if (!targetId && raw.target_path_raw) {
      const normalized = raw.target_path_raw.replace(/\\/g, '/');
      targetId = getModuleId(normalized);
    }

    // 阶段2：target_name → 符号节点（优先同文件消歧）
    if (!targetId && raw.target_name) {
      const srcFile = raw.source_id ? raw.source_id.split('#', 1)[0] : '';
      targetId = getSymbolId(raw.target_name, srcFile);
    }

    if (!targetId) {
      unresolvedCount++;
      continue;
    }

    // 边 id = source_id:target_id:kind（确保幂等）
    const edgeId = `${raw.source_id}:${targetId}:${raw.kind}`;
    resolved.push({
      id: edgeId,
      source_id: raw.source_id,
      target_id: targetId,
      kind: raw.kind,
      weight: 1.0,
    });
  }

  return { resolved, unresolvedCount };
}

/**
 * 批量 upsert edges 到 SQLite edges 表
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object[]} edges - resolveEdges 返回的 resolved 数组
 */
function upsertEdges(db, edges) {
  if (edges.length === 0) return;

  const stmt = db.prepare(`
    INSERT INTO edges (id, source_id, target_id, kind, weight)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      source_id = excluded.source_id,
      target_id = excluded.target_id,
      kind      = excluded.kind,
      weight    = excluded.weight
  `);

  const insertAll = db.transaction((edgeList) => {
    for (const edge of edgeList) {
      stmt.run(
        edge.id,
        edge.source_id,
        edge.target_id,
        edge.kind,
        edge.weight ?? 1.0
      );
    }
  });

  insertAll(edges);
}

/**
 * 将未解析边计数写入 graph_meta 表（id=1 单行）
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} count - 未解析边数量
 */
function setUnresolvedEdgeCount(db, count) {
  db
    .prepare(`UPDATE graph_meta SET unresolved_edge_count = ? WHERE id = 1`)
    .run(count);
}

module.exports = {
  upsertNodes,
  upsertEdges,
  deleteStaleNodes,
  resolveEdges,
  setUnresolvedEdgeCount,
};
