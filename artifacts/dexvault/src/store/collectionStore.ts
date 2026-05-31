import { create } from 'zustand';
import { toast } from 'sonner';
import { CollectionCard, PokemonCard } from '../types/pokemon';
import { supabase } from '../lib/supabase';
import { writeCardToCache } from '../services/pokemonTcg';
import { fetchEntireCollection } from '../utils/supabaseHelpers';

interface CollectionState {
  collectionCards: Record<string, CollectionCard>;
  loading: boolean;
  dbSetupRequired: boolean;
  fetchCollection: (userId: string) => Promise<void>;
  addCard: (card: PokemonCard, userId: string) => Promise<void>;
  removeCard: (cardId: string, userId: string) => Promise<void>;
  toggleFavorite: (cardId: string, userId: string) => Promise<void>;
  toggleWishlist: (cardId: string, userId: string) => Promise<void>;
  updateQuantity: (cardId: string, quantity: number, userId: string) => Promise<void>;
  updateCondition: (cardId: string, condition: string, userId: string) => Promise<void>;
  updateVariants: (cardId: string, variants: Record<string, number>, userId: string, cardForCreate?: PokemonCard) => Promise<void>;
  updateNotes: (cardId: string, notes: string, userId: string) => Promise<void>;
  /** Add every card in `cards` that isn't already owned. Returns { added, skipped }. */
  bulkAddCards: (cards: PokemonCard[], userId: string) => Promise<{ added: number; skipped: number }>;
  /** Remove all cards with the given IDs from the collection (batch). */
  bulkRemoveCards: (cardIds: string[], userId: string) => Promise<void>;
}

/**
 * Returns true ONLY when PostgreSQL reports the table genuinely does not exist
 * (error code 42P01 — UNDEFINED_TABLE).
 *
 * We intentionally do NOT match on message text such as "relation" or
 * "does not exist" because those strings also appear in RLS-policy errors
 * (e.g. "permission denied for relation collection_cards"), auth errors,
 * and other transient failures — all of which would be false positives.
 */
function isTableMissingError(error: { code?: string; message?: string }): boolean {
  return error.code === '42P01';
}

/** Structured console error — always includes the calling function name, code, and message. */
function logError(fn: string, error: { code?: string; message?: string; details?: string; hint?: string }) {
  console.error(`[collectionStore:${fn}]`, {
    code:    error.code    ?? '(none)',
    message: error.message ?? '(none)',
    details: error.details ?? '(none)',
    hint:    error.hint    ?? '(none)',
  });
}

