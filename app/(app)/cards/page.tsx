'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CardOverlay from '../../../components/CardOverlay';
import CardCreateOverlay from '../../../components/CardCreateOverlay';
import CardPreview from '../../../components/CardPreview';
import CardActionsMenu from '../../../components/cards/CardActionsMenu';
import CardShareLinksModal from '../../../components/cards/CardShareLinksModal';
import CardCopyToSpaceModal from '../../../components/cards/CardCopyToSpaceModal';
import CardRemoveFromBoardModal from '../../../components/cards/CardRemoveFromBoardModal';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../../components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Badge } from '../../../components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import {
  Card,
  CardFolder,
  Board,
  BoardSummary,
  BoardCardLink,
  CardShareLink,
  Space,
  copyCardToSpace,
  createCardShareLink,
  createCard,
  deleteCard,
  exportCardsAsMarkdownZip,
  getBoard,
  getBoardCardLinks,
  getCardShareLinks,
  getCardFolders,
  getCardBoards,
  getBoards,
  getCards,
  getSpaces,
  revokeCardShareLink,
  getUserSettings,
  updateCard,
  updateUserSettings,
  removeCardFromBoard,
} from '../../../lib/noteToolApi';
import { useCurrentSpace } from '../../../hooks/useCurrentSpace';

