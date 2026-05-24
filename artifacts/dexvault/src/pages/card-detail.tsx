import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { getCard } from '@/services/pokemonTcg';
import { useCollectionStore } from '@/store/collectionStore';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Plus, Minus, Heart } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CardDetail() {
  const [, params] = useRoute('/card/:id');
  const cardId = params?.id;
  const { user } = useAuth();
  const { collectionCards, addCard, updateQuantity, toggleWishlist } = useCollectionStore();

  const { data: card, isLoading, isError } = useQuery({
    queryKey: ['card', cardId],
    queryFn: () => getCard(cardId!),
    enabled: !!cardId,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col md:flex-row gap-8">
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
    return <div className="text-destructive">Card not found</div>;
  }

  const owned = user ? collectionCards[card.id] : null;
  const quantity = owned?.quantity || 0;

  return (
    <div className="flex flex-col md:flex-row gap-8 animate-in fade-in duration-500">
      <div className="w-full md:w-1/3 lg:w-1/4 shrink-0 perspective-1000">
        <motion.div 
          className="relative rounded-2xl overflow-hidden shadow-2xl"
          whileHover={{ rotateY: 10, rotateX: 5, scale: 1.05 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <img src={card.images.large} alt={card.name} className="w-full h-auto drop-shadow-2xl" />
        </motion.div>
      </div>

      <div className="flex-1 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-muted-foreground font-mono text-sm">{card.set.id} • {card.number}/{card.set.printedTotal}</span>
            {card.rarity && <Badge variant="secondary" className="font-medium">{card.rarity}</Badge>}
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">{card.name}</h1>
          <p className="text-xl text-muted-foreground">{card.supertype} {card.subtypes?.join(' - ')}</p>
        </div>

        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="flex items-center">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => user && updateQuantity(card.id, Math.max(0, quantity - 1), user.id)}
                    disabled={!user || quantity === 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center font-bold font-mono text-xl">{quantity}</span>
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
                  variant={owned?.isWishlisted ? "default" : "outline"}
                  onClick={() => user && toggleWishlist(card.id, user.id)}
                  disabled={!user}
                  className="flex-1 sm:flex-none"
                >
                  <Heart className={`h-4 w-4 mr-2 ${owned?.isWishlisted ? "fill-current" : ""}`} />
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
        
        {card.tcgplayer?.prices && (
          <Card className="border-border border-green-500/20 bg-green-500/5">
            <CardContent className="p-4">
              <div className="font-semibold text-sm mb-2 text-green-700 dark:text-green-400">Market Price</div>
              <div className="text-2xl font-bold font-mono">
                ${card.tcgplayer.prices.holofoil?.market || card.tcgplayer.prices.normal?.market || card.tcgplayer.prices['1stEditionHolofoil']?.market || '--'}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
