'use strict';

const { lexicalOverlapRerank, splitIdentifier } = require('./lexical-overlap-rerank');

function semanticRerank(items, options = {}) {
  return lexicalOverlapRerank(items, options);
}

module.exports = {
  semanticRerank,
  splitIdentifier,
};
