import { PokemonCard, PokemonSet } from '../types/pokemon';
import { supabase } from '../lib/supabase';

const BASE_URL = 'https://api.pokemontcg.io/v2';
const API_KEY = import.meta.env.VITE_POKEMON_TCG_API_KEY || '';

// Cache TTL — 24 hours.  Prices update daily so this is an acceptable
// window that keeps the data fresh enough for a collection tracker.
const CARD_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function headers(): Record<string, string> {
  return API_KEY ? { 'X-Api-Key': API_KEY } : {};
}

// ─── Supabase card cache helpers ──────────────────────────────────────────
// These wrap the `card_cache` table (see Profile page SQL).  Every function
// silently degrades to a direct API call when the table doesn't exist yet
// — so the app works normally before the SQL has been run.

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
  // Fire-and-forget — never block the critical path.
  supabase
    .from('card_cache')
    .upsert(
      { card_id: card.id, data: card as unknown as Record<string, unknown>, cached_at: new Date().toISOString() },
      { onConflict: 'card_id' }
    )
    .then(); // intentionally unawaited
}

// ─── Public API ────────────────────────────────────────────────────────────

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
  if (params.q)           queryParts.push(params.q);
  if (params.name)        queryParts.push(`name:"*${params.name}*"`);
  if (params.set)         queryParts.push(`set.name:"*${params.set}*"`);
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

/**
 * Fetch a single card by ID.
 *
 * Cache hierarchy (fastest → slowest):
 *   1. React Query in-memory cache       (~0 ms, handled by the caller)
 *   2. React Query localStorage cache    (~0 ms, restored on page load)
 *   3. Supabase card_cache table         (~80–150 ms, shared across all users)
 *   4. Pokémon TCG API                   (~200–500 ms, source of truth)
 *
 * Levels 1–2 are managed by the PersistQueryClientProvider in App.tsx.
 * This function handles levels 3–4 so that even a first-time visitor on
 * any device benefits if another user has already fetched the same card.
 */
export async function getCard(id: string): Promise<PokemonCard> {
  // Level 3 — shared Supabase cache
  const cached = await readCardFromCache(id);
  if (cached) return cached;

  // Level 4 — live Pokémon TCG API
  const res = await fetch(`${BASE_URL}/cards/${id}`, { headers: headers() });
  if (!res.ok) throw new Error('Card not found');
  const json = await res.json();
  const card = json.data as PokemonCard;

  // Populate the shared cache for future users (background, non-blocking)
  writeCardToCache(card);

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
  // High-rarity cards from the most recent sets — reflects market interest
  const url = new URL(`${BASE_URL}/cards`);
  url.searchParams.set(
    'q',
    'rarity:"Special Illustration Rare" OR rarity:"Hyper Rare" OR rarity:"Secret Rare"'
  );
  url.searchParams.set('orderBy', '-set.releaseDate');
  url.searchParams.set('pageSize', '20');

  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) {
    // Fallback to recent standard rares
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
