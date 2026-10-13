import type { ReactNode } from "react";
import { CircleAlert, TriangleAlert } from "lucide-react";

/** Full-width banner for save failures, conflicts and loading errors. */
export function WorkspaceAlert({
  tone,
  message,
  children,
}: {
  tone: "danger" | "warning";
  message: string;
  children?: ReactNode;
}) {
  const Icon = tone === "warning" ? TriangleAlert : CircleAlert;
  return (
    <div className="workspace-alert" data-tone={tone} role="alert">
      <Icon size={16} aria-hidden="true" />
      <p>{message}</p>
      {children && <div className="workspace-alert__actions">{children}</div>}
    </div>
  );
}
