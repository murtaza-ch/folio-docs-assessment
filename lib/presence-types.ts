import type { User } from "./types";

export type PresenceStatus = "viewing" | "editing";
export interface PresenceParticipant {
  user: User;
  status: PresenceStatus;
  lastSeen: string;
}
export interface PresenceSnapshot {
  participants: PresenceParticipant[];
  observedAt: string;
  documentVersion: number;
}
export const PRESENCE_TTL_MS = 20_000;
