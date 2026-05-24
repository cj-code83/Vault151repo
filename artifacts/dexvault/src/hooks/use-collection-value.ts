import { useQueries } from '@tanstack/react-query';
import { getCard } from '@/services/pokemonTcg';
import { CollectionCard } from '@/types/pokemon';

export function useCollectionValue(collectionCards: Record<string, CollectionCard>) {
  const ownedCards = Object.values(collectionCards).filter(
    (c) => c.quantity > 0 && !c.isWishlisted
  );
  const cardIds = ownedCards.map((c) => c.cardId);

  const queries = useQueries({
    queries: cardIds.map((id) => ({
      queryKey: ['card-price', id],
      queryFn: () => getCard(id),
      staleTime: 1000 * 60 * 60 * 24,
      enabled: true,
    })),
  });

  const isLoading = cardIds.length > 0 && queries.some((q) => q.isPending);
  const allCards = queries.flatMap((q) => (q.data ? [q.data] : []));

  let totalValue = 0;
  for (const card of allCards) {
    const owned = collectionCards[card.id];
    if (!owned || owned.quantity <= 0 || owned.isWishlisted) continue;
    const prices = card.tcgplayer?.prices;
    if (!prices) continue;
    const bestMarket = Object.values(prices).reduce((best, v) => {
      const price = v.market ?? v.mid ?? 0;
      return price > best ? price : best;
    }, 0);
    totalValue += bestMarket * owned.quantity;
  }

  const hasData = allCards.length > 0;

  return { totalValue, isLoading, hasData };
}
