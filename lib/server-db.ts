import { documentText, documentWordCount } from "./document-text";
import { MongoClient, type Db } from "mongodb";
import { randomUUID } from "node:crypto";
import type {
  Document,
  DocumentShare,
  RichTextDocument,
  ShareRole,
  User,
} from "./types";
import type { DocumentRepository } from "./server-service";
import { AppError } from "./server-service";

type StoredShare = { userId: string; role: ShareRole; createdAt: Date };
export type StoredDocument = {
  _id: string;
  title: string;
  ownerId: string;
  content: RichTextDocument;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  shares: StoredShare[];
};
export type StoredUser = User & { _id: string };
// This cache reuses the connection only. All application data lives in MongoDB.
const globalMongo = globalThis as typeof globalThis & {
  folioMongo?: Promise<MongoClient>;
};
export async function database(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri)
    throw new AppError(
      503,
      "DATABASE_NOT_CONFIGURED",
      "Connect MongoDB by setting MONGODB_URI, then run npm run db:setup.",
    );
  if (!globalMongo.folioMongo) {
    globalMongo.folioMongo = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    })
      .connect()
      .catch((error) => {
        delete globalMongo.folioMongo;
        throw error;
      });
  }
  return (await globalMongo.folioMongo).db(
    process.env.MONGODB_DB ?? "drive-test",
  );
}
function publicUser({ _id, ...value }: StoredUser): User {
  void _id;
  return value;
}
export function plainText(content: RichTextDocument): string {
  return documentText(content).replace(/\s+/g, " ").trim();
}

async function document(
  row: StoredDocument,
  userId: string,
): Promise<Document> {
  const owner = await repository.getUser(row.ownerId);
  if (!owner) throw new Error("Document owner not found");
  const text = plainText(row.content);
  return {
    id: row._id,
    title: row.title,
    content: row.content,
    ownerId: row.ownerId,
    owner,
    role:
      row.ownerId === userId
        ? "owner"
        : row.shares.find((s) => s.userId === userId)!.role,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
    excerpt: text.slice(0, 180),
    wordCount: documentWordCount(row.content),
    shareCount: row.shares.length,
  };
}
async function shares(row: StoredDocument): Promise<DocumentShare[]> {
  const users = await repository.listUsers();
  return row.shares
    .flatMap((s) => {
      const user = users.find((u) => u.id === s.userId);
      return user
        ? [
            {
              userId: s.userId,
              role: s.role,
              createdAt: s.createdAt.toISOString(),
              user,
            },
          ]
        : [];
    })
    .sort((a, b) => a.user.name.localeCompare(b.user.name));
}
export const repository: DocumentRepository = {
  async listUsers() {
    return (
      await (
        await database()
      )
        .collection<StoredUser>("folio_users")
        .find()
        .sort({ name: 1 })
        .toArray()
    ).map(publicUser);
  },
  async getUser(id) {
    const row = await (
      await database()
    )
      .collection<StoredUser>("folio_users")
      .findOne({ _id: id });
    return row ? publicUser(row) : null;
  },
  async listDocuments(userId) {
    const rows = await (
      await database()
    )
      .collection<StoredDocument>("folio_documents")
      .find({ $or: [{ ownerId: userId }, { "shares.userId": userId }] })
      .sort({ updatedAt: -1 })
      .toArray();
    return Promise.all(
      rows.map(async (row) => {
        const { content, ...summary } = await document(row, userId);
        void content;
        return summary;
      }),
    );
  },
  async getDocument(id, userId) {
    const row = await (
      await database()
    )
      .collection<StoredDocument>("folio_documents")
      .findOne({
        _id: id,
        $or: [{ ownerId: userId }, { "shares.userId": userId }],
      });
    return row ? document(row, userId) : null;
  },
  async createDocument(userId, title, content) {
    const now = new Date();
    const row: StoredDocument = {
      _id: randomUUID(),
      ownerId: userId,
      title,
      content,
      version: 1,
      createdAt: now,
      updatedAt: now,
      shares: [],
    };
    await (
      await database()
    )
      .collection<StoredDocument>("folio_documents")
      .insertOne(row);
    return document(row, userId);
  },
  async updateDocument(id, userId, version, title, content) {
    // Permission and version are checked again in the same atomic update.
    const row = await (
      await database()
    )
      .collection<StoredDocument>("folio_documents")
      .findOneAndUpdate(
        {
          _id: id,
          version,
          $or: [
            { ownerId: userId },
            { shares: { $elemMatch: { userId, role: "editor" } } },
          ],
        },
        {
          $set: {
            updatedAt: new Date(),
            ...(title === undefined ? {} : { title }),
            ...(content === undefined ? {} : { content }),
          },
          $inc: { version: 1 },
        },
        { returnDocument: "after" },
      );
    return row ? document(row, userId) : null;
  },
  async listShares(id) {
    const row = await (
      await database()
    )
      .collection<StoredDocument>("folio_documents")
      .findOne({ _id: id });
    return row ? shares(row) : [];
  },
  async upsertShare(id, ownerId, userId, role) {
    const row = await (
      await database()
    )
      .collection<StoredDocument>("folio_documents")
      .findOneAndUpdate(
        { _id: id, ownerId, $expr: { $ne: ["$ownerId", userId] } },
        [
          {
            $set: {
              shares: {
                $concatArrays: [
                  {
                    $filter: {
                      input: "$shares",
                      as: "share",
                      cond: { $ne: ["$$share.userId", userId] },
                    },
                  },
                  [{ userId, role, createdAt: new Date() }],
                ],
              },
            },
          },
        ],
        { returnDocument: "after" },
      );
    return row
      ? ((await shares(row)).find((s) => s.userId === userId) ?? null)
      : null;
  },
  async removeShare(id, ownerId, userId) {
    const result = await (
      await database()
    )
      .collection<StoredDocument>("folio_documents")
      .updateOne(
        { _id: id, ownerId, "shares.userId": userId },
        { $pull: { shares: { userId } } },
      );
    return result.modifiedCount > 0;
  },
};
