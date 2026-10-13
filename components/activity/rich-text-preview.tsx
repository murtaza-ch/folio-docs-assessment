import { createElement, type ReactNode } from "react";
import type { RichTextDocument, RichTextNode } from "@/lib/types";

const BLOCK_TAGS: Record<string, string> = {
  paragraph: "p",
  bulletList: "ul",
  orderedList: "ol",
  listItem: "li",
  blockquote: "blockquote",
  codeBlock: "pre",
};

/** Read-only rendering of a stored TipTap document. */
export function RichTextPreview({ content }: { content: RichTextDocument }) {
  return (
    <div className="rich-text-preview">
      {content.content.map((node, index) => renderNode(node, String(index)))}
    </div>
  );
}

function renderNode(node: RichTextNode, key: string): ReactNode {
  if (node.type === "text") return renderText(node, key);
  if (node.type === "hardBreak") return <br key={key} />;
  if (node.type === "horizontalRule") return <hr key={key} />;
  const tag =
    BLOCK_TAGS[node.type] ||
    (node.type === "heading"
      ? `h${Math.min(6, Math.max(1, Number(node.attrs?.level) || 1))}`
      : "div");
  return createElement(
    tag,
    {
      key,
      ...(node.type === "orderedList" && Number.isSafeInteger(node.attrs?.start)
        ? { start: Number(node.attrs?.start) }
        : {}),
    },
    (node.content || []).map((child, index) =>
      renderNode(child, `${key}-${index}`),
    ),
  );
}

function renderText(node: RichTextNode, key: string): ReactNode {
  let text: ReactNode = node.text;
  for (const [index, mark] of (node.marks || []).entries()) {
    const markKey = `${key}-${index}`;
    if (mark.type === "bold") text = <strong key={markKey}>{text}</strong>;
    if (mark.type === "italic") text = <em key={markKey}>{text}</em>;
    if (mark.type === "underline") text = <u key={markKey}>{text}</u>;
    if (mark.type === "strike") text = <s key={markKey}>{text}</s>;
    if (mark.type === "code") text = <code key={markKey}>{text}</code>;
    // Only safe protocols become links; anything else stays plain text.
    if (
      mark.type === "link" &&
      typeof mark.attrs?.href === "string" &&
      /^(https?:\/\/|mailto:)/i.test(mark.attrs.href)
    )
      text = (
        <a
          key={markKey}
          href={mark.attrs.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {text}
        </a>
      );
  }
  return <span key={key}>{text}</span>;
}
