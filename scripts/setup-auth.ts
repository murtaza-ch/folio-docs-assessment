import { config } from "dotenv";
import { MongoClient } from "mongodb";
import {
  DEMO_PASSWORD,
  DEMO_PROFILE_IDS,
  hashPassword,
  type AuthSession,
  type Credential,
} from "../lib/server-auth";
import type { StoredUser } from "../lib/server-db";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Set MONGODB_URI before running auth setup.");
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
async function setup() {
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB ?? "drive-test");
    await db
      .collection("folio_users")
      .createIndex({ email: 1 }, { unique: true });
    const credentials = db.collection<Credential>("folio_credentials");
    await credentials.createIndex({ email: 1 }, { unique: true });
    await db
      .collection<AuthSession>("folio_sessions")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await db
      .collection("folio_auth_rates")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    for (const id of DEMO_PROFILE_IDS) {
      const user = await db
        .collection<StoredUser>("folio_users")
        .findOne({ _id: id });
      if (!user) throw new Error("Run npm run db:setup before auth setup.");
      if (!(await credentials.findOne({ _id: id }))) {
        await credentials.updateOne(
          { _id: id },
          {
            $setOnInsert: {
              _id: id,
              email: user.email.toLowerCase(),
              passwordHash: await hashPassword(DEMO_PASSWORD),
              createdAt: new Date(),
            },
          },
          { upsert: true },
        );
      }
    }
    console.log(
      "Authentication ready. Demo credentials added only where absent; existing accounts and documents preserved.",
    );
  } finally {
    await client.close();
  }
}
setup().catch((error) => {
  console.error(
    "Auth setup failed:",
    error instanceof Error ? error.name : "Unknown error",
  );
  process.exitCode = 1;
});
