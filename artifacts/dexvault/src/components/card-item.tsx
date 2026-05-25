import { useState } from 'react';
import { PokemonCard } from '@/types/pokemon';
import { useCollectionStore } from '@/store/collectionStore';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Check, Minus, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import { VariantSheet } from './variant-sheet';

interface CardItemProps {
  card: PokemonCard;
}

export function CardItem({ card }: CardItemProps) {
  const { user } = useAuth();
  const { collectionCards, addCard, updateQuantity, removeCard } = useCollectionStore();
  const [justAdded, setJustAdded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const owned = user ? collectionCards[card.id] : null;
  const genericQty = owned?.quantity || 0;
  const variantQty = Object.values(owned?.variants ?? {}).reduce((s, v) => s + v, 0);
  const totalQty = genericQty + variantQty;

  const hasVariants = Object.keys(card.tcgplayer?.prices ?? {}).length > 0;

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    await addCard(card, user.id);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  };

  const handleIncrement = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || !owned) return;
    await updateQuantity(card.id, genericQty + 1, user.id);
  };

  const handleDecrement = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || !owned) return;
    if (genericQty === 1 && variantQty === 0 && !owned.isWishlisted) {
      await removeCard(card.id, user.id);
    } else {
      await updateQuantity(card.id, Math.max(0, genericQty - 1), user.id);
    }
  };

  const handleVariants = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSheetOpen(true);
  };

  return (
    <>
      <Link href={`/card/${card.id}`}>
        <motion.div
          whileHover={{ y: -4, scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="group relative cursor-pointer"
        >
          <Card className="overflow-hidden border-border bg-card shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-2 relative aspect-[63/88]">
              <img
                src={card.images.small}
                alt={card.name}
                className="w-full h-full object-contain drop-shadow-md"
                loading="lazy"
              />

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                {/* Top row: variants button */}
                {hasVariants && (
                  <div className="flex justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 text-xs font-semibold px-2 gap-1"
                      onClick={handleVariants}
                    >
                      <Layers className="w-3 h-3" />
                      Variants
                    </Button>
                  </div>
                )}

                {/* Bottom row: qty controls */}
                <div>
                  {genericQty > 0 ? (
                    <div className="flex items-center justify-between bg-background/90 backdrop-blur rounded-md p-1 border border-border">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDecrement}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="font-bold font-mono px-2">{genericQty}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleIncrement}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="w-full font-bold shadow-lg"
                      variant={justAdded ? 'secondary' : 'default'}
                      onClick={handleAdd}
                    >
                      <AnimatePresence mode="wait">
                        {justAdded ? (
                          <motion.div
                            key="check"
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            className="flex items-center text-green-500"
                          >
                            <Check className="w-5 h-5 mr-2" /> Added
                          </motion.div>
                        ) : (
                          <motion.div
                            key="add"
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            className="flex items-center"
                          >
                            <Plus className="w-4 h-4 mr-2" /> Quick Add
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total quantity badge */}
          {totalQty > 0 && (
            <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full shadow-md z-10 font-mono">
              {totalQty}
            </div>
          )}

          {/* Variant indicator dot */}
          {variantQty > 0 && (
            <div className="absolute -top-2 -left-2 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md z-10">
              <Layers className="w-2.5 h-2.5" />
            </div>
          )}
        </motion.div>
      </Link>

      <VariantSheet card={card} open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  );
}
