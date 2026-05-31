import { useState, useEffect, useMemo } from 'react';
import { useCollectionStore } from '@/store/collectionStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useQueries } from '@tanstack/react-query';
import { getCard, getCardsByIds, getSets } from '@/services/pokemonTcg';
import { CardItem } from '@/components/card-item';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft } from 'lucide-react';
import { useSearch } from 'wouter';
import { motion } from 'framer-motion';
import { CollectionCard, PokemonSet } from '@/types/pokemon';
import { sortCards, SortOrder, SORT_OPTIONS } from '@/utils/sort';
import pokeball   from '@/assets/pokeball.png';
import masterBall from '@/assets/master-ball.png';

const NONE = '__none__';

// ─── Helpers ──────────────────────────────────────────────────────────────

function variantTotal(variants?: Record<string, number>) {
  return Object.values(variants ?? {}).reduce((s, v) => s + v, 0);
}

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

/**
 * Compute the estimated market value of a list of cards.
 *
 * mode "wishlist"  → 1 copy at best market price (cost to acquire).
 * mode "owned" / "favourites" → actual owned quantities × per-variant price.
 */
function useCardsValue(
  cardIds: string[],
  collectionCards: Record<string, CollectionCard>,
  mode: 'owned' | 'wishlist' | 'favourites',
) {
  const queries = useQueries({
    queries: cardIds.map((id) => ({
      queryKey: ['card-price', id],
      queryFn: () => getCard(id),
      staleTime: 24 * 60 * 60 * 1000,
    })),
  });

  const isLoading = cardIds.length > 0 && queries.some((q) => q.isPending);
  let value = 0;

  for (const q of queries) {
    if (!q.data) continue;
    const card = q.data;
    const owned = collectionCards[card.id];
    const prices = card.tcgplayer?.prices;
    if (!prices) continue;

    const bestPrice = Object.values(prices).reduce((best, v) => {
      const p = v.market ?? v.mid ?? 0;
      return p > best ? p : best;
    }, 0);

    if (mode === 'wishlist') {
      value += bestPrice;
    } else {
      const qty = owned?.quantity ?? 0;
      if (qty > 0) value += bestPrice * qty;
      for (const [key, vQty] of Object.entries(owned?.variants ?? {})) {
        if (vQty <= 0) continue;
        const vp = prices[key]?.market ?? prices[key]?.mid ?? bestPrice;
        value += vp * vQty;
      }
      // Favourited card with no copies → show what 1 copy is worth
      if (mode === 'favourites' && qty === 0 && variantTotal(owned?.variants) === 0) {
        value += bestPrice;
      }
    }
  }

  return { value, isLoading };
}

// ─── Generic card grid (wishlist / favourites tabs) ───────────────────────

function CardGrid({ ids, activeTab }: { ids: string[]; activeTab: string }) {
  const [numberFilter, setNumberFilter] = useState('');
  const [sortOrder, setSortOrder]       = useState<SortOrder>('number');

  const sortedKey = [...ids].sort().join(',');
  const { data: cards, isLoading } = useQuery({
    queryKey: ['collection-cards', activeTab, sortedKey],
    queryFn: () => getCardsByIds(ids),
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    setNumberFilter('');
    setSortOrder('number');
  }, [sortedKey]);

  const availableNumbers = useMemo(() => {
    if (!cards?.length) return [];
    return sortCardNumbers([...new Set(cards.map((c) => c.number))]);
  }, [cards]);

  const displayedCards = useMemo(() => {
    const filtered = numberFilter
      ? (cards ?? []).filter((c) => c.number === numberFilter)
      : (cards ?? []);
    return sortCards(filtered, sortOrder);
  }, [cards, numberFilter, sortOrder]);

  if (ids.length === 0) return null;

  return (
    <div className="space-y-3">
      {(availableNumbers.length > 0 || !isLoading) && cards && cards.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
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
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {ids.map((id) => <Skeleton key={id} className="aspect-[63/88] rounded-lg" />)}
        </div>
      ) : displayedCards.length === 0 && numberFilter ? (
        <div className="text-center py-12 text-muted-foreground">
          No cards with number #{numberFilter}.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {displayedCards.map((card) => <CardItem key={card.id} card={card} />)}
        </div>
      )}
    </div>
  );
}

// ─── Set row card (owned tab) ─────────────────────────────────────────────

