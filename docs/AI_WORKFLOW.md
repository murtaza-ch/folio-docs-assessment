# AI workflow

I used Codex and Claude for planning, implementation, review, tests and documentation. I own the architecture, technical decisions and final result.

## How I worked

1. I chose Next.js, Chakra UI, Tiptap and MongoDB Atlas.
2. I split implementation work into focused tasks with shared TypeScript contracts.
3. I checked APIs against installed Next.js guidance and official library documentation.
4. I reviewed integration behavior and verified changes with tests, builds, HTTP flows and browser checks.

## Decisions I checked

| Concern           | Implementation                                                   |
| ----------------- | ---------------------------------------------------------------- |
| Concurrent saves  | Atomic access/version checks and draft recovery                  |
| Oversized history | Snapshot count and BSON byte limits                              |
| Authentication    | Separate password hashes, opaque sessions and logout revocation  |
| Editor state      | Preserve local selection and suppress external-update save loops |
| UI accessibility  | Focus containment, dialog behavior and Chakra Select             |
| Exports           | Actual PDF generation, bundled fonts and explicit glyph errors   |

I record observed checks and incomplete work in the [report](../SUBMISSION.md). Passing a unit test is separate from verifying a browser action or deployment.
