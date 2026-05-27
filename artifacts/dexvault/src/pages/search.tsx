import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchCards, getTrendingCards, getSets } from '@/services/pokemonTcg';
import { useDebounce } from '@/hooks/use-debounce';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search as SearchIcon, SlidersHorizontal, TrendingUp, X } from 'lucide-react';
import { CardItem } from '@/components/card-item';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

// ─── Static filter options ─────────────────────────────────────────────────

const POKEMON_TYPES = [
  'Colorless', 'Darkness', 'Dragon', 'Fairy', 'Fighting',
  'Fire', 'Grass', 'Lightning', 'Metal', 'Psychic', 'Water',
];

const RARITIES = [
  'Common', 'Uncommon', 'Rare', 'Rare Holo',
  'Double Rare', 'Rare Holo EX', 'Rare Holo GX',
  'Rare Holo V', 'Rare Holo VMAX', 'Rare Holo VSTAR',
  'Illustration Rare', 'Special Illustration Rare',
  'Rare Ultra', 'Rare Secret', 'Hyper Rare',
  'Amazing Rare', 'Rare Rainbow', 'Shiny Rare',
  'ACE SPEC Rare',
];

// Group sets by series for the dropdown
const SERIES_ORDER = [
  'Scarlet & Violet', 'Sword & Shield', 'Sun & Moon', 'XY',
  'Black & White', 'HeartGold & SoulSilver', 'Diamond & Pearl',
  'Platinum', 'EX', 'e-Card', 'Neo', 'Gym', 'Base',
];

// ─── Component ─────────────────────────────────────────────────────────────

