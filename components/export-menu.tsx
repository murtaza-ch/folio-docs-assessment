"use client";
import { useState } from "react";
import { Button } from "@chakra-ui/react";
import { Download } from "lucide-react";
import "./presence.css";

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
  async function download(format: "markdown" | "pdf") {
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
    <div className="export-actions">
      <Button
        size="xs"
        variant="ghost"
        disabled={disabled || busy}
        onClick={() => void download("markdown")}
        title="Export saved document as Markdown. Underline uses HTML tags."
      >
        <Download size={12} />
        MD
      </Button>
      <Button
        size="xs"
        variant="ghost"
        disabled={disabled || busy}
        onClick={() => void download("pdf")}
        title="Export saved document as PDF"
      >
        <Download size={12} />
        PDF
      </Button>
      {error && (
        <span role="alert" className="export-error">
          {error}
        </span>
      )}
    </div>
  );
}
