import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import "./feedback.css";

export function InlineAlert({ children }: { children: ReactNode }) {
  return (
    <div className="inline-alert" role="alert">
      <CircleAlert size={16} aria-hidden />
      <p>{children}</p>
    </div>
  );
}

/** Decorative spinner; pair it with a visible busy label. */
export function Spinner() {
  return <span className="spinner" aria-hidden />;
}
