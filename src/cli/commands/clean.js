const fs = require('node:fs');
const path = require('node:path');

const {
  applyOperationPlan,
  buildRelativeOperation,
  isLegacyManagedState,
  mergeOperationPlans,
  planEmptyManagedRootCleanup,
  planManagedAssetRemoval,
  readState,
  readStateFileRaw,
  summarizeOperationPlan,
} = require('../state');
const { getAdapter } = require('../adapters');
const { removeManagedCodingGuidelinesBlock } = require('../coding-guidelines');
const { removeManagedBootstrapBlock } = require('../instruction-bootstrap');
const { removeManagedRuntimeToolsBlock } = require('../runtime-tools-index');
const {
  renderManagedSessionStartHookRemoval,
  validateClaudeSettingsFile,
} = require('../claude-settings');

function runClean(argv) {
  const args = [...argv];
  const parsed = parseCleanArgs(args);

  if (parsed.help) {
    printHelp();
    return 0;
  }

  const platformSelected = parsed.claude || parsed.codex;
  if (!platformSelected || parsed.unknown.length > 0) {
    console.error('Usage: spec-first clean (--claude|--codex) [--dry-run]');
    return 2;
  }

  if (parsed.claude && parsed.codex) {
    console.error('Error: Cannot specify both --claude and --codex');
    return 2;
  }

  const platform = parsed.claude ? 'claude' : 'codex';
  const adapter = getAdapter(platform);
  const projectRoot = process.cwd();
  let state;
  try {
    state = readState(projectRoot, adapter);
  } catch (error) {
    const rawState = tryReadRawManagedState(projectRoot, adapter);
    if (isLegacyManagedState(rawState)) {
      console.error('Detected legacy spec-first managed state. `clean` does not migrate legacy installs.');
      console.error(
        `Run \`spec-first init --${adapter.id}\` first so spec-first can perform a managed hard reset and rebuild the current runtime.`,
      );
      console.error(
        `If you still want to remove current managed assets afterward, rerun \`spec-first clean --${adapter.id}\`.`,
      );
      return 1;
    }

    console.error(
      `Could not read spec-first managed asset state. ${error instanceof Error ? error.message : String(error)}`,
    );
    console.error(
      `Run \`spec-first init --${adapter.id}\` to regenerate the state file, then retry \`spec-first clean --${adapter.id}\`.`,
    );
    return 1;
  }

  if (!state) {
    console.log('No spec-first managed project assets found.');
    return 0;
  }

  if (platform === 'claude') {
    try {
      validateClaudeSettingsFile(projectRoot);
    } catch (error) {
      console.error(
        `Could not read Claude settings before clean. ${error instanceof Error ? error.message : String(error)}`,
      );
      console.error(
        'Fix `.claude/settings.json` so it contains valid JSON, then rerun `spec-first clean --claude`.',
      );
      return 1;
    }
  }

  const cleanPlan = buildCleanPlan(projectRoot, state, adapter);
  if (parsed.dryRun) {
    printCleanDryRun(platform, cleanPlan);
    return 0;
  }

  applyOperationPlan(projectRoot, mergeOperationPlans(cleanPlan.managedPlan, cleanPlan.runtimeCleanup));
  applyOperationPlan(projectRoot, planEmptyManagedRootCleanup(projectRoot, adapter));

  console.log(`Removed spec-first managed ${platform === 'claude' ? 'Claude Code' : 'Codex'} assets from the current project.`);
  console.log('Custom assets outside the spec-first managed set were left untouched.');
  return 0;
}

function tryReadRawManagedState(projectRoot, adapter) {
  try {
    return readStateFileRaw(projectRoot, adapter);
  } catch (_error) {
    return null;
  }
}

