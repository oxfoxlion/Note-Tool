'use client';

import { RefObject } from 'react';
import { Card } from '../../../lib/noteToolApi';

type CardMentionPickerProps = {
  open: boolean;
  cards: Card[];
  currentCardId: number;
  query: string;
  spaceNameById?: Record<number, string>;
  position: { top: number; left: number };
  menuRef: RefObject<HTMLDivElement | null>;
  onSelect: (item: Card) => void;
};

export default function CardMentionPicker({
  open,
  cards,
  currentCardId,
  query,
  spaceNameById = {},
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
      className="fixed z-50 w-72 max-w-sm rounded-2xl border border-border bg-popover text-popover-foreground shadow-lg"
      style={{ top: position.top, left: position.left }}
      ref={menuRef}
    >
      <div className="border-b border-border px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Link card
      </div>
      <div className="max-h-52 overflow-y-auto p-2">
        {selectableCards.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-popover-foreground transition hover:bg-accent hover:text-accent-foreground"
          >
            <span className="truncate">{item.title}</span>
            <span className="text-xs text-muted-foreground">
              {spaceNameById[item.space_id ?? -1] ?? 'Unknown space'}
            </span>
          </button>
        ))}
        {cards.filter((item) => item.id !== currentCardId).length === 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground">No cards available.</div>
        )}
      </div>
    </div>
  );
}
