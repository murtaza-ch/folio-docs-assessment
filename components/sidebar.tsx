"use client";

import { useEffect, useRef } from "react";
import {
  Files,
  LogOut,
  Plus,
  Upload,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { DocumentSummary, User } from "@/lib/types";
import { Brand } from "./brand";
import { DocumentList } from "./document-list";
import { FILTER_LABELS, type DocumentFilter } from "./document-filter";
import { SearchField } from "./search-field";
import "./sidebar.css";

const FILTER_ICONS: Record<DocumentFilter, LucideIcon> = {
  all: Files,
  owned: UserRound,
  shared: Users,
};

interface SidebarProps {
  user: User;
  documents: DocumentSummary[];
  counts: Record<DocumentFilter, number>;
  filter: DocumentFilter;
  search: string;
  selectedId?: string;
  loading: boolean;
  busy: boolean;
  /** Drawer state below the tablet breakpoint; ignored on wide screens. */
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onHome: () => void;
  onSearch: (value: string) => void;
  onFilter: (filter: DocumentFilter) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onImport: () => void;
  onSignOut: () => void;
}

export function Sidebar({
  user,
  documents,
  counts,
  filter,
  search,
  selectedId,
  loading,
  busy,
  open,
  onOpen,
  onClose,
  onHome,
  onSearch,
  onFilter,
  onSelect,
  onCreate,
  onImport,
  onSignOut,
}: SidebarProps) {
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const main = panel?.parentElement?.querySelector("main");
    const previousFocus = document.activeElement as HTMLElement | null;
    const narrow = window.matchMedia("(max-width: 899px)");
    function synchronize() {
      if (main) main.inert = narrow.matches;
      if (narrow.matches) panel?.focus();
    }
    synchronize();
    narrow.addEventListener("change", synchronize);
    return () => {
      narrow.removeEventListener("change", synchronize);
      if (main) main.inert = false;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  return (
    <>
      <div
        className="sidebar-backdrop"
        data-open={open}
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        className="sidebar"
        data-open={open}
        aria-label="Workspace"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (open && event.key === "Escape") onClose();
          if (
            !open ||
            event.key !== "Tab" ||
            !window.matchMedia("(max-width: 899px)").matches
          )
            return;
          const controls = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
            ),
          ).filter((control) => control.getClientRects().length > 0);
          const first = controls[0];
          const last = controls.at(-1);
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === panelRef.current)
          ) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="sidebar__top">
          <div className="sidebar__head">
            <button
              type="button"
              className="sidebar__brand"
              onClick={onHome}
              aria-label="Folio, all documents"
            >
              <Brand />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon sidebar__close"
              onClick={onClose}
              aria-label="Close navigation"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <SearchField
            value={search}
            onChange={onSearch}
            onShortcut={() => {
              // Matches the drawer breakpoint in globals.css.
              if (window.matchMedia("(max-width: 899px)").matches) onOpen();
            }}
          />
          <div className="sidebar__actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={onCreate}
              disabled={busy || loading}
            >
              <Plus size={16} aria-hidden="true" />
              New document
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              onClick={onImport}
              disabled={busy || loading}
              aria-label="Import a file"
              title="Import a .txt or .md file"
            >
              <Upload size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <nav className="sidebar__nav" aria-label="Document filters">
          {(Object.keys(FILTER_LABELS) as DocumentFilter[]).map((key) => {
            const Icon = FILTER_ICONS[key];
            const active = key === filter && !selectedId;
            return (
              <button
                key={key}
                type="button"
                className="sidebar__nav-item"
                aria-current={active ? "page" : undefined}
                onClick={() => onFilter(key)}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{FILTER_LABELS[key]}</span>
                <span className="sidebar__count">{counts[key]}</span>
              </button>
            );
          })}
        </nav>

        <section className="sidebar__documents" aria-labelledby="sidebar-docs">
          <h2 id="sidebar-docs" className="sidebar__label">
            Documents
          </h2>
          <DocumentList
            documents={documents}
            selectedId={selectedId}
            loading={loading}
            busy={busy}
            search={search}
            onSelect={onSelect}
          />
        </section>

        <div className="sidebar__account">
          <span
            className="avatar avatar-sm"
            style={{ background: user.color }}
            aria-hidden="true"
          >
            {user.initials}
          </span>
          <span className="sidebar__account-text">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            onClick={onSignOut}
            disabled={busy || loading}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={15} aria-hidden="true" />
          </button>
        </div>
      </aside>
    </>
  );
}
