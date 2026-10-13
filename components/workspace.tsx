"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Flex, Input } from "@chakra-ui/react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  Cloud,
  FileText,
  FolderOpen,
  LockKeyhole,
  Plus,
  Search,
  Share2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { documentWordCount } from "@/lib/document-text";
import type { JSONContent } from "@tiptap/react";
import type {
  Document,
  DocumentSummary,
  RichTextDocument,
  User,
} from "@/lib/types";
import { DocumentEditor } from "./document-editor";
import { DocumentList, relativeDate } from "./document-list";
import { ImportDialog } from "./import-dialog";
import { ShareDialog } from "./share-dialog";

type SaveState = "saved" | "unsaved" | "saving" | "error" | "conflict";
type Draft = { title: string; content: RichTextDocument };

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Something went wrong. Please try again.");
  return result;
}

export function Workspace() {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [document, setDocument] = useState<Document | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [importOpen, setImportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const documentRef = useRef<Document | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const dirtyRef = useRef(false);
  const revisionRef = useRef(0);
  const conflictRef = useRef<Document | null>(null);
  const savePromise = useRef<Promise<boolean> | null>(null);

  const updateSummary = useCallback((next: Document) => {
    setDocuments((current) =>
      [next, ...current.filter((item) => item.id !== next.id)].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      ),
    );
  }, []);

  const openDocument = useCallback((next: Document) => {
    documentRef.current = next;
    const nextDraft = { title: next.title, content: next.content };
    draftRef.current = nextDraft;
    dirtyRef.current = false;
    conflictRef.current = null;
    setDocument(next);
    setDraft(nextDraft);
    setSaveState("saved");
    setError("");
  }, []);

  const flush = useCallback(async (): Promise<boolean> => {
    if (conflictRef.current) return false;
    if (savePromise.current) return savePromise.current;
    if (!dirtyRef.current || !documentRef.current || !draftRef.current)
      return true;
    const operation = (async () => {
      while (dirtyRef.current && documentRef.current && draftRef.current) {
        const current = documentRef.current;
        const snapshot = draftRef.current;
        const revision = revisionRef.current;
        setSaveState("saving");
        try {
          const response = await fetch(`/api/documents/${current.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...snapshot,
              title: snapshot.title.trim() || "Untitled document",
              version: current.version,
            }),
          });
          const result = await response.json();
          if (response.status === 409 && result.document) {
            conflictRef.current = result.document;
            setSaveState("conflict");
            setError(
              "This document changed elsewhere. Your writing is still here. Save a copy or reload the latest version.",
            );
            return false;
          }
          if (!response.ok)
            throw new Error(result.error || "Your changes could not be saved.");
          documentRef.current = result.document;
          setDocument(result.document);
          updateSummary(result.document);
          if (revisionRef.current === revision) dirtyRef.current = false;
        } catch (cause) {
          setSaveState("error");
          setError(
            cause instanceof Error
              ? cause.message
              : "Your changes could not be saved. Try again.",
          );
          return false;
        }
      }
      setSaveState("saved");
      setError("");
      return true;
    })();
    savePromise.current = operation;
    try {
      return await operation;
    } finally {
      savePromise.current = null;
    }
  }, [updateSummary]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const session = await request<{ user: User; users: User[] }>(
          "/api/session",
        );
        if (!active) return;
        setUser(session.user);
        setUsers(session.users);
        const data = await request<{ documents: DocumentSummary[] }>(
          "/api/documents",
        );
        if (!active) return;
        setDocuments(data.documents);
        if (data.documents[0]) {
          const detail = await request<{ document: Document }>(
            `/api/documents/${data.documents[0].id}`,
          );
          if (active) openDocument(detail.document);
        }
      } catch (cause) {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not open your workspace.",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [openDocument]);

  useEffect(() => {
    if (!dirtyRef.current || conflictRef.current) return;
    const timer = setTimeout(() => {
      void flush();
    }, 700);
    return () => clearTimeout(timer);
  }, [draft, flush]);

  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void flush();
      }
    };
    window.addEventListener("beforeunload", protect);
    window.addEventListener("keydown", shortcut);
    return () => {
      window.removeEventListener("beforeunload", protect);
      window.removeEventListener("keydown", shortcut);
    };
  }, [flush]);

  function edit(next: Draft) {
    if (documentRef.current?.role === "viewer") return;
    draftRef.current = next;
    dirtyRef.current = true;
    revisionRef.current += 1;
    setDraft(next);
    if (!conflictRef.current) setSaveState("unsaved");
  }

  async function selectDocument(id: string) {
    if (id === documentRef.current?.id || busy) return;
    setBusy(true);
    try {
      if (!(await flush())) return;
      const data = await request<{ document: Document }>(
        `/api/documents/${id}`,
      );
      openDocument(data.document);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not open this document.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createDocument() {
    if (busy || loading || !user) return;
    setBusy(true);
    try {
      if (!(await flush())) return;
      const data = await request<{ document: Document }>("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled document" }),
      });
      updateSummary(data.document);
      openDocument(data.document);
      setFilter("all");
      setSearch("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create a document.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeUser(userId: string) {
    if (busy || userId === user?.id) return;
    setBusy(true);
    try {
      if (!(await flush())) return;
      const session = await request<{ user: User; users: User[] }>(
        "/api/session",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        },
      );
      setUser(session.user);
      setUsers(session.users);
      setFilter("all");
      setSearch("");
      setDocuments([]);
      setSaveState("saved");
      documentRef.current = null;
      draftRef.current = null;
      setDocument(null);
      setDraft(null);
      setError("");
      const data = await request<{ documents: DocumentSummary[] }>(
        "/api/documents",
      );
      setDocuments(data.documents);
      if (data.documents[0])
        openDocument(
          (
            await request<{ document: Document }>(
              `/api/documents/${data.documents[0].id}`,
            )
          ).document,
        );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not switch accounts.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function showImport() {
    if (busy) return;
    setBusy(true);
    try {
      if (await flush()) setImportOpen(true);
    } finally {
      setBusy(false);
    }
  }
  async function showShare() {
    if (busy) return;
    setBusy(true);
    try {
      if (await flush()) setShareOpen(true);
    } finally {
      setBusy(false);
    }
  }
  async function backToDocuments() {
    if (!(await flush())) return;
    documentRef.current = null;
    draftRef.current = null;
    setDocument(null);
    setDraft(null);
  }
  async function keepCopy() {
    if (!draftRef.current || busy) return;
    setBusy(true);
    try {
      const data = await request<{ document: Document }>("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draftRef.current,
          title: `${draftRef.current.title || "Untitled document"} (copy)`,
        }),
      });
      openDocument(data.document);
      updateSummary(data.document);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save a copy.",
      );
    } finally {
      setBusy(false);
    }
  }
  const filtered = documents.filter(
    (item) =>
      (filter === "all" ||
        (filter === "owned" ? item.role === "owner" : item.role !== "owner")) &&
      `${item.title} ${item.excerpt}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const ownedCount = documents.filter((item) => item.role === "owner").length;
  const wordCount = draft ? documentWordCount(draft.content) : 0;

  return (
    <Flex className={`workspace ${document ? "document-open" : ""}`}>
      <Box as="aside" className="sidebar">
        <a
          className="brand"
          href="/"
          aria-label="Folio home"
          onClick={(event) => {
            event.preventDefault();
            void backToDocuments();
          }}
        >
          <span className="brand-mark">
            <span />
            <span />
            <span />
          </span>
          folio<span className="brand-period">.</span>
        </a>
        <div className="workspace-label">PERSONAL WORKSPACE</div>
        <Button
          className="new-document-button"
          onClick={createDocument}
          disabled={busy || loading || !user}
        >
          <Plus size={18} />
          New document
        </Button>
        <nav className="main-nav" aria-label="Workspace navigation">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            <FolderOpen size={18} />
            All documents<span>{documents.length}</span>
          </button>
          <button
            className={filter === "owned" ? "active" : ""}
            onClick={() => setFilter("owned")}
          >
            <FileText size={18} />
            Owned by me<span>{ownedCount}</span>
          </button>
          <button
            className={filter === "shared" ? "active" : ""}
            onClick={() => setFilter("shared")}
          >
            <Users size={18} />
            Shared with me<span>{documents.length - ownedCount}</span>
          </button>
        </nav>
        <div className="sidebar-divider" />
        <button
          className="import-nav"
          onClick={showImport}
          disabled={busy || loading || !user}
        >
          <Upload size={17} />
          Import document
          <ArrowUpRight size={14} />
        </button>
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <span className="note-line" />
            <p>
              A little space.
              <br />A lot of possibility.
            </p>
          </div>
          <div className="account">
            <span
              className="avatar"
              style={{ background: user?.color || "#d9dce4" }}
            >
              {user?.initials || "..."}
            </span>
            <div>
              <strong>{user?.name || "Opening workspace"}</strong>
              <span>Demo account</span>
            </div>
            <ChevronDown size={14} />
            <select
              aria-label="Switch demo account"
              value={user?.id || ""}
              onChange={(event) => changeUser(event.target.value)}
              disabled={busy || loading}
            >
              {!user && <option value="">Loading account</option>}
              {users.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Box>
      <Box as="main" className="main-workspace">
        <Flex
          className="workspace-header"
          align="center"
          justify="space-between"
        >
          <div className="header-path">
            <span>Workspace</span>
            <span className="path-slash">/</span>
            <strong>Documents</strong>
          </div>
          <div className="search-field">
            <Search size={16} />
            <Input
              aria-label="Search documents"
              placeholder="Search your documents"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              variant="flushed"
            />
            {search && (
              <button onClick={() => setSearch("")} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </div>
          <select
            className="mobile-filter"
            aria-label="Filter documents"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">All documents</option>
            <option value="owned">Owned by me</option>
            <option value="shared">Shared with me</option>
          </select>
          <span className="header-private">
            <LockKeyhole size={13} />
            Private by default
          </span>
        </Flex>
        {error && (
          <div
            className={`workspace-error ${saveState === "conflict" ? "conflict" : ""}`}
            role="alert"
          >
            <span>{error}</span>
            {saveState === "error" && (
              <>
                <Button size="xs" variant="outline" onClick={() => flush()}>
                  Retry save
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={keepCopy}
                  disabled={busy}
                >
                  Save a copy
                </Button>
              </>
            )}
            {saveState === "conflict" && (
              <>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={keepCopy}
                  disabled={busy}
                >
                  Save my writing as a copy
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    if (
                      conflictRef.current &&
                      window.confirm(
                        "Reload the latest version? Your unsaved changes in this document will be discarded.",
                      )
                    )
                      openDocument(conflictRef.current);
                  }}
                  disabled={busy}
                >
                  Reload latest
                </Button>
              </>
            )}
          </div>
        )}
        <div className="workspace-body">
          <DocumentList
            documents={filtered}
            selectedId={document?.id}
            onSelect={selectDocument}
            onCreate={createDocument}
            loading={loading}
            busy={busy}
            search={search}
            filter={filter}
          />
          <section
            className="writing-area"
            aria-label="Document workspace"
            aria-busy={busy}
          >
            {document && draft ? (
              <>
                <div className="document-topbar">
                  <div className="document-breadcrumb">
                    <button
                      className="mobile-back"
                      aria-label="Back to documents"
                      onClick={backToDocuments}
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <FileText size={15} />
                    <span>{draft.title || "Untitled document"}</span>
                  </div>
                  <div className="document-actions">
                    <span
                      className={`save-status ${saveState}`}
                      aria-live="polite"
                    >
                      {document.role === "viewer" ? (
                        <>
                          <LockKeyhole size={13} />
                          View only
                        </>
                      ) : saveState === "saved" ? (
                        <>
                          <Check size={14} />
                          All changes saved
                        </>
                      ) : saveState === "saving" ? (
                        <>
                          <Cloud size={14} />
                          Saving...
                        </>
                      ) : saveState === "unsaved" ? (
                        "Unsaved changes"
                      ) : saveState === "conflict" ? (
                        "Changes need review"
                      ) : (
                        "Not saved"
                      )}
                    </span>
                    {document.role === "owner" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="share-button"
                        onClick={showShare}
                        disabled={busy}
                      >
                        <Share2 size={14} />
                        Share
                      </Button>
                    )}
                  </div>
                </div>
                <div className="document-scroll">
                  <div className="document-cover">
                    <span className="document-kicker">
                      {document.role === "owner"
                        ? "YOUR DOCUMENT"
                        : "SHARED DOCUMENT"}
                    </span>
                    <Input
                      className="document-title"
                      aria-label="Document title"
                      value={draft.title}
                      placeholder="Untitled document"
                      onChange={(event) =>
                        draftRef.current &&
                        edit({ ...draftRef.current, title: event.target.value })
                      }
                      maxLength={160}
                      onBlur={() => {
                        if (draftRef.current && !draftRef.current.title.trim())
                          edit({
                            ...draftRef.current,
                            title: "Untitled document",
                          });
                      }}
                      readOnly={document.role === "viewer" || busy}
                      variant="flushed"
                    />
                    <div className="document-meta">
                      <span
                        className="mini-avatar"
                        style={{ background: document.owner.color }}
                      >
                        {document.owner.initials}
                      </span>
                      <span>{document.owner.name}</span>
                      <span className="meta-dot">·</span>
                      <span>
                        Updated {relativeDate(document.updatedAt).toLowerCase()}
                      </span>
                      <span className="meta-dot">·</span>
                      <span>
                        {wordCount} {wordCount === 1 ? "word" : "words"}
                      </span>
                    </div>
                  </div>
                  <DocumentEditor
                    key={document.id}
                    content={draft.content}
                    onChange={(content: JSONContent) => {
                      if (draftRef.current)
                        edit({
                          ...draftRef.current,
                          content: content as RichTextDocument,
                        });
                    }}
                    editable={document.role !== "viewer"}
                    disabled={busy}
                  />
                </div>
              </>
            ) : (
              <div className="welcome-state">
                <span className="welcome-illustration">
                  <FileText size={45} strokeWidth={1.1} />
                  <span />
                </span>
                <span className="document-kicker">MAKE ROOM FOR AN IDEA</span>
                <h1>
                  Your next chapter
                  <br />
                  starts here.
                </h1>
                <p>
                  A place to write, think, and work together.
                  <br />
                  Open a document, or start with a blank page.
                </p>
                <Button
                  className="primary-button"
                  onClick={createDocument}
                  disabled={busy || loading || !user}
                >
                  <Plus size={17} />
                  Create a document
                </Button>
                <button
                  className="welcome-import"
                  onClick={showImport}
                  disabled={busy || loading || !user}
                >
                  Or import something you have written{" "}
                  <ArrowUpRight size={14} />
                </button>
              </div>
            )}
          </section>
        </div>
      </Box>
      {importOpen && (
        <ImportDialog
          onClose={() => setImportOpen(false)}
          onImported={(next) => {
            updateSummary(next);
            openDocument(next);
            setImportOpen(false);
            setFilter("all");
            setSearch("");
          }}
        />
      )}
      {shareOpen && document && (
        <ShareDialog
          document={document}
          onClose={() => setShareOpen(false)}
          onChanged={() => {
            request<{ documents: DocumentSummary[] }>("/api/documents")
              .then((data) => setDocuments(data.documents))
              .catch((cause) => setError(cause.message));
          }}
        />
      )}
    </Flex>
  );
}
