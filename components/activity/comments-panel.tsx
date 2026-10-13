import { useState, type KeyboardEvent } from "react";
import { MessageSquare, RefreshCw } from "lucide-react";
import type { Role, User } from "@/lib/types";
import type { DocumentComment } from "@/lib/collaboration-types";
import { Spinner } from "../feedback";
import { CommentCard, type CommentMode } from "./comment-card";
import type { CommentChange, CommentsData } from "./use-comments";
import type { ActivityTask } from "./use-activity-task";

const MAX_LENGTH = 2000;
const isApplePlatform = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);

export function CommentsPanel({
  data,
  user,
  role,
  task,
}: {
  data: CommentsData;
  user: User;
  role: Role;
  task: ActivityTask;
}) {
  const { busy, run } = task;
  const [draft, setDraft] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  // Only one comment can be edited or pending deletion at a time.
  const [activeComment, setActiveComment] = useState<{
    id: string;
    mode: CommentMode;
  } | null>(null);

  const permissions = (comment: DocumentComment) => {
    const canEdit = comment.author.id === user.id || role === "owner";
    return { canEdit, canResolve: canEdit || role === "editor" };
  };
  async function refresh() {
    await data.reload();
    setActiveComment((value) => (value?.mode === "deleting" ? null : value));
  }
  const post = () =>
    run(async () => {
      await data.create(draft.trim());
      setDraft("");
      await refresh();
    });
  const update = (id: string, change: CommentChange) =>
    run(async () => {
      await data.update(id, change);
      setActiveComment(null);
      await refresh();
    });
  function remove(comment: DocumentComment) {
    const confirmed =
      activeComment?.id === comment.id && activeComment.mode === "deleting";
    if (!confirmed || !permissions(comment).canEdit) return;
    void run(async () => {
      await data.remove(comment.id);
      await refresh();
    });
  }

  const visible = data.comments.filter(
    (comment) => showResolved || !comment.resolvedAt,
  );
  const resolvedCount = data.comments.filter((c) => c.resolvedAt).length;

  return (
    <div className="comments-panel">
      <CommentComposer
        value={draft}
        onChange={setDraft}
        onSubmit={post}
        busy={busy}
      />
      <div className="comments-toolbar">
        <label className="activity-check">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(event) => {
              setShowResolved(event.target.checked);
              setActiveComment((value) =>
                value?.mode === "deleting" ? null : value,
              );
            }}
          />
          Show resolved
          {resolvedCount > 0 && <span className="badge">{resolvedCount}</span>}
        </label>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => run(refresh)}
          disabled={busy}
        >
          <RefreshCw size={14} aria-hidden />
          Refresh
        </button>
      </div>
      <div className="comments-feed">
        {data.loading ? (
          <p className="activity-status" role="status">
            <Spinner />
            Loading comments…
          </p>
        ) : visible.length === 0 ? (
          <EmptyComments hasHidden={data.comments.length > 0} />
        ) : (
          visible.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              mode={
                activeComment?.id === comment.id ? activeComment.mode : "view"
              }
              {...permissions(comment)}
              busy={busy}
              onModeChange={(mode) =>
                setActiveComment(
                  mode === "view" ? null : { id: comment.id, mode },
                )
              }
              onSave={(body) => update(comment.id, { body })}
              onToggleResolved={() =>
                update(comment.id, { resolved: !comment.resolvedAt })
              }
              onDelete={() => remove(comment)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CommentComposer({
  value,
  onChange,
  onSubmit,
  busy,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  const hasText = value.trim().length > 0;
  const canPost = !busy && hasText;
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (canPost) onSubmit();
    }
  }
  return (
    <div className="comment-composer">
      <label className="visually-hidden" htmlFor="new-comment">
        New comment
      </label>
      <textarea
        id="new-comment"
        placeholder="Add a comment…"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        maxLength={MAX_LENGTH}
        disabled={busy}
        rows={3}
      />
      <div className="comment-composer-footer">
        <span className="comment-hint">
          <kbd>{isApplePlatform() ? "⌘" : "Ctrl"}</kbd>
          <kbd>Enter</kbd>
          <span className="comment-hint-label">to post</span>
          {value.length > MAX_LENGTH * 0.8 && (
            <span className="comment-count">
              {value.length.toLocaleString("en")}/
              {MAX_LENGTH.toLocaleString("en")}
            </span>
          )}
        </span>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!canPost}
          onClick={onSubmit}
        >
          {busy && hasText && <Spinner />}
          Comment
        </button>
      </div>
    </div>
  );
}

function EmptyComments({ hasHidden }: { hasHidden: boolean }) {
  return (
    <div className="activity-empty">
      <span className="activity-empty-icon" aria-hidden>
        <MessageSquare size={18} />
      </span>
      <strong>{hasHidden ? "No open comments" : "No comments yet"}</strong>
      <p>
        {hasHidden
          ? "Resolved comments are hidden. Turn on “Show resolved” to see them."
          : "Questions and feedback on this document will appear here."}
      </p>
    </div>
  );
}
