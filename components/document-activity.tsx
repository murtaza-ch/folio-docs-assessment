"use client";

import { useState, type KeyboardEvent } from "react";
import type { Document, User } from "@/lib/types";
import { CommentsPanel } from "./activity/comments-panel";
import { useActivityTask } from "./activity/use-activity-task";
import { useComments } from "./activity/use-comments";
import { useVersionHistory } from "./activity/use-version-history";
import { VersionHistoryPanel } from "./activity/version-history-panel";
import { InlineAlert } from "./feedback";
import { Modal } from "./modal";
import "./activity.css";

type Tab = "comments" | "history";
const TABS: { id: Tab; label: string }[] = [
  { id: "comments", label: "Comments" },
  { id: "history", label: "Version history" },
];

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
  const [tab, setTab] = useState<Tab>("comments");
  const task = useActivityTask();
  const documentPath = `/api/documents/${document.id}`;
  const comments = useComments(documentPath, tab === "comments", task.setError);
  const history = useVersionHistory(
    documentPath,
    document.version,
    tab === "history",
    task.setError,
  );

  function restore(version: number) {
    if (document.role === "viewer" || version === history.currentVersion)
      return;
    void task.run(async () => {
      if (!(await beforeRestore()))
        throw new Error(
          "Save or recover your current draft before restoring a version.",
        );
      onRestored(await history.restore(version));
      onClose();
    });
  }

  const counts: Record<Tab, number> = {
    comments: comments.comments.filter((comment) => !comment.resolvedAt).length,
    history: history.versions.length,
  };

  return (
    <Modal
      title="Activity"
      closeDisabled={task.busy}
      description={document.title || "Untitled document"}
      size="lg"
      onClose={() => {
        if (!task.busy) onClose();
      }}
    >
      <div className="document-activity">
        <ActivityTabs
          active={tab}
          counts={counts}
          disabled={task.busy}
          onChange={setTab}
        />
        {task.error && <InlineAlert>{task.error}</InlineAlert>}
        <section
          role="tabpanel"
          id={`activity-${tab}`}
          aria-labelledby={`${tab}-tab`}
          className="activity-panel"
        >
          {tab === "comments" ? (
            <CommentsPanel
              data={comments}
              user={user}
              role={document.role}
              task={task}
            />
          ) : (
            <VersionHistoryPanel
              data={history}
              role={document.role}
              task={task}
              onRestore={restore}
            />
          )}
        </section>
      </div>
    </Modal>
  );
}

function ActivityTabs({
  active,
  counts,
  disabled,
  onChange,
}: {
  active: Tab;
  counts: Record<Tab, number>;
  disabled: boolean;
  onChange: (tab: Tab) => void;
}) {
  // Roving focus per the WAI-ARIA tabs pattern.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (
      disabled ||
      !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
    )
      return;
    event.preventDefault();
    const index = TABS.findIndex((tab) => tab.id === active);
    const next =
      event.key === "Home"
        ? TABS[0]
        : event.key === "End"
          ? TABS[TABS.length - 1]
          : TABS[
              (index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) %
                TABS.length
            ];
    onChange(next.id);
    event.currentTarget
      .querySelector<HTMLButtonElement>(`#${next.id}-tab`)
      ?.focus();
  }
  return (
    <div
      className="activity-tabs"
      role="tablist"
      aria-label="Document activity"
      onKeyDown={onKeyDown}
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`${tab.id}-tab`}
          tabIndex={tab.id === active ? 0 : -1}
          aria-selected={tab.id === active}
          aria-controls={`activity-${tab.id}`}
          disabled={disabled}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {counts[tab.id] > 0 && (
            <span className="badge activity-tab-count">{counts[tab.id]}</span>
          )}
        </button>
      ))}
    </div>
  );
}
