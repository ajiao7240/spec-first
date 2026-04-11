'use strict';

/**
 * CRG 图分析模块
 *
 * 功能：
 *   - surprisingConnections: 识别跨社区/异常边（4 因子评分，score 0-100，per spec §14.6）
 *   - godNodes: 识别过度中心化节点（in_degree 排名前 5%，排除 module 节点）
 *   - analyzeGraph: 整合两项分析，返回 { surprising, hubs }
 *
 * 注意：分析结果不持久化到 DB，每次调用时重新计算（保持简单）
 */

const path = require('path');

/**
 * 过滤掉结构边（不参与"惊喜"计算）
 * - imports_from: 模块导入边
 * - contains: 文件包含符号
 * - defined_in: 符号定义位置
 */
const STRUCTURAL_EDGE_KINDS = new Set(['imports_from', 'contains', 'defined_in']);

/**
 * 从文件路径推断语言标识符
 *
 * @param {string} filePath
 * @returns {string}
 */
function inferLanguage(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  switch (ext) {
    case '.js': case '.mjs': case '.cjs': return 'js';
    case '.ts': case '.tsx': return 'ts';
    case '.py': return 'python';
    case '.rb': return 'ruby';
    case '.go': return 'go';
    case '.swift': return 'swift';
    case '.kt': case '.kts': return 'kotlin';
    case '.java': return 'java';
    case '.rs': return 'rust';
    case '.cpp': case '.cc': case '.cxx': case '.c': case '.h': return 'c_cpp';
    default: return ext || 'unknown';
  }
}

/**
 * 评估惊喜连接（4 因子评分，per spec §14.6）
 *
 * 4 个因子：
 * F1. confidence_weight (10分): 至少一方置信度为 'Inferred'
 * F2. cross_language (30分): 源节点和目标节点所在文件语言不同
 * F3. cross_community (40分): source 和 target 的 community_id 不同
 * F4. peripheral_to_hub (20分): 低入度（外围）节点调用高入度（中枢）节点
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {Array<{ source: string, target: string, score: number, reasons: string[] }>}
 */
function surprisingConnections(db) {
  // 获取所有非结构边
  const edges = db.prepare('SELECT id, source_id, target_id, kind FROM edges').all();
  const semanticEdges = edges.filter((e) => !STRUCTURAL_EDGE_KINDS.has(e.kind));

  if (semanticEdges.length === 0) return [];

  // 加载所有节点信息（community_id, confidence, file_path）
  const nodesRow = db.prepare(
    'SELECT id, community_id, confidence, file_path FROM nodes'
  ).all();
  const nodeMap = new Map();
  for (const nd of nodesRow) {
    nodeMap.set(nd.id, nd);
  }

  // 统计每个节点的 in_degree（被调用次数）
  const inDegree = new Map();
  for (const edge of edges) {
    inDegree.set(edge.target_id, (inDegree.get(edge.target_id) || 0) + 1);
  }

  // 计算 hub 阈值：in_degree 排名前 10%（F4 使用）
  const sortedDegrees = Array.from(inDegree.values()).sort((a, b) => b - a);
  const hubThresholdIdx = Math.max(0, Math.floor(sortedDegrees.length * 0.1) - 1);
  const hubThreshold = sortedDegrees.length > 0 ? (sortedDegrees[hubThresholdIdx] || 1) : 1;

  const results = [];

  for (const edge of semanticEdges) {
    const src = nodeMap.get(edge.source_id);
    const tgt = nodeMap.get(edge.target_id);

    // 源节点或目标节点不在 nodes 表中，跳过
    if (!src || !tgt) continue;

    const reasons = [];
    let score = 0;

    // F1: confidence_weight（10分）— 至少一方为 Inferred
    if (src.confidence === 'Inferred' || tgt.confidence === 'Inferred') {
      score += 10;
      reasons.push('confidence_weight');
    }

    // F2: cross_language（30分）— 源/目标文件语言不同
    const srcLang = inferLanguage(src.file_path);
    const tgtLang = inferLanguage(tgt.file_path);
    if (srcLang !== tgtLang && srcLang !== 'unknown' && tgtLang !== 'unknown') {
      score += 30;
      reasons.push(`cross_language:${srcLang}→${tgtLang}`);
    }

    // F3: cross_community（40分）— 社区不同
    if (src.community_id !== tgt.community_id) {
      score += 40;
      reasons.push('cross_community');
    }

    // F4: peripheral_to_hub（20分）— 外围节点（入度=0）调用中枢节点
    const srcDeg = inDegree.get(edge.source_id) || 0;
    const tgtDeg = inDegree.get(edge.target_id) || 0;
    if (srcDeg === 0 && tgtDeg >= hubThreshold) {
      score += 20;
      reasons.push('peripheral_to_hub');
    }

    // 过滤 score < 30 的（不够惊喜）
    if (score < 30) continue;

    // 限制 score 最高 100
    score = Math.min(score, 100);

    results.push({
      source: edge.source_id,
      target: edge.target_id,
      edge_kind: edge.kind,
      score,
      reasons,
    });
  }

  // 按 score 降序排列
  results.sort((a, b) => b.score - a.score);

  return results;
}

/**
 * 识别 God Nodes（过度中心化节点）
 *
 * 标准：
 * - in_degree 排名前 5%（不少于 1 个，不超过 10 个）
 * - kind != 'module'（R8：不含文件级节点）
 * - 非孤立节点（in_degree > 0）
 *
 * 映射为 FactItem 格式：
 *   confidence = 'Inferred'
 *   inference_reason = 'call_graph_traversal'
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {Array<object>} God node FactItem 列表
 */
function godNodes(db) {
  // 统计每个非 module 节点的 in_degree
  const inDegreeRows = db.prepare(`
    SELECT n.id, n.name, n.file_path, n.kind, COUNT(e.source_id) AS in_degree
    FROM nodes n
    LEFT JOIN edges e ON e.target_id = n.id
    WHERE n.kind != 'module'
    GROUP BY n.id
    HAVING in_degree > 0
    ORDER BY in_degree DESC
  `).all();

  if (inDegreeRows.length === 0) return [];

  // 计算前 5% 的阈值（至少 1 个，不超过 10 个）
  const topCount = Math.max(1, Math.min(10, Math.ceil(inDegreeRows.length * 0.05)));

  // 取前 topCount 个节点
  const topNodes = inDegreeRows.slice(0, topCount);

  // 映射为 FactItem 格式
  return topNodes.map((node) => ({
    id: node.id,
    name: node.name,
    file_path: node.file_path,
    kind: node.kind,
    in_degree: node.in_degree,
    confidence: 'Inferred',
    inference_reason: 'call_graph_traversal',
    source_tier: 'crg_analysis',
  }));
}

/**
 * 整体图分析：合并 surprisingConnections + godNodes
 *
 * 结果不持久化到 DB，每次调用时重新计算（保持简单）。
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {{ surprising: Array, hubs: Array }}
 */
function analyzeGraph(db) {
  const surprising = surprisingConnections(db);
  const hubs = godNodes(db);

  return { surprising, hubs };
}

module.exports = { surprisingConnections, godNodes, analyzeGraph };
