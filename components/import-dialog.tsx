"use client";

import { useRef, useState } from "react";
import { Button } from "@chakra-ui/react";
import { FileUp, FileText } from "lucide-react";
import type { Document } from "@/lib/types";
import { Modal } from "./modal";

export function ImportDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (document: Document) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
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
    if (next.size > 1024 * 1024) {
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
  return (
    <Modal
      title="Bring your words along"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="modal-description">
        Import a text or Markdown file as an editable document.
      </p>
      <button
        className={`upload-zone ${file ? "has-file" : ""}`}
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (!busy) choose(event.dataTransfer.files[0]);
        }}
      >
        {file ? <FileText size={28} /> : <FileUp size={28} />}
        <strong>{file ? file.name : "Choose a file or drop it here"}</strong>
        <span>
          {file
            ? `${(file.size / 1024).toFixed(1)} KB · Click to choose another`
            : ".txt or .md · Up to 1 MB"}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept=".txt,.md,text/plain,text/markdown"
        aria-label="File to import"
        className="visually-hidden"
        onChange={(event) => choose(event.target.files?.[0])}
      />
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          className="primary-button"
          onClick={upload}
          disabled={!file || busy}
        >
          {busy ? "Importing..." : "Import document"}
        </Button>
      </div>
    </Modal>
  );
}
