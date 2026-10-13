"use client";

import { useRef, useState, type DragEvent } from "react";
import { FileText, Upload, X } from "lucide-react";
import type { Document } from "@/lib/types";
import { InlineAlert, Spinner } from "./feedback";
import { Modal } from "./modal";
import "./dialogs.css";

const MAX_BYTES = 1024 * 1024;

function formatSize(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export function ImportDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (document: Document) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  function choose(next?: File) {
    setError("");
    if (!next) return;
    if (!/\.(txt|md)$/i.test(next.name)) {
      setError("Choose a plain text (.txt) or Markdown (.md) file.");
      return;
    }
    if (next.size > MAX_BYTES) {
      setError("This file is too large. The limit is 1 MB.");
      return;
    }
    setFile(next);
  }
  async function upload() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/import", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not import this file.");
      onImported(result.document);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Import failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const browse = () => input.current?.click();
  const dragHandlers = {
    onDragOver(event: DragEvent<HTMLDivElement>) {
      event.preventDefault();
      if (!busy) setDragging(true);
    },
    onDragLeave(event: DragEvent<HTMLDivElement>) {
      // Moving between child elements also fires dragleave; ignore those.
      if (!event.currentTarget.contains(event.relatedTarget as Node | null))
        setDragging(false);
    },
    onDrop(event: DragEvent<HTMLDivElement>) {
      event.preventDefault();
      setDragging(false);
      if (!busy) choose(event.dataTransfer.files[0]);
    },
  };

  return (
    <Modal
      title="Import a document"
      closeDisabled={busy}
      description=".txt or .md, up to 1 MB. The file becomes a new editable document."
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={upload}
            disabled={!file || busy}
          >
            {busy && <Spinner />}
            {busy ? "Importing…" : "Import"}
          </button>
        </>
      }
    >
      <div
        className={`import-drop${dragging ? " is-dragging" : ""}`}
        {...dragHandlers}
      >
        {file ? (
          <div className="import-file">
            <span className="import-file-icon" aria-hidden>
              <FileText size={18} />
            </span>
            <div className="import-file-text">
              <strong>{file.name}</strong>
              <span>{formatSize(file.size)}</span>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={browse}
              disabled={busy}
            >
              Change
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              aria-label={`Remove ${file.name}`}
              onClick={() => setFile(null)}
              disabled={busy}
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="import-zone"
            onClick={browse}
            disabled={busy}
          >
            <span className="import-zone-icon" aria-hidden>
              <Upload size={18} />
            </span>
            <strong>
              {dragging ? "Release to add this file" : "Drop a file here"}
            </strong>
            <span>
              or <span className="import-zone-link">browse your computer</span>
            </span>
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept=".txt,.md,text/plain,text/markdown"
        aria-label="File to import"
        className="visually-hidden"
        tabIndex={-1}
        onChange={(event) => {
          choose(event.target.files?.[0]);
          // Allow choosing the same file again after removing it.
          event.target.value = "";
        }}
      />
      {error && <InlineAlert>{error}</InlineAlert>}
    </Modal>
  );
}
