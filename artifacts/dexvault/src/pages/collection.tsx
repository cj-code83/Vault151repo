import { useState, useEffect, useMemo } from 'react';
import { useCollectionStore } from '@/store/collectionStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { getCardsByIds, getSets } from '@/services/pokemonTcg';
import { CardItem } from '@/components/card-item';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { useSearch } from 'wouter';
import { motion } from 'framer-motion';
import { PokemonSet } from '@/types/pokemon';

// ─── Helpers ──────────────────────────────────────────────────────────────

function variantTotal(variants?: Record<string, number>) {
  return Object.values(variants ?? {}).reduce((s, v) => s + v, 0);
}

// ─── Generic card grid (wishlist / favourites tabs) ───────────────────────

function CardGrid({ ids, activeTab }: { ids: string[]; activeTab: string }) {
  const sortedKey = [...ids].sort().join(',');
  const { data: cards, isLoading } = useQuery({
    queryKey: ['collection-cards', activeTab, sortedKey],
    queryFn: () => getCardsByIds(ids),
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  if (ids.length === 0) return null;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {ids.map((id) => <Skeleton key={id} className="aspect-[63/88] rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {(cards ?? []).map((card) => <CardItem key={card.id} card={card} />)}
    </div>
  );
}

// ─── Set row card (owned tab) ─────────────────────────────────────────────

function SetRow({
  set,
  owned,
  total,
  pct,
  onClick,
  index,
}: {
  set: PokemonSet;
  owned: number;
  total: number;
  pct: number;
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
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm leading-tight truncate group-hover:text-primary transition-colors">
            {set.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{set.releaseDate} · {total} cards</p>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{owned} / {total} owned</span>
              <span className={`font-semibold ${pct === 100 ? 'text-green-500' : pct > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                {pct}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : 'bg-primary'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
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

  // Group owned card IDs by set (match via set ID prefix in card ID)
  const ownedSetData = useMemo(() => {
    if (!sets || ownedIds.length === 0) return [];
    return sets
      .map((set) => {
        const setOwnedIds = ownedIds.filter((id) => id.startsWith(set.id + '-'));
        if (setOwnedIds.length === 0) return null;
        const total = set.printedTotal || set.total;
        const pct = total > 0 ? Math.min(100, Math.round((setOwnedIds.length / total) * 100)) : 0;
        return { set, ownedIds: setOwnedIds, owned: setOwnedIds.length, total, pct };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      // Newest sets first
      .sort((a, b) => b.set.releaseDate.localeCompare(a.set.releaseDate));
  }, [sets, ownedIds]);

  // ── Drill-down: cards within one set ──────────────────────────────────
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
              <img
                src={selected.set.images.symbol}
                alt={selected.set.name}
                className="h-6 object-contain"
              />
              <span className="font-semibold">{selected.set.name}</span>
              <span className="text-sm text-muted-foreground">
                {selected.owned} / {selected.total} · {selected.pct}%
              </span>
            </>
          )}
        </div>
        {selected && <CardGrid ids={selected.ownedIds} activeTab={`owned-set-${selectedSetId}`} />}
      </div>
    );
  }

  // ── Set list view ──────────────────────────────────────────────────────
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
          owned={entry.owned}
          total={entry.total}
          pct={entry.pct}
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

  const emptyMessage: Record<string, string> = {
    owned:      'Your collection is empty. Search for cards to add them.',
    wishlist:   'Your wishlist is empty.',
    favourites: 'No favourited cards yet. Star a card from its detail page.',
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
      <div className="sticky top-16 md:top-0 z-20 bg-background -mx-4 md:-mx-8 px-4 md:px-8 pt-4 md:pt-8 pb-4 border-b border-border space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">My Collection</h1>
          <p className="text-muted-foreground">Your personal vault.</p>
        </div>
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="owned">Owned ({ownedCards.length})</TabsTrigger>
          <TabsTrigger value="wishlist">Wishlist ({wishlistedCards.length})</TabsTrigger>
          <TabsTrigger value="favourites">Favourites ({favouritedCards.length})</TabsTrigger>
        </TabsList>
      </div>

      <div className="pt-6">
        {/* Owned — grouped by set */}
        <TabsContent value="owned" className="mt-0">
          {ownedIds.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
              {emptyMessage.owned}
            </div>
          ) : (
            <OwnedBySet ownedIds={ownedIds} />
          )}
        </TabsContent>

        {/* Wishlist & Favourites — flat grid as before */}
        {(['wishlist', 'favourites'] as const).map((tab) => {
          const ids = tab === 'wishlist' ? wishlistIds : favouriteIds;
          return (
            <TabsContent key={tab} value={tab} className="mt-0">
              {ids.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                  {emptyMessage[tab]}
                </div>
              ) : (
                <CardGrid ids={ids} activeTab={tab} />
              )}
            </TabsContent>
          );
        })}
      </div>
    </Tabs>
  );
}
