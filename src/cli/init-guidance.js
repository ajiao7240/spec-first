function formatInitHostName(adapterOrHost) {
  const host = typeof adapterOrHost === 'string' ? adapterOrHost : adapterOrHost && adapterOrHost.id;
  if (host === 'claude') return 'Claude Code';
  if (host === 'codex') return 'Codex';
  return 'the target host';
}

function formatInitGuidance(adapterOrHost, action = '') {
  let command = 'Run `spec-first init`';
  let suffix = String(action || '').trim();
  if (suffix.startsWith('in this project')) {
    command += ' in this project';
    suffix = suffix.slice('in this project'.length).trim();
  }
  const suffixText = suffix ? ` ${suffix}` : '';
  return `${command} and choose ${formatInitHostName(adapterOrHost)} when prompted${suffixText}.`;
}

module.exports = {
  formatInitGuidance,
  formatInitHostName,
};
