"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@chakra-ui/react";
import { X } from "lucide-react";

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="folio-modal"
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="modal-header">
        <h2 id="modal-title">{title}</h2>
        <Button
          aria-label="Close dialog"
          variant="ghost"
          size="sm"
          onClick={onClose}
        >
          <X size={18} />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
