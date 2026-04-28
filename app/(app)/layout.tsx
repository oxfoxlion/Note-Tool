'use client';

import Link from 'next/link';
import type { ReactNode, CSSProperties } from 'react';
import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LayoutGrid, KanbanSquare, Plus } from 'lucide-react';
import { API_BASE } from '../../lib/api';
import {
  BoardFolder,
  CardFolder,
  Space,
  createBoardFolder,
  createCardFolder,
  createSpace,
  deleteCardFolder,
  deleteBoardFolder,
  deleteSpace,
  getCardFolders,
  getBoardFolders,
  getSpaces,
  getUserProfile,
  reorderBoardFolders,
  reorderCardFolders,
  updateCardFolder,
  updateSpace,
  updateBoardFolder,
} from '../../lib/noteToolApi';
import { useCurrentSpace } from '../../hooks/useCurrentSpace';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import ThemeSync from '../../components/theme/ThemeSync';
import ThemeToggle from '../../components/theme/ThemeToggle';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Input } from '../../components/ui/input';

const LEGACY_FOLDER_ORDER_STORAGE_KEY = 'note_tool_folder_order';
const SPACE_ORDER_STORAGE_KEY = 'note_tool_space_order';

function getFolderOrderStorageKey(spaceId: number | null) {
  return spaceId ? `note_tool_folder_order_${spaceId}` : LEGACY_FOLDER_ORDER_STORAGE_KEY;
}

function sortFoldersForUi(folders: BoardFolder[]) {
  return [...folders].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id);
}

function applyStoredCustomOrder(folders: BoardFolder[], spaceId: number | null) {
  if (typeof window === 'undefined') return sortFoldersForUi(folders);
  try {
    const raw =
      window.localStorage.getItem(getFolderOrderStorageKey(spaceId)) ??
      window.localStorage.getItem(LEGACY_FOLDER_ORDER_STORAGE_KEY);
    if (!raw) return sortFoldersForUi(folders);
    const storedIds = JSON.parse(raw) as number[];
    if (!Array.isArray(storedIds)) return sortFoldersForUi(folders);
    const byId = new Map(folders.map((item) => [item.id, item]));
    const ordered = storedIds
      .map((id, index) => {
        const item = byId.get(id);
        if (!item) return null;
        return { ...item, sort_order: index + 1 };
      })
      .filter((item): item is BoardFolder => Boolean(item));
    const tail = folders
      .filter((item) => !storedIds.includes(item.id))
      .map((item, index) => ({ ...item, sort_order: ordered.length + index + 1 }));
    const merged = [...ordered, ...tail];
    return sortFoldersForUi(merged);
  } catch {
    return sortFoldersForUi(folders);
  }
}

function saveCustomOrder(ids: number[], spaceId: number | null) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getFolderOrderStorageKey(spaceId), JSON.stringify(ids));
  } catch {
    // ignore storage write failure
  }
}

function applyStoredSpaceOrder(spaces: Space[]) {
  if (spaces.length <= 1) return spaces;
  const defaultSpace = spaces.find((space) => space.is_default) ?? null;
  const customSpaces = spaces.filter((space) => !space.is_default);
  if (typeof window === 'undefined') {
    return defaultSpace ? [defaultSpace, ...customSpaces] : customSpaces;
  }
  try {
    const raw = window.localStorage.getItem(SPACE_ORDER_STORAGE_KEY);
    if (!raw) return defaultSpace ? [defaultSpace, ...customSpaces] : customSpaces;
    const storedIds = JSON.parse(raw) as number[];
    if (!Array.isArray(storedIds)) return defaultSpace ? [defaultSpace, ...customSpaces] : customSpaces;
    const byId = new Map(customSpaces.map((space) => [space.id, space]));
    const ordered = storedIds.map((id) => byId.get(id) ?? null).filter((space): space is Space => Boolean(space));
    const tail = customSpaces.filter((space) => !storedIds.includes(space.id));
    return defaultSpace ? [defaultSpace, ...ordered, ...tail] : [...ordered, ...tail];
  } catch {
    return defaultSpace ? [defaultSpace, ...customSpaces] : customSpaces;
  }
}

function saveSpaceOrder(ids: number[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SPACE_ORDER_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore storage write failure
  }
}

function getApiErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

