"use client";

import { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Called before the field is focused by the `/` or Cmd/Ctrl+K shortcut. */
  onShortcut: () => void;
}

export function SearchField({ value, onChange, onShortcut }: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onShortcutRef = useRef(onShortcut);
  useEffect(() => {
    onShortcutRef.current = onShortcut;
  }, [onShortcut]);

  useEffect(() => {
    function focusShortcut(event: KeyboardEvent) {
      const commandK =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const slash = event.key === "/" && !isTypingTarget(event.target);
      if (!commandK && !slash) return;
      event.preventDefault();
      onShortcutRef.current();
      // Wait a frame so a closed mobile drawer is visible and focusable.
      requestAnimationFrame(() => inputRef.current?.select());
    }
    window.addEventListener("keydown", focusShortcut);
    return () => window.removeEventListener("keydown", focusShortcut);
  }, []);

  return (
    <div className="search">
      <Search className="search__icon" size={15} aria-hidden="true" />
      <input
        ref={inputRef}
        className="field search__input"
        type="search"
        aria-label="Search documents"
        placeholder="Search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          if (value) {
            event.preventDefault();
            event.stopPropagation();
            onChange("");
          } else {
            inputRef.current?.blur();
          }
        }}
      />
      {value ? (
        <button
          type="button"
          className="search__clear"
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
        >
          <X size={14} aria-hidden="true" />
        </button>
      ) : (
        <kbd className="search__hint" aria-hidden="true">
          /
        </kbd>
      )}
    </div>
  );
}
