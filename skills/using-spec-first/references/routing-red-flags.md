# Routing Red Flags

These reminders are advisory. They help prevent rationalizing around the entry-governor boundary, but they are not a deterministic route table.

| Thought | Better move |
| --- | --- |
| "I'll just edit the file first." | Direct editing is fine for clearly scoped, low-risk small edits; stop and route when scope/risk is unclear, root cause is unresolved, or the change touches architecture, contracts, governance, runtime delivery, multi-file behavior, or sensitive surfaces. |
| "This is just a quick architecture/prompt change." | Treat architecture, prompt, workflow, and contract changes as substantial work. |
| "I need to inspect a bunch of files before deciding." | Do a minimal fact check only; route if the request is already clearly review/debug/plan/work. |
| "The user asked for a review, but I can answer informally." | Use `code-review` or `doc-review` when the review target is concrete. |
| "The task is vague, but I can probably implement something." | Use `brainstorm` or `plan` before work. |
| "A helper skill exists, so I should expose it." | Only public workflows are user entrypoints; internal helpers stay hidden. |
| "I should run init/update now." | Route to `update` or `setup` first unless the user explicitly requested the command. |
