 'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { API_BASE } from '../../lib/api';
import {
  BoardFolder,
  createBoardFolder,
  deleteBoardFolder,
  getBoardFolders,
  getUserProfile,
  reorderBoardFolders,
  updateBoardFolder,
} from '../../lib/noteToolApi';

const navItems = [
  { href: '/cards', label: 'Card Box' },
];
const FOLDER_ORDER_STORAGE_KEY = 'note_tool_folder_order';

function sortFoldersForUi(folders: BoardFolder[]) {
  return [...folders].sort((a, b) => {
    const aIsArchive = a.system_key === 'archive';
    const bIsArchive = b.system_key === 'archive';
    if (aIsArchive !== bIsArchive) return aIsArchive ? 1 : -1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id;
  });
}

function applyStoredCustomOrder(folders: BoardFolder[]) {
  if (typeof window === 'undefined') return sortFoldersForUi(folders);
  try {
    const raw = window.localStorage.getItem(FOLDER_ORDER_STORAGE_KEY);
    if (!raw) return sortFoldersForUi(folders);
    const storedIds = JSON.parse(raw) as number[];
    if (!Array.isArray(storedIds)) return sortFoldersForUi(folders);
    const archive = folders.find((item) => item.system_key === 'archive') ?? null;
    const custom = folders.filter((item) => !item.is_system);
    const byId = new Map(custom.map((item) => [item.id, item]));
    const ordered = storedIds
      .map((id, index) => {
        const item = byId.get(id);
        if (!item) return null;
        return { ...item, sort_order: index + 1 };
      })
      .filter((item): item is BoardFolder => Boolean(item));
    const tail = custom
      .filter((item) => !storedIds.includes(item.id))
      .map((item, index) => ({ ...item, sort_order: ordered.length + index + 1 }));
    const merged = [...ordered, ...tail, ...(archive ? [{ ...archive, sort_order: 999999 }] : [])];
    return sortFoldersForUi(merged);
  } catch {
    return sortFoldersForUi(folders);
  }
}

