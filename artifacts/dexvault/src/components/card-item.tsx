import { useState } from 'react';
import { PokemonCard } from '@/types/pokemon';
import { useCollectionStore } from '@/store/collectionStore';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Check, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';

interface CardItemProps {
  card: PokemonCard;
}

export function CardItem({ card }: CardItemProps) {
  const { user } = useAuth();
  const { collectionCards, addCard, updateQuantity, removeCard } = useCollectionStore();
  const [justAdded, setJustAdded] = useState(false);

  const owned = user ? collectionCards[card.id] : null;
  const quantity = owned?.quantity || 0;

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
    await updateQuantity(card.id, quantity + 1, user.id);
  };

  const handleDecrement = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || !owned) return;
    if (quantity === 1 && !owned.isWishlisted) {
      await removeCard(card.id, user.id);
    } else {
      await updateQuantity(card.id, Math.max(0, quantity - 1), user.id);
    }
  };

  return (
    <Link href={`/card/${card.id}`}>
      <motion.div 
        whileHover={{ y: -4, scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
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
            
            {/* Overlay quick add */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
              {quantity > 0 ? (
                <div className="flex items-center justify-between bg-background/90 backdrop-blur rounded-md p-1 border border-border">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDecrement}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="font-bold font-mono px-2">{quantity}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleIncrement}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button 
                  className="w-full font-bold shadow-lg" 
                  variant={justAdded ? "secondary" : "default"}
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
          </CardContent>
        </Card>
        {quantity > 0 && (
          <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full shadow-md z-10 font-mono">
            {quantity}
          </div>
        )}
      </motion.div>
    </Link>
  );
}
