import { memo, useState, useRef, useEffect } from 'react';
import { PokemonCard } from '@/types/pokemon';
import { useCollectionStore } from '@/store/collectionStore';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { getAvailableVariants, getVariantLetter } from '@/utils/variants';

const STANDARD_KEYS = new Set(['normal', 'unlimitedNormal']);

interface CardItemProps {
  card: PokemonCard;
}

export const CardItem = memo(function CardItem({ card }: CardItemProps) {
  const { user } = useAuth();
  const { collectionCards, addCard, updateQuantity, removeCard } = useCollectionStore();

  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Images already in the browser cache complete synchronously before first paint
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setImgLoaded(true);
    }
  }, [card.images.small]);

  const owned      = user ? collectionCards[card.id] : null;
  const genericQty = owned?.quantity || 0;
  const variantMap = owned?.variants ?? {};
  const variantQty = Object.values(variantMap).reduce((s, v) => s + v, 0);
  const totalQty   = genericQty + variantQty;

  const availableVariants = getAvailableVariants(card.tcgplayer?.prices);

  // Only show letter badges for non-standard variant tracking
  const trackedVariantLetters = [
    ...new Set(
      Object.entries(variantMap)
        .filter(([k, qty]) => qty > 0 && !STANDARD_KEYS.has(k))
        .map(([k]) => getVariantLetter(k))
    ),
  ].filter(() => availableVariants.some((v) => !STANDARD_KEYS.has(v.key)))
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

  return (
    <Link href={`/card/${card.id}`}>
      <motion.div
        whileHover={{ y: -4, scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="group relative cursor-pointer"
      >
        <Card className="overflow-hidden border-border bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-2 relative aspect-[63/88]">
            {/*
              Card-back gradient placeholder — renders at zero cost, zero latency.
              Stays visible until the image fully loads, then fades away.
            */}
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
          <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shadow-md z-10 font-mono select-none">
            {totalQty}
          </div>
        )}

        {/* Gold variant letter badges — non-standard variants only */}
        {trackedVariantLetters.map((letter, i) => (
          <div
            key={letter + i}
            className="absolute -top-2 w-6 h-6 rounded-full bg-yellow-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md z-10 select-none"
            style={{ left: `${-8 + i * 18}px` }}
          >
            {letter}
          </div>
        ))}

        {/* Green + quick-add */}
        <button
          onClick={handleQuickAdd}
          className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center shadow-md z-10 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Quick add"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Red − quick-remove */}
        {genericQty > 0 && (
          <button
            onClick={handleQuickRemove}
            className="absolute -bottom-2 -left-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md z-10 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Quick remove"
          >
            <Minus className="w-4 h-4" />
          </button>
        )}
      </motion.div>
    </Link>
  );
});
