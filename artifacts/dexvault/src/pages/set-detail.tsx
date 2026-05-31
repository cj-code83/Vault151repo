import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { searchCards, getSets } from '@/services/pokemonTcg';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Plus, Minus, AlertTriangle, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CardItem } from '@/components/card-item';
import { LegendDialog } from '@/components/legend-dialog';
import { useCollectionStore } from '@/store/collectionStore';
import { useAuth } from '@/hooks/use-auth';
import { PokemonCard } from '@/types/pokemon';
import { useEffect, useState, useMemo } from 'react';
import { sortCards, SortOrder, SORT_OPTIONS } from '@/utils/sort';
import masterBall from '@/assets/master-ball.png';

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


// ─── Page ─────────────────────────────────────────────────────────────────

export default function SetDetail() {
  const { id: setId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { collectionCards, bulkAddCards, bulkRemoveCards } = useCollectionStore();
  const [allCards, setAllCards] = useState<PokemonCard[]>([]);
  const [numberFilter, setNumberFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('number');
  const [pendingAction, setPendingAction] = useState<'add' | 'remove' | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

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

  // ── Completion logic ───────────────────────────────────────────────────

  const printedTotal = set?.printedTotal ?? 0;

  /**
   * "Effectively owned" = at least one standard copy OR at least one variant copy.
   * Wishlisted-only cards (quantity=0, no variants) are NOT counted.
   */
  const ownedInSet = useMemo(() => {
    return allCards.filter((c) => {
      const cc = collectionCards[c.id];
      if (!cc) return false;
      return cc.quantity > 0 || Object.values(cc.variants ?? {}).some((v) => v > 0);
    });
  }, [allCards, collectionCards]);

  /**
   * Standard set completion: count unique card NUMBERS ≤ printedTotal.
   * Any variant of the same number counts — owning only Reverse Holo of #25
   * still counts #25 as collected. Secret rares (number > printedTotal) are excluded.
   */
  const ownedStdNumbers = useMemo(() => {
    const nums = new Set<string>();
    if (printedTotal === 0) return nums;
    for (const card of ownedInSet) {
      const n = parseInt(card.number, 10);
      if (!isNaN(n) && n <= printedTotal) nums.add(card.number);
    }
    return nums;
  }, [ownedInSet, printedTotal]);

  const standardOwned   = ownedStdNumbers.size;
  const standardTotal   = printedTotal;
  const standardPct     = standardTotal > 0
    ? Math.min(100, Math.round((standardOwned / standardTotal) * 100))
    : 0;
  const standardComplete = standardTotal > 0 && standardOwned >= standardTotal;

  /**
   * Master set completion: all unique card IDs owned (standard + secret rares).
   * Tracks every printed card in the set regardless of number.
   */
  const masterOwned    = ownedInSet.length;
  const masterTotal    = page1?.totalCount ?? allCards.length;
  const masterComplete = masterTotal > 0 && masterOwned >= masterTotal;
  /** Only show extra tracking when the set has cards beyond printedTotal. */
  const hasMasterCards = masterTotal > standardTotal && standardTotal > 0;

  /**
   * Extra cards: numbered above printedTotal (secret rares, illustration rares, etc.)
   * The bottom progress bar tracks how many of these the user owns.
   */
  const extraOwned = useMemo(() => {
    if (printedTotal === 0) return 0;
    return ownedInSet.filter((c) => {
      const n = parseInt(c.number, 10);
      return isNaN(n) || n > printedTotal;
    }).length;
  }, [ownedInSet, printedTotal]);

  const extraTotal = useMemo(() => {
    if (printedTotal === 0) return 0;
    const fromCards = allCards.filter((c) => {
      const n = parseInt(c.number, 10);
      return isNaN(n) || n > printedTotal;
    }).length;
    // Use API-derived count when pages are still loading
    return Math.max(fromCards, masterTotal - standardTotal);
  }, [allCards, printedTotal, masterTotal, standardTotal]);

  const extraPct     = extraTotal > 0 ? Math.min(100, Math.round((extraOwned / extraTotal) * 100)) : 0;
  const extraComplete = extraTotal > 0 && extraOwned >= extraTotal;

  // ── Bulk action helpers ────────────────────────────────────────────────

  /** Cards currently visible that have no collection record at all. */
  const toAdd = useMemo(
    () => displayedCards.filter((c) => !collectionCards[c.id]),
    [displayedCards, collectionCards]
  );

  /** Cards currently visible that are effectively owned. */
  const toRemove = useMemo(
    () => displayedCards.filter((c) => {
      const cc = collectionCards[c.id];
      if (!cc) return false;
      return cc.quantity > 0 || Object.values(cc.variants ?? {}).some((v) => v > 0);
    }),
    [displayedCards, collectionCards]
  );

  const handleAddAll = async () => {
    if (!user || bulkBusy || toAdd.length === 0) return;
    setBulkBusy(true);
    setPendingAction(null);
    try {
      await bulkAddCards(toAdd, user.id);
    } finally {
      setBulkBusy(false);
    }
  };

  const handleRemoveAll = async () => {
    if (!user || bulkBusy || toRemove.length === 0) return;
    setBulkBusy(true);
    setPendingAction(null);
    try {
      await bulkRemoveCards(toRemove.map((c) => c.id), user.id);
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="flex flex-col">
      {/* ── Sticky header ── */}
      <div className="sticky top-16 md:top-0 z-20 bg-background -mx-4 md:-mx-8 px-4 md:px-8 pt-3 pb-3 border-b border-border space-y-2">

        {/* Row 1: back + logo + name + completion stats */}
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

          {/* Completion stats — standard + extra */}
          {standardTotal > 0 && (
            <div className="shrink-0 text-right space-y-0.5">
              {/* Standard set */}
              <div className={`flex items-center gap-1.5 justify-end text-base font-bold leading-tight
                ${standardComplete ? 'text-green-500' : standardOwned > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                <span>{standardOwned}/{standardTotal}</span>
                {standardComplete
                  ? <span className="text-sm font-medium">✓</span>
                  : <span className="text-xs font-normal text-muted-foreground">{standardPct}%</span>}
              </div>
              {/* Extra cards row — only visible when set contains secret rares */}
              {hasMasterCards && (
                <div className="flex items-center gap-1 justify-end">
                  {masterComplete && (
                    <img src={masterBall} alt="Master Complete" className="w-4 h-4 object-contain" />
                  )}
                  <p className={`text-xs leading-tight ${
                    masterComplete
                      ? 'text-yellow-600 dark:text-yellow-400 font-bold'
                      : 'text-muted-foreground'
                  }`}>
                    {extraOwned}/{extraTotal} extra
                    {masterComplete && ' ★'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Row 2: progress bars */}
        {set && standardTotal > 0 && (
          <div className="space-y-1">
            {/* Standard progress — tracks cards #1 to printedTotal */}
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${standardComplete ? 'bg-green-500' : 'bg-primary'}`}
                style={{ width: `${standardPct}%` }}
              />
            </div>
            {/* Extra progress — tracks secret rares / cards above printedTotal */}
            {hasMasterCards && (
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    extraComplete ? 'bg-yellow-500' : 'bg-yellow-400/60'
                  }`}
                  style={{ width: extraTotal > 0 ? `${extraPct}%` : '0%' }}
                />
              </div>
            )}
          </div>
        )}

        {/* Row 3: number filter + sort + legend */}
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

            {/* Legend / info button */}
            <LegendDialog />
          </div>
        )}
      </div>

      {/* ── Card grid ── */}
      <div className="pt-4 pb-4">
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
              <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
                <span>{page1?.totalCount ?? allCards.length} cards in set</span>
                {hasMasterCards && (
                  <>
                    <span className="text-border">·</span>
                    <span>{standardTotal} standard</span>
                    <span className="text-border">·</span>
                    <span>{masterTotal - standardTotal} secret rares</span>
                  </>
                )}
                {needsPage2 && !page2 && (
                  <span className="text-primary animate-pulse">Loading more…</span>
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

      {/* ── Bottom bulk action bar ── */}
      {user && displayedCards.length > 0 && (
        <div className="sticky bottom-0 z-20 bg-background/95 backdrop-blur-sm border-t border-border py-2.5 px-4 -mx-4 md:-mx-8">
          {pendingAction === 'remove' ? (
            /* ── Confirm remove ── */
            <div className="flex items-center gap-2 flex-wrap">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <span className="text-sm flex-1 text-muted-foreground">
                Remove <strong className="text-foreground">{toRemove.length}</strong> owned card{toRemove.length !== 1 ? 's' : ''} from your collection?
              </span>
              <Button variant="ghost" size="sm" onClick={() => setPendingAction(null)} disabled={bulkBusy}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={handleRemoveAll} disabled={bulkBusy}>
                {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Yes, remove
              </Button>
            </div>
          ) : pendingAction === 'add' ? (
            /* ── Confirm add ── */
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm flex-1 text-muted-foreground">
                Add <strong className="text-foreground">{toAdd.length}</strong> card{toAdd.length !== 1 ? 's' : ''} to your collection?
              </span>
              <Button variant="ghost" size="sm" onClick={() => setPendingAction(null)} disabled={bulkBusy}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAddAll} disabled={bulkBusy}>
                {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Yes, add all
              </Button>
            </div>
          ) : (
            /* ── Normal state ── */
            <div className="flex items-center gap-2">
              {/* Remove all — only shown when there are owned cards to remove */}
              {toRemove.length > 0 ? (
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setPendingAction('remove')}
                  disabled={bulkBusy}
                >
                  <Minus className="w-3.5 h-3.5" />
                  Remove owned ({toRemove.length})
                </Button>
              ) : (
                <div className="w-px" />
              )}

              {/* Add all */}
              <Button
                size="sm"
                variant={toAdd.length === 0 ? 'ghost' : 'secondary'}
                className={`ml-auto gap-1.5 text-xs ${toAdd.length === 0 ? 'text-green-600 dark:text-green-400 pointer-events-none' : ''}`}
                onClick={() => toAdd.length > 0 && setPendingAction('add')}
                disabled={bulkBusy || toAdd.length === 0}
              >
                {toAdd.length === 0 ? (
                  '✓ All owned'
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    Add all ({toAdd.length})
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
