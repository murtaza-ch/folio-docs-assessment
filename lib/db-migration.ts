import {
  BSON,
  type Document,
  type IndexDescriptionInfo,
  type CreateIndexesOptions,
} from "mongodb";

export const DURABLE_FOLIO_COLLECTIONS = [
  "folio_users",
  "folio_documents",
  "folio_credentials",
  "folio_comments",
] as const;
export type DurableCollection = (typeof DURABLE_FOLIO_COLLECTIONS)[number];
export class MigrationError extends Error {}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, child]) => [key, sorted(child)]),
    );
  return value;
}
// Canonical Extended JSON retains BSON dates, binary UUIDs and numeric types.
// Object field order is ignored; array order and every typed value are retained.
export function canonicalBson(value: unknown): string {
  return JSON.stringify(
    sorted(BSON.EJSON.serialize(value, { relaxed: false })),
  );
}
export function planCollectionCopy(
  source: Document[],
  target: Document[],
): Document[] {
  const rows = new Map(source.map((row) => [canonicalBson(row._id), row]));
  const targetIds = new Set<string>();
  for (const row of target) {
    const key = canonicalBson(row._id);
    const sourceRow = rows.get(key);
    if (!sourceRow || canonicalBson(sourceRow) !== canonicalBson(row))
      throw new MigrationError(
        "Target contains app data that differs from the source. No existing data will be overwritten.",
      );
    targetIds.add(key);
  }
  return source.filter((row) => !targetIds.has(canonicalBson(row._id)));
}
export function assertSameCollection(
  expected: Document[],
  actual: Document[],
): void {
  if (
    expected.length !== actual.length ||
    planCollectionCopy(expected, actual).length !== 0
  )
    throw new MigrationError(
      "Collection verification failed. Keep the original connection active and inspect the target before switching.",
    );
}

export function migrationIndex(
  index: IndexDescriptionInfo,
): { key: IndexDescriptionInfo["key"]; options: CreateIndexesOptions } | null {
  if (index.name === "_id_") return null;
  // Copy semantic index settings, excluding server-owned index metadata.
  const allowed = [
    "unique",
    "sparse",
    "expireAfterSeconds",
    "partialFilterExpression",
    "collation",
    "hidden",
    "weights",
    "default_language",
    "language_override",
    "textIndexVersion",
    "2dsphereIndexVersion",
    "bits",
    "min",
    "max",
    "bucketSize",
    "wildcardProjection",
  ] as const;
  const options: Record<string, unknown> = { name: index.name };
  for (const key of allowed)
    if (index[key] !== undefined) options[key] = index[key];
  return { key: index.key, options: options as CreateIndexesOptions };
}
