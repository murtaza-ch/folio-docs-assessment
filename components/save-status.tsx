import { Check, CircleAlert, Lock, TriangleAlert } from "lucide-react";

export type SaveState = "saved" | "unsaved" | "saving" | "error" | "conflict";

const LABELS: Record<SaveState, string> = {
  saved: "Saved",
  saving: "Saving…",
  unsaved: "Unsaved changes",
  error: "Not saved",
  conflict: "Conflict",
};

function StatusIcon({ state }: { state: SaveState }) {
  switch (state) {
    case "saved":
      return <Check size={14} aria-hidden="true" />;
    case "saving":
      return (
        <span className="spinner save-status__spinner" aria-hidden="true" />
      );
    case "unsaved":
      return <span className="save-status__dot" aria-hidden="true" />;
    case "error":
      return <CircleAlert size={14} aria-hidden="true" />;
    case "conflict":
      return <TriangleAlert size={14} aria-hidden="true" />;
  }
}

export function SaveStatus({
  state,
  readOnly,
}: {
  state: SaveState;
  readOnly: boolean;
}) {
  if (readOnly)
    return (
      <span className="badge">
        <Lock size={12} aria-hidden="true" />
        View only
      </span>
    );
  return (
    <span
      className="save-status"
      data-state={state}
      role="status"
      aria-live="polite"
      title={LABELS[state]}
    >
      <StatusIcon state={state} />
      <span className="save-status__label">{LABELS[state]}</span>
    </span>
  );
}
