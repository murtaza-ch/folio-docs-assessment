"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import "./dialogs.css";

export function Modal({
  title,
  description,
  footer,
  size = "md",
  closeDisabled = false,
  children,
  onClose,
}: {
  title: string;
  description?: ReactNode;
  /** Action row pinned below the scrollable body. */
  footer?: ReactNode;
  size?: "md" | "lg";
  closeDisabled?: boolean;
  children?: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`folio-modal folio-modal-${size}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!closeDisabled) onClose();
      }}
      onClick={(event) => {
        if (closeDisabled || event.target !== ref.current) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        // Blank space inside the dialog should not dismiss it.
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <header className="modal-header">
        <div className="modal-heading">
          <h2 id={titleId}>{title}</h2>
          {description && (
            <p id={descriptionId} className="modal-description">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          aria-label="Close dialog"
          disabled={closeDisabled}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      {children && <div className="modal-body">{children}</div>}
      {footer && <footer className="modal-footer">{footer}</footer>}
    </dialog>
  );
}
