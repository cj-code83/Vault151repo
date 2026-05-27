import { PokemonCard, PokemonSet } from '../types/pokemon';
import { supabase } from '../lib/supabase';

const BASE_URL = 'https://api.pokemontcg.io/v2';
const API_KEY = import.meta.env.VITE_POKEMON_TCG_API_KEY || '';

const CARD_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function headers(): Record<string, string> {
  return API_KEY ? { 'X-Api-Key': API_KEY } : {};
}

// ─── Supabase card cache ──────────────────────────────────────────────────

async function readCardFromCache(id: string): Promise<PokemonCard | null> {
  try {
    const cutoff = new Date(Date.now() - CARD_CACHE_TTL_MS).toISOString();
    const { data } = await supabase
      .from('card_cache')
      .select('data')
      .eq('card_id', id)
      .gte('cached_at', cutoff)
      .maybeSingle();
    return (data?.data as PokemonCard) ?? null;
  } catch {
    return null;
  }
}

function writeCardToCache(card: PokemonCard): void {
  supabase
    .from('card_cache')
    .upsert(
      { card_id: card.id, data: card as unknown as Record<string, unknown>, cached_at: new Date().toISOString() },
      { onConflict: 'card_id' }
    )
    .then();
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function searchCards(params: {
  name?: string;
  /** Exact set ID, e.g. "sv3" or "base1". Preferred over `set` for precision. */
  setId?: string;
  /** Fuzzy set name match (fallback when setId not available). */
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
  if (params.q)           queryParts.push(params.q);
  if (params.name)        queryParts.push(`name:"*${params.name}*"`);
  if (params.setId)       queryParts.push(`set.id:${params.setId}`);
  else if (params.set)    queryParts.push(`set.name:"*${params.set}*"`);
  if (params.rarity)      queryParts.push(`rarity:"${params.rarity}"`);
  if (params.types)       queryParts.push(`types:${params.types}`);
  if (params.illustrator) queryParts.push(`artist:"*${params.illustrator}*"`);
  if (params.number)      queryParts.push(`number:${params.number}`);

  const query = queryParts.length ? queryParts.join(' ') : 'name:*';
  const url = new URL(`${BASE_URL}/cards`);
  url.searchParams.set('q', query);
  url.searchParams.set('page', String(params.page ?? 1));
  url.searchParams.set('pageSize', String(params.pageSize ?? 20));

  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) throw new Error('PokémonTCG API error');
  return res.json() as Promise<{ data: PokemonCard[]; totalCount: number; page: number; pageSize: number }>;
}

export async function getCard(id: string): Promise<PokemonCard> {
  // Race the Supabase cache against a 250 ms timeout so a slow DB never
  // blocks the card detail page from loading.
  const cached = await Promise.race([
    readCardFromCache(id),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 250)),
  ]);
  if (cached) return cached;

  const res = await fetch(`${BASE_URL}/cards/${id}`, { headers: headers() });
  if (!res.ok) throw new Error('Card not found');
  const json = await res.json();
  const card = json.data as PokemonCard;

  writeCardToCache(card); // fire-and-forget
  return card;
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

export async function getSets(): Promise<PokemonSet[]> {
  const res = await fetch(`${BASE_URL}/sets?orderBy=-releaseDate`, { headers: headers() });
  if (!res.ok) throw new Error('Could not fetch sets');
  const json = await res.json();
  return json.data as PokemonSet[];
}

export async function getTrendingCards(): Promise<PokemonCard[]> {
  const url = new URL(`${BASE_URL}/cards`);
  url.searchParams.set(
    'q',
    'rarity:"Special Illustration Rare" OR rarity:"Hyper Rare" OR rarity:"Secret Rare"'
  );
  url.searchParams.set('orderBy', '-set.releaseDate');
  url.searchParams.set('pageSize', '20');

  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) {
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
