'use client';

import { useMemo } from 'react';
import { Card } from '../lib/noteToolApi';

type UseCardLinksParams = {
  allCards: Card[];
  content: string;
  cardId?: number;
};

export function useCardLinks({ allCards, content, cardId }: UseCardLinksParams) {
  const cardMap = useMemo(() => {
    const map = new Map<number, Card>();
    allCards.forEach((item) => map.set(item.id, item));
    return map;
  }, [allCards]);

  const mentionedIds = useMemo(() => {
    const ids = new Set<number>();
    const regex = /@\[\[(\d+)\|[^\]]+\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content))) {
      ids.add(Number(match[1]));
    }
    return Array.from(ids);
  }, [content]);

  const incomingIds = useMemo(() => {
    const ids = new Set<number>();
    if (!cardId) return [];
    const regex = new RegExp(`@\\[\\[${cardId}\\|[^\\]]+\\]\\]`, 'g');
    allCards.forEach((item) => {
      if (item.id === cardId || !item.content) return;
      if (regex.test(item.content)) {
        ids.add(item.id);
      }
    });
    return Array.from(ids);
  }, [allCards, cardId]);

  return Array.from(new Set([...mentionedIds, ...incomingIds]))
    .map((id) => cardMap.get(id))
    .filter((item): item is Card => Boolean(item));
}
