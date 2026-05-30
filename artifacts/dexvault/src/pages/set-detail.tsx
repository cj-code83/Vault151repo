import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { searchCards, getSets } from '@/services/pokemonTcg';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Plus, Loader2, CheckCheck } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CardItem } from '@/components/card-item';
import { useCollectionStore } from '@/store/collectionStore';
import { useAuth } from '@/hooks/use-auth';
import { PokemonCard } from '@/types/pokemon';
import { useEffect, useState, useMemo } from 'react';
import { sortCards, SortOrder, SORT_OPTIONS } from '@/utils/sort';

const PAGE_SIZE = 250;
const NONE = '__none__';

/** Sort card numbers: pure integers first (numeric), then alphanumeric. */
function sortCardNumbers(nums: string[]): string[] {
  return [...nums].sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    if (!isNaN(na)) return -1;
    if (!isNaN(nb)) return 1;
    return a.localeCompare(b);
  });
}

export default function SetDetail() {
  const { id: setId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { collectionCards, bulkAddCards } = useCollectionStore();
  const [allCards, setAllCards] = useState<PokemonCard[]>([]);
  const [numberFilter, setNumberFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('number');
  const [adding, setAdding] = useState(false);

  const { data: setsData } = useQuery({
    queryKey: ['sets'],
    queryFn: getSets,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const set = setsData?.find((s) => s.id === setId);

  const { data: page1, isLoading, isError } = useQuery({
    queryKey: ['set-cards-all', setId],
    queryFn: () => searchCards({ q: `set.id:${setId}`, page: 1, pageSize: PAGE_SIZE }),
    staleTime: 2 * 60 * 60 * 1000,
    enabled: !!setId,
  });

  const needsPage2 = page1 ? page1.totalCount > PAGE_SIZE : false;

  const { data: page2 } = useQuery({
    queryKey: ['set-cards-all', setId, 2],
    queryFn: () => searchCards({ q: `set.id:${setId}`, page: 2, pageSize: PAGE_SIZE }),
    staleTime: 2 * 60 * 60 * 1000,
    enabled: needsPage2,
  });

  useEffect(() => {
    const cards: PokemonCard[] = [];
    if (page1?.data) cards.push(...page1.data);
    if (page2?.data) cards.push(...page2.data);
    setAllCards(cards);
    setNumberFilter('');
    setSortOrder('number');
  }, [page1, page2]);

  const availableNumbers = useMemo(
    () => sortCardNumbers([...new Set(allCards.map((c) => c.number))]),
    [allCards]
  );

  const displayedCards = useMemo(() => {
    const filtered = numberFilter
      ? allCards.filter((c) => c.number === numberFilter)
      : allCards;
    return sortCards(filtered, sortOrder);
  }, [allCards, numberFilter, sortOrder]);

  const setCardIds = new Set(allCards.map((c) => c.id));
  const owned = Object.values(collectionCards).filter(
    (c) => c.quantity > 0 && setCardIds.has(c.cardId)
  ).length;
  const total = set?.printedTotal || set?.total || allCards.length || 0;
  const pct   = total > 0 ? Math.min(100, Math.round((owned / total) * 100)) : 0;

  // Cards currently visible that aren't yet in the collection
  const notYetOwned = useMemo(
    () => displayedCards.filter((c) => !collectionCards[c.id]),
    [displayedCards, collectionCards]
  );
  const allAlreadyOwned = displayedCards.length > 0 && notYetOwned.length === 0;

  const handleAddAll = async () => {
    if (!user || adding || notYetOwned.length === 0) return;
    setAdding(true);
    try {
      await bulkAddCards(notYetOwned, user.id);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col">
      {/* ── Sticky header ── */}
      <div className="sticky top-16 md:top-0 z-20 bg-background -mx-4 md:-mx-8 px-4 md:px-8 pt-3 pb-3 border-b border-border space-y-2">

        {/* Row 1: back + logo + name + completion */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/sets')}
            className="shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          {set?.images.logo ? (
            <img
              src={set.images.logo}
              alt={set.name}
              className="h-9 object-contain shrink-0 max-w-[110px]"
              onError={(e) => {
                if (set.images.symbol) (e.target as HTMLImageElement).src = set.images.symbol;
              }}
            />
          ) : set?.images.symbol ? (
            <img src={set.images.symbol} alt={set?.name} className="h-9 w-9 object-contain shrink-0" />
          ) : null}

          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight truncate">{set?.name ?? setId}</h1>
            {set && (
              <p className="text-xs text-muted-foreground">{set.series} · {set.releaseDate}</p>
            )}
          </div>

          {total > 0 && (
            <div className="shrink-0 text-right">
              <p className={`text-sm font-bold ${pct === 100 ? 'text-green-500' : pct > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                {pct}%
              </p>
              <p className="text-[10px] text-muted-foreground">{owned}/{total}</p>
            </div>
          )}
        </div>

        {/* Row 2: progress bar */}
        {set && (
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${pct === 100 ? 'bg-green-500' : 'bg-primary'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        {/* Row 3: number filter + sort + quick-add-all */}
        {allCards.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Number filter */}
            <Select
              value={numberFilter || NONE}
              onValueChange={(v) => setNumberFilter(v === NONE ? '' : v)}
            >
              <SelectTrigger className="h-8 text-sm w-44">
                <SelectValue placeholder="All card numbers" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value={NONE}>All card numbers</SelectItem>
                {availableNumbers.map((n) => (
                  <SelectItem key={n} value={n} className="font-mono text-sm">#{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select
              value={sortOrder}
              onValueChange={(v) => setSortOrder(v as SortOrder)}
            >
              <SelectTrigger className="h-8 text-sm w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {numberFilter && (
              <>
                <button
                  onClick={() => setNumberFilter('')}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Clear
                </button>
                <span className="text-xs text-muted-foreground">
                  {displayedCards.length} card{displayedCards.length !== 1 ? 's' : ''}
                </span>
              </>
            )}

            {/* Quick-add-all — only shown when logged in and cards are loaded */}
            {user && displayedCards.length > 0 && (
              <Button
                size="sm"
                variant={allAlreadyOwned ? 'ghost' : 'secondary'}
                className={`ml-auto h-8 text-xs gap-1.5 shrink-0 ${allAlreadyOwned ? 'text-green-600 dark:text-green-400 pointer-events-none' : ''}`}
                onClick={handleAddAll}
                disabled={adding || allAlreadyOwned}
              >
                {adding ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Adding…
                  </>
                ) : allAlreadyOwned ? (
                  <>
                    <CheckCheck className="w-3.5 h-3.5" />
                    All owned
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    Add all{notYetOwned.length < displayedCards.length
                      ? ` (${notYetOwned.length})`
                      : ` (${displayedCards.length})`}
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Card grid ── */}
      <div className="pt-4 pb-6">
        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({ length: 24 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[2.5/3.5] rounded-xl" />
            ))}
          </div>
        )}

        {isError && (
          <div className="text-destructive text-sm">Failed to load cards for this set.</div>
        )}

        {!isLoading && allCards.length > 0 && (
          <>
            {!numberFilter && (
              <div className="text-xs text-muted-foreground mb-3">
                {page1?.totalCount ?? allCards.length} cards in set
                {needsPage2 && !page2 && (
                  <span className="ml-2 text-primary animate-pulse">Loading more…</span>
                )}
              </div>
            )}
            {displayedCards.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No cards with number #{numberFilter} in this set.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {displayedCards.map((card) => (
                  <CardItem key={card.id} card={card} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
