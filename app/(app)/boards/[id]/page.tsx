'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CardOverlay from '../../../../components/CardOverlay';
import CardCreateOverlay from '../../../../components/CardCreateOverlay';
import CardPreview from '../../../../components/CardPreview';
import {
  addExistingCardToBoard,
  BoardShareLink,
  BoardRegion as ApiBoardRegion,
  Card,
  createBoardRegion,
  createBoardShareLink,
  createCardInBoard,
  deleteBoardRegion,
  deleteBoard,
  deleteCard,
  getBoardShareLinks,
  getBoard,
  getBoardRegions,
  getCards,
  getUserSettings,
  removeCardFromBoard,
  updateBoardRegion,
  revokeBoardShareLink,
  updateBoardCardPosition,
  updateBoard,
  updateCard,
  updateUserSettings,
} from '../../../../lib/noteToolApi';

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

const DEFAULT_REGION_COLOR = '#38bdf8';
const REGION_COLOR_PRESETS = [
  '#38bdf8',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#a855f7',
  '#14b8a6',
  '#f97316',
  '#64748b',
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

export default function BoardDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
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
  const [showToolbar, setShowToolbar] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(toolbarStorageKey) === '1';
    } catch {
      return false;
    }
  });
  const [showBoardMenu, setShowBoardMenu] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [tagValue, setTagValue] = useState('');
  const [descriptionValue, setDescriptionValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [shareLinks, setShareLinks] = useState<BoardShareLink[]>([]);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState('');
  const [sharePassword, setSharePassword] = useState('');
  const [showSharePassword, setShowSharePassword] = useState(false);
  const [regions, setRegions] = useState<BoardRegionView[]>([]);
  const [draftRegion, setDraftRegion] = useState<DraftRegion | null>(null);
  const [showRegionName, setShowRegionName] = useState(false);
  const [regionNameValue, setRegionNameValue] = useState('');
  const [regionColorValue, setRegionColorValue] = useState(DEFAULT_REGION_COLOR);
  const [regionNameError, setRegionNameError] = useState('');
  const [pendingRegion, setPendingRegion] = useState<DraftRegion | null>(null);
  const [editingRegionId, setEditingRegionId] = useState<number | null>(null);
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
    const handleChange = () => setIsMobile(media.matches);
    handleChange();
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

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
          getCards(),
          getUserSettings(),
          getBoardRegions(boardId),
        ]);
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
  }, [boardId, router]);

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

  const handleCreate = async (payload: { title: string; content: string }) => {
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

  const handleSave = async (payload: { title: string; content: string }) => {
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
    setPositions((prev) => {
      const next = { ...prev };
      delete next[selectedCard.id];
      return next;
    });
    setSelectedCard(null);
  };

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
          <h1 className="text-2xl font-semibold text-[color:var(--app-foreground)] [text-shadow:0_2px_8px_rgba(15,23,42,0.25)]">
            {boardName || 'Board'}
          </h1>
        </div>

        <div className="absolute right-4 top-4 z-30 flex flex-col items-end gap-4 sm:right-6 sm:top-6">
          <div className="flex w-[90vw] max-w-[22rem] flex-col gap-3 sm:w-72">
            <div className="flex items-center justify-end gap-1">
              {showSearch && (
                <div className="relative">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search in board..."
                    className="w-full min-w-[12rem] rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-700 shadow-sm backdrop-blur focus:outline-none focus:ring-2 focus:ring-slate-300 sm:w-56"
                  />
                  {query.trim() && (
                    <div className="pointer-events-auto absolute left-0 top-12 z-40 w-[90vw] max-w-[22rem] overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur sm:w-80">
                      <div className="border-b border-slate-200 px-4 py-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                          Search Results
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                          {searchResults.length} cards
                        </div>
                      </div>
                      <div className="max-h-[55vh] overflow-y-auto p-3">
                        <div className="grid gap-2">
                          {searchResults.map((card) => (
                            <button
                              key={card.id}
                              type="button"
                              onClick={() => focusCard(card.id)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                            >
                              <div className="text-sm font-semibold text-slate-900">{card.title}</div>
                              <div className="mt-2 text-xs text-slate-600">
                                {(card.content ?? '').slice(0, 80) || 'No content yet.'}
                              </div>
                            </button>
                          ))}
                        </div>
                        {searchResults.length === 0 && (
                          <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500">
                            No cards found.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setShowSearch((prev) => {
                      const next = !prev;
                      if (!next) {
                        setQuery('');
                      }
                      return next;
                    })
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-100"
                  aria-label="Search"
                  title="Search"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" fill="none" />
                    <path d="M16.2 16.2l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              {!isMobile && (
                <div className="flex items-center rounded-full border border-slate-200 bg-white px-1 py-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => handleOpenModeChange('modal')}
                    className={`rounded-full p-2 ${
                      cardOpenMode === 'modal' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    title="Open in modal"
                    aria-label="Open in modal"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                      <rect
                        x="5"
                        y="6"
                        width="14"
                        height="12"
                        rx="1.6"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        fill="none"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenModeChange('sidepanel')}
                    className={`rounded-full p-2 ${
                      cardOpenMode === 'sidepanel' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    title="Open in side panel"
                    aria-label="Open in side panel"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                      <rect
                        x="4"
                        y="6"
                        width="16"
                        height="12"
                        rx="1.6"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        fill="none"
                      />
                      <path d="M14 6v12" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  </button>
                </div>
              )}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowBoardMenu((prev) => !prev)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-100"
                  aria-label="Board menu"
                  title="Board menu"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <circle cx="6" cy="12" r="1.5" fill="currentColor" />
                    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                    <circle cx="18" cy="12" r="1.5" fill="currentColor" />
                  </svg>
                </button>
                {showBoardMenu && (
                  <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                    <button
                      type="button"
                      onClick={handleOpenShare}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Share board
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowRename(true);
                        setShowBoardMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Edit details
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteConfirm(true);
                        setShowBoardMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
            {error && <div className="text-xs text-rose-600">{error}</div>}
          </div>
        </div>

        <div className="absolute bottom-6 right-6 z-30 flex flex-col items-end gap-3">
          {showToolbar && (
            <div className="board-toolbar pointer-events-auto flex flex-col items-center gap-2 rounded-full border border-slate-200 bg-white/90 p-2 shadow-sm backdrop-blur">
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={cycleTool}
                className="tool-btn flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
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
              </button>
              <div className="h-px w-6 bg-slate-200" />
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setTool('pan')}
                className={`tool-btn flex h-10 w-10 items-center justify-center rounded-full ${
                  tool === 'pan'
                    ? 'border border-slate-200 bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-100'
                } ${tool === 'pan' ? 'tool-active' : ''}`}
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
              </button>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setTool('add')}
                className={`tool-btn flex h-10 w-10 items-center justify-center rounded-full ${
                  tool === 'add'
                    ? 'border border-slate-200 bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-100'
                } ${tool === 'add' ? 'tool-active' : ''}`}
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
              </button>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setTool('region')}
                className={`tool-btn flex h-10 w-10 items-center justify-center rounded-full ${
                  tool === 'region'
                    ? 'border border-slate-200 bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-100'
                } ${tool === 'region' ? 'tool-active' : ''}`}
                title="Region (R)"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <rect x="5" y="5" width="14" height="14" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
              <div className="h-px w-6 bg-slate-200" />
              <div className="tool-zoom flex flex-col items-center gap-2 rounded-full border border-slate-200/70 bg-white/80 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Zoom
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setViewport((prev) => ({
                      ...prev,
                      scale: Math.min(2.2, prev.scale + 0.1),
                    }))
                  }
                  className="tool-btn flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
                  title="Zoom in"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setViewport((prev) => ({
                      ...prev,
                      scale: Math.max(0.25, prev.scale - 0.1),
                    }))
                  }
                  className="tool-btn flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
                  title="Zoom out"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => setViewport({ x: 0, y: 0, scale: 1 })}
                  className="tool-btn flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
                  title="Reset"
                >
                  1:1
                </button>
                <div className="text-[10px] text-slate-500">{Math.round(viewport.scale * 100)}%</div>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowToolbar((prev) => !prev)}
            className={`flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition ${
              showToolbar ? 'bg-white text-slate-700 border border-slate-200' : 'bg-slate-900 text-white'
            }`}
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
          </button>
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
          className={`absolute inset-0 touch-none overflow-hidden bg-[radial-gradient(circle_at_1px_1px,#cbd5f5_1px,transparent_0)] [background-size:28px_28px] dark-grid ${
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
                  className="pointer-events-auto absolute left-0 top-0 -translate-y-full rounded-md border bg-white/95 px-2 py-1 text-xs font-semibold leading-4 shadow-sm"
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
                      className="text-xs leading-none text-rose-500 hover:text-rose-700"
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
            {cards.map((card) => {
              const pos = positions[card.id] || { x: 0, y: 0 };
              return (
                <div
                  key={card.id}
                  data-card="true"
                  onWheel={(event) => {
                    if (event.shiftKey) {
                      event.stopPropagation();
                    }
                  }}
                  onPointerDown={(event) => beginDrag(event, card.id)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onDoubleClick={() => {
                    if (isMobile) {
                      router.push(`/cards/${card.id}?boardId=${boardId}`);
                      return;
                    }
                    setSelectedCard(card);
                  }}
                  className={`absolute select-none ${tool === 'add' ? 'cursor-grab' : 'cursor-default'}`}
                  style={{
                    transform: `translate(${pos.x}px, ${pos.y}px)`,
                    width: pos.width ?? defaultCardWidth,
                    height: undefined,
                  }}
                  ref={(el) => {
                    cardRefs.current[card.id] = el;
                  }}
                >
                  <div className="relative">
                    <CardPreview
                      card={card}
                      renderMarkdown
                      interactive={false}
                      fillHeight={false}
                      onSelect={() => {}}
                    />
                    <button
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (isMobile) {
                          router.push(`/cards/${card.id}?boardId=${boardId}`);
                          return;
                        }
                        setSelectedCard(card);
                      }}
                      className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm hover:bg-slate-100"
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
          breadcrumbRootLabel={boardName || 'Board'}
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

      {showCreateChooser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-[90vw] max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Add to board</div>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">Choose action</h3>
            <div className="mt-4 grid gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateChooser(false);
                  setShowImport(false);
                  if (isMobile) {
                    openCreatePageFromBoard(spawnPoint ?? undefined);
                    return;
                  }
                  setShowCreate(true);
                }}
                className="rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Create new card
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateChooser(false);
                  setShowImport(true);
                  setSelectedImportIds(new Set());
                }}
                className="rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Import from card box
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCreateChooser(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <CardCreateOverlay
          mode={cardOpenMode}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
          allCards={allCards}
        />
      )}

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Import</div>
                <div className="text-lg font-semibold text-slate-900">Card Box</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowImport(false);
                  setSelectedImportIds(new Set());
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
                aria-label="Close"
                title="Close"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <input
                value={importQuery}
                onChange={(event) => setImportQuery(event.target.value)}
                placeholder="Search cards to import..."
                className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
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
                        selected ? 'border-slate-900 bg-slate-900/10' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-900">{card.title}</div>
                        <div
                          className={`h-4 w-4 rounded-full border ${
                            selected ? 'border-slate-900 bg-slate-900' : 'border-slate-300'
                          }`}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-600">
                        {(card.content ?? '').slice(0, 120) || 'No content yet.'}
                      </p>
                    </button>
                  );
                })}
                {importCandidates.length === 0 && (
                  <div className="text-sm text-slate-500">No cards available to import.</div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  {selectedImportIds.size > 0
                    ? `${selectedImportIds.size} selected`
                    : 'Select cards to import'}
                </div>
                <button
                  type="button"
                  onClick={handleImportBatch}
                  disabled={selectedImportIds.size === 0}
                  className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Import selected
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Share</div>
                <div className="text-lg font-semibold text-slate-900">Board share links</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowShare(false);
                  setShareError('');
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
                aria-label="Close"
                title="Close"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">Create a public view link for this board.</div>
                <button
                  type="button"
                  onClick={handleCreateShareLink}
                  disabled={shareBusy}
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Create link
                </button>
              </div>
              <div className="relative">
                <input
                  type={showSharePassword ? 'text' : 'password'}
                  value={sharePassword}
                  onChange={(event) => setSharePassword(event.target.value)}
                  minLength={6}
                  maxLength={12}
                  placeholder="Optional password (6-12 chars)"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 pr-10 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
                <button
                  type="button"
                  onClick={() => setShowSharePassword((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
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
                </button>
              </div>
              {shareError && <div className="text-xs text-rose-600">{shareError}</div>}
              <div className="max-h-[45vh] space-y-2 overflow-y-auto">
                {shareLinks.map((link) => {
                  const shareUrl = toShareUrl(link.token);
                  const isRevoked = !!link.revoked_at;
                  const isExpired = !!link.expires_at && new Date(link.expires_at) < new Date();
                  return (
                    <div
                      key={link.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"
                    >
                      <div className="text-xs font-medium text-slate-500">{shareUrl}</div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="rounded-full border border-slate-300 px-2 py-0.5 text-slate-600">
                            {link.permission}
                          </span>
                          {link.password_protected && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                              password
                            </span>
                          )}
                          {isRevoked && (
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-600">
                              revoked
                            </span>
                          )}
                          {!isRevoked && isExpired && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                              expired
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              const copied = await copyToClipboard(shareUrl);
                              if (!copied) {
                                setShareError('Copy failed in this browser. Please copy the URL manually.');
                              }
                            }}
                            className="rounded-full border border-slate-300 px-3 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                          >
                            Copy
                          </button>
                          {!isRevoked && (
                            <button
                              type="button"
                              onClick={() => handleRevokeShareLink(link.id)}
                              className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {shareLinks.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                    No share links yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Edit board</div>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">Update details</h3>
            <input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              placeholder="Board name"
              className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <input
              value={tagValue}
              onChange={(event) => setTagValue(event.target.value)}
              placeholder="Tags (comma separated)"
              className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <textarea
              value={descriptionValue}
              onChange={(event) => setDescriptionValue(event.target.value)}
              placeholder="Description"
              rows={4}
              className="mt-3 w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            {error && <div className="mt-2 text-xs text-rose-600">{error}</div>}
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowRename(false);
                  setError('');
                }}
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRenameBoard}
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Delete board</div>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">Are you sure?</h3>
            <p className="mt-3 text-sm text-slate-600">
              This will remove the board and its layout. Cards remain in your card box.
            </p>
            <div className="mt-5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteBoard}
                className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showRegionName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {editingRegionId ? 'Rename region' : 'Create region'}
            </div>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">
              {editingRegionId ? 'Update region name' : 'Name this region'}
            </h3>
            <input
              value={regionNameValue}
              onChange={(event) => {
                setRegionNameValue(event.target.value);
                if (regionNameError) {
                  setRegionNameError('');
                }
              }}
              placeholder="Region name"
              className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-slate-500">Color</label>
              <p className="mb-2 text-[11px] text-slate-500">
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
                      className={`h-6 w-6 rounded-full border ${selected ? 'ring-2 ring-slate-400 ring-offset-1' : ''}`}
                      style={{ backgroundColor: preset, borderColor: selected ? '#334155' : '#cbd5e1' }}
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
                className="h-10 w-20 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                aria-label="Region color"
              />
            </div>
            {regionNameError && <div className="mt-2 text-xs text-rose-600">{regionNameError}</div>}
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={closeRegionNameModal}
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRegionName}
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
