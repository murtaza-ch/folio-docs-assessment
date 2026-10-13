"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Menu, Plus } from "lucide-react";
import { documentWordCount } from "@/lib/document-text";
import type { JSONContent } from "@tiptap/react";
import type {
  Document,
  DocumentSummary,
  RichTextDocument,
  User,
} from "@/lib/types";
import { AuthScreen } from "./auth-screen";
import { Brand } from "./brand";
import { DocumentActivity } from "./document-activity";
import { matchesFilter, type DocumentFilter } from "./document-filter";
import { DocumentHeader } from "./document-header";
import { DocumentHome } from "./document-home";
import { DocumentPage } from "./document-page";
import { DocumentPresence } from "./document-presence";
import { ImportDialog } from "./import-dialog";
import { Modal } from "./modal";
import type { SaveState } from "./save-status";
import { ShareDialog } from "./share-dialog";
import { Sidebar } from "./sidebar";
import { WorkspaceAlert } from "./workspace-alert";

type Draft = { title: string; content: RichTextDocument };

class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok)
    throw new RequestError(
      result.error || "Something went wrong. Please try again.",
      response.status,
    );
  return result;
}

/** Readable message for a failed request; network failures get a plain explanation. */
function errorMessage(cause: unknown, fallback: string) {
  if (cause instanceof TypeError)
    return "You appear to be offline. Check your connection and try again.";
  return cause instanceof Error ? cause.message : fallback;
}

