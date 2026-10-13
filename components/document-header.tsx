"use client";

import type { ReactNode } from "react";
import { ArrowLeft, ChevronRight, MessageSquare, Share2 } from "lucide-react";
import type { Role } from "@/lib/types";
import { ExportMenu } from "./export-menu";
import { SaveStatus, type SaveState } from "./save-status";
import "./document-header.css";

interface DocumentHeaderProps {
  documentId: string;
  title: string;
  role: Role;
  saveState: SaveState;
  busy: boolean;
  presence: ReactNode;
  onBack: () => void;
  onActivity: () => void;
  onShare: () => void;
  beforeExport: () => Promise<boolean>;
}

export function DocumentHeader({
  documentId,
  title,
  role,
  saveState,
  busy,
  presence,
  onBack,
  onActivity,
  onShare,
  beforeExport,
}: DocumentHeaderProps) {
  return (
    <header className="doc-header">
      <nav className="doc-header__crumbs" aria-label="Breadcrumb">
        <button
          type="button"
          className="doc-header__back"
          onClick={onBack}
          aria-label="Back to documents"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          <span>Documents</span>
        </button>
        <ChevronRight
          className="doc-header__separator"
          size={14}
          aria-hidden="true"
        />
        <span className="doc-header__title" aria-current="page">
          {title || "Untitled document"}
        </span>
      </nav>
      <div className="doc-header__actions">
        {presence}
        <SaveStatus state={saveState} readOnly={role === "viewer"} />
        <span className="doc-header__divider" aria-hidden="true" />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onActivity}
          disabled={busy}
          aria-label="Comments and history"
          title="Comments and history"
        >
          <MessageSquare size={15} aria-hidden="true" />
          <span className="doc-header__label">Comments &amp; history</span>
        </button>
        <ExportMenu
          documentId={documentId}
          beforeExport={beforeExport}
          disabled={busy}
        />
        {role === "owner" && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onShare}
            disabled={busy}
            aria-label="Share"
          >
            <Share2 size={14} aria-hidden="true" />
            <span className="doc-header__share-label">Share</span>
          </button>
        )}
      </div>
    </header>
  );
}
