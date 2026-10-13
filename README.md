# Folio

I built a document workspace with Next.js, React, Chakra UI and Tiptap. I chose MongoDB Atlas because its JSON document model supports atomic saves with permissions and version history.

[Live app](https://folio-docs-assessment.vercel.app) · [Public report](https://folio-docs-assessment.vercel.app/report) · [Source](https://github.com/murtaza-ch/folio-docs-assessment)

## Try it

Sign in as `alice@folio.demo`, `ben@folio.demo` or `clara@folio.demo` with the public demo password `FolioDemo!2026`. You can also create an account; it starts with an empty workspace.

| Task                            | Where                                               |
| ------------------------------- | --------------------------------------------------- |
| Write and format                | New document, then the editor toolbar               |
| Import text or Markdown         | Import, up to 1 MiB                                 |
| Share with a registered account | Share, choose Can view or Can edit                  |
| Comment or restore a version    | Comments & history                                  |
| Download a document             | Export, choose Markdown or PDF                      |
| See another participant         | Open a shared document in separate browser profiles |

## Run locally

Use Node.js 22 or later.

```sh
git clone https://github.com/murtaza-ch/folio-docs-assessment.git
cd folio-docs-assessment
npm ci
cp .env.example .env.local
```

Set the server-only `MONGODB_URI`. The database defaults to `drive-test`; `MONGODB_DB` can override it. Keep credentials out of Git.

```sh
npm run db:setup
npm run dev
```

Open [localhost:3000](http://localhost:3000). Setup preserves existing documents and passwords.

## Check and deploy

```sh
npm run typecheck
npm test
npm run build
npm run test:flows   # requires a running app
```

I connected GitHub to Vercel. Pushes to `main` deploy automatically; Vercel holds the database environment variables.

Additional commands: `auth:setup` seeds demo credentials, `test:history` checks large-history writes, and `db:migrate` previews a migration. Migration reads private `SOURCE_MONGODB_URI` and `TARGET_MONGODB_URI` values from `.env.migration`; add `-- --apply` to copy and verify records.

## Read more

- [Report and limits](SUBMISSION.md)
- [Architecture diagram and decisions](docs/ARCHITECTURE.md)
- [AI use and engineering checks](docs/AI_WORKFLOW.md)
- [Walkthrough recording plan](docs/WALKTHROUGH.md)
