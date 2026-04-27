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
  const [tagsInput, setTagsInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const loadedCardIdRef = useRef<string | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const lastSavedRef = useRef<{ title: string; content: string; tags: string }>({
    title: '',
    content: '',
    tags: '',
  });

  const normalizeTags = (raw: string) =>
    Array.from(
      new Set(
        raw
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)
      )
    );

  useEffect(() => {
    const load = async () => {
      try {
        const cards = await getCards(null, { includeAll: true });
        setAllCards(cards);
        const found = cards.find((item) => String(item.id) === String(cardId)) || null;
        setCard(found);
        if (found) {
          const nextLoadedId = String(found.id);
          if (loadedCardIdRef.current !== nextLoadedId) {
            setTitle(found.title);
            setContent(found.content ?? '');
            setTagsInput((found.tags ?? []).join(', '));
            loadedCardIdRef.current = nextLoadedId;
          }
          lastSavedRef.current = {
            title: found.title,
            content: found.content ?? '',
            tags: (found.tags ?? []).join(','),
          };
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
    const normalizedTags = normalizeTags(tagsInput);
    const tagsKey = normalizedTags.join(',');
    if (
      title === lastSavedRef.current.title &&
      content === lastSavedRef.current.content &&
      tagsKey === lastSavedRef.current.tags
    ) {
      return;
    }
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = window.setTimeout(() => {
      setIsSaving(true);
      updateCard(card.id, { title, content, tags: normalizedTags })
        .then((updated) => {
          setCard(updated);
          lastSavedRef.current = { title, content, tags: tagsKey };
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
  }, [card, autosaveEnabled, title, content, tagsInput]);

  return {
    card,
    setCard,
    allCards,
    title,
    setTitle,
    content,
    setContent,
    tagsInput,
    setTagsInput,
    isSaving,
    error,
  };
}
