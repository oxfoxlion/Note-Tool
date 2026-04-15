'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import CardOverlay from '../../../components/CardOverlay';
import CardCreateOverlay from '../../../components/CardCreateOverlay';
import CardPreview from '../../../components/CardPreview';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../../components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Badge } from '../../../components/ui/badge';
import {
  Card,
  Board,
  BoardCardLink,
  createCard,
  deleteCard,
  getBoard,
  getBoardCardLinks,
  getCardBoards,
  getBoards,
  getCards,
  getUserSettings,
  updateCard,
  updateUserSettings,
  removeCardFromBoard,
} from '../../../lib/noteToolApi';
import { useCurrentSpace } from '../../../hooks/useCurrentSpace';

export default function CardsPage() {
  const router = useRouter();
  const { currentSpaceId } = useCurrentSpace();
  const [isMobile, setIsMobile] = useState(false);
  const [isXl, setIsXl] = useState(true);
  const [cards, setCards] = useState<Card[]>([]);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [query, setQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedBoardLinkedCardIds, setSelectedBoardLinkedCardIds] = useState<number[]>([]);
  const [cardOpenMode, setCardOpenMode] = useState<'modal' | 'sidepanel'>('modal');
  const [boardFilter, setBoardFilter] = useState<string>('');
  const [error, setError] = useState('');
  const [cardPreviewLength, setCardPreviewLength] = useState(120);
  const [pageState, setPageState] = useState<{ value: number; key: string }>({ value: 1, key: '' });

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
    const load = async () => {
      try {
        const [cardsData, boardsData, settingsData] = await Promise.all([
          getCards(currentSpaceId),
          getBoards(null, currentSpaceId),
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
  }, [router, currentSpaceId]);

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

  const pageSize = isMobile ? 12 : isXl ? 9 : 6;
  const pageResetKey = `${query}::${boardFilter}::${cards.length}::${isMobile ? 'm' : 'd'}::${isXl ? 'x' : 'n'}`;

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / pageSize));
  const requestedPage = pageState.key === pageResetKey ? pageState.value : 1;
  const currentPage = Math.min(requestedPage, totalPages);
  const pagedCards = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCards.slice(start, start + pageSize);
  }, [filteredCards, currentPage, pageSize]);

  const handleCreate = async (payload: { title: string; content: string }) => {
    setError('');
    const created = await createCard({ title: payload.title, content: payload.content, space_id: currentSpaceId });
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

  useEffect(() => {
    if (!selectedCard) return;
    let active = true;
    const loadBoardLinks = async () => {
      try {
        const memberships = await getCardBoards(selectedCard.id);
        const linkGroups = await Promise.all(
          memberships.map(async (board) => {
            const links = await getBoardCardLinks(board.id);
            return links;
          })
        );
        if (!active) return;
        const merged = linkGroups.flat();
        const linked = new Set<number>();
        merged.forEach((link: BoardCardLink) => {
          if (link.source_card_id === selectedCard.id) {
            linked.add(link.target_card_id);
          } else if (link.target_card_id === selectedCard.id) {
            linked.add(link.source_card_id);
          }
        });
        setSelectedBoardLinkedCardIds(Array.from(linked));
      } catch (err: unknown) {
        if ((err as { message?: string })?.message === 'UNAUTHORIZED') {
          router.push('/auth/login');
          return;
        }
        if (!active) return;
        setSelectedBoardLinkedCardIds([]);
      }
    };
    void loadBoardLinks();
    return () => {
      active = false;
    };
  }, [selectedCard, router]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Card Box</div>
          <div className="mt-2 min-h-[20px] text-sm font-semibold text-slate-700">{boardFilter ? boardTitle : ''}</div>
        </div>
        <div className="flex w-full flex-nowrap items-center justify-end gap-1 sm:w-auto">
          {showSearch && (
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search cards..."
              className="h-9 w-[34vw] min-w-0 max-w-[10rem] rounded-full sm:w-56"
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
            className="h-9 w-9 rounded-full"
            aria-label="Search"
            title="Search"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" fill="none" />
              <path d="M16.2 16.2l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </Button>
          {!isMobile && (
            <Tabs value={cardOpenMode} onValueChange={(value) => void handleOpenModeChange(value as 'modal' | 'sidepanel')}>
              <TabsList className="rounded-full">
                <TabsTrigger value="modal" className="rounded-full px-3" aria-label="Open in modal" title="Open in modal">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <rect x="5" y="6" width="14" height="12" rx="1.6" stroke="currentColor" strokeWidth="1.6" fill="none" />
                  </svg>
                </TabsTrigger>
                <TabsTrigger value="sidepanel" className="rounded-full px-3" aria-label="Open in side panel" title="Open in side panel">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <rect x="4" y="6" width="16" height="12" rx="1.6" stroke="currentColor" strokeWidth="1.6" fill="none" />
                    <path d="M14 6v12" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="max-w-[8.5rem] rounded-full sm:max-w-none">
                <span className="truncate">{boardFilterLabel}</span>
                <svg viewBox="0 0 24 24" className="ml-2 h-3.5 w-3.5" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setBoardFilter('')} className={boardFilter === '' ? 'bg-accent' : undefined}>
                All boards
              </DropdownMenuItem>
              {boards.map((board) => (
                <DropdownMenuItem
                  key={board.id}
                  onClick={() => setBoardFilter(String(board.id))}
                  className={String(board.id) === boardFilter ? 'bg-accent' : undefined}
                >
                  {board.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex items-center justify-between">
        {error ? <div className="text-xs text-rose-600">{error}</div> : <div />}
        <Badge variant="outline" className="text-[11px] text-slate-500">
          {filteredCards.length} cards
        </Badge>
      </div>

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

      <div className="fixed bottom-1 left-1/2 z-40 -translate-x-1/2 rounded-full border border-slate-200 bg-white/95 px-2 py-1 shadow-sm backdrop-blur md:bottom-3">
        <div className="flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setPageState((prev) => ({
                value: Math.max(1, (prev.key === pageResetKey ? prev.value : 1) - 1),
                key: pageResetKey,
              }))
            }
            disabled={currentPage <= 1}
            className="rounded-full"
          >
            Prev
          </Button>
          <div className="text-xs text-slate-500">
            {currentPage} / {totalPages}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setPageState((prev) => ({
                value: Math.min(totalPages, (prev.key === pageResetKey ? prev.value : 1) + 1),
                key: pageResetKey,
              }))
            }
            disabled={currentPage >= totalPages}
            className="rounded-full"
          >
            Next
          </Button>
        </div>
      </div>

      {selectedCard && (
        <CardOverlay
          card={selectedCard}
          mode={cardOpenMode}
          onClose={() => {
            setSelectedCard(null);
            setSelectedBoardLinkedCardIds([]);
          }}
          onSave={handleSave}
          onDelete={handleDelete}
          onRemoveFromBoard={async (targetBoardId, targetCardId) => {
            await handleRemoveFromBoardById(targetBoardId, targetCardId);
          }}
          allCards={allCards}
          onNavigateCard={handleNavigateOverlayCard}
          boardLinkedCardIds={selectedBoardLinkedCardIds}
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

      <Button
        type="button"
        onClick={() => {
          if (isMobile) {
            router.push('/cards/new');
            return;
          }
          setShowCreate(true);
        }}
        size="icon"
        className="fixed bottom-6 right-6 h-12 w-12 rounded-full text-2xl font-semibold shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
        aria-label="Create card"
      >
        +
      </Button>
    </div>
  );
}