export default function CardsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentSpaceId } = useCurrentSpace();
  const [isMobile, setIsMobile] = useState(false);
  const [isXl, setIsXl] = useState(true);
  const [cards, setCards] = useState<Card[]>([]);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [folders, setFolders] = useState<CardFolder[]>([]);
  const [query, setQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedBoardLinkedCardIds, setSelectedBoardLinkedCardIds] = useState<number[]>([]);
  const [cardOpenMode, setCardOpenMode] = useState<'modal' | 'sidepanel'>('modal');
  const [cardViewMode, setCardViewMode] = useState<'grid' | 'table'>('grid');
  const [folderFilter, setFolderFilter] = useState<string>('');
  const [boardFilter, setBoardFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [error, setError] = useState('');
  const [cardPreviewLength, setCardPreviewLength] = useState(120);
  const [pageState, setPageState] = useState<{ value: number; key: string }>({ value: 1, key: '' });
  const [selectedTableCardIds, setSelectedTableCardIds] = useState<number[]>([]);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [isBatchExporting, setIsBatchExporting] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [openTableActionCardId, setOpenTableActionCardId] = useState<number | null>(null);
  const [tableActionCard, setTableActionCard] = useState<Card | null>(null);
  const [tableShareOpen, setTableShareOpen] = useState(false);
  const [tableShareLinks, setTableShareLinks] = useState<CardShareLink[]>([]);
  const [tableShareBusy, setTableShareBusy] = useState(false);
  const [tableShareError, setTableShareError] = useState('');
  const [tableSharePassword, setTableSharePassword] = useState('');
  const [tableCopyOpen, setTableCopyOpen] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [copyBusySpaceId, setCopyBusySpaceId] = useState<number | null>(null);
  const [copyError, setCopyError] = useState('');
  const [copySuccessMessage, setCopySuccessMessage] = useState('');
  const [tableBatchCopyOpen, setTableBatchCopyOpen] = useState(false);
  const [copyFolderPickOpen, setCopyFolderPickOpen] = useState(false);
  const [copyTargetMode, setCopyTargetMode] = useState<'single' | 'batch' | null>(null);
  const [copyTargetSpace, setCopyTargetSpace] = useState<Space | null>(null);
  const [copyTargetFolders, setCopyTargetFolders] = useState<CardFolder[]>([]);
  const [copyTargetFolderValue, setCopyTargetFolderValue] = useState('');
  const [tableRemoveOpen, setTableRemoveOpen] = useState(false);
  const [tableRemoveBoards, setTableRemoveBoards] = useState<BoardSummary[]>([]);
  const [tableRemoveBusyBoardId, setTableRemoveBusyBoardId] = useState<number | null>(null);
  const [tableRemoveError, setTableRemoveError] = useState('');
  const [tableTagOpen, setTableTagOpen] = useState(false);
  const [tableSelectedTags, setTableSelectedTags] = useState<string[]>([]);
  const [tableNewTagInput, setTableNewTagInput] = useState('');
  const [tableTagSaving, setTableTagSaving] = useState(false);
  const [tableTagError, setTableTagError] = useState('');
  const [tableMoveFolderOpen, setTableMoveFolderOpen] = useState(false);
  const [tableMoveFolderMode, setTableMoveFolderMode] = useState<'single' | 'batch'>('single');
  const [tableMoveFolderValue, setTableMoveFolderValue] = useState('');
  const [tableMoveFolderSaving, setTableMoveFolderSaving] = useState(false);
  const [tableMoveFolderError, setTableMoveFolderError] = useState('');
  const folderIdFromQuery = Number(searchParams.get('folderId'));
  const hasFolderIdFromQuery = Number.isInteger(folderIdFromQuery) && folderIdFromQuery > 0;

  useEffect(() => {
    const mediaMobile = window.matchMedia('(max-width: 768px)');
    const mediaXl = window.matchMedia('(min-width: 1280px)');
    const handleChange = () => {
      setIsMobile(mediaMobile.matches);
      setIsXl(mediaXl.matches);
      if (mediaMobile.matches) {
        setCardOpenMode('sidepanel');
      }
    };
    handleChange();
    mediaMobile.addEventListener('change', handleChange);
    mediaXl.addEventListener('change', handleChange);
    return () => {
      mediaMobile.removeEventListener('change', handleChange);
      mediaXl.removeEventListener('change', handleChange);
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [cardsData, boardsData, foldersData, settingsData] = await Promise.all([
          getCards(currentSpaceId),
          getBoards(null, currentSpaceId),
          getCardFolders(currentSpaceId),
          getUserSettings(),
        ]);
        setCards(cardsData);
        setAllCards(cardsData);
        setBoards(boardsData);
        setFolders(foldersData);
        if (settingsData?.cardOpenMode) {
          setCardOpenMode(settingsData.cardOpenMode);
        }
        if (typeof settingsData?.cardPreviewLength === 'number') {
          setCardPreviewLength(settingsData.cardPreviewLength);
        }
      } catch (err: unknown) {
        if ((err as { message?: string })?.message === 'UNAUTHORIZED') {
          router.push('/auth/login');
          return;
        }
        setError('Failed to load cards.');
      }
    };
    load();
  }, [router, currentSpaceId]);

  useEffect(() => {
    if (!hasFolderIdFromQuery) {
      if (folderFilter) {
        setFolderFilter('');
      }
      return;
    }
    const nextFolderFilter = String(folderIdFromQuery);
    if (nextFolderFilter !== folderFilter) {
      setFolderFilter(nextFolderFilter);
    }
  }, [folderFilter, folderIdFromQuery, hasFolderIdFromQuery]);

  const effectiveBoardFilter =
    boardFilter && boards.some((board) => String(board.id) === boardFilter) ? boardFilter : '';

  useEffect(() => {
    const loadBoardCards = async () => {
      if (effectiveBoardFilter) {
        try {
          const data = await getBoard(Number(effectiveBoardFilter));
          setCards(data.cards);
          return;
        } catch (err: unknown) {
          if ((err as { message?: string })?.message === 'UNAUTHORIZED') {
            router.push('/auth/login');
            return;
          }
          setError('Failed to load board cards.');
          return;
        }
      }
      setCards(allCards);
    };
    void loadBoardCards();
  }, [effectiveBoardFilter, allCards, router]);

  const effectiveTagFilter = useMemo(() => {
    if (!tagFilter) return '';
    const hasTag = cards.some((card) => (card.tags ?? []).includes(tagFilter));
    return hasTag ? tagFilter : '';
  }, [tagFilter, cards]);

  const filteredCards = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return cards.filter((card) => {
      if (folderFilter && String(card.folder_id ?? '') !== folderFilter) {
        return false;
      }
      if (effectiveTagFilter) {
        const tags = card.tags ?? [];
        if (!tags.includes(effectiveTagFilter)) return false;
      }
      if (!keyword) return true;
      const haystack = `${card.title} ${card.content ?? ''}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [cards, query, effectiveTagFilter, folderFilter]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    cards.forEach((card) => {
      (card.tags ?? []).forEach((tag) => {
        if (tag.trim()) tags.add(tag);
      });
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [cards]);

  const pageSize = isMobile ? 12 : isXl ? 9 : 6;
  const pageResetKey = `${query}::${folderFilter}::${effectiveBoardFilter}::${tagFilter}::${cards.length}::${isMobile ? 'm' : 'd'}::${isXl ? 'x' : 'n'}::${cardViewMode}`;

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / pageSize));
  const requestedPage = pageState.key === pageResetKey ? pageState.value : 1;
  const currentPage = Math.min(requestedPage, totalPages);
  const pagedCards = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCards.slice(start, start + pageSize);
  }, [filteredCards, currentPage, pageSize]);

  const pagedCardIds = useMemo(() => pagedCards.map((card) => card.id), [pagedCards]);
  const allPagedSelected =
    pagedCardIds.length > 0 && pagedCardIds.every((id) => selectedTableCardIds.includes(id));

  const handleCreate = async (payload: { title: string; content: string; tags: string[]; folder_id: number | null }) => {
    setError('');
    const created = await createCard({
      title: payload.title,
      content: payload.content,
      tags: payload.tags,
      folder_id: payload.folder_id,
      space_id: currentSpaceId,
    });
    const nextAll = [created, ...allCards];
    setAllCards(nextAll);
    if (!effectiveBoardFilter) {
      if (!folderFilter || String(created.folder_id ?? '') === folderFilter) {
        setCards((prev) => [created, ...prev]);
      }
    }
  };

  const handleSave = async (payload: { title: string; content: string; tags: string[]; folder_id: number | null }) => {
    if (!selectedCard) return;
    const updated = await updateCard(selectedCard.id, payload);
    const updateList = (list: Card[]) =>
      list.map((item) => (item.id === updated.id ? updated : item));
    setCards((prev) => updateList(prev));
    setAllCards((prev) => updateList(prev));
    setSelectedCard(updated);
  };

  const handleDelete = async () => {
    if (!selectedCard) return;
    await deleteCard(selectedCard.id);
    const next = (list: Card[]) => list.filter((item) => item.id !== selectedCard.id);
    setCards((prev) => next(prev));
    setAllCards((prev) => next(prev));
    setSelectedCard(null);
  };

  const handleDeleteSelectedTableCards = async () => {
    if (selectedTableCardIds.length === 0) return;
    setShowBatchDeleteConfirm(false);
    setError('');
    setIsBatchDeleting(true);
    const deletingIds = [...selectedTableCardIds];
    const deletingSet = new Set<number>(deletingIds);
    try {
      await Promise.all(deletingIds.map((cardId) => deleteCard(cardId)));
      const removeDeleted = (list: Card[]) => list.filter((item) => !deletingSet.has(item.id));
      setCards((prev) => removeDeleted(prev));
      setAllCards((prev) => removeDeleted(prev));
      if (selectedCard && deletingSet.has(selectedCard.id)) {
        setSelectedCard(null);
        setSelectedBoardLinkedCardIds([]);
      }
      setSelectedTableCardIds([]);
    } catch (err: unknown) {
      if ((err as { message?: string })?.message === 'UNAUTHORIZED') {
        router.push('/auth/login');
        return;
      }
      setError('Failed to delete selected cards.');
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleExportSelectedTableCardsAsZip = async () => {
    if (selectedTableCardIds.length === 0) return;
    setError('');
    setIsBatchExporting(true);
    try {
      const blob = await exportCardsAsMarkdownZip(selectedTableCardIds);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'note-tool-cards.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      if ((err as { message?: string })?.message === 'UNAUTHORIZED') {
        router.push('/auth/login');
        return;
      }
      setError('Failed to export selected cards zip.');
    } finally {
      setIsBatchExporting(false);
    }
  };

  const handleRemoveFromBoardById = async (targetBoardId: number, cardId: number) => {
    await removeCardFromBoard(targetBoardId, cardId);
    if (effectiveBoardFilter && Number(effectiveBoardFilter) === targetBoardId) {
      setCards((prev) => prev.filter((item) => item.id !== cardId));
    }
  };

  const applyCardUpdateToState = useCallback((updated: Card) => {
    const replace = (list: Card[]) => list.map((item) => (item.id === updated.id ? updated : item));
    setCards((prev) => replace(prev));
    setAllCards((prev) => replace(prev));
    setSelectedCard((prev) => (prev && prev.id === updated.id ? updated : prev));
    setTableActionCard((prev) => (prev && prev.id === updated.id ? updated : prev));
  }, []);

  const buildCardUpdatePayload = useCallback(
    (card: Card, patch: { tags?: string[]; folder_id?: number | null }) => ({
      title: card.title,
      content: card.content ?? '',
      tags: patch.tags ?? card.tags ?? [],
      folder_id: patch.folder_id !== undefined ? patch.folder_id : (card.folder_id ?? null),
    }),
    []
  );

  const openTableTagEditor = (card: Card) => {
    setOpenTableActionCardId(null);
    setTableActionCard(card);
    setTableSelectedTags(card.tags ?? []);
    setTableNewTagInput('');
    setTableTagError('');
    setTableTagOpen(true);
  };

  const toggleTableTag = (tag: string) => {
    setTableSelectedTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  };

  const saveTableTags = async () => {
    if (!tableActionCard) return;
    setTableTagSaving(true);
    setTableTagError('');
    const extraTags = tableNewTagInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const nextTags = Array.from(new Set([...tableSelectedTags, ...extraTags]));
    try {
      const updated = await updateCard(tableActionCard.id, buildCardUpdatePayload(tableActionCard, { tags: nextTags }));
      applyCardUpdateToState(updated);
      setTableTagOpen(false);
    } catch (err: unknown) {
      if ((err as { message?: string })?.message === 'UNAUTHORIZED') {
        router.push('/auth/login');
        return;
      }
      setTableTagError('Failed to update tags.');
    } finally {
      setTableTagSaving(false);
    }
  };

  const openTableMoveFolder = (card: Card) => {
    setOpenTableActionCardId(null);
    setTableMoveFolderMode('single');
    setTableActionCard(card);
    setTableMoveFolderValue(card.folder_id ? String(card.folder_id) : '');
    setTableMoveFolderError('');
    setTableMoveFolderOpen(true);
  };

  const openTableBatchMoveFolder = () => {
    if (selectedTableCardIds.length === 0) return;
    setTableMoveFolderMode('batch');
    setTableActionCard(null);
    setTableMoveFolderValue('');
    setTableMoveFolderError('');
    setTableMoveFolderOpen(true);
  };

  const saveTableMoveFolder = async () => {
    if (tableMoveFolderMode === 'single' && !tableActionCard) return;
    if (tableMoveFolderMode === 'batch' && selectedTableCardIds.length === 0) return;
    setTableMoveFolderSaving(true);
    setTableMoveFolderError('');
    const nextFolderId = tableMoveFolderValue ? Number(tableMoveFolderValue) : null;
    try {
      if (tableMoveFolderMode === 'single') {
        const updated = await updateCard(tableActionCard!.id, buildCardUpdatePayload(tableActionCard!, { folder_id: nextFolderId }));
        applyCardUpdateToState(updated);
      } else {
        const selectedCards = selectedTableCardIds
          .map((id) => allCards.find((card) => card.id === id))
          .filter((card): card is Card => Boolean(card));
        const results = await Promise.allSettled(
          selectedCards.map((card) => updateCard(card.id, buildCardUpdatePayload(card, { folder_id: nextFolderId })))
        );
        const successfulUpdates = results
          .filter((result): result is PromiseFulfilledResult<Card> => result.status === 'fulfilled')
          .map((result) => result.value);
        if (successfulUpdates.length > 0) {
          const updatedById = new Map(successfulUpdates.map((card) => [card.id, card]));
          const replace = (list: Card[]) => list.map((item) => updatedById.get(item.id) ?? item);
          setCards((prev) => replace(prev));
          setAllCards((prev) => replace(prev));
          const failedCount = results.length - successfulUpdates.length;
          if (failedCount > 0) {
            setTableMoveFolderError(`Moved ${successfulUpdates.length} cards, failed ${failedCount}.`);
            return;
          }
        } else {
          setTableMoveFolderError('Failed to move selected cards.');
          return;
        }
      }
      setTableMoveFolderOpen(false);
    } catch (err: unknown) {
      if ((err as { message?: string })?.message === 'UNAUTHORIZED') {
        router.push('/auth/login');
        return;
      }
      setTableMoveFolderError('Failed to move card folder.');
    } finally {
      setTableMoveFolderSaving(false);
    }
  };

  const boardTitle = effectiveBoardFilter
    ? boards.find((board) => String(board.id) === effectiveBoardFilter)?.name || 'Selected board'
    : folderFilter
      ? `${folders.find((folder) => String(folder.id) === folderFilter)?.name || 'Selected folder'} · All cards`
      : 'All cards';

  const boardFilterLabel =
    boards.find((board) => String(board.id) === effectiveBoardFilter)?.name || 'All boards';

  const handleOpenModeChange = async (mode: 'modal' | 'sidepanel') => {
    if (isMobile) return;
    setCardOpenMode(mode);
    try {
      await updateUserSettings({ cardOpenMode: mode });
    } catch {
      setError('Failed to update view mode.');
    }
  };

  const handleNavigateOverlayCard = useCallback(
    (targetCardId: number) => {
      const target = allCards.find((item) => item.id === targetCardId) ?? cards.find((item) => item.id === targetCardId);
      if (target) {
        setSelectedCard(target);
        return;
      }
      router.push(`/cards/${targetCardId}`);
    },
    [allCards, cards, router]
  );

  const handleOpenCard = useCallback(
    (card: Card) => {
      if (isMobile) {
        router.push(`/cards/${card.id}`);
        return;
      }
      setSelectedCard(card);
    },
    [isMobile, router]
  );

  const toShareUrl = (token: string) => {
    if (typeof window === 'undefined') return `/shared-card/${token}`;
    return `${window.location.origin}/shared-card/${token}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const openTableShare = async (card: Card) => {
    setOpenTableActionCardId(null);
    setTableActionCard(card);
    setTableShareError('');
    setTableShareBusy(true);
    try {
      const links = await getCardShareLinks(card.id);
      setTableShareLinks(links.filter((link) => !link.revoked_at));
      setTableShareOpen(true);
    } catch (err: unknown) {
      if ((err as { message?: string })?.message === 'UNAUTHORIZED') {
        router.push('/auth/login');
        return;
      }
      setTableShareError('Failed to load share links.');
      setTableShareOpen(true);
    } finally {
      setTableShareBusy(false);
    }
  };

  const createTableShareLink = async () => {
    if (!tableActionCard) return;
    setTableShareError('');
    setTableShareBusy(true);
    try {
      const password = tableSharePassword.trim();
      if (password && (password.length < 6 || password.length > 12)) {
        setTableShareError('Password must be 6-12 characters.');
        return;
      }
      const created = await createCardShareLink(tableActionCard.id, { permission: 'read', password: password || undefined });
      setTableShareLinks((prev) => [created, ...prev]);
      setTableSharePassword('');
      const copied = await copyToClipboard(toShareUrl(created.token));
      if (!copied) {
        setTableShareError('Link created, but copy failed in this browser.');
      }
    } catch (err: unknown) {
      if ((err as { message?: string })?.message === 'UNAUTHORIZED') {
        router.push('/auth/login');
        return;
      }
      setTableShareError('Failed to create share link.');
    } finally {
      setTableShareBusy(false);
    }
  };

  const revokeTableShareLink = async (shareLinkId: number) => {
    if (!tableActionCard) return;
    setTableShareError('');
    setTableShareBusy(true);
    try {
      await revokeCardShareLink(tableActionCard.id, shareLinkId);
      setTableShareLinks((prev) => prev.filter((link) => link.id !== shareLinkId));
    } catch (err: unknown) {
      if ((err as { message?: string })?.message === 'UNAUTHORIZED') {
        router.push('/auth/login');
        return;
      }
      setTableShareError('Failed to revoke share link.');
    } finally {
      setTableShareBusy(false);
    }
  };

  const openTableCopy = async (card: Card) => {
    setOpenTableActionCardId(null);
    setTableActionCard(card);
    setCopyError('');
    setCopySuccessMessage('');
    try {
      const data = await getSpaces();
      setSpaces(data);
      setTableCopyOpen(true);
    } catch (err: unknown) {
      if ((err as { message?: string })?.message === 'UNAUTHORIZED') {
        router.push('/auth/login');
        return;
      }
      setCopyError('Failed to load spaces.');
      setTableCopyOpen(true);
    }
  };

  const openTableBatchCopy = async () => {
    if (selectedTableCardIds.length === 0) return;
    setCopyError('');
    setCopySuccessMessage('');
    try {
      const data = await getSpaces();
      setSpaces(data);
      setTableBatchCopyOpen(true);
    } catch (err: unknown) {
      if ((err as { message?: string })?.message === 'UNAUTHORIZED') {
        router.push('/auth/login');
        return;
      }
      setCopyError('Failed to load spaces.');
      setTableBatchCopyOpen(true);
    }
  };

  const openCopyFolderPicker = async (targetSpaceId: number, mode: 'single' | 'batch') => {
    setCopyError('');
    setCopySuccessMessage('');
    try {
      const target = spaces.find((space) => space.id === targetSpaceId) ?? null;
      const targetFolders = await getCardFolders(targetSpaceId);
      setCopyTargetMode(mode);
      setCopyTargetSpace(target);
      setCopyTargetFolders(targetFolders);
      setCopyTargetFolderValue('');
      setTableCopyOpen(false);
      setTableBatchCopyOpen(false);
      setCopyFolderPickOpen(true);
    } catch (err: unknown) {
      if ((err as { message?: string })?.message === 'UNAUTHORIZED') {
        router.push('/auth/login');
        return;
      }
      setCopyError('Failed to load target folders.');
    }
  };

  const applyFolderToCopiedCard = async (card: Card, targetFolderId: number | null) => {
    if (!targetFolderId) return;
    await updateCard(card.id, {
      title: card.title,
      content: card.content ?? '',
      tags: card.tags ?? [],
      folder_id: targetFolderId,
    });
  };

  const confirmCopyToTargetFolder = async () => {
    if (!copyTargetSpace || !copyTargetMode) return;
    const targetSpaceId = copyTargetSpace.id;
    const targetFolderId = copyTargetFolderValue ? Number(copyTargetFolderValue) : null;
    setCopyError('');
    setCopySuccessMessage('');
    setCopyBusySpaceId(targetSpaceId);
    try {
      if (copyTargetMode === 'single') {
        if (!tableActionCard) return;
        const copied = await copyCardToSpace(tableActionCard.id, targetSpaceId);
        await applyFolderToCopiedCard(copied, targetFolderId);
        setCopySuccessMessage(`Copied as card #${copied.id}.`);
      } else {
        if (selectedTableCardIds.length === 0) return;
        const results = await Promise.allSettled(
          selectedTableCardIds.map(async (cardId) => {
            const copied = await copyCardToSpace(cardId, targetSpaceId);
            await applyFolderToCopiedCard(copied, targetFolderId);
          })
        );
        const successCount = results.filter((result) => result.status === 'fulfilled').length;
        const failedCount = results.length - successCount;
        if (successCount > 0) {
          setCopySuccessMessage(`Copied ${successCount} cards.`);
        }
        if (failedCount > 0) {
          setCopyError(`Failed to copy ${failedCount} cards.`);
        }
      }
      setCopyFolderPickOpen(false);
    } catch (err: unknown) {
      if ((err as { message?: string })?.message === 'UNAUTHORIZED') {
        router.push('/auth/login');
        return;
      }
      setCopyError('Failed to copy card(s).');
    } finally {
      setCopyBusySpaceId(null);
    }
  };

  const openTableRemove = async (card: Card) => {
    setOpenTableActionCardId(null);
    setTableActionCard(card);
    setTableRemoveError('');
    try {
      const memberships = await getCardBoards(card.id);
      setTableRemoveBoards(memberships);
      setTableRemoveOpen(true);
    } catch (err: unknown) {
      if ((err as { message?: string })?.message === 'UNAUTHORIZED') {
        router.push('/auth/login');
        return;
      }
      setTableRemoveError('Failed to load board list.');
      setTableRemoveOpen(true);
    }
  };

  const handleTableRemoveFromBoard = async (boardId: number) => {
    if (!tableActionCard) return;
    setTableRemoveError('');
    setTableRemoveBusyBoardId(boardId);
    try {
      await handleRemoveFromBoardById(boardId, tableActionCard.id);
      setTableRemoveBoards((prev) => prev.filter((board) => board.id !== boardId));
      setTableRemoveOpen(false);
    } catch (err: unknown) {
      if ((err as { message?: string })?.message === 'UNAUTHORIZED') {
        router.push('/auth/login');
        return;
      }
      setTableRemoveError('Failed to remove from board.');
    } finally {
      setTableRemoveBusyBoardId(null);
    }
  };

  const formatCardUpdatedAt = useCallback((card: Card) => {
    const raw = card.updated_at || card.created_at;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  useEffect(() => {
    setSelectedTableCardIds((prev) => prev.filter((id) => filteredCards.some((card) => card.id === id)));
  }, [filteredCards]);

  useEffect(() => {
    if (!selectedCard) return;
    let active = true;
    const loadBoardLinks = async () => {
      try {
        const memberships = await getCardBoards(selectedCard.id);
        const linkGroups = await Promise.all(
          memberships.map(async (board) => {
            const links = await getBoardCardLinks(board.id);
            return links;
          })
        );
        if (!active) return;
        const merged = linkGroups.flat();
        const linked = new Set<number>();
        merged.forEach((link: BoardCardLink) => {
          if (link.source_card_id === selectedCard.id) {
            linked.add(link.target_card_id);
          } else if (link.target_card_id === selectedCard.id) {
            linked.add(link.source_card_id);
          }
        });
        setSelectedBoardLinkedCardIds(Array.from(linked));
      } catch (err: unknown) {
        if ((err as { message?: string })?.message === 'UNAUTHORIZED') {
          router.push('/auth/login');
          return;
        }
        if (!active) return;
        setSelectedBoardLinkedCardIds([]);
      }
    };
    void loadBoardLinks();
    return () => {
      active = false;
    };
  }, [selectedCard, router]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Card Box</div>
          <div className="mt-2 min-h-[20px] text-sm font-semibold text-card-foreground">
            {effectiveBoardFilter || folderFilter ? boardTitle : ''}
          </div>
        </div>
        <div className="flex w-full flex-nowrap items-center justify-end gap-1 sm:w-auto">
          {showSearch && (
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search cards..."
              className="h-9 w-[34vw] min-w-0 max-w-[10rem] rounded-full sm:w-56"
            />
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() =>
              setShowSearch((prev) => {
                const next = !prev;
                if (!next) {
                  setQuery('');
                }
                return next;
              })
            }
            className="h-9 w-9 rounded-full"
            aria-label="Search"
            title="Search"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" fill="none" />
              <path d="M16.2 16.2l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </Button>
          {!isMobile && (
            <Tabs value={cardOpenMode} onValueChange={(value) => void handleOpenModeChange(value as 'modal' | 'sidepanel')}>
              <TabsList className="rounded-full bg-card shadow-sm">
                <TabsTrigger value="modal" className="rounded-full px-3" aria-label="Open in modal" title="Open in modal">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <rect x="5" y="6" width="14" height="12" rx="1.6" stroke="currentColor" strokeWidth="1.6" fill="none" />
                  </svg>
                </TabsTrigger>
                <TabsTrigger value="sidepanel" className="rounded-full px-3" aria-label="Open in side panel" title="Open in side panel">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <rect x="4" y="6" width="16" height="12" rx="1.6" stroke="currentColor" strokeWidth="1.6" fill="none" />
                    <path d="M14 6v12" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          <Tabs value={cardViewMode} onValueChange={(value) => setCardViewMode(value as 'grid' | 'table')}>
            <TabsList className="rounded-full bg-card shadow-sm">
              <TabsTrigger value="grid" className="rounded-full px-3 text-xs">
                Grid
              </TabsTrigger>
              <TabsTrigger value="table" className="rounded-full px-3 text-xs">
                Table
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="max-w-[8.5rem] rounded-full sm:max-w-none">
                <span className="truncate">{boardFilterLabel}</span>
                <svg viewBox="0 0 24 24" className="ml-2 h-3.5 w-3.5" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setBoardFilter('')} className={effectiveBoardFilter === '' ? 'bg-accent' : undefined}>
                All boards
              </DropdownMenuItem>
              {boards.map((board) => (
                <DropdownMenuItem
                  key={board.id}
                  onClick={() => setBoardFilter(String(board.id))}
                  className={String(board.id) === effectiveBoardFilter ? 'bg-accent' : undefined}
                >
                  {board.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="max-w-[8.5rem] rounded-full sm:max-w-none">
                <span className="truncate">{tagFilter || 'All tags'}</span>
                <svg viewBox="0 0 24 24" className="ml-2 h-3.5 w-3.5" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setTagFilter('')} className={tagFilter === '' ? 'bg-accent' : undefined}>
                All tags
              </DropdownMenuItem>
              {availableTags.map((tag) => (
                <DropdownMenuItem
                  key={tag}
                  onClick={() => setTagFilter(tag)}
                  className={tag === tagFilter ? 'bg-accent' : undefined}
                >
                  {tag}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex items-center justify-between">
        {error ? <div className="text-xs text-rose-600">{error}</div> : <div />}
        <div className="flex items-center gap-2">
          {cardViewMode === 'table' && selectedTableCardIds.length > 0 && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void openTableBatchCopy()}
                className="h-8 rounded-full px-3 text-xs"
              >
                {`複製到 Space (${selectedTableCardIds.length})`}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => openTableBatchMoveFolder()}
                disabled={isBatchDeleting || tableMoveFolderSaving}
                className="h-8 rounded-full px-3 text-xs"
              >
                {`批次移動資料夾 (${selectedTableCardIds.length})`}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void handleExportSelectedTableCardsAsZip()}
                disabled={isBatchExporting}
                className="h-8 rounded-full px-3 text-xs"
              >
                {isBatchExporting ? 'Exporting...' : `匯出 zip (${selectedTableCardIds.length})`}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => setShowBatchDeleteConfirm(true)}
                disabled={isBatchDeleting}
                className="h-8 rounded-full px-3 text-xs"
              >
                {isBatchDeleting ? 'Deleting...' : `刪除選取 (${selectedTableCardIds.length})`}
              </Button>
            </>
          )}
          <Badge variant="outline" className="text-[11px] text-muted-foreground">
            {filteredCards.length} cards
          </Badge>
        </div>
      </div>

      <div className="flex h-[calc(100vh-15rem)] flex-col">
        <section className={`${isMobile ? 'flex-1 overflow-y-auto' : 'h-full overflow-hidden'} pr-1`}>
          {cardViewMode === 'grid' ? (
            <div
              className={`grid gap-4 ${
                isMobile ? 'md:grid-cols-2 xl:grid-cols-3' : 'h-full grid-rows-3 md:grid-cols-2 xl:grid-cols-3'
              }`}
            >
              {pagedCards.map((card) => (
                <div key={card.id} className={isMobile ? '' : 'h-full min-h-0 overflow-hidden'}>
                  <CardPreview
                    card={card}
                    previewLength={cardPreviewLength}
                    fillHeight={!isMobile}
                    onSelect={() => handleOpenCard(card)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full overflow-auto rounded-2xl border border-border bg-card">
              <table className="w-full min-w-[680px] border-collapse text-sm">
                <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <tr>
                    <th className="w-12 px-3 py-3 text-center font-medium">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border"
                        checked={allPagedSelected}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setSelectedTableCardIds((prev) => {
                            if (checked) {
                              const merged = new Set<number>([...prev, ...pagedCardIds]);
                              return Array.from(merged);
                            }
                            return prev.filter((id) => !pagedCardIds.includes(id));
                          });
                        }}
                        aria-label="Select all cards on current page"
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Folder</th>
                    <th className="px-4 py-3 font-medium">Tags</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                    <th className="w-14 px-3 py-3 text-right font-medium">...</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedCards.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No cards found.
                      </td>
                    </tr>
                  ) : (
                    pagedCards.map((card) => (
                      <tr
                        key={card.id}
                        onClick={() => handleOpenCard(card)}
                        className="cursor-pointer border-t border-border/70 transition hover:bg-muted/40"
                      >
                        <td className="px-3 py-3 text-center align-middle">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border"
                            checked={selectedTableCardIds.includes(card.id)}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setSelectedTableCardIds((prev) =>
                                checked ? [...prev, card.id] : prev.filter((id) => id !== card.id)
                              );
                            }}
                            aria-label={`Select ${card.title}`}
                          />
                        </td>
                        <td className="max-w-[320px] px-4 py-3 align-middle">
                          <div className="truncate font-medium text-card-foreground">{card.title}</div>
                        </td>
                        <td className="max-w-[220px] px-4 py-3 align-middle">
                          <div className="truncate text-xs text-muted-foreground">
                            {card.folder_id ? folders.find((folder) => folder.id === card.folder_id)?.name ?? '-' : '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="flex flex-wrap gap-1">
                            {(card.tags ?? []).length === 0 ? (
                              <span className="text-xs text-muted-foreground">-</span>
                            ) : (
                              (card.tags ?? []).slice(0, 4).map((tag) => (
                                <span
                                  key={`${card.id}-${tag}`}
                                  className="inline-flex items-center rounded-full border border-border/80 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground"
                                >
                                  {tag}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle text-xs text-muted-foreground">
                          {formatCardUpdatedAt(card)}
                        </td>
                        <td className="px-3 py-3 text-right align-middle">
                          <div onClick={(event) => event.stopPropagation()}>
                            <CardActionsMenu
                              open={openTableActionCardId === card.id}
                              onToggle={() => setOpenTableActionCardId((prev) => (prev === card.id ? null : card.id))}
                              onClose={() => setOpenTableActionCardId(null)}
                              actions={[
                                { id: 'share', label: 'Share card', onClick: () => void openTableShare(card) },
                                { id: 'copy', label: 'Copy to space', onClick: () => void openTableCopy(card) },
                                { id: 'edit-tags', label: 'Edit tags', onClick: () => openTableTagEditor(card) },
                                { id: 'move-folder', label: 'Move folder', onClick: () => openTableMoveFolder(card) },
                                { id: 'remove', label: 'Remove from board', onClick: () => void openTableRemove(card) },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <div className="fixed bottom-1 left-1/2 z-40 -translate-x-1/2 rounded-full border border-border bg-background/95 px-2 py-1 shadow-sm backdrop-blur md:bottom-3">
        <div className="flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setPageState((prev) => ({
                value: Math.max(1, (prev.key === pageResetKey ? prev.value : 1) - 1),
                key: pageResetKey,
              }))
            }
            disabled={currentPage <= 1}
            className="rounded-full"
          >
            Prev
          </Button>
          <div className="text-xs text-muted-foreground">
            {currentPage} / {totalPages}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setPageState((prev) => ({
                value: Math.min(totalPages, (prev.key === pageResetKey ? prev.value : 1) + 1),
                key: pageResetKey,
              }))
            }
            disabled={currentPage >= totalPages}
            className="rounded-full"
          >
            Next
          </Button>
        </div>
      </div>

      {selectedCard && (
        <CardOverlay
          card={selectedCard}
          mode={cardOpenMode}
          onClose={() => {
            setSelectedCard(null);
            setSelectedBoardLinkedCardIds([]);
          }}
          onSave={handleSave}
          onDelete={handleDelete}
          onRemoveFromBoard={async (targetBoardId, targetCardId) => {
            await handleRemoveFromBoardById(targetBoardId, targetCardId);
          }}
          allCards={allCards}
          onNavigateCard={handleNavigateOverlayCard}
          boardLinkedCardIds={selectedBoardLinkedCardIds}
        />
      )}

      {showCreate && (
        <CardCreateOverlay
          mode={cardOpenMode}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
          allCards={allCards}
        />
      )}

      <CardShareLinksModal
        open={tableShareOpen}
        links={tableShareLinks}
        busy={tableShareBusy}
        error={tableShareError}
        sharePassword={tableSharePassword}
        onSharePasswordChange={setTableSharePassword}
        toShareUrl={toShareUrl}
        onClose={() => {
          setTableShareOpen(false);
          setTableShareError('');
        }}
        onCreate={createTableShareLink}
        onCopy={async (url) => {
          const copied = await copyToClipboard(url);
          if (!copied) {
            setTableShareError('Copy failed in this browser. Please copy manually.');
          }
        }}
        onRevoke={revokeTableShareLink}
      />

      <CardCopyToSpaceModal
        open={tableCopyOpen}
        cardTitle={tableActionCard?.title ?? ''}
        spaces={spaces}
        currentSpaceId={currentSpaceId}
        busySpaceId={copyBusySpaceId}
        error={copyError}
        successMessage={copySuccessMessage}
        onClose={() => {
          setTableCopyOpen(false);
          setCopyError('');
          setCopySuccessMessage('');
        }}
        onCopy={(spaceId) => void openCopyFolderPicker(spaceId, 'single')}
      />

      <CardCopyToSpaceModal
        open={tableBatchCopyOpen}
        cardTitle={`Copy ${selectedTableCardIds.length} selected cards`}
        spaces={spaces}
        currentSpaceId={currentSpaceId}
        busySpaceId={copyBusySpaceId}
        error={copyError}
        successMessage={copySuccessMessage}
        onClose={() => {
          setTableBatchCopyOpen(false);
          setCopyError('');
          setCopySuccessMessage('');
        }}
        onCopy={(spaceId) => void openCopyFolderPicker(spaceId, 'batch')}
      />

      <Dialog open={copyFolderPickOpen} onOpenChange={setCopyFolderPickOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>選擇資料夾</DialogTitle>
            <DialogDescription>
              目標 Space：{copyTargetSpace?.name ?? '-'}。請選擇要放入的資料夾。
            </DialogDescription>
          </DialogHeader>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-between" disabled={copyBusySpaceId !== null}>
                <span className="truncate">
                  {copyTargetFolderValue
                    ? copyTargetFolders.find((folder) => String(folder.id) === copyTargetFolderValue)?.name ?? 'Unknown folder'
                    : 'No folder'}
                </span>
                <svg viewBox="0 0 24 24" className="ml-2 h-3.5 w-3.5" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[16rem]">
              <DropdownMenuItem onClick={() => setCopyTargetFolderValue('')}>No folder</DropdownMenuItem>
              {copyTargetFolders.map((folder) => (
                <DropdownMenuItem key={folder.id} onClick={() => setCopyTargetFolderValue(String(folder.id))}>
                  {folder.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {copyError ? <div className="text-xs text-rose-600">{copyError}</div> : null}
          {copySuccessMessage ? <div className="text-xs text-emerald-600">{copySuccessMessage}</div> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCopyFolderPickOpen(false);
                setCopyError('');
                setCopySuccessMessage('');
              }}
              disabled={copyBusySpaceId !== null}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void confirmCopyToTargetFolder()} disabled={copyBusySpaceId !== null}>
              {copyBusySpaceId !== null ? 'Copying...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CardRemoveFromBoardModal
        open={tableRemoveOpen}
        cardTitle={tableActionCard?.title ?? ''}
        boards={tableRemoveBoards}
        busyBoardId={tableRemoveBusyBoardId}
        error={tableRemoveError}
        onClose={() => {
          setTableRemoveOpen(false);
          setTableRemoveError('');
        }}
        onRemove={handleTableRemoveFromBoard}
      />

      <AlertDialog open={showBatchDeleteConfirm} onOpenChange={setShowBatchDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除選取卡片？</AlertDialogTitle>
            <AlertDialogDescription>
              這個操作會永久刪除 {selectedTableCardIds.length} 張卡片，且無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBatchDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDeleteSelectedTableCards()}
              disabled={isBatchDeleting}
            >
              {isBatchDeleting ? '刪除中...' : '確認刪除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={tableTagOpen} onOpenChange={setTableTagOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit tags</DialogTitle>
            <DialogDescription>Select existing tags and optionally add new tags.</DialogDescription>
          </DialogHeader>
          <div className="max-h-40 space-y-2 overflow-auto rounded-md border border-border p-3">
            {availableTags.length === 0 ? (
              <div className="text-xs text-muted-foreground">No existing tags</div>
            ) : (
              availableTags.map((tag) => (
                <label key={tag} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border"
                    checked={tableSelectedTags.includes(tag)}
                    onChange={() => toggleTableTag(tag)}
                    disabled={tableTagSaving}
                  />
                  <span>{tag}</span>
                </label>
              ))
            )}
          </div>
          <Input
            value={tableNewTagInput}
            onChange={(event) => setTableNewTagInput(event.target.value)}
            placeholder="Add new tags, comma separated"
            disabled={tableTagSaving}
          />
          {tableTagError ? <div className="text-xs text-rose-600">{tableTagError}</div> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTableTagOpen(false)} disabled={tableTagSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveTableTags()} disabled={tableTagSaving}>
              {tableTagSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tableMoveFolderOpen} onOpenChange={setTableMoveFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tableMoveFolderMode === 'batch' ? '批次移動資料夾' : 'Move folder'}</DialogTitle>
            <DialogDescription>
              {tableMoveFolderMode === 'batch'
                ? `選擇目標資料夾，將一次更新 ${selectedTableCardIds.length} 張卡片。`
                : 'Select target card folder.'}
            </DialogDescription>
          </DialogHeader>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-between" disabled={tableMoveFolderSaving}>
                <span className="truncate">
                  {tableMoveFolderValue
                    ? folders.find((folder) => String(folder.id) === tableMoveFolderValue)?.name ?? 'Unknown folder'
                    : 'No folder'}
                </span>
                <svg viewBox="0 0 24 24" className="ml-2 h-3.5 w-3.5" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[16rem]">
              <DropdownMenuItem onClick={() => setTableMoveFolderValue('')}>No folder</DropdownMenuItem>
              {folders.map((folder) => (
                <DropdownMenuItem key={folder.id} onClick={() => setTableMoveFolderValue(String(folder.id))}>
                  {folder.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {tableMoveFolderError ? <div className="text-xs text-rose-600">{tableMoveFolderError}</div> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTableMoveFolderOpen(false)} disabled={tableMoveFolderSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveTableMoveFolder()} disabled={tableMoveFolderSaving}>
              {tableMoveFolderSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button
        type="button"
        onClick={() => {
          if (isMobile) {
            router.push('/cards/new');
            return;
          }
          setShowCreate(true);
        }}
        size="icon"
        className="fixed bottom-6 right-6 h-12 w-12 rounded-full text-2xl font-semibold shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
        aria-label="Create card"
      >
        +
      </Button>
    </div>
  );
}
