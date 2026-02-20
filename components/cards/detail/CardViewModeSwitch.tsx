'use client';

type ViewMode = 'view' | 'edit' | 'split';

type CardViewModeSwitchProps = {
  isMobile: boolean;
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
};

export default function CardViewModeSwitch({ isMobile, viewMode, onChange }: CardViewModeSwitchProps) {
  return (
    <div className="flex items-center rounded-full border border-slate-200 bg-white px-1 py-1 shadow-sm">
      <button
        type="button"
        onClick={() => onChange('edit')}
        className={`rounded-full p-2 ${viewMode === 'edit' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
        title="Edit"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path d="M4 16.5V20h3.5L19 8.5l-3.5-3.5L4 16.5z" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M13.5 5l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onChange('view')}
        className={`rounded-full p-2 ${viewMode === 'view' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
        title="Preview"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            d="M2.5 12c2.2-4.2 6.6-7 9.5-7s7.3 2.8 9.5 7c-2.2 4.2-6.6 7-9.5 7s-7.3-2.8-9.5-7z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      {!isMobile && (
        <button
          type="button"
          onClick={() => onChange('split')}
          className={`rounded-full p-2 ${viewMode === 'split' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          title="Split"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path d="M4 5h7v14H4zM13 5h7v14h-7z" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
      )}
    </div>
  );
}
