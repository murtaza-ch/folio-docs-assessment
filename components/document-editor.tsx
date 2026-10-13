"use client";

import { documentWordCount } from "@/lib/document-text";
import { useEffect, useRef } from "react";
import { Button } from "@chakra-ui/react";
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
  type JSONContent,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
} from "lucide-react";

interface DocumentEditorProps {
  content: JSONContent;
  onChange: (content: JSONContent) => void;
  editable?: boolean;
  disabled?: boolean;
}

function readEditorState(editor: Editor | null) {
  if (!editor) return null;
  return {
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    underline: editor.isActive("underline"),
    bulletList: editor.isActive("bulletList"),
    orderedList: editor.isActive("orderedList"),
    blockquote: editor.isActive("blockquote"),
    block: editor.isActive("heading")
      ? `h${editor.getAttributes("heading").level}`
      : "paragraph",
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
    words: documentWordCount(editor.getJSON()),
  };
}

export function DocumentEditor({
  content,
  onChange,
  editable = true,
  disabled = false,
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
      Placeholder.configure({
        placeholder: "Start writing. Your ideas belong here.",
      }),
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

  const trackedState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => readEditorState(currentEditor),
  });
  // The state hook retains its initial null snapshot until the first transaction.
  // Read the mounted editor directly so newly opened documents show their count and formatting.
  const state = trackedState ?? readEditorState(editor);
  const words = state?.words ?? documentWordCount(content);

  const controls = [
    {
      label: "Bold",
      shortcut: "Ctrl/Cmd+B",
      icon: Bold,
      active: state?.bold,
      action: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      shortcut: "Ctrl/Cmd+I",
      icon: Italic,
      active: state?.italic,
      action: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: "Underline",
      shortcut: "Ctrl/Cmd+U",
      icon: Underline,
      active: state?.underline,
      action: () => editor?.chain().focus().toggleUnderline().run(),
    },
    {
      label: "Bullet list",
      shortcut: "Ctrl/Cmd+Shift+8",
      icon: List,
      active: state?.bulletList,
      action: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      shortcut: "Ctrl/Cmd+Shift+7",
      icon: ListOrdered,
      active: state?.orderedList,
      action: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Blockquote",
      shortcut: "Ctrl/Cmd+Shift+B",
      icon: Quote,
      active: state?.blockquote,
      action: () => editor?.chain().focus().toggleBlockquote().run(),
    },
  ];

  return (
    <div className="document-editor" aria-busy={disabled}>
      {editable ? (
        <div
          className="editor-toolbar"
          role="group"
          aria-label="Text formatting"
        >
          <select
            className="toolbar-select"
            aria-label="Paragraph style"
            disabled={!editor || disabled}
            value={state?.block ?? "paragraph"}
            onChange={(event) => {
              const style = event.target.value;
              if (style === "paragraph")
                editor?.chain().focus().setParagraph().run();
              else
                editor
                  ?.chain()
                  .focus()
                  .setHeading({
                    level: Number(style.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6,
                  })
                  .run();
            }}
          >
            <option value="paragraph">Normal text</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="h4">Heading 4</option>
            <option value="h5">Heading 5</option>
            <option value="h6">Heading 6</option>
          </select>
          <span className="toolbar-divider" aria-hidden="true" />
          {controls.map(
            ({ label, shortcut, icon: Icon, active, action }, index) => (
              <span key={label} style={{ display: "contents" }}>
                {index === 3 && (
                  <span className="toolbar-divider" aria-hidden="true" />
                )}
                <Button
                  type="button"
                  className="toolbar-button"
                  size="sm"
                  variant="ghost"
                  aria-label={label}
                  aria-pressed={!!active}
                  title={`${label} (${shortcut})`}
                  data-active={active ? "true" : "false"}
                  disabled={!editor || disabled}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={action}
                >
                  <Icon size={17} aria-hidden="true" />
                </Button>
              </span>
            ),
          )}
          <span className="toolbar-divider" aria-hidden="true" />
          <Button
            type="button"
            className="toolbar-button"
            size="sm"
            variant="ghost"
            aria-label="Undo"
            title="Undo (Ctrl/Cmd+Z)"
            disabled={disabled || !state?.canUndo}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <Undo2 size={17} aria-hidden="true" />
          </Button>
          <Button
            type="button"
            className="toolbar-button"
            size="sm"
            variant="ghost"
            aria-label="Redo"
            title="Redo (Ctrl/Cmd+Shift+Z)"
            disabled={disabled || !state?.canRedo}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor?.chain().focus().redo().run()}
          >
            <Redo2 size={17} aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <div className="editor-readonly-note">
          You have view access to this document.
        </div>
      )}
      <div className="editor-paper">
        <EditorContent editor={editor} className="editor-content" />
        {!editor && (
          <div className="editor-readonly-note" role="status">
            Opening document...
          </div>
        )}
      </div>
      <div className="editor-footer">
        <span>
          {words} {words === 1 ? "word" : "words"}
        </span>
        <span>{editable ? "Ctrl/Cmd+B for bold" : "Read only"}</span>
      </div>
    </div>
  );
}
