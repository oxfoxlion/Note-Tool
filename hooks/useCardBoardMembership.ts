'use client';

import { useState } from 'react';
import { BoardSummary, getCardBoards } from '../lib/noteToolApi';

type UseCardBoardMembershipOptions = {
  onUnauthorized?: () => void;
};

export function useCardBoardMembership(cardId: number | null, options: UseCardBoardMembershipOptions = {}) {
  const [showRemovePicker, setShowRemovePicker] = useState(false);
  const [removeBoards, setRemoveBoards] = useState<BoardSummary[]>([]);
  const [removeBusyBoardId, setRemoveBusyBoardId] = useState<number | null>(null);
  const [removeError, setRemoveError] = useState('');

  const isUnauthorized = (err: unknown) => (err as { message?: string })?.message === 'UNAUTHORIZED';

  const openRemovePicker = async (targetCardId?: number) => {
    const effectiveCardId = targetCardId ?? cardId;
    if (!effectiveCardId) return;
    setRemoveError('');
    try {
      const boards = await getCardBoards(effectiveCardId);
      setRemoveBoards(boards);
      setShowRemovePicker(true);
    } catch (err: unknown) {
      if (isUnauthorized(err)) {
        options.onUnauthorized?.();
        return;
      }
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to load board list.';
      setRemoveError(message);
      setShowRemovePicker(true);
    }
  };

  const closeRemovePicker = () => {
    setShowRemovePicker(false);
    setRemoveError('');
  };

  return {
    showRemovePicker,
    removeBoards,
    removeBusyBoardId,
    removeError,
    setRemoveBusyBoardId,
    setRemoveError,
    setRemoveBoards,
    openRemovePicker,
    closeRemovePicker,
  };
}
