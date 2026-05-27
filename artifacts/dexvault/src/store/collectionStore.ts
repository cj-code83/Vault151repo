import { create } from 'zustand';
import { toast } from 'sonner';
import { CollectionCard, PokemonCard } from '../types/pokemon';
import { supabase } from '../lib/supabase';
import { writeCardToCache } from '../services/pokemonTcg';

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
}

function isTableMissingError(error: { code?: string; message?: string }) {
  return (
    error.code === '42P01' ||
    (error.message ?? '').includes('relation') ||
    (error.message ?? '').includes('does not exist')
  );
}

export const useCollectionStore = create<CollectionState>((set, get) => ({
  collectionCards: {},
  loading: false,
  dbSetupRequired: false,

  fetchCollection: async (userId: string) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('collection_cards')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      set({ loading: false });
      if (isTableMissingError(error)) {
        set({ dbSetupRequired: true });
      } else {
        toast.error('Could not load collection', { description: error.message });
      }
      return;
    }

    if (data) {
      const cardsRecord: Record<string, CollectionCard> = {};
      data.forEach((item) => {
        cardsRecord[item.card_id] = {
          id: item.id,
          userId: item.user_id,
          cardId: item.card_id,
          quantity: item.quantity,
          condition: item.condition,
          isFavorite: item.is_favorite,
          isWishlisted: item.is_wishlisted,
          notes: item.notes,
          createdAt: item.created_at,
          variants: item.variants ?? {},
        };
      });
      set({ collectionCards: cardsRecord, loading: false, dbSetupRequired: false });
    }
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
}));
