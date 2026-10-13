import { BSON } from "mongodb";
import { describe, expect, it } from "vitest";
import {
  assertSameCollection,
  canonicalBson,
  DURABLE_FOLIO_COLLECTIONS,
  migrationIndex,
  planCollectionCopy,
} from "../lib/db-migration";

describe("non-destructive Folio database migration", () => {
  it("selects durable app collections and excludes active authentication and presence state", () => {
    expect(DURABLE_FOLIO_COLLECTIONS).toEqual([
      "folio_users",
      "folio_documents",
      "folio_credentials",
      "folio_comments",
    ]);
    expect(DURABLE_FOLIO_COLLECTIONS).not.toContain("folio_sessions");
  });
  it("compares object fields deterministically without losing typed BSON values or array order", () => {
    const date = new Date("2026-10-13T12:00:00Z"),
      uuid = new BSON.UUID();
    const first = {
      _id: "doc",
      history: [{ version: new BSON.Int32(1), createdAt: date }],
      uuid,
    };
    const reordered = {
      uuid,
      history: [{ createdAt: date, version: new BSON.Int32(1) }],
      _id: "doc",
    };
    expect(canonicalBson(first)).toBe(canonicalBson(reordered));
    expect(canonicalBson(new BSON.Int32(1))).not.toBe(
      canonicalBson(BSON.Long.fromNumber(1)),
    );
    expect(canonicalBson(date)).not.toBe(canonicalBson(date.toISOString()));
    expect(canonicalBson([1, 2])).not.toBe(canonicalBson([2, 1]));
  });
  it("copies an empty target and resumes identical partial copies without duplicating data", () => {
    const source = [
      { _id: "alice", passwordHash: "hash" },
      { _id: "ben", passwordHash: "other" },
    ];
    expect(planCollectionCopy(source, [])).toEqual(source);
    expect(planCollectionCopy(source, [source[0]])).toEqual([source[1]]);
    expect(planCollectionCopy(source, source)).toEqual([]);
  });
  it("rejects conflicting existing content and unexpected target IDs instead of overwriting", () => {
    const source = [{ _id: "doc", title: "Original" }];
    expect(() =>
      planCollectionCopy(source, [{ _id: "doc", title: "Different" }]),
    ).toThrow("differs");
    expect(() =>
      planCollectionCopy(source, [{ _id: "unrelated", title: "Other" }]),
    ).toThrow("differs");
  });
  it("verifies all IDs and contents independently of collection order", () => {
    const source = [
      { _id: "a", value: 1 },
      { _id: "b", value: 2 },
    ];
    expect(() =>
      assertSameCollection(source, [...source].reverse()),
    ).not.toThrow();
    expect(() => assertSameCollection(source, source.slice(1))).toThrow(
      "verification",
    );
    expect(() =>
      assertSameCollection(source, [{ ...source[0], value: 3 }, source[1]]),
    ).toThrow();
  });
  it("retains semantic index options and excludes server-owned metadata", () => {
    const index = migrationIndex({
      key: { email: 1 },
      name: "email_1",
      unique: true,
      sparse: true,
      expireAfterSeconds: 3600,
      partialFilterExpression: { enabled: true },
      v: 2,
      ns: "old.users",
    });
    expect(index).toEqual({
      key: { email: 1 },
      options: {
        name: "email_1",
        unique: true,
        sparse: true,
        expireAfterSeconds: 3600,
        partialFilterExpression: { enabled: true },
      },
    });
    expect(migrationIndex({ key: { _id: 1 }, name: "_id_", v: 2 })).toBeNull();
  });
});
