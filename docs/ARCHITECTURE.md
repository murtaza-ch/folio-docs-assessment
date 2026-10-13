# Architecture

## Application structure

Next.js serves the React workspace and the API in one application. Chakra UI supplies interface components. Tiptap represents rich text as JSON and initializes after the client mounts to avoid hydration errors. Shared TypeScript types define document roles and response contracts; Zod and explicit rich text checks validate input at runtime.

The browser keeps the editing draft and save status. Route handlers verify sessions, check resource access, validate requests and call MongoDB repositories. Protected behavior remains enforced even when a caller bypasses the interface.

## MongoDB and stored data

The user chose an existing MongoDB cluster and the `drive-test` database. The server uses the official MongoDB driver and reuses its connection pool. Credentials and the connection string remain on the server.

| Collection | Stored data |
| --- | --- |
| `folio_users` | UUID profile, name, normalized email, initials and avatar color |
| `folio_credentials` | Profile UUID, email and salted password hash |
| `folio_sessions` | SHA-256 session-token digest, profile UUID and expiration |
| `folio_auth_rates` | Hashed rate-limit keys, counts and expiration |
| `folio_documents` | Owner UUID, title, rich text JSON, shares, version and bounded history |
| `folio_comments` | Document comments, author, timestamps and resolution state |
| `folio_presence` | Per-tab viewing/editing heartbeat and expiration |

Document shares are embedded so authorization and versioned content writes can match one MongoDB record. Indexes support owner/shared document lists, unique account emails, comment lists, presence identity and TTL cleanup. Setup is additive and repeatable; seed records use `$setOnInsert` and existing passwords are preserved.

Text and Markdown imports become validated Tiptap JSON. The application stores document content rather than the uploaded binary. There is no upload bucket, cloud file store or Google Drive import connection.

## Authentication and permissions

Email/password authentication uses Node's scrypt with an independent 16-byte salt, `N=131072`, `r=8`, `p=1`, and a 64-byte derived key. Comparisons use `timingSafeEqual`. Missing accounts still perform dummy derivation, and invalid sign-ins return the same message. Account creation commits the profile and credential record together, with one UUID shared by both records.

Login issues a random 32-byte opaque token. Only its SHA-256 digest is stored in MongoDB. The `folio_session` cookie is HTTP-only, SameSite Lax, secure in production, and lasts seven days. The server checks expiration explicitly before MongoDB TTL cleanup. Login rotates the browser's previous session; logout revokes it server-side and clears cookies. A missing or invalid token grants no document access. The former demo identity-selection endpoint rejects requests.

Signup and sign-in have shared MongoDB rate limits in 15-minute windows. Sign-in allows 12 attempts per email and 60 per IP; signup allows 5 per email and 20 per IP. Keys hash the email/IP. Forwarded IP headers are trusted only on Vercel, which overwrites them; other environments use a shared fallback bucket.

Public demo credentials authenticate Alice, Ben and Clara while preserving their existing profile UUIDs and sample-document roles. A new account gets a separate profile and no access to existing documents. The session response exposes demo profiles, not the full account directory. Owners can invite a registered account by its exact email.

Owners edit and manage shares. Editors edit. Viewers read, export, inspect history, and participate in document comments. Protected routes verify current document access. State-changing routes also check request origin, and sensitive responses use `Cache-Control: no-store`.

## Saving, conflicts and history

Autosaves include the expected document version. The atomic MongoDB update matches both that version and current owner/editor permission, so access revocation cannot be bypassed using an earlier authorization read. A successful save increments the version. A stale write returns HTTP 409 with the latest accessible document and leaves the server content intact.

The same atomic update snapshots the pre-save title and content with their author and timestamp. It retains at most 50 previous snapshots and at most 6,000,000 bytes of snapshot BSON. Larger documents therefore retain fewer snapshots. History responses include the current version alongside retained snapshots. There is no permanent revision archive.

Owners and editors can restore a retained snapshot. Restore uses the expected current version and creates a new version; it does not rewind the counter or silently overwrite a concurrent save. Viewers can preview history but cannot restore.

The browser retains a failed or conflicting draft and offers reload or save-as-copy recovery. Tiptap avoids resetting identical local content, preserving selection and undo history. Deliberate external replacement suppresses `onUpdate` to avoid save loops.

## Presence and comments

Visible document tabs poll activity every 3 seconds and publish a heartbeat every 6 seconds. MongoDB presence records expire after 20 seconds; responses also filter expired records before TTL deletion. Multiple tabs aggregate into one participant, with active editing taking precedence. Hidden tabs pause and send a leave request. Presence filters participants against current document access, and viewers cannot announce editing activity.

A changed remote document version refreshes an editor only when it has no pending draft or save. Otherwise the client shows a remote-change notice and the save conflict mechanism protects the draft. This is polling-based presence and saved-version synchronization. It provides no CRDT merging, live cursors or character-by-character collaboration.

Comments belong to the document, with a 2,000-character body limit. Any current reader can post. Authors and document owners can edit or delete a comment. Authors, editors and owners can resolve or reopen it. A viewer cannot resolve another person's comment. Deleted comments are hidden using a deletion timestamp.

## Imports and exports

Imports accept UTF-8 `.txt` and `.md` files up to 1 MiB. Validation checks extension, size, encoding, binary null bytes and the resulting rich text tree. The Markdown parser supports headings, paragraphs, simple lists, quotes, fenced code and common inline marks. Raw HTML remains text; links require HTTP, HTTPS or mailto protocols.

Markdown export serializes the saved JSON, escapes text and handles code fences and links. Underline uses `<u>` tags because Markdown has no standard underline syntax. Importing that export treats those tags as literal text, so full formatting round trips are not promised.

PDF export produces a downloadable PDF with headings, lists, quotes, code blocks, inline styles and page numbers. It embeds bundled Noto Sans regular, bold, italic and bold-italic fonts. Characters outside the bundled font's glyph set return HTTP 422 with a Markdown fallback message; exports never silently remove them. PDF generation has a 200-page limit. Exports read saved content after current access checks and use safe attachment filenames.

## Limits and follow-up

The app does not implement email verification, password reset, `.docx` conversion, Drive import, folders, anchored comment threads or simultaneous text merging. Public demo accounts remain shared reviewer accounts. The next work should add account recovery, broader interrupted-save browser coverage and a downloadable local draft, then evaluate a collaboration protocol if live text merging is required.

## Reference decisions

Tiptap's [Next.js guide](https://tiptap.dev/docs/editor/getting-started/install/nextjs) documents deferred rendering. Its [setContent API](https://tiptap.dev/docs/editor/api/commands/content/set-content) documents suppressed update events. [MongoDB compound operations](https://www.mongodb.com/docs/drivers/node/current/crud/compound-operations/) explain atomic updates, and [Node crypto](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback) documents scrypt and its work parameters.
