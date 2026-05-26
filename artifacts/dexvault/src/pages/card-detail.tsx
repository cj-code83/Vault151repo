import { useState } from 'react';
import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
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
import { PRESET_VARIANTS, getPresetPrice, getVariantLetter } from '@/utils/variants';

export default function CardDetail() {
  const [, params] = useRoute('/card/:id');
  const cardId = params?.id;
  const { user } = useAuth();
  const {
    collectionCards,
    addCard,
    updateQuantity,
    toggleFavorite,
    toggleWishlist,
    updateVariants,
    updateNotes,
  } = useCollectionStore();

  const [notesValue, setNotesValue] = useState<string | null>(null);

  const { data: card, isLoading, isError } = useQuery({
    queryKey: ['card', cardId],
    queryFn: () => getCard(cardId!),
    enabled: !!cardId,
  });

  if (isLoading) {
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

  if (isError || !card) {
    return <div className="text-destructive pt-4">Card not found</div>;
  }

  const owned = user ? collectionCards[card.id] : null;
  const genericQty = owned?.quantity || 0;
  const variantMap = owned?.variants ?? {};
  const totalQty =
    genericQty + Object.values(variantMap).reduce((s, v) => s + v, 0);

  const currentNotes = notesValue ?? owned?.notes ?? '';

  const handleVariantChange = async (key: string, delta: number) => {
    if (!user) return;
    const current = variantMap[key] ?? 0;
    const newQty = Math.max(0, current + delta);
    const newVariants = { ...variantMap, [key]: newQty };
    if (newQty === 0) delete newVariants[key];
    await updateVariants(card.id, newVariants, user.id, card);
  };

  const handleNotesSave = async () => {
    if (!user || !owned || notesValue === null) return;
    await updateNotes(card.id, notesValue, user.id);
  };

  const prices = card.tcgplayer?.prices ?? {};

  const trackedVariantLetters = [
    ...new Set(
      Object.entries(variantMap)
        .filter(([, qty]) => qty > 0)
        .map(([key]) => getVariantLetter(key))
    ),
  ];

  return (
    <div className="flex flex-col md:flex-row gap-8 pt-4 md:pt-8 animate-in fade-in duration-500">
      <div className="w-full md:w-1/3 lg:w-1/4 shrink-0">
        <div className="relative w-fit">
          <motion.div
            className="relative rounded-2xl overflow-hidden shadow-2xl"
            whileHover={{ rotateY: 10, rotateX: 5, scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <img src={card.images.large} alt={card.name} className="w-full h-auto drop-shadow-2xl" />
          </motion.div>

          {/* Variant letter badges on detail image */}
          {trackedVariantLetters.length > 0 && (
            <div className="absolute -top-2 -left-2 flex gap-1">
              {trackedVariantLetters.map((letter, i) => (
                <div
                  key={letter + i}
                  className="w-6 h-6 rounded-full bg-yellow-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md"
                >
                  {letter}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-muted-foreground font-mono text-sm">
              {card.set.id} • {card.number}
              {card.set.printedTotal ? `/${card.set.printedTotal}` : ''}
            </span>
            {card.rarity && (
              <Badge variant="secondary" className="font-medium">
                {card.rarity}
              </Badge>
            )}
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">{card.name}</h1>
          <p className="text-xl text-muted-foreground">
            {card.supertype} {card.subtypes?.join(' - ')}
          </p>
        </div>

        {/* Collection controls */}
        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="flex items-center">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      user && updateQuantity(card.id, Math.max(0, genericQty - 1), user.id)
                    }
                    disabled={!user || genericQty === 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center font-bold font-mono text-xl">{totalQty}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => user && addCard(card, user.id)}
                    disabled={!user}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">In Collection</div>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant={owned?.isFavorite ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => user && owned && toggleFavorite(card.id, user.id)}
                  disabled={!user || !owned}
                  title={owned?.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
                >
                  <Star className={`h-5 w-5 ${owned?.isFavorite ? 'fill-current' : ''}`} />
                </Button>
                <Button
                  variant={owned?.isWishlisted ? 'default' : 'outline'}
                  onClick={() => user && toggleWishlist(card.id, user.id)}
                  disabled={!user}
                  className="flex-1 sm:flex-none"
                >
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
              <img src={card.set.images.symbol} alt={card.set.name} className="w-8 h-8 object-contain" />
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

        {/* Variants & Pricing — preset list */}
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="font-semibold text-sm mb-3 text-green-700 dark:text-green-400">
              Variants &amp; Pricing
            </div>
            <div className="divide-y divide-border">
              {PRESET_VARIANTS.map(({ key, label, letter }) => {
                const qty = variantMap[key] ?? 0;
                const price = getPresetPrice(key, prices);
                return (
                  <div key={key} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    {/* Letter badge */}
                    <div className="w-6 h-6 rounded-full bg-yellow-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm">
                      {letter}
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm">{label}</span>
                      {key !== 'promo_stamped' && price != null ? (
                        <span className="ml-2 text-sm font-mono text-green-600 dark:text-green-400">
                          ${price.toFixed(2)}
                        </span>
                      ) : key !== 'promo_stamped' ? (
                        <span className="ml-2 text-xs text-muted-foreground">no price data</span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleVariantChange(key, -1)}
                        disabled={!user || qty === 0}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center font-mono text-sm font-bold tabular-nums">
                        {qty}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleVariantChange(key, 1)}
                        disabled={!user}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Variant totals */}
            {Object.values(variantMap).some((v) => v > 0) && (
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {Object.values(variantMap).reduce((s, v) => s + v, 0)} variant copies tracked
                </span>
                {(() => {
                  const val = Object.entries(variantMap).reduce((s, [k, q]) => {
                    const p = getPresetPrice(k, prices) ?? 0;
                    return s + p * q;
                  }, 0);
                  return val > 0 ? (
                    <span className="font-mono font-bold text-green-600 dark:text-green-400">
                      ${val.toFixed(2)} est.
                    </span>
                  ) : null;
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes — only when card is in collection/wishlist/favourites */}
        {owned && (
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="font-semibold text-sm mb-2">Notes</div>
              <Textarea
                placeholder="Add notes about condition, features, purchase price, grading…"
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
