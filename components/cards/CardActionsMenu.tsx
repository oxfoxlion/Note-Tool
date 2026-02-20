'use client';

import { useRef } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';

type CardAction = {
  id: string;
  label: string;
  tone?: 'default' | 'danger';
  onClick: () => void;
};

type CardActionsMenuProps = {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  actions: CardAction[];
  align?: 'left' | 'right';
  showTrigger?: boolean;
};

export default function CardActionsMenu({
  open,
  onToggle,
  onClose,
  actions,
  align = 'right',
  showTrigger = true,
}: CardActionsMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  useClickOutside(menuRef, open, onClose);

  return (
    <div className="relative" ref={menuRef}>
      {showTrigger && (
        <button
          type="button"
          onClick={onToggle}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
          aria-label="Card actions"
          title="Card actions"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <circle cx="6.5" cy="12" r="1.5" fill="currentColor" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            <circle cx="17.5" cy="12" r="1.5" fill="currentColor" />
          </svg>
        </button>
      )}
      {open && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} z-40 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg`}
        >
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              className={`block w-full px-3 py-2 text-left text-sm ${
                action.tone === 'danger' ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
