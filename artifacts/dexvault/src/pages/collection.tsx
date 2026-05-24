import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useCollectionStore } from '@/store/collectionStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { getCardsByIds } from '@/services/pokemonTcg';
import { CardItem } from '@/components/card-item';
import { Skeleton } from '@/components/ui/skeleton';

export default function Collection() {
  const { user } = useAuth();
  const { collectionCards } = useCollectionStore();
  const [activeTab, setActiveTab] = useState('owned');

  const ownedCards = Object.values(collectionCards).filter(c => c.quantity > 0);
  const wishlistedCards = Object.values(collectionCards).filter(c => c.isWishlisted && c.quantity === 0);

  const ownedIds = ownedCards.map(c => c.cardId);
  const wishlistIds = wishlistedCards.map(c => c.cardId);

  const activeIds = activeTab === 'owned' ? ownedIds : wishlistIds;
  const sortedKey = [...activeIds].sort().join(',');

  const { data: cards, isLoading } = useQuery({
    queryKey: ['collection-cards', activeTab, sortedKey],
    queryFn: () => getCardsByIds(activeIds),
    enabled: activeIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  const displayCards = cards ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">My Collection</h1>
        <p className="text-muted-foreground">Your personal vault.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="owned">Owned ({ownedCards.length})</TabsTrigger>
          <TabsTrigger value="wishlist">Wishlist ({wishlistedCards.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="owned" className="mt-6">
          {ownedCards.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
              Your collection is empty. Search for cards to add them.
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {ownedIds.map((id) => (
                <Skeleton key={id} className="aspect-[63/88] rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {displayCards.map((card) => (
                <CardItem key={card.id} card={card} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="wishlist" className="mt-6">
          {wishlistedCards.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
              Your wishlist is empty.
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {wishlistIds.map((id) => (
                <Skeleton key={id} className="aspect-[63/88] rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {displayCards.map((card) => (
                <CardItem key={card.id} card={card} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
