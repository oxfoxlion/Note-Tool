'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createCard, createCardInBoard, updateBoardCardPosition } from '../../../../lib/noteToolApi';

export default function CardCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const boardContext = useMemo(() => {
    const boardIdParam = searchParams.get('boardId');
    const xParam = searchParams.get('x');
    const yParam = searchParams.get('y');
    const boardId = boardIdParam ? Number(boardIdParam) : null;
    const x = xParam ? Number(xParam) : null;
    const y = yParam ? Number(yParam) : null;
    return {
      boardId: Number.isFinite(boardId) ? (boardId as number) : null,
      x: Number.isFinite(x) ? (x as number) : null,
      y: Number.isFinite(y) ? (y as number) : null,
    };
  }, [searchParams]);

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    setError('');
    setIsSaving(true);
    try {
      if (boardContext.boardId) {
        const created = await createCardInBoard(boardContext.boardId, { title: title.trim(), content });
        if (boardContext.x !== null && boardContext.y !== null) {
          await updateBoardCardPosition(boardContext.boardId, created.card.id, {
            x_pos: boardContext.x,
            y_pos: boardContext.y,
          });
        }
        router.push(`/boards/${boardContext.boardId}`);
      } else {
        const created = await createCard({ title: title.trim(), content });
        router.push(`/cards/${created.id}`);
      }
    } catch (err: any) {
      if (err?.message === 'UNAUTHORIZED') {
        router.push('/auth/login');
        return;
      }
      setError('Failed to create card.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">New Card</div>
          <div className="mt-2 text-sm font-semibold text-slate-700">
            {boardContext.boardId ? 'Create and add to board' : 'Create a new card'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (boardContext.boardId) {
                router.push(`/boards/${boardContext.boardId}`);
                return;
              }
              router.push('/cards');
            }}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            disabled={isSaving}
          >
            {isSaving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </header>

      {error && <div className="text-xs text-rose-600">{error}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title"
          className="w-full border-0 bg-transparent text-lg font-semibold text-slate-900 focus:outline-none"
        />
        <div className="mt-4">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Write your markdown..."
            className="min-h-[240px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
      </div>
    </div>
  );
}
