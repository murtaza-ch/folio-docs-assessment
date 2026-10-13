// Exercise the actual MongoDB pipeline with large content and competing saves.
import { config } from "dotenv";
import assert from "node:assert/strict";
import { BSON } from "mongodb";
import { database, repository, type StoredDocument } from "../lib/server-db";
config({ path: ".env.local", quiet: true });
const userId = "11111111-1111-4111-8111-111111111111";
let id: string | undefined;
async function main() {
  try {
    const content = {
      type: "doc" as const,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "a".repeat(1_000_000) }],
        },
      ],
    };
    let doc = await repository.createDocument(
      userId,
      "History storage check",
      content,
    );
    id = doc.id;
    for (let i = 0; i < 8; i++) {
      const saved = await repository.updateDocument(
        id,
        userId,
        doc.version,
        "History storage check " + i,
        content,
      );
      assert(saved);
      doc = saved;
    }
    const db = await database();
    const stored = await db
      .collection<StoredDocument>("folio_documents")
      .findOne({ _id: id });
    assert(stored);
    assert(
      (stored.history?.length ?? 0) > 0 && (stored.history?.length ?? 0) < 8,
    );
    assert(
      (stored.history ?? []).reduce(
        (sum, item) => sum + BSON.calculateObjectSize(item),
        0,
      ) <= 6_000_000,
    );
    const competing = await Promise.all([
      repository.updateDocument(id, userId, doc.version, "Concurrent A"),
      repository.updateDocument(id, userId, doc.version, "Concurrent B"),
    ]);
    assert.equal(competing.filter(Boolean).length, 1);
    const latest = await repository.getDocument(id, userId);
    assert.equal(latest?.version, doc.version + 1);
    console.log(
      "PASS: history stays within its BSON byte budget and only one competing save succeeds.",
    );
  } finally {
    const db = await database();
    if (id)
      await db
        .collection<StoredDocument>("folio_documents")
        .deleteOne({ _id: id });
    await db.client.close();
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "History check failed",
  );
  process.exitCode = 1;
});
