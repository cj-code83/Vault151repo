import { supabase } from '@/lib/supabase';

/** Raw row shape returned by PostgREST from collection_cards. */
export interface RawCollectionRow {
  id:            string;
  user_id:       string;
  card_id:       string;
  quantity:      number;
  condition:     string;
  is_favorite:   boolean;
  is_wishlisted: boolean;
  notes:         string | null;
  created_at:    string;
  variants:      Record<string, number> | null;
}

/**
 * Fetches ALL collection_cards rows for a given user by paginating
 * automatically in PAGE_SIZE chunks.
 *
 * PostgREST (Supabase) silently caps plain `.select()` calls at 1 000 rows.
 * This helper loops with `.range(from, to)` until a partial page signals
 * the end of data, so collections of any size are returned completely.
 *
 * Throws the raw Supabase error on any DB failure — callers must handle it.
 */
export async function fetchEntireCollection(userId: string): Promise<RawCollectionRow[]> {
  const PAGE_SIZE = 1000;
  let page = 0;
  const all: RawCollectionRow[] = [];

  while (true) {
    const from = page * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('collection_cards')
      .select('*')
      .eq('user_id', userId)
      .range(from, to);

    if (error) throw error;

    if (data && data.length > 0) {
      all.push(...(data as RawCollectionRow[]));
    }

    if (!data || data.length < PAGE_SIZE) break;
    page++;
  }

  return all;
}
