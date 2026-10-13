"use client";

import { Box, Button, Flex } from "@chakra-ui/react";
import { FileText, Plus, Search, Users } from "lucide-react";
import type { DocumentSummary } from "@/lib/types";

export function relativeDate(value: string) {
  const date = new Date(value);
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString("en", { month: "short", day: "numeric" });
}

export function DocumentList({
  documents,
  selectedId,
  onSelect,
  onCreate,
  loading,
  busy,
  search,
  filter,
}: {
  documents: DocumentSummary[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  loading: boolean;
  busy: boolean;
  search: string;
  filter: string;
}) {
  return (
    <Box className="document-panel">
      <Flex
        className="document-panel-heading"
        align="center"
        justify="space-between"
      >
        <div>
          <h2>
            {filter === "owned"
              ? "Your documents"
              : filter === "shared"
                ? "Shared with you"
                : "All documents"}
          </h2>
          <p>
            {documents.length}{" "}
            {documents.length === 1 ? "document" : "documents"}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Create a document"
          onClick={onCreate}
          disabled={busy}
        >
          <Plus size={18} />
        </Button>
      </Flex>
      <div className="document-items" aria-label="Documents">
        {loading ? (
          <div className="panel-empty" role="status">
            <span className="spinner" />
            Loading your documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="panel-empty">
            <span className="empty-icon">
              {search ? <Search size={24} /> : <FileText size={24} />}
            </span>
            <h3>{search ? "No matches" : "A fresh page awaits"}</h3>
            <p>
              {search
                ? "Try a different title or phrase."
                : filter === "shared"
                  ? "Documents others share with you will appear here."
                  : "Create a document to start writing."}
            </p>
            {!search && filter !== "shared" && (
              <Button size="sm" onClick={onCreate} disabled={busy}>
                Create document
              </Button>
            )}
          </div>
        ) : (
          documents.map((document) => (
            <button
              key={document.id}
              className={`document-item ${selectedId === document.id ? "selected" : ""}`}
              onClick={() => onSelect(document.id)}
              disabled={busy}
              aria-current={selectedId === document.id ? "page" : undefined}
            >
              <div className="document-item-top">
                <span className="document-file-icon">
                  <FileText size={17} />
                </span>
                <time dateTime={document.updatedAt}>
                  {relativeDate(document.updatedAt)}
                </time>
              </div>
              <h3>{document.title || "Untitled document"}</h3>
              <p>{document.excerpt || "Your next idea starts here."}</p>
              <div className="document-item-bottom">
                <span className={`role-pill ${document.role}`}>
                  {document.role === "owner"
                    ? "Owned by you"
                    : document.role === "editor"
                      ? "Can edit"
                      : "View only"}
                </span>
                {document.shareCount > 0 && (
                  <span
                    className="share-count"
                    aria-label={`${document.shareCount} collaborators`}
                  >
                    <Users size={12} />
                    {document.shareCount}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
      <div className="document-panel-foot">
        <span className="status-dot" /> A home for your ideas.
      </div>
    </Box>
  );
}
