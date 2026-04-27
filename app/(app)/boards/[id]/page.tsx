'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import CardOverlay from '../../../../components/CardOverlay';
import CardCreateOverlay from '../../../../components/CardCreateOverlay';
import CardPreview from '../../../../components/CardPreview';
import {
  addExistingCardToBoard,
  BoardCardLink,
  BoardCardLinkHandle,
  BoardShareLink,
  Board,
  BoardRegion as ApiBoardRegion,
  Card,
  copyBoardToSpace,
  createBoardCardLink,
  createBoardRegion,
  createBoardShareLink,
  createCardInBoard,
  deleteBoardCardLink,
  deleteBoardRegion,
  deleteBoard,
  deleteCard,
  getBoardShareLinks,
  getBoard,
  getBoardRegions,
  getCards,
  getSpaces,
  Space,
  getUserSettings,
  removeCardFromBoard,
  updateBoardRegion,
  revokeBoardShareLink,
  updateBoardCardPosition,
  updateBoard,
  updateCard,
  updateUserSettings,
} from '../../../../lib/noteToolApi';
import { useCurrentSpace } from '../../../../hooks/useCurrentSpace';
import BoardCopyToSpaceModal from '../../../../components/boards/BoardCopyToSpaceModal';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Textarea } from '../../../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '../../../../components/ui/tabs';

