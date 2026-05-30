import { useState, useMemo } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCard } from '@/services/pokemonTcg';
import { useCollectionStore } from '@/store/collectionStore';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, Minus, Plus, Star, Heart, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { getAvailableVariants, getVariantLetter, formatVariantName } from '@/utils/variants';
import { PokemonCard } from '@/types/pokemon';

// ─── Standard vs variant keys ─────────────────────────────────────────────
// "Unlimited" (normal) is the standard printing. It is counted by the main
// ± buttons, priced in the estimated-value header, and never shown in the
// variant picker. Everything else (holofoil, reverse holo, 1st Edition …)
// is a true variant and is tracked separately.
// "unlimited" (no suffix) is used by some older sets (e.g. Base Set 2).
const STANDARD_KEYS = new Set(['normal', 'unlimitedNormal', 'unlimited']);

// ─── Find card in React Query in-memory cache ─────────────────────────────
// Checks every cached search/set/collection/trending query so that navigating
// from any grid page gives an instant render with no extra network call.
function findCachedCard(qc: ReturnType<typeof useQueryClient>, id: string): PokemonCard | undefined {
  const direct = qc.getQueryData<PokemonCard>(['card', id]);
  if (direct) return direct;

  for (const [, res] of qc.getQueriesData<{ data: PokemonCard[] }>({ queryKey: ['cards'] })) {
    const found = res?.data?.find((c) => c.id === id);
    if (found) return found;
  }

  for (const [, res] of qc.getQueriesData<{ data: PokemonCard[] }>({ queryKey: ['set-cards-all'] })) {
    const found = res?.data?.find((c) => c.id === id);
    if (found) return found;
  }

  for (const [, cards] of qc.getQueriesData<PokemonCard[]>({ queryKey: ['collection-cards'] })) {
    const found = cards?.find((c) => c.id === id);
    if (found) return found;
  }

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

  const standardValue = standardVariant
    ? genericQty * (standardVariant.price ?? 0)
    : 0;

  const variantValue = nonStandard.reduce(
    (sum, v) => sum + (variantMap[v.key] ?? 0) * (v.price ?? 0),
    0,
  );

  // Single-variant card with no standard key: that one variant IS the standard.
  if (!standardVariant && nonStandard.length === 1) {
    const sv = nonStandard[0];
    const svQty = variantMap[sv.key] ?? 0;
    return { total: (genericQty + svQty) * (sv.price ?? 0), untrackedGeneric: 0 };
  }

  const untrackedGeneric =
    !standardVariant && nonStandard.length > 1 && genericQty > 0 ? genericQty : 0;

  return { total: standardValue + variantValue, untrackedGeneric };
}

// ─── Component ────────────────────────────────────────────────────────────

export default function CardDetail() {
  const [, params]     = useRoute('/card/:id');
  const [, setLocation] = useLocation();
  const cardId = params?.id;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    collectionCards, addCard, removeCard, updateQuantity, toggleFavorite,
    toggleWishlist, updateVariants, updateNotes,
  } = useCollectionStore();

  const [notesValue, setNotesValue]     = useState<string | null>(null);
  const [largeLoaded, setLargeLoaded]   = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const cachedCard = useMemo(
    () => (cardId ? findCachedCard(queryClient, cardId) : undefined),
    [queryClient, cardId],
  );

  const { data: card, isLoading } = useQuery({
    queryKey: ['card', cardId],
    queryFn: () => getCard(cardId!),
    enabled: !!cardId,
    staleTime: 24 * 60 * 60 * 1000,
    placeholderData: cachedCard,
  });

  // ── Back navigation ───────────────────────────────────────────────────
  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setLocation('/sets');
    }
  };

  // ── Remove from collection ────────────────────────────────────────────
  const handleRemove = async () => {
    if (!user || !card) return;
    await removeCard(card.id, user.id);
    handleBack();
  };

  if (isLoading && !card) {
    return (
      <div className="flex flex-col gap-8 pt-4 md:pt-8">
        <Skeleton className="h-8 w-24" />
        <div className="flex flex-col md:flex-row gap-8">
          <Skeleton className="aspect-[63/88] rounded-2xl w-full md:w-1/3" />
          <div className="flex-1 space-y-4">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-32 w-full" />
          </div>
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

  const isSingleVariant  = !standardVariant && nonStdVariants.length === 1;

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

  const trackedVariantLetters = [
    ...new Set(
      Object.entries(variantMap)
        .filter(([k, qty]) => qty > 0 && !STANDARD_KEYS.has(k))
        .map(([k]) => getVariantLetter(k))
    ),
  ];

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">

      {/* ── Back button ── */}
      <button
        onClick={handleBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit -mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      <div className="flex flex-col md:flex-row gap-8">

        {/* ── Card image ── */}
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

              {/* Remove from collection — shown when the card is tracked */}
              {owned && (
                <div className="mt-4 pt-4 border-t border-border flex items-center gap-3">
                  {confirmRemove ? (
                    <>
                      <p className="text-sm text-destructive flex-1">Remove this card from your collection?</p>
                      <Button size="sm" variant="destructive" onClick={handleRemove}>
                        Yes, remove
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmRemove(true)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove from collection
                    </button>
                  )}
                </div>
              )}
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
                <p className="text-xs text-muted-foreground py-1">
                  This card is only available as the Unlimited print.
                  Use the ± buttons above to track your copies.
                </p>

              ) : (
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

                  {/* Legacy variant rows: keys still in the DB but no longer in current pricing data */}
                  {Object.entries(variantMap)
                    .filter(([k, qty]) => qty > 0 && !allVariants.some((v) => v.key === k))
                    .map(([key, qty]) => (
                      <div key={key} className="flex items-center gap-3 py-2.5 border-t border-border">
                        <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                          {getVariantLetter(key)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm">{formatVariantName(key)}</span>
                          <span className="ml-2 text-xs text-muted-foreground">(legacy — no longer in pricing data)</span>
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
    </div>
  );
}
