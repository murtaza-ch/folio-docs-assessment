# Folio

Folio is a document workspace built with Next.js, React, Chakra UI and Tiptap. Create a document, format it, return to it later, and share it with another demo user as an editor or viewer.

Source repository: [murtaza-ch/folio-docs-assessment](https://github.com/murtaza-ch/folio-docs-assessment).

Live app: [folio-docs-assessment.vercel.app](https://folio-docs-assessment.vercel.app). No account setup is needed; choose Alice, Ben or Clara in the demo account switcher.

## Run locally

Use Node.js 22 or later and npm. The repository includes pinned dependency versions and a lockfile.

```sh
npm ci
cp .env.example .env.local
```

Set `MONGODB_URI` to your MongoDB connection string. `MONGODB_DB` defaults to `drive-test`; set it only if you need another database. These variables belong on the server and must never use the `NEXT_PUBLIC_` prefix.

```sh
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Database setup creates indexes and seeds Alice Morgan, Ben Carter and Clara Park. Reviewers can use the identity switcher to demonstrate access across users without creating an account.

The identity switcher is an assessment convenience. It does not verify a user's real identity. Use only sample documents in the demo deployment. A production app would replace this selector with an authentication provider while retaining server-side document permissions.

## What to try

- Create and rename a document. Format text with bold, italic, underline, headings and lists.
- Wait for the saved state, reload the page, and reopen the document.
- Import a `.txt` or `.md` file up to 1 MiB. Imports create an editable document.
- Share a document as a viewer, switch to that user, and open it under shared documents.
- Change the share to editor, then edit as that user. Switch back to the owner and reopen it.
- Open the same document in two tabs. A stale save should show a conflict instead of silently replacing the newer version.

## Validation

```sh
npm run typecheck
npm test
npm run build
```

TypeScript, all 28 tests, the production build, and local/deployed API checks passed. See [SUBMISSION.md](SUBMISSION.md) for the browser verification record.

To run the API flow check against your running app, use `npm run test:flows`. It creates temporary documents and removes those records through the configured MongoDB connection. Set `APP_URL` to test a deployment using the same database. Sample import files are in `examples/`.

## Deploy

This repository is connected to the `folio-docs-assessment` Vercel project. Pushes to `main` deploy the production app.

For a separate deployment, import the repository into Vercel. Add the server environment variables, run database setup against the intended demo database, then build with `npm run build`. The deployment needs a persistent MongoDB database. Configure the host so reviewers can open the live URL without joining a hosting team.

Do not include `.env.local`, connection credentials, local database files or `node_modules` in the submission folder.

## Notes

[Architecture](docs/ARCHITECTURE.md) explains storage, permissions and save behavior. [AI workflow](docs/AI_WORKFLOW.md) records how AI contributed and what was reviewed. [Walkthrough](docs/WALKTHROUGH.md) is a recording outline for the required 3-5 minute demo.

Folio does not implement simultaneous text merging, document comments, full Google Drive import, or `.docx` import. The assessment requires at least one supported file type; this implementation focuses on text and Markdown.