function SetRow({
  set,
  standardOwned, standardTotal, standardPct, standardComplete,
  masterComplete,
  onClick, index,
}: {
  set: PokemonSet;
  standardOwned: number;
  standardTotal: number;
  standardPct: number;
  standardComplete: boolean;
  masterComplete: boolean;
  onClick: () => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: index * 0.03 }}
      className="group cursor-pointer rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 overflow-hidden"
      onClick={onClick}
    >
      <div className="flex items-center gap-3 p-4">
        {/* Set logo */}
        <div className="w-20 h-12 shrink-0 flex items-center justify-center">
          {set.images.logo ? (
            <img
              src={set.images.logo}
              alt={set.name}
              className="max-w-full max-h-full object-contain"
              onError={(e) => { (e.target as HTMLImageElement).src = set.images.symbol; }}
            />
          ) : (
            <img src={set.images.symbol} alt={set.name} className="max-w-full max-h-full object-contain" />
          )}
        </div>

        {/* Set info + progress */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm leading-tight truncate group-hover:text-primary transition-colors">
            {set.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {set.releaseDate} · {standardTotal || set.total} cards
          </p>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{standardOwned} / {standardTotal || set.total} owned</span>
              <span className={`font-semibold ${
                standardComplete ? 'text-green-500' : standardPct > 0 ? 'text-primary' : 'text-muted-foreground'
              }`}>
                {standardPct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  standardComplete ? 'bg-green-500' : 'bg-primary'
                }`}
                style={{ width: `${standardPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Completion ball or set symbol */}
        <div
          className="shrink-0 flex flex-col items-center gap-0.5 pl-1"
          title={
            masterComplete  ? 'Master Set Complete!' :
            standardComplete ? 'Standard Set Complete!' :
            'Set symbol'
          }
        >
          {masterComplete ? (
            <img src={masterBall} alt="Master Complete" className="w-9 h-9 object-contain" />
          ) : standardComplete ? (
            <img src={pokeball} alt="Standard Complete" className="w-9 h-9 object-contain" />
          ) : (
            <>
              <div className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center">
                <img src={set.images.symbol} alt={`${set.name} symbol`} className="w-6 h-6 object-contain" />
              </div>
              <span className="text-[9px] text-muted-foreground leading-none">symbol</span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Owned tab — set-grouped view ─────────────────────────────────────────

function OwnedBySet({ ownedIds }: { ownedIds: string[] }) {
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);

  const { data: sets, isLoading: setsLoading } = useQuery({
    queryKey: ['sets'],
    queryFn: getSets,
    staleTime: 3_600_000,
  });

  const ownedSetData = useMemo(() => {
    if (!sets || ownedIds.length === 0) return [];
    return sets
      .map((set) => {
        const prefix = set.id + '-';
        const setOwnedIds = ownedIds.filter((id) => id.startsWith(prefix));
        if (setOwnedIds.length === 0) return null;

        // Standard: unique card NUMBERS ≤ printedTotal
        const printedTotal = set.printedTotal ?? 0;
        const ownedStdNums = new Set<string>();
        for (const cardId of setOwnedIds) {
          const suffix = cardId.slice(prefix.length);
          const n = parseInt(suffix, 10);
          if (printedTotal > 0 && !isNaN(n) && n <= printedTotal) {
            ownedStdNums.add(suffix);
          }
        }
        const standardOwned   = ownedStdNums.size;
        const standardTotal   = printedTotal;
        const standardPct     = standardTotal > 0
          ? Math.min(100, Math.round((standardOwned / standardTotal) * 100))
          : 0;
        const standardComplete = standardTotal > 0 && standardOwned >= standardTotal;

        // Master: every unique card ID in the set owned
        const masterOwned   = setOwnedIds.length;
        const masterTotal   = set.total ?? 0;
        const masterComplete = masterTotal > 0 && masterOwned >= masterTotal;

        return {
          set,
          ownedIds: setOwnedIds,
          standardOwned,
          standardTotal,
          standardPct,
          standardComplete,
          masterOwned,
          masterTotal,
          masterComplete,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      // Sort by completion descending, then by release date descending as tiebreaker
      .sort((a, b) =>
        b.standardPct - a.standardPct ||
        b.set.releaseDate.localeCompare(a.set.releaseDate)
      );
  }, [sets, ownedIds]);

  if (selectedSetId) {
    const selected = ownedSetData.find((s) => s.set.id === selectedSetId);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 -ml-2"
            onClick={() => setSelectedSetId(null)}
          >
            <ChevronLeft className="h-4 w-4" />
            All sets
          </Button>
          {selected && (
            <>
              <img src={selected.set.images.symbol} alt={selected.set.name} className="h-6 object-contain" />
              <span className="font-semibold">{selected.set.name}</span>
              <span className="text-sm text-muted-foreground">
                {selected.standardOwned} / {selected.standardTotal} · {selected.standardPct}%
              </span>
              {selected.masterComplete && (
                <img src={masterBall} alt="Master Complete" className="h-5 w-5 object-contain" />
              )}
              {!selected.masterComplete && selected.standardComplete && (
                <img src={pokeball} alt="Standard Complete" className="h-5 w-5 object-contain" />
              )}
            </>
          )}
        </div>
        {selected && <CardGrid ids={selected.ownedIds} activeTab={`owned-set-${selectedSetId}`} />}
      </div>
    );
  }

  if (setsLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  if (ownedSetData.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {ownedSetData.map((entry, i) => (
        <SetRow
          key={entry.set.id}
          set={entry.set}
          standardOwned={entry.standardOwned}
          standardTotal={entry.standardTotal}
          standardPct={entry.standardPct}
          standardComplete={entry.standardComplete}
          masterComplete={entry.masterComplete}
          index={i}
          onClick={() => setSelectedSetId(entry.set.id)}
        />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function Collection() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const tabParam = params.get('tab');

  const validTabs = ['owned', 'wishlist', 'favourites'];
  const initialTab = validTabs.includes(tabParam ?? '') ? tabParam! : 'owned';

  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (validTabs.includes(tabParam ?? '')) setActiveTab(tabParam!);
  }, [tabParam]);

  const { collectionCards } = useCollectionStore();

  const ownedCards      = Object.values(collectionCards).filter(
    (c) => (c.quantity > 0 || variantTotal(c.variants) > 0) && !c.isWishlisted
  );
  const wishlistedCards = Object.values(collectionCards).filter(
    (c) => c.isWishlisted && c.quantity === 0 && variantTotal(c.variants) === 0
  );
  const favouritedCards = Object.values(collectionCards).filter((c) => c.isFavorite);

  const ownedIds     = ownedCards.map((c) => c.cardId);
  const wishlistIds  = wishlistedCards.map((c) => c.cardId);
  const favouriteIds = favouritedCards.map((c) => c.cardId);

  // Estimated value for the currently active tab
  const activeIds  = activeTab === 'owned' ? ownedIds : activeTab === 'wishlist' ? wishlistIds : favouriteIds;
  const activeMode = (activeTab === 'wishlist' ? 'wishlist' : activeTab === 'favourites' ? 'favourites' : 'owned') as 'owned' | 'wishlist' | 'favourites';
  const { value: tabValue, isLoading: valueLoading } = useCardsValue(activeIds, collectionCards, activeMode);

  const emptyMessage: Record<string, string> = {
    owned:      'Your collection is empty. Search for cards to add them.',
    wishlist:   'Your wishlist is empty.',
    favourites: 'No favourited cards yet. Star a card from its detail page.',
  };

  const valueLabel: Record<string, string> = {
    owned:      'est. market value',
    wishlist:   'est. cost to acquire',
    favourites: 'est. market value',
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
      <div className="sticky top-16 md:top-0 z-20 bg-background -mx-4 md:-mx-8 px-4 md:px-8 pt-4 md:pt-8 pb-4 border-b border-border space-y-4">
        {/* Title row with estimated value */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">My Collection</h1>
            <p className="text-muted-foreground">Your personal vault.</p>
          </div>
          {/* Estimated value — top right */}
          <div className="text-right shrink-0">
            {valueLoading && activeIds.length > 0 ? (
              <div className="text-sm text-muted-foreground animate-pulse">Computing…</div>
            ) : tabValue > 0 ? (
              <>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  ${tabValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-muted-foreground">{valueLabel[activeTab]}</div>
              </>
            ) : null}
          </div>
        </div>

        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="owned">Owned ({ownedCards.length})</TabsTrigger>
          <TabsTrigger value="wishlist">Wishlist ({wishlistedCards.length})</TabsTrigger>
          <TabsTrigger value="favourites">Favourites ({favouritedCards.length})</TabsTrigger>
        </TabsList>
      </div>

      <div className="pt-6">
        <TabsContent value="owned" className="mt-0">
          {ownedIds.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
              {emptyMessage.owned}
            </div>
          ) : (
            <OwnedBySet ownedIds={ownedIds} />
          )}
        </TabsContent>

        {(['wishlist', 'favourites'] as const).map((tab) => {
          const ids = tab === 'wishlist' ? wishlistIds : favouriteIds;
          return (
            <TabsContent key={tab} value={tab} className="mt-0">
              {ids.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                  {emptyMessage[tab]}
                </div>
              ) : (
                <CardGrid key={tab} ids={ids} activeTab={tab} />
              )}
            </TabsContent>
          );
        })}
      </div>
    </Tabs>
  );
}
