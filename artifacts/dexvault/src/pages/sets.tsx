import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { getSets } from '@/services/pokemonTcg';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { useCollectionStore } from '@/store/collectionStore';
import { CollectionCard, PokemonSet } from '@/types/pokemon';
import pokeball   from '@/assets/pokeball.png';
import masterBall from '@/assets/master-ball.png';

const ERAS: { label: string; series: string[] }[] = [
  { label: 'Scarlet & Violet',       series: ['Scarlet & Violet'] },
  { label: 'Sword & Shield',         series: ['Sword & Shield'] },
  { label: 'Sun & Moon',             series: ['Sun & Moon'] },
  { label: 'XY',                     series: ['XY'] },
  { label: 'Black & White',          series: ['Black & White'] },
  { label: 'HeartGold & SoulSilver', series: ['HeartGold & SoulSilver'] },
  { label: 'Diamond & Pearl',        series: ['Diamond & Pearl', 'Platinum'] },
  { label: 'EX Series',              series: ['EX'] },
  { label: 'Wizards of the Coast',   series: ['Base', 'Jungle', 'Fossil', 'Team Rocket', 'Gym', 'Neo', 'Legendary Collection', 'e-Card'] },
  { label: 'Other',                  series: [] },
];

/**
 * Compute set completion stats using the correct logic:
 *
 * Standard set: count unique card NUMBERS ≤ printedTotal that the user owns.
 * Any variant of the same number counts as collecting that number.
 * Secret rares (number > printedTotal, or non-numeric) don't count.
 *
 * Master set: count unique card IDs owned, including secret rares.
 */
