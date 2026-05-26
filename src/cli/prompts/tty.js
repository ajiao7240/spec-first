function requireTty(options = {}) {
  const input = options.input || process.stdin;
  const output = options.output || process.stdout;

  if (!input || input.isTTY !== true) {
    return {
      ok: false,
      reason: 'no-stdin-tty',
    };
  }

  if (!output || output.isTTY !== true) {
    return {
      ok: false,
      reason: 'no-stdout-tty',
    };
  }

  return {
    ok: true,
    reason: null,
  };
}

module.exports = {
  requireTty,
};
