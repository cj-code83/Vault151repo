import { useState, useMemo } from 'react';
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
import { sortCards, SortOrder, SORT_OPTIONS } from '@/utils/sort';

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

const SERIES_ORDER = [
  'Scarlet & Violet', 'Sword & Shield', 'Sun & Moon', 'XY',
  'Black & White', 'HeartGold & SoulSilver', 'Diamond & Pearl',
  'Platinum', 'EX', 'e-Card', 'Neo', 'Gym', 'Base',
];

const GRID = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4';
const NONE = '__none__';

// ─── Component ─────────────────────────────────────────────────────────────

export default function Search() {
  const [searchTerm, setSearchTerm]     = useState('');
  const [filterSetId, setFilterSetId]   = useState('');
  const [filterType, setFilterType]     = useState('');
  const [filterRarity, setFilterRarity] = useState('');
  const [filterNumber, setFilterNumber] = useState('');
  const [showFilters, setShowFilters]   = useState(false);
  const [sortOrder, setSortOrder]       = useState<SortOrder>('number');

  const debouncedSearch = useDebounce(searchTerm, 400);

  const toFilter = (v: string) => (v === NONE ? '' : v);

  const activeFilterCount = [filterSetId, filterType, filterRarity, filterNumber].filter(Boolean).length;
  const hasActiveFilter   = activeFilterCount > 0;
  const isFiltering       = debouncedSearch.trim().length > 0 || hasActiveFilter;

  // ── Queries ───────────────────────────────────────────────────────────
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['cards', {
      name:   debouncedSearch,
      setId:  filterSetId,
      type:   filterType,
      rarity: filterRarity,
      number: filterNumber,
    }],
    queryFn: () => searchCards({
      name:   debouncedSearch.trim() || undefined,
      setId:  filterSetId  || undefined,
      types:  filterType   || undefined,
      rarity: filterRarity || undefined,
      number: filterNumber || undefined,
      pageSize: 24,
    }),
    enabled: isFiltering,
    staleTime: 10 * 60 * 1000,
  });

  const { data: trending, isLoading: trendingLoading } = useQuery({
    queryKey: ['trending-cards'],
    queryFn: getTrendingCards,
    enabled: !isFiltering,
    staleTime: 60 * 60 * 1000,
  });

  const { data: sets } = useQuery({
    queryKey: ['sets'],
    queryFn: getSets,
    staleTime: 24 * 60 * 60 * 1000,
  });

  // ── Group sets by series ──────────────────────────────────────────────
  const groupedSets = useMemo(() => {
    const result: { series: string; items: { id: string; name: string }[] }[] = [];
    if (!sets) return result;
    const seen = new Set<string>();
    for (const series of SERIES_ORDER) {
      const matches = sets.filter(
        (s) => s.series.toLowerCase().includes(series.toLowerCase()) && !seen.has(s.id)
      );
      if (matches.length) {
        matches.forEach((s) => seen.add(s.id));
        result.push({ series, items: matches.map((s) => ({ id: s.id, name: s.name })) });
      }
    }
    const other = sets.filter((s) => !seen.has(s.id));
    if (other.length) result.push({ series: 'Other', items: other.map((s) => ({ id: s.id, name: s.name })) });
    return result;
  }, [sets]);

  // ── Number options: 1..set.printedTotal (or 1..300 if no set chosen) ─
  const numberOptions = useMemo(() => {
    const selectedSet = sets?.find((s) => s.id === filterSetId);
    const max = selectedSet ? (selectedSet.printedTotal || selectedSet.total || 300) : 300;
    return Array.from({ length: max }, (_, i) => String(i + 1));
  }, [sets, filterSetId]);

  // ── Apply client-side sort to API results ─────────────────────────────
  const searchResults = useMemo(
    () => sortCards(data?.data ?? [], sortOrder),
    [data?.data, sortOrder]
  );
  const trendingResults = useMemo(
    () => sortCards(trending ?? [], sortOrder),
    [trending, sortOrder]
  );

  const clearFilters = () => {
    setFilterSetId('');
    setFilterType('');
    setFilterRarity('');
    setFilterNumber('');
  };

  return (
    <div className="flex flex-col">

      {/* ── Sticky header ── */}
      <div className="sticky top-16 md:top-0 z-20 bg-background -mx-4 md:-mx-8 px-4 md:px-8 pt-4 md:pt-8 pb-4 border-b border-border space-y-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Search</h1>
          <p className="text-muted-foreground">Find and add cards to your collection.</p>
        </div>

        {/* Search bar + filter toggle */}
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
            <div className="flex-1 min-w-[160px]">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Set</p>
              <Select
                value={filterSetId || NONE}
                onValueChange={(v) => {
                  setFilterSetId(toFilter(v));
                  setFilterNumber('');
                }}
              >
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Any set" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NONE}>Any set</SelectItem>
                  {groupedSets.map(({ series, items }) => (
                    <SelectGroup key={series}>
                      <SelectLabel className="text-xs">{series}</SelectLabel>
                      {items.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-sm">{s.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[130px]">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Type</p>
              <Select value={filterType || NONE} onValueChange={(v) => setFilterType(toFilter(v))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Any type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Any type</SelectItem>
                  {POKEMON_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[160px]">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Rarity</p>
              <Select value={filterRarity || NONE} onValueChange={(v) => setFilterRarity(toFilter(v))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Any rarity" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NONE}>Any rarity</SelectItem>
                  {RARITIES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[110px]">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Card #</p>
              <Select
                value={filterNumber || NONE}
                onValueChange={(v) => setFilterNumber(toFilter(v))}
              >
                <SelectTrigger className="h-9 text-sm font-mono">
                  <SelectValue placeholder="Any #" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value={NONE}>Any #</SelectItem>
                  {numberOptions.map((n) => (
                    <SelectItem key={n} value={n} className="font-mono text-sm">#{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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

        {/* Active filter chips */}
        {hasActiveFilter && !showFilters && (
          <div className="flex flex-wrap gap-1.5">
            {filterSetId && sets && (
              <Badge variant="secondary" className="gap-1 text-xs">
                {sets.find((s) => s.id === filterSetId)?.name ?? filterSetId}
                <button onClick={() => setFilterSetId('')} className="hover:text-destructive ml-0.5"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {filterType && (
              <Badge variant="secondary" className="gap-1 text-xs">
                {filterType}
                <button onClick={() => setFilterType('')} className="hover:text-destructive ml-0.5"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {filterRarity && (
              <Badge variant="secondary" className="gap-1 text-xs">
                {filterRarity}
                <button onClick={() => setFilterRarity('')} className="hover:text-destructive ml-0.5"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {filterNumber && (
              <Badge variant="secondary" className="gap-1 text-xs font-mono">
                #{filterNumber}
                <button onClick={() => setFilterNumber('')} className="hover:text-destructive ml-0.5"><X className="h-3 w-3" /></button>
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* ── Results ── */}
      <div className="pt-6">
        {isError && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-md border border-destructive/20 mb-4">
            Error: {(error as Error).message}
          </div>
        )}

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
            <>
              {/* Sort control above results */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-muted-foreground">
                  {data?.data.length ?? 0} results
                </span>
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
              </div>
              <div className={GRID}>
                {searchResults.map((card) => (
                  <CardItem key={card.id} card={card} />
                ))}
              </div>
            </>
          )
        )}

        {!isFiltering && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Trending</h2>
              <span className="text-xs text-muted-foreground">High-value recent releases</span>
              {!trendingLoading && (
                <Select
                  value={sortOrder}
                  onValueChange={(v) => setSortOrder(v as SortOrder)}
                >
                  <SelectTrigger className="h-8 text-sm w-32 ml-auto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {trendingLoading ? (
              <div className={GRID}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[63/88] rounded-xl" />
                ))}
              </div>
            ) : (
              <div className={GRID}>
                {trendingResults.map((card) => (
                  <CardItem key={card.id} card={card} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
