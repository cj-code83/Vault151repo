import { useState, useMemo } from 'react';
import { useRoute } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCard } from '@/services/pokemonTcg';
import { useCollectionStore } from '@/store/collectionStore';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Minus, Star, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { getAvailableVariants, getVariantLetter, formatVariantName } from '@/utils/variants';
import { PokemonCard } from '@/types/pokemon';

// ─── Standard vs variant keys ─────────────────────────────────────────────
// "Unlimited" (normal) is the standard printing. It is counted by the main
// ± buttons, priced in the estimated-value header, and never shown in the
// variant picker. Everything else (holofoil, reverse holo, 1st Edition …)
// is a true variant and is tracked separately.
const STANDARD_KEYS = new Set(['normal', 'unlimitedNormal']);

// ─── Find card in React Query in-memory cache ─────────────────────────────
// Checks every cached search/set/collection/trending query so that navigating
// from any grid page gives an instant render with no extra network call.
function findCachedCard(qc: ReturnType<typeof useQueryClient>, id: string): PokemonCard | undefined {
  // 1. Individual card cache
  const direct = qc.getQueryData<PokemonCard>(['card', id]);
  if (direct) return direct;

  // 2. Search results  { data: PokemonCard[] }
  for (const [, res] of qc.getQueriesData<{ data: PokemonCard[] }>({ queryKey: ['cards'] })) {
    const found = res?.data?.find((c) => c.id === id);
    if (found) return found;
  }

  // 3. Set-detail pages  { data: PokemonCard[] }
  for (const [, res] of qc.getQueriesData<{ data: PokemonCard[] }>({ queryKey: ['set-cards-all'] })) {
    const found = res?.data?.find((c) => c.id === id);
    if (found) return found;
  }

  // 4. Collection batch-fetched cards  PokemonCard[]
  for (const [, cards] of qc.getQueriesData<PokemonCard[]>({ queryKey: ['collection-cards'] })) {
    const found = cards?.find((c) => c.id === id);
    if (found) return found;
  }

  // 5. Trending  PokemonCard[]
  const trending = qc.getQueryData<PokemonCard[]>(['trending-cards']);
  return trending?.find((c) => c.id === id);
}

// ─── Value calculation ────────────────────────────────────────────────────

type AvailableVariants = ReturnType<typeof getAvailableVariants>;

function calcEstimatedValue(
  variantMap: Record<string, number>,
  genericQty: number,
  allVariants: AvailableVariants,
) {
  const standardVariant = allVariants.find((v) => STANDARD_KEYS.has(v.key));
  const nonStandard     = allVariants.filter((v) => !STANDARD_KEYS.has(v.key));

  // Standard copies at the unlimited/normal price
  const standardValue = standardVariant
    ? genericQty * (standardVariant.price ?? 0)
    : 0;

  // Explicitly tracked non-standard variant copies
  const variantValue = nonStandard.reduce(
    (sum, v) => sum + (variantMap[v.key] ?? 0) * (v.price ?? 0),
    0,
  );

  // Single-variant card with no standard key: that one variant IS the standard.
  // Count generic + variant-tracked copies together at its price.
  if (!standardVariant && nonStandard.length === 1) {
    const sv = nonStandard[0];
    const svQty = variantMap[sv.key] ?? 0;
    return { total: (genericQty + svQty) * (sv.price ?? 0), untrackedGeneric: 0 };
  }

  // Generic copies where no standard price exists AND multiple variants → untrackable
  const untrackedGeneric =
    !standardVariant && nonStandard.length > 1 && genericQty > 0 ? genericQty : 0;

  return { total: standardValue + variantValue, untrackedGeneric };
}

// ─── Component ────────────────────────────────────────────────────────────

