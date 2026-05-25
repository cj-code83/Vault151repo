export interface PokemonCard {
  id: string;
  name: string;
  supertype: string;
  subtypes: string[];
  hp?: string;
  types?: string[];
  number: string;
  artist?: string;
  rarity?: string;
  flavorText?: string;
  images: { small: string; large: string };
  set: { id: string; name: string; series: string; releaseDate: string; printedTotal?: number; images: { symbol: string; logo: string } };
  tcgplayer?: { prices?: Record<string, { market?: number; mid?: number }> };
}

export interface PokemonSet {
  id: string;
  name: string;
  series: string;
  releaseDate: string;
  printedTotal: number;
  total: number;
  images: { symbol: string; logo: string };
}

export interface CollectionCard {
  id: string;
  userId: string;
  cardId: string;
  quantity: number;
  condition: string;
  isFavorite: boolean;
  isWishlisted: boolean;
  notes?: string;
  createdAt: string;
  variants?: Record<string, number>;
}
