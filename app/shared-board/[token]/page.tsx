'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
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
  const [boardName, setBoardName] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [regions, setRegions] = useState<RegionView[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const viewportRef = useRef(viewport);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const touchStateRef = useRef<{
    mode: 'pan' | 'pinch' | null;
    startX: number;
    startY: number;
    startVx: number;
    startVy: number;
    startScale: number;
    startDist: number;
  }>({
    mode: null,
    startX: 0,
    startY: 0,
    startVx: 0,
    startVy: 0,
    startScale: 1,
    startDist: 0,
  });

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

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

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const getDistance = (a: Touch, b: Touch) => {
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      return Math.hypot(dx, dy);
    };

    const handleTouchStart = (event: TouchEvent) => {
      const touches = event.touches;
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
        };
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      const state = touchStateRef.current;
      if (!state.mode) return;
      const touches = event.touches;

      if (state.mode === 'pan' && touches.length === 1) {
        const touch = touches[0];
        const dx = touch.clientX - state.startX;
        const dy = touch.clientY - state.startY;
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
        const nextScale = Math.min(2.4, Math.max(0.25, scale * (dist / state.startDist)));
        const worldX = (midX - state.startVx) / scale;
        const worldY = (midY - state.startVy) / scale;
        const nextX = midX - worldX * nextScale;
        const nextY = midY - worldY * nextScale;
        setViewport({ x: nextX, y: nextY, scale: nextScale });
      }
    };

    const handleTouchEnd = () => {
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
  }, []);

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
                  className="pointer-events-none absolute"
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
      </div>
    </div>
  );
}
