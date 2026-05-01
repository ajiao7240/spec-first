# Security Threat Model

Skill instructions and helper scripts are both part of the attack surface.

## Instruction Risks

- asking the agent to ignore system, developer, or governance rules
- requesting secret reads from `.env`, `.ssh`, browser profiles, wallet directories, or private keys
- asking for generated runtime assets to be edited directly
- hiding network or shell behavior behind vague wording

## Script Risks

- remote script pipe execution such as `curl ... | bash`
- destructive recursive deletion
- broad permission changes
- privileged commands
- executing scripts from user-provided paths without validation
- uploading secrets or workspace credentials

## Review Posture

Documented threat examples are not automatically vulnerabilities. The reviewer must inspect context and decide whether the text is prohibiting a pattern or instructing the agent to perform it.
