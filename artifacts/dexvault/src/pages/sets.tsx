import { useQuery } from '@tanstack/react-query';
import { getSets } from '@/services/pokemonTcg';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

export default function Sets() {
  const { data: sets, isLoading, isError } = useQuery({
    queryKey: ['sets'],
    queryFn: getSets,
    staleTime: 3600000, // 1 hour
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Sets</h1>
        <p className="text-muted-foreground">Browse cards by set and era.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-destructive">Failed to load sets</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sets?.map((set) => (
            <Card key={set.id} className="hover-elevate cursor-pointer border-border transition-all">
              <CardContent className="p-4 flex items-center gap-4 h-full">
                <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                  <img src={set.images.symbol} alt={set.name} className="max-w-full max-h-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{set.name}</h3>
                  <p className="text-xs text-muted-foreground">{set.series}</p>
                  <p className="text-xs text-muted-foreground mt-1">{set.total} cards</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
