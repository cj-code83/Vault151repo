import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchCards, getTrendingCards } from '@/services/pokemonTcg';
import { useDebounce } from '@/hooks/use-debounce';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search as SearchIcon, Camera, TrendingUp } from 'lucide-react';
import { CardItem } from '@/components/card-item';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { useLocation } from 'wouter';

export default function Search() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);
  const isSearching = debouncedSearch.trim().length > 0;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['cards', { name: debouncedSearch }],
    queryFn: () => searchCards({ name: debouncedSearch }),
    enabled: isSearching,
    staleTime: 60000,
  });

  const { data: trending, isLoading: trendingLoading } = useQuery({
    queryKey: ['trending-cards'],
    queryFn: getTrendingCards,
    enabled: !isSearching,
    staleTime: 1000 * 60 * 15,
  });

  return (
    <div className="flex flex-col">
      <div className="sticky top-16 md:top-0 z-20 bg-background -mx-4 md:-mx-8 px-4 md:px-8 pt-4 md:pt-8 pb-4 border-b border-border space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Search</h1>
          <p className="text-muted-foreground">Find and add cards to your collection.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              className="pl-10 h-12 text-lg bg-card border-border"
              placeholder="Search by Pokémon name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 shrink-0"
            onClick={() => setLocation('/scan')}
            title="Scan a card"
          >
            <Camera className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="pt-6">
        {isError && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-md border border-destructive/20 mb-4">
            Error searching cards: {(error as Error).message}
          </div>
        )}

        {/* Search results */}
        {isSearching && (
          isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[63/88] rounded-xl" />
              ))}
            </div>
          ) : data?.data.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No cards found for "{debouncedSearch}"
            </div>
          ) : (
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
              initial="hidden"
              animate="show"
              variants={{
                hidden: { opacity: 0 },
                show: { opacity: 1, transition: { staggerChildren: 0.05 } },
              }}
            >
              {data?.data.map((card) => (
                <motion.div
                  key={card.id}
                  variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
                >
                  <CardItem card={card} />
                </motion.div>
              ))}
            </motion.div>
          )
        )}

        {/* Trending — shown when not searching */}
        {!isSearching && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Trending</h2>
              <span className="text-xs text-muted-foreground">High-value recent releases</span>
            </div>

            {trendingLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[63/88] rounded-xl" />
                ))}
              </div>
            ) : (
              <motion.div
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
                initial="hidden"
                animate="show"
                variants={{
                  hidden: { opacity: 0 },
                  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
                }}
              >
                {(trending ?? []).map((card) => (
                  <motion.div
                    key={card.id}
                    variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
                  >
                    <CardItem card={card} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
