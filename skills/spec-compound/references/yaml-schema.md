# YAML Frontmatter Schema

`schema.yaml` in this directory is the canonical contract for `docs/solutions/` frontmatter written by `spec:compound`.

Use this file as the quick reference for:
- track classification
- shared required fields
- track-specific fields
- validation expectations
- category mapping

## Track Classification

- **Bug track**: `build_error`, `test_failure`, `runtime_error`, `performance_issue`, `database_issue`, `security_issue`, `ui_bug`, `integration_issue`, `logic_error`
- **Knowledge track**: `best_practice`, `documentation_gap`, `workflow_issue`, `developer_experience`

## Shared Required Fields

- **module**: Module or area affected
- **date**: ISO date in `YYYY-MM-DD`
- **problem_type**: One of the bug/knowledge enums above
- **component**: One of `rails_model`, `rails_controller`, `rails_view`, `service_object`, `background_job`, `database`, `frontend_stimulus`, `hotwire_turbo`, `email_processing`, `brief_system`, `assistant`, `authentication`, `payments`, `development_workflow`, `testing_framework`, `documentation`, `tooling`
- **severity**: One of `critical`, `high`, `medium`, `low`

## Bug Track Fields

- **Required**:
  - `symptoms`
  - `root_cause`
  - `resolution_type`
- **Optional**:
  - `rails_version`

## Knowledge Track Fields

- **Required**:
  - `applies_when`
- **Optional**:
  - `symptoms`
  - `root_cause`
  - `resolution_type`

## Optional Fields for Both Tracks

- **related_components**
- **tags**

## Category Mapping

- `build_error` -> `docs/solutions/build-errors/`
- `test_failure` -> `docs/solutions/test-failures/`
- `runtime_error` -> `docs/solutions/runtime-errors/`
- `performance_issue` -> `docs/solutions/performance-issues/`
- `database_issue` -> `docs/solutions/database-issues/`
- `security_issue` -> `docs/solutions/security-issues/`
- `ui_bug` -> `docs/solutions/ui-bugs/`
- `integration_issue` -> `docs/solutions/integration-issues/`
- `logic_error` -> `docs/solutions/logic-errors/`
- `developer_experience` -> `docs/solutions/developer-experience/`
- `workflow_issue` -> `docs/solutions/workflow-issues/`
- `best_practice` -> `docs/solutions/best-practices/`
- `documentation_gap` -> `docs/solutions/documentation-gaps/`

## Validation Rules

1. Determine track from `problem_type`.
2. All shared required fields must be present.
3. Bug-track docs must include `symptoms`, `root_cause`, and `resolution_type`.
4. Knowledge-track docs must include `applies_when`.
5. Enum fields must match the allowed values exactly.
6. Array fields must respect `min_items` / `max_items` when specified.
7. `date` must match `YYYY-MM-DD`.
8. `rails_version`, if present, must match `X.Y.Z` and only applies to bug-track docs.
9. `tags` should be lowercase and hyphen-separated.
