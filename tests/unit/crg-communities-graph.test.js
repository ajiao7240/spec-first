'use strict';

const { connectedComponents, partitionModuleGraph } = require('../../src/crg/communities/graph-partition');

describe('crg graph community partition', () => {
  test('按无向连通分量生成稳定 graph community hints', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const edges = [
      { source_id: 'a', target_id: 'b' },
      { source_id: 'b', target_id: 'c' },
    ];

    expect(connectedComponents(nodes, edges)).toEqual([
      ['a', 'b', 'c'],
      ['d'],
    ]);
    expect(partitionModuleGraph(nodes, edges, { minComponentSize: 2 })).toEqual([
      expect.objectContaining({
        id: 'graph/0',
        node_ids: ['a', 'b', 'c'],
        community_source: 'graph',
      }),
    ]);
  });
});
