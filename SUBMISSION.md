# Folio assessment report

I implemented Folio, a document workspace with authenticated accounts, rich text editing and controlled sharing.

[Live app](https://folio-docs-assessment.vercel.app) · [Public source](https://github.com/murtaza-ch/folio-docs-assessment)

## Review access

Use `alice@folio.demo`, `ben@folio.demo` or `clara@folio.demo` with the public demo password `FolioDemo!2026`. New accounts receive an empty workspace.

## What I built

| Area          | Delivered behavior                                              |
| ------------- | --------------------------------------------------------------- |
| Accounts      | Email/password signup, sign-in and session revocation on logout |
| Editing       | Rich text, rename, autosave and draft recovery after conflicts  |
| Access        | Owner, editor and viewer roles; invitations by registered email |
| Collaboration | Viewing/editing indicators and document comments                |
| History       | Preview and restore a saved version as a new version            |
| Files         | Text/Markdown import and Markdown/PDF export                    |
| Interface     | Responsive workspace, keyboard navigation and Chakra Select     |

## How it works

![Browser sends authenticated requests to the Next.js API, which validates access and saves to MongoDB.](https://folio-docs-assessment.vercel.app/report-flow.svg)

I chose MongoDB Atlas to store Tiptap JSON, permissions and bounded history in one document. Saves check the expected version and current access atomically. A conflicting save preserves the local draft.

I use a dedicated Atlas cluster with the database name `drive-test`. I migrated the existing app data and preserved the source. Imports store parsed text, not uploaded binaries; external file storage is unnecessary for this scope.

## Verification

| Check                           | Observed result                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| TypeScript and production build | Passed                                                                                               |
| Automated tests                 | 80 passed across five suites                                                                         |
| Local HTTP flows                | Auth, permissions, saves, comments, restore, presence, imports and exports passed                    |
| Live checks                     | Full feature flows passed before the UI refresh; final UI release sign-in and document access passed |
| Browser review                  | Desktop and 390px layouts, login, dialogs, focus, conflict recovery and dropdowns checked            |
| Large-history stress check      | Passed on the source database; target rerun stopped after slow writes and cleaned up                 |

## Engineering choices and limits

I keep credentials server-side, hash passwords with scrypt, store session-token digests, validate requests and enforce access in the API. I used AI assistants for implementation and review; I own the decisions and final result.

Presence polls every 3 seconds; it does not merge simultaneous keystrokes or show live cursors. Comments attach to documents. History keeps up to 50 previous snapshots within a 6 MB BSON budget. PDF supports up to 200 pages and the bundled font's glyph set; unsupported text can be exported as Markdown.

Password reset, email verification, folders, `.docx` and Drive import are outside this implementation. My walkthrough recording and Drive submission upload remain pending.

[Architecture](https://github.com/murtaza-ch/folio-docs-assessment/blob/main/docs/ARCHITECTURE.md) · [AI workflow](https://github.com/murtaza-ch/folio-docs-assessment/blob/main/docs/AI_WORKFLOW.md) · [Recording plan](https://github.com/murtaza-ch/folio-docs-assessment/blob/main/docs/WALKTHROUGH.md)
