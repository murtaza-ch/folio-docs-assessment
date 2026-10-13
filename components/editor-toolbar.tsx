"use client";

import { Fragment } from "react";
import { SelectField } from "./select-field";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
const PARAGRAPH_STYLES = [
  { value: "paragraph", label: "Normal text" },
  ...[1, 2, 3, 4, 5, 6].map((level) => ({
    value: `h${level}`,
    label: `Heading ${level}`,
  })),
];

interface Control {
  label: string;
  shortcut: string;
  icon: LucideIcon;
  active?: boolean;
  enabled?: boolean;
  action: () => void;
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
  };
}

export function EditorToolbar({
  editor,
  disabled,
}: {
  editor: Editor | null;
  disabled: boolean;
}) {
  const trackedState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => readEditorState(currentEditor),
  });
  // The state hook retains its initial null snapshot until the first transaction.
  // Read the mounted editor directly so newly opened documents show their formatting.
  const state = trackedState ?? readEditorState(editor);
  const chain = () => editor?.chain().focus();

  const groups: Control[][] = [
    [
      {
        label: "Bold",
        shortcut: "Ctrl/Cmd+B",
        icon: Bold,
        active: !!state?.bold,
        action: () => chain()?.toggleBold().run(),
      },
      {
        label: "Italic",
        shortcut: "Ctrl/Cmd+I",
        icon: Italic,
        active: !!state?.italic,
        action: () => chain()?.toggleItalic().run(),
      },
      {
        label: "Underline",
        shortcut: "Ctrl/Cmd+U",
        icon: Underline,
        active: !!state?.underline,
        action: () => chain()?.toggleUnderline().run(),
      },
    ],
    [
      {
        label: "Bullet list",
        shortcut: "Ctrl/Cmd+Shift+8",
        icon: List,
        active: !!state?.bulletList,
        action: () => chain()?.toggleBulletList().run(),
      },
      {
        label: "Numbered list",
        shortcut: "Ctrl/Cmd+Shift+7",
        icon: ListOrdered,
        active: !!state?.orderedList,
        action: () => chain()?.toggleOrderedList().run(),
      },
      {
        label: "Blockquote",
        shortcut: "Ctrl/Cmd+Shift+B",
        icon: Quote,
        active: !!state?.blockquote,
        action: () => chain()?.toggleBlockquote().run(),
      },
    ],
    [
      {
        label: "Undo",
        shortcut: "Ctrl/Cmd+Z",
        icon: Undo2,
        enabled: !!state?.canUndo,
        action: () => chain()?.undo().run(),
      },
      {
        label: "Redo",
        shortcut: "Ctrl/Cmd+Shift+Z",
        icon: Redo2,
        enabled: !!state?.canRedo,
        action: () => chain()?.redo().run(),
      },
    ],
  ];

  return (
    <div className="toolbar" role="toolbar" aria-label="Text formatting">
      <SelectField
        className="toolbar__select"
        label="Paragraph style"
        options={PARAGRAPH_STYLES}
        disabled={!editor || disabled}
        value={state?.block ?? "paragraph"}
        onChange={(style) => {
          if (style === "paragraph") chain()?.setParagraph().run();
          else
            chain()
              ?.setHeading({ level: Number(style.slice(1)) as HeadingLevel })
              .run();
        }}
      />
      {groups.map((group, index) => (
        <Fragment key={index}>
          <span className="toolbar__divider" aria-hidden="true" />
          {group.map(
            ({ label, shortcut, icon: Icon, active, enabled, action }) => (
              <button
                key={label}
                type="button"
                className="toolbar__button"
                aria-label={label}
                aria-pressed={active === undefined ? undefined : active}
                title={`${label} (${shortcut})`}
                disabled={!editor || disabled || enabled === false}
                onMouseDown={(event) => event.preventDefault()}
                onClick={action}
              >
                <Icon size={16} aria-hidden="true" />
              </button>
            ),
          )}
        </Fragment>
      ))}
    </div>
  );
}
