import { PokemonCard, PokemonSet } from '../types/pokemon';

const BASE_URL = 'https://api.pokemontcg.io/v2';
const API_KEY = import.meta.env.VITE_POKEMON_TCG_API_KEY || '';

function headers(): Record<string, string> {
  return API_KEY ? { 'X-Api-Key': API_KEY } : {};
}

export async function searchCards(params: {
  name?: string;
  set?: string;
  rarity?: string;
  types?: string;
  illustrator?: string;
  number?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const queryParts: string[] = [];
  if (params.q) queryParts.push(params.q);
  if (params.name) queryParts.push(`name:"*${params.name}*"`);
  if (params.set) queryParts.push(`set.name:"*${params.set}*"`);
  if (params.rarity) queryParts.push(`rarity:"${params.rarity}"`);
  if (params.types) queryParts.push(`types:${params.types}`);
  if (params.illustrator) queryParts.push(`artist:"*${params.illustrator}*"`);
  if (params.number) queryParts.push(`number:${params.number}`);

  const query = queryParts.length ? queryParts.join(' ') : 'name:*';
  const url = new URL(`${BASE_URL}/cards`);
  url.searchParams.set('q', query);
  url.searchParams.set('page', String(params.page ?? 1));
  url.searchParams.set('pageSize', String(params.pageSize ?? 20));

  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) throw new Error('PokémonTCG API error');
  return res.json() as Promise<{ data: PokemonCard[]; totalCount: number; page: number; pageSize: number }>;
}

export async function getCard(id: string) {
  const res = await fetch(`${BASE_URL}/cards/${id}`, { headers: headers() });
  if (!res.ok) throw new Error('Card not found');
  const json = await res.json();
  return json.data as PokemonCard;
}

export async function getCardsByIds(ids: string[]): Promise<PokemonCard[]> {
  if (!ids.length) return [];
  const q = ids.map((id) => `id:${id}`).join(' OR ');
  const url = new URL(`${BASE_URL}/cards`);
  url.searchParams.set('q', q);
  url.searchParams.set('pageSize', String(Math.min(ids.length, 250)));
  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) return [];
  const json = await res.json();
  return json.data as PokemonCard[];
}

export async function getSets() {
  const res = await fetch(`${BASE_URL}/sets?orderBy=-releaseDate`, { headers: headers() });
  if (!res.ok) throw new Error('Could not fetch sets');
  const json = await res.json();
  return json.data as PokemonSet[];
}

export async function getTrendingCards(): Promise<PokemonCard[]> {
  // Fetch high-rarity cards from recent sets — the most sought-after market cards
  const url = new URL(`${BASE_URL}/cards`);
  url.searchParams.set(
    'q',
    'rarity:"Special Illustration Rare" OR rarity:"Hyper Rare" OR rarity:"Secret Rare"'
  );
  url.searchParams.set('orderBy', '-set.releaseDate');
  url.searchParams.set('pageSize', '20');

  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) {
    // Fallback: recent Pokémon cards
    const fb = new URL(`${BASE_URL}/cards`);
    fb.searchParams.set('q', 'supertype:Pokémon rarity:"Rare Holo"');
    fb.searchParams.set('orderBy', '-set.releaseDate');
    fb.searchParams.set('pageSize', '20');
    const r = await fetch(fb.toString(), { headers: headers() });
    const j = await r.json();
    return j.data as PokemonCard[];
  }
  const json = await res.json();
  return json.data as PokemonCard[];
}
