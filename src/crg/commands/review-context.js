'use strict';

/**
 * CRG review-context 子命令
 *
 * 用法：spec-first crg review-context --since=<git-ref> --repo=<path>
 *
 * 输出：JSON envelope，包含：
 *   - diff_summary：变更文件数量摘要
 *   - affected_nodes：变更文件中的节点（FactItem 格式）
 *   - candidate_tests：启发式推断的候选测试文件（文件名匹配 + nodes 表 is_test=1）
 *
 * --since 缺失 → exit 1
 * --since 为无效 git ref → exit 1
 * graph.db 不存在或 better-sqlite3 未安装 → exit 2
 */

const path = require('path');
const fs = require('fs');
const { openDb } = require('../cli/open-db');
const { makeEnvelope } = require('../cli/envelope');
const { detectChanges, assessNodeRiskBatch } = require('../changes');
const { isSensitiveFile } = require('../input-convergence');
const { retrieveContext } = require('../retrieval/api');

/**
 * review-context 子命令入口（由 router.js 调用）
 *
 * @param {string[]} argv - router.js 传入的参数（不含子命令名本身）
 */
function run(argv) {
  // 解析 --since=<git-ref>，缺失时 exit 1
  const sinceArg = argv.find(a => a.startsWith('--since='));
  if (!sinceArg) {
    process.stderr.write('error: --since=<git-ref> is required\n');
    process.exit(1);
  }
  const since = sinceArg.slice('--since='.length);

  // openDb 内部：graph.db 不存在或 better-sqlite3 未安装时 exit 2
  const { db, repoRoot } = openDb(argv);

  // 获取变更文件列表（含风险评分）
  let changeSummary;
  try {
    changeSummary = detectChanges(repoRoot, since, db);
  } catch (e) {
    if (e.isUserError) {
      process.stderr.write(`error: ${e.message}\n`);
      process.exit(1);
    }
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(2);
  }

  // 收集受影响节点（FactItem 格式，跳过 module 节点和敏感文件）
  const affectedNodes = [];
  for (const change of changeSummary) {
    // 安全检查：跳过敏感文件
    if (isSensitiveFile(path.basename(change.file))) continue;

    const nodes = db.prepare(
      `SELECT id, name, file_path, kind, line_start, line_end, is_test
       FROM nodes
       WHERE file_path = ? AND kind != 'module'`
    ).all(change.file);

    for (const node of nodes) {
      affectedNodes.push({
        id: node.id,
        name: node.name,
        file_path: node.file_path,
        kind: node.kind,
        line_start: node.line_start,
        line_end: node.line_end,
        is_test: node.is_test,
        confidence: 'Observed',
        source_tier: 'crg_ast',
        evidence: [`changed file: ${change.file}`],
        inference_reason: null,
        risk_level: change.risk_level,
      });
    }
  }

  // 候选测试关联（启发式：文件名匹配，不依赖 tested_by 边）
  const candidateTests = [];
  const seenTestFiles = new Set();

  // 将候选测试文件包装成 FactItem 格式
  // 优先从 nodes 表中查找 module 节点（有索引时带 line_end）；未索引时构造最小 FactItem
  const buildCandidateTest = (file, sourceTier, evidence) => {
    const moduleNode = db
      .prepare("SELECT id, name, line_end FROM nodes WHERE file_path = ? AND kind = 'module' LIMIT 1")
      .get(file);
    return {
      id: moduleNode ? moduleNode.id : `${file}#module`,
      name: moduleNode ? moduleNode.name : path.basename(file, path.extname(file)),
      file_path: file,
      kind: 'module',
      line_start: 0,
      line_end: moduleNode ? moduleNode.line_end : 0,
      is_test: 1,
      confidence: 'Inferred',
      source_tier: sourceTier,
      evidence: [evidence],
      inference_reason: 'naming_convention',
    };
  };

  const changedFiles = changeSummary.map(c => c.file);
  for (const filePath of changedFiles) {
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    const dir = path.dirname(filePath);

    // 同目录下的 <base>.test.<ext> 和 <base>.spec.<ext>
    const testPatterns = [
      `${base}.test${ext}`,
      `${base}.spec${ext}`,
    ];

    for (const testFile of testPatterns) {
      const relTestPath = path.join(dir, testFile);
      const absTestPath = path.join(repoRoot, relTestPath);
      if (fs.existsSync(absTestPath) && !seenTestFiles.has(relTestPath)) {
        seenTestFiles.add(relTestPath);
        candidateTests.push(
          buildCandidateTest(relTestPath, 'grep_glob', `matched sibling test file for ${filePath}`)
        );
      }
    }

    // nodes 表中 is_test=1 且文件名包含 base 的节点（转义 LIKE 通配符）
    const escapedBase = base.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const testNodes = db.prepare(
      "SELECT DISTINCT file_path FROM nodes WHERE is_test = 1 AND file_path LIKE ? ESCAPE '\\'"
    ).all(`%${escapedBase}%`);

    for (const tn of testNodes) {
      if (!seenTestFiles.has(tn.file_path)) {
        seenTestFiles.add(tn.file_path);
        candidateTests.push(
          buildCandidateTest(tn.file_path, 'crg_ast', `matched indexed test node for ${filePath}`)
        );
      }
    }
  }

  // === 图扩展：2层反向 BFS，找出受变更影响的调用方 ===
  // 加载 calls 边的反向邻接表（target → callers）
  const edgeRows = db.prepare(
    "SELECT source_id, target_id FROM edges WHERE kind = 'calls'"
  ).all();
  const reverseAdj = new Map();
  for (const row of edgeRows) {
    if (!reverseAdj.has(row.target_id)) reverseAdj.set(row.target_id, []);
    reverseAdj.get(row.target_id).push(row.source_id);
  }

  // 反向 BFS（深度上限 2，防止爆炸）
  function reverseBfs(startId, maxDepth) {
    const visited = new Map(); // nodeId → depth
    const queue = [[startId, 0]];
    visited.set(startId, 0);
    while (queue.length > 0) {
      const [cur, depth] = queue.shift();
      if (depth >= maxDepth) continue;
      for (const caller of (reverseAdj.get(cur) || [])) {
        if (!visited.has(caller)) {
          visited.set(caller, depth + 1);
          queue.push([caller, depth + 1]);
        }
      }
    }
    return visited;
  }

  const affectedNodeIds = new Set(affectedNodes.map(n => n.id));
  const expansionDepthMap = new Map(); // nodeId → 最小发现深度
  for (const nodeId of affectedNodeIds) {
    const visited = reverseBfs(nodeId, 2);
    for (const [id, depth] of visited) {
      if (id !== nodeId && !affectedNodeIds.has(id)) {
        if (!expansionDepthMap.has(id) || expansionDepthMap.get(id) > depth) {
          expansionDepthMap.set(id, depth);
        }
      }
    }
  }

  // 批量查询扩展节点（避免超出 SQLITE_MAX_VARIABLE_NUMBER）
  const CHUNK_SIZE = 900;
  const expansionNodeIds = Array.from(expansionDepthMap.keys());

  // 预批量计算所有扩展节点的风险评分（一次性 ~6 个批量查询，替代 N+1）
  const expansionRiskScores = assessNodeRiskBatch(expansionNodeIds, db);

  const graphExpansion = [];
  for (let i = 0; i < expansionNodeIds.length; i += CHUNK_SIZE) {
    const chunk = expansionNodeIds.slice(i, i + CHUNK_SIZE);
    const ph = chunk.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT id, name, file_path, kind, line_start, line_end, is_test FROM nodes WHERE id IN (${ph})`
    ).all(...chunk);
    for (const row of rows) {
      graphExpansion.push({
        id: row.id,
        name: row.name,
        file_path: row.file_path,
        kind: row.kind,
        line_start: row.line_start,
        line_end: row.line_end,
        is_test: row.is_test,
        confidence: 'Inferred',
        source_tier: 'crg_ast',
        evidence: [`2-hop caller of changed code`],
        inference_reason: 'call_graph_traversal',
        depth: expansionDepthMap.get(row.id),
        risk_score: expansionRiskScores.get(row.id) || 0,
      });
    }
  }
  // 按 risk_score 降序排列
  graphExpansion.sort((a, b) => b.risk_score - a.risk_score);

  // === review_guidance 生成（聚合 changeSummary 的 review_priorities/test_gaps）===
  const allReviewPriorities = changeSummary.flatMap(c => c.review_priorities || []);
  const allTestGaps = changeSummary.flatMap(c => c.test_gaps || []);

  const review_guidance = [];
  const highRiskNodes = allReviewPriorities.filter(n => n.score >= 0.5);
  if (highRiskNodes.length > 0) {
    for (const n of highRiskNodes.slice(0, 5)) {
      review_guidance.push(`HIGH_RISK: ${n.name} — score ${n.score.toFixed(2)}`);
    }
  } else if (allReviewPriorities.length > 0) {
    const sorted = allReviewPriorities.slice().sort((a, b) => b.score - a.score);
    review_guidance.push(`TOP_PRIORITY: ${sorted[0].name} — score ${sorted[0].score.toFixed(2)}`);
  }
  if (allTestGaps.length > 0) {
    const names = allTestGaps.slice(0, 3).map(n => n.name).join(', ');
    review_guidance.push(
      `TEST_GAP: ${allTestGaps.length} node(s) lack test coverage — ${names}${allTestGaps.length > 3 ? ' ...' : ''}`
    );
  }
  review_guidance.push(`BLAST_RADIUS: ${graphExpansion.length} caller(s) within 2 hops of changed code`);

  const data = {
    diff_summary: `${changeSummary.length} file(s) changed since ${since}`,
    affected_nodes: affectedNodes,
    candidate_tests: candidateTests,
    graph_expansion: graphExpansion,
    review_guidance,
    ranked_context: retrieveContext(db, {
      profile: 'review',
      query: `${changedFiles.join(' ')} review risk tests`,
      changedFiles,
      candidateTests: candidateTests.map((item) => item.file_path),
      riskPaths: changeSummary
        .filter((item) => item.risk_level === 'High' || item.risk_level === 'Medium')
        .map((item) => item.file),
    }).ranked_context,
  };

  process.stdout.write(JSON.stringify(makeEnvelope(repoRoot, data)) + '\n');
}

module.exports = { run };
