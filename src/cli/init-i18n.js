const MESSAGES = {
  zh: {
    selectHosts: '选择要初始化的宿主运行时:',
    checkboxHint: '↑/↓ 移动 · 空格 选择/取消 · Enter 确认 · Ctrl+C 取消',
    selectHint: '↑/↓ 移动 · Enter 确认 · Ctrl+C 取消',
    developerName: '开发者名称:',
    languageSelect: '默认回复语言:',
    workspaceTarget: '选择 workspace 初始化目标:',
    workspaceAllRepos: (count) => `所有子仓库 (${count})`,
    workspaceCancel: '取消',
    reuseGlobalProfile: (name, lang) => (
      `检测到全局开发者: ${name} (${lang})。沿用?`
    ),
    globalProfileOverwrite: (display, name, lang) => (
      `全局 developer profile 已存在: ${display}。是否用 ${name} (${lang}) 覆盖?`
    ),
    confirmApply: '应用这些更改?',
    cancelled: '已取消。',
    nameRequired: '开发者名称不能为空。',
    minSelectedError: (count) => `请至少选择 ${count} 项。`,
    previewSelectedHosts: (labels) => `已选择宿主运行时: ${labels}`,
    previewHostRuntime: (index, total, label) => `宿主运行时 ${index}/${total}: ${label}`,
    previewDryRunHeader: (platform) => `预览: spec-first init (${platform})`,
    previewHardResetLegacy: '将先执行 managed hard reset，再重新生成 runtime assets。',
    previewHardResetDrift: '将先执行 managed hard reset，再重新生成 runtime assets（检测到当前 runtime drift）。',
    previewDestructiveReset: '破坏性预览: 包含 managed runtime reset/removal/prune 操作。',
    previewWouldRemove: (count) => `将移除 ${count} 个过期 managed path。`,
    previewWouldPrune: (count, suffix) => `将清理 ${count} 个未管理 command 文件${suffix}`,
    previewWouldEnsureDir: (count, suffix) => `将确保 ${count} 个 managed 目录存在${suffix}`,
    previewWouldWrite: (count, suffix) => `将写入/更新 ${count} 个 managed 文件${suffix}`,
    previewWouldUntrack: (count) => `将从 git index untrack ${count} 个 managed runtime path:`,
    previewNoRuntimeUntrack: '没有 managed runtime path 需要 untrack。',
    previewRuntimeUntrackCheck: (reasonCode) => `Runtime untrack 检查: ${reasonCode}`,
    previewRuntimeUntrackDiagnostic: (diagnostic) => `  ${diagnostic}`,
    previewOmittedPaths: (count) => `  ... 还有 ${count} 个 path 未在 preview 中展示`,
    previewNoFilesChanged: '不会修改文件。',
  },
  en: {
    selectHosts: 'Select host runtimes to initialize:',
    checkboxHint: '↑/↓ move · Space toggle · Enter confirm · Ctrl+C cancel',
    selectHint: '↑/↓ move · Enter confirm · Ctrl+C cancel',
    developerName: 'Developer name:',
    languageSelect: 'Default response language:',
    workspaceTarget: 'Select workspace target:',
    workspaceAllRepos: (count) => `All child repos (${count})`,
    workspaceCancel: 'Cancel',
    reuseGlobalProfile: (name, lang) => (
      `Detected global developer: ${name} (${lang}). Reuse it?`
    ),
    globalProfileOverwrite: (display, name, lang) => (
      `Global developer profile already exists: ${display}. Overwrite it with ${name} (${lang})?`
    ),
    confirmApply: 'Apply these changes?',
    cancelled: 'Cancelled.',
    nameRequired: 'Developer name is required.',
    minSelectedError: (count) => `Select at least ${count} item(s).`,
    previewSelectedHosts: (labels) => `Selected host runtimes: ${labels}`,
    previewHostRuntime: (index, total, label) => `Host runtime ${index}/${total}: ${label}`,
    previewDryRunHeader: (platform) => `Dry run: spec-first init (${platform})`,
    previewHardResetLegacy: 'Would perform a managed hard reset before regenerating runtime assets.',
    previewHardResetDrift: 'Would perform a managed hard reset before regenerating runtime assets (current runtime drift detected).',
    previewDestructiveReset: 'Destructive preview: managed runtime reset/removal/prune operations are included.',
    previewWouldRemove: (count) => `Would remove ${count} managed obsolete path(s).`,
    previewWouldPrune: (count, suffix) => `Would prune ${count} unmanaged command file(s)${suffix}`,
    previewWouldEnsureDir: (count, suffix) => `Would ensure ${count} managed directorie(s)${suffix}`,
    previewWouldWrite: (count, suffix) => `Would write/update ${count} managed file(s)${suffix}`,
    previewWouldUntrack: (count) => `Would untrack ${count} managed runtime path(s):`,
    previewNoRuntimeUntrack: 'No managed runtime paths require untracking.',
    previewRuntimeUntrackCheck: (reasonCode) => `Runtime untrack check: ${reasonCode}`,
    previewRuntimeUntrackDiagnostic: (diagnostic) => `  ${diagnostic}`,
    previewOmittedPaths: (count) => `  ... ${count} more path(s) omitted from preview`,
    previewNoFilesChanged: 'No files were changed.',
  },
};

function getInitMessages(lang) {
  return MESSAGES[lang] || MESSAGES.zh;
}

module.exports = {
  getInitMessages,
};
