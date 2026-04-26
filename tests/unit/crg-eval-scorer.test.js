'use strict';

const {
  meanReciprocalRank,
  precisionRecallF1,
  recallAtK,
  scoreRetrievalResult,
} = require('../../src/crg/eval/scorer');

describe('crg eval scorer', () => {
  test('计算 MRR、Recall@K 和 precision/recall/F1', () => {
    const ranked = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const relevant = ['b', 'c'];

    expect(meanReciprocalRank(ranked, relevant)).toBe(0.5);
    expect(recallAtK(ranked, relevant, 2)).toBe(0.5);
    expect(precisionRecallF1(ranked, relevant, 2)).toEqual({
      precision: 0.5,
      recall: 0.5,
      f1: 0.5,
      hits: 1,
    });
  });

  test('scoreRetrievalResult 输出 token efficiency', () => {
    const score = scoreRetrievalResult({
      ranked_context: [
        { id: 'a', estimated_tokens: 100 },
        { id: 'b', estimated_tokens: 50 },
      ],
    }, { id: 'fixture-1', relevant_ids: ['b'] }, { k: 2, budget: 200 });

    expect(score).toEqual(expect.objectContaining({
      fixture_id: 'fixture-1',
      mrr: 0.5,
      recall_at_k: 1,
      token_efficiency: expect.objectContaining({
        used_tokens: 150,
        relevant_tokens: 50,
        budget_usage: 0.75,
      }),
    }));
  });
});
