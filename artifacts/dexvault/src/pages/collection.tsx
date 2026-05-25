import { useState, useEffect } from 'react';
import { useCollectionStore } from '@/store/collectionStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { getCardsByIds } from '@/services/pokemonTcg';
import { CardItem } from '@/components/card-item';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearch } from 'wouter';

function variantTotal(variants?: Record<string, number>) {
  return Object.values(variants ?? {}).reduce((s, v) => s + v, 0);
}

function CardGrid({ ids, activeTab }: { ids: string[]; activeTab: string }) {
  const sortedKey = [...ids].sort().join(',');
  const { data: cards, isLoading } = useQuery({
    queryKey: ['collection-cards', activeTab, sortedKey],
    queryFn: () => getCardsByIds(ids),
    enabled: ids.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  if (ids.length === 0) return null;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {ids.map((id) => (
          <Skeleton key={id} className="aspect-[63/88] rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {(cards ?? []).map((card) => (
        <CardItem key={card.id} card={card} />
      ))}
    </div>
  );
}

export default function Collection() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const tabParam = params.get('tab');

  const validTabs = ['owned', 'wishlist', 'favourites'];
  const initialTab = validTabs.includes(tabParam ?? '') ? tabParam! : 'owned';

  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (validTabs.includes(tabParam ?? '')) {
      setActiveTab(tabParam!);
    }
  }, [tabParam]);

  const { collectionCards } = useCollectionStore();

  const ownedCards = Object.values(collectionCards).filter(
    (c) => (c.quantity > 0 || variantTotal(c.variants) > 0) && !c.isWishlisted
  );
  const wishlistedCards = Object.values(collectionCards).filter(
    (c) => c.isWishlisted && c.quantity === 0 && variantTotal(c.variants) === 0
  );
  const favouritedCards = Object.values(collectionCards).filter((c) => c.isFavorite);

  const ownedIds = ownedCards.map((c) => c.cardId);
  const wishlistIds = wishlistedCards.map((c) => c.cardId);
  const favouriteIds = favouritedCards.map((c) => c.cardId);

  const emptyMessage: Record<string, string> = {
    owned: 'Your collection is empty. Search for cards to add them.',
    wishlist: 'Your wishlist is empty.',
    favourites: 'No favourited cards yet. Star a card from its detail page.',
  };

  const activeIds =
    activeTab === 'owned' ? ownedIds :
    activeTab === 'wishlist' ? wishlistIds :
    favouriteIds;

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
      <div className="sticky top-16 md:top-0 z-20 bg-background -mx-4 md:-mx-8 px-4 md:px-8 pt-4 md:pt-8 pb-4 border-b border-border space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">My Collection</h1>
          <p className="text-muted-foreground">Your personal vault.</p>
        </div>
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="owned">Owned ({ownedCards.length})</TabsTrigger>
          <TabsTrigger value="wishlist">Wishlist ({wishlistedCards.length})</TabsTrigger>
          <TabsTrigger value="favourites">Favourites ({favouritedCards.length})</TabsTrigger>
        </TabsList>
      </div>

      <div className="pt-6">
        {(['owned', 'wishlist', 'favourites'] as const).map((tab) => {
          const ids =
            tab === 'owned' ? ownedIds :
            tab === 'wishlist' ? wishlistIds :
            favouriteIds;

          return (
            <TabsContent key={tab} value={tab} className="mt-0">
              {ids.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                  {emptyMessage[tab]}
                </div>
              ) : (
                <CardGrid ids={ids} activeTab={tab} />
              )}
            </TabsContent>
          );
        })}
      </div>
    </Tabs>
  );
}
