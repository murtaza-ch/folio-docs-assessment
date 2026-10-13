# AI workflow

## Contributions

Codex assisted with planning, implementation, tests and documentation. The user authorized parallel agents and requested Next.js with Chakra UI. Agents split work across the workspace, server, editor, authentication, collaboration and exports. Shared TypeScript contracts connected the parts, and the parent agent reviewed integration behavior.

AI initially proposed PostgreSQL. The user chose an existing MongoDB cluster, so persistence moved to the official MongoDB driver. The first scope used selectable demo identities. The user later requested email/password authentication and all stretch features, so those identities became authenticated demo accounts and the selection endpoint was disabled.

AI-generated work includes interface components, validation, the repository and access services, password/session handling, comments, history, presence, export serializers, test cases and these notes. Agents checked installed Next.js guidance and official Node, MongoDB and Tiptap documentation when APIs needed verification.

## Decisions corrected during review

Tiptap StarterKit already included underline, so a duplicate extension was removed. Deferred rendering avoids Next.js hydration issues. External content replacement suppresses update events, and identical state echoes do not reset the editor's selection or undo history. All six heading levels remain supported because imported Markdown can contain them.

Save authorization and the expected version are included in the atomic MongoDB update. An earlier permission read alone would leave a race with revoked editing access. Conflict recovery preserves the local draft and offers a copy rather than automatically replacing newer content.

History was added to that same atomic update. A simple 50-snapshot count could exceed MongoDB's document-size limit with large content, so snapshots also have a 6,000,000-byte BSON budget. Restoring creates a new version through the same guarded save path.

Password hashes live separately from public profiles, preventing profile responses from accidentally returning credential fields. Real sessions store only opaque-token digests, reject expired sessions before TTL cleanup, and revoke tokens on logout. The old user-ID cookie no longer authenticates requests. New accounts keep separate UUIDs and do not inherit sample-document access.

Presence uses MongoDB heartbeats and polling rather than a CRDT. Hidden tabs pause, multiple tabs aggregate by user, and expired or revoked participants are excluded. Remote saved content refreshes only clean editors. Comments enforce author/editor/owner rules independently of the interface.

Exports generate actual downloadable Markdown and PDF files. Bundled Noto Sans fonts avoid depending on remote font services. Unsupported PDF glyphs return an explicit error and preserve Markdown as a fallback. Markdown underline uses HTML tags, and the import documentation states that raw HTML remains literal text.

## Verification and limits

The UI refresh included contributions from Claude and Codex. The final review retained server-side access checks and the existing save guards while replacing presentation components. Review found and corrected accidental dialog dismissal on interior clicks, enabled close buttons during mutations, mobile focus escaping the drawer, and truncated paragraph-style labels. Native dropdowns were replaced with Chakra Select after checking the official 3.37 documentation, including its dialog positioning guidance. The documented checks describe observed results rather than treating generated code as finished by default.

Generated code receives TypeScript, unit, production-build, HTTP integration and browser checks. Unit suites cover permission failures, competing saves, authentication, session expiry, rate limits, comment ownership, restore behavior, presence expiry and export content. Dedicated integration scripts exercise actual MongoDB persistence and the bounded-history pipeline, then clean up their test records.

Earlier browser review found an empty word count, an intermediate permission-label error and spaces inserted between inline formatting fragments. Shared text extraction and loading-state handling corrected them. Malformed rich text children now fail validation instead of causing an exception.

The final expanded-release checks are being recorded separately in [SUBMISSION.md](../SUBMISSION.md). A successful unit test does not prove a browser interaction or deployment worked; those checks must be observed directly. The user will record the walkthrough, and a Drive submission folder still needs to be delivered.
