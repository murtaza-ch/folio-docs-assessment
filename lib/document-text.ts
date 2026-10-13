/** Inline marks do not introduce spaces; block boundaries do. */
export function documentText(node: {
  type?: string;
  text?: string;
  content?: Parameters<typeof documentText>[0][];
}): string {
  if (node.text !== undefined) return node.text;
  if (node.type === "hardBreak") return " ";
  const separator = ["paragraph", "heading", "codeBlock"].includes(
    node.type ?? "",
  )
    ? ""
    : " ";
  return (node.content ?? []).map(documentText).join(separator);
}
export function documentWordCount(
  content: Parameters<typeof documentText>[0],
): number {
  return (
    documentText(content).match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)
      ?.length ?? 0
  );
}
