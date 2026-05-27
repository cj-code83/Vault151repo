import { PokemonCard, PokemonSet } from '../types/pokemon';
import { supabase } from '../lib/supabase';

const BASE_URL = 'https://api.pokemontcg.io/v2';
const API_KEY = import.meta.env.VITE_POKEMON_TCG_API_KEY || '';

// Individual-card cache TTL (getCard)
const CARD_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// Batch-cache TTL (getCardsByIds) — price data changes slowly, 7 days is fine
const BATCH_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

/**
 * Fire-and-forget: write a single card to the Supabase cache.
 * Exported so the collection store can call it when a card is added.
 */
export function writeCardToCache(card: PokemonCard): void {
  supabase
    .from('card_cache')
    .upsert(
      { card_id: card.id, data: card as unknown as Record<string, unknown>, cached_at: new Date().toISOString() },
      { onConflict: 'card_id' }
    )
    .then();
}

/**
 * Fire-and-forget: batch-write multiple cards to the Supabase cache.
 * Called after every search/set/trending response to pre-populate the cache
 * so that collection tabs can serve from Supabase without touching the API.
 */
function writeCardsToCache(cards: PokemonCard[]): void {
  if (!cards.length) return;
  supabase
    .from('card_cache')
    .upsert(
      cards.map((c) => ({
        card_id: c.id,
        data: c as unknown as Record<string, unknown>,
        cached_at: new Date().toISOString(),
      })),
      { onConflict: 'card_id' }
    )
    .then();
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function searchCards(params: {
  name?: string;
  setId?: string;
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
  const json = await res.json() as { data: PokemonCard[]; totalCount: number; page: number; pageSize: number };

  // Populate Supabase cache with every search result — fire-and-forget.
  // This means cards browsed in search/set-detail will be served from
  // Supabase the next time they appear in a collection tab.
  writeCardsToCache(json.data);

  return json;
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

/**
 * Fetch multiple cards by ID.
 *
 * PRIMARY source: Supabase card_cache — single batch query, fast (<200 ms).
 * FALLBACK: Pokemon TCG API — only for IDs not present in cache.
 * SIDE-EFFECT: API results are written back to cache so future calls are free.
 */
export async function getCardsByIds(ids: string[]): Promise<PokemonCard[]> {
  if (!ids.length) return [];

  // ── Step 1: single Supabase query for all requested IDs ───────────────
  const cutoff = new Date(Date.now() - BATCH_CACHE_TTL_MS).toISOString();
  let cachedCards: PokemonCard[] = [];
  try {
    const { data } = await supabase
      .from('card_cache')
      .select('data')
      .in('card_id', ids)
      .gte('cached_at', cutoff);
    cachedCards = (data ?? []).map((r) => r.data as unknown as PokemonCard);
  } catch {
    // If Supabase is unreachable, fall through to API entirely
  }

  const resultMap = new Map<string, PokemonCard>(cachedCards.map((c) => [c.id, c]));
  const missing = ids.filter((id) => !resultMap.has(id));

  // ── Step 2: fetch ONLY missing IDs from the Pokemon TCG API ──────────
  if (missing.length > 0) {
    try {
      const q = missing.map((id) => `id:${id}`).join(' OR ');
      const url = new URL(`${BASE_URL}/cards`);
      url.searchParams.set('q', q);
      url.searchParams.set('pageSize', String(Math.min(missing.length, 250)));
      const res = await fetch(url.toString(), { headers: headers() });
      if (res.ok) {
        const json = await res.json();
        const fetched = json.data as PokemonCard[];
        writeCardsToCache(fetched); // cache for next time — fire-and-forget
        fetched.forEach((c) => resultMap.set(c.id, c));
      }
    } catch {
      // Partial results are acceptable
    }
  }

  // Return in original order, drop any IDs we couldn't resolve
  return ids.map((id) => resultMap.get(id)).filter((c): c is PokemonCard => !!c);
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
  let cards: PokemonCard[];
  if (!res.ok) {
    const fb = new URL(`${BASE_URL}/cards`);
    fb.searchParams.set('q', 'supertype:Pokémon rarity:"Rare Holo"');
    fb.searchParams.set('orderBy', '-set.releaseDate');
    fb.searchParams.set('pageSize', '20');
    const r = await fetch(fb.toString(), { headers: headers() });
    const j = await r.json();
    cards = j.data as PokemonCard[];
  } else {
    const json = await res.json();
    cards = json.data as PokemonCard[];
  }

  writeCardsToCache(cards); // populate cache — fire-and-forget
  return cards;
}
