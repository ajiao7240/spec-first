'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { attachOwnership } = require('../../src/bootstrap-compiler/ownership');
const { buildReviewQueue } = require('../../src/bootstrap-compiler/review-queue');
const { loadOwnershipRegistry } = require('../../src/bootstrap-compiler/ownership-registry');
const { transitionReviewQueueItem } = require('../../src/bootstrap-compiler/review-queue-state');

describe('knowledge governance', () => {
  test('ownership registry 可加载并校验最小字段', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ownership-registry-'));
    const registryPath = path.join(tmpDir, 'ownership.json');
    fs.writeFileSync(registryPath, JSON.stringify({
      schema_version: 'v1',
      entries: {
        'README.md': { owner: 'alice', reviewer: 'bob', last_verified: '2026-04-15' },
      },
    }, null, 2));

    try {
      const registry = loadOwnershipRegistry(registryPath);
      expect(registry.status).toBe('ok');
      expect(registry.entries['README.md']).toEqual({
        owner: 'alice',
        reviewer: 'bob',
        last_verified: '2026-04-15',
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('asset 可以记录 owner / reviewer / last_verified', () => {
    const assets = attachOwnership(
      [{ asset_path: 'README.md' }],
      { 'README.md': { owner: 'alice', reviewer: 'bob', last_verified: '2026-04-14' } }
    );

    expect(assets[0]).toEqual(expect.objectContaining({
      owner: 'alice',
      reviewer: 'bob',
      last_verified: '2026-04-14',
    }));
  });

  test('stale 与 contradictions 会进入治理队列', () => {
    const queue = buildReviewQueue({
      assets: [{ asset_path: 'README.md', owner: 'alice', last_verified: null }],
      freshness: { status: 'stale', stale_reasons: ['graph_stale'] },
      contradictions: {
        contradictions: [
          { fact_key: 'primary_language', assets: ['a.json', 'b.json'] },
        ],
      },
    });

    expect(queue.some((item) => item.type === 'unverified_asset')).toBe(true);
    expect(queue.some((item) => item.type === 'stale_context')).toBe(true);
    expect(queue.some((item) => item.type === 'contradiction')).toBe(true);
    expect(queue.every((item) => item.status === 'open')).toBe(true);
  });

  test('review queue item 只允许 open -> triaged -> resolved 最小流转', () => {
    const triaged = transitionReviewQueueItem({
      id: 'queue-1',
      status: 'open',
      asset_path: 'README.md',
      owner: 'alice',
    }, 'triaged', {
      reviewer: 'bob',
      timestamp: '2026-04-15T00:00:00.000Z',
    });

    expect(triaged).toEqual(expect.objectContaining({
      status: 'triaged',
      reviewer: 'bob',
      triaged_at: '2026-04-15T00:00:00.000Z',
    }));

    const resolved = transitionReviewQueueItem(triaged, 'resolved', {
      timestamp: '2026-04-15T01:00:00.000Z',
      lastVerified: '2026-04-15',
    });

    expect(resolved).toEqual(expect.objectContaining({
      status: 'resolved',
      resolved_at: '2026-04-15T01:00:00.000Z',
      last_verified: '2026-04-15',
    }));

    expect(() => transitionReviewQueueItem({
      id: 'queue-2',
      status: 'open',
    }, 'resolved')).toThrow(/invalid review queue transition/);
  });
});
