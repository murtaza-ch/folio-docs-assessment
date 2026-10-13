import type { RichTextDocument, RichTextMark, RichTextNode } from "./types";

function escapeText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/([\\`*_{}\[\]()#+.!|~])/g, "\\$1");
}
function fencedCode(text: string, inline: boolean, language = "") {
  const runs = text.match(/`+/g) ?? [];
  const marker = "`".repeat(
    Math.max(inline ? 1 : 3, ...runs.map((run) => run.length + 1)),
  );
  if (!inline)
    return `${marker}${language.replace(/[^a-zA-Z0-9_+-]/g, "")}\n${text}\n${marker}`;
  const pad = /^[` ]|[` ]$/.test(text) ? " " : "";
  return `${marker}${pad}${text}${pad}${marker}`;
}
function wrap(value: string, marker: string) {
  const match = value.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
  return match[2]
    ? `${match[1]}${marker}${match[2]}${marker}${match[3]}`
    : value;
}
function inlineNode(node: RichTextNode): string {
  if (node.type === "hardBreak") return "  \n";
  if (node.type !== "text")
    return (node.content ?? []).map(inlineNode).join("");
  const marks = node.marks ?? [];
  let value = marks.some((mark) => mark.type === "code")
    ? fencedCode(node.text ?? "", true)
    : escapeText(node.text ?? "");
  for (const mark of marks) {
    if (mark.type === "bold") value = wrap(value, "**");
    if (mark.type === "italic") value = wrap(value, "*");
    if (mark.type === "strike") value = wrap(value, "~~");
    if (mark.type === "underline") value = `<u>${value}</u>`;
    if (mark.type === "link") {
      const href = safeLink(mark);
      if (href) value = `[${value}](${href})`;
    }
  }
  return value;
}
function safeLink(mark: RichTextMark) {
  const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : "";
  return /^(https?:\/\/|mailto:)/i.test(href)
    ? href.replace(/[\s()<>\\]/g, (char) =>
        char === "(" ? "%28" : char === ")" ? "%29" : encodeURIComponent(char),
      )
    : "";
}
function rawText(node: RichTextNode): string {
  if (node.type === "hardBreak") return "\n";
  return node.text ?? (node.content ?? []).map(rawText).join("");
}
function block(node: RichTextNode): string {
  const children = node.content ?? [];
  if (node.type === "paragraph") return children.map(inlineNode).join("");
  if (node.type === "heading")
    return `${"#".repeat(Math.max(1, Math.min(6, Number(node.attrs?.level) || 1)))} ${children.map(inlineNode).join("")}`;
  if (node.type === "codeBlock")
    return fencedCode(rawText(node), false, String(node.attrs?.language ?? ""));
  if (node.type === "horizontalRule") return "---";
  if (node.type === "blockquote")
    return children
      .map(block)
      .join("\n\n")
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
  if (node.type === "bulletList" || node.type === "orderedList") {
    const start = Number(node.attrs?.start) || 1;
    return children
      .map((item, index) => {
        const prefix =
          node.type === "orderedList" ? `${start + index}. ` : "- ";
        const body = (item.content ?? []).map(block).join("\n\n");
        return body
          .split("\n")
          .map(
            (line, lineIndex) =>
              `${lineIndex ? " ".repeat(prefix.length) : prefix}${line}`,
          )
          .join("\n");
      })
      .join("\n");
  }
  return children.map(block).join("\n\n");
}

export function documentMarkdown(content: RichTextDocument): string {
  return `${content.content.map(block).join("\n\n")}\n`;
}
export function exportFilename(title: string, extension: "md" | "pdf") {
  const safe = title
    .replace(/[\u0000-\u001f\u007f/\\?<>*:"|]/g, "_")
    .replace(/^\.+|\.+$/g, "")
    .trim();
  return `${Array.from(safe || "document")
    .slice(0, 120)
    .join("")}.${extension}`;
}
export function attachmentHeader(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}
