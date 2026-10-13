import { randomUUID } from "node:crypto";
import { database, repository } from "./server-db";
import { AppError, documentService } from "./server-service";
import { documentWordCount } from "./document-text";
import type { Document, RichTextDocument, User } from "./types";
import type {
  DocumentComment,
  VersionSnapshot,
  VersionSummary,
} from "./collaboration-types";

export interface StoredVersionSnapshot {
  version: number;
  title: string;
  content: RichTextDocument;
  createdAt: Date | string;
  authorId: string;
}
export interface StoredComment {
  _id: string;
  documentId: string;
  body: string;
  authorId: string;
  createdAt: Date;
  updatedAt?: Date;
  resolvedAt?: Date | null;
  resolvedById?: string | null;
  deletedAt?: Date;
}
export interface CollaborationRepository {
  listComments(documentId: string): Promise<StoredComment[]>;
  getComment(documentId: string, id: string): Promise<StoredComment | null>;
  createComment(comment: StoredComment): Promise<StoredComment>;
  updateComment(
    documentId: string,
    id: string,
    fields: Partial<StoredComment>,
  ): Promise<StoredComment | null>;
  readHistory(
    documentId: string,
  ): Promise<{
    history: StoredVersionSnapshot[];
    updatedById?: string;
    current?: StoredVersionSnapshot;
  }>;
}
type DocumentAccess = Pick<
  ReturnType<typeof documentService>,
  "getDocument" | "updateDocument"
>;
const iso = (date: Date | string) =>
  typeof date === "string" ? date : date.toISOString();

export function collaborationService(
  repo: CollaborationRepository,
  docs: DocumentAccess,
  getUser: (id: string) => Promise<User | null>,
) {
  async function author(id: string) {
    const user = await getUser(id);
    if (!user)
      throw new AppError(
        503,
        "AUTHOR_NOT_FOUND",
        "This account is unavailable. Please try again.",
      );
    return user;
  }
  async function publicComment(row: StoredComment): Promise<DocumentComment> {
    return {
      id: row._id,
      documentId: row.documentId,
      body: row.body,
      author: await author(row.authorId),
      createdAt: iso(row.createdAt),
      ...(row.updatedAt ? { updatedAt: iso(row.updatedAt) } : {}),
      ...(row.resolvedAt
        ? {
            resolvedAt: iso(row.resolvedAt),
            ...(row.resolvedById
              ? { resolvedBy: await author(row.resolvedById) }
              : {}),
          }
        : {}),
    };
  }
  async function requireComment(documentId: string, id: string) {
    const comment = await repo.getComment(documentId, id);
    if (!comment || comment.deletedAt)
      throw new AppError(404, "COMMENT_NOT_FOUND", "Comment not found.");
    return comment;
  }
  async function snapshots(doc: Document) {
    const stored = await repo.readHistory(doc.id);
    const current: StoredVersionSnapshot = stored.current ?? {
      version: doc.version,
      title: doc.title,
      content: doc.content,
      createdAt: doc.updatedAt,
      authorId: stored.updatedById ?? doc.ownerId,
    };
    return [
      ...stored.history
        .slice(-50)
        .filter((entry) => entry.version !== current.version),
      current,
    ].sort((a, b) => b.version - a.version);
  }
  async function publicSnapshot(
    row: StoredVersionSnapshot,
  ): Promise<VersionSnapshot> {
    return {
      version: row.version,
      title: row.title,
      content: row.content,
      createdAt: iso(row.createdAt),
      author: await author(row.authorId),
    };
  }
  return {
    async comments(documentId: string, userId: string) {
      await docs.getDocument(documentId, userId);
      return Promise.all(
        (await repo.listComments(documentId))
          .filter((row) => !row.deletedAt)
          .map(publicComment),
      );
    },
    async comment(documentId: string, userId: string, body: string) {
      await docs.getDocument(documentId, userId);
      return publicComment(
        await repo.createComment({
          _id: randomUUID(),
          documentId,
          body,
          authorId: userId,
          createdAt: new Date(),
        }),
      );
    },
    async updateComment(
      documentId: string,
      id: string,
      userId: string,
      value: { body?: string; resolved?: boolean },
    ) {
      const doc = await docs.getDocument(documentId, userId);
      const comment = await requireComment(documentId, id);
      const ownsComment = comment.authorId === userId || doc.role === "owner";
      if (value.body !== undefined && !ownsComment)
        throw new AppError(
          403,
          "FORBIDDEN",
          "Only the author or document owner can edit this comment.",
        );
      if (value.resolved !== undefined && !ownsComment && doc.role !== "editor")
        throw new AppError(
          403,
          "FORBIDDEN",
          "Only the author, an editor, or the owner can resolve comments.",
        );
      const saved = await repo.updateComment(documentId, id, {
        ...(value.body === undefined
          ? {}
          : { body: value.body, updatedAt: new Date() }),
        ...(value.resolved === undefined
          ? {}
          : {
              resolvedAt: value.resolved ? new Date() : null,
              resolvedById: value.resolved ? userId : null,
            }),
      });
      if (!saved)
        throw new AppError(404, "COMMENT_NOT_FOUND", "Comment not found.");
      return publicComment(saved);
    },
    async deleteComment(documentId: string, id: string, userId: string) {
      const doc = await docs.getDocument(documentId, userId);
      const comment = await requireComment(documentId, id);
      if (comment.authorId !== userId && doc.role !== "owner")
        throw new AppError(
          403,
          "FORBIDDEN",
          "Only the author or document owner can delete this comment.",
        );
      if (
        !(await repo.updateComment(documentId, id, { deletedAt: new Date() }))
      )
        throw new AppError(404, "COMMENT_NOT_FOUND", "Comment not found.");
    },
    async versions(
      documentId: string,
      userId: string,
    ): Promise<{ versions: VersionSummary[]; currentVersion: number }> {
      const doc = await docs.getDocument(documentId, userId);
      const versions = await Promise.all(
        (await snapshots(doc)).map(async (row) => {
          const { content, ...summary } = await publicSnapshot(row);
          return { ...summary, wordCount: documentWordCount(content) };
        }),
      );
      return { versions, currentVersion: versions[0]?.version ?? doc.version };
    },
    async version(documentId: string, userId: string, version: number) {
      const doc = await docs.getDocument(documentId, userId);
      const row = (await snapshots(doc)).find(
        (entry) => entry.version === version,
      );
      if (!row)
        throw new AppError(
          404,
          "VERSION_NOT_FOUND",
          "This version is no longer available.",
        );
      return publicSnapshot(row);
    },
    async restore(
      documentId: string,
      userId: string,
      targetVersion: number,
      expectedVersion: number,
    ) {
      const doc = await docs.getDocument(documentId, userId);
      if (doc.role === "viewer")
        throw new AppError(
          403,
          "FORBIDDEN",
          "Viewers cannot restore documents.",
        );
      const row = (await snapshots(doc)).find(
        (entry) => entry.version === targetVersion,
      );
      if (!row)
        throw new AppError(
          404,
          "VERSION_NOT_FOUND",
          "This version is no longer available.",
        );
      return docs.updateDocument(documentId, userId, {
        version: expectedVersion,
        title: row.title,
        content: row.content,
      });
    },
  };
}

