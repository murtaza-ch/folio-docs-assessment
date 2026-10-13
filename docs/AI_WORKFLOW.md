# AI workflow

## Tools used

Codex assisted with planning, code generation and documentation. Parallel agents worked on the workspace, the server and the rich text editor. The project uses Next.js and Chakra UI because the user requested them. AI initially proposed Postgres. The user chose their existing MongoDB cluster, and the implementation changed to MongoDB.

AI-generated work includes the initial application code, validation logic, rich text toolbar, repository layer, test cases and these draft notes. Agents read official framework documentation where APIs needed verification. The assistant inspected shared files to keep types and component contracts aligned.

## Where AI saved time

Parallel work let the server, UI and editor progress together. Shared TypeScript interfaces defined roles, document versions and content before the components connected. AI also produced an initial walkthrough outline and setup instructions that can be checked against the final implementation.

## Output changed during implementation

The editor uses Tiptap StarterKit's built-in underline extension after checking the v3 documentation, rather than adding a second extension with the same name. It sets `immediatelyRender: false` for Next.js. External content replacement uses `emitUpdate: false` to avoid triggering a save loop.

The component also avoids replacing the editor document when React passes back the same locally edited JSON. Resetting content on each parent state change would disturb selection and undo history. The implementation compares content before applying external updates.

MongoDB saves use an expected version in an atomic update. Blind last-write-wins saving was not chosen because two tabs could overwrite one another without a visible error. Conflict detection remains limited to preventing overwrite; it does not merge text.

The editor originally supported only two heading levels. It now allows all six because the Markdown importer accepts headings through level six. Keeping a smaller editor schema would discard valid formatting when an imported document opened.

## Verification

Generated code still needs the same checks as hand-written code. Relevant checks include TypeScript, the production build, service tests for permissions and concurrency, and browser exercises for create, edit, reload, import and cross-user sharing. The final record of checks that actually ran belongs in [SUBMISSION.md](../SUBMISSION.md).

TypeScript, the production build, and 28 automated tests passed. A Node API check passed against both localhost and the Vercel deployment, including actual MongoDB persistence and stale-save rejection. Chrome checks covered creation, rename, formatting after reload, view-only sharing, Markdown import, and saving a conflicting draft as a copy.

Browser review caught an initially empty word count and a busy state that briefly showed owner documents as view-only. Both were corrected. Inline formatting also introduced extra spaces into excerpts and caused inconsistent word counts; a shared text traversal now keeps marked text together. Malformed child nodes could throw before validation, so the validator now checks their shape first.

The first dependency installation failed because the existing npm cache contained root-owned files. A temporary npm cache allowed installation without changing the global cache permissions. The initial browser preview opened before the CSS file existed; after the stylesheet was written, the page rendered successfully.
