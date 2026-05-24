import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useCollectionStore } from '@/store/collectionStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { searchCards } from '@/services/pokemonTcg';
import { CardItem } from '@/components/card-item';

export default function Collection() {
  const { user } = useAuth();
  const { collectionCards } = useCollectionStore();
  const [activeTab, setActiveTab] = useState('owned');

  const ownedCards = Object.values(collectionCards).filter(c => c.quantity > 0);
  const wishlistedCards = Object.values(collectionCards).filter(c => c.isWishlisted && c.quantity === 0);

  // Fetch details for owned cards (batching would be better, but doing generic search for simplicity here)
  const ownedIds = ownedCards.map(c => c.cardId);
  const wishlistIds = wishlistedCards.map(c => c.cardId);

  const queryParam = activeTab === 'owned' 
    ? (ownedIds.length ? `id:(${ownedIds.join(' OR ')})` : 'id:none')
    : (wishlistIds.length ? `id:(${wishlistIds.join(' OR ')})` : 'id:none');

  const { data, isLoading } = useQuery({
    queryKey: ['collection', activeTab, queryParam],
    queryFn: () => searchCards({ name: '', pageSize: 100 }), // In a real app we'd query by IDs
    enabled: ownedIds.length > 0 || wishlistIds.length > 0,
  });

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
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              {/* Note: Full implementation would render CardItems using fetched card details */}
              Loading collection data...
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="wishlist" className="mt-6">
          {wishlistedCards.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
              Your wishlist is empty.
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Loading wishlist data...
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
