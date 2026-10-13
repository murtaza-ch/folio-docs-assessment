export type Role = "owner" | "editor" | "viewer";
export type ShareRole = Exclude<Role, "owner">;
export interface User {
  id: string;
  name: string;
  email: string;
  color: string;
  initials: string;
}
export interface RichTextMark {
  type: string;
  attrs?: Record<string, unknown>;
}
export interface RichTextNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
  text?: string;
  marks?: RichTextMark[];
}
export interface RichTextDocument extends RichTextNode {
  type: "doc";
  content: RichTextNode[];
}
export interface DocumentSummary {
  id: string;
  title: string;
  ownerId: string;
  owner: User;
  role: Role;
  createdAt: string;
  updatedAt: string;
  version: number;
  excerpt: string;
  wordCount: number;
  shareCount: number;
}
export interface Document extends DocumentSummary {
  content: RichTextDocument;
}
export interface DocumentShare {
  userId: string;
  role: ShareRole;
  user: User;
  createdAt: string;
}
export interface ApiError {
  error: string;
  code: string;
  document?: Document;
}
export const EMPTY_DOCUMENT: RichTextDocument = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
