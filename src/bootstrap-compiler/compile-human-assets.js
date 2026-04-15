'use strict';

function compileHumanAssets({ contextAssets = [] } = {}) {
  return {
    generated_assets: contextAssets.filter((assetPath) => assetPath.endsWith('.md') || assetPath.endsWith('.yaml')),
    docs_assets: contextAssets.filter(
      (assetPath) => assetPath.startsWith('architecture/') || assetPath.startsWith('code-facts/')
    ),
  };
}

module.exports = {
  compileHumanAssets,
};
