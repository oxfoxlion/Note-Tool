'use client';

import { deleteCard, removeCardFromBoard, Card } from '../lib/noteToolApi';
import { useCardBoardMembership } from './useCardBoardMembership';
import { useCardShare } from './useCardShare';

type UseCardActionsParams = {
  card: Card | null;
  boardId: number | null;
  closeMenu: () => void;
  onUnauthorized: () => void;
  onDeleted: () => void;
  onNavigateBoard: (boardId: number) => void;
};

export function useCardActions({
  card,
  boardId,
  closeMenu,
  onUnauthorized,
  onDeleted,
  onNavigateBoard,
}: UseCardActionsParams) {
  const share = useCardShare(card?.id ?? null, { onUnauthorized });
  const removeMembership = useCardBoardMembership(card?.id ?? null, { onUnauthorized });

  const handleDelete = async () => {
    if (!card) return;
    closeMenu();
    if (!confirm('Delete this card permanently?')) return;
    await deleteCard(card.id);
    onDeleted();
  };

  const handleRemoveFromBoard = async (targetBoardId: number) => {
    if (!card) return;
    removeMembership.setRemoveError('');
    removeMembership.setRemoveBusyBoardId(targetBoardId);
    try {
      await removeCardFromBoard(targetBoardId, card.id);
      removeMembership.setRemoveBoards((prev) => prev.filter((item) => item.id !== targetBoardId));
      if (boardId && targetBoardId === boardId) {
        onNavigateBoard(boardId);
      }
    } catch (err: unknown) {
      if ((err as { message?: string })?.message === 'UNAUTHORIZED') {
        onUnauthorized();
        return;
      }
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to remove from board.';
      removeMembership.setRemoveError(message);
    } finally {
      removeMembership.setRemoveBusyBoardId(null);
    }
  };

  const handleCopyShareUrl = async (url: string) => {
    const copied = await share.copyToClipboard(url);
    if (!copied) {
      share.setShareError('Copy failed in this browser. Please copy the URL manually.');
    }
  };

  const actionItems = [
    {
      id: 'share',
      label: 'Share card',
      onClick: () => {
        closeMenu();
        void share.openShare();
      },
    },
    {
      id: 'remove',
      label: 'Remove from board',
      onClick: () => {
        closeMenu();
        void removeMembership.openRemovePicker();
      },
    },
    {
      id: 'delete',
      label: 'Delete card',
      tone: 'danger' as const,
      onClick: () => {
        void handleDelete();
      },
    },
  ];

  return {
    actionItems,
    share,
    removeMembership,
    handleRemoveFromBoard,
    handleCopyShareUrl,
  };
}