const mongoComments = async () =>
  (await database()).collection<StoredComment>("folio_comments");
const collaborationRepository: CollaborationRepository = {
  async listComments(documentId) {
    return (await mongoComments())
      .find({ documentId, deletedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();
  },
  async getComment(documentId, id) {
    return (await mongoComments()).findOne({
      _id: id,
      documentId,
      deletedAt: { $exists: false },
    });
  },
  async createComment(comment) {
    await (await mongoComments()).insertOne(comment);
    return comment;
  },
  async updateComment(documentId, id, fields) {
    return (await mongoComments()).findOneAndUpdate(
      { _id: id, documentId, deletedAt: { $exists: false } },
      { $set: fields },
      { returnDocument: "after" },
    );
  },
  async readHistory(documentId) {
    const row = await (
      await database()
    )
      .collection<{
        _id: string;
        history?: StoredVersionSnapshot[];
        updatedById?: string;
        version: number;
        title: string;
        content: RichTextDocument;
        updatedAt: Date;
        ownerId: string;
      }>("folio_documents")
      .findOne(
        { _id: documentId },
        {
          projection: {
            history: 1,
            updatedById: 1,
            version: 1,
            title: 1,
            content: 1,
            updatedAt: 1,
            ownerId: 1,
          },
        },
      );
    return {
      history: row?.history ?? [],
      updatedById: row?.updatedById,
      ...(row
        ? {
            current: {
              version: row.version,
              title: row.title,
              content: row.content,
              createdAt: row.updatedAt,
              authorId: row.updatedById ?? row.ownerId,
            },
          }
        : {}),
    };
  },
};
export const collaboration = collaborationService(
  collaborationRepository,
  documentService(repository),
  repository.getUser,
);
