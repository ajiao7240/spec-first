'use strict';

const { listGrants } = require('../../src/api/grants');
const { normalizeGrantResponse } = require('../../src/client/grants-client');

test('grants API response can be normalized by the client', () => {
  const response = listGrants();
  const normalized = normalizeGrantResponse(response);

  expect(normalized).toEqual({
    grants: [
      {
        id: 'grant-001',
        title: 'Community Health Grant',
        amount: 25000,
      },
    ],
  });
});
