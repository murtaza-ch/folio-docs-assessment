"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Download, X } from "lucide-react";

type ExportFormat = "markdown" | "pdf";

const FORMATS: { format: ExportFormat; label: string; title: string }[] = [
  {
    format: "markdown",
    label: "Markdown (.md)",
    title: "Underline is exported as HTML tags.",
  },
  { format: "pdf", label: "PDF (.pdf)", title: "Printable PDF" },
];

interface Props {
  documentId: string;
  beforeExport: () => Promise<boolean>;
  disabled?: boolean;
}
export function ExportMenu({
  documentId,
  beforeExport,
  disabled = false,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    function closeOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", closeOutside);
    return () => window.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = itemRefs.current;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    items[(index + step + items.length) % items.length]?.focus();
  }

  async function download(format: ExportFormat) {
    close();
    setBusy(true);
    setError("");
    try {
      if (!(await beforeExport())) {
        setError("Save your changes before exporting.");
        return;
      }
      const response = await fetch(
        `/api/documents/${documentId}/export?format=${format}`,
      );
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Export failed. Try again.");
      }
      const blob = await response.blob();
      const header = response.headers.get("Content-Disposition") ?? "";
      const encoded = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const filename = encoded
        ? decodeURIComponent(encoded)
        : `document.${format === "pdf" ? "pdf" : "md"}`;
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = filename;
      window.document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Export failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="export-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-ghost btn-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="export-menu-list"
        aria-label="Export"
        disabled={disabled || busy}
        onClick={() => setOpen((current) => !current)}
      >
        {busy ? (
          <span className="spinner export-menu__spinner" aria-hidden="true" />
        ) : (
          <Download size={15} aria-hidden="true" />
        )}
        <span className="doc-header__label">Export</span>
        <ChevronDown
          className="doc-header__label"
          size={14}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          id="export-menu-list"
          className="export-menu__list"
          role="menu"
          aria-label="Export format"
          onKeyDown={moveFocus}
        >
          {FORMATS.map(({ format, label, title }, index) => (
            <button
              key={format}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              role="menuitem"
              className="export-menu__item"
              title={title}
              onClick={() => void download(format)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {error && (
        <div className="export-menu__error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label="Dismiss export error"
            onClick={() => setError("")}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
