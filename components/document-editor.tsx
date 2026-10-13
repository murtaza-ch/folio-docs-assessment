"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Lock } from "lucide-react";
import { EditorToolbar } from "./editor-toolbar";

interface DocumentEditorProps {
  content: JSONContent;
  onChange: (content: JSONContent) => void;
  editable?: boolean;
  disabled?: boolean;
  /** Title, meta line and notices rendered between the toolbar and the body. */
  children?: ReactNode;
}

export function DocumentEditor({
  content,
  onChange,
  editable = true,
  disabled = false,
  children,
}: DocumentEditorProps) {
  const onChangeRef = useRef(onChange);
  const previousContent = useRef(content);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        link: { openOnClick: false },
      }),
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    content,
    editable: editable && !disabled,
    editorProps: {
      attributes: {
        class: "folio-prose",
        role: "textbox",
        "aria-label": "Document content",
        "aria-multiline": "true",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor: currentEditor }) =>
      onChangeRef.current(currentEditor.getJSON()),
  });

  useEffect(() => {
    if (!editor) return;
    const canEdit = editable && !disabled;
    if (editor.isEditable !== canEdit) editor.setEditable(canEdit, false);
    editor.view.dom.setAttribute("aria-readonly", String(!canEdit));
  }, [editor, editable, disabled]);

  useEffect(() => {
    if (!editor || previousContent.current === content) return;
    previousContent.current = content;
    // Parent echoes of local edits must preserve selection and undo history.
    if (JSON.stringify(editor.getJSON()) === JSON.stringify(content)) return;
    editor.commands.setContent(content, { emitUpdate: false });
  }, [content, editor]);

  return (
    <article className="sheet" aria-busy={disabled}>
      {editable ? (
        <EditorToolbar editor={editor} disabled={disabled} />
      ) : (
        <p className="sheet__notice">
          <Lock size={14} aria-hidden="true" />
          You have view access
        </p>
      )}
      <div className="sheet__body">
        {children}
        <EditorContent editor={editor} className="sheet__content" />
        {!editor && (
          <p className="sheet__loading" role="status">
            Loading…
          </p>
        )}
      </div>
    </article>
  );
}
