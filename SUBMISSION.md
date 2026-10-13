# Folio assessment submission

## Links and review access

- Source repository: https://github.com/murtaza-ch/folio-docs-assessment
- Live product: https://folio-docs-assessment.vercel.app
- Walkthrough video: pending your recording. Add the URL here and in `walkthrough-url.txt` before submission.
- Google Drive folder: pending upload of this source package and the walkthrough URL.
- Demo accounts: Alice Morgan, Ben Carter and Clara Park. Choose an account in the bottom-left switcher. No password is required.

The live production URL was checked without Vercel login. Reviewers can use seeded documents and create their own sample documents.

## Included files

- `app/`: Next.js page, layout, stylesheet and document/session/import/sharing routes.
- `components/`: Chakra provider, workspace, document list, Tiptap editor and import/sharing dialogs.
- `lib/`: shared types, validation, MongoDB repository, access service, importer and text extraction.
- `db/seed.ts`: sample users and documents.
- `scripts/setup-db.ts`: additive, repeatable database setup.
- `scripts/check-flows.mjs`: HTTP integration check with cleanup of its own records.
- `tests/backend.test.ts`: 28 automated permission, concurrency, validation and import tests.
- `examples/`: text and Markdown files for the demo.
- `README.md`: setup, run, verification and deployment instructions.
- `docs/ARCHITECTURE.md`: storage, access, concurrency and scope decisions.
- `docs/AI_WORKFLOW.md`: AI contributions, changes and verification.
- `docs/WALKTHROUGH.md`: timed script for your recording.
- `live-url.txt`, `walkthrough-url.txt` and this submission inventory.
- Package manifest, lockfile, TypeScript/Next.js configuration and `.env.example`.
- `screenshots/`: browser captures, when present in the packaged folder.

The source package excludes credentials, `.env.local`, `.vercel`, `node_modules`, `.next`, Git metadata and generated caches.

## Working behavior

Create and rename documents; edit bold, italic, underline, headings and lists; autosave and reopen persisted rich text; import UTF-8 `.txt` and `.md` files up to 1 MiB; share as editor or viewer; distinguish owned and shared documents; change or revoke access. API permissions and expected-version checks protect reads and writes. Stale saves retain the local draft and offer reload or save-as-copy recovery.

## Verification

| Check                                     | Result                                                        |
| ----------------------------------------- | ------------------------------------------------------------- |
| TypeScript                                | Passed                                                        |
| Automated tests                           | 28 passed                                                     |
| Production build                          | Passed locally and on Vercel                                  |
| Actual MongoDB API flows                  | Passed locally and on the live Vercel URL                     |
| Create, rename, bold formatting           | Passed Chrome checks                                          |
| Save, refresh, reopen with formatting     | Passed Chrome checks                                          |
| Markdown import with headings/lists/marks | Passed Chrome upload checks                                   |
| Text import and rejected invalid files    | Passed automated tests                                        |
| Owner/editor/viewer and revocation        | Passed API checks; viewer mode also checked in Chrome         |
| Conflict detection and save-as-copy       | Passed Chrome checks                                          |
| Public reviewer access                    | Live homepage and session API returned HTTP 200 without login |

## Incomplete and intentionally excluded

The walkthrough recording and Drive upload remain delivery steps. The user chose to record the walkthrough. Do not submit placeholder video links.

Production authentication, simultaneous text merging, `.docx` import, comments, version history and export are outside this timeboxed build. Demo identities are selectable and do not verify who a visitor really is. Markdown import supports a documented subset of headings, paragraphs, lists, quotes, code and inline marks; raw HTML is treated as text.

With another 2-4 hours, add verified sign-in, broader automated browser coverage for interrupted saves and permission changes, and a downloadable local draft for offline/conflict recovery.