export function Workspace() {
  const [user, setUser] = useState<User | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activelyEditing, setActivelyEditing] = useState(false);
  const [remoteNotice, setRemoteNotice] = useState(false);
  const sessionUserId = useRef<string | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [document, setDocument] = useState<Document | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState<DocumentFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [importOpen, setImportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [reloadConfirm, setReloadConfirm] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
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
    setActivelyEditing(false);
    setRemoteNotice(false);
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
          if (!response.ok) {
            if (response.status === 401) setUser(null);
            throw new Error(result.error || "Your changes could not be saved.");
          }
          documentRef.current = result.document;
          setDocument(result.document);
          updateSummary(result.document);
          if (revisionRef.current === revision) dirtyRef.current = false;
        } catch (cause) {
          setSaveState("error");
          setError(
            errorMessage(cause, "Your changes could not be saved. Try again."),
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
        const session = await request<{ user: User | null }>("/api/session");
        if (!active) return;
        if (!session.user) return;
        sessionUserId.current = session.user.id;
        setUser(session.user);
        const data = await request<{ documents: DocumentSummary[] }>(
          "/api/documents",
        );
        if (!active) return;
        setDocuments(data.documents);
      } catch (cause) {
        if (active)
          setError(errorMessage(cause, "Could not open your workspace."));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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
    setActivelyEditing(true);
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
      setError(errorMessage(cause, "Could not open this document."));
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
      setError(errorMessage(cause, "Could not create a document."));
    } finally {
      setBusy(false);
    }
  }

  async function authenticated(nextUser: User) {
    // An expired session must not silently replace a different user's draft.
    if (
      dirtyRef.current &&
      sessionUserId.current &&
      sessionUserId.current !== nextUser.id
    ) {
      await request("/api/auth/sign-out", { method: "POST" });
      throw new Error(
        "Your previous account has unsaved writing. Sign back in to that account to keep it.",
      );
    }
    const resumeDraft =
      dirtyRef.current && sessionUserId.current === nextUser.id;
    sessionUserId.current = nextUser.id;
    setUser(nextUser);
    setLoading(true);
    setError("");
    try {
      const data = await request<{ documents: DocumentSummary[] }>(
        "/api/documents",
      );
      setDocuments(data.documents);
      if (resumeDraft) {
        await flush();
        return;
      }
      documentRef.current = null;
      draftRef.current = null;
      setDocument(null);
      setDraft(null);
      setFilter("all");
      setSearch("");
      setSaveState("saved");
    } catch (cause) {
      setError(errorMessage(cause, "Could not load your documents."));
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      if (!(await flush())) return;
      await request("/api/auth/sign-out", { method: "POST" });
      setUser(null);
      setDocuments([]);
      setDocument(null);
      setDraft(null);
      documentRef.current = null;
      draftRef.current = null;
      sessionUserId.current = null;
      setActivityOpen(false);
      setShareOpen(false);
      setImportOpen(false);
      setActivelyEditing(false);
      setRemoteNotice(false);
      setError("");
    } catch (cause) {
      setError(errorMessage(cause, "Could not sign out. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!activelyEditing) return;
    const timer = setTimeout(() => setActivelyEditing(false), 5000);
    return () => clearTimeout(timer);
  }, [draft, activelyEditing]);

  const remoteUpdate = useCallback(
    async (version: number) => {
      const current = documentRef.current;
      if (!current || current.version === version || busy) return;
      if (dirtyRef.current || savePromise.current || conflictRef.current) {
        setRemoteNotice(true);
        return;
      }
      try {
        const data = await request<{ document: Document }>(
          `/api/documents/${current.id}`,
        );
        // Check again after the request so typing or navigation cannot be overwritten.
        if (
          documentRef.current?.id !== current.id ||
          dirtyRef.current ||
          savePromise.current
        )
          return;
        if (data.document.version > documentRef.current.version) {
          openDocument(data.document);
          updateSummary(data.document);
        }
      } catch (cause) {
        if (cause instanceof RequestError && cause.status === 401)
          setUser(null);
      }
    },
    [busy, openDocument, updateSummary],
  );

  async function showActivity() {
    if (busy) return;
    setBusy(true);
    try {
      if (await flush()) setActivityOpen(true);
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
      setError(errorMessage(cause, "Could not save a copy."));
    } finally {
      setBusy(false);
    }
  }
  const filtered = documents.filter(
    (item) =>
      matchesFilter(item, filter) &&
      `${item.title} ${item.excerpt}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const ownedCount = documents.filter((item) => item.role === "owner").length;
  const counts: Record<DocumentFilter, number> = {
    all: documents.length,
    owned: ownedCount,
    shared: documents.length - ownedCount,
  };
  const wordCount = draft ? documentWordCount(draft.content) : 0;

  function closeNav() {
    setNavOpen(false);
    menuButtonRef.current?.focus();
  }
  function chooseFilter(next: DocumentFilter) {
    setFilter(next);
    setNavOpen(false);
    void backToDocuments();
  }
  function goHome() {
    setNavOpen(false);
    void backToDocuments();
  }
  function navigateTo(id: string) {
    setNavOpen(false);
    void selectDocument(id);
  }
  function startDocument() {
    setNavOpen(false);
    void createDocument();
  }
  function startImport() {
    setNavOpen(false);
    void showImport();
  }
  function reloadLatest() {
    if (conflictRef.current) setReloadConfirm(true);
  }

  if (!user && loading)
    return (
      <main className="session-loading" role="status">
        <span className="spinner" aria-hidden="true" />
        Loading workspace…
      </main>
    );
  if (!user) return <AuthScreen onAuthenticated={authenticated} />;
  return (
    <div className="app">
      <Sidebar
        user={user}
        documents={filtered}
        counts={counts}
        filter={filter}
        search={search}
        selectedId={document?.id}
        loading={loading}
        busy={busy}
        open={navOpen}
        onOpen={() => setNavOpen(true)}
        onClose={closeNav}
        onHome={goHome}
        onSearch={setSearch}
        onFilter={chooseFilter}
        onSelect={navigateTo}
        onCreate={startDocument}
        onImport={startImport}
        onSignOut={signOut}
      />
      <main className="main" aria-busy={busy}>
        {document && draft ? (
          <DocumentHeader
            documentId={document.id}
            title={draft.title}
            role={document.role}
            saveState={saveState}
            busy={busy}
            presence={
              <DocumentPresence
                documentId={document.id}
                currentUserId={user.id}
                editing={activelyEditing && document.role !== "viewer"}
                enabled={!busy}
                onRemoteUpdate={remoteUpdate}
              />
            }
            onBack={backToDocuments}
            onActivity={showActivity}
            onShare={showShare}
            beforeExport={flush}
          />
        ) : (
          <header className="mobile-bar">
            <button
              ref={menuButtonRef}
              type="button"
              className="btn btn-ghost btn-icon"
              aria-label="Open navigation"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
            >
              <Menu size={18} aria-hidden="true" />
            </button>
            <Brand />
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              aria-label="New document"
              onClick={createDocument}
              disabled={busy || loading}
            >
              <Plus size={18} aria-hidden="true" />
            </button>
          </header>
        )}
        {error && (
          <WorkspaceAlert
            tone={saveState === "conflict" ? "warning" : "danger"}
            message={error}
          >
            {saveState === "error" && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => flush()}
                >
                  Retry save
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={keepCopy}
                  disabled={busy}
                >
                  Save a copy
                </button>
              </>
            )}
            {saveState === "conflict" && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={keepCopy}
                  disabled={busy}
                >
                  Save my writing as a copy
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={reloadLatest}
                  disabled={busy}
                >
                  Reload latest
                </button>
              </>
            )}
          </WorkspaceAlert>
        )}
        <div className="main__scroll">
          {document && draft ? (
            <DocumentPage
              key={document.id}
              document={document}
              title={draft.title}
              content={draft.content}
              wordCount={wordCount}
              busy={busy}
              remoteNotice={remoteNotice}
              onTitleChange={(title) =>
                draftRef.current && edit({ ...draftRef.current, title })
              }
              onTitleBlur={() => {
                if (draftRef.current && !draftRef.current.title.trim())
                  edit({ ...draftRef.current, title: "Untitled document" });
              }}
              onContentChange={(content: JSONContent) => {
                if (draftRef.current)
                  edit({
                    ...draftRef.current,
                    content: content as RichTextDocument,
                  });
              }}
            />
          ) : (
            <DocumentHome
              documents={filtered}
              filter={filter}
              search={search}
              loading={loading}
              busy={busy}
              onOpen={selectDocument}
              onCreate={createDocument}
              onImport={showImport}
              onClearSearch={() => setSearch("")}
            />
          )}
        </div>
      </main>
      {reloadConfirm && saveState === "conflict" && (
        <Modal
          title="Reload latest version?"
          description="Your unsaved changes will be discarded. Save a copy first if you want to keep them."
          onClose={() => setReloadConfirm(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                autoFocus
                onClick={() => setReloadConfirm(false)}
              >
                Keep editing
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  if (conflictRef.current) openDocument(conflictRef.current);
                  setReloadConfirm(false);
                }}
              >
                Reload latest
              </button>
            </>
          }
        />
      )}
      {activityOpen && document && user && (
        <DocumentActivity
          document={document}
          user={user}
          onClose={() => setActivityOpen(false)}
          beforeRestore={flush}
          onRestored={(next) => {
            openDocument(next);
            updateSummary(next);
            setActivityOpen(false);
          }}
        />
      )}
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
    </div>
  );
}
