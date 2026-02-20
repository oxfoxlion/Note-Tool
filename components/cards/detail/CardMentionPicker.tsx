'use client';

import { RefObject } from 'react';
import { Card } from '../../../lib/noteToolApi';

type CardMentionPickerProps = {
  open: boolean;
  cards: Card[];
  currentCardId: number;
  query: string;
  position: { top: number; left: number };
  menuRef: RefObject<HTMLDivElement | null>;
  onSelect: (item: Card) => void;
};

export default function CardMentionPicker({
  open,
  cards,
  currentCardId,
  query,
  position,
  menuRef,
  onSelect,
}: CardMentionPickerProps) {
  if (!open) return null;

  const selectableCards = cards
    .filter((item) => item.id !== currentCardId)
    .filter((item) => (query ? item.title.toLowerCase().includes(query.toLowerCase()) : true))
    .slice(0, 8);

  return (
    <div
      className="fixed z-50 w-72 max-w-sm rounded-2xl border border-slate-200 bg-white shadow-lg"
      style={{ top: position.top, left: position.left }}
      ref={menuRef}
    >
      <div className="border-b border-slate-200 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">
        Link card
      </div>
      <div className="max-h-52 overflow-y-auto p-2">
        {selectableCards.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <span className="truncate">{item.title}</span>
            <span className="text-xs text-slate-400">#{item.id}</span>
          </button>
        ))}
        {cards.filter((item) => item.id !== currentCardId).length === 0 && (
          <div className="px-3 py-2 text-xs text-slate-400">No cards available.</div>
        )}
      </div>
    </div>
  );
}