function AppLayoutContent({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { currentSpaceId, setCurrentSpaceId } = useCurrentSpace();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [displayName, setDisplayName] = useState('User');
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [foldersBySpace, setFoldersBySpace] = useState<Record<number, BoardFolder[]>>({});
  const [cardFoldersBySpace, setCardFoldersBySpace] = useState<Record<number, CardFolder[]>>({});
  const [isCardBoxExpanded, setIsCardBoxExpanded] = useState(true);
  const [isBoardExpanded, setIsBoardExpanded] = useState(true);
  const [openSpaceMenuId, setOpenSpaceMenuId] = useState<number | null>(null);
  const [creatingSpaceAfterId, setCreatingSpaceAfterId] = useState<number | null>(null);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [spaceError, setSpaceError] = useState('');
  const [renamingSpace, setRenamingSpace] = useState<Space | null>(null);
  const [renameSpaceValue, setRenameSpaceValue] = useState('');
  const [renameSpaceError, setRenameSpaceError] = useState('');
  const [deletingSpace, setDeletingSpace] = useState<Space | null>(null);
  const [showFolderCreate, setShowFolderCreate] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderError, setFolderError] = useState('');
  const [showCardFolderCreate, setShowCardFolderCreate] = useState(false);
  const [newCardFolderName, setNewCardFolderName] = useState('');
  const [cardFolderError, setCardFolderError] = useState('');
  const [openFolderMenuId, setOpenFolderMenuId] = useState<number | null>(null);
  const [openCardFolderMenuId, setOpenCardFolderMenuId] = useState<number | null>(null);
  const [openBoardMenu, setOpenBoardMenu] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<BoardFolder | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');
  const [renameFolderError, setRenameFolderError] = useState('');
  const [deletingFolder, setDeletingFolder] = useState<BoardFolder | null>(null);
  const [, setActiveFolderIdsBySpace] = useState<Record<number, number | null>>({});
  const [, setActiveCardFolderIdsBySpace] = useState<Record<number, number | null>>({});
  const lastFolderMutationRef = useRef(0);
  const lastSpaceRouteRef = useRef<{ href: string; spaceId: number } | null>(null);
  const selectedFolderId = Number(searchParams.get('folderId'));
  const hasSelectedFolder = Number.isInteger(selectedFolderId) && selectedFolderId > 0;
  const isCardsPage = pathname.startsWith('/cards');
  const currentFolders = currentSpaceId ? foldersBySpace[currentSpaceId] ?? [] : [];
  const currentCardFolders = currentSpaceId ? cardFoldersBySpace[currentSpaceId] ?? [] : [];
  const currentSpace = (currentSpaceId ? spaces.find((space) => space.id === currentSpaceId) : null) ?? spaces[0] ?? null;

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1024px)');
    const apply = () => {
      setIsMobile(media.matches);
      setCollapsed(media.matches);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    let active = true;
    const loadSidebar = async () => {
      const requestMutationVersion = lastFolderMutationRef.current;
      try {
        const spacesData = applyStoredSpaceOrder(await getSpaces());
        if (!active) return;
        if (requestMutationVersion !== lastFolderMutationRef.current) return;
        const folderEntries = await Promise.all(
          spacesData.map(async (space) => [space.id, applyStoredCustomOrder(await getBoardFolders(space.id), space.id)] as const)
        );
        const cardFolderEntries = await Promise.all(
          spacesData.map(async (space) => [space.id, await getCardFolders(space.id)] as const)
        );
        if (!active) return;
        if (requestMutationVersion !== lastFolderMutationRef.current) return;
        setSpaces(spacesData);
        setFoldersBySpace(Object.fromEntries(folderEntries));
        setCardFoldersBySpace(Object.fromEntries(cardFolderEntries));

        const fallbackSpace = spacesData.find((space) => space.is_default) ?? spacesData[0] ?? null;
        const nextCurrentSpaceId =
          currentSpaceId && spacesData.some((space) => space.id === currentSpaceId)
            ? currentSpaceId
            : fallbackSpace?.id ?? null;
        if (nextCurrentSpaceId !== currentSpaceId) {
          setCurrentSpaceId(nextCurrentSpaceId);
        }
      } catch (error) {
        console.error('Failed to load sidebar:', error);
      }
    };
    void loadSidebar();
    return () => {
      active = false;
    };
  }, [currentSpaceId, setCurrentSpaceId]);

  useEffect(() => {
    if (!hasSelectedFolder) return;
    const targetMap = isCardsPage ? cardFoldersBySpace : foldersBySpace;
    const matchedSpaceEntry = Object.entries(targetMap).find(([, folders]) =>
      folders.some((folder) => folder.id === selectedFolderId)
    );
    if (!matchedSpaceEntry) return;
    const [spaceIdRaw] = matchedSpaceEntry;
    const folderSpaceId = Number(spaceIdRaw);
    if (!Number.isFinite(folderSpaceId)) return;

    if (folderSpaceId !== currentSpaceId) {
      setCurrentSpaceId(folderSpaceId);
    }
    const nextActiveFolderId = selectedFolderId;
    const timer = window.setTimeout(() => {
      if (isCardsPage) {
        setActiveCardFolderIdsBySpace((prev) =>
          prev[folderSpaceId] === nextActiveFolderId ? prev : { ...prev, [folderSpaceId]: nextActiveFolderId }
        );
      } else {
        setActiveFolderIdsBySpace((prev) =>
          prev[folderSpaceId] === nextActiveFolderId ? prev : { ...prev, [folderSpaceId]: nextActiveFolderId }
        );
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [cardFoldersBySpace, currentSpaceId, foldersBySpace, hasSelectedFolder, isCardsPage, selectedFolderId, setCurrentSpaceId]);

  const updateFoldersForSpace = (spaceId: number, updater: (folders: BoardFolder[]) => BoardFolder[]) => {
    setFoldersBySpace((prev) => ({
      ...prev,
      [spaceId]: updater(prev[spaceId] ?? []),
    }));
  };

  const handleSelectSpaceRoute = (spaceId: number, href: string, source: string) => {
    const isDev = process.env.NODE_ENV !== 'production';
    lastSpaceRouteRef.current = { href, spaceId };

    if (isDev) {
      console.debug('[layout] navigate by space route', { source, pathname, href, spaceId });
    }

    setCurrentSpaceId(spaceId);
    setOpenSpaceMenuId(null);
    setOpenFolderMenuId(null);
    setOpenCardFolderMenuId(null);
    setCreatingSpaceAfterId(null);
    setShowFolderCreate(false);
    if (href === '/cards') {
      setActiveFolderIdsBySpace((prev) => ({ ...prev, [spaceId]: null }));
    }
    router.push(href);
    if (isMobile) {
      setCollapsed(true);
    }
  };

  const handleSwitchSpace = (spaceId: number) => {
    const nextHref = pathname === '/cards' ? '/cards' : '/boards';
    handleSelectSpaceRoute(spaceId, nextHref, 'space-switcher');
  };

  const handleOpenCreateSpaceFromSwitcher = () => {
    const anchorSpaceId = currentSpace?.id ?? spaces[spaces.length - 1]?.id ?? null;
    if (!anchorSpaceId) return;
    setCreatingSpaceAfterId(anchorSpaceId);
    setNewSpaceName('');
    setSpaceError('');
  };

  const persistCurrentSpaceOrder = (nextSpaces: Space[]) => {
    saveSpaceOrder(nextSpaces.filter((space) => !space.is_default).map((space) => space.id));
  };

  const insertSpaceBelow = (current: Space[], targetSpaceId: number, newSpace: Space) => {
    const next = [...current];
    const targetIndex = next.findIndex((space) => space.id === targetSpaceId);
    if (targetIndex < 0) {
      next.push(newSpace);
      return next;
    }
    next.splice(targetIndex + 1, 0, newSpace);
    return next;
  };

  const handleCreateFolder = async () => {
    if (!currentSpaceId) {
      setFolderError('Select a space first.');
      return;
    }
    const name = newFolderName.trim();
    if (!name) {
      setFolderError('Folder name is required.');
      return;
    }
    try {
      lastFolderMutationRef.current += 1;
      const created = await createBoardFolder({ name, space_id: currentSpaceId });
      updateFoldersForSpace(currentSpaceId, (prev) => sortFoldersForUi([...prev, created]));
      setNewFolderName('');
      setFolderError('');
      setShowFolderCreate(false);
      setIsBoardExpanded(true);
      router.push(`/boards?folderId=${created.id}`);
    } catch {
      setFolderError('Failed to create folder.');
    }
  };

  const handleOpenCreateFolder = (spaceId: number) => {
    setCurrentSpaceId(spaceId);
    setOpenSpaceMenuId(null);
    setOpenCardFolderMenuId(null);
    setCreatingSpaceAfterId(null);
    setNewSpaceName('');
    setSpaceError('');
    setShowFolderCreate(true);
    setFolderError('');
  };

  const handleCreateSpaceBelow = async (spaceId: number) => {
    const name = newSpaceName.trim();
    if (!name) {
      setSpaceError('Space name is required.');
      return;
    }
    if (name.length > 60) {
      setSpaceError('Space name must be 60 characters or fewer.');
      return;
    }
    try {
      const created = await createSpace({ name });
      setSpaces((prev) => {
        const next = insertSpaceBelow(prev, spaceId, created);
        persistCurrentSpaceOrder(next);
        return next;
      });
      setFoldersBySpace((prev) => ({ ...prev, [created.id]: [] }));
      setCardFoldersBySpace((prev) => ({ ...prev, [created.id]: [] }));
      setCurrentSpaceId(created.id);
      setCreatingSpaceAfterId(null);
      setNewSpaceName('');
      setSpaceError('');
      router.push('/boards');
    } catch (error: unknown) {
      setSpaceError(getApiErrorMessage(error, 'Failed to create space.'));
    }
  };

  const handleDeleteSpace = async () => {
    if (!deletingSpace) return;
    try {
      const deletedId = deletingSpace.id;
      const result = await deleteSpace(deletedId);
      let remainingSpaces = spaces.filter((space) => space.id !== deletedId);
      if (result.next_default) {
        remainingSpaces = remainingSpaces.map((space) => ({
          ...space,
          is_default: space.id === result.next_default?.id,
        }));

        const existingIndex = remainingSpaces.findIndex((space) => space.id === result.next_default?.id);
        if (existingIndex >= 0) {
          remainingSpaces[existingIndex] = result.next_default;
        } else {
          remainingSpaces = [result.next_default, ...remainingSpaces];
        }
      }

      persistCurrentSpaceOrder(remainingSpaces);
      const fallbackSpace = result.next_default ?? remainingSpaces.find((space) => space.is_default) ?? remainingSpaces[0] ?? null;
      setSpaces(remainingSpaces);
      setFoldersBySpace((prev) => {
        const next = { ...prev };
        delete next[deletedId];
        if (result.next_default && !next[result.next_default.id]) {
          next[result.next_default.id] = [];
        }
        return next;
      });
      setCardFoldersBySpace((prev) => {
        const next = { ...prev };
        delete next[deletedId];
        if (result.next_default && !next[result.next_default.id]) {
          next[result.next_default.id] = [];
        }
        return next;
      });
      setOpenSpaceMenuId(null);
      setOpenCardFolderMenuId(null);
      if (currentSpaceId === deletedId) {
        setCurrentSpaceId(fallbackSpace?.id ?? null);
        router.push('/boards');
      }
      setDeletingSpace(null);
      setSpaceError('');
    } catch (error: unknown) {
      setSpaceError(getApiErrorMessage(error, 'Failed to delete space.'));
    }
  };

  const handleRenameSpace = async (space: Space, nextNameRaw: string) => {
    const nextName = nextNameRaw.trim();
    if (!nextName) {
      setRenameSpaceError('Space name is required.');
      return;
    }
    if (nextName.length > 60) {
      setRenameSpaceError('Space name must be 60 characters or fewer.');
      return;
    }
    if (nextName === space.name) {
      setRenamingSpace(null);
      setRenameSpaceValue('');
      setRenameSpaceError('');
      return;
    }
    try {
      const updated = await updateSpace(space.id, { name: nextName });
      setSpaces((prev) => prev.map((item) => (item.id === space.id ? updated : item)));
      setOpenSpaceMenuId(null);
      setRenamingSpace(null);
      setRenameSpaceValue('');
      setRenameSpaceError('');
    } catch (error: unknown) {
      setRenameSpaceError(getApiErrorMessage(error, 'Failed to rename space.'));
    }
  };

  const handleRenameFolder = async (folder: BoardFolder, nextNameRaw: string) => {
    const nextName = nextNameRaw.trim();
    if (!nextName) {
      setRenameFolderError('Folder name is required.');
      return;
    }
    if (nextName.length > 60) {
      setRenameFolderError('Folder name must be 60 characters or fewer.');
      return;
    }
    if (nextName === folder.name) {
      setRenamingFolder(null);
      setRenameFolderValue('');
      setRenameFolderError('');
      return;
    }
    try {
      lastFolderMutationRef.current += 1;
      const updated = await updateBoardFolder(folder.id, { name: nextName });
      const spaceId = folder.space_id ?? currentSpaceId;
      if (spaceId) {
        updateFoldersForSpace(spaceId, (prev) => sortFoldersForUi(prev.map((item) => (item.id === folder.id ? updated : item))));
      }
      setOpenFolderMenuId(null);
      setRenamingFolder(null);
      setRenameFolderValue('');
      setRenameFolderError('');
    } catch {
      setRenameFolderError('Failed to rename folder.');
    }
  };

  const handleDeleteFolder = async (folder: BoardFolder) => {
    try {
      lastFolderMutationRef.current += 1;
      await deleteBoardFolder(folder.id);
      const spaceId = folder.space_id ?? currentSpaceId;
      if (spaceId) {
        updateFoldersForSpace(spaceId, (prev) => sortFoldersForUi(prev.filter((item) => item.id !== folder.id)));
      }
      setOpenFolderMenuId(null);
      setDeletingFolder(null);
      if (hasSelectedFolder && selectedFolderId === folder.id && currentSpaceId === (folder.space_id ?? currentSpaceId)) {
        router.push('/boards');
      }
    } catch {
      setFolderError('Failed to delete folder.');
    }
  };

  const applyFolderOrder = async (orderedCustomIds: number[]) => {
    if (!currentSpaceId) return;
    lastFolderMutationRef.current += 1;
    const current = currentFolders;
    const byId = new Map(current.map((item) => [item.id, item]));
    const nextFolders = orderedCustomIds
      .map((id, index) => {
        const item = byId.get(id);
        if (!item) return null;
        return { ...item, sort_order: index + 1 };
      })
      .filter((item): item is BoardFolder => Boolean(item));
    const tail = current
      .filter((item) => !orderedCustomIds.includes(item.id))
      .map((item, index) => ({ ...item, sort_order: nextFolders.length + index + 1 }));
    const optimistic = sortFoldersForUi([...nextFolders, ...tail]);
    updateFoldersForSpace(currentSpaceId, () => optimistic);
    saveCustomOrder(orderedCustomIds, currentSpaceId);
    try {
      await reorderBoardFolders(orderedCustomIds, currentSpaceId);
    } catch {
      setFolderError('Order saved locally. Server sync failed.');
    }
  };

  const moveFolderByOffset = async (folderId: number, delta: -1 | 1) => {
    const index = currentFolders.findIndex((item) => item.id === folderId);
    if (index < 0) return;
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= currentFolders.length) return;
    const ids = currentFolders.map((item) => item.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(nextIndex, 0, moved);
    await applyFolderOrder(ids);
  };

  const applyCardFolderOrder = async (orderedIds: number[]) => {
    if (!currentSpaceId) return;
    const current = currentCardFolders;
    const byId = new Map(current.map((item) => [item.id, item]));
    const ordered = orderedIds.map((id) => byId.get(id) ?? null).filter((item): item is CardFolder => Boolean(item));
    const tail = current.filter((item) => !orderedIds.includes(item.id));
    const optimistic = [...ordered, ...tail].map((item, index) => ({ ...item, sort_order: index + 1 }));
    setCardFoldersBySpace((prev) => ({ ...prev, [currentSpaceId]: optimistic }));
    try {
      await reorderCardFolders(orderedIds, currentSpaceId);
    } catch {
      setFolderError('Failed to reorder card folders.');
    }
  };

  const moveCardFolderByOffset = async (folderId: number, delta: -1 | 1) => {
    const ids = currentCardFolders.map((item) => item.id);
    const index = ids.indexOf(folderId);
    if (index < 0) return;
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= ids.length) return;
    const [moved] = ids.splice(index, 1);
    ids.splice(nextIndex, 0, moved);
    await applyCardFolderOrder(ids);
  };

  const handleCreateCardFolderInSidebar = async () => {
    if (!currentSpaceId) return;
    const name = newCardFolderName.trim();
    if (!name) {
      setCardFolderError('Folder name is required.');
      return;
    }
    try {
      const created = await createCardFolder({ name, space_id: currentSpaceId });
      const next = [...currentCardFolders, created].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id);
      setCardFoldersBySpace((prev) => ({ ...prev, [currentSpaceId]: next }));
      setActiveCardFolderIdsBySpace((prev) => ({ ...prev, [currentSpaceId]: created.id }));
      setNewCardFolderName('');
      setCardFolderError('');
      setShowCardFolderCreate(false);
      router.push(`/cards?folderId=${created.id}`);
    } catch {
      setCardFolderError('Failed to create card folder.');
    }
  };

  const handleRenameCardFolderInSidebar = async (folder: CardFolder) => {
    const raw = window.prompt('Rename folder', folder.name);
    const name = raw?.trim() ?? '';
    if (!name || name === folder.name) return;
    try {
      const updated = await updateCardFolder(folder.id, { name });
      if (!currentSpaceId) return;
      setCardFoldersBySpace((prev) => ({
        ...prev,
        [currentSpaceId]: (prev[currentSpaceId] ?? []).map((item) => (item.id === folder.id ? updated : item)),
      }));
    } catch {
      setFolderError('Failed to rename card folder.');
    }
  };

  const handleDeleteCardFolderInSidebar = async (folder: CardFolder) => {
    const confirmed = window.confirm(`Delete folder "${folder.name}"?`);
    if (!confirmed) return;
    try {
      await deleteCardFolder(folder.id);
      if (!currentSpaceId) return;
      setCardFoldersBySpace((prev) => ({
        ...prev,
        [currentSpaceId]: (prev[currentSpaceId] ?? []).filter((item) => item.id !== folder.id),
      }));
      setActiveCardFolderIdsBySpace((prev) => ({ ...prev, [currentSpaceId]: null }));
      if (isCardsPage && hasSelectedFolder && selectedFolderId === folder.id) {
        router.push('/cards');
      }
    } catch {
      setFolderError('Failed to delete card folder.');
    }
  };

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        const cachedName = localStorage.getItem('note_tool_display_name') || '';
        const cachedDisplayName = cachedName.trim();
        if (cachedDisplayName) {
          setDisplayName(cachedDisplayName);
        }

        const profile = await getUserProfile();
        if (!active) return;
        const nextName = profile.displayName?.trim();
        if (nextName) {
          setDisplayName(nextName);
          localStorage.setItem('note_tool_display_name', nextName);
          return;
        }
        setDisplayName('User');
      } catch (error) {
        console.error('Failed to load profile:', error);
      }
    };

    void loadProfile();
    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/note_tool/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
    localStorage.removeItem('userId');
    localStorage.removeItem('note_tool_token');
    localStorage.removeItem('note_tool_display_name');
    router.push('/auth/login');
  };

  return (
    <div
      className="min-h-screen text-[color:var(--app-foreground)]"
      id="app-root"
      style={
        {
          background: 'var(--app-bg)',
          '--sidebar-width': collapsed ? '0rem' : '16rem',
        } as CSSProperties
      }
    >
      <ThemeSync />
      <div className="relative flex min-h-screen">
        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            aria-label="Close sidebar"
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 flex-col overflow-y-auto overflow-x-visible transition-all duration-300 lg:static lg:z-auto ${
            collapsed ? 'w-0 lg:w-0' : 'w-full lg:w-64'
          }`}
          style={{ background: 'var(--sidebar-bg)', color: 'var(--sidebar-fg)' }}
        >
          <div className={`px-4 pt-6 ${collapsed ? 'px-3' : 'px-6'}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.3em]" style={{ color: 'var(--sidebar-muted)' }}>
                  {collapsed ? 'MP' : 'Mipun'}
                </div>
                {!collapsed && (
                  <div className="mt-2 block max-w-44 truncate text-sm font-semibold tracking-tight" style={{ color: 'var(--sidebar-fg)' }} title={displayName}>
                    Hi, {displayName}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setCollapsed((prev) => !prev)}
                className="rounded-full border p-2"
                style={{
                  borderColor: 'var(--sidebar-border)',
                  color: 'var(--sidebar-fg)',
                  background: 'transparent',
                }}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d={collapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                </svg>
              </button>
            </div>
            {!collapsed && (
              <div className="mt-4 flex items-center gap-2">
                <ThemeToggle
                  className="h-9 w-9 rounded-full text-xs"
                  style={{
                    color: 'var(--sidebar-fg)',
                  }}
                  variant="outline"
                />
              </div>
            )}
          </div>

          <nav className={`mt-8 flex-1 space-y-1 ${collapsed ? 'px-2' : 'px-4'}`}>
            <div className="space-y-2 pr-1">
              {!collapsed && (
                <div className="rounded-xl border px-3 py-2" style={{ borderColor: 'var(--sidebar-border)' }}>
                  <div className="mb-1 text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--sidebar-muted)' }}>
                    Space
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 w-full justify-between rounded-md border px-2 text-xs hover:bg-[color:var(--sidebar-hover)]"
                        style={{
                          borderColor: 'var(--sidebar-border)',
                          color: 'var(--sidebar-fg)',
                          background: 'var(--sidebar-active)',
                        }}
                        title={currentSpace?.name ?? 'Select space'}
                        aria-label="Switch space"
                      >
                        <span className="truncate">{currentSpace?.name ?? 'Select space'}</span>
                        <svg viewBox="0 0 24 24" className="ml-2 h-3.5 w-3.5 shrink-0" aria-hidden="true">
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                        </svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-52"
                      style={{
                        borderColor: 'var(--sidebar-border)',
                        background: 'var(--sidebar-bg)',
                        color: 'var(--sidebar-fg)',
                      }}
                    >
                      {spaces.map((space) => {
                        const selected = currentSpaceId === space.id;
                        return (
                          <DropdownMenuItem key={space.id} onClick={() => handleSwitchSpace(space.id)} className="justify-between">
                            <span className="truncate">{space.name}</span>
                            {selected ? (
                              <svg viewBox="0 0 24 24" className="ml-2 h-4 w-4 shrink-0" aria-hidden="true">
                                <path d="M5 12l4 4 10-10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                              </svg>
                            ) : null}
                          </DropdownMenuItem>
                        );
                      })}
                      <DropdownMenuItem
                        className="mt-1 border-t border-[color:var(--sidebar-border)] pt-2 text-[11px] text-[color:var(--sidebar-muted)]"
                        onClick={() => {
                          handleOpenCreateSpaceFromSwitcher();
                        }}
                      >
                        <Plus className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                        Add space
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}

              {currentSpace && (
                <div key={currentSpace.id} className="rounded-lg">
                  <div
                    className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium"
                    style={{
                      background: undefined,
                      color: 'var(--sidebar-fg)',
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="block truncate font-semibold" title={currentSpace.name}>
                        {currentSpace.name}
                      </span>
                    </div>

                    {!collapsed && (
                      <DropdownMenu
                        open={openSpaceMenuId === currentSpace.id}
                        onOpenChange={(open) => {
                          setOpenFolderMenuId(null);
                          setOpenSpaceMenuId(open ? currentSpace.id : null);
                        }}
                      >
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="ml-2 h-8 w-8 rounded-full"
                            style={{ color: 'var(--sidebar-fg)' }}
                            title="Space actions"
                            aria-label={`Space actions for ${currentSpace.name}`}
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                              <circle cx="5" cy="12" r="1.7" fill="currentColor" />
                              <circle cx="12" cy="12" r="1.7" fill="currentColor" />
                              <circle cx="19" cy="12" r="1.7" fill="currentColor" />
                            </svg>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-44"
                          style={{
                            borderColor: 'var(--sidebar-border)',
                            background: 'var(--sidebar-bg)',
                            color: 'var(--sidebar-fg)',
                          }}
                        >
                          <DropdownMenuItem
                            onClick={() => {
                              setOpenSpaceMenuId(null);
                              setRenamingSpace(currentSpace);
                              setRenameSpaceValue(currentSpace.name);
                              setRenameSpaceError('');
                            }}
                          >
                            Rename space
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setOpenSpaceMenuId(null);
                              setDeletingSpace(currentSpace);
                              setSpaceError('');
                            }}
                            className="text-rose-400 focus:text-rose-300"
                          >
                            Delete space
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {!collapsed && (
                    <div className="mt-2 space-y-2 pl-3 pr-1">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setIsCardBoxExpanded((prev) => !prev)}
                          className="rounded-md p-1.5 transition hover:bg-[color:var(--sidebar-hover)]"
                          aria-label={isCardBoxExpanded ? 'Collapse Card Box folders' : 'Expand Card Box folders'}
                          title={isCardBoxExpanded ? 'Collapse' : 'Expand'}
                        >
                          <svg viewBox="0 0 16 16" className={cn('h-3.5 w-3.5 transition', isCardBoxExpanded && 'rotate-90')} aria-hidden="true">
                            <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectSpaceRoute(currentSpace.id, '/cards', 'card-box-root')}
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold transition hover:bg-[color:var(--sidebar-hover)]"
                          style={{ color: 'var(--sidebar-fg)' }}
                        >
                          <LayoutGrid className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">Card Box</span>
                        </button>
                        <DropdownMenu
                          open={openCardFolderMenuId === -1}
                          onOpenChange={(open) => setOpenCardFolderMenuId(open ? -1 : null)}
                        >
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full"
                              style={{ color: 'var(--sidebar-fg)' }}
                              title="Card Box actions"
                              aria-label="Card Box actions"
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                                <circle cx="5" cy="12" r="1.7" fill="currentColor" />
                                <circle cx="12" cy="12" r="1.7" fill="currentColor" />
                                <circle cx="19" cy="12" r="1.7" fill="currentColor" />
                              </svg>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-44"
                            style={{
                              borderColor: 'var(--sidebar-border)',
                              background: 'var(--sidebar-bg)',
                              color: 'var(--sidebar-fg)',
                            }}
                          >
                            <DropdownMenuItem
                              onClick={() => {
                                setOpenCardFolderMenuId(null);
                                setNewCardFolderName('');
                                setCardFolderError('');
                                setShowCardFolderCreate(true);
                              }}
                            >
                              Create folder
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {isCardBoxExpanded && (
                        <div className="space-y-1 pl-4">
                          {currentCardFolders.map((folder) => {
                            const index = currentCardFolders.findIndex((item) => item.id === folder.id);
                            const isFirst = index <= 0;
                            const isLast = index === currentCardFolders.length - 1;
                            return (
                              <div key={folder.id} className="relative">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveCardFolderIdsBySpace((prev) => ({ ...prev, [currentSpace.id]: folder.id }));
                                    handleSelectSpaceRoute(currentSpace.id, `/cards?folderId=${folder.id}`, 'card-folder');
                                  }}
                                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 pr-10 text-left text-xs transition hover:bg-[color:var(--sidebar-hover)]"
                                  style={{ color: 'var(--sidebar-fg)' }}
                                title={folder.name}
                              >
                                <span className="truncate">{folder.name}</span>
                              </button>
                                <DropdownMenu
                                  open={openCardFolderMenuId === folder.id}
                                  onOpenChange={(open) => setOpenCardFolderMenuId(open ? folder.id : null)}
                                >
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full"
                                      style={{ color: 'var(--sidebar-fg)' }}
                                      aria-label={`Card folder actions for ${folder.name}`}
                                      title="Folder actions"
                                    >
                                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                                        <circle cx="5" cy="12" r="1.7" fill="currentColor" />
                                        <circle cx="12" cy="12" r="1.7" fill="currentColor" />
                                        <circle cx="19" cy="12" r="1.7" fill="currentColor" />
                                      </svg>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="w-44"
                                    style={{
                                      borderColor: 'var(--sidebar-border)',
                                      background: 'var(--sidebar-bg)',
                                      color: 'var(--sidebar-fg)',
                                    }}
                                  >
                                    <DropdownMenuItem
                                      disabled={isFirst}
                                      onClick={() => {
                                        void moveCardFolderByOffset(folder.id, -1);
                                      }}
                                    >
                                      Move up
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      disabled={isLast}
                                      onClick={() => {
                                        void moveCardFolderByOffset(folder.id, 1);
                                      }}
                                    >
                                      Move down
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        void handleRenameCardFolderInSidebar(folder);
                                      }}
                                    >
                                      Rename folder
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        void handleDeleteCardFolderInSidebar(folder);
                                      }}
                                      className="text-rose-400 focus:text-rose-300"
                                    >
                                      Delete folder
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="mt-2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setIsBoardExpanded((prev) => !prev)}
                          className="rounded-md p-1.5 transition hover:bg-[color:var(--sidebar-hover)]"
                          aria-label={isBoardExpanded ? 'Collapse board folders' : 'Expand board folders'}
                          title={isBoardExpanded ? 'Collapse' : 'Expand'}
                        >
                          <svg viewBox="0 0 16 16" className={cn('h-3.5 w-3.5 transition', isBoardExpanded && 'rotate-90')} aria-hidden="true">
                            <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectSpaceRoute(currentSpace.id, '/boards', 'board-root')}
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold transition hover:bg-[color:var(--sidebar-hover)]"
                          style={{ color: 'var(--sidebar-fg)' }}
                        >
                          <KanbanSquare className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">Board</span>
                        </button>
                        <DropdownMenu open={openBoardMenu} onOpenChange={setOpenBoardMenu}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full"
                              style={{ color: 'var(--sidebar-fg)' }}
                              title="Board actions"
                              aria-label="Board actions"
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                                <circle cx="5" cy="12" r="1.7" fill="currentColor" />
                                <circle cx="12" cy="12" r="1.7" fill="currentColor" />
                                <circle cx="19" cy="12" r="1.7" fill="currentColor" />
                              </svg>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-44"
                            style={{
                              borderColor: 'var(--sidebar-border)',
                              background: 'var(--sidebar-bg)',
                              color: 'var(--sidebar-fg)',
                            }}
                          >
                            <DropdownMenuItem
                              onClick={() => {
                                setOpenBoardMenu(false);
                                handleOpenCreateFolder(currentSpace.id);
                              }}
                            >
                              Create folder
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {isBoardExpanded && (
                        <div className="space-y-1 pl-4">
                          {currentFolders.map((folder) => {
                            const index = currentFolders.findIndex((item) => item.id === folder.id);
                            const isFirst = index <= 0;
                            const isLast = index === currentFolders.length - 1;
                            return (
                              <div key={folder.id} className="relative">
                                <button
                                  type="button"
                                  draggable={false}
                                  onClick={() => {
                                    setOpenFolderMenuId(null);
                                    setActiveFolderIdsBySpace((prev) => ({ ...prev, [currentSpace.id]: folder.id }));
                                    handleSelectSpaceRoute(currentSpace.id, `/boards?folderId=${folder.id}`, 'board-folder');
                                  }}
                                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 pr-10 text-left text-xs transition hover:bg-[color:var(--sidebar-hover)]"
                                  style={{ color: 'var(--sidebar-fg)' }}
                                  title={folder.name}
                                >
                                  <span className="truncate">{folder.name}</span>
                                </button>
                                <DropdownMenu
                                  open={openFolderMenuId === folder.id}
                                  onOpenChange={(open) => setOpenFolderMenuId(open ? folder.id : null)}
                                >
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full"
                                      style={{ color: 'var(--sidebar-fg)' }}
                                      aria-label={`Folder actions for ${folder.name}`}
                                      title="Folder actions"
                                    >
                                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                                        <circle cx="5" cy="12" r="1.7" fill="currentColor" />
                                        <circle cx="12" cy="12" r="1.7" fill="currentColor" />
                                        <circle cx="19" cy="12" r="1.7" fill="currentColor" />
                                      </svg>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="w-40"
                                    style={{
                                      borderColor: 'var(--sidebar-border)',
                                      background: 'var(--sidebar-bg)',
                                      color: 'var(--sidebar-fg)',
                                    }}
                                  >
                                    <DropdownMenuItem
                                      disabled={isFirst}
                                      onClick={() => {
                                        void moveFolderByOffset(folder.id, -1);
                                      }}
                                    >
                                      Move up
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      disabled={isLast}
                                      onClick={() => {
                                        void moveFolderByOffset(folder.id, 1);
                                      }}
                                    >
                                      Move down
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setOpenFolderMenuId(null);
                                        setRenamingFolder(folder);
                                        setRenameFolderValue(folder.name);
                                        setRenameFolderError('');
                                      }}
                                    >
                                      Rename folder
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setOpenFolderMenuId(null);
                                        setDeletingFolder(folder);
                                      }}
                                      className="text-rose-400 focus:text-rose-300"
                                    >
                                      Delete folder
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <Link
              href="/settings"
              onClick={() => {
                if (isMobile) {
                  setCollapsed(true);
                }
              }}
              className="mt-2 flex items-center rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-[color:var(--sidebar-hover)]"
              style={{
                background: pathname === '/settings' ? 'var(--sidebar-active)' : undefined,
                color: 'var(--sidebar-fg)',
              }}
              title="Settings"
            >
              <span>Settings</span>
            </Link>
          </nav>

          <div className="px-4 pb-6 pt-10">
            {!collapsed && (
              <div className="text-xs" style={{ color: 'var(--sidebar-muted)' }}>
                Connect the Mind, Punch the Memory.
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handleLogout}
              className={cn('mt-4 w-full bg-transparent text-xs font-semibold', collapsed && 'px-0')}
              style={{
                borderColor: 'var(--sidebar-border)',
                color: 'var(--sidebar-fg)',
              }}
            >
              {collapsed ? '⏻' : 'Logout'}
            </Button>
          </div>

          {!collapsed && (
            <div
              className="mt-auto border-t px-4 pb-6 pt-4 text-center text-[11px] tracking-[0.08em]"
              style={{ color: 'var(--sidebar-muted)' }}
            >
              InstantCheese Shao
            </div>
          )}
        </aside>

        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="absolute left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md hover:bg-accent"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        )}

        <main className="app-main flex-1">
          <div className={`py-8 ${collapsed ? 'pl-16 pr-6 md:pl-20 md:pr-10' : 'px-6 md:px-10'}`}>{children}</div>
        </main>
      </div>

      <Dialog
        open={showFolderCreate}
        onOpenChange={(open) => {
          if (open) return;
          setShowFolderCreate(false);
          setNewFolderName('');
          setFolderError('');
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create folder</DialogTitle>
            <DialogDescription>Create a board folder in the selected space.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={newFolderName}
              onChange={(event) => {
                setNewFolderName(event.target.value);
                if (folderError) {
                  setFolderError('');
                }
              }}
              placeholder="Folder name"
            />
            {folderError && <div className="text-xs text-rose-600">{folderError}</div>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowFolderCreate(false);
                setNewFolderName('');
                setFolderError('');
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateFolder}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showCardFolderCreate}
        onOpenChange={(open) => {
          if (open) return;
          setShowCardFolderCreate(false);
          setNewCardFolderName('');
          setCardFolderError('');
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create folder</DialogTitle>
            <DialogDescription>Create a card folder in the selected space.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={newCardFolderName}
              onChange={(event) => {
                setNewCardFolderName(event.target.value);
                if (cardFolderError) {
                  setCardFolderError('');
                }
              }}
              placeholder="Folder name"
            />
            {cardFolderError && <div className="text-xs text-rose-600">{cardFolderError}</div>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCardFolderCreate(false);
                setNewCardFolderName('');
                setCardFolderError('');
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleCreateCardFolderInSidebar()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={creatingSpaceAfterId !== null}
        onOpenChange={(open) => {
          if (open) return;
          setCreatingSpaceAfterId(null);
          setNewSpaceName('');
          setSpaceError('');
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create space</DialogTitle>
            <DialogDescription>Add a new space below the selected one.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={newSpaceName}
              onChange={(event) => {
                setNewSpaceName(event.target.value);
                if (spaceError) {
                  setSpaceError('');
                }
              }}
              placeholder="Space name"
            />
            {spaceError && <div className="text-xs text-rose-600">{spaceError}</div>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreatingSpaceAfterId(null);
                setNewSpaceName('');
                setSpaceError('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (creatingSpaceAfterId !== null) {
                  void handleCreateSpaceBelow(creatingSpaceAfterId);
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renamingSpace !== null}
        onOpenChange={(open) => {
          if (open) return;
          setRenamingSpace(null);
          setRenameSpaceValue('');
          setRenameSpaceError('');
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename space</DialogTitle>
            <DialogDescription>Update the space name without changing its cards or boards.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={renameSpaceValue}
              onChange={(event) => {
                setRenameSpaceValue(event.target.value);
                if (renameSpaceError) {
                  setRenameSpaceError('');
                }
              }}
              placeholder="Space name"
            />
            {renameSpaceError && <div className="text-xs text-rose-600">{renameSpaceError}</div>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRenamingSpace(null);
                setRenameSpaceValue('');
                setRenameSpaceError('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (renamingSpace) {
                  void handleRenameSpace(renamingSpace, renameSpaceValue);
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renamingFolder !== null}
        onOpenChange={(open) => {
          if (open) return;
          setRenamingFolder(null);
          setRenameFolderValue('');
          setRenameFolderError('');
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
            <DialogDescription>Update the folder name without changing its boards.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={renameFolderValue}
              onChange={(event) => {
                setRenameFolderValue(event.target.value);
                if (renameFolderError) {
                  setRenameFolderError('');
                }
              }}
              placeholder="Folder name"
            />
            {renameFolderError && <div className="text-xs text-rose-600">{renameFolderError}</div>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRenamingFolder(null);
                setRenameFolderValue('');
                setRenameFolderError('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (renamingFolder) {
                  void handleRenameFolder(renamingFolder, renameFolderValue);
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deletingFolder !== null}
        onOpenChange={(open) => {
          if (open) return;
          setDeletingFolder(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingFolder
                ? `This will delete "${deletingFolder.name}". Boards inside will move to no folder.`
                : 'This will delete the selected folder.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => {
                if (deletingFolder) {
                  void handleDeleteFolder(deletingFolder);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deletingSpace !== null}
        onOpenChange={(open) => {
          if (open) return;
          setDeletingSpace(null);
          setSpaceError('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete space</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingSpace
                ? `This will delete "${deletingSpace.name}" and everything inside this space.`
                : 'This will delete the selected space.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {spaceError && <div className="text-xs text-rose-600">{spaceError}</div>}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => void handleDeleteSpace()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <AppLayoutContent>{children}</AppLayoutContent>
    </Suspense>
  );
}
