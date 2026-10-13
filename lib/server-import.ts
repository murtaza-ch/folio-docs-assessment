import type { RichTextDocument, RichTextNode } from "./types";
import { AppError } from "./server-service";
import { MAX_FILE_BYTES, richTextSchema } from "./validation";

// This deliberately parses a small Markdown subset. Raw HTML remains text.
// It never renders uploaded HTML or fetches links from imported documents.
export function inlineMarkdown(text: string): RichTextNode[] {
  const nodes: RichTextNode[] = [];
  const pattern =
    /(`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|\*([^*]+)\*|_([^_]+)_|\[([^\]]+)\]\(([^\s)]+)\))/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index! > last)
      nodes.push({ type: "text", text: text.slice(last, match.index) });
    const [
      whole,
      ,
      code,
      bold,
      boldAlt,
      strike,
      italic,
      italicAlt,
      label,
      href,
    ] = match;
    if (label && href) {
      nodes.push(
        /^(https?:\/\/|mailto:)/i.test(href)
          ? {
              type: "text",
              text: label,
              marks: [
                {
                  type: "link",
                  attrs: {
                    href,
                    target: "_blank",
                    rel: "noopener noreferrer nofollow",
                  },
                },
              ],
            }
          : { type: "text", text: whole },
      );
    } else {
      const value = code ?? bold ?? boldAlt ?? strike ?? italic ?? italicAlt;
      nodes.push({
        type: "text",
        text: value,
        marks: [
          {
            type: code
              ? "code"
              : bold || boldAlt
                ? "bold"
                : strike
                  ? "strike"
                  : "italic",
          },
        ],
      });
    }
    last = match.index! + whole.length;
  }
  if (last < text.length) nodes.push({ type: "text", text: text.slice(last) });
  return nodes;
}
export function markdownDocument(text: string): RichTextDocument {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const content: RichTextNode[] = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = line.match(/^\s*(```|~~~)([\w+-]*)\s*$/);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1]))
        code.push(lines[i++]);
      if (i < lines.length) i++;
      content.push({
        type: "codeBlock",
        attrs: { language: fence[2] || null },
        ...(code.join("\n")
          ? { content: [{ type: "text", text: code.join("\n") }] }
          : {}),
      });
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/);
    if (heading) {
      content.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: inlineMarkdown(heading[2]),
      });
      i++;
      continue;
    }
    if (/^\s{0,3}(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      content.push({ type: "horizontalRule" });
      i++;
      continue;
    }
    if (/^\s*>/.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i]))
        quoted.push(lines[i++].replace(/^\s*>\s?/, ""));
      // Treat quoted Markdown as inline paragraphs, keeping deeply nested quotes bounded.
      content.push({
        type: "blockquote",
        content: quoted.map((text) => ({
          type: "paragraph",
          ...(text ? { content: inlineMarkdown(text) } : {}),
        })),
      });
      continue;
    }
    const list = line.match(/^\s{0,3}([-+*]|\d+[.)])\s+(.+)$/);
    if (list) {
      const ordered = /^\d/.test(list[1]);
      const items: RichTextNode[] = [];
      while (i < lines.length) {
        const next = lines[i].match(/^\s{0,3}([-+*]|\d+[.)])\s+(.+)$/);
        if (!next || /^\d/.test(next[1]) !== ordered) break;
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: inlineMarkdown(next[2]) }],
        });
        i++;
      }
      content.push({
        type: ordered ? "orderedList" : "bulletList",
        ...(ordered ? { attrs: { start: Number.parseInt(list[1], 10) } } : {}),
        content: items,
      });
      continue;
    }
    const paragraph: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(?:\s{0,3}(?:#{1,6}\s|>|[-+*]\s|\d+[.)]\s|```|~~~|---+\s*$|\*\*\*+\s*$|___+\s*$))/.test(
        lines[i],
      )
    )
      paragraph.push(lines[i++]);
    content.push({
      type: "paragraph",
      content: inlineMarkdown(paragraph.join("\n")),
    });
  }
  return {
    type: "doc",
    content: content.length ? content : [{ type: "paragraph" }],
  };
}
export function textDocument(text: string): RichTextDocument {
  return {
    type: "doc",
    content: text
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => ({
        type: "paragraph",
        ...(line ? { content: [{ type: "text", text: line }] } : {}),
      })),
  };
}
export async function importFile(file: File) {
  if (!/\.(txt|md)$/i.test(file.name))
    throw new AppError(400, "UNSUPPORTED_FILE", "Choose a .txt or .md file.");
  if (file.size > MAX_FILE_BYTES)
    throw new AppError(413, "FILE_TOO_LARGE", "Files must be 1 MB or smaller.");
  if (!file.size) throw new AppError(400, "EMPTY_FILE", "This file is empty.");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(
      await file.arrayBuffer(),
    );
  } catch {
    throw new AppError(400, "INVALID_ENCODING", "Choose a UTF-8 text file.");
  }
  if (text.includes("\0"))
    throw new AppError(400, "INVALID_FILE", "This file contains binary data.");
  const title =
    file.name
      .replace(/\.(txt|md)$/i, "")
      .trim()
      .slice(0, 160) || "Imported document";
  const content = richTextSchema.parse(
    /\.md$/i.test(file.name) ? markdownDocument(text) : textDocument(text),
  );
  return { title, content };
}
