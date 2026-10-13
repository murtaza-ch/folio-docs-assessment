import { config } from "dotenv";
import {
  MongoClient,
  type Document,
  type IndexDescriptionInfo,
  type Db,
} from "mongodb";
import { pathToFileURL } from "node:url";
import {
  assertSameCollection,
  DURABLE_FOLIO_COLLECTIONS,
  migrationIndex,
  MigrationError,
  planCollectionCopy,
  type DurableCollection,
} from "../lib/db-migration";

config({ path: ".env.migration", quiet: true });

type Inventory = Map<
  DurableCollection,
  { rows: Document[]; indexes: IndexDescriptionInfo[] }
>;
async function inventory(
  client: MongoClient,
  db: Db,
  includeIndexes: boolean,
): Promise<Inventory> {
  const collections = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      (collection) => collection.name,
    ),
  );
  const result: Inventory = new Map();
  const session = client.startSession({ snapshot: true });
  try {
    for (const name of DURABLE_FOLIO_COLLECTIONS) {
      const exists = collections.has(name);
      result.set(name, {
        rows: exists
          ? await db.collection(name).find({}, { session }).toArray()
          : [],
        indexes:
          exists && includeIndexes
            ? await db.collection(name).listIndexes().toArray()
            : [],
      });
    }
  } finally {
    await session.endSession();
  }
  return result;
}

export async function migrateDatabase(apply = false): Promise<void> {
  const sourceUri = process.env.SOURCE_MONGODB_URI;
  const targetUri = process.env.TARGET_MONGODB_URI;
  const sourceName = process.env.SOURCE_MONGODB_DB ?? "drive-test";
  const targetName = process.env.TARGET_MONGODB_DB ?? "drive-test";
  if (!sourceUri || !targetUri)
    throw new MigrationError(
      "Set SOURCE_MONGODB_URI and TARGET_MONGODB_URI in the ignored .env.migration file.",
    );
  if (sourceUri === targetUri && sourceName === targetName)
    throw new MigrationError("Source and target must be different databases.");
  if (sourceName !== "drive-test" || targetName !== "drive-test")
    throw new MigrationError(
      "This migration is restricted to the drive-test database on both connections.",
    );
  const options = {
    serverSelectionTimeoutMS: 15000,
    maxPoolSize: 3,
    promoteValues: false,
    promoteLongs: false,
    promoteBuffers: false,
  };
  const sourceClient = new MongoClient(sourceUri, options);
  const targetClient = new MongoClient(targetUri, options);
  try {
    await Promise.all([sourceClient.connect(), targetClient.connect()]);
    const sourceDb = sourceClient.db(sourceName);
    const targetDb = targetClient.db(targetName);
    const [source, target] = await Promise.all([
      inventory(sourceClient, sourceDb, true),
      inventory(targetClient, targetDb, false),
    ]);
    const plan = new Map<DurableCollection, Document[]>();
    // Validate every target collection before the first write. Identical partial
    // copies are safe to resume. Conflicting data is never changed or deleted.
    for (const name of DURABLE_FOLIO_COLLECTIONS) {
      const sourceRows = source.get(name)!.rows;
      const targetRows = target.get(name)!.rows;
      plan.set(name, planCollectionCopy(sourceRows, targetRows));
      console.log(
        `${name}: source ${sourceRows.length}, target ${targetRows.length}, missing ${plan.get(name)!.length}`,
      );
    }
    console.log(
      `Databases: source ${sourceName}, target ${targetName}. Sessions, rate limits, and presence are excluded.`,
    );
    if (!apply) {
      console.log(
        "Dry run complete. No data was written. Run with --apply to copy the verified plan.",
      );
      return;
    }

    for (const name of DURABLE_FOLIO_COLLECTIONS) {
      const rows = plan.get(name)!;
      // Batches reduce request size while retaining all original BSON values.
      for (let index = 0; index < rows.length; index += 100)
        await targetDb
          .collection(name)
          .insertMany(rows.slice(index, index + 100), { ordered: true });
      for (const index of source.get(name)!.indexes) {
        const spec = migrationIndex(index);
        if (spec)
          await targetDb.collection(name).createIndex(spec.key, spec.options);
      }
      const actual = await targetDb.collection(name).find().toArray();
      assertSameCollection(source.get(name)!.rows, actual);
      console.log(`${name}: ${actual.length} documents verified.`);
    }
    const sourceAfter = await inventory(sourceClient, sourceDb, false);
    for (const name of DURABLE_FOLIO_COLLECTIONS) {
      try {
        assertSameCollection(
          source.get(name)!.rows,
          sourceAfter.get(name)!.rows,
        );
      } catch {
        throw new MigrationError(
          "The source changed during migration. The target contains the captured snapshot. Keep the original connection active and inspect before switching.",
        );
      }
    }
    console.log(
      "Copy complete and verified. The original database was not changed. Sign in again after updating the app connection.",
    );
  } finally {
    await Promise.allSettled([sourceClient.close(), targetClient.close()]);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const invalid = process.argv
    .slice(2)
    .some((argument) => argument !== "--apply");
  if (invalid) {
    console.error("Usage: npx tsx scripts/migrate-db.ts [--apply]");
    process.exitCode = 1;
  } else
    migrateDatabase(process.argv.includes("--apply")).catch((error) => {
      // Driver messages may contain hostnames or connection details. Print only
      // our intentional messages, never the URI, a document, or a raw exception.
      const safe = error instanceof MigrationError;
      console.error(
        "Migration failed:",
        safe
          ? error.message
          : "Database operation failed. Check connectivity, permissions, and indexes. Original data remains unchanged.",
      );
      process.exitCode = 1;
    });
}
