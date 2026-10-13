# AI workflow

## Contributions

I used Codex and Claude to assist with planning, implementation, tests and documentation. I chose Next.js with Chakra UI and coordinated parallel work across the workspace, server, editor, authentication, collaboration and exports. I used shared TypeScript contracts to connect those parts and checked their integration. I own the architecture, implementation choices and final result.

I chose MongoDB Atlas because its document model fits Tiptap's JSON content and supports atomic writes that include permissions and version history. I implemented persistence with the official MongoDB driver, then configured a dedicated assessment cluster and migrated the data while preserving the source. I started with seeded demo identities and extended the application with email/password authentication and collaboration features. Demo accounts now authenticate through real sessions, and the identity-selection endpoint is disabled.

I used AI assistance for interface components, validation, repositories, access checks, password/session handling, comments, history, presence, export serializers, tests and documentation. I checked the work against the installed Next.js guidance and official Node, MongoDB and Tiptap documentation where API behavior needed verification.

## Decisions corrected during review

Tiptap StarterKit already included underline, so a duplicate extension was removed. Deferred rendering avoids Next.js hydration issues. External content replacement suppresses update events, and identical state echoes do not reset the editor's selection or undo history. All six heading levels remain supported because imported Markdown can contain them.

Save authorization and the expected version are included in the atomic MongoDB update. An earlier permission read alone would leave a race with revoked editing access. Conflict recovery preserves the local draft and offers a copy rather than automatically replacing newer content.

History was added to that same atomic update. A simple 50-snapshot count could exceed MongoDB's document-size limit with large content, so snapshots also have a 6,000,000-byte BSON budget. Restoring creates a new version through the same guarded save path.

Password hashes live separately from public profiles, preventing profile responses from accidentally returning credential fields. Real sessions store only opaque-token digests, reject expired sessions before TTL cleanup, and revoke tokens on logout. The old user-ID cookie no longer authenticates requests. New accounts keep separate UUIDs and do not inherit sample-document access.

Presence uses MongoDB heartbeats and polling rather than a CRDT. Hidden tabs pause, multiple tabs aggregate by user, and expired or revoked participants are excluded. Remote saved content refreshes only clean editors. Comments enforce author/editor/owner rules independently of the interface.

Exports generate actual downloadable Markdown and PDF files. Bundled Noto Sans fonts avoid depending on remote font services. Unsupported PDF glyphs return an explicit error and preserve Markdown as a fallback. Markdown underline uses HTML tags, and the import documentation states that raw HTML remains literal text.

## Verification and limits

I used Claude and Codex during the UI refresh and retained server-side access checks and save guards while replacing presentation components. I addressed accidental dialog dismissal on interior clicks, enabled close buttons during mutations, mobile focus escaping the drawer, and truncated paragraph-style labels. I implemented Chakra Select after checking the official 3.37 documentation, including its dialog positioning guidance. My verification record distinguishes observed results from checks that remain incomplete.

I verified the implementation with TypeScript, unit tests, production builds, HTTP integration checks and browser review. The unit suites cover permission failures, competing saves, authentication, session expiry, rate limits, comment ownership, restore behavior, presence expiry and export content. I implemented integration scripts that exercise actual MongoDB persistence and the bounded-history pipeline, then clean up their test records.

Earlier browser review found an empty word count, an intermediate permission-label error and spaces inserted between inline formatting fragments. Shared text extraction and loading-state handling corrected them. Malformed rich text children now fail validation instead of causing an exception.

I recorded the release checks and their limits in [SUBMISSION.md](../SUBMISSION.md). I treat unit tests, browser interactions and deployed behavior as separate evidence. I will record the walkthrough and complete the Drive submission folder before submitting the assessment.
