'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CardOverlay from '../../../../components/CardOverlay';
import CardCreateOverlay from '../../../../components/CardCreateOverlay';
import CardPreview from '../../../../components/CardPreview';
import {
  addExistingCardToBoard,
  Card,
  createCardInBoard,
  getBoard,
  getCards,
  getUserSettings,
  removeCardFromBoard,
  updateBoardCardPosition,
  updateCard,
  updateUserSettings,
} from '../../../../lib/noteToolApi';

export default function BoardDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const boardId = Number(params.id);
  const [cards, setCards] = useState<Card[]>([]);
  const [positions, setPositions] = useState<Record<number, { x: number; y: number }>>({});
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [boardName, setBoardName] = useState('');
  const [cardOpenMode, setCardOpenMode] = useState<'modal' | 'sidepanel'>('modal');
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showCreateChooser, setShowCreateChooser] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [spawnPoint, setSpawnPoint] = useState<{ x: number; y: number } | null>(null);
  const [tool, setTool] = useState<'pan' | 'add'>('add');
  const [selectedImportIds, setSelectedImportIds] = useState<Set<number>>(new Set());
  const [importQuery, setImportQuery] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [showToolbar, setShowToolbar] = useState(false);
  const [cardPreviewLength, setCardPreviewLength] = useState(120);
  const stageRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    const load = async () => {
      try {
        const [boardData, cardsData, settingsData] = await Promise.all([
          getBoard(boardId),
          getCards(),
          getUserSettings(),
        ]);
        setBoardName(boardData.board.name);
        setCards(boardData.cards);
        setAllCards(cardsData);
        const nextPositions: Record<number, { x: number; y: number }> = {};
        boardData.cards.forEach((card) => {
          const x = typeof card.x_pos === 'number' ? card.x_pos : 0;
          const y = typeof card.y_pos === 'number' ? card.y_pos : 0;
          nextPositions[card.id] = { x, y };
        });
        setPositions(nextPositions);
        if (settingsData?.cardOpenMode) {
          setCardOpenMode(settingsData.cardOpenMode);
        }
        if (typeof settingsData?.cardPreviewLength === 'number') {
          setCardPreviewLength(settingsData.cardPreviewLength);
        }
      } catch (err: any) {
        if (err?.message === 'NO_TOKEN') {
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

  const filteredCards = useMemo(() => {
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
    setPositions((prev) => ({
      ...prev,
      [data.card.id]: spawnPoint ?? { x: 0, y: 0 },
    }));
    setSpawnPoint(null);
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
        next[card.id] = { x: base.x + offsetX, y: base.y + offsetY };
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
    setSelectedCard(updated);
  };

  const handleRemoveFromBoard = async () => {
    if (!selectedCard) return;
    await removeCardFromBoard(boardId, selectedCard.id);
    setCards((prev) => prev.filter((item) => item.id !== selectedCard.id));
    setPositions((prev) => {
      const next = { ...prev };
      delete next[selectedCard.id];
      return next;
    });
    setSelectedCard(null);
  };

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      const { x: offsetX, y: offsetY, scale } = viewportRef.current;
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const nextScale = Math.min(2.2, Math.max(0.5, scale - event.deltaY * 0.001));
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const beginPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (tool === 'pan') {
      if (event.button !== 0) return;
    } else if (tool === 'add') {
      if (event.button !== 1) return;
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
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  };

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>, cardId: number) => {
    if (tool !== 'add') return;
    event.stopPropagation();
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
        x: dragging.startX + dx,
        y: dragging.startY + dy,
      },
    }));
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragging = dragRef.current;
    dragRef.current = null;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
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

  const handleOpenModeChange = async (mode: 'modal' | 'sidepanel') => {
    setCardOpenMode(mode);
    try {
      await updateUserSettings({ cardOpenMode: mode });
    } catch (err) {
      setError('Failed to update view mode.');
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

        <div className="absolute right-6 top-6 z-30 flex flex-col items-end gap-4">
          <div className="flex w-72 flex-col gap-3">
            <div className="flex items-center justify-end">
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
                    <rect x="5" y="6" width="14" height="12" rx="1.6" stroke="currentColor" strokeWidth="1.6" fill="none" />
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
                    <rect x="4" y="6" width="16" height="12" rx="1.6" stroke="currentColor" strokeWidth="1.6" fill="none" />
                    <path d="M14 6v12" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </button>
              </div>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search in board..."
              className="rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-700 shadow-sm backdrop-blur focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            {error && <div className="text-xs text-rose-600">{error}</div>}
          </div>

        </div>

        <div className="absolute bottom-6 right-6 z-30 flex flex-col items-end gap-3">
          {showToolbar && (
            <div className="board-toolbar pointer-events-auto flex flex-col items-center gap-2 rounded-full border border-slate-200 bg-white/90 p-2 shadow-sm backdrop-blur">
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setTool('pan')}
                className={`tool-btn flex h-10 w-10 items-center justify-center rounded-full text-slate-700 ${
                  tool === 'pan' ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
                } ${tool === 'pan' ? 'tool-active' : ''}`}
                title="Pan"
              >
                ✋
              </button>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setTool('add')}
                className={`tool-btn flex h-10 w-10 items-center justify-center rounded-full text-slate-700 ${
                  tool === 'add' ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
                } ${tool === 'add' ? 'tool-active' : ''}`}
                title="Add"
              >
                +
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
                      scale: Math.max(0.5, prev.scale - 0.1),
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
          onPointerDown={beginPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onClick={(event) => {
            if (tool !== 'add') return;
            const target = event.target as HTMLElement;
            if (target.closest('[data-card="true"]')) return;
            const rect = stageRef.current?.getBoundingClientRect();
            if (!rect) return;
            const worldX = (event.clientX - rect.left - viewport.x) / viewport.scale;
            const worldY = (event.clientY - rect.top - viewport.y) / viewport.scale;
            setSpawnPoint({ x: Math.round(worldX), y: Math.round(worldY) });
            setShowCreateChooser(true);
          }}
          className={`absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_1px_1px,#cbd5f5_1px,transparent_0)] [background-size:28px_28px] dark-grid ${
            tool === 'add' ? 'cursor-crosshair' : 'cursor-grab'
          }`}
        >
          <div
            className="absolute inset-0"
            style={{
              transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
              transformOrigin: '0 0',
            }}
          >
            {filteredCards.map((card) => {
              const pos = positions[card.id] || { x: 0, y: 0 };
              return (
                <div
                  key={card.id}
                  data-card="true"
                  onPointerDown={(event) => beginDrag(event, card.id)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onDoubleClick={() => setSelectedCard(card)}
                  className="absolute w-64 cursor-grab select-none"
                  style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
                >
                  <CardPreview
                    card={card}
                    previewLength={cardPreviewLength}
                    onSelect={() => setSelectedCard(card)}
                  />
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
          onRemoveFromBoard={handleRemoveFromBoard}
        />
      )}

      <button
        type="button"
        onClick={() => setShowCreateChooser(true)}
        className="hidden"
        aria-label="Create card"
      />

      {showCreateChooser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Add to board</div>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">Choose action</h3>
            <div className="mt-4 grid gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateChooser(false);
                  setShowImport(false);
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
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
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
    </div>
  );
}
