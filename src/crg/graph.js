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
 *   - resolveEdges 三阶段查找 + 缓存，避免 N+1 查询
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
      line_start, line_end, is_test, generation_id, parser_quality, summary, retrieval_text, community_id,
      confidence, source_tier, evidence, inference_reason
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      file_path       = excluded.file_path,
      name            = excluded.name,
      kind            = excluded.kind,
      line_start      = excluded.line_start,
      line_end        = excluded.line_end,
      is_test         = excluded.is_test,
      generation_id   = excluded.generation_id,
      parser_quality  = excluded.parser_quality,
      summary         = excluded.summary,
      retrieval_text  = excluded.retrieval_text,
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
        node.generation_id ?? null,
        node.parser_quality ?? 'ok',
        node.summary ?? `${node.kind} ${node.name}`,
        node.retrieval_text ?? `${node.file_path} ${node.kind} ${node.name}`,
        node.confidence   ?? 'Observed',
        node.source_tier  ?? 'crg_ast',
        JSON.stringify(node.evidence ?? []),
        node.inference_reason ?? null
      );
    }
  });

  insertAll(nodes);
}

function upsertChunks(db, chunks) {
  if (chunks.length === 0) return;

  const stmt = db.prepare(`
    INSERT INTO chunks (
      id, node_id, parent_symbol_id, generation_id, file_path,
      kind, name, line_start, line_end, summary, retrieval_text
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      node_id = excluded.node_id,
      parent_symbol_id = excluded.parent_symbol_id,
      generation_id = excluded.generation_id,
      file_path = excluded.file_path,
      kind = excluded.kind,
      name = excluded.name,
      line_start = excluded.line_start,
      line_end = excluded.line_end,
      summary = excluded.summary,
      retrieval_text = excluded.retrieval_text
  `);

  const insertAll = db.transaction((chunkList) => {
    for (const chunk of chunkList) {
      stmt.run(
        chunk.id,
        chunk.node_id,
        chunk.parent_symbol_id,
        chunk.generation_id || null,
        chunk.file_path,
        chunk.kind || 'chunk',
        chunk.name,
        chunk.line_start || 0,
        chunk.line_end || 0,
        chunk.summary || null,
        chunk.retrieval_text || null
      );
    }
  });

  insertAll(chunks);
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
 * @returns {{ resolved: object[], unresolvedCount: number, unresolved: object[] }}
 */
function resolveEdges(db, rawEdges, repoRoot) {
  const resolved = [];
  let unresolvedCount = 0;
  const unresolved = [];
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
  // 阶段1.5 缓存：basename → module 节点列表（用于 C/ObjC 头文件解析）
  //   ObjC #import "file.h" 只提供文件名，无路径 → 按 basename 模糊匹配
  //   多命中时取与 source 路径公共前缀最长的候选（proximity heuristic）
  // ------------------------------------------------------------------
  const basenameModuleCache = Object.create(null);

  const getModuleByBasename = (basename, srcFilePath) => {
    if (basenameModuleCache[basename] === undefined) {
      const rows = db
        .prepare(
          `SELECT id, file_path FROM nodes WHERE kind = 'module' AND file_path LIKE ?`
        )
        .all('%/' + basename);
      // 也匹配根目录下的同名文件（无斜杠）
      const rootRow = db
        .prepare(
          `SELECT id, file_path FROM nodes WHERE kind = 'module' AND file_path = ?`
        )
        .get(basename);
      const all = rootRow ? [...rows, rootRow] : rows;
      basenameModuleCache[basename] = all.length > 0 ? all : null;
    }
    const candidates = basenameModuleCache[basename];
    if (!candidates) return null;
    if (candidates.length === 1) return candidates[0].id;

    // 多候选：取与 source 路径公共前缀最长的（目录最近邻）
    const srcDir = srcFilePath.includes('/')
      ? srcFilePath.split('/').slice(0, -1).join('/')
      : '';
    let best = null;
    let bestLen = -1;
    for (const c of candidates) {
      const cDir = c.file_path.includes('/')
        ? c.file_path.split('/').slice(0, -1).join('/')
        : '';
      // 计算公共前缀长度（按目录段）
      const srcSegs = srcDir ? srcDir.split('/') : [];
      const cSegs = cDir ? cDir.split('/') : [];
      let common = 0;
      while (common < srcSegs.length && common < cSegs.length && srcSegs[common] === cSegs[common]) {
        common++;
      }
      if (common > bestLen) {
        bestLen = common;
        best = c;
      }
    }
    return best ? best.id : null;
  };

  // ------------------------------------------------------------------
  // 阶段2 缓存：symbol name → 唯一 node id（非 module 节点）
  //   key = name，value = node.id、null（无匹配）或 '__AMBIGUOUS__'
  //   若全局重名，再尝试同文件精确匹配（同文件优先消歧）
  // ------------------------------------------------------------------
  const symbolCache = Object.create(null);

  // 全局查询：返回所有同名节点（非 module）
  const getAllSymbolRows = db.prepare(
    `SELECT id, file_path FROM nodes WHERE name = ? AND kind != 'module'`
  );

  const getSymbolId = (name, srcFile) => {
    let cached = symbolCache[name];
    if (cached === undefined) {
      const rows = getAllSymbolRows.all(name);
      cached = rows.length === 0
        ? { status: 'none' }
        : rows.length === 1
          ? { status: 'unique', id: rows[0].id }
          : { status: 'ambiguous', rows };
      symbolCache[name] = cached;
    }

    if (cached.status === 'none') return null;
    if (cached.status === 'unique') return cached.id;

    // 全局重名：同文件优先消歧
    const sameFile = cached.rows.filter((r) => r.file_path === srcFile);
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

      // 相对路径解析：require('./envelope') → src/crg/cli/envelope.js
      if (!targetId && normalized.startsWith('.') && raw.source_id) {
        const sourcePath = raw.source_id.split('#')[0]; // e.g. 'src/crg/cli/build.js'
        const sourceDir = sourcePath.includes('/')
          ? sourcePath.split('/').slice(0, -1).join('/')
          : '';
        // 手动规范化路径，避免依赖 path.resolve 的 cwd
        const parts = (sourceDir ? sourceDir + '/' + normalized : normalized).split('/');
        const segs = [];
        for (const p of parts) {
          if (p === '.' || p === '') continue;
          if (p === '..') segs.pop();
          else segs.push(p);
        }
        const resolvedBase = segs.join('/');
        for (const suffix of ['', '.js', '.mjs', '.ts', '/index.js']) {
          targetId = getModuleId(resolvedBase + suffix);
          if (targetId) break;
        }
      }
    }

    // 阶段1.5：basename 模糊匹配（ObjC/C 头文件 #import "file.h" 无路径信息）
    //   条件：target_path_raw 不含路径分隔符（纯文件名），且为 C 系头文件扩展名
    if (!targetId && raw.target_path_raw) {
      const rawPath = raw.target_path_raw.replace(/\\/g, '/');
      const isFilenameOnly = !rawPath.includes('/');
      const isHeaderExt = /\.(h|hpp|hh|hxx|m|mm|c|cc|cpp|cxx)$/i.test(rawPath);
      if (isFilenameOnly && isHeaderExt) {
        const srcFile = raw.source_id ? raw.source_id.split('#', 1)[0] : '';
        targetId = getModuleByBasename(rawPath, srcFile);
      }
    }

    // 阶段2：target_name → 符号节点（优先同文件消歧）
    if (!targetId && raw.target_name) {
      const srcFile = raw.source_id ? raw.source_id.split('#', 1)[0] : '';
      targetId = getSymbolId(raw.target_name, srcFile);
    }

    if (!targetId) {
      unresolvedCount++;
      unresolved.push({
        source_id: raw.source_id,
        source_file: raw.source_id ? raw.source_id.split('#', 1)[0] : '',
        edge_kind: raw.kind,
        target_name: raw.target_name || null,
        target_path_raw: raw.target_path_raw || null,
      });
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

  return { resolved, unresolvedCount, unresolved };
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

/**
 * 用最近一次 build 的 unresolved 明细替换 unresolved_edges 表。
 *
 * @param {import('better-sqlite3').Database} db
 * @param {Array<{source_id:string, source_file:string, edge_kind:string, target_name:string|null, target_path_raw:string|null}>} rows
 */
function replaceUnresolvedEdges(db, rows) {
  const truncate = db.prepare('DELETE FROM unresolved_edges');
  const insert = db.prepare(`
    INSERT INTO unresolved_edges (
      source_id, source_file, edge_kind, target_name, target_path_raw
    ) VALUES (?, ?, ?, ?, ?)
  `);

  const runAll = db.transaction((items) => {
    truncate.run();
    for (const row of items) {
      insert.run(
        row.source_id,
        row.source_file || '',
        row.edge_kind,
        row.target_name || null,
        row.target_path_raw || null
      );
    }
  });

  runAll(rows || []);
}

module.exports = {
  upsertNodes,
  upsertChunks,
  upsertEdges,
  deleteStaleNodes,
  resolveEdges,
  setUnresolvedEdgeCount,
  replaceUnresolvedEdges,
};
