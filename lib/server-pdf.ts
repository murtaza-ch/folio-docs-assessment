import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { RichTextDocument, RichTextNode } from "./types";
import { AppError } from "./server-service";

type Run = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  link?: boolean;
};
const fontNames = ["Regular", "Bold", "Italic", "BoldItalic"] as const;
let fontBytes: Promise<Buffer[]> | undefined;
function fonts() {
  fontBytes ??= Promise.all(
    fontNames.map((style) =>
      readFile(
        path.join(process.cwd(), "app", "fonts", `NotoSans-${style}.ttf`),
      ),
    ),
  );
  return fontBytes;
}
function runs(node: RichTextNode, bold = false): Run[] {
  if (node.type === "hardBreak") return [{ text: "\n" }];
  if (node.type === "text")
    return [
      {
        text: node.text ?? "",
        bold: bold || node.marks?.some((mark) => mark.type === "bold"),
        italic: node.marks?.some((mark) => mark.type === "italic"),
        underline: node.marks?.some((mark) => mark.type === "underline"),
        strike: node.marks?.some((mark) => mark.type === "strike"),
        link: node.marks?.some((mark) => mark.type === "link"),
      },
    ];
  return (node.content ?? []).flatMap((child) => runs(child, bold));
}

export async function documentPdf(
  title: string,
  content: RichTextDocument,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const embedded = await Promise.all(
    (await fonts()).map((bytes) => pdf.embedFont(bytes, { subset: true })),
  );
  const face = (run: Run) =>
    embedded[run.bold ? (run.italic ? 3 : 1) : run.italic ? 2 : 0];
  const supported = new Set(embedded[0].getCharacterSet());
  const unsupported = Array.from(
    new Set(
      Array.from(
        `${title}${runs(content)
          .map((run) => run.text)
          .join("")}`,
      ).filter(
        (char) =>
          !/[\n\r\t]/.test(char) && !supported.has(char.codePointAt(0)!),
      ),
    ),
  );
  if (unsupported.length)
    throw new AppError(
      422,
      "PDF_UNSUPPORTED_CHARACTERS",
      `PDF export cannot render these characters with the bundled font: ${unsupported.slice(0, 8).join(" ")}. Export Markdown to preserve the full text.`,
    );
  pdf.setTitle(title);
  pdf.setCreator("Folio");
  pdf.setProducer("Folio / pdf-lib");
  const width = 595.28,
    height = 841.89,
    margin = 56,
    bottom = 60;
  const ink = rgb(0.14, 0.19, 0.28),
    muted = rgb(0.48, 0.51, 0.57);
  let page: PDFPage;
  let y = height - margin - 25;
  function newPage() {
    if (pdf.getPageCount() >= 200)
      throw new AppError(
        413,
        "PDF_TOO_LARGE",
        "This document exceeds the 200-page PDF export limit. Export Markdown instead.",
      );
    page = pdf.addPage([width, height]);
    y = height - margin - 25;
    page.drawText("FOLIO / DOCUMENT", {
      x: margin,
      y: height - 35,
      size: 8,
      font: embedded[1],
      color: muted,
    });
  }
  newPage();
  function ensure(lineHeight: number) {
    if (y - lineHeight < bottom) newPage();
  }
  function paragraph(
    input: Run[],
    size: number,
    indent = 0,
    options: { prefix?: string; quote?: boolean; code?: boolean } = {},
  ) {
    const lineHeight = size * 1.55;
    const start = margin + indent;
    const available = width - margin - start;
    let line: { run: Run; text: string; font: PDFFont; width: number }[] = [];
    let lineWidth = 0;
    let first = true;
    function flush() {
      ensure(lineHeight);
      if (options.code)
        page.drawRectangle({
          x: start - 7,
          y: y - 5,
          width: available + 14,
          height: lineHeight,
          color: rgb(0.96, 0.97, 0.98),
        });
      if (options.quote)
        page.drawLine({
          start: { x: start - 12, y: y - 5 },
          end: { x: start - 12, y: y + size + 2 },
          thickness: 2,
          color: rgb(0.77, 0.81, 0.89),
        });
      if (first && options.prefix)
        page.drawText(options.prefix, {
          x: start - 19,
          y,
          size,
          font: embedded[0],
          color: ink,
        });
      let x = start;
      for (const fragment of line) {
        page.drawText(fragment.text, {
          x,
          y,
          size,
          font: fragment.font,
          color: fragment.run.link ? rgb(0.23, 0.36, 0.7) : ink,
        });
        if (fragment.run.underline || fragment.run.link)
          page.drawLine({
            start: { x, y: y - 2 },
            end: { x: x + fragment.width, y: y - 2 },
            thickness: 0.65,
            color: ink,
          });
        if (fragment.run.strike)
          page.drawLine({
            start: { x, y: y + size * 0.3 },
            end: { x: x + fragment.width, y: y + size * 0.3 },
            thickness: 0.65,
            color: ink,
          });
        x += fragment.width;
      }
      y -= lineHeight;
      first = false;
      line = [];
      lineWidth = 0;
    }
    function append(text: string, run: Run, font: PDFFont) {
      const measured = font.widthOfTextAtSize(text, size);
      if (!line.length && /^\s+$/.test(text) && !options.code) return;
      if (lineWidth + measured > available && line.length) flush();
      if (measured <= available) {
        if (!line.length && /^\s+$/.test(text) && !options.code) return;
        line.push({ text, run, font, width: measured });
        lineWidth += measured;
        return;
      }
      // Break long unspaced text by Unicode code point, never by UTF-16 unit.
      let chunk = "",
        chunkWidth = 0;
      for (const char of Array.from(text)) {
        const charWidth = font.widthOfTextAtSize(char, size);
        if (chunk && chunkWidth + charWidth > available) {
          append(chunk, run, font);
          flush();
          chunk = "";
          chunkWidth = 0;
        }
        chunk += char;
        chunkWidth += charWidth;
      }
      if (chunk) append(chunk, run, font);
    }
    for (const run of input) {
      const font = face(run);
      const normalized = run.text
        .replace(/\r\n?/g, "\n")
        .replace(/\t/g, "    ");
      for (const token of normalized.match(/\n|[^\S\n]+|[^\s]+/gu) ?? []) {
        if (token === "\n") flush();
        else append(token, run, font);
      }
    }
    if (line.length || first) flush();
  }
  paragraph([{ text: title, bold: true }], 25);
  y -= 12;
  function render(
    node: RichTextNode,
    indent = 0,
    quote = false,
    prefix?: string,
  ) {
    indent = Math.min(indent, 200);
    if (node.type === "heading") {
      const level = Math.max(1, Math.min(6, Number(node.attrs?.level) || 1));
      y -= 8;
      ensure(65);
      paragraph(runs(node, true), [21, 17, 14, 12, 11, 11][level - 1], indent, {
        quote,
      });
      y -= 5;
    } else if (node.type === "paragraph") {
      paragraph(runs(node), 10.5, indent, { quote, prefix });
      y -= 6;
    } else if (node.type === "codeBlock") {
      paragraph(runs(node), 9.5, indent, { quote, code: true });
      y -= 9;
    } else if (node.type === "blockquote") {
      for (const child of node.content ?? []) render(child, indent + 19, true);
      y -= 3;
    } else if (node.type === "bulletList" || node.type === "orderedList") {
      (node.content ?? []).forEach((item, index) => {
        const marker =
          node.type === "bulletList"
            ? "•"
            : `${(Number(node.attrs?.start) || 1) + index}.`;
        (item.content ?? []).forEach((child, childIndex) =>
          render(
            child,
            indent + 22,
            quote,
            childIndex === 0 ? marker : undefined,
          ),
        );
      });
      y -= 3;
    } else if (node.type === "horizontalRule") {
      ensure(18);
      page.drawLine({
        start: { x: margin + indent, y },
        end: { x: width - margin, y },
        thickness: 0.8,
        color: rgb(0.83, 0.86, 0.9),
      });
      y -= 18;
    } else {
      for (const child of node.content ?? []) render(child, indent, quote);
    }
  }
  for (const node of content.content) render(node);
  pdf.getPages().forEach((sheet, index) => {
    sheet.drawLine({
      start: { x: margin, y: 45 },
      end: { x: width - margin, y: 45 },
      thickness: 0.5,
      color: rgb(0.88, 0.89, 0.92),
    });
    sheet.drawText(`${index + 1} / ${pdf.getPageCount()}`, {
      x: width - margin - 38,
      y: 30,
      size: 8,
      font: embedded[0],
      color: muted,
    });
  });
  return pdf.save();
}
