# Folio

Folio is a collaborative document workspace built with Next.js, React, Chakra UI, Tiptap and MongoDB. It supports email/password accounts, rich text editing, sharing, activity presence, comments, version history, and downloadable Markdown and PDF exports.

Source repository: [murtaza-ch/folio-docs-assessment](https://github.com/murtaza-ch/folio-docs-assessment).

Live app: [folio-docs-assessment.vercel.app](https://folio-docs-assessment.vercel.app).

## Review access

Sign in with one of the public demo accounts:

| Account      | Email              |
| ------------ | ------------------ |
| Alice Morgan | `alice@folio.demo` |
| Ben Carter   | `ben@folio.demo`   |
| Clara Park   | `clara@folio.demo` |

All three demo accounts use the public password `FolioDemo!2026`. Their documents are shared sample data. You can also create an account with your own email and password; a new account starts with an empty workspace. Sharing with a new account uses its exact registered email.

## Run locally

Use Node.js 22 or later and npm. Dependency versions are pinned in the manifest and lockfile.

```sh
npm ci
cp .env.example .env.local
```

Set `MONGODB_URI` to your MongoDB connection string. The default database is `drive-test`; optionally set `MONGODB_DB` to use another database. Keep both variables server-side and outside source control.

```sh
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `db:setup` runs the document seed and authentication setup. Setup adds indexes, sample profiles and documents, and credentials for demo profiles that do not already have credentials. It preserves existing documents and passwords. To run only the authentication setup later:

```sh
npm run auth:setup
```

## What to try

- Sign in, create and rename a document, and format text with bold, italic, underline, headings and lists. Wait for the saved state, reload, and reopen it.
- Import a UTF-8 `.txt` or `.md` file up to 1 MiB. The result is an editable document. The source file's binary is not retained; parsed content is stored in MongoDB.
- Share with another registered user as a viewer or editor. Sign out and sign in as that user to check the different permissions. Owners can change or revoke access.
- Open a shared document in separate browser profiles. Presence shows who is viewing or editing. Saved remote changes refresh a clean editor; local unsaved changes remain protected by version checks.
- Open Comments & history. Add a document comment, resolve it, preview a saved version, and restore it as a new version.
- Download the saved document using MD or PDF. PDF is a generated file, with bundled Noto Sans fonts and page layout. Unsupported glyphs produce an explicit error; Markdown preserves the full text.
- Test an old-tab save. A conflict retains the local draft and offers reload or save-as-copy recovery.

Presence polls every 3 seconds, sends heartbeats every 6 seconds, and expires inactive tabs after 20 seconds. It does not merge simultaneous keystrokes. Comments are attached to the document rather than a selected text range. History retains at most 50 previous snapshots within a 6,000,000-byte BSON budget, so large documents retain fewer versions.

## Validation

```sh
npm run typecheck
npm test
npm run build
```

The suites cover authorization, authentication, concurrency, imports, comments, history, presence and exports. The verification record for the release belongs in [SUBMISSION.md](SUBMISSION.md).

With the app running, use these checks against the configured assessment database:

```sh
npm run test:flows
npm run test:history
```

The HTTP flow check exercises sign-in, signup, sharing, saving, comments, restore, presence and exports. It removes its own test records. Set `APP_URL` to check a deployment using the same database. The history check exercises the actual MongoDB pipeline with large content and competing saves, then removes its temporary document. Sample import files are in `examples/`.

## Deploy

The repository is connected to the `folio-docs-assessment` Vercel project. Pushes to `main` deploy the production app.

For a separate deployment, import the repository into Vercel, add the MongoDB server variables, and run database setup against the intended database. Build with `npm run build`. Reviewer access should not require joining a hosting team. Production sessions use secure HTTP-only cookies, and document APIs verify authentication and access on the server.

Exclude `.env.local`, credentials, `.vercel`, `node_modules` and `.next` from the submission package.

## Database migration

The assessment uses its own free Atlas cluster in the Murtaza Assessment project. The database remains `drive-test`, and the original source data is preserved. The migration copies users, documents, credentials and comments, verifies BSON values, and rejects conflicting target records. It skips temporary sessions and presence.

For a future migration, set `SOURCE_MONGODB_URI` and `TARGET_MONGODB_URI` in a private, ignored `.env.migration` file. Run `npm run db:migrate` for a dry run, then `npm run db:migrate -- --apply` to copy and verify the records. Run `npm run db:setup` against the target afterward. Never commit either connection string.

## Scope and delivery

[Architecture](docs/ARCHITECTURE.md) explains storage, authentication, permissions and collaboration. [AI workflow](docs/AI_WORKFLOW.md) records AI contributions and review. [Walkthrough](docs/WALKTHROUGH.md) outlines the required 3-5 minute recording.

The user will record the walkthrough. Its URL and the Google Drive submission folder remain delivery steps. Folio does not provide CRDT text merging, cursor positions, `.docx` import, Google Drive file import, password reset or email verification. Markdown import supports a subset; exported underline uses `<u>` tags, which import treats as literal text.
