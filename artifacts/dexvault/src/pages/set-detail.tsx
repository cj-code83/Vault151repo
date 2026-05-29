import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { searchCards, getSets } from '@/services/pokemonTcg';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
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
  }, [page1, page2]);

  const setCardIds = new Set(allCards.map((c) => c.id));
  const owned = Object.values(collectionCards).filter(
    (c) => c.quantity > 0 && setCardIds.has(c.cardId)
  ).length;
  const total = set?.printedTotal || set?.total || allCards.length || 0;
  const pct   = total > 0 ? Math.min(100, Math.round((owned / total) * 100)) : 0;

  return (
    <div className="flex flex-col">
      {/*
        ── Sticky header: back button + set logo + name ──────────────────
        Stays visible while scrolling through the card grid so the user
        always knows which set they're browsing.
      */}
      <div className="sticky top-16 md:top-0 z-20 bg-background -mx-4 md:-mx-8 px-4 md:px-8 pt-3 pb-3 border-b border-border">
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
            <h1 className="text-lg font-bold leading-tight truncate">
              {set?.name ?? setId}
            </h1>
            {set && (
              <p className="text-xs text-muted-foreground">
                {set.series} · {set.releaseDate}
              </p>
            )}
          </div>

          {/* Completion badge — always visible in sticky bar */}
          {total > 0 && (
            <div className="shrink-0 text-right">
              <p className={`text-sm font-bold ${pct === 100 ? 'text-green-500' : pct > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                {pct}%
              </p>
              <p className="text-[10px] text-muted-foreground">{owned}/{total}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Progress bar (scrolls away) ── */}
      {set && (
        <div className="pt-4 px-0">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${pct === 100 ? 'bg-green-500' : 'bg-primary'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

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
            <div className="text-xs text-muted-foreground mb-3">
              {page1?.totalCount ?? allCards.length} cards in set
              {needsPage2 && !page2 && (
                <span className="ml-2 text-primary animate-pulse">Loading more…</span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {allCards.map((card) => (
                <CardItem key={card.id} card={card} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
