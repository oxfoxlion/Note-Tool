'use client';

import MDEditor from '@uiw/react-md-editor';

type CardMarkdownEditorProps = {
  value: string;
  onChange: (next: string, textarea?: HTMLTextAreaElement | null) => void;
  onFocus: (textarea: HTMLTextAreaElement) => void;
  onBlur: () => void;
};

export default function CardMarkdownEditor({ value, onChange, onFocus, onBlur }: CardMarkdownEditorProps) {
  return (
    <div
      data-color-mode="light"
      className="card-editor-surface [&_.w-md-editor]:min-h-[320px] [&_.w-md-editor]:overflow-hidden [&_.w-md-editor]:rounded-xl [&_.w-md-editor]:border-border [&_.w-md-editor]:bg-muted [&_.w-md-editor]:text-card-foreground [&_.w-md-editor-text]:text-sm [&_.w-md-editor-text-input]:text-sm [&_.w-md-editor-text-input]:text-card-foreground [&_.w-md-editor-text-pre]:text-sm [&_.w-md-editor-text-pre]:text-card-foreground [&_.w-md-editor-text-container]:bg-muted [&_.wmde-markdown]:bg-muted [&_.wmde-markdown]:text-card-foreground"
    >
      <MDEditor
        value={value}
        onChange={(nextValue, event) => onChange(nextValue ?? '', event?.currentTarget)}
        preview="edit"
        hideToolbar
        visibleDragbar={false}
        height={360}
        textareaProps={{
          placeholder: 'Write your markdown...',
          onFocus: (event) => onFocus(event.currentTarget),
          onBlur,
        }}
      />
    </div>
  );
}