type BoardRegionView = {
  id: number;
  name: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type DraftRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type LinkDraft = {
  sourceCardId: number;
  sourceHandle: BoardCardLinkHandle;
  pointerX: number;
  pointerY: number;
};

const DEFAULT_REGION_COLOR = '#737373';
const REGION_COLOR_PRESETS = [
  '#a3a3a3',
  '#8a8a8a',
  '#737373',
  '#5a5a5a',
  '#4a4a4a',
  '#3f3f3f',
  '#2f2f2f',
  '#1f1f1f',
];

function normalizeRegionColor(color: string | null | undefined): string {
  if (typeof color !== 'string') return DEFAULT_REGION_COLOR;
  const trimmed = color.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : DEFAULT_REGION_COLOR;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = normalizeRegionColor(hex);
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function isUnauthorizedError(error: unknown): boolean {
  return error instanceof Error && error.message === 'UNAUTHORIZED';
}

function parseInternalCardId(href: string | null): number | null {
  if (!href) return null;
  const match = href.match(/^\/cards\/(\d+)(?:[/?#].*)?$/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) ? id : null;
}

function findCardById(cards: Card[], targetCardId: number): Card | null {
  const normalizedTargetId = Number(targetCardId);
  return cards.find((item) => Number(item.id) === normalizedTargetId) ?? null;
}

export default function BoardDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentSpaceId } = useCurrentSpace();
  const boardId = Number(params.id);
  const toolbarStorageKey = 'note_tool_board_toolbar_visible';
  const [isMobile, setIsMobile] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [positions, setPositions] = useState<Record<number, { x: number; y: number; width?: number | null }>>({});
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [boardName, setBoardName] = useState('');
  const [cardOpenMode, setCardOpenMode] = useState<'modal' | 'sidepanel'>('modal');
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showCreateChooser, setShowCreateChooser] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [spawnPoint, setSpawnPoint] = useState<{ x: number; y: number } | null>(null);
  const [tool, setTool] = useState<'pan' | 'add' | 'region'>('add');
  const [selectedImportIds, setSelectedImportIds] = useState<Set<number>>(new Set());
  const [importQuery, setImportQuery] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [showToolbar, setShowToolbar] = useState<boolean>(false);
  const [showBoardMenu, setShowBoardMenu] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [tagValue, setTagValue] = useState('');
  const [descriptionValue, setDescriptionValue] = useState('');
  const [boardSummary, setBoardSummary] = useState<Board | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [shareLinks, setShareLinks] = useState<BoardShareLink[]>([]);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState('');
  const [sharePassword, setSharePassword] = useState('');
  const [showSharePassword, setShowSharePassword] = useState(false);
  const [showCopyToSpace, setShowCopyToSpace] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [copyBusySpaceId, setCopyBusySpaceId] = useState<number | null>(null);
  const [copyError, setCopyError] = useState('');
  const [copySuccessMessage, setCopySuccessMessage] = useState('');
  const [regions, setRegions] = useState<BoardRegionView[]>([]);
  const [boardLinks, setBoardLinks] = useState<BoardCardLink[]>([]);
  const [linkDraft, setLinkDraft] = useState<LinkDraft | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<number | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<number | null>(null);
  const [draftRegion, setDraftRegion] = useState<DraftRegion | null>(null);
  const [showRegionName, setShowRegionName] = useState(false);
  const [regionNameValue, setRegionNameValue] = useState('');
  const [regionColorValue, setRegionColorValue] = useState(DEFAULT_REGION_COLOR);
  const [regionNameError, setRegionNameError] = useState('');
  const [pendingRegion, setPendingRegion] = useState<DraftRegion | null>(null);
  const [editingRegionId, setEditingRegionId] = useState<number | null>(null);
  const [flashCardId, setFlashCardId] = useState<number | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const defaultCardWidth = 420;
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const viewportRef = useRef(viewport);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const dragRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    pointerX: number;
    pointerY: number;
  } | null>(null);
  const resizeRef = useRef<{
    id: number;
    startWidth: number;
    pointerX: number;
  } | null>(null);
  const regionDrawRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const regionTouchRef = useRef<{
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
  } | null>(null);
  const regionResizeRef = useRef<{
    id: number;
    pointerId: number;
    startWidth: number;
    startHeight: number;
    startPointerX: number;
    startPointerY: number;
    latestWidth: number;
    latestHeight: number;
  } | null>(null);
  const regionDragRef = useRef<{
    id: number;
    pointerId: number;
    startX: number;
    startY: number;
    startPointerX: number;
    startPointerY: number;
    latestX: number;
    latestY: number;
  } | null>(null);
  const touchStateRef = useRef<{
    mode: 'pan' | 'pinch' | null;
    startX: number;
    startY: number;
    startVx: number;
    startVy: number;
    startScale: number;
    startDist: number;
    moved: boolean;
    target: EventTarget | null;
  }>({
    mode: null,
    startX: 0,
    startY: 0,
    startVx: 0,
    startVy: 0,
    startScale: 1,
    startDist: 0,
    moved: false,
    target: null,
  });
  const suppressNextStageClickRef = useRef(false);

  const mapApiRegionToView = (region: ApiBoardRegion): BoardRegionView => ({
    id: region.id,
    name: region.name,
    color: normalizeRegionColor(region.color),
    x: region.x_pos,
    y: region.y_pos,
    width: region.width,
    height: region.height,
  });

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const handleChange = () => {
      setIsMobile(media.matches);
      if (media.matches) {
        setCardOpenMode('sidepanel');
      }
    };
    handleChange();
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    try {
      setShowToolbar(window.localStorage.getItem(toolbarStorageKey) === '1');
    } catch {
      // Ignore storage errors in strict browser contexts
    }
  }, [toolbarStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(toolbarStorageKey, showToolbar ? '1' : '0');
    } catch {
      // Ignore storage errors in strict browser contexts
    }
  }, [showToolbar]);

  useEffect(() => {
    const load = async () => {
      try {
        const [boardData, cardsData, settingsData, regionsData] = await Promise.all([
          getBoard(boardId),
          getCards(currentSpaceId),
          getUserSettings(),
          getBoardRegions(boardId),
        ]);
        setBoardSummary(boardData.board);
        setBoardName(boardData.board.name);
        setRenameValue(boardData.board.name);
        setTagValue((boardData.board.tags ?? []).join(', '));
        setDescriptionValue(boardData.board.description ?? '');
        setCards(boardData.cards);
        setAllCards(cardsData);
        const nextPositions: Record<number, { x: number; y: number; width?: number | null }> = {};
        boardData.cards.forEach((card) => {
          const x = typeof card.x_pos === 'number' ? card.x_pos : 0;
          const y = typeof card.y_pos === 'number' ? card.y_pos : 0;
          nextPositions[card.id] = {
            x,
            y,
            width: typeof card.width === 'number' ? card.width : null,
          };
        });
        setPositions(nextPositions);
        if (settingsData?.cardOpenMode) {
          setCardOpenMode(settingsData.cardOpenMode);
        }
        setRegions(regionsData.map(mapApiRegionToView));
        setBoardLinks(boardData.links ?? []);
      } catch (err: unknown) {
        if (isUnauthorizedError(err)) {
          router.push('/auth/login');
          return;
        }
        setError('Failed to load board.');
      }
    };
    if (Number.isFinite(boardId)) {
      load();
    }
  }, [boardId, router, currentSpaceId]);

  useEffect(() => {
    if (!boardSummary) return;
    const nextFolderId = boardSummary.folder_id ? String(boardSummary.folder_id) : '';
    const currentFolderId = searchParams.get('folderId') ?? '';
    if (currentFolderId === nextFolderId) return;
    const nextUrl = nextFolderId ? `/boards/${boardId}?folderId=${nextFolderId}` : `/boards/${boardId}`;
    router.replace(nextUrl);
  }, [boardId, boardSummary, router, searchParams]);

  const searchResults = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return cards;
    return cards.filter((card) => {
      const haystack = `${card.title} ${card.content ?? ''}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [cards, query]);

  const importCandidates = useMemo(() => {
    const keyword = importQuery.trim().toLowerCase();
    const inBoard = new Set(cards.map((card) => card.id));
    return allCards.filter((card) => {
      if (inBoard.has(card.id)) return false;
      if (!keyword) return true;
      const haystack = `${card.title} ${card.content ?? ''}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [allCards, cards, importQuery]);

  const getCardAnchorPoint = useCallback(
    (cardId: number, handle: BoardCardLinkHandle) => {
      const pos = positions[cardId] ?? { x: 0, y: 0, width: null };
      const width = pos.width ?? defaultCardWidth;
      const height = cardRefs.current[cardId]?.offsetHeight ?? 220;
      const centerX = pos.x + width / 2;
      const centerY = pos.y + height / 2;
      if (handle === 'top') return { x: centerX, y: pos.y };
      if (handle === 'right') return { x: pos.x + width, y: centerY };
      if (handle === 'bottom') return { x: centerX, y: pos.y + height };
      return { x: pos.x, y: centerY };
    },
    [positions]
  );

  const getNearestHandleForCard = useCallback(
    (cardId: number, worldX: number, worldY: number): BoardCardLinkHandle => {
      const handles: BoardCardLinkHandle[] = ['top', 'right', 'bottom', 'left'];
      let nearest: BoardCardLinkHandle = 'right';
      let nearestDistance = Number.POSITIVE_INFINITY;
      handles.forEach((handle) => {
        const point = getCardAnchorPoint(cardId, handle);
        const dx = point.x - worldX;
        const dy = point.y - worldY;
        const distance = dx * dx + dy * dy;
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = handle;
        }
      });
      return nearest;
    },
    [getCardAnchorPoint]
  );

  const visibleBoardLinks = useMemo(() => {
    const cardIdSet = new Set(cards.map((item) => item.id));
    return boardLinks.filter(
      (link) => cardIdSet.has(link.source_card_id) && cardIdSet.has(link.target_card_id)
    );
  }, [boardLinks, cards]);

  const handleCreate = async (payload: { title: string; content: string; tags: string[] }) => {
    setError('');
    const data = await createCardInBoard(boardId, payload);
    setCards((prev) => [data.card, ...prev]);
    setAllCards((prev) => {
      const exists = prev.some((item) => item.id === data.card.id);
      if (exists) {
        return prev.map((item) => (item.id === data.card.id ? data.card : item));
      }
      return [data.card, ...prev];
    });
    setPositions((prev) => ({
      ...prev,
      [data.card.id]: {
        ...(spawnPoint ?? { x: 0, y: 0 }),
        width: null,
      },
    }));
    setSpawnPoint(null);
  };

  const openCreatePageFromBoard = (point?: { x: number; y: number }) => {
    const params = new URLSearchParams();
    params.set('boardId', String(boardId));
    if (point) {
      params.set('x', String(Math.round(point.x)));
      params.set('y', String(Math.round(point.y)));
    }
    router.push(`/cards/new?${params.toString()}`);
  };

  const openCreateChooserAtPoint = (point: { x: number; y: number }) => {
    setSpawnPoint(point);
    setShowCreateChooser(true);
  };

  const handleImportBatch = async () => {
    if (selectedImportIds.size === 0) return;
    setError('');
    const selected = importCandidates.filter((card) => selectedImportIds.has(card.id));
    const base = spawnPoint ?? { x: 0, y: 0 };
    await Promise.all(selected.map((card) => addExistingCardToBoard(boardId, card.id)));
    setCards((prev) => [...selected, ...prev]);
    setPositions((prev) => {
      const next = { ...prev };
      selected.forEach((card, index) => {
        const offsetX = (index % 3) * 40;
        const offsetY = Math.floor(index / 3) * 40;
        next[card.id] = {
          x: base.x + offsetX,
          y: base.y + offsetY,
          width: null,
        };
      });
      return next;
    });
    setSelectedImportIds(new Set());
    setSpawnPoint(null);
    setShowImport(false);
  };

  const handleSave = async (payload: { title: string; content: string; tags: string[] }) => {
    if (!selectedCard) return;
    const updated = await updateCard(selectedCard.id, payload);
    setCards((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setAllCards((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setSelectedCard(updated);
  };

  const handleRemoveFromBoard = async (targetBoardId: number, targetCardId: number) => {
    await removeCardFromBoard(targetBoardId, targetCardId);
    const normalizedBoardId = Number(targetBoardId);
    const normalizedCurrentBoardId = Number(boardId);
    const normalizedCardId = Number(targetCardId);
    if (normalizedBoardId === normalizedCurrentBoardId) {
      setCards((prev) => prev.filter((item) => Number(item.id) !== normalizedCardId));
      setBoardLinks((prev) =>
        prev.filter(
          (link) => link.source_card_id !== normalizedCardId && link.target_card_id !== normalizedCardId
        )
      );
      setPositions((prev) => {
        const next = { ...prev };
        delete next[normalizedCardId];
        return next;
      });
      setSelectedCard((prev) => (Number(prev?.id) === normalizedCardId ? null : prev));
    }
  };

  const handleDeleteSelectedCard = async () => {
    if (!selectedCard) return;
    await deleteCard(selectedCard.id);
    setCards((prev) => prev.filter((item) => item.id !== selectedCard.id));
    setAllCards((prev) => prev.filter((item) => item.id !== selectedCard.id));
    setBoardLinks((prev) =>
      prev.filter(
        (link) => link.source_card_id !== selectedCard.id && link.target_card_id !== selectedCard.id
      )
    );
    setPositions((prev) => {
      const next = { ...prev };
      delete next[selectedCard.id];
      return next;
    });
    setSelectedCard(null);
  };

  const handleCreateBoardLink = useCallback(
    async (
      sourceCardId: number,
      targetCardId: number,
      sourceHandle: BoardCardLinkHandle,
      targetHandle: BoardCardLinkHandle
    ) => {
      try {
        const created = await createBoardCardLink(boardId, {
          source_card_id: sourceCardId,
          target_card_id: targetCardId,
          source_handle: sourceHandle,
          target_handle: targetHandle,
        });
        setBoardLinks((prev) => {
          const existingIndex = prev.findIndex((item) => item.id === created.id);
          if (existingIndex >= 0) {
            const next = [...prev];
            next[existingIndex] = created;
            return next;
          }
          return [...prev, created];
        });
        suppressNextStageClickRef.current = true;
      } catch {
        setError('Failed to save card link.');
      }
    },
    [boardId]
  );

  const handleDeleteBoardLink = useCallback(
    async (linkId: number) => {
      try {
        await deleteBoardCardLink(boardId, linkId);
        setBoardLinks((prev) => prev.filter((item) => item.id !== linkId));
      } catch {
        setError('Failed to delete card link.');
      }
    },
    [boardId]
  );

  const handleStartLinkDraft = useCallback(
    (cardId: number, handle: BoardCardLinkHandle) => {
      const point = getCardAnchorPoint(cardId, handle);
      suppressNextStageClickRef.current = true;
      setLinkDraft({
        sourceCardId: cardId,
        sourceHandle: handle,
        pointerX: point.x,
        pointerY: point.y,
      });
    },
    [getCardAnchorPoint]
  );

  const openLinkedCardInContext = useCallback(
    async (targetCardId: number) => {
      const existing =
        findCardById(allCards, targetCardId) ??
        findCardById(cards, targetCardId) ??
        null;
      if (existing) {
        setSelectedCard(existing);
        return;
      }

      try {
        const latestCards = await getCards();
        setAllCards(latestCards);
        const found =
          findCardById(latestCards, targetCardId) ??
          findCardById(cards, targetCardId) ??
          null;
        if (found) {
          setSelectedCard(found);
          return;
        }
      } catch (err: unknown) {
        if (isUnauthorizedError(err)) {
          router.push('/auth/login');
          return;
        }
      }

      setError('Linked card not found.');
    },
    [allCards, cards, router]
  );

  const handleBoardCardContentClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.('a');
      if (!anchor) return;
      const internalCardId = parseInternalCardId(anchor.getAttribute('href'));
      event.preventDefault();
      event.stopPropagation();
      if (internalCardId) {
        void openLinkedCardInContext(internalCardId);
        return;
      }
      const href = anchor.getAttribute('href');
      if (href) {
        window.open(href, '_blank', 'noopener,noreferrer');
      }
    },
    [openLinkedCardInContext]
  );

  const handleNavigateOverlayCard = useCallback(
    (targetCardId: number) => {
      void openLinkedCardInContext(targetCardId);
    },
    [openLinkedCardInContext]
  );

  const finalizeRegionFromBounds = useCallback((startX: number, startY: number, endX: number, endY: number) => {
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    setDraftRegion(null);
    if (width < 40 || height < 30) {
      return;
    }

    setPendingRegion({
      x: Math.round(left),
      y: Math.round(top),
      width: Math.round(width),
      height: Math.round(height),
    });
    setEditingRegionId(null);
    setRegionNameError('');
    setRegionNameValue(`Region ${regions.length + 1}`);
    setRegionColorValue(DEFAULT_REGION_COLOR);
    setShowRegionName(true);
  }, [regions.length]);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    if (!linkDraft) return;
    const handlePointerMove = (event: PointerEvent) => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) return;
      const worldX = (event.clientX - rect.left - viewportRef.current.x) / viewportRef.current.scale;
      const worldY = (event.clientY - rect.top - viewportRef.current.y) / viewportRef.current.scale;
      setLinkDraft((prev) => (prev ? { ...prev, pointerX: worldX, pointerY: worldY } : prev));
    };
    const handlePointerUp = () => {
      setLinkDraft(null);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [linkDraft]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const handleWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement;
      if (event.shiftKey && target?.closest?.('[data-card=\"true\"]')) {
        return;
      }
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      const { x: offsetX, y: offsetY, scale } = viewportRef.current;
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const nextScale = Math.min(2.2, Math.max(0.25, scale - event.deltaY * 0.001));
      const worldX = (pointerX - offsetX) / scale;
      const worldY = (pointerY - offsetY) / scale;
      const nextX = pointerX - worldX * nextScale;
      const nextY = pointerY - worldY * nextScale;
      setViewport({ x: nextX, y: nextY, scale: nextScale });
    };
    stage.addEventListener('wheel', handleWheel, { passive: false });
    return () => stage.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const getDistance = (a: Touch, b: Touch) => {
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      return Math.hypot(dx, dy);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (!stageRef.current) return;
      const target = event.target as HTMLElement;
      if (target?.closest?.('[data-card="true"]')) return;
      if (target?.closest?.('[data-region="true"]')) return;
      const touches = event.touches;
      if (tool === 'region' && touches.length === 1) {
        const rect = stage.getBoundingClientRect();
        const touch = touches[0];
        const worldX = (touch.clientX - rect.left - viewportRef.current.x) / viewportRef.current.scale;
        const worldY = (touch.clientY - rect.top - viewportRef.current.y) / viewportRef.current.scale;
        regionTouchRef.current = {
          startX: worldX,
          startY: worldY,
          lastX: worldX,
          lastY: worldY,
        };
        setDraftRegion({
          x: worldX,
          y: worldY,
          width: 0,
          height: 0,
        });
        touchStateRef.current.mode = null;
        return;
      }
      if (touches.length === 1) {
        const touch = touches[0];
        touchStateRef.current = {
          mode: 'pan',
          startX: touch.clientX,
          startY: touch.clientY,
          startVx: viewportRef.current.x,
          startVy: viewportRef.current.y,
          startScale: viewportRef.current.scale,
          startDist: 0,
          moved: false,
          target: event.target,
        };
      } else if (touches.length === 2) {
        const dist = getDistance(touches[0], touches[1]);
        touchStateRef.current = {
          mode: 'pinch',
          startX: 0,
          startY: 0,
          startVx: viewportRef.current.x,
          startVy: viewportRef.current.y,
          startScale: viewportRef.current.scale,
          startDist: dist,
          moved: true,
          target: event.target,
        };
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (tool === 'region' && regionTouchRef.current && event.touches.length === 1) {
        event.preventDefault();
        const rect = stage.getBoundingClientRect();
        const touch = event.touches[0];
        const worldX = (touch.clientX - rect.left - viewportRef.current.x) / viewportRef.current.scale;
        const worldY = (touch.clientY - rect.top - viewportRef.current.y) / viewportRef.current.scale;
        regionTouchRef.current.lastX = worldX;
        regionTouchRef.current.lastY = worldY;
        const left = Math.min(regionTouchRef.current.startX, worldX);
        const top = Math.min(regionTouchRef.current.startY, worldY);
        const width = Math.abs(worldX - regionTouchRef.current.startX);
        const height = Math.abs(worldY - regionTouchRef.current.startY);
        setDraftRegion({
          x: left,
          y: top,
          width,
          height,
        });
        return;
      }
      const state = touchStateRef.current;
      if (!state.mode) return;
      const touches = event.touches;
      if (state.mode === 'pan' && touches.length === 1) {
        const touch = touches[0];
        const dx = touch.clientX - state.startX;
        const dy = touch.clientY - state.startY;
        if (Math.abs(dx) + Math.abs(dy) > 4) {
          state.moved = true;
        }
        event.preventDefault();
        setViewport({
          x: state.startVx + dx,
          y: state.startVy + dy,
          scale: state.startScale,
        });
      } else if (state.mode === 'pinch' && touches.length === 2) {
        event.preventDefault();
        const rect = stage.getBoundingClientRect();
        const midX = (touches[0].clientX + touches[1].clientX) / 2 - rect.left;
        const midY = (touches[0].clientY + touches[1].clientY) / 2 - rect.top;
        const dist = getDistance(touches[0], touches[1]);
        const scale = state.startScale;
        const nextScale = Math.min(2.2, Math.max(0.25, scale * (dist / state.startDist)));
        const worldX = (midX - state.startVx) / scale;
        const worldY = (midY - state.startVy) / scale;
        const nextX = midX - worldX * nextScale;
        const nextY = midY - worldY * nextScale;
        setViewport({ x: nextX, y: nextY, scale: nextScale });
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (tool === 'region' && regionTouchRef.current) {
        const drawing = regionTouchRef.current;
        regionTouchRef.current = null;
        finalizeRegionFromBounds(drawing.startX, drawing.startY, drawing.lastX, drawing.lastY);
        return;
      }
      const state = touchStateRef.current;
      if (!state.mode) return;
      if (state.mode === 'pan' && !state.moved && tool === 'add') {
        const target = state.target as HTMLElement | null;
        if (target?.closest?.('[data-card="true"]')) {
          touchStateRef.current.mode = null;
          return;
        }
        const rect = stage.getBoundingClientRect();
        const touch = event.changedTouches[0];
        if (touch && rect) {
          const worldX = (touch.clientX - rect.left - viewportRef.current.x) / viewportRef.current.scale;
          const worldY = (touch.clientY - rect.top - viewportRef.current.y) / viewportRef.current.scale;
          openCreateChooserAtPoint({ x: Math.round(worldX), y: Math.round(worldY) });
        }
      }
      touchStateRef.current.mode = null;
    };

    stage.addEventListener('touchstart', handleTouchStart, { passive: true });
    stage.addEventListener('touchmove', handleTouchMove, { passive: false });
    stage.addEventListener('touchend', handleTouchEnd, { passive: true });
    stage.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    return () => {
      stage.removeEventListener('touchstart', handleTouchStart);
      stage.removeEventListener('touchmove', handleTouchMove);
      stage.removeEventListener('touchend', handleTouchEnd);
      stage.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [tool, finalizeRegionFromBounds]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName?.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select';
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'v') {
        setTool('pan');
      } else if (key === 'e') {
        setTool('add');
      } else if (key === 'r') {
        setTool('region');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (tool !== 'add' && linkDraft) {
      setLinkDraft(null);
    }
  }, [tool, linkDraft]);

  const beginPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button === 1) {
      event.preventDefault();
    } else if (tool === 'pan') {
      if (event.button !== 0) return;
    } else if (tool === 'add') {
      if (event.button !== 1) return;
    } else if (tool === 'region') {
      return;
    } else {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest('[data-card="true"]')) return;
    setIsPanning(true);
    panStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      vx: viewport.x,
      vy: viewport.y,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const movePan = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = panStartRef.current;
    if (!isPanning || !start) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    setViewport((prev) => ({
      ...prev,
      x: start.vx + deltaX,
      y: start.vy + deltaY,
    }));
  };

  const endPan = (event: React.PointerEvent<HTMLDivElement>) => {
    setIsPanning(false);
    panStartRef.current = null;
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
  };

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>, cardId: number) => {
    if (tool !== 'add') return;
    const target = event.target as HTMLElement | null;
    if (target?.closest?.('a')) return;
    if (target?.closest?.('button')) return;
    if (target?.closest?.('input, textarea, select')) return;
    event.stopPropagation();
    if (resizeRef.current) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pointerX = (event.clientX - rect.left - viewport.x) / viewport.scale;
    const pointerY = (event.clientY - rect.top - viewport.y) / viewport.scale;
    const current = positions[cardId] || { x: 0, y: 0 };
    dragRef.current = {
      id: cardId,
      startX: current.x,
      startY: current.y,
      pointerX,
      pointerY,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragging = dragRef.current;
    if (!dragging) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pointerX = (event.clientX - rect.left - viewport.x) / viewport.scale;
    const pointerY = (event.clientY - rect.top - viewport.y) / viewport.scale;
    const dx = pointerX - dragging.pointerX;
    const dy = pointerY - dragging.pointerY;
    setPositions((prev) => ({
      ...prev,
      [dragging.id]: {
        ...(prev[dragging.id] ?? { x: 0, y: 0 }),
        x: dragging.startX + dx,
        y: dragging.startY + dy,
      },
    }));
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragging = dragRef.current;
    dragRef.current = null;
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    if (dragging) {
      const pos = positions[dragging.id];
      if (pos) {
        updateBoardCardPosition(boardId, dragging.id, {
          x_pos: Math.round(pos.x),
          y_pos: Math.round(pos.y),
        }).catch(() => {
          setError('Failed to save card position.');
        });
      }
    }
  };

  const startResize = (event: React.PointerEvent<HTMLDivElement>, cardId: number) => {
    if (tool !== 'add') return;
    event.stopPropagation();
    const el = cardRefs.current[cardId];
    if (!el) return;
    resizeRef.current = {
      id: cardId,
      startWidth: el.offsetWidth,
      pointerX: event.clientX,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const applyResize = (clientX: number) => {
    const resizing = resizeRef.current;
    if (!resizing) return;
    const scale = viewportRef.current.scale || 1;
    const dx = (clientX - resizing.pointerX) / scale;
    const nextWidth = Math.max(320, Math.round(resizing.startWidth + dx));
    setPositions((prev) => ({
      ...prev,
      [resizing.id]: {
        ...(prev[resizing.id] ?? { x: 0, y: 0 }),
        width: nextWidth,
      },
    }));
  };

  const endResize = (event?: React.PointerEvent<HTMLDivElement>) => {
    const resizing = resizeRef.current;
    resizeRef.current = null;
    if (!resizing) return;
    const pos = positions[resizing.id];
    if (!pos) return;
    updateBoardCardPosition(boardId, resizing.id, {
      width: pos.width ?? null,
    }).catch(() => {
      setError('Failed to save card size.');
    });
    if (event) {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    }
  };

  const closeRegionNameModal = () => {
    setShowRegionName(false);
    setRegionNameValue('');
    setRegionColorValue(DEFAULT_REGION_COLOR);
    setRegionNameError('');
    setPendingRegion(null);
    setEditingRegionId(null);
  };

  const handleSaveRegionName = async () => {
    const name = regionNameValue.trim();
    if (!name) {
      setRegionNameError('Region name is required.');
      return;
    }

    try {
      if (editingRegionId) {
        const updated = await updateBoardRegion(boardId, editingRegionId, { name, color: regionColorValue });
        const updatedRegion = mapApiRegionToView(updated);
        setRegions((prev) =>
          prev.map((region) => (region.id === editingRegionId ? updatedRegion : region))
        );
        closeRegionNameModal();
        return;
      }

      if (!pendingRegion) return;
      const created = await createBoardRegion(boardId, {
        name,
        color: regionColorValue,
        x_pos: pendingRegion.x,
        y_pos: pendingRegion.y,
        width: pendingRegion.width,
        height: pendingRegion.height,
      });
      setRegions((prev) => [...prev, mapApiRegionToView(created)]);
      closeRegionNameModal();
    } catch (err: unknown) {
      if (isUnauthorizedError(err)) {
        router.push('/auth/login');
        return;
      }
      setRegionNameError('Failed to save region.');
    }
  };

  const startRegionResize = (
    event: React.PointerEvent<HTMLDivElement>,
    regionId: number,
    width: number,
    height: number
  ) => {
    if (tool !== 'region') return;
    event.stopPropagation();
    regionResizeRef.current = {
      id: regionId,
      pointerId: event.pointerId,
      startWidth: width,
      startHeight: height,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      latestWidth: width,
      latestHeight: height,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const startRegionDrag = (
    event: React.PointerEvent<HTMLDivElement>,
    regionId: number,
    x: number,
    y: number
  ) => {
    if (tool !== 'region') return;
    event.stopPropagation();
    regionDragRef.current = {
      id: regionId,
      pointerId: event.pointerId,
      startX: x,
      startY: y,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      latestX: x,
      latestY: y,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const moveRegionDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragging = regionDragRef.current;
    if (!dragging || dragging.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const scale = viewportRef.current.scale || 1;
    const dx = (event.clientX - dragging.startPointerX) / scale;
    const dy = (event.clientY - dragging.startPointerY) / scale;
    const nextX = Math.round(dragging.startX + dx);
    const nextY = Math.round(dragging.startY + dy);
    dragging.latestX = nextX;
    dragging.latestY = nextY;
    setRegions((prev) =>
      prev.map((region) => (region.id === dragging.id ? { ...region, x: nextX, y: nextY } : region))
    );
  };

  const endRegionDrag = async (event: React.PointerEvent<HTMLDivElement>) => {
    const dragging = regionDragRef.current;
    if (!dragging || dragging.pointerId !== event.pointerId) return;
    regionDragRef.current = null;
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    try {
      const updated = await updateBoardRegion(boardId, dragging.id, {
        x_pos: dragging.latestX,
        y_pos: dragging.latestY,
      });
      const mapped = mapApiRegionToView(updated);
      setRegions((prev) => prev.map((region) => (region.id === dragging.id ? mapped : region)));
    } catch (err: unknown) {
      if (isUnauthorizedError(err)) {
        router.push('/auth/login');
        return;
      }
      setError('Failed to save region position.');
    }
  };

  const moveRegionResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const resizing = regionResizeRef.current;
    if (!resizing || resizing.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const scale = viewportRef.current.scale || 1;
    const dx = (event.clientX - resizing.startPointerX) / scale;
    const dy = (event.clientY - resizing.startPointerY) / scale;
    const nextWidth = Math.max(40, Math.round(resizing.startWidth + dx));
    const nextHeight = Math.max(30, Math.round(resizing.startHeight + dy));
    resizing.latestWidth = nextWidth;
    resizing.latestHeight = nextHeight;
    setRegions((prev) =>
      prev.map((region) =>
        region.id === resizing.id ? { ...region, width: nextWidth, height: nextHeight } : region
      )
    );
  };

  const endRegionResize = async (event: React.PointerEvent<HTMLDivElement>) => {
    const resizing = regionResizeRef.current;
    if (!resizing || resizing.pointerId !== event.pointerId) return;
    regionResizeRef.current = null;
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    try {
      const updated = await updateBoardRegion(boardId, resizing.id, {
        width: resizing.latestWidth,
        height: resizing.latestHeight,
      });
      const mapped = mapApiRegionToView(updated);
      setRegions((prev) => prev.map((region) => (region.id === resizing.id ? mapped : region)));
    } catch (err: unknown) {
      if (isUnauthorizedError(err)) {
        router.push('/auth/login');
        return;
      }
      setError('Failed to save region size.');
    }
  };

  const startRegionDraw = (event: React.PointerEvent<HTMLDivElement>) => {
    if (tool !== 'region' || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('[data-card="true"]')) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const worldX = (event.clientX - rect.left - viewport.x) / viewport.scale;
    const worldY = (event.clientY - rect.top - viewport.y) / viewport.scale;
    regionDrawRef.current = {
      pointerId: event.pointerId,
      startX: worldX,
      startY: worldY,
    };
    setDraftRegion({
      x: worldX,
      y: worldY,
      width: 0,
      height: 0,
    });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const moveRegionDraw = (event: React.PointerEvent<HTMLDivElement>) => {
    const drawing = regionDrawRef.current;
    if (!drawing) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const worldX = (event.clientX - rect.left - viewport.x) / viewport.scale;
    const worldY = (event.clientY - rect.top - viewport.y) / viewport.scale;
    const left = Math.min(drawing.startX, worldX);
    const top = Math.min(drawing.startY, worldY);
    const width = Math.abs(worldX - drawing.startX);
    const height = Math.abs(worldY - drawing.startY);
    setDraftRegion({
      x: left,
      y: top,
      width,
      height,
    });
  };

  const endRegionDraw = (event: React.PointerEvent<HTMLDivElement>) => {
    const drawing = regionDrawRef.current;
    if (!drawing) return;
    regionDrawRef.current = null;
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(drawing.pointerId)) {
      target.releasePointerCapture(drawing.pointerId);
    }
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) {
      setDraftRegion(null);
      return;
    }
    const worldX = (event.clientX - rect.left - viewport.x) / viewport.scale;
    const worldY = (event.clientY - rect.top - viewport.y) / viewport.scale;
    finalizeRegionFromBounds(drawing.startX, drawing.startY, worldX, worldY);
  };

  const handleOpenModeChange = async (mode: 'modal' | 'sidepanel') => {
    if (isMobile) return;
    setCardOpenMode(mode);
    try {
      await updateUserSettings({ cardOpenMode: mode });
    } catch {
      setError('Failed to update view mode.');
    }
  };

  const cycleTool = () => {
    setTool((prev) => {
      if (prev === 'pan') return 'add';
      if (prev === 'add') return 'region';
      return 'pan';
    });
  };

  const focusCard = (cardId: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = positions[cardId];
    if (!pos) return;
    const width = pos.width ?? defaultCardWidth;
    const cardCenterX = pos.x + width / 2;
    const cardCenterY = pos.y + (cardRefs.current[cardId]?.offsetHeight ?? 160) / 2;
    const scale = viewportRef.current.scale;
    const nextX = rect.width / 2 - cardCenterX * scale;
    const nextY = rect.height / 2 - cardCenterY * scale;
    setViewport({ x: nextX, y: nextY, scale });
  };

  const triggerCardFlash = (cardId: number) => {
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
    }
    setFlashCardId(cardId);
    flashTimerRef.current = setTimeout(() => {
      setFlashCardId((prev) => (prev === cardId ? null : prev));
      flashTimerRef.current = null;
    }, 650);
  };

  const handleSearchResultSelect = (cardId: number) => {
    focusCard(cardId);
    triggerCardFlash(cardId);
    setShowSearch(false);
    setQuery('');
  };

  const selectedBoardLinkedCardIds = useMemo(() => {
    if (!selectedCard) return [];
    const linked = new Set<number>();
    visibleBoardLinks.forEach((link) => {
      if (link.source_card_id === selectedCard.id) {
        linked.add(link.target_card_id);
      } else if (link.target_card_id === selectedCard.id) {
        linked.add(link.source_card_id);
      }
    });
    return Array.from(linked);
  }, [selectedCard, visibleBoardLinks]);

  const handleRenameBoard = async () => {
    if (!renameValue.trim()) {
      setError('Board name is required.');
      return;
    }
    try {
      setError('');
      const tags = tagValue
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
      const updated = await updateBoard(boardId, {
        name: renameValue.trim(),
        tags,
        description: descriptionValue.trim(),
      });
      setBoardName(updated.name);
      setDescriptionValue(updated.description ?? descriptionValue.trim());
      setShowRename(false);
      setShowBoardMenu(false);
    } catch (err: unknown) {
      if (isUnauthorizedError(err)) {
        router.push('/auth/login');
        return;
      }
      setError('Failed to update board.');
    }
  };

  const handleDeleteBoard = async () => {
    try {
      await deleteBoard(boardId);
      router.push('/boards');
    } catch (err: unknown) {
      if (isUnauthorizedError(err)) {
        router.push('/auth/login');
        return;
      }
      setError('Failed to delete board.');
    }
  };

  const handleOpenShare = async () => {
    setShowBoardMenu(false);
    setShareError('');
    setShareBusy(true);
    try {
      const links = await getBoardShareLinks(boardId);
      setShareLinks(links.filter((link) => !link.revoked_at));
      setShowShare(true);
    } catch (err: unknown) {
      if (isUnauthorizedError(err)) {
        router.push('/auth/login');
        return;
      }
      setError('Failed to load share links.');
    } finally {
      setShareBusy(false);
    }
  };

  const handleOpenCopyToSpace = async () => {
    setShowBoardMenu(false);
    setCopyError('');
    setCopySuccessMessage('');
    try {
      const data = await getSpaces();
      setSpaces(data);
      setShowCopyToSpace(true);
    } catch (err: unknown) {
      if (isUnauthorizedError(err)) {
        router.push('/auth/login');
        return;
      }
      setError('Failed to load spaces.');
    }
  };

  const handleCopyBoardToSpace = async (targetSpaceId: number) => {
    try {
      setCopyError('');
      setCopySuccessMessage('');
      setCopyBusySpaceId(targetSpaceId);
      const copied = await copyBoardToSpace(boardId, targetSpaceId);
      setCopySuccessMessage(`Copied as board #${copied.id}.`);
    } catch (err: unknown) {
      if (isUnauthorizedError(err)) {
        router.push('/auth/login');
        return;
      }
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to copy board.';
      setCopyError(message);
    } finally {
      setCopyBusySpaceId(null);
    }
  };

  const toShareUrl = (token: string) => {
    if (typeof window === 'undefined') return `/shared-board/${token}`;
    return `${window.location.origin}/shared-board/${token}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);
        return copied;
      } catch {
        return false;
      }
    }
  };

  const handleCreateShareLink = async () => {
    setShareError('');
    setShareBusy(true);
    try {
      const password = sharePassword.trim();
      if (password && (password.length < 6 || password.length > 12)) {
        setShareError('Password must be 6-12 characters.');
        return;
      }
      const created = await createBoardShareLink(boardId, {
        permission: 'read',
        password: password || undefined,
      });
      setShareLinks((prev) => [created, ...prev]);
      setSharePassword('');
      const shareUrl = toShareUrl(created.token);
      const copied = await copyToClipboard(shareUrl);
      if (!copied) {
        setShareError('Link created, but auto-copy is unavailable in this browser.');
      }
    } catch (err: unknown) {
      if (isUnauthorizedError(err)) {
        router.push('/auth/login');
        return;
      }
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to create share link.';
      setShareError(message);
    } finally {
      setShareBusy(false);
    }
  };

  const handleRevokeShareLink = async (shareLinkId: number) => {
    setShareError('');
    setShareBusy(true);
    try {
      await revokeBoardShareLink(boardId, shareLinkId);
      setShareLinks((prev) => prev.filter((link) => link.id !== shareLinkId));
    } catch (err: unknown) {
      if (isUnauthorizedError(err)) {
        router.push('/auth/login');
        return;
      }
      setShareError('Failed to revoke share link.');
    } finally {
      setShareBusy(false);
    }
  };

  return (
    <div className="board-root -mx-6 -my-8 h-[calc(100vh-0px)]">
      <div className="relative h-full">
        <div className="pointer-events-none absolute left-6 top-6 z-20">
          <h1 className="text-2xl font-semibold text-[color:var(--app-foreground)]">
            {boardName || 'Board'}
          </h1>
        </div>

        <div className="absolute right-4 top-4 z-30 flex flex-col items-end gap-4 sm:right-6 sm:top-6">
          <div className="flex w-[90vw] max-w-[22rem] flex-col gap-3 sm:w-72">
            <div className="flex items-center justify-end gap-1">
              {showSearch && (
                <div className="relative">
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search in board..."
                    className="h-9 w-full min-w-[12rem] rounded-full bg-background/90 text-xs shadow-sm backdrop-blur sm:w-56"
                  />
                  {query.trim() && (
                    <div className="pointer-events-auto absolute left-0 top-12 z-40 w-[90vw] max-w-[22rem] overflow-hidden rounded-2xl border border-border bg-popover/95 shadow-lg backdrop-blur sm:w-80">
                      <div className="border-b border-border px-4 py-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Search Results
                        </div>
                        <div className="mt-1 text-sm font-semibold text-popover-foreground">
                          {searchResults.length} cards
                        </div>
                      </div>
                      <div className="max-h-[55vh] overflow-y-auto p-3">
                        <div className="grid gap-2">
                          {searchResults.map((card) => (
                            <button
                              key={card.id}
                              type="button"
                              onClick={() => handleSearchResultSelect(card.id)}
                              className="w-full rounded-xl border border-border bg-card px-3 py-3 text-left text-sm text-card-foreground shadow-sm transition hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground hover:shadow-md"
                            >
                              <div className="text-sm font-semibold">{card.title}</div>
                              <div className="mt-2 text-xs text-muted-foreground">
                                {(card.content ?? '').slice(0, 80) || 'No content yet.'}
                              </div>
                            </button>
                          ))}
                        </div>
                        {searchResults.length === 0 && (
                          <div className="rounded-xl border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                            No cards found.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="relative">
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
                  className="rounded-full bg-background shadow-sm"
                  aria-label="Search"
                  title="Search"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" fill="none" />
                    <path d="M16.2 16.2l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </Button>
              </div>
              {!isMobile && (
                <Tabs value={cardOpenMode} onValueChange={(value) => handleOpenModeChange(value as 'modal' | 'sidepanel')}>
                  <TabsList className="rounded-full bg-card shadow-sm">
                    <TabsTrigger value="modal" className="rounded-full px-3" title="Open in modal" aria-label="Open in modal">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                        <rect x="5" y="6" width="14" height="12" rx="1.6" stroke="currentColor" strokeWidth="1.6" fill="none" />
                      </svg>
                    </TabsTrigger>
                    <TabsTrigger value="sidepanel" className="rounded-full px-3" title="Open in side panel" aria-label="Open in side panel">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                        <rect x="4" y="6" width="16" height="12" rx="1.6" stroke="currentColor" strokeWidth="1.6" fill="none" />
                        <path d="M14 6v12" stroke="currentColor" strokeWidth="1.6" />
                      </svg>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
              <DropdownMenu open={showBoardMenu} onOpenChange={setShowBoardMenu}>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="icon" className="rounded-full bg-background shadow-sm" aria-label="Board menu" title="Board menu">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                      <circle cx="6" cy="12" r="1.5" fill="currentColor" />
                      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                      <circle cx="18" cy="12" r="1.5" fill="currentColor" />
                    </svg>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={handleOpenShare}>Share board</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleOpenCopyToSpace}>Copy to space</DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setShowRename(true);
                      setShowBoardMenu(false);
                    }}
                  >
                    Edit details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      setShowDeleteConfirm(true);
                      setShowBoardMenu(false);
                    }}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {error && <div className="text-xs text-destructive">{error}</div>}
          </div>
        </div>

        <div className="absolute bottom-6 right-6 z-30 flex flex-col items-end gap-3">
          {showToolbar && (
            <div className="board-toolbar pointer-events-auto flex flex-col items-center gap-2 rounded-full border border-border bg-background/90 p-2 shadow-sm backdrop-blur">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={cycleTool}
                className="tool-btn h-10 w-10 rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                title="Quick switch tool"
                aria-label="Quick switch tool"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M7 7h10M13 3l4 4-4 4M17 17H7M11 13l-4 4 4 4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Button>
              <div className="h-px w-6 bg-border" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setTool('pan')}
                className={`tool-btn h-10 w-10 rounded-full ${tool === 'pan' ? 'border border-border bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'} ${tool === 'pan' ? 'tool-active' : ''}`}
                title="View (V)"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M2.5 12c2.2-4.2 6.6-7 9.5-7s7.3 2.8 9.5 7c-2.2 4.2-6.6 7-9.5 7s-7.3-2.8-9.5-7z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setTool('add')}
                className={`tool-btn h-10 w-10 rounded-full ${tool === 'add' ? 'border border-border bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'} ${tool === 'add' ? 'tool-active' : ''}`}
                title="Edit (E)"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M4 16.5V20h3.5L19 8.5l-3.5-3.5L4 16.5z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path d="M13.5 5l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setTool('region')}
                className={`tool-btn h-10 w-10 rounded-full ${tool === 'region' ? 'border border-border bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'} ${tool === 'region' ? 'tool-active' : ''}`}
                title="Region (R)"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <rect x="5" y="5" width="14" height="14" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </Button>
              <div className="h-px w-6 bg-border" />
              <div className="tool-zoom flex flex-col items-center gap-2 rounded-full border border-border/70 bg-background/80 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Zoom
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setViewport((prev) => ({
                      ...prev,
                      scale: Math.min(2.2, prev.scale + 0.1),
                    }))
                  }
                  className="tool-btn h-9 w-9 rounded-full text-card-foreground hover:bg-accent hover:text-accent-foreground"
                  title="Zoom in"
                >
                  +
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setViewport((prev) => ({
                      ...prev,
                      scale: Math.max(0.25, prev.scale - 0.1),
                    }))
                  }
                  className="tool-btn h-9 w-9 rounded-full text-card-foreground hover:bg-accent hover:text-accent-foreground"
                  title="Zoom out"
                >
                  −
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewport({ x: 0, y: 0, scale: 1 })}
                  className="tool-btn h-9 w-9 rounded-full text-card-foreground hover:bg-accent hover:text-accent-foreground"
                  title="Reset"
                >
                  1:1
                </Button>
                <div className="text-[10px] text-muted-foreground">{Math.round(viewport.scale * 100)}%</div>
              </div>
            </div>
          )}
          <Button
            type="button"
            size="icon"
            onClick={() => setShowToolbar((prev) => !prev)}
            className={`h-12 w-12 rounded-full shadow-lg transition ${showToolbar ? 'border border-border bg-background text-foreground' : ''}`}
            aria-label="Toggle tools"
            title="Toggle tools"
          >
            {showToolbar ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            )}
          </Button>
        </div>

        <div
          ref={stageRef}
          onPointerDown={(event) => {
            if (tool === 'region') {
              if (event.button === 1) {
                beginPan(event);
              } else {
                startRegionDraw(event);
              }
              return;
            }
            beginPan(event);
          }}
          onPointerMove={(event) => {
            if (tool === 'region') {
              if (regionDrawRef.current) {
                moveRegionDraw(event);
              } else {
                movePan(event);
              }
              return;
            }
            movePan(event);
          }}
          onPointerUp={(event) => {
            if (tool === 'region') {
              if (regionDrawRef.current) {
                endRegionDraw(event);
              } else {
                endPan(event);
              }
              return;
            }
            endPan(event);
          }}
          onClick={(event) => {
            if (suppressNextStageClickRef.current) {
              suppressNextStageClickRef.current = false;
              return;
            }
            if (tool !== 'add') return;
            const target = event.target as HTMLElement;
            if (target.closest('[data-card="true"]')) return;
            const rect = stageRef.current?.getBoundingClientRect();
            if (!rect) return;
            const worldX = (event.clientX - rect.left - viewport.x) / viewport.scale;
            const worldY = (event.clientY - rect.top - viewport.y) / viewport.scale;
            const point = { x: Math.round(worldX), y: Math.round(worldY) };
            openCreateChooserAtPoint(point);
          }}
          className={`absolute inset-0 touch-none overflow-hidden bg-[radial-gradient(circle_at_1px_1px,var(--board-grid-dot)_1px,transparent_0)] [background-size:28px_28px] ${
            tool === 'pan' ? 'cursor-grab' : 'cursor-crosshair'
          }`}
        >
          <div
            className="absolute inset-0"
            style={{
              transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
              transformOrigin: '0 0',
            }}
          >
            {regions.map((region) => (
              <div
                key={region.id}
                data-region="true"
                onPointerDown={(event) => startRegionDrag(event, region.id, region.x, region.y)}
                onPointerMove={moveRegionDrag}
                onPointerUp={endRegionDrag}
                onPointerCancel={endRegionDrag}
                className={`absolute border-2 border-dashed ${
                  tool === 'region' ? 'pointer-events-auto cursor-move' : 'pointer-events-none'
                }`}
                style={{
                  transform: `translate(${region.x}px, ${region.y}px)`,
                  width: region.width,
                  height: region.height,
                  borderColor: hexToRgba(region.color, 0.78),
                  backgroundColor: hexToRgba(region.color, 0.12),
                }}
              >
                <div
                  className="pointer-events-auto absolute left-0 top-0 -translate-y-full rounded-md border bg-background/95 px-2 py-1 text-xs font-semibold leading-4 shadow-sm backdrop-blur"
                  style={{
                    borderColor: hexToRgba(region.color, 0.35),
                    color: hexToRgba(region.color, 0.95),
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="max-w-40 truncate">{region.name}</span>
                    <button
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        setPendingRegion(null);
                        setEditingRegionId(region.id);
                        setRegionNameError('');
                        setRegionNameValue(region.name);
                        setRegionColorValue(normalizeRegionColor(region.color));
                        setShowRegionName(true);
                      }}
                      className="text-xs leading-none hover:opacity-80"
                      style={{ color: hexToRgba(region.color, 0.9) }}
                      aria-label="Rename region"
                      title="Rename region"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={async (event) => {
                        event.stopPropagation();
                        try {
                          await deleteBoardRegion(boardId, region.id);
                          setRegions((prev) => prev.filter((item) => item.id !== region.id));
                        } catch (err: unknown) {
                          if (isUnauthorizedError(err)) {
                            router.push('/auth/login');
                            return;
                          }
                          setError('Failed to delete region.');
                        }
                      }}
                      className="text-xs leading-none text-destructive transition hover:opacity-80"
                      aria-label="Delete region"
                      title="Delete region"
                    >
                      ×
                    </button>
                  </div>
                </div>
                {tool === 'region' && (
                  <div
                    data-region-resize-handle="true"
                    onPointerDown={(event) => startRegionResize(event, region.id, region.width, region.height)}
                    onPointerMove={moveRegionResize}
                    onPointerUp={endRegionResize}
                    onPointerCancel={endRegionResize}
                    className="pointer-events-auto absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-sm border shadow-sm"
                    style={{
                      borderColor: hexToRgba(region.color, 0.95),
                      backgroundColor: hexToRgba(region.color, 0.78),
                    }}
                    title="Resize region"
                    aria-label="Resize region"
                  />
                )}
              </div>
            ))}
            {draftRegion && (
              <div
                className="absolute pointer-events-none border-2 border-dashed"
                style={{
                  transform: `translate(${draftRegion.x}px, ${draftRegion.y}px)`,
                  width: draftRegion.width,
                  height: draftRegion.height,
                  borderColor: hexToRgba(DEFAULT_REGION_COLOR, 0.78),
                  backgroundColor: hexToRgba(DEFAULT_REGION_COLOR, 0.12),
                }}
              />
            )}
            <svg
              className="absolute left-0 top-0 overflow-visible"
              width="1"
              height="1"
              aria-hidden="true"
            >
              {visibleBoardLinks.map((link) => {
                const sourcePoint = getCardAnchorPoint(link.source_card_id, link.source_handle);
                const targetPoint = getCardAnchorPoint(link.target_card_id, link.target_handle);
                const isHovered = hoveredLinkId === link.id;
                return (
                  <g key={link.id}>
                    <line
                      x1={sourcePoint.x}
                      y1={sourcePoint.y}
                      x2={targetPoint.x}
                      y2={targetPoint.y}
                      className="pointer-events-none"
                      stroke={isHovered ? 'var(--foreground)' : 'var(--muted-foreground)'}
                      strokeOpacity="0.98"
                      strokeWidth={isHovered ? '2.8' : '2.2'}
                      vectorEffect="non-scaling-stroke"
                    />
                    <line
                      x1={sourcePoint.x}
                      y1={sourcePoint.y}
                      x2={targetPoint.x}
                      y2={targetPoint.y}
                      stroke="transparent"
                      strokeWidth="14"
                      className="pointer-events-auto cursor-pointer"
                      onPointerEnter={() => setHoveredLinkId(link.id)}
                      onPointerLeave={() => setHoveredLinkId((prev) => (prev === link.id ? null : prev))}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        suppressNextStageClickRef.current = true;
                        void handleDeleteBoardLink(link.id);
                      }}
                    />
                  </g>
                );
              })}
              {linkDraft && (
                <line
                  x1={getCardAnchorPoint(linkDraft.sourceCardId, linkDraft.sourceHandle).x}
                  y1={getCardAnchorPoint(linkDraft.sourceCardId, linkDraft.sourceHandle).y}
                  x2={linkDraft.pointerX}
                  y2={linkDraft.pointerY}
                  className="pointer-events-none"
                  stroke="var(--muted-foreground)"
                  strokeOpacity="0.95"
                  strokeDasharray="4 4"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
            {cards.map((card) => {
              const pos = positions[card.id] || { x: 0, y: 0 };
              return (
                <div
                  key={card.id}
                  data-card="true"
                  onMouseEnter={() => setHoveredCardId(card.id)}
                  onMouseLeave={() => setHoveredCardId((prev) => (prev === card.id ? null : prev))}
                  onWheel={(event) => {
                    if (event.shiftKey) {
                      event.stopPropagation();
                    }
                  }}
                  onPointerDown={(event) => beginDrag(event, card.id)}
                  onPointerMove={moveDrag}
                  onPointerUp={(event) => {
                    if (linkDraft && tool === 'add') {
                      event.stopPropagation();
                      if (linkDraft.sourceCardId === card.id) {
                        setLinkDraft(null);
                        suppressNextStageClickRef.current = true;
                        return;
                      }
                      const rect = stageRef.current?.getBoundingClientRect();
                      if (!rect) {
                        setLinkDraft(null);
                        return;
                      }
                      const worldX = (event.clientX - rect.left - viewport.x) / viewport.scale;
                      const worldY = (event.clientY - rect.top - viewport.y) / viewport.scale;
                      const targetHandle = getNearestHandleForCard(card.id, worldX, worldY);
                      void handleCreateBoardLink(
                        linkDraft.sourceCardId,
                        card.id,
                        linkDraft.sourceHandle,
                        targetHandle
                      );
                      setLinkDraft(null);
                      suppressNextStageClickRef.current = true;
                      return;
                    }
                    endDrag(event);
                  }}
                  onPointerCancel={endDrag}
                  onDoubleClick={() => {
                    if (isMobile) {
                      router.push(`/cards/${card.id}?boardId=${boardId}`);
                      return;
                    }
                    setSelectedCard(card);
                  }}
                  className={`absolute select-none transition-all duration-300 ${
                    tool === 'add' ? 'cursor-grab' : 'cursor-default'
                  } ${
                    flashCardId === card.id
                      ? 'rounded-xl ring-4 ring-ring/25'
                      : ''
                  }`}
                  style={{
                    transform: `translate(${pos.x}px, ${pos.y}px)`,
                    width: pos.width ?? defaultCardWidth,
                    height: undefined,
                  }}
                  ref={(el) => {
                    cardRefs.current[card.id] = el;
                  }}
                >
                  <div className="relative" onClickCapture={handleBoardCardContentClick}>
                    <CardPreview
                      card={card}
                      renderMarkdown
                      interactive={false}
                      fillHeight={false}
                      onSelect={() => {}}
                    />
                    {(['top', 'right', 'bottom', 'left'] as BoardCardLinkHandle[]).map((handle) => {
                      const anchorClass =
                        handle === 'top'
                          ? 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2'
                          : handle === 'right'
                            ? 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2'
                            : handle === 'bottom'
                              ? 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2'
                              : 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2';
                      return (
                        <button
                          key={`${card.id}-${handle}`}
                          type="button"
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            if (tool !== 'add') return;
                            handleStartLinkDraft(card.id, handle);
                          }}
                          onPointerUp={(event) => {
                            event.stopPropagation();
                            if (!linkDraft || tool !== 'add') return;
                            if (linkDraft.sourceCardId === card.id) {
                              setLinkDraft(null);
                              suppressNextStageClickRef.current = true;
                              return;
                            }
                            void handleCreateBoardLink(
                              linkDraft.sourceCardId,
                              card.id,
                              linkDraft.sourceHandle,
                              handle
                            );
                            setLinkDraft(null);
                            suppressNextStageClickRef.current = true;
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            suppressNextStageClickRef.current = true;
                          }}
                          className={`absolute z-10 h-4 w-4 rounded-full border border-border bg-muted shadow-sm transition ${anchorClass} ${tool === 'add' && (hoveredCardId === card.id || linkDraft) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                          aria-label={`Link from ${handle}`}
                          title={`Link from ${handle}`}
                        />
                      );
                    })}
                    <button
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedCard(card);
                      }}
                      className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-sm hover:bg-accent"
                      title="Open card"
                      aria-label="Open card"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                        <path
                          d="M7 3H3v4M21 7V3h-4M3 17v4h4M17 21h4v-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        />
                      </svg>
                    </button>
                    {tool === 'add' && (
                      <div
                        onPointerDown={(event) => startResize(event, card.id)}
                        onPointerMove={(event) => applyResize(event.clientX)}
                        onPointerUp={(event) => endResize(event)}
                        className="absolute right-0 top-2 h-[calc(100%-16px)] w-2 cursor-ew-resize"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedCard && (
        <CardOverlay
          card={selectedCard}
          mode={cardOpenMode}
          onClose={() => setSelectedCard(null)}
          onSave={handleSave}
          onDelete={handleDeleteSelectedCard}
          onRemoveFromBoard={handleRemoveFromBoard}
          allCards={allCards}
          onNavigateCard={handleNavigateOverlayCard}
          breadcrumbRootLabel={boardName || 'Board'}
          boardLinkedCardIds={selectedBoardLinkedCardIds}
        />
      )}

      <button
        type="button"
        onClick={() => {
          setShowCreateChooser(true);
        }}
        className="hidden"
        aria-label="Create card"
      />

      <Dialog open={showCreateChooser} onOpenChange={setShowCreateChooser}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Add to board</div>
            <DialogTitle>Choose action</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-auto justify-start rounded-xl px-4 py-3 text-left"
              onClick={() => {
                setShowCreateChooser(false);
                setShowImport(false);
                if (isMobile) {
                  openCreatePageFromBoard(spawnPoint ?? undefined);
                  return;
                }
                setShowCreate(true);
              }}
            >
              Create new card
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto justify-start rounded-xl px-4 py-3 text-left"
              onClick={() => {
                setShowCreateChooser(false);
                setShowImport(true);
                setSelectedImportIds(new Set());
              }}
            >
              Import from card box
            </Button>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => setShowCreateChooser(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {showCreate && (
        <CardCreateOverlay
          mode={cardOpenMode}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
          allCards={allCards}
        />
      )}

      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Import</div>
                <div className="text-lg font-semibold text-card-foreground">Card Box</div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  setShowImport(false);
                  setSelectedImportIds(new Set());
                }}
                className="rounded-full"
                aria-label="Close"
                title="Close"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </Button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <Input
                value={importQuery}
                onChange={(event) => setImportQuery(event.target.value)}
                placeholder="Search cards to import..."
                className="rounded-full"
              />
              <div className="grid max-h-[45vh] gap-3 overflow-y-auto md:grid-cols-2">
                {importCandidates.map((card) => {
                  const selected = selectedImportIds.has(card.id);
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => {
                        setSelectedImportIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(card.id)) {
                            next.delete(card.id);
                          } else {
                            next.add(card.id);
                          }
                          return next;
                        });
                      }}
                      className={`rounded-xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                        selected ? 'border-foreground bg-accent ring-1 ring-ring/30' : 'border-border bg-card hover:bg-accent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-card-foreground">{card.title}</div>
                        <div
                          className={`h-4 w-4 rounded-full border ${
                            selected ? 'border-foreground bg-foreground' : 'border-border'
                          }`}
                        />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {(card.content ?? '').slice(0, 120) || 'No content yet.'}
                      </p>
                    </button>
                  );
                })}
                {importCandidates.length === 0 && (
                  <div className="text-sm text-muted-foreground">No cards available to import.</div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {selectedImportIds.size > 0
                    ? `${selectedImportIds.size} selected`
                    : 'Select cards to import'}
                </div>
                <Button type="button" onClick={handleImportBatch} disabled={selectedImportIds.size === 0}>
                  Import selected
                </Button>
              </div>
            </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showShare} onOpenChange={setShowShare}>
        <DialogContent className="max-w-2xl overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Share</div>
                <div className="text-lg font-semibold text-card-foreground">Board share links</div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  setShowShare(false);
                  setShareError('');
                }}
                className="rounded-full"
                aria-label="Close"
                title="Close"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </Button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Create a public view link for this board.</div>
                <Button type="button" onClick={handleCreateShareLink} disabled={shareBusy}>
                  Create link
                </Button>
              </div>
              <div className="relative">
                <Input
                  type={showSharePassword ? 'text' : 'password'}
                  value={sharePassword}
                  onChange={(event) => setSharePassword(event.target.value)}
                  minLength={6}
                  maxLength={12}
                  placeholder="Optional password (6-12 chars)"
                  className="pr-10 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSharePassword((prev) => !prev)}
                  className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  aria-label={showSharePassword ? 'Hide password' : 'Show password'}
                  title={showSharePassword ? 'Hide password' : 'Show password'}
                >
                  {showSharePassword ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                      <path
                        d="M3 5l16 16M10.6 10.6a3 3 0 104.2 4.2M9.9 5.2A11 11 0 0121 12a11.8 11.8 0 01-3.3 4.7M6.5 8A12 12 0 003 12a11.9 11.9 0 004.1 5.5A11.2 11.2 0 0012 19a10.9 10.9 0 003.1-.5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                      <path
                        d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        fill="none"
                        strokeLinejoin="round"
                      />
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" fill="none" />
                    </svg>
                  )}
                </Button>
              </div>
              {shareError && <div className="text-xs text-destructive">{shareError}</div>}
              <div className="max-h-[45vh] space-y-2 overflow-y-auto">
                {shareLinks.map((link) => {
                  const shareUrl = toShareUrl(link.token);
                  const isRevoked = !!link.revoked_at;
                  const isExpired = !!link.expires_at && new Date(link.expires_at) < new Date();
                  return (
                    <div key={link.id} className="rounded-xl border border-border bg-muted/60 p-3">
                      <div className="text-xs font-medium text-muted-foreground">{shareUrl}</div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                            {link.permission}
                          </span>
                          {link.password_protected && (
                            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground">
                              password
                            </span>
                          )}
                          {isRevoked && (
                            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground">
                              revoked
                            </span>
                          )}
                          {!isRevoked && isExpired && (
                            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground">
                              expired
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                const copied = await copyToClipboard(shareUrl);
                                if (!copied) {
                                  setShareError('Copy failed in this browser. Please copy the URL manually.');
                                }
                              }}
                              className="rounded-full text-[11px]"
                            >
                              Copy
                            </Button>
                          {!isRevoked && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleRevokeShareLink(link.id)}
                              className="rounded-full border-border text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            >
                              Revoke
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {shareLinks.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                    No share links yet.
                  </div>
                )}
              </div>
            </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRename} onOpenChange={setShowRename}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Edit board</div>
            <DialogTitle>Update details</DialogTitle>
          </DialogHeader>
          <Input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              placeholder="Board name"
            />
            <Input
              value={tagValue}
              onChange={(event) => setTagValue(event.target.value)}
              placeholder="Tags (comma separated)"
            />
            <Textarea
              value={descriptionValue}
              onChange={(event) => setDescriptionValue(event.target.value)}
              placeholder="Description"
              rows={4}
            />
            {error && <div className="text-xs text-destructive">{error}</div>}
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => { setShowRename(false); setError(''); }}>
                Cancel
              </Button>
              <Button type="button" onClick={handleRenameBoard}>
                Save
              </Button>
            </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Delete board</div>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the board and its layout. Cards remain in your card box.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBoard} className="bg-rose-600 text-white hover:bg-rose-700">
                Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {boardSummary && (
        <BoardCopyToSpaceModal
          open={showCopyToSpace}
          boardTitle={boardSummary.name}
          spaces={spaces}
          currentSpaceId={currentSpaceId ?? boardSummary.space_id ?? null}
          busySpaceId={copyBusySpaceId}
          error={copyError}
          successMessage={copySuccessMessage}
          onClose={() => {
            setShowCopyToSpace(false);
            setCopyError('');
            setCopySuccessMessage('');
          }}
          onCopy={handleCopyBoardToSpace}
        />
      )}

      <Dialog open={showRegionName} onOpenChange={(open) => (!open ? closeRegionNameModal() : undefined)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {editingRegionId ? 'Rename region' : 'Create region'}
            </div>
            <DialogTitle>
              {editingRegionId ? 'Update region name' : 'Name this region'}
            </DialogTitle>
          </DialogHeader>
            <Input
              value={regionNameValue}
              onChange={(event) => {
                setRegionNameValue(event.target.value);
                if (regionNameError) {
                  setRegionNameError('');
                }
              }}
              placeholder="Region name"
            />
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Color</label>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Choose a preset color, or use the picker below for a custom color.
              </p>
              <div className="mb-2 flex flex-wrap gap-2">
                {REGION_COLOR_PRESETS.map((preset) => {
                  const selected = preset.toLowerCase() === regionColorValue.toLowerCase();
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRegionColorValue(preset)}
                      className={`h-6 w-6 rounded-full border ${selected ? 'ring-2 ring-ring ring-offset-1 ring-offset-background' : ''}`}
                      style={{ backgroundColor: preset, borderColor: selected ? 'var(--ring)' : 'var(--border)' }}
                      title={preset}
                      aria-label={`Use color ${preset}`}
                    />
                  );
                })}
              </div>
              <input
                type="color"
                value={regionColorValue}
                onChange={(event) => {
                  setRegionColorValue(normalizeRegionColor(event.target.value));
                }}
                className="h-10 w-20 cursor-pointer rounded-lg border border-border bg-background p-1"
                aria-label="Region color"
              />
            </div>
            {regionNameError && <div className="mt-2 text-xs text-destructive">{regionNameError}</div>}
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeRegionNameModal}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveRegionName}>
                Save
              </Button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
