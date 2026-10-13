import { database, repository } from "./server-db";
import { AppError } from "./server-service";
import type { Document, User } from "./types";
import {
  PRESENCE_TTL_MS,
  type PresenceSnapshot,
  type PresenceStatus,
} from "./presence-types";

export interface PresenceRow {
  documentId: string;
  userId: string;
  tabId: string;
  status: PresenceStatus;
  lastSeen: Date;
  expiresAt: Date;
}
let indexPromise: Promise<unknown> | undefined;
async function collection() {
  const rows = (await database()).collection<PresenceRow>("folio_presence");
  indexPromise ??= Promise.all([
    rows.createIndex({ documentId: 1, userId: 1, tabId: 1 }, { unique: true }),
    rows.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]).catch((error) => {
    indexPromise = undefined;
    throw error;
  });
  await indexPromise;
  return rows;
}

export function aggregatePresence(
  rows: PresenceRow[],
  users: User[],
  now = new Date(),
) {
  const participants = new Map<
    string,
    { user: User; status: PresenceStatus; lastSeen: string }
  >();
  for (const row of rows) {
    if (row.expiresAt.getTime() <= now.getTime()) continue;
    const user = users.find((value) => value.id === row.userId);
    if (!user) continue;
    const previous = participants.get(user.id);
    participants.set(user.id, {
      user,
      status:
        row.status === "editing" || previous?.status === "editing"
          ? "editing"
          : "viewing",
      lastSeen:
        previous && previous.lastSeen > row.lastSeen.toISOString()
          ? previous.lastSeen
          : row.lastSeen.toISOString(),
    });
  }
  return [...participants.values()].sort((a, b) =>
    a.user.name.localeCompare(b.user.name),
  );
}

export async function presenceSnapshot(
  document: Document,
): Promise<PresenceSnapshot> {
  const now = new Date();
  const shares = await repository.listShares(document.id);
  const allowed = [document.ownerId, ...shares.map((share) => share.userId)];
  const rows = await (
    await collection()
  )
    .find({
      documentId: document.id,
      userId: { $in: allowed },
      expiresAt: { $gt: now },
    })
    .toArray();
  const users = await Promise.all(
    [...new Set(rows.map((row) => row.userId))].map((id) =>
      repository.getUser(id),
    ),
  );
  return {
    participants: aggregatePresence(
      rows,
      users.filter((user): user is User => user !== null),
      now,
    ),
    observedAt: now.toISOString(),
    documentVersion: document.version,
  };
}

export async function heartbeat(
  document: Document,
  userId: string,
  tabId: string,
  status: PresenceStatus,
) {
  if (status === "editing" && document.role === "viewer")
    throw new AppError(
      403,
      "FORBIDDEN",
      "Viewers cannot publish editing activity.",
    );
  const now = new Date();
  await (
    await collection()
  ).updateOne(
    { documentId: document.id, userId, tabId },
    {
      $set: {
        status,
        lastSeen: now,
        expiresAt: new Date(now.getTime() + PRESENCE_TTL_MS),
      },
    },
    { upsert: true },
  );
}
export async function leavePresence(
  documentId: string,
  userId: string,
  tabId: string,
) {
  await (await collection()).deleteOne({ documentId, userId, tabId });
}
