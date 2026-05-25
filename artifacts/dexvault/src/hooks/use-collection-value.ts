import { useQueries } from '@tanstack/react-query';
import { getCard } from '@/services/pokemonTcg';
import { useCollectionStore } from '@/store/collectionStore';

export function useCollectionValue() {
  const collectionCards = useCollectionStore((s) => s.collectionCards);

  const ownedCards = Object.values(collectionCards).filter((c) => {
    const variantTotal = Object.values(c.variants ?? {}).reduce((s, v) => s + v, 0);
    return (c.quantity > 0 || variantTotal > 0) && !c.isWishlisted;
  });
  const cardIds = ownedCards.map((c) => c.cardId);

  const queries = useQueries({
    queries: cardIds.map((id) => ({
      queryKey: ['card-price', id],
      queryFn: () => getCard(id),
      staleTime: 1000 * 60 * 60 * 24,
    })),
  });

  const isLoading = cardIds.length > 0 && queries.some((q) => q.isPending);
  const allCards = queries.flatMap((q) => (q.data ? [q.data] : []));

  let totalValue = 0;
  for (const card of allCards) {
    const owned = collectionCards[card.id];
    if (!owned || owned.isWishlisted) continue;

    const prices = card.tcgplayer?.prices;
    if (!prices) continue;

    const bestMarket = Object.values(prices).reduce((best, v) => {
      const price = v.market ?? v.mid ?? 0;
      return price > best ? price : best;
    }, 0);

    if (owned.quantity > 0) {
      totalValue += bestMarket * owned.quantity;
    }

    const variantMap = owned.variants ?? {};
    for (const [key, qty] of Object.entries(variantMap)) {
      if (qty <= 0) continue;
      const variantPrice = prices[key]?.market ?? prices[key]?.mid ?? bestMarket;
      totalValue += variantPrice * qty;
    }
  }

  const hasData = allCards.length > 0;

  return { totalValue, isLoading, hasData };
}
