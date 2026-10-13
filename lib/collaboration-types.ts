import type { RichTextDocument, User } from "./types";

export interface DocumentComment {
  id: string;
  documentId: string;
  body: string;
  author: User;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  resolvedBy?: User;
}
export interface VersionSummary {
  version: number;
  title: string;
  createdAt: string;
  author: User;
  wordCount: number;
}
export interface VersionSnapshot extends Omit<VersionSummary, "wordCount"> {
  content: RichTextDocument;
}
