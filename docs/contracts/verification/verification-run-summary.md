# Verification Run Summary Contract

`verification-run-summary.v1` records structured verification results for a single workflow run. It is the only per-check result surface consumed by `spec-work` closeout.

Canonical fields are defined by `docs/contracts/verification/verification-run-summary.schema.json`:

- `profile`: the profile source, active profile name, and source path.
- `checks[]`: `id`, `service`, `command`, `status`, `exit_code`, `ran`, `required_tools`, `missing_tools`, `log_path`, `reason_code`, and `redaction_status`.

Status boundaries:

- `passed`: `ran=true`, `exit_code=0`, and a repo-relative redacted log ref exists.
- `failed`: `ran=true`, non-zero `exit_code`, and a repo-relative redacted log ref exists.
- `not-run`: `ran=false`, `exit_code=null`, and a concrete `reason_code`.
- `degraded`: evidence exists but is not strong enough for verified closeout.

Red-line mappings:

- Dry-run or schedulable-but-not-executed checks must be `not-run` with `reason_code: "schedulable"`.
- Missing required tools must be `not-run` with `reason_code: "missing_dependency"` and non-empty `missing_tools`.
- Helpers do not install tools, rerun commands, infer exit codes, or promote dry-runs to passed.

Trust boundary:

The capture helper is a thin recorder. Its trust level is "workflow step transcribed the real command result"; it is weaker than process-level supervision. The helper scans bounded log content for obvious secret-like text, but callers remain responsible for writing redacted logs before recording the summary.
