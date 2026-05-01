# Security Policy

Security reports are welcome.

No private security reporting channel is configured in this repository yet. Until one is configured, use the public GitHub issue tracker and avoid posting secrets, tokens, private customer data, or exploit details that could put users at immediate risk:

https://github.com/sunrain520/spec-first/issues

For sensitive reports, open a minimal issue that says you have a security concern and provide only non-sensitive coordination details. The maintainers can then arrange a safer follow-up channel.

## Scope

Security-sensitive areas include:

- CLI installation and initialization behavior.
- Generated runtime asset handling.
- File path validation and cleanup logic.
- Any workflow that writes files into a user project.
- Dependency, release, and package-publishing behavior.

## Reporting Guidance

Include:

- Affected version or commit.
- Host environment, such as Claude Code or Codex when relevant.
- Reproduction steps using a throwaway project when possible.
- Expected behavior and observed behavior.
- Whether secrets, user data, or project files could be exposed or modified.

Do not include live secrets or private data in public issues.

## Response Expectations

The project will prioritize credible security reports, but it does not have a formal SLA yet.