export default function CardDetail() {
  const [, params] = useRoute('/card/:id');
  const cardId = params?.id;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    collectionCards, addCard, updateQuantity, toggleFavorite,
    toggleWishlist, updateVariants, updateNotes,
  } = useCollectionStore();

  const [notesValue, setNotesValue]   = useState<string | null>(null);
  const [largeLoaded, setLargeLoaded] = useState(false);

  // Synchronous cache lookup — gives instant render when navigating from any
  // grid page (search, set-detail, collection) where the card was already fetched.
  const cachedCard = useMemo(
    () => (cardId ? findCachedCard(queryClient, cardId) : undefined),
    [queryClient, cardId],
  );

  const { data: card, isLoading } = useQuery({
    queryKey: ['card', cardId],
    queryFn: () => getCard(cardId!),
    enabled: !!cardId,
    staleTime: 24 * 60 * 60 * 1000,
    placeholderData: cachedCard, // renders immediately; real fetch runs in background
  });

  if (isLoading && !card) {
    return (
      <div className="flex flex-col md:flex-row gap-8 pt-4 md:pt-8">
        <div className="w-full md:w-1/3 shrink-0">
          <Skeleton className="aspect-[63/88] rounded-2xl w-full" />
        </div>
        <div className="flex-1 space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!card) return <div className="text-destructive pt-4">Card not found</div>;

  const owned       = user ? collectionCards[card.id] : null;
  const genericQty  = owned?.quantity || 0;
  const variantMap  = owned?.variants ?? {};
  const variantQty  = Object.values(variantMap).reduce((s, v) => s + v, 0);
  const totalQty    = genericQty + variantQty;

  const currentNotes     = notesValue ?? owned?.notes ?? '';
  const allVariants      = getAvailableVariants(card.tcgplayer?.prices);
  const standardVariant  = allVariants.find((v) => STANDARD_KEYS.has(v.key));
  const nonStdVariants   = allVariants.filter((v) => !STANDARD_KEYS.has(v.key));

  // Single-variant: no standard key AND only one non-standard → that is the de-facto standard
  const isSingleVariant  = !standardVariant && nonStdVariants.length === 1;

  // Effective total for single-variant cards combines generic + that variant's tracked qty
  const effectiveTotalQty = isSingleVariant
    ? genericQty + (variantMap[nonStdVariants[0]?.key ?? ''] ?? 0)
    : totalQty;

  const { total: estimatedValue, untrackedGeneric } = calcEstimatedValue(
    variantMap, genericQty, allVariants,
  );

  const handleVariantChange = async (key: string, delta: number) => {
    if (!user) return;
    const newQty = Math.max(0, (variantMap[key] ?? 0) + delta);
    const next   = { ...variantMap, [key]: newQty };
    if (newQty === 0) delete next[key];
    await updateVariants(card.id, next, user.id, card);
  };

  const handleNotesSave = async () => {
    if (!user || !owned || notesValue === null) return;
    await updateNotes(card.id, notesValue, user.id);
  };

  // Variant letter badges — only for non-standard tracked variants
  const trackedVariantLetters = [
    ...new Set(
      Object.entries(variantMap)
        .filter(([k, qty]) => qty > 0 && !STANDARD_KEYS.has(k))
        .map(([k]) => getVariantLetter(k))
    ),
  ];

  return (
    <div className="flex flex-col md:flex-row gap-8 pt-4 md:pt-8 animate-in fade-in duration-500">

      {/* ── Card image: small shown immediately, large fades in on top ── */}
      <div className="w-full md:w-1/3 lg:w-1/4 shrink-0">
        <div className="relative w-fit">
          <motion.div
            className="relative rounded-2xl overflow-hidden shadow-2xl"
            whileHover={{ rotateY: 10, rotateX: 5, scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <img src={card.images.small} alt={card.name} className="w-full h-auto" decoding="async" />
            <img
              src={card.images.large}
              alt=""
              aria-hidden
              className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${largeLoaded ? 'opacity-100' : 'opacity-0'}`}
              decoding="async"
              onLoad={() => setLargeLoaded(true)}
            />
          </motion.div>

          {trackedVariantLetters.length > 0 && (
            <div className="absolute -top-2 -left-2 flex gap-1">
              {trackedVariantLetters.map((letter, i) => (
                <div key={letter + i}
                  className="w-6 h-6 rounded-full bg-yellow-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md">
                  {letter}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Details ── */}
      <div className="flex-1 space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-muted-foreground font-mono text-sm">
              {card.set.id} · {card.number}
              {card.set.printedTotal ? `/${card.set.printedTotal}` : ''}
            </span>
            {card.rarity && <Badge variant="secondary" className="font-medium">{card.rarity}</Badge>}
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-1">{card.name}</h1>
          <p className="text-xl text-muted-foreground mb-3">{card.supertype} {card.subtypes?.join(' - ')}</p>

          {/* Estimated value */}
          {owned && estimatedValue > 0 && (
            <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 w-fit">
              <div>
                <p className="text-xs text-green-700 dark:text-green-400 font-medium">Est. Value</p>
                <p className="text-2xl font-bold font-mono text-green-700 dark:text-green-400 leading-none">
                  ${estimatedValue.toFixed(2)}
                </p>
              </div>
              {untrackedGeneric > 0 && (
                <p className="text-xs text-muted-foreground self-end pb-0.5">
                  + {untrackedGeneric} untracked {untrackedGeneric === 1 ? 'copy' : 'copies'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Collection controls */}
        <Card className="border-border bg-card">
          <CardContent className="p-6">
            {/* Standard price line (if card has a normal/unlimited printing) */}
            {standardVariant?.price != null && (
              <p className="text-xs text-muted-foreground mb-3">
                Unlimited market price:{' '}
                <span className="font-mono font-semibold text-green-600 dark:text-green-400">
                  ${standardVariant.price.toFixed(2)}
                </span>
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="flex items-center">
                  <Button variant="outline" size="icon"
                    onClick={() => user && updateQuantity(card.id, Math.max(0, genericQty - 1), user.id)}
                    disabled={!user || genericQty === 0}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center font-bold font-mono text-xl">{effectiveTotalQty}</span>
                  <Button variant="outline" size="icon"
                    onClick={() => user && addCard(card, user.id)}
                    disabled={!user}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">In Collection</div>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant={owned?.isFavorite ? 'default' : 'outline'} size="icon"
                  onClick={() => user && owned && toggleFavorite(card.id, user.id)}
                  disabled={!user || !owned}
                  title={owned?.isFavorite ? 'Remove from favourites' : 'Add to favourites'}>
                  <Star className={`h-5 w-5 ${owned?.isFavorite ? 'fill-current' : ''}`} />
                </Button>
                <Button
                  variant={owned?.isWishlisted ? 'default' : 'outline'}
                  onClick={() => user && toggleWishlist(card.id, user.id)}
                  disabled={!user}
                  className="flex-1 sm:flex-none">
                  <Heart className={`h-4 w-4 mr-2 ${owned?.isWishlisted ? 'fill-current' : ''}`} />
                  Wishlist
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {card.flavorText && (
          <div className="italic text-muted-foreground border-l-4 border-primary pl-4 py-1">
            "{card.flavorText}"
          </div>
        )}

        {/* Set & Artist */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-4">
              <img src={card.set.images.symbol} alt={card.set.name} className="w-8 h-8 object-contain" loading="lazy" decoding="async" />
              <div>
                <div className="font-semibold text-sm">Set</div>
                <div className="text-muted-foreground">{card.set.name}</div>
              </div>
            </CardContent>
          </Card>
          {card.artist && (
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="font-semibold text-sm">Illustrator</div>
                <div className="text-muted-foreground">{card.artist}</div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Variants & Pricing */}
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="font-semibold text-sm mb-3 text-green-700 dark:text-green-400">
              Variants &amp; Pricing
            </div>

            {allVariants.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">No pricing data available for this card.</p>

            ) : isSingleVariant ? (
              // Single-variant card (no standard key + only one non-std): treat as standard
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {nonStdVariants[0].label}
                    <span className="ml-1.5 text-xs">(standard printing)</span>
                  </span>
                  {nonStdVariants[0].price != null ? (
                    <span className="font-mono font-bold text-green-600 dark:text-green-400">
                      ${nonStdVariants[0].price.toFixed(2)} market
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">no price data</span>
                  )}
                </div>
                {effectiveTotalQty > 0 && nonStdVariants[0].price != null && (
                  <p className="text-xs text-muted-foreground">
                    {effectiveTotalQty} {effectiveTotalQty === 1 ? 'copy' : 'copies'} × ${nonStdVariants[0].price.toFixed(2)} ={' '}
                    <span className="font-mono font-semibold text-green-600 dark:text-green-400">
                      ${estimatedValue.toFixed(2)} est.
                    </span>
                  </p>
                )}
              </div>

            ) : nonStdVariants.length === 0 ? (
              // Has a standard printing only — no separate variants to show
              <p className="text-xs text-muted-foreground py-1">
                This card is only available as the Unlimited print.
                Use the ± buttons above to track your copies.
              </p>

            ) : (
              // Multi-variant: show non-standard variant tracker
              <div className="divide-y divide-border">
                {nonStdVariants.map(({ key, label, letter, price }) => {
                  const qty = variantMap[key] ?? 0;
                  return (
                    <div key={key} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="w-6 h-6 rounded-full bg-yellow-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm">
                        {letter}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm">{label}</span>
                        {price != null ? (
                          <span className="ml-2 text-sm font-mono text-green-600 dark:text-green-400">
                            ${price.toFixed(2)}
                          </span>
                        ) : (
                          <span className="ml-2 text-xs text-muted-foreground">no price data</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="outline" size="icon" className="h-7 w-7"
                          onClick={() => handleVariantChange(key, -1)} disabled={!user || qty === 0}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center font-mono text-sm font-bold tabular-nums">{qty}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7"
                          onClick={() => handleVariantChange(key, 1)} disabled={!user}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {/* Legacy variant rows no longer in current pricing data */}
                {Object.entries(variantMap)
                  .filter(([k, qty]) => qty > 0 && !allVariants.some((v) => v.key === k))
                  .map(([key, qty]) => (
                    <div key={key} className="flex items-center gap-3 py-2.5 border-t border-border">
                      <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                        {getVariantLetter(key)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm">{formatVariantName(key)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">(legacy)</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="outline" size="icon" className="h-7 w-7"
                          onClick={() => handleVariantChange(key, -1)} disabled={!user}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center font-mono text-sm font-bold tabular-nums">{qty}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7"
                          onClick={() => handleVariantChange(key, 1)} disabled={!user}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}

                {/* Summary row */}
                {Object.values(variantMap).some((v) => v > 0) && (
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {Object.values(variantMap).reduce((s, v) => s + v, 0)} variant copies tracked
                    </span>
                    {estimatedValue > 0 && (
                      <span className="font-mono font-bold text-green-600 dark:text-green-400">
                        ${estimatedValue.toFixed(2)} est.
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        {owned && (
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="font-semibold text-sm mb-2">Notes</div>
              <Textarea
                placeholder="Add notes about condition, purchase price, grading…"
                value={currentNotes}
                onChange={(e) => setNotesValue(e.target.value)}
                onBlur={handleNotesSave}
                rows={3}
                className="resize-none text-sm"
              />
              {notesValue !== null && notesValue !== (owned.notes ?? '') && (
                <p className="text-xs text-muted-foreground mt-1">Unsaved — click outside to save</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
