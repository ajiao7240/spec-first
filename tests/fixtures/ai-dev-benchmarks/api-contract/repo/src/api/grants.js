'use strict';

function serializeGrant(grant) {
  return {
    id: grant.id,
    title: grant.title,
    amount: grant.amount,
  };
}

function listGrants() {
  const grants = [
    {
      id: 'grant-001',
      title: 'Community Health Grant',
      amount: 25000,
      eligibility: 'Open to registered clinics serving rural communities.',
    },
  ];

  return {
    data: grants.map(serializeGrant),
  };
}

module.exports = {
  listGrants,
  serializeGrant,
};
