"use client";

import {
  createElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@chakra-ui/react";
import {
  Check,
  History,
  MessageSquare,
  Pencil,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import type { Document, RichTextNode, User } from "@/lib/types";
import type {
  DocumentComment,
  VersionSnapshot,
  VersionSummary,
} from "@/lib/collaboration-types";
import { Modal } from "./modal";
import "./activity.css";

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Could not complete this action.");
  return result;
}
const dateLabel = (value: string) =>
  new Date(value).toLocaleString("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export function DocumentActivity({
  document,
  user,
  onClose,
  onRestored,
  beforeRestore,
}: {
  document: Document;
  user: User;
  onClose: () => void;
  onRestored: (document: Document) => void;
  beforeRestore: () => Promise<boolean>;
}) {
  const [tab, setTab] = useState<"comments" | "history">("comments");
  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [currentVersion, setCurrentVersion] = useState(document.version);
  const [snapshot, setSnapshot] = useState<VersionSnapshot | null>(null);
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedBody, setEditedBody] = useState("");
  const [restoreVersion, setRestoreVersion] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const previewRequest = useRef(0);
  const base = `/api/documents/${document.id}`;

  useEffect(() => {
    setRestoreVersion(null);
    setDeletingId(null);
  }, [base, tab, document.role, user.id, showResolved]);
  useEffect(() => {
    previewRequest.current += 1;
    setSnapshot(null);
    setPreviewLoading(false);
  }, [base]);

  async function loadComments() {
    const result = await api<{ comments: DocumentComment[] }>(
      `${base}/comments`,
    );
    setComments(result.comments);
    setDeletingId(null);
  }
  async function loadVersions() {
    const result = await api<{
      versions: VersionSummary[];
      currentVersion: number;
    }>(`${base}/versions`);
    setVersions(result.versions);
    setCurrentVersion(result.currentVersion);
  }
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const path = tab === "comments" ? `${base}/comments` : `${base}/versions`;
    api<{
      comments?: DocumentComment[];
      versions?: VersionSummary[];
      currentVersion?: number;
    }>(path)
      .then((result) => {
        if (!active) return;
        if (result.comments) setComments(result.comments);
        if (result.versions) {
          setVersions(result.versions);
          setCurrentVersion(result.currentVersion!);
        }
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [base, tab]);

  async function action(callback: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await callback();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not complete this action.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function post() {
    await action(async () => {
      await api(`${base}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      setBody("");
      await loadComments();
    });
  }
  async function update(
    id: string,
    value: { body?: string; resolved?: boolean },
  ) {
    await action(async () => {
      await api(`${base}/comments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      setEditingId(null);
      await loadComments();
    });
  }
  async function remove(id: string) {
    const comment = comments.find((value) => value.id === id);
    if (
      deletingId !== id ||
      !comment ||
      (comment.author.id !== user.id && document.role !== "owner")
    )
      return;
    await action(async () => {
      await api(`${base}/comments/${id}`, { method: "DELETE" });
      await loadComments();
    });
  }
  async function preview(version: number) {
    setRestoreVersion(null);
    const sequence = ++previewRequest.current;
    setPreviewLoading(true);
    setError("");
    try {
      const result = await api<{ snapshot: VersionSnapshot }>(
        `${base}/versions/${version}`,
      );
      if (sequence === previewRequest.current) setSnapshot(result.snapshot);
    } catch (cause) {
      if (sequence === previewRequest.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not open this version.",
        );
    } finally {
      if (sequence === previewRequest.current) setPreviewLoading(false);
    }
  }
  async function restore() {
    if (
      !snapshot ||
      restoreVersion !== snapshot.version ||
      snapshot.version === currentVersion ||
      document.role === "viewer"
    )
      return;
    await action(async () => {
      if (!(await beforeRestore())) {
        setError(
          "Save or recover your current draft before restoring a version.",
        );
        return;
      }
      const latest = await api<{ document: Document }>(base);
      const restored = await api<{ document: Document }>(
        `${base}/versions/${snapshot.version}/restore`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: latest.document.version }),
        },
      );
      onRestored(restored.document);
      onClose();
    });
  }
  const visibleComments = comments.filter(
    (comment) => showResolved || !comment.resolvedAt,
  );
  const openCount = comments.filter((comment) => !comment.resolvedAt).length;
  function tabKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (busy || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
      return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? "comments"
        : event.key === "End"
          ? "history"
          : tab === "comments"
            ? "history"
            : "comments";
    setTab(next);
    event.currentTarget
      .querySelector<HTMLButtonElement>(
        `#${next === "comments" ? "comments" : "history"}-tab`,
      )
      ?.focus();
  }
  return (
    <Modal
      title="Document activity"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="document-activity">
        <p className="modal-description activity-document-title">
          {document.title}
        </p>
        <div
          className="activity-tabs"
          role="tablist"
          aria-label="Document activity"
          onKeyDown={tabKey}
        >
          <button
            role="tab"
            id="comments-tab"
            tabIndex={tab === "comments" ? 0 : -1}
            aria-selected={tab === "comments"}
            aria-controls="activity-comments"
            className={tab === "comments" ? "active" : ""}
            onClick={() => setTab("comments")}
            disabled={busy}
          >
            <MessageSquare size={15} />
            Comments
          </button>
          <button
            role="tab"
            id="history-tab"
            tabIndex={tab === "history" ? 0 : -1}
            aria-selected={tab === "history"}
            aria-controls="activity-history"
            className={tab === "history" ? "active" : ""}
            onClick={() => setTab("history")}
            disabled={busy}
          >
            <History size={15} />
            Version history
          </button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {tab === "comments" ? (
          <section
            role="tabpanel"
            id="activity-comments"
            aria-labelledby="comments-tab"
          >
            <div className="comment-compose">
              <label htmlFor="new-comment">Add to the conversation</label>
              <textarea
                id="new-comment"
                aria-label="New comment"
                placeholder="Ask a question or leave some feedback..."
                value={body}
                onChange={(event) => setBody(event.target.value)}
                maxLength={2000}
                disabled={busy}
                rows={3}
              />
              <div>
                <span>{body.length}/2,000</span>
                <Button
                  size="sm"
                  className="primary-button"
                  disabled={!body.trim() || busy}
                  onClick={post}
                >
                  <Send size={13} />
                  Post comment
                </Button>
              </div>
            </div>
            <div className="activity-section-heading">
              <span>
                {openCount} open {openCount === 1 ? "comment" : "comments"}
              </span>
              <label>
                <input
                  type="checkbox"
                  checked={showResolved}
                  onChange={(event) => setShowResolved(event.target.checked)}
                />
                Show resolved
              </label>
              <button
                aria-label="Refresh comments"
                onClick={() => action(loadComments)}
                disabled={busy}
              >
                <RefreshCw size={13} />
              </button>
            </div>
            <div className="comment-feed">
              {loading ? (
                <p className="activity-empty" role="status">
                  Loading comments...
                </p>
              ) : visibleComments.length === 0 ? (
                <div className="activity-empty">
                  <MessageSquare size={25} />
                  <p>
                    {showResolved ? "No comments yet." : "No open comments."}
                  </p>
                  <span>Start a conversation about this document.</span>
                </div>
              ) : (
                visibleComments.map((comment) => {
                  const canEdit =
                    comment.author.id === user.id || document.role === "owner";
                  const canResolve = canEdit || document.role === "editor";
                  return (
                    <article
                      className={`comment-card ${comment.resolvedAt ? "resolved" : ""}`}
                      key={comment.id}
                    >
                      <div className="comment-author">
                        <span
                          className="avatar"
                          style={{ background: comment.author.color }}
                        >
                          {comment.author.initials}
                        </span>
                        <div>
                          <strong>{comment.author.name}</strong>
                          <time dateTime={comment.createdAt}>
                            {dateLabel(comment.createdAt)}
                            {comment.updatedAt ? " · edited" : ""}
                          </time>
                        </div>
                        {comment.resolvedAt && (
                          <span className="comment-resolved">
                            <Check size={12} />
                            Resolved
                          </span>
                        )}
                      </div>
                      {editingId === comment.id ? (
                        <div className="comment-edit">
                          <textarea
                            aria-label="Edit comment"
                            value={editedBody}
                            maxLength={2000}
                            onChange={(event) =>
                              setEditedBody(event.target.value)
                            }
                            disabled={busy}
                            rows={3}
                          />
                          <div>
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => setEditingId(null)}
                              disabled={busy}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="xs"
                              className="primary-button"
                              onClick={() =>
                                update(comment.id, { body: editedBody.trim() })
                              }
                              disabled={busy || !editedBody.trim()}
                            >
                              Save comment
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="comment-body">{comment.body}</p>
                      )}
                      <div className="comment-actions">
                        {canResolve && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              update(comment.id, {
                                resolved: !comment.resolvedAt,
                              })
                            }
                          >
                            {comment.resolvedAt ? (
                              <RotateCcw size={12} />
                            ) : (
                              <Check size={12} />
                            )}
                            {comment.resolvedAt ? "Reopen" : "Resolve"}
                          </button>
                        )}
                        {canEdit && (
                          <>
                            <button
                              disabled={busy}
                              onClick={() => {
                                setDeletingId(null);
                                setEditingId(comment.id);
                                setEditedBody(comment.body);
                              }}
                            >
                              <Pencil size={11} />
                              Edit
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => {
                                setEditingId(null);
                                setDeletingId(comment.id);
                              }}
                            >
                              <Trash2 size={11} />
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                      {deletingId === comment.id && canEdit && (
                        <div
                          className="activity-confirmation comment-delete-confirmation"
                          role="group"
                          aria-label="Confirm comment deletion"
                          aria-describedby={`delete-comment-${comment.id}`}
                        >
                          <p id={`delete-comment-${comment.id}`}>
                            Delete this comment permanently?
                          </p>
                          <div>
                            <Button
                              size="xs"
                              variant="outline"
                              autoFocus
                              disabled={busy}
                              onClick={() => setDeletingId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="xs"
                              colorPalette="red"
                              disabled={busy}
                              onClick={() => remove(comment.id)}
                            >
                              {busy ? "Deleting..." : "Delete comment"}
                            </Button>
                          </div>
                        </div>
                      )}
                      {comment.resolvedAt && (
                        <p className="resolved-by">
                          Resolved by{" "}
                          {comment.resolvedBy?.name || "a collaborator"}
                        </p>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </section>
        ) : (
          <section
            role="tabpanel"
            id="activity-history"
            aria-labelledby="history-tab"
          >
            <div className="activity-history-note">
              Saved changes become versions. Up to 50 previous versions are
              kept.
            </div>
            <div className="version-list">
              {loading ? (
                <p className="activity-empty" role="status">
                  Loading version history...
                </p>
              ) : (
                versions.map((version) => (
                  <button
                    className={`version-item ${snapshot?.version === version.version ? "selected" : ""}`}
                    key={version.version}
                    disabled={busy}
                    onClick={() => preview(version.version)}
                  >
                    <span className="version-number">v{version.version}</span>
                    <div>
                      <strong>{version.title}</strong>
                      <span>
                        {version.author.name} · {dateLabel(version.createdAt)}
                      </span>
                    </div>
                    <span className="version-status">
                      {version.version === currentVersion
                        ? "Current"
                        : `${version.wordCount} words`}
                    </span>
                  </button>
                ))
              )}
            </div>
            {previewLoading ? (
              <p className="activity-empty" role="status">
                Opening version...
              </p>
            ) : snapshot ? (
              <div className="history-preview">
                <div className="history-preview-heading">
                  <strong>Version {snapshot.version} preview</strong>
                  {snapshot.version !== currentVersion &&
                    document.role !== "viewer" &&
                    restoreVersion === null && (
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setRestoreVersion(snapshot.version)}
                      >
                        <RotateCcw size={12} />
                        {busy ? "Restoring..." : "Restore this version"}
                      </Button>
                    )}
                </div>
                {restoreVersion === snapshot.version &&
                  snapshot.version !== currentVersion &&
                  document.role !== "viewer" && (
                    <div
                      className="activity-confirmation restore-confirmation"
                      role="group"
                      aria-label={`Confirm restoring version ${snapshot.version}`}
                      aria-describedby="restore-version-description"
                    >
                      <p id="restore-version-description">
                        Restoring creates a new version. Your current saved
                        version stays in history.
                      </p>
                      <div>
                        <Button
                          size="xs"
                          variant="outline"
                          autoFocus
                          disabled={busy}
                          onClick={() => setRestoreVersion(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="xs"
                          className="primary-button"
                          disabled={busy}
                          onClick={restore}
                        >
                          {busy
                            ? "Restoring..."
                            : `Restore version ${snapshot.version}`}
                        </Button>
                      </div>
                    </div>
                  )}
                <h3>{snapshot.title}</h3>
                <div className="history-preview-content">
                  {snapshot.content.content.map((node, index) =>
                    previewNode(node, String(index)),
                  )}
                </div>
              </div>
            ) : (
              !loading && (
                <p className="history-select-note">
                  Choose a version to preview it.
                </p>
              )
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}

function previewNode(node: RichTextNode, key: string): ReactNode {
  if (node.type === "text") {
    let text: ReactNode = node.text;
    for (const [index, mark] of (node.marks || []).entries()) {
      const markKey = `${key}-${index}`;
      if (mark.type === "bold") text = <strong key={markKey}>{text}</strong>;
      if (mark.type === "italic") text = <em key={markKey}>{text}</em>;
      if (mark.type === "underline") text = <u key={markKey}>{text}</u>;
      if (mark.type === "strike") text = <s key={markKey}>{text}</s>;
      if (mark.type === "code") text = <code key={markKey}>{text}</code>;
      if (
        mark.type === "link" &&
        typeof mark.attrs?.href === "string" &&
        /^(https?:\/\/|mailto:)/i.test(mark.attrs.href)
      )
        text = (
          <a
            key={markKey}
            href={mark.attrs.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {text}
          </a>
        );
    }
    return <span key={key}>{text}</span>;
  }
  if (node.type === "hardBreak") return <br key={key} />;
  if (node.type === "horizontalRule") return <hr key={key} />;
  const tag =
    {
      paragraph: "p",
      bulletList: "ul",
      orderedList: "ol",
      listItem: "li",
      blockquote: "blockquote",
      codeBlock: "pre",
    }[node.type] ||
    (node.type === "heading"
      ? `h${Math.min(6, Math.max(1, Number(node.attrs?.level) || 1))}`
      : "div");
  return createElement(
    tag,
    {
      key,
      ...(node.type === "orderedList" && Number.isSafeInteger(node.attrs?.start)
        ? { start: Number(node.attrs?.start) }
        : {}),
    },
    (node.content || []).map((child, index) =>
      previewNode(child, `${key}-${index}`),
    ),
  );
}
