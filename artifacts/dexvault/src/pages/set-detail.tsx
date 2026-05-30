import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { searchCards, getSets } from '@/services/pokemonTcg';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Info, Plus, Minus, AlertTriangle, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CardItem } from '@/components/card-item';
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

// ─── Symbol legend dialog ─────────────────────────────────────────────────

const TYPE_ENTRIES = [
  { name: 'Fire',      color: '#FF6B35' },
  { name: 'Water',     color: '#5DADE2' },
  { name: 'Grass',     color: '#52BE80' },
  { name: 'Lightning', color: '#F4D03F' },
  { name: 'Psychic',   color: '#AF7AC5' },
  { name: 'Fighting',  color: '#CB4335' },
  { name: 'Darkness',  color: '#1C2833' },
  { name: 'Metal',     color: '#808B96' },
  { name: 'Dragon',    color: '#6E2DC3' },
  { name: 'Fairy',     color: '#F48FB1' },
  { name: 'Colorless', color: '#BDC3C7' },
];

const VARIANT_LETTERS = [
  { letter: 'H', label: 'Holofoil',       desc: 'Holographic foil print' },
  { letter: 'R', label: 'Reverse Holo',   desc: 'Reverse holographic foil' },
  { letter: 'U', label: 'Unlimited',      desc: 'Standard unlimited reprint' },
  { letter: '1', label: '1st Edition',    desc: 'First edition holofoil' },
  { letter: 'S', label: 'Shadowless',     desc: 'Shadowless Base Set variant' },
];

function LegendDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Symbol legend"
        >
          <Info className="w-4 h-4" />
          <span className="text-xs hidden sm:inline">Legend</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Card Grid Symbols</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">

          {/* Type dots */}
          <div>
            <p className="font-semibold mb-1.5">Energy type dots</p>
            <p className="text-xs text-muted-foreground mb-2">
              Coloured circles below each card indicate its Pokémon energy type.
            </p>
            <div className="grid grid-cols-2 gap-1">
              {TYPE_ENTRIES.map(({ name, color }) => (
                <div key={name} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-xs text-muted-foreground">{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quantity badge */}
          <div>
            <p className="font-semibold mb-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[9px] font-bold mr-2">3</span>
              Blue badge (top-right)
            </p>
            <p className="text-xs text-muted-foreground">
              Total copies of this card in your collection, including all variants.
            </p>
          </div>

          {/* Variant letters */}
          <div>
            <p className="font-semibold mb-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-500 text-white text-[9px] font-bold mr-2">H</span>
              Gold badges (top-left)
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              Shown when you own a special variant <em>beyond</em> the card's standard print.
            </p>
            <div className="space-y-1">
              {VARIANT_LETTERS.map(({ letter, label, desc }) => (
                <div key={letter} className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-500 text-white text-[9px] font-bold shrink-0 mt-0.5">
                    {letter}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    <span className="text-foreground font-medium">{label}</span> — {desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Standard print note */}
          <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Standard print</span> — the base printing
            tracked by the ± buttons. Priority: Unlimited → Holofoil → Reverse Holo.
            Variants above this are shown as gold badges.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
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
  /** Only show master tracking when the set has cards beyond printedTotal. */
  const hasMasterCards = masterTotal > standardTotal && standardTotal > 0;

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

          {/* Completion stats — standard + master */}
          {standardTotal > 0 && (
            <div className="shrink-0 text-right space-y-0.5">
              {/* Standard set */}
              <div className={`flex items-center gap-1.5 justify-end text-sm font-bold leading-tight
                ${standardComplete ? 'text-green-500' : standardOwned > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                <span>{standardOwned}/{standardTotal}</span>
                {standardComplete
                  ? <span className="text-xs font-medium">✓</span>
                  : <span className="text-[11px] font-normal text-muted-foreground">{standardPct}%</span>}
              </div>
              {/* Master set — only visible when set contains secret rares */}
              {hasMasterCards && (
                <div className="flex items-center gap-1 justify-end">
                  {masterComplete && (
                    <img src={masterBall} alt="Master Complete" className="w-4 h-4 object-contain" />
                  )}
                  <p className={`text-[10px] leading-tight ${
                    masterComplete
                      ? 'text-yellow-600 dark:text-yellow-400 font-bold'
                      : 'text-muted-foreground'
                  }`}>
                    {masterOwned}/{masterTotal} master
                    {masterComplete && ' ★'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Row 2: progress bar */}
        {set && standardTotal > 0 && (
          <div className="space-y-0.5">
            {/* Standard progress */}
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${standardComplete ? 'bg-green-500' : 'bg-primary'}`}
                style={{ width: `${standardPct}%` }}
              />
            </div>
            {/* Master progress — thinner, below */}
            {hasMasterCards && (
              <div className="h-0.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    masterComplete ? 'bg-yellow-500' : 'bg-yellow-400/60'
                  }`}
                  style={{ width: masterTotal > 0 ? `${Math.round((masterOwned / masterTotal) * 100)}%` : '0%' }}
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
