'use strict';

const { compareRankings, reciprocalRankFusion } = require('../../src/crg/retrieval/fusion');

describe('crg retrieval fusion', () => {
  test('RRF 合并多来源候选并保留 reasons 与 score_breakdown', () => {
    const fused = reciprocalRankFusion([
      { name: 'seed', items: [{ node_id: 'a', reasons: ['fts:a'] }, { node_id: 'b' }] },
      { name: 'rerank', items: [{ node_id: 'b', score_breakdown: { changed_file: 2 } }, { node_id: 'a' }] },
    ]);

    expect(fused.map((item) => item.node_id)).toEqual(['a', 'b']);
    expect(fused[0].reasons).toContain('fusion:seed');
    expect(fused[1].score_breakdown).toEqual(expect.objectContaining({
      changed_file: 2,
      rerank: expect.any(Number),
    }));
  });

  test('ranking comparison 可判断 fusion 是否不劣于旧排序', () => {
    expect(compareRankings(
      [{ node_id: 'x' }, { node_id: 'target' }],
      [{ node_id: 'target' }, { node_id: 'x' }],
      ['target']
    )).toEqual(expect.objectContaining({
      comparable: true,
      improved_or_equal: true,
    }));
  });
});
