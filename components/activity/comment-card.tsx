import { useState, type KeyboardEvent } from "react";
import { Check, Pencil, RotateCcw, Trash2 } from "lucide-react";
import type { DocumentComment } from "@/lib/collaboration-types";
import { Spinner } from "../feedback";
import { fullDate, relativeTime } from "../date-format";

export type CommentMode = "view" | "editing" | "deleting";

export function CommentCard({
  comment,
  mode,
  canEdit,
  canResolve,
  busy,
  onModeChange,
  onSave,
  onToggleResolved,
  onDelete,
}: {
  comment: DocumentComment;
  mode: CommentMode;
  canEdit: boolean;
  canResolve: boolean;
  busy: boolean;
  onModeChange: (mode: CommentMode) => void;
  onSave: (body: string) => void;
  onToggleResolved: () => void;
  onDelete: () => void;
}) {
  const resolved = Boolean(comment.resolvedAt);
  return (
    <article className={`comment-card${resolved ? " is-resolved" : ""}`}>
      <span
        className="avatar avatar-sm"
        style={{ background: comment.author.color }}
        aria-hidden
      >
        {comment.author.initials}
      </span>
      <div className="comment-main">
        <header className="comment-meta">
          <strong>{comment.author.name}</strong>
          <time
            dateTime={comment.createdAt}
            title={fullDate(comment.createdAt)}
          >
            {relativeTime(comment.createdAt)}
          </time>
          {comment.updatedAt && <span>· edited</span>}
          {resolved && (
            <span className="badge badge-accent comment-resolved-badge">
              <Check size={12} aria-hidden />
              Resolved
            </span>
          )}
        </header>

        {mode === "editing" && canEdit ? (
          <CommentEditor
            initialBody={comment.body}
            busy={busy}
            onCancel={() => onModeChange("view")}
            onSave={onSave}
          />
        ) : (
          <p className="comment-body">{comment.body}</p>
        )}

        {resolved && (
          <p className="comment-resolved-by">
            Resolved by {comment.resolvedBy?.name || "a collaborator"}
          </p>
        )}

        {mode === "deleting" && canEdit ? (
          <DeleteConfirmation
            id={`delete-comment-${comment.id}`}
            busy={busy}
            onCancel={() => onModeChange("view")}
            onConfirm={onDelete}
          />
        ) : (
          mode !== "editing" &&
          (canResolve || canEdit) && (
            <div className="comment-actions">
              {canResolve && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy}
                  onClick={onToggleResolved}
                >
                  {resolved ? <RotateCcw size={14} /> : <Check size={14} />}
                  {resolved ? "Reopen" : "Resolve"}
                </button>
              )}
              {canEdit && (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    onClick={() => onModeChange("editing")}
                  >
                    <Pencil size={14} />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm comment-delete"
                    disabled={busy}
                    onClick={() => onModeChange("deleting")}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </>
              )}
            </div>
          )
        )}
      </div>
    </article>
  );
}

function CommentEditor({
  initialBody,
  busy,
  onCancel,
  onSave,
}: {
  initialBody: string;
  busy: boolean;
  onCancel: () => void;
  onSave: (body: string) => void;
}) {
  const [body, setBody] = useState(initialBody);
  const canSave = !busy && body.trim().length > 0;
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      // Cancel the edit without closing the surrounding dialog.
      event.preventDefault();
      onCancel();
    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (canSave) onSave(body.trim());
    }
  }
  return (
    <div className="comment-editor">
      <textarea
        className="field comment-textarea"
        aria-label="Edit comment"
        value={body}
        maxLength={2000}
        rows={3}
        autoFocus
        disabled={busy}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="activity-inline-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => onSave(body.trim())}
          disabled={!canSave}
        >
          Save
        </button>
      </div>
    </div>
  );
}

function DeleteConfirmation({
  id,
  busy,
  onCancel,
  onConfirm,
}: {
  id: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="activity-confirm is-danger"
      role="group"
      aria-label="Confirm comment deletion"
      aria-describedby={id}
    >
      <p id={id}>Delete this comment? This can’t be undone.</p>
      <div className="activity-inline-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          autoFocus
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy && <Spinner />}
          {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}
