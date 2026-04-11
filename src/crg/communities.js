'use strict';

/**
 * CRG 3-Pass 社区检测
 *
 * Pass 1: 自适应目录框架（按顶层目录分组，单文件目录合并到 (root)）
 * Pass 2: O(E) 健康评估（density, independence，四象限分类）
 * Pass 3: 仅对超大社区（file_count > total_nodes * 25%）执行 BFS 连通分量精化
 *
 * 写入顺序（外键安全）：
 *   UPDATE nodes community_id=NULL
 *   → DELETE communities
 *   → INSERT communities
 *   → UPDATE nodes community_id
 */

/**
 * 容器目录：这些目录名本身无语义，需跳过向下寻找有意义的层级（spec §14.5）
 * 例如：src/auth → community = "auth"，而不是 "src"
 */
const CONTAINER_DIRS = new Set([
  'src', 'lib', 'app', 'pkg', 'internal', 'external',
  'core', 'main', 'common', 'shared', 'utils', 'helpers',
  'modules', 'components', 'services', 'controllers', 'models',
  'api', 'server', 'client', 'web', 'backend', 'frontend',
]);

/**
 * 用 BFS 在给定节点集合和边集合中寻找连通分量
 *
 * @param {Set<string>} nodeSet - 社区内节点 ID 集合
 * @param {Map<string, string[]>} intraAdj - 仅限社区内边的邻接表（双向）
 * @returns {Array<Set<string>>} 连通分量列表
 */
