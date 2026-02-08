'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Board, createBoard, getBoards } from '../../../lib/noteToolApi';

export default function BoardsPage() {
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

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

  return (
    <div className="space-y-8">
      <header>
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Boards</div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Your boards</h1>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {boards.map((board) => (
          <Link
            key={board.id}
            href={`/boards/${board.id}`}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="text-sm font-semibold text-slate-900">{board.name}</div>
            <div className="mt-2 text-xs text-slate-500">
              Cards: {board.card_count ?? 0}
            </div>
          </Link>
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
    </div>
  );
}
