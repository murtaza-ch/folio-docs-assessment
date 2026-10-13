"use client";

import { FileText, Users } from "lucide-react";
import type { DocumentSummary } from "@/lib/types";

interface DocumentListProps {
  documents: DocumentSummary[];
  selectedId?: string;
  loading: boolean;
  busy: boolean;
  search: string;
  onSelect: (id: string) => void;
}

/** Compact document list shown in the sidebar. */
export function DocumentList({
  documents,
  selectedId,
  loading,
  busy,
  search,
  onSelect,
}: DocumentListProps) {
  if (loading)
    return (
      <div className="doc-list" aria-busy="true" aria-label="Loading documents">
        {[0, 1, 2, 3].map((row) => (
          <span key={row} className="doc-list__skeleton" />
        ))}
      </div>
    );

  if (documents.length === 0)
    return (
      <p className="doc-list__empty">
        {search ? "No matching documents" : "No documents"}
      </p>
    );

  return (
    <ul className="doc-list">
      {documents.map((item) => {
        const selected = item.id === selectedId;
        return (
          <li key={item.id}>
            <button
              type="button"
              className="doc-list__item"
              aria-current={selected ? "page" : undefined}
              disabled={busy}
              onClick={() => onSelect(item.id)}
            >
              <FileText size={15} aria-hidden="true" />
              <span className="doc-list__title">
                {item.title || "Untitled document"}
              </span>
              {item.role !== "owner" && (
                <Users
                  size={14}
                  aria-label={`Shared by ${item.owner.name}`}
                  role="img"
                />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
