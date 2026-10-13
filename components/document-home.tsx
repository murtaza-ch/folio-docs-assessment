"use client";

import { FileText, Plus, Search, Upload, Users } from "lucide-react";
import type { DocumentSummary } from "@/lib/types";
import { fullDate, relativeTime } from "./date-format";
import {
  FILTER_LABELS,
  ROLE_LABELS,
  type DocumentFilter,
} from "./document-filter";
import "./document-home.css";

interface DocumentHomeProps {
  documents: DocumentSummary[];
  filter: DocumentFilter;
  search: string;
  loading: boolean;
  busy: boolean;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onImport: () => void;
  onClearSearch: () => void;
}

/** Stored excerpts usually open with the document's heading; skip it when it repeats the title. */
function excerptPreview({ title, excerpt }: DocumentSummary) {
  const heading = title.trim();
  if (heading && excerpt.startsWith(heading))
    return excerpt.slice(heading.length).trim();
  return excerpt;
}

function countLabel(count: number, search: string) {
  if (search)
    return `${count} ${count === 1 ? "result" : "results"} for “${search}”`;
  return `${count} ${count === 1 ? "document" : "documents"}`;
}

export function DocumentHome({
  documents,
  filter,
  search,
  loading,
  busy,
  onOpen,
  onCreate,
  onImport,
  onClearSearch,
}: DocumentHomeProps) {
  return (
    <div className="home">
      <header className="home__header">
        <div>
          <h1 className="home__title">{FILTER_LABELS[filter]}</h1>
          <p className="home__subtitle" aria-live="polite">
            {loading ? "Loading…" : countLabel(documents.length, search)}
          </p>
        </div>
        <div className="home__actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onImport}
            disabled={busy || loading}
          >
            <Upload size={15} aria-hidden="true" />
            Import
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onCreate}
            disabled={busy || loading}
          >
            <Plus size={16} aria-hidden="true" />
            New document
          </button>
        </div>
      </header>

      {!loading && documents.length === 0 ? (
        <EmptyState
          filter={filter}
          search={search}
          busy={busy}
          onCreate={onCreate}
          onClearSearch={onClearSearch}
        />
      ) : (
        <DocumentTable
          documents={documents}
          loading={loading}
          busy={busy}
          onOpen={onOpen}
        />
      )}
    </div>
  );
}

function DocumentTable({
  documents,
  loading,
  busy,
  onOpen,
}: Pick<DocumentHomeProps, "documents" | "loading" | "busy" | "onOpen">) {
  return (
    <table className="doc-table" aria-busy={loading || busy}>
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col" className="doc-table__owner">
            Owner
          </th>
          <th scope="col" className="doc-table__access">
            Access
          </th>
          <th scope="col" className="doc-table__shared">
            Shared
          </th>
          <th scope="col" className="doc-table__updated">
            Updated
          </th>
        </tr>
      </thead>
      <tbody>
        {loading
          ? [0, 1, 2, 3, 4].map((row) => (
              <tr key={row} className="doc-table__skeleton" aria-hidden="true">
                <td colSpan={5}>
                  <span />
                </td>
              </tr>
            ))
          : documents.map((item) => (
              // The row handles pointer clicks; the title button makes it keyboard reachable.
              <tr key={item.id} onClick={() => !busy && onOpen(item.id)}>
                <td>
                  <div className="doc-table__name">
                    <FileText size={16} aria-hidden="true" />
                    <div>
                      <button
                        type="button"
                        className="doc-table__open"
                        disabled={busy}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpen(item.id);
                        }}
                      >
                        {item.title || "Untitled document"}
                      </button>
                      {excerptPreview(item) && (
                        <p className="doc-table__excerpt">
                          {excerptPreview(item)}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="doc-table__owner">
                  <span className="doc-table__person">
                    <span
                      className="avatar avatar-xs"
                      style={{ background: item.owner.color }}
                      aria-hidden="true"
                    >
                      {item.owner.initials}
                    </span>
                    {item.role === "owner" ? "You" : item.owner.name}
                  </span>
                </td>
                <td className="doc-table__access">
                  <span className="badge">{ROLE_LABELS[item.role]}</span>
                </td>
                <td className="doc-table__shared">
                  {item.shareCount > 0 ? (
                    <span className="doc-table__people">
                      <Users size={14} aria-hidden="true" />
                      {item.shareCount}
                      <span className="visually-hidden">
                        {item.shareCount === 1 ? " person" : " people"}
                      </span>
                    </span>
                  ) : (
                    <>
                      <span aria-hidden="true">—</span>
                      <span className="visually-hidden">Not shared</span>
                    </>
                  )}
                </td>
                <td className="doc-table__updated">
                  <time
                    dateTime={item.updatedAt}
                    title={fullDate(item.updatedAt)}
                  >
                    {relativeTime(item.updatedAt)}
                  </time>
                </td>
              </tr>
            ))}
      </tbody>
    </table>
  );
}

function EmptyState({
  filter,
  search,
  busy,
  onCreate,
  onClearSearch,
}: Pick<
  DocumentHomeProps,
  "filter" | "search" | "busy" | "onCreate" | "onClearSearch"
>) {
  if (search)
    return (
      <div className="home-empty">
        <Search size={20} aria-hidden="true" />
        <h2>No matching documents</h2>
        <p>Try a different title or phrase.</p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onClearSearch}
        >
          Clear search
        </button>
      </div>
    );
  if (filter === "shared")
    return (
      <div className="home-empty">
        <Users size={20} aria-hidden="true" />
        <h2>Nothing shared with you yet</h2>
        <p>Documents other people share with you will appear here.</p>
      </div>
    );
  return (
    <div className="home-empty">
      <FileText size={20} aria-hidden="true" />
      <h2>No documents yet</h2>
      <p>Create a document, or import a .txt or .md file.</p>
      <button
        type="button"
        className="btn btn-primary"
        onClick={onCreate}
        disabled={busy}
      >
        <Plus size={16} aria-hidden="true" />
        New document
      </button>
    </div>
  );
}
