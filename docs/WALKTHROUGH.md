# Walkthrough plan

I will record a 3-5 minute demo of the [live app](https://folio-docs-assessment.vercel.app). The recording is pending.

## Opening

"I built Folio with Next.js, Chakra UI and Tiptap. I chose MongoDB Atlas for JSON documents and atomic saves with permissions and version history."

## Demo sequence

| Time      | Show                                                        |
| --------- | ----------------------------------------------------------- |
| 0:00-0:30 | Sign in as Alice and introduce the stack                    |
| 0:30-1:20 | Create, format, save, reload and reopen a document          |
| 1:20-1:45 | Import Markdown and export Markdown/PDF                     |
| 1:45-2:45 | Share with Ben as editor and Clara as viewer; show presence |
| 2:45-3:35 | Add a comment, preview history and restore a version        |
| 3:35-4:15 | Show a prepared stale-save conflict and draft recovery      |
| 4:15-4:45 | Explain AI assistance, engineering checks and limits        |

Prepare separate signed-in browser profiles. All demo accounts use `FolioDemo!2026`; sample import files are in `examples/`.

I will explain that presence uses polling, comments attach to documents and history is bounded. I will report only the checks in [SUBMISSION.md](../SUBMISSION.md).

After recording, add its reviewer-accessible URL to `walkthrough-url.txt` and the report, then upload the source package and video link to the submission folder.
