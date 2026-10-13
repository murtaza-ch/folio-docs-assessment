"use client";

import { useLayoutEffect, useRef } from "react";
import type { JSONContent } from "@tiptap/react";
import { RefreshCw } from "lucide-react";
import type { Document } from "@/lib/types";
import { editedLabel, fullDate } from "./date-format";
import { DocumentEditor } from "./document-editor";
import "./document-page.css";

interface DocumentPageProps {
  document: Document;
  title: string;
  content: JSONContent;
  wordCount: number;
  busy: boolean;
  remoteNotice: boolean;
  onTitleChange: (title: string) => void;
  onTitleBlur: () => void;
  onContentChange: (content: JSONContent) => void;
}

export function DocumentPage({
  document,
  title,
  content,
  wordCount,
  busy,
  remoteNotice,
  onTitleChange,
  onTitleBlur,
  onContentChange,
}: DocumentPageProps) {
  const editable = document.role !== "viewer";
  return (
    <div className="canvas">
      <DocumentEditor
        content={content}
        onChange={onContentChange}
        editable={editable}
        disabled={busy}
      >
        <TitleField
          value={title}
          readOnly={!editable || busy}
          onChange={onTitleChange}
          onBlur={onTitleBlur}
        />
        <p className="sheet__meta">
          <span
            className="avatar avatar-xs"
            style={{ background: document.owner.color }}
            aria-hidden="true"
          >
            {document.owner.initials}
          </span>
          <span>{document.owner.name}</span>
          <span aria-hidden="true">·</span>
          <time
            dateTime={document.updatedAt}
            title={fullDate(document.updatedAt)}
          >
            {editedLabel(document.updatedAt)}
          </time>
          <span aria-hidden="true">·</span>
          <span>
            {wordCount} {wordCount === 1 ? "word" : "words"}
          </span>
        </p>
        {remoteNotice && (
          <p className="sheet__remote" role="status">
            <RefreshCw size={14} aria-hidden="true" />A teammate saved a newer
            version. Your draft is safe.
          </p>
        )}
      </DocumentEditor>
    </div>
  );
}

/** Single-line title that wraps and grows instead of scrolling sideways. */
function TitleField({
  value,
  readOnly,
  onChange,
  onBlur,
}: {
  value: string;
  readOnly: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    function fit() {
      const field = ref.current;
      if (!field) return;
      field.style.height = "auto";
      field.style.height = `${field.scrollHeight}px`;
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [value]);

  return (
    <textarea
      ref={ref}
      className="sheet__title"
      aria-label="Document title"
      placeholder="Untitled document"
      rows={1}
      maxLength={160}
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value.replace(/\n/g, " "))}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.preventDefault();
      }}
      onBlur={onBlur}
    />
  );
}
