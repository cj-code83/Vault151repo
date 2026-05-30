import { memo, useState, useRef, useEffect } from 'react';
import { PokemonCard } from '@/types/pokemon';
import { useCollectionStore } from '@/store/collectionStore';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { getAvailableVariants, getStandardKeys, getVariantLetter } from '@/utils/variants';
import btnMinus from '@/assets/btn-minus.png';
import btnPlus  from '@/assets/btn-plus.png';

// ─── Energy type colours ──────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  Fire:       '#FF6B35',
  Water:      '#5DADE2',
  Grass:      '#52BE80',
  Lightning:  '#F4D03F',
  Psychic:    '#AF7AC5',
  Fighting:   '#CB4335',
  Colorless:  '#BDC3C7',
  Darkness:   '#1C2833',
  Metal:      '#808B96',
  Dragon:     '#6E2DC3',
  Fairy:      '#F48FB1',
};

// ─── Component ────────────────────────────────────────────────────────────

interface CardItemProps {
  card: PokemonCard;
}

export const CardItem = memo(function CardItem({ card }: CardItemProps) {
  const { user } = useAuth();
  const { collectionCards, addCard, removeCard, updateQuantity } = useCollectionStore();
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current?.complete) setImgLoaded(true);
  }, []);

  const owned      = user ? collectionCards[card.id] : null;
  const genericQty = owned?.quantity ?? 0;
  const variantMap = owned?.variants ?? {};
  const variantQty = Object.values(variantMap).reduce((s, v) => s + v, 0);
  const totalQty   = genericQty + variantQty;

  // Standard keys are resolved per-card: unlimited → holofoil → reverse holo
  const standardKeys      = getStandardKeys(card.tcgplayer?.prices);
  const availableVariants = getAvailableVariants(card.tcgplayer?.prices);
  const trackedVariantLetters = [
    ...new Set(
      Object.entries(variantMap)
        .filter(([k, qty]) => qty > 0 && !standardKeys.has(k))
        .map(([k]) => getVariantLetter(k))
    ),
  ].filter(() => availableVariants.some((v) => !standardKeys.has(v.key)))
   .slice(0, 4);

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    if (!owned) {
      await addCard(card, user.id);
    } else {
      await updateQuantity(card.id, genericQty + 1, user.id);
    }
  };

  const handleQuickRemove = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || !owned) return;
    if (genericQty === 1 && variantQty === 0 && !owned.isWishlisted) {
      await removeCard(card.id, user.id);
    } else if (genericQty > 0) {
      await updateQuantity(card.id, genericQty - 1, user.id);
    }
  };

  const canRemove = !!owned && genericQty > 0;

  return (
    <Link href={`/card/${card.id}`}>
      <motion.div
        whileHover={{ y: -4, scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="relative cursor-pointer"
      >
        {/* ── Card image ────────────────────────────────────────────── */}
        <Card className="overflow-hidden border-border bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-2 relative aspect-[63/88]">
            {/* Card-back gradient placeholder */}
            <div
              className={`absolute inset-2 rounded-sm transition-opacity duration-200 ${imgLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
              style={{
                background:
                  'linear-gradient(160deg, #1e3a8a 0%, #1e40af 40%, #2563eb 70%, #1d4ed8 100%)',
              }}
            />
            <img
              ref={imgRef}
              src={card.images.small}
              alt={card.name}
              className={`w-full h-full object-contain drop-shadow-md transition-opacity duration-200 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImgLoaded(true)}
            />
          </CardContent>
        </Card>

        {/* Blue quantity badge — top right */}
        {totalQty > 0 && (
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shadow-md z-10 font-mono select-none">
            {totalQty}
          </div>
        )}

        {/* Gold variant letter badges — non-standard variants */}
        {trackedVariantLetters.map((letter, i) => (
          <div
            key={letter + i}
            className="absolute -top-2 w-5 h-5 rounded-full bg-yellow-500 text-white text-[9px] font-bold flex items-center justify-center shadow-md z-10 select-none"
            style={{ left: `${-6 + i * 16}px` }}
          >
            {letter}
          </div>
        ))}

        {/* ── Info strip: type dots · pill buttons · card number ─────── */}
        <div className="mt-1.5 flex items-center justify-between gap-1 px-0.5">

          {/* Type colour dots */}
          <div className="flex items-center gap-1 h-6 shrink-0">
            {card.types?.map((type) => (
              <span
                key={type}
                className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                style={{ background: TYPE_COLORS[type] ?? '#BDC3C7' }}
                title={type}
              />
            ))}
            {(!card.types || card.types.length === 0) && (
              <span className="w-3.5 h-3.5 opacity-0" />
            )}
          </div>

          {/* Quick-action pill buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleQuickRemove}
              disabled={!canRemove}
              className={`flex items-center transition-all active:scale-95 ${canRemove ? '' : 'opacity-30 cursor-default'}`}
              aria-label="Remove one"
            >
              <img src={btnMinus} alt="-" className="h-6 w-auto object-contain" draggable={false} />
            </button>
            <button
              onClick={handleQuickAdd}
              disabled={!user}
              className={`flex items-center transition-all active:scale-95 ${user ? '' : 'opacity-30 cursor-default'}`}
              aria-label="Add one"
            >
              <img src={btnPlus} alt="+" className="h-6 w-auto object-contain" draggable={false} />
            </button>
          </div>

          {/* Card number */}
          <span className="text-[10px] text-muted-foreground font-mono leading-none shrink-0">
            #{card.number}
          </span>
        </div>
      </motion.div>
    </Link>
  );
});
