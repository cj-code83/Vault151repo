import { useQueries } from '@tanstack/react-query';
import { getCardsByIds } from '@/services/pokemonTcg';
import { CollectionCard } from '@/types/pokemon';

function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}

export function useCollectionValue(collectionCards: Record<string, CollectionCard>) {
  const ownedCards = Object.values(collectionCards).filter(
    (c) => c.quantity > 0 && !c.isWishlisted
  );
  const cardIds = ownedCards.map((c) => c.cardId);
  const batches = chunk(cardIds, 20);

  const queries = useQueries({
    queries: batches.map((batch) => ({
      queryKey: ['card-prices', [...batch].sort().join(',')],
      queryFn: () => getCardsByIds(batch),
      staleTime: 1000 * 60 * 60 * 24,
      enabled: batch.length > 0,
    })),
  });

  const isLoading = cardIds.length > 0 && queries.some((q) => q.isLoading);
  const allCards = queries.flatMap((q) => q.data ?? []);

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
