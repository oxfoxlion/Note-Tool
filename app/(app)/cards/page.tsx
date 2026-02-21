'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import CardOverlay from '../../../components/CardOverlay';
import CardCreateOverlay from '../../../components/CardCreateOverlay';
import CardPreview from '../../../components/CardPreview';
import {
  Card,
  Board,
  createCard,
  deleteCard,
  getBoard,
  getBoards,
  getCards,
  getUserSettings,
  updateCard,
  updateUserSettings,
  removeCardFromBoard,
} from '../../../lib/noteToolApi';

export default function CardsPage() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [isXl, setIsXl] = useState(true);
  const [cards, setCards] = useState<Card[]>([]);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [query, setQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [cardOpenMode, setCardOpenMode] = useState<'modal' | 'sidepanel'>('modal');
  const [boardFilter, setBoardFilter] = useState<string>('');
  const [error, setError] = useState('');
  const [cardPreviewLength, setCardPreviewLength] = useState(120);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [page, setPage] = useState(1);
  const filterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mediaMobile = window.matchMedia('(max-width: 768px)');
    const mediaXl = window.matchMedia('(min-width: 1280px)');
    const handleChange = () => {
      setIsMobile(mediaMobile.matches);
      setIsXl(mediaXl.matches);
      if (mediaMobile.matches) {
        setCardOpenMode('sidepanel');
      }
    };
    handleChange();
    mediaMobile.addEventListener('change', handleChange);
    mediaXl.addEventListener('change', handleChange);
    return () => {
      mediaMobile.removeEventListener('change', handleChange);
      mediaXl.removeEventListener('change', handleChange);
    };
  }, []);

  useEffect(() => {
    if (!showFilterMenu) return;
    const handleClick = (event: MouseEvent) => {
      if (!filterRef.current) return;
      if (!filterRef.current.contains(event.target as Node)) {
        setShowFilterMenu(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [showFilterMenu]);

  useEffect(() => {
    const load = async () => {
      try {
        const [cardsData, boardsData, settingsData] = await Promise.all([
          getCards(),
          getBoards(),
          getUserSettings(),
        ]);
        setCards(cardsData);
        setAllCards(cardsData);
        setBoards(boardsData);
        if (settingsData?.cardOpenMode) {
          setCardOpenMode(settingsData.cardOpenMode);
        }
        if (typeof settingsData?.cardPreviewLength === 'number') {
          setCardPreviewLength(settingsData.cardPreviewLength);
        }
      } catch (err: unknown) {
        if ((err as { message?: string })?.message === 'UNAUTHORIZED') {
          router.push('/auth/login');
          return;
        }
        setError('Failed to load cards.');
      }
    };
    load();
  }, [router]);

  useEffect(() => {
    const loadBoardCards = async () => {
      if (!boardFilter) {
        setCards(allCards);
        return;
      }
      try {
        const data = await getBoard(Number(boardFilter));
        setCards(data.cards);
      } catch {
        setError('Failed to load board cards.');
      }
    };
    loadBoardCards();
  }, [boardFilter, allCards]);

  const filteredCards = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return cards;
    return cards.filter((card) => {
      const haystack = `${card.title} ${card.content ?? ''}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [cards, query]);

  useEffect(() => {
    setPage(1);
  }, [query, boardFilter, cards.length, isMobile, isXl]);

  const pageSize = isMobile ? 12 : isXl ? 9 : 6;

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedCards = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCards.slice(start, start + pageSize);
  }, [filteredCards, currentPage, pageSize]);

  const handleCreate = async (payload: { title: string; content: string }) => {
    setError('');
    const created = await createCard({ title: payload.title, content: payload.content });
    const nextAll = [created, ...allCards];
    setAllCards(nextAll);
    if (!boardFilter) {
      setCards(nextAll);
    }
  };

  const handleSave = async (payload: { title: string; content: string }) => {
    if (!selectedCard) return;
    const updated = await updateCard(selectedCard.id, payload);
    const updateList = (list: Card[]) =>
      list.map((item) => (item.id === updated.id ? updated : item));
    setCards((prev) => updateList(prev));
    setAllCards((prev) => updateList(prev));
    setSelectedCard(updated);
  };

  const handleDelete = async () => {
    if (!selectedCard) return;
    await deleteCard(selectedCard.id);
    const next = (list: Card[]) => list.filter((item) => item.id !== selectedCard.id);
    setCards((prev) => next(prev));
    setAllCards((prev) => next(prev));
    setSelectedCard(null);
  };

  const handleRemoveFromBoardById = async (targetBoardId: number, cardId: number) => {
    await removeCardFromBoard(targetBoardId, cardId);
    if (boardFilter && Number(boardFilter) === targetBoardId) {
      setCards((prev) => prev.filter((item) => item.id !== cardId));
    }
  };

  const boardTitle = boardFilter
    ? boards.find((board) => String(board.id) === boardFilter)?.name || 'Selected board'
    : 'All cards';

  const boardFilterLabel =
    boards.find((board) => String(board.id) === boardFilter)?.name || 'All boards';

  const handleOpenModeChange = async (mode: 'modal' | 'sidepanel') => {
    if (isMobile) return;
    setCardOpenMode(mode);
    try {
      await updateUserSettings({ cardOpenMode: mode });
    } catch {
      setError('Failed to update view mode.');
    }
  };

  const handleNavigateOverlayCard = useCallback(
    (targetCardId: number) => {
      const target = allCards.find((item) => item.id === targetCardId) ?? cards.find((item) => item.id === targetCardId);
      if (target) {
        setSelectedCard(target);
        return;
      }
      router.push(`/cards/${targetCardId}`);
    },
    [allCards, cards, router]
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Card Box</div>
          <div className="mt-2 min-h-[20px] text-sm font-semibold text-slate-700">
            {boardFilter ? `Card Box / ${boardTitle}` : ''}
          </div>
        </div>
        <div className="flex w-full flex-nowrap items-center justify-end gap-1 sm:w-auto">
          {showSearch && (
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search cards..."
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
          {!isMobile && (
            <div className="flex items-center rounded-full border border-slate-200 bg-white px-1 py-1 shadow-sm">
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
                  <rect
                    x="5"
                    y="6"
                    width="14"
                    height="12"
                    rx="1.6"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    fill="none"
                  />
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
                  <rect
                    x="4"
                    y="6"
                    width="16"
                    height="12"
                    rx="1.6"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    fill="none"
                  />
                  <path d="M14 6v12" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
            </div>
          )}
          <div className="relative w-auto" ref={filterRef}>
            <button
              type="button"
              onClick={() => setShowFilterMenu((prev) => !prev)}
              className="flex max-w-[8.5rem] items-center gap-2 truncate rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50 sm:max-w-none sm:px-4"
              aria-label="Filter by board"
              title="Filter by board"
            >
              <span className="truncate">{boardFilterLabel}</span>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              </svg>
            </button>
            {showFilterMenu && (
              <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setBoardFilter('');
                    setShowFilterMenu(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm ${
                    boardFilter === '' ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  All boards
                </button>
                {boards.map((board) => (
                  <button
                    key={board.id}
                    type="button"
                    onClick={() => {
                      setBoardFilter(String(board.id));
                      setShowFilterMenu(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm ${
                      String(board.id) === boardFilter
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {board.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {error && <div className="text-xs text-rose-600">{error}</div>}

      <div className="flex h-[calc(100vh-15rem)] flex-col">
        <section className={`${isMobile ? 'flex-1 overflow-y-auto' : 'h-full overflow-hidden'} pr-1`}>
          <div
            className={`grid gap-4 ${
              isMobile ? 'md:grid-cols-2 xl:grid-cols-3' : 'h-full grid-rows-3 md:grid-cols-2 xl:grid-cols-3'
            }`}
          >
          {pagedCards.map((card) => (
            <div key={card.id} className={isMobile ? '' : 'h-full min-h-0 overflow-hidden'}>
              <CardPreview
                card={card}
                previewLength={cardPreviewLength}
                fillHeight={!isMobile}
                onSelect={() => {
                  if (isMobile) {
                    router.push(`/cards/${card.id}`);
                    return;
                  }
                  setSelectedCard(card);
                }}
              />
            </div>
          ))}
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

      {selectedCard && (
        <CardOverlay
          card={selectedCard}
          mode={cardOpenMode}
          onClose={() => setSelectedCard(null)}
          onSave={handleSave}
          onDelete={handleDelete}
          onRemoveFromBoard={async (targetBoardId, targetCardId) => {
            await handleRemoveFromBoardById(targetBoardId, targetCardId);
          }}
          allCards={allCards}
          onNavigateCard={handleNavigateOverlayCard}
        />
      )}

      {showCreate && (
        <CardCreateOverlay
          mode={cardOpenMode}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
          allCards={allCards}
        />
      )}

      <button
        type="button"
        onClick={() => {
          if (isMobile) {
            router.push('/cards/new');
            return;
          }
          setShowCreate(true);
        }}
        className="fixed bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-2xl font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
        aria-label="Create card"
      >
        +
      </button>
    </div>
  );
}