function parseCleanArgs(argv) {
  const parsed = {
    help: false,
    claude: false,
    codex: false,
    dryRun: false,
    unknown: [],
  };

  for (const arg of argv) {
    if (arg === '-h' || arg === '--help') {
      parsed.help = true;
    } else if (arg === '--claude') {
      parsed.claude = true;
    } else if (arg === '--codex') {
      parsed.codex = true;
    } else if (arg === '--dry-run') {
      parsed.dryRun = true;
    } else {
      parsed.unknown.push(arg);
    }
  }

  return parsed;
}

function printHelp() {
  console.log([
    '🧹 spec-first clean',
    '',
    '📘 Usage:',
    '  spec-first clean (--claude|--codex) [--dry-run]',
    '',
    '🔗 Repository:',
    '  https://github.com/sunrain520/spec-first',
  ].join('\n'));
}

function buildCleanPlan(projectRoot, state, adapter) {
  return {
    managedPlan: planManagedAssetRemoval(projectRoot, state, adapter),
    runtimeCleanup: buildRuntimeCleanupPreview(projectRoot, adapter),
    emptyRootPlan: planEmptyManagedRootCleanup(projectRoot, adapter),
  };
}

function buildRuntimeCleanupPreview(projectRoot, adapter) {
  const operations = [
    buildRelativeOperation(
      fs.existsSync(path.join(projectRoot, adapter.instructionFile)) ? 'update_file' : 'remove_file',
      adapter.instructionFile,
      'managed_instruction_cleanup',
    ),
    buildRelativeOperation('remove_file', adapter.stateFile, 'managed_state_file'),
  ];

  const instructionPath = path.join(projectRoot, adapter.instructionFile);
  if (fs.existsSync(instructionPath)) {
    operations[0].contents = removeManagedCodingGuidelinesBlock(
      removeManagedRuntimeToolsBlock(
        removeManagedBootstrapBlock(fs.readFileSync(instructionPath, 'utf8')),
      ),
    );
  }

  if (adapter.id === 'claude') {
    const rendered = renderManagedSessionStartHookRemoval(projectRoot);
    operations.push(
      rendered && rendered.existsAfter
        ? buildRelativeOperation(
          'update_file',
          '.claude/settings.json',
          'managed_session_start_matcher_cleanup',
          { contents: rendered.contents },
        )
        : buildRelativeOperation(
          'remove_file',
          '.claude/settings.json',
          'managed_session_start_matcher_cleanup',
        ),
    );
  }
  operations.push(...adapter.planRuntimeFilesRemoval(projectRoot).operations);

  return {
    operations,
    summary: summarizeOperationPlan(operations),
  };
}

function printCleanDryRun(platform, cleanPlan) {
  const removeCount =
    (cleanPlan.managedPlan.summary.remove_file || 0) +
    (cleanPlan.managedPlan.summary.remove_dir || 0) +
    (cleanPlan.runtimeCleanup.summary.remove_file || 0) +
    (cleanPlan.runtimeCleanup.summary.remove_dir || 0);
  const updateCount = cleanPlan.runtimeCleanup.summary.update_file || 0;
  const emptyRootCount = cleanPlan.emptyRootPlan.summary.remove_empty_root || 0;

  console.log(`Dry run: spec-first clean (${platform})`);
  console.log(`Would remove ${removeCount} managed path(s).`);
  for (const operation of cleanPlan.managedPlan.operations) {
    console.log(`  - ${operation.path}`);
  }
  for (const operation of cleanPlan.runtimeCleanup.operations.filter((entry) =>
    entry.kind === 'remove_file' || entry.kind === 'remove_dir'
  )) {
    console.log(`  - ${operation.path}`);
  }
  console.log(`Would update ${updateCount} managed file(s).`);
  for (const operation of cleanPlan.runtimeCleanup.operations.filter((entry) => entry.kind === 'update_file')) {
    console.log(`  - ${operation.path}`);
  }
  console.log(`Would remove ${emptyRootCount} empty managed root(s) after cleanup.`);
  console.log('Custom assets outside the spec-first managed set would remain untouched.');
  console.log('No files were changed.');
}

module.exports = {
  runClean,
};
