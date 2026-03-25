'use client';

import { Card } from '../../../lib/noteToolApi';

type LinkedCardsListProps = {
  cards: Card[];
  onOpenCard: (id: number) => void;
};

export default function LinkedCardsList({ cards, onOpenCard }: LinkedCardsListProps) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Linked cards</div>
      <div className="mt-3 space-y-2">
        {cards.length === 0 && <div className="text-sm text-muted-foreground">No linked cards.</div>}
        {cards.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpenCard(item.id)}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-left text-sm text-card-foreground transition hover:bg-accent hover:text-accent-foreground"
          >
            <span className="truncate">@{item.title}</span>
            <span className="text-xs text-muted-foreground">#{item.id}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
