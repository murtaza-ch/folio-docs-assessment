# Walkthrough recording outline

Live URL: https://folio-docs-assessment.vercel.app

I will record a 3-5 minute walkthrough with readable text and the browser address visible at the start. I will upload it to Loom or YouTube and add the shareable URL to `SUBMISSION.md` and `walkthrough-url.txt` before submission.

## 0:00-0:30: Sign in and context

Introduce Folio as a Next.js, React, Chakra UI, Tiptap and MongoDB workspace. Sign in as `alice@folio.demo` with the public demo password `FolioDemo!2026`. Ben and Clara use `ben@folio.demo` and `clara@folio.demo` with the same password. Explain that these are shared reviewer accounts with real password/session authentication. New users can sign up for a separate empty workspace.

Opening script: "I built Folio with Next.js, React, Chakra UI and Tiptap. I chose MongoDB Atlas because the editor stores JSON document trees, and I can save content, permissions and version history atomically. I implemented authenticated accounts, document sharing, comments, presence, version restore, and Markdown and PDF exports."

## 0:30-1:20: Create, format and reopen

Create and rename a document. Type a paragraph, apply bold, italic and underline, then add a heading and list. Wait for the saved status. Reload and reopen it to show that rich text persists.

## 1:20-1:45: Import and export

Import a small `.md` file from `examples/` and open the editable result. Mention `.txt`, `.md` and the 1 MiB limit. Download Markdown and PDF. Explain that PDF uses bundled Noto fonts and reports unsupported glyphs instead of losing text; Markdown is the fallback.

## 1:45-2:45: Share and presence

Share with Ben as an editor and Clara as a viewer. Use a separate browser profile signed in as Ben to open the same document. Show the viewing/editing activity indicator and make a saved edit. Explain that activity polls every 3 seconds; this is saved-version synchronization, not simultaneous text merging.

Sign in as Clara in another profile if time permits. Show view-only document access. Alternatively, use a prepared viewer tab. Return to Alice and demonstrate changing or revoking access.

## 2:45-3:35: Comments and history

Open Comments & history. Post a document comment and resolve it. Explain that comments belong to the document rather than a selected text range.

Select History, preview an earlier saved version and restore it. Show the newly incremented version. Mention that history is capped at 50 previous snapshots and a 6,000,000-byte budget, so large documents retain fewer revisions.

## 3:35-4:15: Reliability

Use a prepared old tab to show a stale-save conflict and recovery if time permits. Point out that unsaved drafts are retained and can be saved as a copy. Presence does not merge keystrokes, and restore also protects against a newer concurrent save.

## 4:15-4:45: AI, verification and delivery

Briefly show the README, architecture note and AI workflow. Say: "I used AI assistants for implementation and review, and I own the architecture and final result. I checked the generated work with TypeScript, automated tests, builds, HTTP flows and browser review. I addressed save races, bounded history, editor resets and PDF character handling during that process." Report only final checks recorded in `SUBMISSION.md`.

End with the remaining limits, including account recovery, full live text merging and `.docx` import. The recording URL and Drive folder are submission delivery steps.

Only demonstrate flows that have passed verification. Prepare the accounts and browser profiles beforehand so the recording stays within five minutes.
