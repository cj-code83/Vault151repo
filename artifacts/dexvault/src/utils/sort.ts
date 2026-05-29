import { PokemonCard } from '@/types/pokemon';

export type SortOrder = 'number' | 'alpha' | 'value-desc';

export const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'number',     label: '# Number'   },
  { value: 'alpha',      label: 'A → Z'      },
  { value: 'value-desc', label: '$ Value ↓'  },
];

/** Highest market (or mid) price across all variants. */
function getCardValue(card: PokemonCard): number {
  return Object.values(card.tcgplayer?.prices ?? {}).reduce<number>((max, p) => {
    const v = p.market ?? p.mid ?? 0;
    return v > max ? v : max;
  }, 0);
}

/** Returns a new sorted array — does not mutate the input. */
export function sortCards(cards: PokemonCard[], order: SortOrder): PokemonCard[] {
  const arr = [...cards];
  switch (order) {
    case 'alpha':
      return arr.sort((a, b) => a.name.localeCompare(b.name));
    case 'value-desc':
      return arr.sort((a, b) => getCardValue(b) - getCardValue(a));
    case 'number':
    default:
      return arr.sort((a, b) => {
        const na = parseInt(a.number, 10);
        const nb = parseInt(b.number, 10);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        if (!isNaN(na)) return -1;
        if (!isNaN(nb)) return 1;
        return a.number.localeCompare(b.number);
      });
  }
}
