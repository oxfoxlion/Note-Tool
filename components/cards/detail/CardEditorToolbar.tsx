'use client';

export type CardEditorToolbarProps = {
  onHeading: () => void;
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onStrikethrough: () => void;
  onInlineCode: () => void;
  onBulletedList: () => void;
  onNumberedList: () => void;
  onQuote: () => void;
  onCheckbox: () => void;
  onTable: () => void;
  onLink: () => void;
  onImage: () => void;
};

export default function CardEditorToolbar({
  onHeading,
  onBold,
  onItalic,
  onUnderline,
  onStrikethrough,
  onInlineCode,
  onBulletedList,
  onNumberedList,
  onQuote,
  onCheckbox,
  onTable,
  onLink,
  onImage,
}: CardEditorToolbarProps) {
  return (
    <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-600">
      <button
        type="button"
        onClick={onHeading}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Heading (add #)"
        aria-label="Heading"
      >
        <span className="text-xs font-semibold">H</span>
      </button>
      <button
        type="button"
        onClick={onBold}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Bold"
        aria-label="Bold"
      >
        <span className="text-xs font-semibold">B</span>
      </button>
      <button
        type="button"
        onClick={onItalic}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Italic"
        aria-label="Italic"
      >
        <span className="text-xs italic">I</span>
      </button>
      <button
        type="button"
        onClick={onUnderline}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Underline"
        aria-label="Underline"
      >
        <span className="text-xs underline">U</span>
      </button>
      <button
        type="button"
        onClick={onStrikethrough}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Strikethrough"
        aria-label="Strikethrough"
      >
        <span className="text-xs line-through">S</span>
      </button>
      <button
        type="button"
        onClick={onInlineCode}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Inline code"
        aria-label="Inline code"
      >
        <span className="text-[10px] font-mono">{'</>'}</span>
      </button>
      <button
        type="button"
        onClick={onBulletedList}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Bulleted list"
        aria-label="Bulleted list"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path d="M6 7h13M6 12h13M6 17h13" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <circle cx="4" cy="7" r="1.2" fill="currentColor" />
          <circle cx="4" cy="12" r="1.2" fill="currentColor" />
          <circle cx="4" cy="17" r="1.2" fill="currentColor" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onNumberedList}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Numbered list"
        aria-label="Numbered list"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path d="M8 7h11M8 12h11M8 17h11" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <path d="M3 7h2M3 12h2M3 17h2" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onQuote}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Quote"
        aria-label="Quote"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path d="M7 8h3v3H7zM14 8h3v3h-3z" fill="currentColor" />
          <path d="M7 13h6M14 13h3" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onCheckbox}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Checkbox"
        aria-label="Checkbox"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <rect x="4" y="6" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <path d="M13 9h7M13 15h7" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5.5 8.8l1.6 1.6 2.4-3" stroke="currentColor" strokeWidth="1.6" fill="none" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onTable}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Table"
        aria-label="Table"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <rect x="4" y="6" width="16" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <path d="M4 10h16M10 6v12" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onLink}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Link"
        aria-label="Link"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            d="M10 13a4 4 0 0 1 0-6l2-2a4 4 0 1 1 6 6l-1 1"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
          />
          <path
            d="M14 11a4 4 0 0 1 0 6l-2 2a4 4 0 1 1-6-6l1-1"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
          />
        </svg>
      </button>
      <button
        type="button"
        onClick={onImage}
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        title="Image"
        aria-label="Image"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <rect x="4" y="6" width="16" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <circle cx="9" cy="11" r="1.6" fill="currentColor" />
          <path d="M4 16l4-4 3 3 4-4 5 5" stroke="currentColor" strokeWidth="1.6" fill="none" />
        </svg>
      </button>
    </div>
  );
}
