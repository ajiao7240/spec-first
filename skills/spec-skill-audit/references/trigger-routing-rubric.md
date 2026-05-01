# Trigger Routing Rubric

Good trigger descriptions explain when to use the workflow, not just what the implementation does.

Check:

- Does frontmatter description name the user intent?
- Does frontmatter description include negative boundary wording for host discovery?
- Does the body include positive trigger examples?
- Does the body define when not to use it?
- Does it avoid broad phrases like "any task" or "general help"?
- Does it overlap another workflow's entrypoint?

The script only extracts signals. The LLM decides whether a trigger is semantically correct.

For discovery validation, compare at least a few should-trigger and should-not-trigger case candidates. Missing frontmatter negative boundary is a signal, not proof of bad routing.
