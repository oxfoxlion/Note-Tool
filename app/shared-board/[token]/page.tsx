'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import CardOverlay from '../../../components/CardOverlay';
import CardPreview from '../../../components/CardPreview';
import { Card, getSharedBoardByToken } from '../../../lib/noteToolApi';

type RegionView = {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export default function SharedBoardPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const modeStorageKey = 'note_tool_shared_card_open_mode';
  const [boardName, setBoardName] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [regions, setRegions] = useState<RegionView[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [cardOpenMode, setCardOpenMode] = useState<'modal' | 'sidepanel'>('modal');
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const viewportRef = useRef(viewport);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<{
    mode: 'none' | 'pan' | 'pinch';
    startX: number;
    startY: number;
    startVx: number;
    startVy: number;
    startScale: number;
    startDist: number | null;
  }>({
    mode: 'none',
    startX: 0,
    startY: 0,
    startVx: 0,
    startVy: 0,
    startScale: 1,
    startDist: null,
  });

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(modeStorageKey);
      if (raw === 'modal' || raw === 'sidepanel') {
        setCardOpenMode(raw);
      }
    } catch {
      // Ignore storage errors in strict browser contexts
    }
  }, []);

  const handleOpenModeChange = (mode: 'modal' | 'sidepanel') => {
    setCardOpenMode(mode);
    try {
      window.localStorage.setItem(modeStorageKey, mode);
    } catch {
      // Ignore storage errors in strict browser contexts
    }
  };

  const parseInternalCardId = (href: string | null): number | null => {
    if (!href) return null;
    const match = href.match(/^\/cards\/(\d+)(?:[/?#].*)?$/);
    if (!match) return null;
    const id = Number(match[1]);
    return Number.isFinite(id) ? id : null;
  };

  const openCardById = (id: number) => {
    const target = cards.find((item) => item.id === id) ?? null;
    if (target) {
      setSelectedCard(target);
    }
  };

  const handleCardContentClick = (event: React.MouseEvent<HTMLElement>, fallbackCardId: number) => {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest?.('a');
    if (!anchor) {
      setSelectedCard(cards.find((item) => item.id === fallbackCardId) ?? null);
      return;
    }
    const internalCardId = parseInternalCardId(anchor.getAttribute('href'));
    if (internalCardId) {
      event.preventDefault();
      openCardById(internalCardId);
      return;
    }
    const href = anchor.getAttribute('href');
    if (href) {
      event.preventDefault();
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  const zoomAtClientPoint = (clientX: number, clientY: number, deltaY: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const { x: offsetX, y: offsetY, scale } = viewportRef.current;
    const pointerX = clientX - rect.left;
    const pointerY = clientY - rect.top;
    const nextScale = Math.min(2.4, Math.max(0.25, scale - deltaY * 0.001));
    const worldX = (pointerX - offsetX) / scale;
    const worldY = (pointerY - offsetY) / scale;
    const nextX = pointerX - worldX * nextScale;
    const nextY = pointerY - worldY * nextScale;
    setViewport({ x: nextX, y: nextY, scale: nextScale });
  };

  const beginPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    if (event.button === 1) {
      event.preventDefault();
    }
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const pointers = [...pointersRef.current.values()];
    if (pointers.length === 1) {
      const p = pointers[0];
      gestureRef.current = {
        mode: 'pan',
        startX: p.x,
        startY: p.y,
        startVx: viewportRef.current.x,
        startVy: viewportRef.current.y,
        startScale: viewportRef.current.scale,
        startDist: null,
      };
    } else if (pointers.length >= 2) {
      const [a, b] = pointers;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      gestureRef.current = {
        mode: 'pinch',
        startX: 0,
        startY: 0,
        startVx: viewportRef.current.x,
        startVy: viewportRef.current.y,
        startScale: viewportRef.current.scale,
        startDist: Math.hypot(dx, dy),
      };
    }
  };

  const movePan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pointers = [...pointersRef.current.values()];
    const gesture = gestureRef.current;

    if (gesture.mode === 'pan' && pointers.length === 1) {
      const p = pointers[0];
      const deltaX = p.x - gesture.startX;
      const deltaY = p.y - gesture.startY;
      setViewport({
        x: gesture.startVx + deltaX,
        y: gesture.startVy + deltaY,
        scale: gesture.startScale,
      });
      return;
    }

    if (gesture.mode === 'pinch' && pointers.length >= 2 && gesture.startDist) {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const [a, b] = pointers;
      const midX = (a.x + b.x) / 2 - rect.left;
      const midY = (a.y + b.y) / 2 - rect.top;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const nextScale = Math.min(2.4, Math.max(0.25, gesture.startScale * (dist / gesture.startDist)));
      const worldX = (midX - gesture.startVx) / gesture.startScale;
      const worldY = (midY - gesture.startVy) / gesture.startScale;
      const nextX = midX - worldX * nextScale;
      const nextY = midY - worldY * nextScale;
      setViewport({ x: nextX, y: nextY, scale: nextScale });
    }
  };

  const endPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    pointersRef.current.delete(event.pointerId);
    const pointers = [...pointersRef.current.values()];

    if (pointers.length === 0) {
      gestureRef.current.mode = 'none';
      return;
    }

    if (pointers.length === 1) {
      const p = pointers[0];
      gestureRef.current = {
        mode: 'pan',
        startX: p.x,
        startY: p.y,
        startVx: viewportRef.current.x,
        startVy: viewportRef.current.y,
        startScale: viewportRef.current.scale,
        startDist: null,
      };
      return;
    }

    const [a, b] = pointers;
    gestureRef.current = {
      mode: 'pinch',
      startX: 0,
      startY: 0,
      startVx: viewportRef.current.x,
      startVy: viewportRef.current.y,
      startScale: viewportRef.current.scale,
      startDist: Math.hypot(a.x - b.x, a.y - b.y),
    };
  };

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getSharedBoardByToken(token);
        setBoardName(data.board.name);
        setCards(data.cards);
        setRegions(
          data.regions.map((region) => ({
            id: region.id,
            name: region.name,
            x: region.x_pos,
            y: region.y_pos,
            width: region.width,
            height: region.height,
          }))
        );
      } catch {
        setError('This share link is invalid or expired.');
      } finally {
        setLoading(false);
      }
    };
    if (token) {
      void load();
    }
  }, [token]);

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Loading shared board...</div>;
  }

  if (error) {
    return <div className="p-8 text-sm text-rose-600">{error}</div>;
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100">
      <div className="relative h-full w-full">
        <div className="pointer-events-none absolute left-6 top-6 z-20">
          <h1 className="text-2xl font-semibold text-slate-900 [text-shadow:0_2px_8px_rgba(15,23,42,0.18)]">
            {boardName || 'Shared Board'}
          </h1>
          <div className="mt-1 text-xs text-slate-500">Read-only shared view</div>
        </div>

        <div className="absolute right-6 top-6 z-30 flex items-center rounded-full border border-slate-200 bg-white px-1 py-1 shadow-sm">
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

        <div className="absolute bottom-6 right-6 z-30 flex flex-col items-center gap-2 rounded-full border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Zoom</div>
          <button
            type="button"
            onClick={() =>
              setViewport((prev) => ({
                ...prev,
                scale: Math.min(2.4, prev.scale + 0.1),
              }))
            }
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
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
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
            title="Zoom out"
          >
            -
          </button>
          <button
            type="button"
            onClick={() => setViewport({ x: 0, y: 0, scale: 1 })}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
            title="Reset"
          >
            1:1
          </button>
          <div className="text-[10px] text-slate-500">{Math.round(viewport.scale * 100)}%</div>
        </div>

        <div
          ref={stageRef}
          onWheelCapture={(event) => {
            event.preventDefault();
            zoomAtClientPoint(event.clientX, event.clientY, event.deltaY);
          }}
          onPointerDown={beginPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          className="absolute inset-0 touch-none cursor-grab overflow-hidden bg-[radial-gradient(circle_at_1px_1px,#cbd5f5_1px,transparent_0)] [background-size:28px_28px] active:cursor-grabbing"
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
              className="pointer-events-none absolute border-2 border-dashed border-sky-500/70 bg-sky-300/10"
              style={{
                transform: `translate(${region.x}px, ${region.y}px)`,
                width: region.width,
                height: region.height,
              }}
            >
              <div className="absolute left-0 top-0 -translate-y-full rounded-md border border-sky-300 bg-white/95 px-2 py-1 text-[11px] font-semibold text-sky-700 shadow-sm">
                {region.name}
              </div>
            </div>
          ))}
            {cards.map((card) => {
              const x = typeof card.x_pos === 'number' ? card.x_pos : 0;
              const y = typeof card.y_pos === 'number' ? card.y_pos : 0;
              return (
                <div
                  key={card.id}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => handleCardContentClick(event, card.id)}
                  className="pointer-events-auto absolute"
                  style={{
                    transform: `translate(${x}px, ${y}px)`,
                    width: typeof card.width === 'number' ? card.width : 420,
                  }}
                >
                  <CardPreview card={card} renderMarkdown interactive={false} fillHeight={false} onSelect={() => {}} />
                </div>
              );
            })}
          </div>
        </div>

        {selectedCard && (
          <CardOverlay
            card={selectedCard}
            mode={cardOpenMode}
            onClose={() => setSelectedCard(null)}
            onSave={() => {}}
            allCards={cards}
            readOnly
            onNavigateCard={openCardById}
            breadcrumbRootLabel={boardName || 'Shared Board'}
          />
        )}
      </div>
    </div>
  );
}
