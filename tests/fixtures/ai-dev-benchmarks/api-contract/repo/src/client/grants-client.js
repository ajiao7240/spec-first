'use strict';

function normalizeGrant(rawGrant) {
  return {
    id: rawGrant.id,
    title: rawGrant.title,
    amount: rawGrant.amount,
  };
}

function normalizeGrantResponse(response) {
  return {
    grants: (response.data || []).map(normalizeGrant),
  };
}

module.exports = {
  normalizeGrant,
  normalizeGrantResponse,
};