function bfsComponents(nodeSet, intraAdj) {
  const visited = new Set();
  const components = [];

  for (const startId of nodeSet) {
    if (visited.has(startId)) continue;

    // BFS 遍历单个连通分量
    const component = new Set();
    const queue = [startId];
    visited.add(startId);

    while (queue.length > 0) {
      const cur = queue.shift();
      component.add(cur);

      const neighbors = intraAdj.get(cur) || [];
      for (const nb of neighbors) {
        if (!visited.has(nb) && nodeSet.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
      }
    }

    components.push(component);
  }

  return components;
}

/**
 * 3-Pass 社区检测：将 nodes 按目录分组，评估健康度，精化超大社区
 *
 * @param {import('better-sqlite3').Database} db - better-sqlite3 db 实例
 */
function writeCommunities(db) {
  // -------------------------------------------------------------------------
  // Pass 1: 目录框架
  // -------------------------------------------------------------------------
  const moduleNodes = db.prepare(
    "SELECT id, file_path FROM nodes WHERE kind = 'module'"
  ).all();

  // 顶层目录 → 节点列表
  const communityMap = {};

  for (const node of moduleNodes) {
    const parts = node.file_path.split('/');
    // 跳过容器目录，向下寻找第一个有语义意义的目录层级
    let dir = '(root)';
    for (let i = 0; i < parts.length - 1; i++) {
      if (!CONTAINER_DIRS.has(parts[i])) {
        dir = parts[i];
        break;
      }
    }
    if (!communityMap[dir]) communityMap[dir] = [];
    communityMap[dir].push(node);
  }

  // 合并单文件目录到 (root)
  for (const [dir, nodes] of Object.entries(communityMap)) {
    if (nodes.length === 1 && dir !== '(root)') {
      communityMap['(root)'] = (communityMap['(root)'] || []).concat(nodes);
      delete communityMap[dir];
    }
  }

  // -------------------------------------------------------------------------
  // Pass 2: 健康评估
  // 预加载所有 edges，避免 N+1 查询
  // -------------------------------------------------------------------------
  const allEdges = db.prepare('SELECT source_id, target_id FROM edges').all();

  // 构建 nodeId → communityId 映射（Pass 1 结果）
  const nodeToCommunity = new Map();
  for (const [communityId, nodes] of Object.entries(communityMap)) {
    for (const node of nodes) {
      nodeToCommunity.set(node.id, communityId);
    }
  }

  // 构建 nodeId → nodeId[] 的社区内邻接表（双向，供 Pass 3 BFS 使用）
  const intraAdjMap = {}; // communityId → Map<nodeId, nodeId[]>

  // 统计每个社区的边
  const communityStats = {};
  for (const communityId of Object.keys(communityMap)) {
    communityStats[communityId] = {
      intra_edges: 0,
      inter_edges: 0,
    };
    intraAdjMap[communityId] = new Map();
  }

  for (const edge of allEdges) {
    const srcCommunity = nodeToCommunity.get(edge.source_id);
    const tgtCommunity = nodeToCommunity.get(edge.target_id);

    if (!srcCommunity || !tgtCommunity) continue;

    if (srcCommunity === tgtCommunity) {
      // 社区内边
      communityStats[srcCommunity].intra_edges++;

      // 双向记录供 BFS
      const adj = intraAdjMap[srcCommunity];
      if (!adj.has(edge.source_id)) adj.set(edge.source_id, []);
      if (!adj.has(edge.target_id)) adj.set(edge.target_id, []);
      adj.get(edge.source_id).push(edge.target_id);
      adj.get(edge.target_id).push(edge.source_id);
    } else {
      // 跨社区边（source 所在社区计一次 inter_edge）
      if (communityStats[srcCommunity]) {
        communityStats[srcCommunity].inter_edges++;
      }
      if (communityStats[tgtCommunity]) {
        communityStats[tgtCommunity].inter_edges++;
      }
    }
  }

  // 计算健康指标，生成最终 communities 列表
  const totalNodes = moduleNodes.length;
  const threshold = totalNodes * 0.25;

  // 最终要写入的社区列表（Pass 3 精化后可能增加子社区）
  const finalCommunities = [];

  for (const [communityId, nodes] of Object.entries(communityMap)) {
    const n = nodes.length;
    const stats = communityStats[communityId] || { intra_edges: 0, inter_edges: 0 };
    const totalPossible = n * (n - 1);
    const density = stats.intra_edges / Math.max(totalPossible, 1);
    const independence =
      stats.intra_edges / Math.max(stats.intra_edges + stats.inter_edges, 1);

    // 四象限分类（spec §14.5，I_THRESHOLD = 0.5）
    let healthStatus;
    if (density > 0.3 && independence > 0.5) {
      healthStatus = 'healthy';
    } else if (density <= 0.3 && independence > 0.5) {
      healthStatus = 'isolated';
    } else if (density > 0.3 && independence <= 0.5) {
      healthStatus = 'fragmented';
    } else {
      healthStatus = 'scattered';
    }

    const baseCommunity = {
      id: communityId,
      label: communityId,
      file_count: n,
      health_status: healthStatus,
      health_density: density,
      health_independence: independence,
      nodes: nodes,
    };

    // -------------------------------------------------------------------------
    // Pass 3: 超大社区精化（file_count > total_nodes*25% 且绝对数量 >= 4）
    //   绝对下限防止小型仓库的所有社区都被误判为"超大"并被 BFS 拆散
    // -------------------------------------------------------------------------
    const PASS3_MIN_NODES = 4;
    if (n > threshold && n >= PASS3_MIN_NODES) {
      const nodeSet = new Set(nodes.map((nd) => nd.id));
      const adj = intraAdjMap[communityId];

      const components = bfsComponents(nodeSet, adj);

      if (components.length <= 1) {
        // 单连通分量，无需拆分
        if (stats.intra_edges === 0) {
          baseCommunity.health_note = 'oversized, no split boundary found';
        }
        finalCommunities.push(baseCommunity);
      } else {
        // 多个连通分量，拆分为子社区
        for (let idx = 0; idx < components.length; idx++) {
          const component = components[idx];
          const subId = `${communityId}/${idx}`;
          const subNodes = nodes.filter((nd) => component.has(nd.id));
          const subN = subNodes.length;
          const subTotalPossible = subN * (subN - 1);

          // 子社区内部边数（重新统计）
          let subIntraEdges = 0;
          for (const edge of allEdges) {
            if (component.has(edge.source_id) && component.has(edge.target_id)) {
              subIntraEdges++;
            }
          }

          // 子社区跨边数：原社区内，但连通分量不同
          let subInterEdges = 0;
          for (const edge of allEdges) {
            const srcInSub = component.has(edge.source_id);
            const tgtInSub = component.has(edge.target_id);
            if (srcInSub !== tgtInSub) {
              subInterEdges++;
            }
          }

          const subDensity = subIntraEdges / Math.max(subTotalPossible, 1);
          const subIndependence =
            subIntraEdges / Math.max(subIntraEdges + subInterEdges, 1);

          let subHealthStatus;
          if (subDensity > 0.3 && subIndependence > 0.7) {
            subHealthStatus = 'healthy';
          } else if (subDensity <= 0.3 && subIndependence > 0.7) {
            subHealthStatus = 'isolated';
          } else if (subDensity > 0.3 && subIndependence <= 0.7) {
            subHealthStatus = 'fragile';
          } else {
            subHealthStatus = 'overloaded';
          }

          finalCommunities.push({
            id: subId,
            label: subId,
            file_count: subN,
            health_status: subHealthStatus,
            health_density: subDensity,
            health_independence: subIndependence,
            nodes: subNodes,
          });
        }
      }
    } else {
      finalCommunities.push(baseCommunity);
    }
  }

  // -------------------------------------------------------------------------
  // 外键安全写入
  // 1. 先将所有 nodes 的 community_id 置 NULL（避免外键约束冲突）
  // 2. 删除旧 communities
  // 3. 插入新 communities
  // 4. 更新 nodes 的 community_id
  // -------------------------------------------------------------------------
  const insertCommunity = db.prepare(`
    INSERT INTO communities (id, label, file_count, health_status, health_density, health_independence)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const updateNodeCommunity = db.prepare(
    'UPDATE nodes SET community_id = ? WHERE id = ?'
  );

  const writeAll = db.transaction(() => {
    // 步骤 1: 清空 nodes.community_id
    db.prepare('UPDATE nodes SET community_id = NULL').run();

    // 步骤 2: 清空 communities（foreign_keys ON + community_id 设 NULL 后安全删除）
    db.prepare('DELETE FROM communities').run();

    // 步骤 3: 插入新 communities
    for (const community of finalCommunities) {
      insertCommunity.run(
        community.id,
        community.label,
        community.file_count,
        community.health_status,
        community.health_density,
        community.health_independence
      );
    }

    // 步骤 4: 更新 nodes 的 community_id
    for (const community of finalCommunities) {
      for (const node of community.nodes) {
        updateNodeCommunity.run(community.id, node.id);
      }
    }
  });

  writeAll();

  return {
    community_count: finalCommunities.length,
    communities: finalCommunities.map((c) => ({
      id: c.id,
      file_count: c.file_count,
      health_status: c.health_status,
    })),
  };
}

module.exports = { writeCommunities };
