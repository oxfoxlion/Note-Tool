'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Board,
  BoardFolder,
  createBoard,
  deleteBoard,
  getBoardFolders,
  getBoards,
  updateBoard,
} from '../../../lib/noteToolApi';

export default function BoardsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [boards, setBoards] = useState<Board[]>([]);
  const [folders, setFolders] = useState<BoardFolder[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingBoard, setEditingBoard] = useState<Board | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingTags, setEditingTags] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<number | null>(null);
  const [deletingBoard, setDeletingBoard] = useState<Board | null>(null);
  const [query, setQuery] = useState('');
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [page, setPage] = useState(1);
  const [openBoardMenuId, setOpenBoardMenuId] = useState<number | null>(null);
  const [viewportTier, setViewportTier] = useState<'sm' | 'md' | 'xl'>('xl');
  const tagMenuRef = useRef<HTMLDivElement | null>(null);
  const selectedFolderId = (() => {
    const raw = searchParams.get('folderId');
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  })();
  const archiveFolder = folders.find((folder) => folder.system_key === 'archive');
  const selectedFolder = selectedFolderId ? folders.find((folder) => folder.id === selectedFolderId) : null;

  useEffect(() => {
    const mediaMd = window.matchMedia('(min-width: 768px)');
    const mediaXl = window.matchMedia('(min-width: 1280px)');
    const apply = () => {
      if (mediaXl.matches) {
        setViewportTier('xl');
        return;
      }
      if (mediaMd.matches) {
        setViewportTier('md');
        return;
      }
      setViewportTier('sm');
    };
    apply();
    mediaMd.addEventListener('change', apply);
    mediaXl.addEventListener('change', apply);
    return () => {
      mediaMd.removeEventListener('change', apply);
      mediaXl.removeEventListener('change', apply);
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [boardsData, foldersData] = await Promise.all([
          getBoards(selectedFolderId),
          getBoardFolders(),
        ]);
        setBoards(boardsData);
        setFolders(foldersData);
      } catch (err: any) {
        if (err?.message === 'UNAUTHORIZED') {
          router.push('/auth/login');
          return;
        }
        setError('Failed to load boards.');
      }
    };
    void load();
  }, [router, selectedFolderId]);

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

  useEffect(() => {
    if (openBoardMenuId === null) return;
    const handleClick = () => setOpenBoardMenuId(null);
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [openBoardMenuId]);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Board name is required.');
      return;
    }
    try {
      setError('');
      const board = await createBoard({
        name: name.trim(),
        folder_id: selectedFolderId ?? undefined,
      });
      setBoards((prev) => [board, ...prev]);
      setName('');
    } catch (err: any) {
      if (err?.message === 'UNAUTHORIZED') {
        router.push('/auth/login');
        return;
      }
      setError('Failed to create board.');
    }
  };

  const handleStartEdit = (board: Board) => {
    setEditingBoard(board);
    setEditingName(board.name);
    setEditingTags((board.tags ?? []).join(', '));
    setEditingDescription(board.description ?? '');
    setEditingFolderId(board.folder_id ?? null);
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
      const updated = await updateBoard(editingBoard.id, {
        name: editingName.trim(),
        tags,
        description: editingDescription.trim(),
        folder_id: editingFolderId,
      });
      setBoards((prev) =>
        prev.map((item) =>
          item.id === updated.id
            ? {
                ...item,
                name: updated.name,
                description: updated.description ?? editingDescription.trim(),
                tags: updated.tags ?? tags,
                folder_id: updated.folder_id ?? editingFolderId,
              }
            : item
        )
      );
      setEditingBoard(null);
    } catch (err: any) {
      if (err?.message === 'UNAUTHORIZED') {
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
      if (err?.message === 'UNAUTHORIZED') {
        router.push('/auth/login');
        return;
      }
      setError('Failed to delete board.');
    }
  };

  const handleArchiveToggle = async (board: Board) => {
    if (!archiveFolder) {
      setError('Archive folder is not ready yet.');
      return;
    }
    const isArchived = board.folder_id === archiveFolder.id;
    const nextFolderId = isArchived ? null : archiveFolder.id;
    try {
      await updateBoard(board.id, {
        name: board.name,
        tags: board.tags ?? [],
        description: board.description ?? '',
        folder_id: nextFolderId,
      });
      if (selectedFolderId) {
        setBoards((prev) => prev.filter((item) => item.id !== board.id));
      } else if (!isArchived) {
        setBoards((prev) => prev.filter((item) => item.id !== board.id));
      }
    } catch (err: any) {
      if (err?.message === 'UNAUTHORIZED') {
        router.push('/auth/login');
        return;
      }
      setError(isArchived ? 'Failed to unarchive board.' : 'Failed to archive board.');
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

  useEffect(() => {
    setPage(1);
  }, [query, selectedFolderId, tagFilters, boards.length, viewportTier]);

  const pageSize = viewportTier === 'xl' ? 9 : viewportTier === 'md' ? 6 : 3;

  const totalPages = Math.max(1, Math.ceil(filteredBoards.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedBoards = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBoards.slice(start, start + pageSize);
  }, [filteredBoards, currentPage, pageSize]);

  const tagLabel =
    tagFilters.length === 0 ? 'All tags' : tagFilters.length === 1 ? tagFilters[0] : `${tagFilters.length} tags`;

  return (
    <div className="space-y-8">
      <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Boards</div>
          {selectedFolder && (
            <div className="mt-1 text-xs text-slate-500">Folder: {selectedFolder.name}</div>
          )}
        </div>
        <div className="flex w-full flex-nowrap items-center justify-end gap-1 sm:w-auto">
          {showSearch && (
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search boards..."
              className="min-w-0 rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 w-[34vw] max-w-[10rem] sm:w-56"
            />
          )}
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
          <div className="relative w-auto" ref={tagMenuRef}>
            <button
              type="button"
              onClick={() => setShowTagMenu((prev) => !prev)}
              className="flex max-w-[8.5rem] items-center gap-2 truncate rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50 sm:max-w-none sm:px-4"
              aria-label="Filter by tags"
              title="Filter by tags"
            >
              <span className="truncate">{tagLabel}</span>
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

      <div className="h-[calc(100vh-13.5rem)]">
        <section className="h-full overflow-visible pr-1">
          <div className="grid h-full grid-rows-3 content-start gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pagedBoards.map((board) => {
            const description = (board.description ?? '').trim();
            return (
            <div
              key={board.id}
              className={`relative flex h-full min-h-0 flex-col overflow-visible rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                openBoardMenuId === board.id ? 'z-40' : 'z-0'
              }`}
            >
              <Link href={`/boards/${board.id}`} className="block flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">{board.name}</div>
                {description && (
                  <div
                    className="mt-1 overflow-hidden text-xs leading-relaxed text-slate-600"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {description}
                  </div>
                )}
              </Link>
              <div className="mt-1.5 flex items-end justify-between gap-2">
                <Link href={`/boards/${board.id}`} className="min-w-0 flex-1">
                  <div className="text-xs text-slate-500">Cards: {board.card_count ?? 0}</div>
                  {(board.tags?.length ?? 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {board.tags?.slice(0, 2).map((tag) => (
                        <span
                          key={`${board.id}-${tag}`}
                          className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500"
                        >
                          {tag}
                        </span>
                      ))}
                      {(board.tags?.length ?? 0) > 2 && (
                        <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                          +{(board.tags?.length ?? 0) - 2}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
                <div className="relative flex shrink-0 justify-end">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setOpenBoardMenuId((prev) => (prev === board.id ? null : board.id));
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100"
                    aria-label="Board actions"
                    title="Board actions"
                  >
                    ...
                  </button>
                  {openBoardMenuId === board.id && (
                    <div
                      className="absolute right-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
                      onMouseDown={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void handleArchiveToggle(board);
                          setOpenBoardMenuId(null);
                        }}
                        className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                      >
                        {board.folder_id === archiveFolder?.id ? 'Unarchive' : 'Archive'}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleStartEdit(board);
                          setOpenBoardMenuId(null);
                        }}
                        className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setDeletingBoard(board);
                          setOpenBoardMenuId(null);
                        }}
                        className="w-full px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            );
          })}
          </div>
        </section>
      </div>

      <div className="fixed bottom-1 md:bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-full border border-slate-200 bg-white/95 px-2 py-1 shadow-sm backdrop-blur">
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage <= 1}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Prev
          </button>
          <div className="text-xs text-slate-500">
            {currentPage} / {totalPages}
          </div>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage >= totalPages}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

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
            <textarea
              value={editingDescription}
              onChange={(event) => setEditingDescription(event.target.value)}
              placeholder="Description"
              rows={4}
              className="mt-3 w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <select
              value={editingFolderId === null ? '' : String(editingFolderId)}
              onChange={(event) => {
                const raw = event.target.value;
                setEditingFolderId(raw ? Number(raw) : null);
              }}
              className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">No folder</option>
              {folders.map((folder) => (
                <option key={folder.id} value={String(folder.id)}>
                  {folder.name}
                </option>
              ))}
            </select>
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
