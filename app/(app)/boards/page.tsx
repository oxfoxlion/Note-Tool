'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Board,
  BoardFolder,
  copyBoardToSpace,
  createBoard,
  deleteBoard,
  getBoardFolders,
  getBoards,
  getSpaces,
  Space,
  updateBoard,
} from '../../../lib/noteToolApi';
import { useCurrentSpace } from '../../../hooks/useCurrentSpace';
import BoardCopyToSpaceModal from '../../../components/boards/BoardCopyToSpaceModal';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';

function isUnauthorizedError(error: unknown): boolean {
  return error instanceof Error && error.message === 'UNAUTHORIZED';
}

function getApiErrorMessage(error: unknown): string {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '';
}

export default function BoardsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentSpaceId } = useCurrentSpace();
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
  const [showSearch, setShowSearch] = useState(false);
  const [pageState, setPageState] = useState({ key: '', value: 1 });
  const [copyingBoard, setCopyingBoard] = useState<Board | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [copyBusySpaceId, setCopyBusySpaceId] = useState<number | null>(null);
  const [copyError, setCopyError] = useState('');
  const [copySuccessMessage, setCopySuccessMessage] = useState('');
  const [viewportTier, setViewportTier] = useState<'sm' | 'md' | 'xl'>('xl');
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
          getBoards(selectedFolderId, currentSpaceId),
          getBoardFolders(currentSpaceId),
        ]);
        setBoards(boardsData);
        setFolders(foldersData);
      } catch (err: unknown) {
        if (isUnauthorizedError(err)) {
          router.push('/auth/login');
          return;
        }
        const message = getApiErrorMessage(err);
        if (message === 'folder_id 不屬於目前 space' || message === '找不到資料夾') {
          router.replace('/boards');
          return;
        }
        setError('Failed to load boards.');
      }
    };
    void load();
  }, [router, selectedFolderId, currentSpaceId]);

  useEffect(() => {
    if (!copyingBoard) return;
    let active = true;
    const loadSpaces = async () => {
      try {
        const data = await getSpaces();
        if (!active) return;
        setSpaces(data);
      } catch {
        if (!active) return;
        setCopyError('Failed to load spaces.');
      }
    };
    void loadSpaces();
    return () => {
      active = false;
    };
  }, [copyingBoard]);

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
        space_id: currentSpaceId,
      });
      setBoards((prev) => [board, ...prev]);
      setName('');
      setShowCreate(false);
    } catch (err: unknown) {
      if (isUnauthorizedError(err)) {
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
    } catch (err: unknown) {
      if (isUnauthorizedError(err)) {
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
    } catch (err: unknown) {
      if (isUnauthorizedError(err)) {
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
    } catch (err: unknown) {
      if (isUnauthorizedError(err)) {
        router.push('/auth/login');
        return;
      }
      setError(isArchived ? 'Failed to unarchive board.' : 'Failed to archive board.');
    }
  };

  const handleCopyBoard = async (targetSpaceId: number) => {
    if (!copyingBoard) return;
    try {
      setCopyError('');
      setCopySuccessMessage('');
      setCopyBusySpaceId(targetSpaceId);
      const copied = await copyBoardToSpace(copyingBoard.id, targetSpaceId);
      setCopySuccessMessage(`Copied as board #${copied.id}.`);
    } catch (err: unknown) {
      if ((err as { message?: string })?.message === 'UNAUTHORIZED') {
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

  const pageSize = viewportTier === 'xl' ? 9 : viewportTier === 'md' ? 6 : 3;
  const pageResetKey = `${query}::${selectedFolderId ?? 'all'}::${tagFilters.slice().sort().join(',')}::${boards.length}::${viewportTier}`;
  const totalPages = Math.max(1, Math.ceil(filteredBoards.length / pageSize));
  const currentPage = pageState.key === pageResetKey ? Math.min(pageState.value, totalPages) : 1;
  const pagedBoards = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBoards.slice(start, start + pageSize);
  }, [filteredBoards, currentPage, pageSize]);

  const tagLabel =
    tagFilters.length === 0 ? 'All tags' : tagFilters.length === 1 ? tagFilters[0] : `${tagFilters.length} tags`;

  const setPage = (updater: number | ((prev: number) => number)) => {
    setPageState((prev) => {
      const base = prev.key === pageResetKey ? prev.value : 1;
      const nextValue = typeof updater === 'function' ? updater(base) : updater;
      return { key: pageResetKey, value: nextValue };
    });
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Boards</div>
          {selectedFolder && <div className="mt-1 text-xs text-muted-foreground">Folder: {selectedFolder.name}</div>}
        </div>
        <div className="flex w-full flex-nowrap items-center justify-end gap-1 sm:w-auto">
          {showSearch && (
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search boards..."
              className="h-9 min-w-0 rounded-full w-[34vw] max-w-[10rem] sm:w-56"
            />
          )}
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
            className="rounded-full"
            aria-label="Search"
            title="Search"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" fill="none" />
              <path d="M16.2 16.2l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="max-w-[8.5rem] rounded-full sm:max-w-none">
                <span className="truncate">{tagLabel}</span>
                <svg viewBox="0 0 24 24" className="ml-1 h-3.5 w-3.5" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuCheckboxItem checked={tagFilters.length === 0} onCheckedChange={() => setTagFilters([])}>
                All tags
              </DropdownMenuCheckboxItem>
              {availableTags.map((tag) => (
                <DropdownMenuCheckboxItem
                  key={tag}
                  checked={tagFilters.includes(tag)}
                  onCheckedChange={(checked) =>
                    setTagFilters((prev) =>
                      checked ? [...prev.filter((item) => item !== tag), tag] : prev.filter((item) => item !== tag)
                    )
                  }
                >
                  {tag}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="h-[calc(100vh-13.5rem)]">
        <section className="h-full overflow-visible pr-1">
          <div className="grid h-full grid-rows-3 content-start gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pagedBoards.map((board) => {
              const description = (board.description ?? '').trim();
              const boardHref = board.folder_id ? `/boards/${board.id}?folderId=${board.folder_id}` : `/boards/${board.id}`;
              return (
                <div
                  key={board.id}
                  className="relative flex h-full min-h-0 flex-col overflow-visible rounded-2xl border border-border bg-card p-3.5 text-card-foreground shadow-sm transition hover:-translate-y-0.5 hover:bg-accent hover:shadow-md"
                >
                  <Link href={boardHref} className="block flex-1">
                    <div className="truncate text-sm font-semibold text-card-foreground">{board.name}</div>
                    {description && (
                      <div
                        className="mt-1 overflow-hidden text-xs leading-relaxed text-muted-foreground"
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
                    <Link href={boardHref} className="min-w-0 flex-1">
                      <div className="text-xs text-muted-foreground">Cards: {board.card_count ?? 0}</div>
                      {(board.tags?.length ?? 0) > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {board.tags?.slice(0, 2).map((tag) => (
                            <span
                              key={`${board.id}-${tag}`}
                              className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                          {(board.tags?.length ?? 0) > 2 && (
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              +{(board.tags?.length ?? 0) - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          aria-label="Board actions"
                          title="Board actions"
                        >
                          ...
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => void handleArchiveToggle(board)}>
                          {board.folder_id === archiveFolder?.id ? 'Unarchive' : 'Archive'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setCopyingBoard(board);
                            setCopyError('');
                            setCopySuccessMessage('');
                          }}
                        >
                          Copy to space
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStartEdit(board)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeletingBoard(board)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="fixed bottom-1 left-1/2 z-40 -translate-x-1/2 rounded-full border border-border bg-background/95 px-2 py-1 shadow-sm backdrop-blur md:bottom-3">
        <div className="flex items-center justify-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={currentPage <= 1} className="rounded-full">
            Prev
          </Button>
          <div className="text-xs text-muted-foreground">
            {currentPage} / {totalPages}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage >= totalPages} className="rounded-full">
            Next
          </Button>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-40">
        <Button type="button" onClick={() => setShowCreate(true)} size="icon" className="h-12 w-12 rounded-full shadow-lg" aria-label="Create board" title="Create board">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </Button>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">New board</div>
            <DialogTitle>Create board</DialogTitle>
            <DialogDescription>Create a new board without changing its behavior.</DialogDescription>
          </DialogHeader>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Board name" />
          {error && showCreate ? <div className="text-xs text-destructive">{error}</div> : null}
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => { setShowCreate(false); setError(''); }}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreate}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingBoard)} onOpenChange={(open) => (!open ? setEditingBoard(null) : undefined)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Rename board</div>
            <DialogTitle>Update name</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={editingName} onChange={(event) => setEditingName(event.target.value)} placeholder="Board name" />
            <Input value={editingTags} onChange={(event) => setEditingTags(event.target.value)} placeholder="Tags (comma separated)" />
            <Textarea value={editingDescription} onChange={(event) => setEditingDescription(event.target.value)} placeholder="Description" rows={4} />
            <Select
              value={editingFolderId === null ? 'none' : String(editingFolderId)}
              onValueChange={(value) => setEditingFolderId(value === 'none' ? null : Number(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="No folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No folder</SelectItem>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={String(folder.id)}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && editingBoard ? <div className="text-xs text-destructive">{error}</div> : null}
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => { setEditingBoard(null); setError(''); }}>
              Cancel
            </Button>
            <Button type="button" onClick={handleUpdate}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deletingBoard)} onOpenChange={(open) => (!open ? setDeletingBoard(null) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Delete board</div>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the board and its layout. Cards remain in your card box.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && deletingBoard ? <div className="text-xs text-destructive">{error}</div> : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-700" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {copyingBoard && (
        <BoardCopyToSpaceModal
          open={Boolean(copyingBoard)}
          boardTitle={copyingBoard.name}
          spaces={spaces}
          currentSpaceId={currentSpaceId ?? copyingBoard.space_id ?? null}
          busySpaceId={copyBusySpaceId}
          error={copyError}
          successMessage={copySuccessMessage}
          onClose={() => {
            setCopyingBoard(null);
            setCopyError('');
            setCopySuccessMessage('');
          }}
          onCopy={handleCopyBoard}
        />
      )}
    </div>
  );
}
