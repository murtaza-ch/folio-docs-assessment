import type { DocumentSummary, Role } from "@/lib/types";

export type DocumentFilter = "all" | "owned" | "shared";

export const FILTER_LABELS: Record<DocumentFilter, string> = {
  all: "All documents",
  owned: "Owned by me",
  shared: "Shared with me",
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  editor: "Can edit",
  viewer: "Can view",
};

export function matchesFilter(item: DocumentSummary, filter: DocumentFilter) {
  if (filter === "all") return true;
  return filter === "owned" ? item.role === "owner" : item.role !== "owner";
}
