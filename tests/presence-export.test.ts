import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { aggregatePresence, type PresenceRow } from "../lib/server-presence";
import {
  attachmentHeader,
  documentMarkdown,
  exportFilename,
} from "../lib/document-export";
import { documentPdf } from "../lib/server-pdf";
import type { RichTextDocument, User } from "../lib/types";

const user: User = {
  id: "alice",
  name: "Alice",
  email: "alice@example.com",
  color: "#fff",
  initials: "AM",
};
const now = new Date("2026-10-13T10:00:00Z");
function presence(
  tabId: string,
  status: "viewing" | "editing",
  offset: number,
): PresenceRow {
  return {
    documentId: "doc",
    userId: user.id,
    tabId,
    status,
    lastSeen: new Date(now.getTime() + offset - 20_000),
    expiresAt: new Date(now.getTime() + offset),
  };
}

describe("presence across multiple tabs", () => {
  it("expires disconnected tabs even before the MongoDB TTL cleanup runs", () => {
    expect(
      aggregatePresence(
        [presence("old", "editing", -1), presence("boundary", "editing", 0)],
        [user],
        now,
      ),
    ).toEqual([]);
  });
  it("shows one user, prioritizes active editing and keeps the latest timestamp", () => {
    const result = aggregatePresence(
      [
        presence("writer", "editing", 10_000),
        presence("reader", "viewing", 15_000),
      ],
      [user],
      now,
    );
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("editing");
    expect(result[0].lastSeen).toBe(
      new Date(now.getTime() - 5000).toISOString(),
    );
  });
  it("does not expose a participant whose account was removed", () => {
    expect(
      aggregatePresence([presence("writer", "editing", 1000)], [], now),
    ).toEqual([]);
  });
});

describe("document export", () => {
  it("preserves inline styles, nested lists, quotes and code fences", () => {
    const content: RichTextDocument = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Notes" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "strong",
              marks: [{ type: "bold" }, { type: "italic" }],
            },
            {
              type: "text",
              text: " underlined",
              marks: [{ type: "underline" }],
            },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Parent" }],
                },
                {
                  type: "orderedList",
                  attrs: { start: 3 },
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Child" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "blockquote",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Quote" }] },
          ],
        },
        {
          type: "codeBlock",
          attrs: { language: "js" },
          content: [{ type: "text", text: "const fence = '```';" }],
        },
      ],
    };
    const markdown = documentMarkdown(content);
    expect(markdown).toContain("## Notes");
    expect(markdown).toContain("***strong***");
    expect(markdown).toContain("<u> underlined</u>");
    expect(markdown).toContain("- Parent\n  \n  3. Child");
    expect(markdown).toContain("> Quote");
    expect(markdown).toContain("````js\nconst fence = '```';\n````");
  });
  it("escapes literal HTML and Markdown syntax rather than making executable export markup", () => {
    expect(
      documentMarkdown({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "<script>alert(1)</script> **literal**" },
            ],
          },
        ],
      }),
    ).toBe("&lt;script&gt;alert\\(1\\)&lt;/script&gt; \\*\\*literal\\*\\*\n");
  });
  it("encodes link destinations and drops unsafe schemes", () => {
    const content: RichTextDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "safe",
              marks: [
                { type: "link", attrs: { href: "https://example.com/a(b)" } },
              ],
            },
            {
              type: "text",
              text: "unsafe",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    };
    expect(documentMarkdown(content)).toBe(
      "[safe](https://example.com/a%28b%29)unsafe\n",
    );
  });
  it("prevents filename header injection and preserves UTF-8 filenames", () => {
    const filename = exportFilename("résumé\r\n../file", "pdf");
    const header = attachmentHeader(filename);
    expect(header).not.toMatch(/[\r\n]/);
    expect(header).toContain("filename*=UTF-8''r%C3%A9sum%C3%A9");
    expect(filename).not.toContain("/");
  });
  it("generates a real multipage PDF with Unicode text and rich formatting", async () => {
    const content: RichTextDocument = {
      type: "doc",
      content: Array.from({ length: 100 }, (_, index) => ({
        type: "paragraph",
        content: [
          {
            type: "text",
            text: `Résumé ${index}. Ελληνικά and Cyrillic Привет. A line of text that will wrap with useful readable spacing.`,
            marks: [{ type: "bold" }, { type: "underline" }],
          },
        ],
      })),
    };
    const bytes = await documentPdf("Export review", content);
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toMatch(/^%PDF-/);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(2);
    expect(pdf.getTitle()).toBe("Export review");
  }, 20_000);
  it("returns an explicit limitation instead of silently losing unsupported glyphs", async () => {
    await expect(
      documentPdf("Emoji", {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "🚀" }] },
        ],
      }),
    ).rejects.toMatchObject({
      code: "PDF_UNSUPPORTED_CHARACTERS",
      status: 422,
    });
  });
});