function getSetCompletion(
  set: PokemonSet,
  collectionCards: Record<string, CollectionCard>,
) {
  const printedTotal = set.printedTotal ?? 0;
  const prefix = set.id + '-';

  // Cards in this set that are effectively owned (qty > 0 OR any variant qty > 0)
  const ownedInSet = Object.values(collectionCards).filter((cc) => {
    if (!cc.cardId.startsWith(prefix)) return false;
    return cc.quantity > 0 || Object.values(cc.variants ?? {}).some((v) => v > 0);
  });

  // Standard: unique card NUMBERS ≤ printedTotal
  const ownedStdNums = new Set<string>();
  for (const cc of ownedInSet) {
    const suffix = cc.cardId.slice(prefix.length); // number portion after "setId-"
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

  // Master: all unique card IDs in this set owned (standard + secret rares)
  const masterOwned   = ownedInSet.length;
  const masterTotal   = set.total ?? 0;
  const masterComplete = masterTotal > 0 && masterOwned >= masterTotal;

  // Extra: cards with number > printedTotal (secret rares, illustration rares, etc.)
  const extraOwnedCards = ownedInSet.filter((cc) => {
    const suffix = cc.cardId.slice(prefix.length);
    const n = parseInt(suffix, 10);
    return isNaN(n) || (printedTotal > 0 && n > printedTotal);
  });
  const extraOwned    = extraOwnedCards.length;
  const extraTotal    = Math.max(0, masterTotal - printedTotal);
  const extraPct      = extraTotal > 0 ? Math.min(100, Math.round((extraOwned / extraTotal) * 100)) : 0;
  const extraComplete  = extraTotal > 0 && extraOwned >= extraTotal;
  const hasMasterCards = masterTotal > printedTotal && printedTotal > 0;

  return {
    standardOwned,
    standardTotal,
    standardPct,
    standardComplete,
    masterOwned,
    masterTotal,
    masterComplete,
    extraOwned,
    extraTotal,
    extraPct,
    extraComplete,
    hasMasterCards,
  };
}

export default function Sets() {
  const [, setLocation] = useLocation();
  const { data: sets, isLoading, isError } = useQuery({
    queryKey: ['sets'],
    queryFn: getSets,
    staleTime: 24 * 60 * 60 * 1000,
  });
  const { collectionCards } = useCollectionStore();

  const groupedSets: { era: string; sets: PokemonSet[] }[] = [];
  if (sets) {
    const assigned = new Set<string>();
    for (const era of ERAS) {
      if (era.series.length === 0) continue;
      const matched = sets.filter(
        (s) => era.series.some((ser) => s.series.toLowerCase().includes(ser.toLowerCase())) && !assigned.has(s.id)
      );
      matched.forEach((s) => assigned.add(s.id));
      if (matched.length) groupedSets.push({ era: era.label, sets: matched });
    }
    const other = sets.filter((s) => !assigned.has(s.id));
    if (other.length) groupedSets.push({ era: 'Other', sets: other });
  }

  return (
    <div className="flex flex-col">
      <div className="sticky top-16 md:top-0 z-20 bg-background -mx-4 md:-mx-8 px-4 md:px-8 pt-4 md:pt-8 pb-4 border-b border-border">
        <h1 className="text-3xl font-bold tracking-tight mb-1">Sets</h1>
        <p className="text-muted-foreground">Browse every era of English Pokémon TCG.</p>
      </div>

      <div className="pt-6 space-y-8">
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        )}

        {isError && (
          <div className="text-destructive">Failed to load sets. Please try again.</div>
        )}

        {!isLoading && !isError && groupedSets.map(({ era, sets: eraSets }) => (
          <section key={era}>
            <h2 className="text-lg font-semibold mb-3 text-foreground/80 border-b border-border pb-2">{era}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {eraSets.map((set, i) => {
                const {
                  standardOwned, standardTotal, standardPct, standardComplete,
                  masterComplete,
                  extraOwned, extraTotal, extraPct, extraComplete, hasMasterCards,
                } = getSetCompletion(set, collectionCards);

                return (
                  <motion.div
                    key={set.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                    className="group cursor-pointer rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 overflow-hidden"
                    onClick={() => setLocation(`/sets/${set.id}`)}
                  >
                    <div className="flex items-center gap-3 p-4">
                      {/* Set logo */}
                      <div className="w-16 h-10 shrink-0 flex items-center justify-center">
                        {set.images.logo ? (
                          <img
                            src={set.images.logo}
                            alt={set.name}
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = set.images.symbol;
                            }}
                          />
                        ) : (
                          <img
                            src={set.images.symbol}
                            alt={set.name}
                            className="max-w-full max-h-full object-contain"
                          />
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
                          {/* Standard bar */}
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {standardOwned} / {standardTotal || set.total} owned
                            </span>
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
                          {/* Extra / secret-rare bar */}
                          {hasMasterCards && (
                            <>
                              <div className="flex items-center justify-between text-xs mt-0.5">
                                <span className="text-muted-foreground">
                                  {extraOwned} / {extraTotal} extra
                                </span>
                                <span className={`font-semibold ${
                                  extraComplete ? 'text-yellow-500' : extraPct > 0 ? 'text-yellow-500/80' : 'text-muted-foreground'
                                }`}>
                                  {extraPct}%
                                </span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    extraComplete ? 'bg-yellow-500' : 'bg-yellow-400/60'
                                  }`}
                                  style={{ width: `${extraPct}%` }}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right column: completion ball OR set symbol */}
                      <div
                        className="shrink-0 flex flex-col items-center gap-0.5 pl-1"
                        title={
                          masterComplete
                            ? 'Master Set Complete!'
                            : standardComplete
                            ? 'Standard Set Complete!'
                            : 'Set symbol — match this on your physical card'
                        }
                      >
                        {masterComplete ? (
                          /* Master set complete — gold master ball */
                          <img
                            src={masterBall}
                            alt="Master Set Complete"
                            className="w-9 h-9 object-contain"
                          />
                        ) : standardComplete ? (
                          /* Standard set complete — red pokéball */
                          <img
                            src={pokeball}
                            alt="Standard Set Complete"
                            className="w-9 h-9 object-contain"
                          />
                        ) : (
                          /* Not yet complete — show set symbol */
                          <>
                            <div className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center">
                              <img
                                src={set.images.symbol}
                                alt={`${set.name} symbol`}
                                className="w-6 h-6 object-contain"
                              />
                            </div>
                            <span className="text-[9px] text-muted-foreground leading-none">symbol</span>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
