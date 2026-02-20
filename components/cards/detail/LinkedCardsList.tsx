'use client';

import { Card } from '../../../lib/noteToolApi';

type LinkedCardsListProps = {
  cards: Card[];
  onOpenCard: (id: number) => void;
};

export default function LinkedCardsList({ cards, onOpenCard }: LinkedCardsListProps) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Linked cards</div>
      <div className="mt-3 space-y-2">
        {cards.length === 0 && <div className="text-sm text-slate-500">No linked cards.</div>}
        {cards.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpenCard(item.id)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <span className="truncate">@{item.title}</span>
            <span className="text-xs text-slate-400">#{item.id}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
