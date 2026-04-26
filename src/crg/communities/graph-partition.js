'use strict';

function connectedComponents(nodes, edges) {
  const ids = [...new Set((nodes || []).map((node) => node.id).filter(Boolean))].sort();
  const adjacency = new Map(ids.map((id) => [id, []]));
  for (const edge of edges || []) {
    if (!adjacency.has(edge.source_id) || !adjacency.has(edge.target_id)) continue;
    if (edge.source_id === edge.target_id) continue;
    adjacency.get(edge.source_id).push(edge.target_id);
    adjacency.get(edge.target_id).push(edge.source_id);
  }

  const visited = new Set();
  const components = [];
  for (const id of ids) {
    if (visited.has(id)) continue;
    const queue = [id];
    const component = [];
    visited.add(id);
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head];
      component.push(current);
      for (const next of adjacency.get(current) || []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    components.push(component.sort());
  }
  return components.sort((left, right) => right.length - left.length || left[0].localeCompare(right[0]));
}

function partitionModuleGraph(nodes, edges, options = {}) {
  const minComponentSize = options.minComponentSize || 2;
  const components = connectedComponents(nodes, edges);
  return components
    .filter((component) => component.length >= minComponentSize)
    .map((component, index) => ({
      id: `graph/${index}`,
      node_ids: component,
      algorithm: 'connected_components',
      community_source: 'graph',
      cohesion: component.length <= 1 ? 0 : 1,
    }));
}

module.exports = {
  connectedComponents,
  partitionModuleGraph,
};
