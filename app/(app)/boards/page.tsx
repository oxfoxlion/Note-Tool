'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Board, createBoard, deleteBoard, getBoards, updateBoard } from '../../../lib/noteToolApi';

export default function BoardsPage() {
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingBoard, setEditingBoard] = useState<Board | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingTags, setEditingTags] = useState('');
  const [deletingBoard, setDeletingBoard] = useState<Board | null>(null);
  const [query, setQuery] = useState('');
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const tagMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getBoards();
        setBoards(data);
      } catch (err: any) {
        if (err?.message === 'NO_TOKEN') {
          router.push('/auth/login');
          return;
        }
        setError('Failed to load boards.');
      }
    };
    load();
  }, [router]);

  useEffect(() => {
    if (!showTagMenu) return;
    const handleClick = (event: MouseEvent) => {
      if (!tagMenuRef.current) return;
      if (!tagMenuRef.current.contains(event.target as Node)) {
        setShowTagMenu(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [showTagMenu]);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Board name is required.');
      return;
    }
    setError('');
    const board = await createBoard({ name: name.trim() });
    setBoards((prev) => [board, ...prev]);
    setName('');
  };

  const handleStartEdit = (board: Board) => {
    setEditingBoard(board);
    setEditingName(board.name);
    setEditingTags((board.tags ?? []).join(', '));
    setError('');
  };

  const handleUpdate = async () => {
    if (!editingBoard) return;
    if (!editingName.trim()) {
      setError('Board name is required.');
      return;
    }
    try {
      setError('');
      const tags = editingTags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
      const updated = await updateBoard(editingBoard.id, { name: editingName.trim(), tags });
      setBoards((prev) =>
        prev.map((item) =>
          item.id === updated.id ? { ...item, name: updated.name, tags: updated.tags ?? tags } : item
        )
      );
      setEditingBoard(null);
    } catch (err: any) {
      if (err?.message === 'NO_TOKEN') {
        router.push('/auth/login');
        return;
      }
      setError('Failed to update board.');
    }
  };

  const handleDelete = async () => {
    if (!deletingBoard) return;
    try {
      setError('');
      await deleteBoard(deletingBoard.id);
      setBoards((prev) => prev.filter((item) => item.id !== deletingBoard.id));
      setDeletingBoard(null);
    } catch (err: any) {
      if (err?.message === 'NO_TOKEN') {
        router.push('/auth/login');
        return;
      }
      setError('Failed to delete board.');
    }
  };

  const availableTags = useMemo(
    () =>
      Array.from(
        new Set(
          boards
            .flatMap((board) => board.tags ?? [])
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0)
        )
      ),
    [boards]
  );

  const filteredBoards = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return boards.filter((board) => {
      const matchesQuery = !keyword || board.name.toLowerCase().includes(keyword);
      const matchesTag =
        tagFilters.length === 0 || tagFilters.some((tag) => (board.tags ?? []).includes(tag));
      return matchesQuery && matchesTag;
    });
  }, [boards, query, tagFilters]);

  const tagLabel =
    tagFilters.length === 0 ? 'All tags' : tagFilters.length === 1 ? tagFilters[0] : `${tagFilters.length} tags`;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between gap-4">
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Boards</div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search boards..."
            className="w-56 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          <div className="relative" ref={tagMenuRef}>
            <button
              type="button"
              onClick={() => setShowTagMenu((prev) => !prev)}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
              aria-label="Filter by tags"
              title="Filter by tags"
            >
              <span>{tagLabel}</span>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              </svg>
            </button>
            {showTagMenu && (
              <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => setTagFilters([])}
                  className={`w-full px-4 py-2 text-left text-sm ${
                    tagFilters.length === 0 ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  All tags
                </button>
                {availableTags.map((tag) => {
                  const active = tagFilters.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setTagFilters((prev) =>
                          active ? prev.filter((item) => item !== tag) : [...prev, tag]
                        )
                      }
                      className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${
                        active ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{tag}</span>
                      {active && (
                        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                          <path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="1.6" fill="none" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredBoards.map((board) => (
          <div
            key={board.id}
            className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <Link href={`/boards/${board.id}`} className="block">
              <div className="text-sm font-semibold text-slate-900">{board.name}</div>
              <div className="mt-2 text-xs text-slate-500">
                Cards: {board.card_count ?? 0}
              </div>
              {(board.tags?.length ?? 0) > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {board.tags?.map((tag) => (
                    <span
                      key={`${board.id}-${tag}`}
                      className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </Link>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleStartEdit(board);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100"
                aria-label="Edit board name"
                title="Edit"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M4 16.5V20h3.5L18 9.5 14.5 6 4 16.5z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinejoin="round"
                  />
                  <path d="M13.5 6.5l4 4" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDeletingBoard(board);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50"
                aria-label="Delete board"
                title="Delete"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </section>

      <div className="fixed bottom-6 right-6 z-40">
        {showCreate && (
          <div className="absolute bottom-14 right-0 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">New board</div>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Board name"
              className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            {error && <div className="mt-2 text-xs text-rose-600">{error}</div>}
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setError('');
                }}
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
              >
                Create
              </button>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowCreate((prev) => !prev)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg"
          aria-label="Create board"
          title="Create board"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {editingBoard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Rename board</div>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">Update name</h3>
            <input
              value={editingName}
              onChange={(event) => setEditingName(event.target.value)}
              placeholder="Board name"
              className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <input
              value={editingTags}
              onChange={(event) => setEditingTags(event.target.value)}
              placeholder="Tags (comma separated)"
              className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            {error && <div className="mt-2 text-xs text-rose-600">{error}</div>}
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setEditingBoard(null);
                  setError('');
                }}
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingBoard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Delete board</div>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">Are you sure?</h3>
            <p className="mt-3 text-sm text-slate-600">
              This will remove the board and its layout. Cards remain in your card box.
            </p>
            {error && <div className="mt-2 text-xs text-rose-600">{error}</div>}
            <div className="mt-5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setDeletingBoard(null)}
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
