import { useEffect, useRef, useState } from "react";
import { History, RotateCcw } from "lucide-react";
import type { Role } from "@/lib/types";
import type { VersionSnapshot } from "@/lib/collaboration-types";
import { Spinner } from "../feedback";
import { fullDate, relativeTime } from "../date-format";
import { RichTextPreview } from "./rich-text-preview";
import type { ActivityTask } from "./use-activity-task";
import type { VersionHistoryData } from "./use-version-history";

export function VersionHistoryPanel({
  data,
  role,
  task,
  onRestore,
}: {
  data: VersionHistoryData;
  role: Role;
  task: ActivityTask;
  onRestore: (version: number) => void;
}) {
  const { versions, currentVersion, snapshot } = data;
  const [confirming, setConfirming] = useState<number | null>(null);
  const preview = useRef<HTMLDivElement>(null);

  // On stacked (narrow) layouts the preview sits below the list.
  useEffect(() => {
    if (snapshot && window.matchMedia("(max-width: 719px)").matches)
      preview.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [snapshot]);

  const canRestore =
    snapshot !== null &&
    snapshot.version !== currentVersion &&
    role !== "viewer";

  return (
    <div className="history-panel">
      <div className="history-list-pane">
        <p className="history-note">
          Up to 50 previous versions are kept. Large documents retain fewer.
        </p>
        {data.loading ? (
          <p className="activity-status" role="status">
            <Spinner />
            Loading versions…
          </p>
        ) : (
          <ul className="version-list">
            {versions.map((version) => {
              const selected = snapshot?.version === version.version;
              return (
                <li key={version.version}>
                  <button
                    type="button"
                    className={`version-row${selected ? " is-selected" : ""}`}
                    aria-current={selected ? "true" : undefined}
                    disabled={task.busy}
                    onClick={() => {
                      setConfirming(null);
                      void data.preview(version.version);
                    }}
                  >
                    <span className="version-chip">v{version.version}</span>
                    <span className="version-text">
                      <strong>{version.title || "Untitled document"}</strong>
                      <span title={fullDate(version.createdAt)}>
                        {version.author.name} ·{" "}
                        {relativeTime(version.createdAt)}
                      </span>
                    </span>
                    {version.version === currentVersion && (
                      <span className="badge badge-accent">Current</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="history-preview-pane" ref={preview}>
        {data.previewLoading ? (
          <p className="activity-status" role="status">
            <Spinner />
            Opening version…
          </p>
        ) : snapshot ? (
          <VersionPreview
            snapshot={snapshot}
            wordCount={
              versions.find((version) => version.version === snapshot.version)
                ?.wordCount
            }
            isCurrent={snapshot.version === currentVersion}
            canRestore={canRestore}
            readOnly={role === "viewer"}
            confirming={canRestore && confirming === snapshot.version}
            busy={task.busy}
            onConfirm={(value) =>
              setConfirming(value ? snapshot.version : null)
            }
            onRestore={() => onRestore(snapshot.version)}
          />
        ) : (
          !data.loading && (
            <div className="activity-empty">
              <span className="activity-empty-icon" aria-hidden>
                <History size={18} />
              </span>
              <strong>No version selected</strong>
              <p>Choose a version to preview its content.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function VersionPreview({
  snapshot,
  wordCount,
  isCurrent,
  canRestore,
  readOnly,
  confirming,
  busy,
  onConfirm,
  onRestore,
}: {
  snapshot: VersionSnapshot;
  wordCount?: number;
  isCurrent: boolean;
  canRestore: boolean;
  readOnly: boolean;
  confirming: boolean;
  busy: boolean;
  onConfirm: (confirming: boolean) => void;
  onRestore: () => void;
}) {
  return (
    <article className="version-preview">
      <header className="version-preview-header">
        <div>
          <strong>Version {snapshot.version}</strong>
          <span>
            {snapshot.author.name} · {fullDate(snapshot.createdAt)}
            {wordCount !== undefined &&
              ` · ${wordCount.toLocaleString("en")} words`}
          </span>
        </div>
        {isCurrent ? (
          <span className="badge badge-accent">Current version</span>
        ) : readOnly ? (
          <span className="badge">View only</span>
        ) : (
          canRestore &&
          !confirming && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={() => onConfirm(true)}
            >
              <RotateCcw size={14} aria-hidden />
              Restore this version
            </button>
          )
        )}
      </header>
      {confirming && (
        <div
          className="activity-confirm"
          role="group"
          aria-label={`Confirm restoring version ${snapshot.version}`}
          aria-describedby="restore-version-description"
        >
          <p id="restore-version-description">
            Restoring creates a new version from this one. The current version
            stays in history.
          </p>
          <div className="activity-inline-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              autoFocus
              disabled={busy}
              onClick={() => onConfirm(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy}
              onClick={onRestore}
            >
              {busy && <Spinner />}
              {busy ? "Restoring…" : `Restore version ${snapshot.version}`}
            </button>
          </div>
        </div>
      )}
      <div className="version-preview-document">
        <h3>{snapshot.title || "Untitled document"}</h3>
        <RichTextPreview content={snapshot.content} />
      </div>
    </article>
  );
}
