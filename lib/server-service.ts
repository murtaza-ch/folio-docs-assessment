import type {
  Document,
  DocumentShare,
  DocumentSummary,
  RichTextDocument,
  ShareRole,
  User,
} from "./types";
import { EMPTY_DOCUMENT } from "./types";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public document?: Document,
  ) {
    super(message);
  }
}
export interface DocumentRepository {
  listUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | null>;
  listDocuments(userId: string): Promise<DocumentSummary[]>;
  getDocument(id: string, userId: string): Promise<Document | null>;
  createDocument(
    userId: string,
    title: string,
    content: RichTextDocument,
  ): Promise<Document>;
  updateDocument(
    id: string,
    userId: string,
    version: number,
    title?: string,
    content?: RichTextDocument,
  ): Promise<Document | null>;
  listShares(id: string): Promise<DocumentShare[]>;
  upsertShare(
    id: string,
    ownerId: string,
    userId: string,
    role: ShareRole,
  ): Promise<DocumentShare | null>;
  removeShare(id: string, ownerId: string, userId: string): Promise<boolean>;
}
export function documentService(repo: DocumentRepository) {
  async function requireDocument(id: string, userId: string) {
    const doc = await repo.getDocument(id, userId);
    if (!doc)
      throw new AppError(
        404,
        "NOT_FOUND",
        "Document not found or access was removed.",
      );
    return doc;
  }
  async function requireOwner(id: string, userId: string) {
    const doc = await requireDocument(id, userId);
    if (doc.role !== "owner")
      throw new AppError(403, "FORBIDDEN", "Only the owner can manage access.");
    return doc;
  }
  return {
    getDocument: requireDocument,
    listDocuments: (userId: string) => repo.listDocuments(userId),
    createDocument: (
      userId: string,
      value: { title?: string; content?: RichTextDocument },
    ) =>
      repo.createDocument(
        userId,
        value.title ?? "Untitled document",
        value.content ?? EMPTY_DOCUMENT,
      ),
    async updateDocument(
      id: string,
      userId: string,
      value: { version: number; title?: string; content?: RichTextDocument },
    ) {
      const doc = await requireDocument(id, userId);
      if (doc.role === "viewer")
        throw new AppError(
          403,
          "FORBIDDEN",
          "You have view-only access to this document.",
        );
      if (doc.version !== value.version)
        throw new AppError(
          409,
          "VERSION_CONFLICT",
          "This document changed. Load the latest version before saving.",
          doc,
        );
      const saved = await repo.updateDocument(
        id,
        userId,
        value.version,
        value.title,
        value.content,
      );
      if (saved) return saved;
      const current = await requireDocument(id, userId);
      if (current.role === "viewer")
        throw new AppError(
          403,
          "FORBIDDEN",
          "Your editing access was removed.",
        );
      throw new AppError(
        409,
        "VERSION_CONFLICT",
        "Someone saved a newer version. Your changes have not been overwritten.",
        current,
      );
    },
    async shares(id: string, userId: string) {
      await requireDocument(id, userId);
      return {
        shares: await repo.listShares(id),
        users: await repo.listUsers(),
      };
    },
    async share(
      id: string,
      ownerId: string,
      value: { userId: string; role: ShareRole },
    ) {
      const doc = await requireOwner(id, ownerId);
      if (value.userId === doc.ownerId)
        throw new AppError(
          400,
          "OWNER_SHARE",
          "The owner already has full access.",
        );
      if (!(await repo.getUser(value.userId)))
        throw new AppError(404, "USER_NOT_FOUND", "User not found.");
      const share = await repo.upsertShare(
        id,
        ownerId,
        value.userId,
        value.role,
      );
      if (!share)
        throw new AppError(
          403,
          "FORBIDDEN",
          "Only the owner can manage access.",
        );
      return share;
    },
    async revoke(id: string, ownerId: string, userId: string) {
      await requireOwner(id, ownerId);
      if (!(await repo.removeShare(id, ownerId, userId)))
        throw new AppError(
          404,
          "SHARE_NOT_FOUND",
          "This user no longer has shared access.",
        );
    },
  };
}
