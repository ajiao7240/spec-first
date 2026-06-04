# Verification Profile Contract

`verification-profile.v1` is the source-owned contract for declaring verification checks. It tells workflows which check identities and commands exist; it does not run those commands and does not decide whether validation passed.

Canonical file locations:

- Team source profile: `spec-first.verification.json`
- Local JSON override: `.spec-first/verification-profile.local.json`
- Local YAML alias: `.spec-first/config.local.yaml` may point `verification_profile_path` at the JSON override path.

Canonical fields are defined by `docs/contracts/verification/verification-profile.schema.json`:

- `default_profile`: active profile name.
- `profiles.<name>.services`: service ids included by a profile.
- `profiles.<name>.checks`: check ids requested by a profile.
- `services.<id>`: repo-relative service path, stack id, and whether the service is required.
- `stacks.<id>.detect`: stack detection hints.
- `stacks.<id>.commands.<check>`: check id to command mapping.
- `stacks.<id>.runner_kind.<check>`: runner kind for that check.
- `stacks.<id>.required_tools.<check>`: required tool ids for that check.

If no profile file exists, workflows may infer a profile from `package.json` scripts such as `typecheck`, `test`, `test:unit`, `test:smoke`, `test:integration`, `lint`, and `build`. Inferred profiles must be marked `profile_source: "inferred"` and remain weaker than an explicit source profile.

Boundary:

- The loader only parses and resolves command candidates.
- Missing tools, dry-runs, and command results belong to `verification-run-summary.v1`.
- `productSmoke` is intentionally absent from this schema; adding it requires a future schema bump.
