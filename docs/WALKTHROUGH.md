# Walkthrough recording outline

Live URL: https://folio-docs-assessment.vercel.app

Target length is 3-5 minutes. Record the live application with readable text and keep the browser address visible at the start. Upload the finished recording to Loom or YouTube, then put the shareable URL in `SUBMISSION.md` and `walkthrough-url.txt`.

## 0:00-0:30: Context

Introduce Folio as a document workspace built with Next.js, React, Chakra UI, Tiptap and MongoDB. Explain that demo identities let a reviewer exercise ownership and sharing without account setup. Say explicitly that identity selection is for the assessment and is not verified sign-in.

## 0:30-1:40: Create, format and reopen

Create a document and rename it. Type a short paragraph, apply bold, italic and underline, then add a heading and a list. Point to the save status. Wait for it to show saved, reload, and reopen the document to demonstrate durable formatting.

## 1:40-2:10: Import

Import a small `.md` or `.txt` file. Open the result and show that it can be edited. Mention the supported file types and 1 MiB limit.

## 2:10-3:10: Share across users

Share the document with another seeded user as a viewer. Switch to that user and open it from shared documents. Show that the toolbar is unavailable. Return to the owner, change access to editor, switch users again, and make an edit. Return to the owner and reopen the updated document.

## 3:10-3:45: Reliability and decisions

Explain that documents use JSON content in MongoDB and version checks prevent silent overwrites. The conflict flow passed browser verification. Show an old-tab save and its recovery message if time permits. Explain that this is conflict detection rather than real-time simultaneous editing.

## 3:45-4:30: Scope and AI

Show the README, architecture note and AI workflow note. Explain where AI helped with parallel implementation and which generated choices were corrected. Mention actual verification results from `SUBMISSION.md`. End with what remains and what you would address in the next 2-4 hours.

Only demonstrate flows that have passed verification. If something remains incomplete, name it directly in the recording and submission note.
