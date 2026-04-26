'use strict';

function splitIdentifier(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^\p{L}\p{N}_./-]+/u)
    .flatMap((part) => String(part).split(/[_./-]+/))
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length >= 2);
}

function tokenizeQuery(query) {
  return [...new Set(splitIdentifier(query))];
}

module.exports = {
  splitIdentifier,
  tokenizeQuery,
};
