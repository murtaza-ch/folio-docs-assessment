import { z } from "zod";
import type { RichTextDocument, RichTextNode } from "./types";

export const MAX_FILE_BYTES = 1_048_576;
export const idSchema = z.uuid();
export const titleSchema = z.string().trim().min(1).max(160);
const inline = new Set(["text", "hardBreak"]);
const blocks = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "blockquote",
  "codeBlock",
  "horizontalRule",
]);
const allTypes = new Set(["doc", ...blocks, ...inline, "listItem"]);
const markTypes = new Set([
  "bold",
  "italic",
  "strike",
  "underline",
  "code",
  "link",
]);

export function validRichText(input: unknown): input is RichTextDocument {
  let count = 0;
  let bytes = 0;
  const walk = (value: unknown, depth: number): boolean => {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      depth > 30 ||
      ++count > 20000
    )
      return false;
    const node = value as RichTextNode;
    if (
      !allTypes.has(node.type) ||
      Object.keys(node).some(
        (key) => !["type", "attrs", "content", "text", "marks"].includes(key),
      )
    )
      return false;
    if (node.type === "doc" && depth !== 0) return false;
    if (node.attrs !== undefined) {
      if (
        !node.attrs ||
        typeof node.attrs !== "object" ||
        Array.isArray(node.attrs)
      )
        return false;
      const keys = Object.keys(node.attrs);
      if (node.type === "heading") {
        if (
          keys.some((k) => k !== "level") ||
          ![1, 2, 3, 4, 5, 6].includes(node.attrs.level as number)
        )
          return false;
      } else if (node.type === "orderedList") {
        if (keys.some((k) => !["start", "type"].includes(k))) return false;
        if (
          node.attrs.start !== undefined &&
          (!Number.isSafeInteger(node.attrs.start) ||
            Number(node.attrs.start) < 1)
        )
          return false;
        if (
          node.attrs.type !== undefined &&
          node.attrs.type !== null &&
          typeof node.attrs.type !== "string"
        )
          return false;
      } else if (node.type === "codeBlock") {
        if (
          keys.some((k) => k !== "language") ||
          (node.attrs.language !== null &&
            node.attrs.language !== undefined &&
            (typeof node.attrs.language !== "string" ||
              node.attrs.language.length > 40))
        )
          return false;
      } else if (keys.length) return false;
    }
    if (node.type === "heading" && !node.attrs?.level) return false;
    if (node.type === "text") {
      if (
        typeof node.text !== "string" ||
        !node.text.length ||
        node.content ||
        node.attrs
      )
        return false;
      bytes += Buffer.byteLength(node.text, "utf8");
      if (bytes > MAX_FILE_BYTES) return false;
      if (node.marks !== undefined) {
        if (!Array.isArray(node.marks) || node.marks.length > 7) return false;
        for (const mark of node.marks) {
          if (
            !mark ||
            typeof mark !== "object" ||
            !markTypes.has(mark.type) ||
            Object.keys(mark).some((k) => !["type", "attrs"].includes(k))
          )
            return false;
          if (
            mark.attrs !== undefined &&
            (!mark.attrs ||
              typeof mark.attrs !== "object" ||
              Array.isArray(mark.attrs))
          )
            return false;
          if (mark.type === "link") {
            const attrs = mark.attrs;
            if (
              !attrs ||
              typeof attrs.href !== "string" ||
              attrs.href.length > 2048 ||
              !/^(https?:\/\/|mailto:)/i.test(attrs.href)
            )
              return false;
            if (
              Object.keys(attrs).some(
                (k) => !["href", "target", "rel", "class", "title"].includes(k),
              )
            )
              return false;
            if (
              Object.values(attrs).some(
                (v) => v !== null && typeof v !== "string",
              )
            )
              return false;
          } else if (mark.attrs && Object.keys(mark.attrs).length) return false;
        }
      }
      return true;
    }
    if (node.text !== undefined || node.marks !== undefined) return false;
    if (["hardBreak", "horizontalRule"].includes(node.type))
      return node.content === undefined;
    if (node.content !== undefined && !Array.isArray(node.content))
      return false;
    const children = node.content ?? [];
    if (
      children.some(
        (n) =>
          !n ||
          typeof n !== "object" ||
          Array.isArray(n) ||
          typeof n.type !== "string",
      )
    )
      return false;
    if (
      ["doc", "listItem", "blockquote", "bulletList", "orderedList"].includes(
        node.type,
      ) &&
      !children.length
    )
      return false;
    if (node.type === "doc" || node.type === "blockquote") {
      if (children.some((n) => !blocks.has(n.type))) return false;
    } else if (node.type === "listItem") {
      if (
        children[0]?.type !== "paragraph" ||
        children.some((n) => !blocks.has(n.type))
      )
        return false;
    } else if (["bulletList", "orderedList"].includes(node.type)) {
      if (children.some((n) => n.type !== "listItem")) return false;
    } else if (node.type === "codeBlock") {
      if (children.some((n) => n.type !== "text" || n.marks?.length))
        return false;
    } else if (children.some((n) => !inline.has(n.type))) return false;
    return children.every((n) => walk(n, depth + 1));
  };
  return (input as RichTextNode)?.type === "doc" && walk(input, 0);
}

export const richTextSchema = z.custom<RichTextDocument>(
  validRichText,
  "Invalid document content",
);
export const createDocumentSchema = z
  .object({ title: titleSchema.optional(), content: richTextSchema.optional() })
  .strict();
export const updateDocumentSchema = z
  .object({
    title: titleSchema.optional(),
    content: richTextSchema.optional(),
    version: z.number().int().positive(),
  })
  .strict()
  .refine(
    (value) => value.title !== undefined || value.content !== undefined,
    "Supply a title or content",
  );
export const sessionSchema = z.object({ userId: idSchema }).strict();
export const shareSchema = z
  .object({ userId: idSchema, role: z.enum(["editor", "viewer"]) })
  .strict();
