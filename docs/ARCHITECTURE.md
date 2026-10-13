# Architecture

## Application structure

Next.js serves the React workspace and the API in one application. Chakra UI supplies the interface components. Tiptap manages rich text as a structured JSON document. The editor defers initialization until the client mounts to avoid Next.js hydration errors.

The browser owns the current editing draft and save status. The API validates requests, identifies the current demo user, checks document permissions, and writes through a repository. Keeping access checks in the service prevents the read-only interface from being the only protection against writes.

## Why MongoDB

The user selected an existing MongoDB cluster and the `drive-test` database. Tiptap produces a structured JSON tree, which MongoDB stores directly. Formatting survives saves without converting the document to HTML and back.

Documents embed their shares so access checks and versioned content updates can operate on one record. Users live in a separate collection. The application keeps its connection string on the server. Reviewers need only the application URL, not a database account.

## Data model

Each document has an owner, title, rich text content, timestamps and an integer version. Embedded shares give a recipient `editor` or `viewer` access. Owners can edit and manage shares. Editors can edit. Viewers can read. Document lists separate owned documents and shared documents using the current user's effective role.

The server validates the allowed document node types and marks before storage. It limits content size and nesting, checks request fields, and validates link protocols. Imports become the same JSON representation used by newly created documents.

## Saving and concurrency

The workspace queues draft changes and sends the document's current version with each save. An atomic MongoDB update must match that version and increments it on success. A newer version produces HTTP 409 with the latest accessible document. This stops an old tab from silently overwriting a successful save from another tab.

The client retains its draft when saving fails and shows a recovery action. Loading the latest server version is a deliberate replacement of the local draft. This is optimistic concurrency control; it does not merge simultaneous edits. Real-time collaboration would require a separate conflict-free editing protocol and presence infrastructure.

The Tiptap component compares incoming content with its current JSON before calling `setContent`. Local state echoes therefore preserve selection and undo history. A deliberate external replacement suppresses `onUpdate` so it does not cause a save loop.

## Identity and permissions

The assessment uses seeded identities and an explicit identity switcher. The selected identity is stored in the HTTP-only `folio_demo_user` cookie with SameSite Lax. The server enforces each selected user's document role, but anyone with access to the demo can select a seeded identity. This is a testable authorization model rather than production sign-in. Replacing the selector with authenticated sessions is the first step before storing private documents.

Share administration always requires the owner's role on the server. View-only updates and attempts to manage another owner's shares return a permission error. The server also checks access when fetching a document, so an unshared document cannot be read just by knowing its URL.

## Scope and next work

The implementation focuses on creating, formatting, saving, reopening, importing and sharing documents. It leaves `.docx` conversion, comments, folder organization and real-time collaboration outside the assessment scope.

The next 2-4 hours should go toward verified identity, more browser coverage for save failures and access revocation, and a clearer conflict recovery flow with a downloadable local draft. Extend import types only after these behaviors are reliable.

## Reference decisions

Tiptap's [Next.js guide](https://tiptap.dev/docs/editor/getting-started/install/nextjs) documents `immediatelyRender: false`. The [StarterKit documentation](https://tiptap.dev/docs/editor/extensions/functionality/starterkit) lists the included formatting extensions. Its [setContent API](https://tiptap.dev/docs/editor/api/commands/content/set-content) documents the `emitUpdate` option used during external document replacement.
