'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createCard, createCardInBoard, updateBoardCardPosition } from '../../../../lib/noteToolApi';
import { useCurrentSpace } from '../../../../hooks/useCurrentSpace';

function isUnauthorizedError(error: unknown): boolean {
  return error instanceof Error && error.message === 'UNAUTHORIZED';
}

export default function CardCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentSpaceId } = useCurrentSpace();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
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

  const normalizeTags = (raw: string) =>
    Array.from(
      new Set(
        raw
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)
      )
    );

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    setError('');
    setIsSaving(true);
    try {
      const tags = normalizeTags(tagsInput);
      if (boardContext.boardId) {
        const created = await createCardInBoard(boardContext.boardId, { title: title.trim(), content, tags });
        if (boardContext.x !== null && boardContext.y !== null) {
          await updateBoardCardPosition(boardContext.boardId, created.card.id, {
            x_pos: boardContext.x,
            y_pos: boardContext.y,
          });
        }
        router.push(`/boards/${boardContext.boardId}`);
      } else {
        const created = await createCard({ title: title.trim(), content, tags, space_id: currentSpaceId });
        router.push(`/cards/${created.id}`);
      }
    } catch (err: unknown) {
      if (isUnauthorizedError(err)) {
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
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">New Card</div>
          <div className="mt-2 text-sm font-semibold text-card-foreground">
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
            className="rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-60"
            disabled={isSaving}
          >
            {isSaving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </header>

      {error && <div className="text-xs text-rose-600">{error}</div>}

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title"
          className="w-full border-0 bg-transparent text-lg font-semibold text-card-foreground focus:outline-none"
        />
        <input
          value={tagsInput}
          onChange={(event) => setTagsInput(event.target.value)}
          placeholder="Tags (comma separated)"
          className="mt-3 w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
        <div className="mt-4">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Write your markdown..."
            className="min-h-[240px] w-full resize-y rounded-xl border border-border bg-muted p-4 text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
      </div>
    </div>
  );
}