function saveCustomOrder(ids: number[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FOLDER_ORDER_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore storage write failure
  }
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [displayName, setDisplayName] = useState('User');
  const [folders, setFolders] = useState<BoardFolder[]>([]);
  const [showFolderCreate, setShowFolderCreate] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderError, setFolderError] = useState('');
  const [openFolderMenuId, setOpenFolderMenuId] = useState<number | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<BoardFolder | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');
  const [renameFolderError, setRenameFolderError] = useState('');
  const [deletingFolder, setDeletingFolder] = useState<BoardFolder | null>(null);
  const boardsSectionRef = useRef<HTMLDivElement | null>(null);
  const folderMenuAreaRef = useRef<HTMLDivElement | null>(null);
  const lastFolderMutationRef = useRef(0);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(max-width: 1024px)');
    const apply = () => {
      setIsMobile(media.matches);
      setCollapsed(media.matches);
    };
    apply();
    media.addEventListener('change', apply);
    root.classList.remove('theme-light', 'theme-sand', 'theme-dark');
    root.classList.add('theme-light');
    const appRoot = document.getElementById('app-root');
    if (appRoot) {
      appRoot.classList.remove('theme-light', 'theme-sand', 'theme-dark');
      appRoot.classList.add('theme-light');
    }
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    let active = true;
    const loadFolders = async () => {
      const requestStartedAt = Date.now();
      try {
        const data = await getBoardFolders();
        if (!active) return;
        if (requestStartedAt < lastFolderMutationRef.current) return;
        setFolders(applyStoredCustomOrder(data));
      } catch (error) {
        console.error('Failed to load folders:', error);
      }
    };
    loadFolders();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (openFolderMenuId === null) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!folderMenuAreaRef.current) return;
      if (!folderMenuAreaRef.current.contains(event.target as Node)) {
        setOpenFolderMenuId(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [openFolderMenuId]);

  useEffect(() => {
    if (!showFolderCreate) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!boardsSectionRef.current) return;
      if (!boardsSectionRef.current.contains(event.target as Node)) {
        setShowFolderCreate(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [showFolderCreate]);

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      setFolderError('Folder name is required.');
      return;
    }
    try {
      lastFolderMutationRef.current = Date.now();
      const created = await createBoardFolder({ name });
      setFolders((prev) => sortFoldersForUi([...prev, created]));
      setNewFolderName('');
      setFolderError('');
      setShowFolderCreate(false);
      router.push(`/boards?folderId=${created.id}`);
    } catch (error) {
      setFolderError('Failed to create folder.');
    }
  };

  const handleRenameFolder = async (folder: BoardFolder, nextNameRaw: string) => {
    if (folder.is_system) return;
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
      lastFolderMutationRef.current = Date.now();
      const updated = await updateBoardFolder(folder.id, { name: nextName });
      setFolders((prev) => sortFoldersForUi(prev.map((item) => (item.id === folder.id ? updated : item))));
      setOpenFolderMenuId(null);
      setRenamingFolder(null);
      setRenameFolderValue('');
      setRenameFolderError('');
    } catch (error) {
      setRenameFolderError('Failed to rename folder.');
    }
  };

  const handleDeleteFolder = async (folder: BoardFolder) => {
    if (folder.is_system) return;
    try {
      lastFolderMutationRef.current = Date.now();
      await deleteBoardFolder(folder.id);
      setFolders((prev) => sortFoldersForUi(prev.filter((item) => item.id !== folder.id)));
      setOpenFolderMenuId(null);
      setDeletingFolder(null);
      if (hasSelectedFolder && selectedFolderId === folder.id) {
        router.push('/boards');
      }
    } catch {
      setFolderError('Failed to delete folder.');
    }
  };

  const applyFolderOrder = async (orderedCustomIds: number[]) => {
    lastFolderMutationRef.current = Date.now();
    const current = folders;
    const customById = new Map(current.filter((item) => !item.is_system).map((item) => [item.id, item]));
    const archive = current.find((item) => item.system_key === 'archive') ?? null;
    const nextCustom = orderedCustomIds
      .map((id, index) => {
        const item = customById.get(id);
        if (!item) return null;
        return { ...item, sort_order: index + 1 };
      })
      .filter((item): item is BoardFolder => Boolean(item));
    const optimistic = sortFoldersForUi(archive ? [...nextCustom, archive] : nextCustom);
    setFolders(optimistic);
    saveCustomOrder(orderedCustomIds);
    try {
      const updated = await reorderBoardFolders(orderedCustomIds);
      setFolders(sortFoldersForUi(updated));
    } catch (error) {
      setFolderError('Order saved locally. Server sync failed.');
    }
  };

  const moveFolderByOffset = async (folderId: number, delta: -1 | 1) => {
    const custom = folders.filter((item) => !item.is_system);
    const index = custom.findIndex((item) => item.id === folderId);
    if (index < 0) return;
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= custom.length) return;
    const ids = custom.map((item) => item.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(nextIndex, 0, moved);
    await applyFolderOrder(ids);
  };

  const selectedFolderId = Number(searchParams.get('folderId'));
  const hasSelectedFolder = pathname === '/boards' && Number.isInteger(selectedFolderId) && selectedFolderId > 0;

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

    loadProfile();
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
      className="min-h-screen text-[color:var(--app-foreground)] theme-light"
      id="app-root"
      style={
        {
          background: 'var(--app-bg)',
          '--sidebar-width': collapsed ? '0rem' : '16rem',
        } as React.CSSProperties
      }
    >
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
                  <div className="mt-2 block max-w-44 truncate text-sm font-semibold tracking-tight text-slate-100" title={displayName}>
                    Hi, {displayName}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setCollapsed((prev) => !prev)}
                className="rounded-full border border-slate-700/50 p-2 text-slate-200/80 hover:bg-slate-800/60"
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
          </div>
          <nav className={`mt-8 flex-1 space-y-1 ${collapsed ? 'px-2' : 'px-4'}`}>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (isMobile) {
                    setCollapsed(true);
                  }
                }}
                className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-slate-800/60 hover:text-white ${
                  pathname === item.href ? 'bg-slate-800/70 text-white' : ''
                }`}
                title={item.label}
              >
                <span>{item.label}</span>
              </Link>
            ))}

            <div ref={boardsSectionRef} className="rounded-lg">
              <div
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-slate-800/60 hover:text-white ${
                  pathname === '/boards' ? 'bg-slate-800/70 text-white' : ''
                }`}
              >
                <Link
                  href="/boards"
                  onClick={() => {
                    if (isMobile) {
                      setCollapsed(true);
                    }
                  }}
                  className="min-w-0 flex-1"
                  title="Boards"
                >
                  Boards
                </Link>
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowFolderCreate((prev) => !prev);
                      setFolderError('');
                    }}
                    className="ml-2 rounded-full p-1 text-slate-300 hover:bg-slate-700 hover:text-white"
                    title="Add folder"
                    aria-label="Add folder"
                  >
                    +
                  </button>
                )}
              </div>

              {!collapsed && showFolderCreate && (
                <div className="mt-2 rounded-lg border border-slate-700/50 bg-slate-900/30 p-2">
                  <input
                    value={newFolderName}
                    onChange={(event) => {
                      setNewFolderName(event.target.value);
                      if (folderError) {
                        setFolderError('');
                      }
                    }}
                    placeholder="Folder name"
                    className="w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                  {folderError && <div className="mt-1 text-[11px] text-rose-300">{folderError}</div>}
                  <div className="mt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setShowFolderCreate(false);
                        setNewFolderName('');
                        setFolderError('');
                      }}
                      className="text-[11px] text-slate-300 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateFolder}
                      className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-900"
                    >
                      Create
                    </button>
                  </div>
                </div>
              )}

              {!collapsed && folders.length > 0 && (
                <div ref={folderMenuAreaRef} className="mt-2 space-y-1 pr-1 pl-3">
                  {folders.map((folder) => {
                    const active = hasSelectedFolder && selectedFolderId === folder.id;
                    return (
                      <div key={folder.id} className="relative">
                        <Link
                          href={`/boards?folderId=${folder.id}`}
                          draggable={false}
                          onClick={(event) => {
                            setOpenFolderMenuId(null);
                            if (isMobile) {
                              setCollapsed(true);
                            }
                          }}
                          className={`flex items-center justify-between rounded-md px-3 py-1.5 text-xs transition ${
                            active ? 'bg-slate-800/70 text-white' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                          }`}
                          title={folder.name}
                        >
                          <span className="truncate pr-10">{folder.name}</span>
                        </Link>
                        {!folder.is_system && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setOpenFolderMenuId((prev) => (prev === folder.id ? null : folder.id));
                            }}
                            className={`absolute right-1 top-1/2 -translate-y-1/2 rounded px-1 text-[11px] ${
                              active ? 'text-slate-100 hover:bg-slate-700' : 'text-slate-300 hover:bg-slate-700/80'
                            }`}
                            aria-label={`Folder actions for ${folder.name}`}
                            title="Folder actions"
                          >
                            ...
                          </button>
                        )}
                        {openFolderMenuId === folder.id && !folder.is_system && (
                          <div className="absolute right-1 top-full z-30 mt-1 w-36 rounded-md border border-slate-700 bg-slate-900 py-1 shadow-lg">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void moveFolderByOffset(folder.id, -1);
                                setOpenFolderMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800"
                            >
                              Move up
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void moveFolderByOffset(folder.id, 1);
                                setOpenFolderMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800"
                            >
                              Move down
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setOpenFolderMenuId(null);
                                setRenamingFolder(folder);
                                setRenameFolderValue(folder.name);
                                setRenameFolderError('');
                              }}
                              className="w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800"
                            >
                              Rename folder
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setOpenFolderMenuId(null);
                                setDeletingFolder(folder);
                              }}
                              className="w-full px-3 py-1.5 text-left text-xs text-rose-300 hover:bg-slate-800 hover:text-rose-200"
                            >
                              Delete folder
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
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
              className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-slate-800/60 hover:text-white ${
                pathname === '/settings' ? 'bg-slate-800/70 text-white' : ''
              }`}
              title="Setting"
            >
              <span>Setting</span>
            </Link>
          </nav>
          <div className="px-4 pb-6 pt-10">
            {!collapsed && (
              <div className="text-xs" style={{ color: 'var(--sidebar-muted)' }}>
                Connect the Mind, Punch the Memory.
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className={`mt-4 w-full rounded-lg border border-slate-700/50 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800/60 ${
                collapsed ? 'px-0' : ''
              }`}
            >
              {collapsed ? '⏻' : 'Logout'}
            </button>
          </div>
          {!collapsed && (
            <div
              className="mt-auto border-t border-slate-700/40 px-4 pb-6 pt-4 text-center text-[11px] tracking-[0.08em]"
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
            className="absolute left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md hover:bg-slate-50"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <main className="app-main flex-1">
          <div className={`py-8 ${collapsed ? 'pl-16 pr-6 md:pl-20 md:pr-10' : 'px-6 md:px-10'}`}>
            {children}
          </div>
        </main>
      </div>

      {deletingFolder && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Delete folder</div>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">Are you sure?</h3>
            <p className="mt-3 text-sm text-slate-600">
              This will delete "{deletingFolder.name}". Boards inside will move to no folder.
            </p>
            <div className="mt-5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setDeletingFolder(null)}
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleDeleteFolder(deletingFolder);
                }}
                className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {renamingFolder && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Rename folder</div>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">Update name</h3>
            <input
              value={renameFolderValue}
              onChange={(event) => {
                setRenameFolderValue(event.target.value);
                if (renameFolderError) {
                  setRenameFolderError('');
                }
              }}
              placeholder="Folder name"
              className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            {renameFolderError && <div className="mt-2 text-xs text-rose-600">{renameFolderError}</div>}
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setRenamingFolder(null);
                  setRenameFolderValue('');
                  setRenameFolderError('');
                }}
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleRenameFolder(renamingFolder, renameFolderValue);
                }}
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
