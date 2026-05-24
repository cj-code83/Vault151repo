import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { searchCards, getSets } from '@/services/pokemonTcg';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { CardItem } from '@/components/card-item';
import { useCollectionStore } from '@/store/collectionStore';
import { useAuth } from '@/hooks/use-auth';

export default function SetDetail() {
  const { id: setId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 24;
  useAuth();
  const { collectionCards } = useCollectionStore();

  const { data: setsData } = useQuery({
    queryKey: ['sets'],
    queryFn: getSets,
    staleTime: 3600000,
  });

  const set = setsData?.find((s) => s.id === setId);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['set-cards', setId, page],
    queryFn: () => searchCards({ q: `set.id:${setId}`, page, pageSize: PAGE_SIZE }),
    staleTime: 1000 * 60 * 10,
    enabled: !!setId,
  });

  const totalPages = data ? Math.ceil(data.totalCount / PAGE_SIZE) : 0;

  const owned = Object.values(collectionCards).filter(
    (c) => c.cardId.startsWith(setId + '-')
  ).length;
  const total = set?.printedTotal || set?.total || 0;
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
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2.5/3.5] rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <div className="text-destructive text-sm">Failed to load cards for this set.</div>
      )}

      {data && (
        <>
          <div className="text-xs text-muted-foreground">{data.totalCount} cards in set</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {data.data.map((card, i) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.15, delay: i * 0.015 }}
              >
                <CardItem card={card} />
              </motion.div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Prev
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                data-testid="button-next-page"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
