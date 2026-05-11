# Fixture Prompt: API Contract

Add `eligibility_summary` to each grant returned by the grants API.

Keep the work bounded to the grants API contract surface:

- update the API serializer,
- update the client normalization helper,
- update the API contract document,
- update the targeted unit test,
- add a changelog entry.

Do not add new endpoints, persistence, auth, release automation, dashboard output, or benchmark scoring.