export const useCollectionStore = create<CollectionState>((set, get) => ({
  collectionCards: {},
  loading: false,
  dbSetupRequired: false,

  fetchCollection: async (userId: string) => {
    set({ loading: true });

    let allRows: Awaited<ReturnType<typeof fetchEntireCollection>>;
    try {
      // fetchEntireCollection paginates automatically — no 1 000-row cap.
      allRows = await fetchEntireCollection(userId);
    } catch (error: unknown) {
      const e = error as { code?: string; message?: string; details?: string; hint?: string };
      logError('fetchCollection', e);
      set({ loading: false });
      if (isTableMissingError(e)) {
        set({ dbSetupRequired: true });
      } else {
        toast.error('Could not load collection', { description: e.message });
      }
      return;
    }

    const cardsRecord: Record<string, CollectionCard> = {};
    for (const i of allRows) {
      cardsRecord[i.card_id] = {
        id:           i.id,
        userId:       i.user_id,
        cardId:       i.card_id,
        quantity:     i.quantity,
        condition:    i.condition,
        isFavorite:   i.is_favorite,
        isWishlisted: i.is_wishlisted,
        notes:        i.notes ?? undefined,
        createdAt:    i.created_at,
        variants:     i.variants ?? {},
      };
    }
    set({ collectionCards: cardsRecord, loading: false, dbSetupRequired: false });
  },

  addCard: async (card: PokemonCard, userId: string) => {
    const existing = get().collectionCards[card.id];
    if (existing) {
      get().updateQuantity(card.id, existing.quantity + 1, userId);
      return;
    }

    const newEntry = {
      user_id: userId,
      card_id: card.id,
      quantity: 1,
      condition: 'Near Mint',
      is_favorite: false,
      is_wishlisted: false,
      variants: {},
    };

    const tempId = `temp-${Date.now()}`;
    const optimisticCard: CollectionCard = {
      id: tempId,
      userId,
      cardId: card.id,
      quantity: 1,
      condition: 'Near Mint',
      isFavorite: false,
      isWishlisted: false,
      createdAt: new Date().toISOString(),
      variants: {},
    };

    set((state) => ({
      collectionCards: { ...state.collectionCards, [card.id]: optimisticCard },
    }));

    const { data, error } = await supabase
      .from('collection_cards')
      .upsert(newEntry, { onConflict: 'user_id,card_id' })
      .select()
      .single();

    if (error) {
      logError('addCard', error);
      set((state) => {
        const next = { ...state.collectionCards };
        delete next[card.id];
        return { collectionCards: next };
      });
      if (isTableMissingError(error)) {
        set({ dbSetupRequired: true });
        toast.error('Database not set up', {
          description: 'Run the SQL setup in your Supabase project — see the Profile page.',
        });
      } else {
        toast.error('Could not add card', { description: error.message });
      }
      return;
    }

    if (data) {
      set((state) => ({
        collectionCards: {
          ...state.collectionCards,
          [card.id]: { ...optimisticCard, id: data.id },
        },
        dbSetupRequired: false,
      }));
      // Cache card data in Supabase so future collection-tab queries
      // can be served entirely from Supabase without hitting the API.
      writeCardToCache(card);
    }
  },

  removeCard: async (cardId: string, userId: string) => {
    const existing = get().collectionCards[cardId];
    if (!existing) return;

    set((state) => {
      const next = { ...state.collectionCards };
      delete next[cardId];
      return { collectionCards: next };
    });

    const { error } = await supabase
      .from('collection_cards')
      .delete()
      .eq('user_id', userId)
      .eq('card_id', cardId);

    if (error) {
      set((state) => ({
        collectionCards: { ...state.collectionCards, [cardId]: existing },
      }));
      toast.error('Could not remove card', { description: error.message });
    }
  },

  toggleFavorite: async (cardId: string, userId: string) => {
    const existing = get().collectionCards[cardId];
    if (!existing) return;

    const newValue = !existing.isFavorite;

    set((state) => ({
      collectionCards: {
        ...state.collectionCards,
        [cardId]: { ...existing, isFavorite: newValue },
      },
    }));

    const { error } = await supabase
      .from('collection_cards')
      .update({ is_favorite: newValue })
      .eq('user_id', userId)
      .eq('card_id', cardId);

    if (error) {
      set((state) => ({
        collectionCards: {
          ...state.collectionCards,
          [cardId]: { ...existing, isFavorite: !newValue },
        },
      }));
      toast.error('Could not update favorite', { description: error.message });
    }
  },

  toggleWishlist: async (cardId: string, userId: string) => {
    const existing = get().collectionCards[cardId];

    if (!existing) {
      const newEntry = {
        user_id: userId,
        card_id: cardId,
        quantity: 0,
        condition: 'Near Mint',
        is_favorite: false,
        is_wishlisted: true,
        variants: {},
      };

      const tempId = `temp-${Date.now()}`;
      const optimisticCard: CollectionCard = {
        id: tempId,
        userId,
        cardId,
        quantity: 0,
        condition: 'Near Mint',
        isFavorite: false,
        isWishlisted: true,
        createdAt: new Date().toISOString(),
        variants: {},
      };

      set((state) => ({
        collectionCards: { ...state.collectionCards, [cardId]: optimisticCard },
      }));

      const { data, error } = await supabase
        .from('collection_cards')
        .upsert(newEntry, { onConflict: 'user_id,card_id' })
        .select()
        .single();

      if (error) {
        logError('toggleWishlist', error);
        set((state) => {
          const next = { ...state.collectionCards };
          delete next[cardId];
          return { collectionCards: next };
        });
        if (isTableMissingError(error)) {
          set({ dbSetupRequired: true });
          toast.error('Database not set up', {
            description: 'Run the SQL setup in your Supabase project — see the Profile page.',
          });
        } else {
          toast.error('Could not add to wishlist', { description: error.message });
        }
      } else if (data) {
        set((state) => ({
          collectionCards: {
            ...state.collectionCards,
            [cardId]: { ...optimisticCard, id: data.id },
          },
          dbSetupRequired: false,
        }));
      }
      return;
    }

    const newValue = !existing.isWishlisted;

    set((state) => ({
      collectionCards: {
        ...state.collectionCards,
        [cardId]: { ...existing, isWishlisted: newValue },
      },
    }));

    const { error } = await supabase
      .from('collection_cards')
      .update({ is_wishlisted: newValue })
      .eq('user_id', userId)
      .eq('card_id', cardId);

    if (error) {
      set((state) => ({
        collectionCards: {
          ...state.collectionCards,
          [cardId]: { ...existing, isWishlisted: !newValue },
        },
      }));
      toast.error('Could not update wishlist', { description: error.message });
    }
  },

  updateQuantity: async (cardId: string, quantity: number, userId: string) => {
    const existing = get().collectionCards[cardId];
    if (!existing) return;

    const variantTotal = Object.values(existing.variants ?? {}).reduce((s, v) => s + v, 0);

    if (quantity <= 0 && variantTotal === 0 && !existing.isWishlisted) {
      return get().removeCard(cardId, userId);
    }

    const safeQty = Math.max(0, quantity);

    set((state) => ({
      collectionCards: {
        ...state.collectionCards,
        [cardId]: { ...existing, quantity: safeQty },
      },
    }));

    const { error } = await supabase
      .from('collection_cards')
      .update({ quantity: safeQty })
      .eq('user_id', userId)
      .eq('card_id', cardId);

    if (error) {
      set((state) => ({
        collectionCards: {
          ...state.collectionCards,
          [cardId]: { ...existing, quantity: existing.quantity },
        },
      }));
      toast.error('Could not update quantity', { description: error.message });
    }
  },

  updateCondition: async (cardId: string, condition: string, userId: string) => {
    const existing = get().collectionCards[cardId];
    if (!existing) return;

    set((state) => ({
      collectionCards: {
        ...state.collectionCards,
        [cardId]: { ...existing, condition },
      },
    }));

    const { error } = await supabase
      .from('collection_cards')
      .update({ condition })
      .eq('user_id', userId)
      .eq('card_id', cardId);

    if (error) {
      set((state) => ({
        collectionCards: {
          ...state.collectionCards,
          [cardId]: { ...existing, condition: existing.condition },
        },
      }));
      toast.error('Could not update condition', { description: error.message });
    }
  },

  updateNotes: async (cardId: string, notes: string, userId: string) => {
    const existing = get().collectionCards[cardId];
    if (!existing) return;

    set((state) => ({
      collectionCards: {
        ...state.collectionCards,
        [cardId]: { ...existing, notes },
      },
    }));

    const { error } = await supabase
      .from('collection_cards')
      .update({ notes })
      .eq('user_id', userId)
      .eq('card_id', cardId);

    if (error) {
      set((state) => ({
        collectionCards: {
          ...state.collectionCards,
          [cardId]: { ...existing, notes: existing.notes },
        },
      }));
      toast.error('Could not save notes', { description: error.message });
    }
  },

  updateVariants: async (cardId: string, variants: Record<string, number>, userId: string, cardForCreate?: PokemonCard) => {
    const existing = get().collectionCards[cardId];
    const variantTotal = Object.values(variants).reduce((s, v) => s + v, 0);

    if (!existing) {
      if (variantTotal === 0 || !cardForCreate) return;

      const newEntry = {
        user_id: userId,
        card_id: cardId,
        quantity: 0,
        condition: 'Near Mint',
        is_favorite: false,
        is_wishlisted: false,
        variants,
      };

      const tempId = `temp-${Date.now()}`;
      const optimistic: CollectionCard = {
        id: tempId,
        userId,
        cardId,
        quantity: 0,
        condition: 'Near Mint',
        isFavorite: false,
        isWishlisted: false,
        createdAt: new Date().toISOString(),
        variants,
      };

      set((state) => ({
        collectionCards: { ...state.collectionCards, [cardId]: optimistic },
      }));

      const { data, error } = await supabase
        .from('collection_cards')
        .upsert(newEntry, { onConflict: 'user_id,card_id' })
        .select()
        .single();

      if (error) {
        logError('updateVariants', error);
        set((state) => {
          const next = { ...state.collectionCards };
          delete next[cardId];
          return { collectionCards: next };
        });
        if (isTableMissingError(error)) {
          set({ dbSetupRequired: true });
          toast.error('Database not set up', {
            description: 'Run the SQL setup in your Supabase project — see the Profile page.',
          });
        } else {
          toast.error('Could not save variant', { description: error.message });
        }
      } else if (data) {
        set((state) => ({
          collectionCards: {
            ...state.collectionCards,
            [cardId]: { ...optimistic, id: data.id },
          },
          dbSetupRequired: false,
        }));
      }
      return;
    }

    const prevVariants = existing.variants ?? {};

    if (variantTotal === 0 && existing.quantity === 0 && !existing.isWishlisted) {
      return get().removeCard(cardId, userId);
    }

    set((state) => ({
      collectionCards: {
        ...state.collectionCards,
        [cardId]: { ...existing, variants },
      },
    }));

    const { error } = await supabase
      .from('collection_cards')
      .update({ variants })
      .eq('user_id', userId)
      .eq('card_id', cardId);

    if (error) {
      set((state) => ({
        collectionCards: {
          ...state.collectionCards,
          [cardId]: { ...existing, variants: prevVariants },
        },
      }));
      toast.error('Could not update variants', { description: error.message });
    }
  },

  bulkAddCards: async (cards: PokemonCard[], userId: string) => {
    const existing = get().collectionCards;
    // Only insert cards with no existing record (leaves wishlisted-only cards untouched)
    const toAdd = cards.filter((c) => !existing[c.id]);

    if (toAdd.length === 0) {
      toast.info('All cards already in your collection.');
      return { added: 0, skipped: cards.length };
    }

    const rows = toAdd.map((card) => ({
      user_id:      userId,
      card_id:      card.id,
      quantity:     1,
      condition:    'Near Mint',
      is_favorite:  false,
      is_wishlisted: false,
      variants:     {},
      notes:        null,
    }));

    // Supabase handles ~250 rows fine in one call; chunk if ever larger
    const CHUNK = 100;
    let totalAdded = 0;
    const allInserted: CollectionCard[] = [];

    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from('collection_cards')
        .upsert(chunk, { onConflict: 'user_id,card_id', ignoreDuplicates: true })
        .select();

      if (error) {
        logError('bulkAddCards', error);
        if (isTableMissingError(error)) set({ dbSetupRequired: true });
        toast.error('Could not add cards', { description: error.message });
        return { added: totalAdded, skipped: cards.length - totalAdded };
      }

      if (data) {
        totalAdded += data.length;
        for (const row of data) {
          allInserted.push({
            id:           row.id,
            userId:       row.user_id,
            cardId:       row.card_id,
            quantity:     row.quantity,
            condition:    row.condition,
            isFavorite:   row.is_favorite,
            isWishlisted: row.is_wishlisted,
            notes:        row.notes ?? undefined,
            createdAt:    row.created_at,
            variants:     row.variants ?? {},
          });
        }
      }
    }

    // Optimistic local update — also clears any stale dbSetupRequired flag
    set((state) => {
      const next = { ...state.collectionCards };
      for (const cc of allInserted) next[cc.cardId] = cc;
      return { collectionCards: next, dbSetupRequired: false };
    });

    // Fire-and-forget cache writes
    toAdd.forEach((card) => writeCardToCache(card));

    const skipped = cards.length - toAdd.length;
    toast.success(
      `Added ${totalAdded} card${totalAdded === 1 ? '' : 's'} to your collection.`,
      skipped > 0 ? { description: `${skipped} already owned — left untouched.` } : undefined,
    );
    return { added: totalAdded, skipped };
  },

  bulkRemoveCards: async (cardIds: string[], userId: string) => {
    if (cardIds.length === 0) return;

    const prev = get().collectionCards;

    // Optimistic local remove
    set((state) => {
      const next = { ...state.collectionCards };
      for (const id of cardIds) delete next[id];
      return { collectionCards: next };
    });

    // PostgREST supports up to ~1000 items in .in(); chunk defensively
    const CHUNK = 500;
    let success = true;

    for (let i = 0; i < cardIds.length; i += CHUNK) {
      const chunk = cardIds.slice(i, i + CHUNK);
      const { error } = await supabase
        .from('collection_cards')
        .delete()
        .eq('user_id', userId)
        .in('card_id', chunk);

      if (error) {
        logError('bulkRemoveCards', error);
        success = false;
        if (isTableMissingError(error)) set({ dbSetupRequired: true });
        toast.error('Could not remove cards', { description: error.message });
        break;
      }
    }

    if (!success) {
      // Rollback to previous state
      set((state) => {
        const next = { ...state.collectionCards };
        for (const id of cardIds) {
          if (prev[id]) next[id] = prev[id];
        }
        return { collectionCards: next };
      });
      return;
    }

    toast.success(`Removed ${cardIds.length} card${cardIds.length === 1 ? '' : 's'} from collection.`);
  },
}));
