'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, getCards, updateCard } from '../lib/noteToolApi';

type UseCardDetailStateParams = {
  cardId: string;
  autosaveEnabled: boolean;
  onUnauthorized: () => void;
};

export function useCardDetailState({
  cardId,
  autosaveEnabled,
  onUnauthorized,
}: UseCardDetailStateParams) {
  const [card, setCard] = useState<Card | null>(null);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const loadedCardIdRef = useRef<string | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const lastSavedRef = useRef<{ title: string; content: string }>({ title: '', content: '' });

  useEffect(() => {
    const load = async () => {
      try {
        const cards = await getCards();
        setAllCards(cards);
        const found = cards.find((item) => String(item.id) === String(cardId)) || null;
        setCard(found);
        if (found) {
          const nextLoadedId = String(found.id);
          if (loadedCardIdRef.current !== nextLoadedId) {
            setTitle(found.title);
            setContent(found.content ?? '');
            loadedCardIdRef.current = nextLoadedId;
          }
          lastSavedRef.current = { title: found.title, content: found.content ?? '' };
        }
      } catch (err: unknown) {
        if ((err as { message?: string })?.message === 'UNAUTHORIZED') {
          onUnauthorized();
          return;
        }
        setError('Failed to load card.');
      }
    };

    if (cardId) {
      void load();
    }
  }, [cardId, onUnauthorized]);

  useEffect(() => {
    if (!card) return;
    if (!autosaveEnabled) return;
    if (title === lastSavedRef.current.title && content === lastSavedRef.current.content) return;
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = window.setTimeout(() => {
      setIsSaving(true);
      updateCard(card.id, { title, content })
        .then((updated) => {
          setCard(updated);
          lastSavedRef.current = { title, content };
        })
        .finally(() => {
          setIsSaving(false);
        });
    }, 800);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [card, autosaveEnabled, title, content]);

  return {
    card,
    setCard,
    allCards,
    title,
    setTitle,
    content,
    setContent,
    isSaving,
    error,
  };
}
