# Folio assessment submission

## Links and review access

- Source repository: https://github.com/murtaza-ch/folio-docs-assessment
- Live product: https://folio-docs-assessment.vercel.app
- Walkthrough video: pending the user's recording. Add the URL here and in `walkthrough-url.txt` before submission.
- Google Drive folder: pending upload of the source package and walkthrough URL.
- Demo login emails: `alice@folio.demo`, `ben@folio.demo`, `clara@folio.demo`.
- Public demo password for all three accounts: `FolioDemo!2026`.

The private GitHub repository is connected to Vercel with `main` as the production branch. The reviewer can sign in using the public demo credentials or create a separate account. Newly registered accounts receive no existing-document access until an owner shares with their registered email.

## Included files

- `app/`: workspace, auth and document APIs, comments, versions, presence and export routes; bundled PDF fonts and their license.
- `components/`: Chakra provider, auth screen, document workspace/editor, sharing/import dialogs, comments/history, presence and export controls.
- `lib/`: types, validation, MongoDB repositories, access and authentication services, import/export logic and collaboration services.
- `db/seed.ts`: sample profiles and documents.
- `scripts/setup-db.ts`, `scripts/setup-auth.ts`: additive setup with preserved documents and existing passwords.
- `scripts/check-flows.mjs`, `scripts/check-history.ts`: HTTP integration and actual MongoDB history/concurrency checks with cleanup.
- `tests/`: backend, authentication, collaboration, presence and export suites.
- `examples/`: text and Markdown import samples.
- `README.md`, architecture/AI/walkthrough notes, this inventory, and live/walkthrough URL files.
- Package manifest, lockfile, configuration, `.env.example` and screenshots when included in the source package.

The package excludes credentials, `.env.local`, `.vercel`, `node_modules`, `.next`, Git metadata and generated caches.

## Working behavior

Email/password signup and sign-in; seven-day database-backed sessions; logout revocation; rich text create/rename/autosave/reopen; UTF-8 `.txt` and `.md` import up to 1 MiB; owner/editor/viewer access, email invitations and revocation; polling viewing/editing presence; document comments with edit/delete/resolve rules; bounded atomic version history with preview and guarded restore; downloadable Markdown and generated PDF exports.

Expected-version writes prevent silent overwrites. Failed or conflicting saves retain the draft and offer reload or save-as-copy recovery. History stores at most 50 previous snapshots within 6,000,000 bytes of snapshot BSON. PDF uses bundled Noto Sans fonts, reports unsupported glyphs with HTTP 422 and offers Markdown as the text-preserving alternative.

Imports persist parsed content in MongoDB. Uploaded binaries are not retained, and no external cloud file store or Drive import is configured.

## Verification record

The expanded release passed local checks and the production HTTP flow check on October 14, 2026. GitHub commit `551d7d1` deployed successfully through the connected Vercel project.

| Check                                                 | Final expanded-release result           |
| ----------------------------------------------------- | --------------------------------------- |
| TypeScript                                            | Passed                                  |
| All automated suites                                  | 80 tests passed across five suites      |
| Production build                                      | Passed                                  |
| Auth/signup/logout and permission HTTP flows          | Passed on localhost after migration     |
| Actual MongoDB history byte bound and competing saves | Passed on source; target stress rerun stopped after slow large writes; temporary records removed |
| Comments, restore, presence and export HTTP flows     | Passed on localhost after migration     |
| Browser create/edit/reopen/import/sharing             | Core review passed; sharing rechecked   |
| Browser authentication and stretch-feature controls   | Sign-in, comments, inline restore and both downloads passed; presence API passed |
| Public reviewer access to final deployment            | Passed without hosting-team authentication |
| Expanded production HTTP flow check                   | Passed, including auth, permissions, comments, history/restore, presence, PDF/Markdown, imports and conflicts |

Commands are `npm run typecheck`, `npm test`, `npm run build`, `npm run test:flows` and `npm run test:history`. `db:setup` runs document and authentication setup; `auth:setup` runs only the latter.

The app now uses the free cluster in the Murtaza Assessment Atlas project, retaining the database name `drive-test`. Migration copied and verified five users, nine documents, five credentials and two comments. The source database remains intact. Sessions and presence were excluded, so users sign in again after the switch.

The target cluster passed the complete local and production HTTP checks, including atomic saves and restoration. The separate multi-megabyte history stress check was stopped after slow writes on the free cluster; its two temporary documents were removed. Browser controls were checked locally. The final live browser inspection was interrupted by browser automation timeouts, so the production verification above is an HTTP check.

## UI release review

The UI refresh uses shared tokens, Instrument Sans for controls and Newsreader for document text. The workspace has a searchable document table, a separate editor, a mobile navigation drawer, explicit save states and reusable feedback components. Sign-in, sharing, import, comments and version history use the same spacing and control styles.

The paragraph-style, invite-person and permission dropdowns use Chakra UI 3.37 Select with controlled collections, HiddenSelect, triggers, indicators and options. Sharing dropdowns stay inside the dialog with fixed positioning; the editor dropdown is portalled to avoid toolbar clipping. Paragraph labels remain on one line in a 144px control.

Local verification passed TypeScript, 80 automated tests, production build and HTTP flows. Chrome review covered desktop and 390px layouts, drawer focus wrapping, dialog dismissal, conflict recovery, heading selection, person selection and permission-menu Escape behavior.

## Limits and remaining delivery

The user will record the walkthrough. Video and Google Drive delivery remain incomplete; no placeholder video link should be submitted.

Presence polls every 3 seconds, heartbeats every 6 seconds and expires inactive tabs after 20 seconds. It does not provide CRDT text merging or live cursor positions. Comments attach to a document, not text selections. History is bounded rather than a permanent audit archive. Markdown import supports a subset and treats raw HTML literally, including `<u>` tags used by exported underline. PDF is limited to 200 pages and the bundled font's glyph set.

Account recovery, email verification, `.docx` import, Drive import and folders are not implemented. Public demo accounts are shared assessment accounts. The next work would add password recovery, broader browser coverage for interrupted saves and permission changes, and downloadable draft recovery.
