import { config } from "dotenv";
import { MongoClient } from "mongodb";
import { SEED_DOCUMENTS, SEED_USERS } from "../db/seed";
import type { StoredDocument, StoredUser } from "../lib/server-db";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
const uri = process.env.MONGODB_URI;
if (!uri)
  throw new Error(
    "Set MONGODB_URI in .env.local before running npm run db:setup.",
  );
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
async function setup() {
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB ?? "drive-test");
    const users = db.collection<StoredUser>("folio_users");
    const documents = db.collection<StoredDocument>("folio_documents");
    await users.createIndex({ email: 1 }, { unique: true });
    await documents.createIndex({ ownerId: 1, updatedAt: -1 });
    await documents.createIndex({ "shares.userId": 1, updatedAt: -1 });
    for (const user of SEED_USERS)
      await users.updateOne(
        { _id: user.id },
        { $setOnInsert: { _id: user.id, ...user } },
        { upsert: true },
      );
    for (const document of SEED_DOCUMENTS)
      await documents.updateOne(
        { _id: document._id },
        { $setOnInsert: document },
        { upsert: true },
      );
    console.log(
      "MongoDB ready. Demo users and sample documents seeded without replacing existing data.",
    );
  } finally {
    await client.close();
  }
}
setup().catch((error) => {
  console.error(
    "Database setup failed:",
    error instanceof Error ? error.name : "Unknown error",
  );
  process.exitCode = 1;
});