export default function Search() {
  const [searchTerm, setSearchTerm]     = useState('');
  const [filterSetId, setFilterSetId]   = useState('');
  const [filterType, setFilterType]     = useState('');
  const [filterRarity, setFilterRarity] = useState('');
  const [showFilters, setShowFilters]   = useState(false);

  const debouncedSearch = useDebounce(searchTerm, 400);

  const activeFilterCount = [filterSetId, filterType, filterRarity].filter(Boolean).length;
  const hasActiveFilter   = activeFilterCount > 0;
  const isFiltering       = debouncedSearch.trim().length > 0 || hasActiveFilter;

  // ── Queries ───────────────────────────────────────────────────────────
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['cards', { name: debouncedSearch, setId: filterSetId, type: filterType, rarity: filterRarity }],
    queryFn: () => searchCards({
      name:   debouncedSearch.trim() || undefined,
      setId:  filterSetId  || undefined,
      types:  filterType   || undefined,
      rarity: filterRarity || undefined,
      pageSize: 24,
    }),
    enabled: isFiltering,
    staleTime: 60_000,
  });

  const { data: trending, isLoading: trendingLoading } = useQuery({
    queryKey: ['trending-cards'],
    queryFn: getTrendingCards,
    enabled: !isFiltering,
    staleTime: 1000 * 60 * 15,
  });

  const { data: sets } = useQuery({
    queryKey: ['sets'],
    queryFn: getSets,
    staleTime: 3_600_000,
  });

  // ── Group sets by series for the filter dropdown ──────────────────────
  const groupedSets: { series: string; items: { id: string; name: string }[] }[] = [];
  if (sets) {
    const seen = new Set<string>();
    for (const series of SERIES_ORDER) {
      const matches = sets.filter(
        (s) => s.series.toLowerCase().includes(series.toLowerCase()) && !seen.has(s.id)
      );
      if (matches.length) {
        matches.forEach((s) => seen.add(s.id));
        groupedSets.push({ series, items: matches.map((s) => ({ id: s.id, name: s.name })) });
      }
    }
    const other = sets.filter((s) => !seen.has(s.id));
    if (other.length) groupedSets.push({ series: 'Other', items: other.map((s) => ({ id: s.id, name: s.name })) });
  }

  const clearFilters = () => {
    setFilterSetId('');
    setFilterType('');
    setFilterRarity('');
  };

  const GRID = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4';
  const STAGGER = {
    hidden: { opacity: 0 },
    show:   { opacity: 1, transition: { staggerChildren: 0.04 } },
  };
  const ITEM = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="flex flex-col">

      {/* ── Sticky header with search + filters ── */}
      <div className="sticky top-16 md:top-0 z-20 bg-background -mx-4 md:-mx-8 px-4 md:px-8 pt-4 md:pt-8 pb-4 border-b border-border space-y-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Search</h1>
          <p className="text-muted-foreground">Find and add cards to your collection.</p>
        </div>

        {/* Search bar row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              className="pl-10 h-12 text-lg bg-card border-border"
              placeholder="Search by Pokémon name…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button
            variant={showFilters || hasActiveFilter ? 'default' : 'outline'}
            className="h-12 gap-2 shrink-0 relative"
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <Badge className="absolute -top-1.5 -right-1.5 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap gap-2 items-end"
          >
            {/* Set filter */}
            <div className="flex-1 min-w-[160px]">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Set</p>
              <Select value={filterSetId} onValueChange={setFilterSetId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Any set" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="">Any set</SelectItem>
                  {groupedSets.map(({ series, items }) => (
                    <SelectGroup key={series}>
                      <SelectLabel className="text-xs">{series}</SelectLabel>
                      {items.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-sm">
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type filter */}
            <div className="flex-1 min-w-[130px]">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Type</p>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Any type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any type</SelectItem>
                  {POKEMON_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Rarity filter */}
            <div className="flex-1 min-w-[160px]">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Rarity</p>
              <Select value={filterRarity} onValueChange={setFilterRarity}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Any rarity" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="">Any rarity</SelectItem>
                  {RARITIES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clear button */}
            {hasActiveFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 text-muted-foreground hover:text-foreground self-end"
                onClick={clearFilters}
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </motion.div>
        )}

        {/* Active filter chips (shown even when panel is collapsed) */}
        {hasActiveFilter && !showFilters && (
          <div className="flex flex-wrap gap-1.5">
            {filterSetId && sets && (
              <Badge variant="secondary" className="gap-1 text-xs">
                {sets.find((s) => s.id === filterSetId)?.name ?? filterSetId}
                <button onClick={() => setFilterSetId('')} className="hover:text-destructive ml-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filterType && (
              <Badge variant="secondary" className="gap-1 text-xs">
                {filterType}
                <button onClick={() => setFilterType('')} className="hover:text-destructive ml-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filterRarity && (
              <Badge variant="secondary" className="gap-1 text-xs">
                {filterRarity}
                <button onClick={() => setFilterRarity('')} className="hover:text-destructive ml-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* ── Results area ── */}
      <div className="pt-6">
        {isError && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-md border border-destructive/20 mb-4">
            Error searching cards: {(error as Error).message}
          </div>
        )}

        {/* Search / filter results */}
        {isFiltering && (
          isLoading ? (
            <div className={GRID}>
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[63/88] rounded-xl" />
              ))}
            </div>
          ) : data?.data.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No cards found — try adjusting your search or filters.
            </div>
          ) : (
            <motion.div className={GRID} initial="hidden" animate="show" variants={STAGGER}>
              {data?.data.map((card) => (
                <motion.div key={card.id} variants={ITEM}>
                  <CardItem card={card} />
                </motion.div>
              ))}
            </motion.div>
          )
        )}

        {/* Trending — shown when nothing is searched/filtered */}
        {!isFiltering && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Trending</h2>
              <span className="text-xs text-muted-foreground">High-value recent releases</span>
            </div>
            {trendingLoading ? (
              <div className={GRID}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[63/88] rounded-xl" />
                ))}
              </div>
            ) : (
              <motion.div className={GRID} initial="hidden" animate="show" variants={STAGGER}>
                {(trending ?? []).map((card) => (
                  <motion.div key={card.id} variants={ITEM}>
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
