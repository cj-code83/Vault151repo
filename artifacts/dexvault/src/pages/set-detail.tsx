import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { searchCards, getSets } from '@/services/pokemonTcg';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { CardItem } from '@/components/card-item';
import { useCollectionStore } from '@/store/collectionStore';
import { PokemonCard } from '@/types/pokemon';
import { useEffect, useState } from 'react';

const PAGE_SIZE = 250;

export default function SetDetail() {
  const { id: setId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { collectionCards } = useCollectionStore();
  const [allCards, setAllCards] = useState<PokemonCard[]>([]);

  const { data: setsData } = useQuery({
    queryKey: ['sets'],
    queryFn: getSets,
    staleTime: 3600000,
  });

  const set = setsData?.find((s) => s.id === setId);

  const { data: page1, isLoading, isError } = useQuery({
    queryKey: ['set-cards-all', setId],
    queryFn: () => searchCards({ q: `set.id:${setId}`, page: 1, pageSize: PAGE_SIZE }),
    staleTime: 1000 * 60 * 30,
    enabled: !!setId,
  });

  const needsPage2 = page1 ? page1.totalCount > PAGE_SIZE : false;

  const { data: page2 } = useQuery({
    queryKey: ['set-cards-all', setId, 2],
    queryFn: () => searchCards({ q: `set.id:${setId}`, page: 2, pageSize: PAGE_SIZE }),
    staleTime: 1000 * 60 * 30,
    enabled: needsPage2,
  });

  useEffect(() => {
    const cards: PokemonCard[] = [];
    if (page1?.data) cards.push(...page1.data);
    if (page2?.data) cards.push(...page2.data);
    setAllCards(cards);
  }, [page1, page2]);

  const setCardIds = new Set(allCards.map((c) => c.id));
  const owned = Object.values(collectionCards).filter(
    (c) => c.quantity > 0 && setCardIds.has(c.cardId)
  ).length;
  const total = set?.printedTotal || set?.total || allCards.length || 0;
  const pct = total > 0 ? Math.min(100, Math.round((owned / total) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation('/sets')}
          data-testid="button-back-to-sets"
          className="shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {set?.images.logo && (
            <img
              src={set.images.logo}
              alt={set.name}
              className="h-10 object-contain shrink-0 max-w-[120px]"
              onError={(e) => {
                if (set.images.symbol) (e.target as HTMLImageElement).src = set.images.symbol;
              }}
            />
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight truncate">{set?.name ?? setId}</h1>
            {set && (
              <p className="text-sm text-muted-foreground">{set.series} · {set.releaseDate}</p>
            )}
          </div>
        </div>
      </div>

      {set && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{owned} of {total} cards owned</span>
            <span className={`font-semibold ${pct === 100 ? 'text-green-500' : pct > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
              {pct}% complete
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${pct === 100 ? 'bg-green-500' : 'bg-primary'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

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
          <div className="text-xs text-muted-foreground">
            {page1?.totalCount ?? allCards.length} cards in set
            {needsPage2 && !page2 && <span className="ml-2 text-primary animate-pulse">Loading more…</span>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {allCards.map((card, i) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.12, delay: Math.min(i * 0.005, 0.15) }}
              >
                <CardItem card={card} />
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
