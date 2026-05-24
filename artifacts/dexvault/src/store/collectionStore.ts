import { create } from 'zustand';
import { CollectionCard, PokemonCard } from '../types/pokemon';
import { supabase } from '../lib/supabase';

interface CollectionState {
  collectionCards: Record<string, CollectionCard>;
  loading: boolean;
  fetchCollection: (userId: string) => Promise<void>;
  addCard: (card: PokemonCard, userId: string) => Promise<void>;
  removeCard: (cardId: string, userId: string) => Promise<void>;
  toggleFavorite: (cardId: string, userId: string) => Promise<void>;
  toggleWishlist: (cardId: string, userId: string) => Promise<void>;
  updateQuantity: (cardId: string, quantity: number, userId: string) => Promise<void>;
  updateCondition: (cardId: string, condition: string, userId: string) => Promise<void>;
}

export const useCollectionStore = create<CollectionState>((set, get) => ({
  collectionCards: {},
  loading: false,

  fetchCollection: async (userId: string) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('collection_cards')
      .select('*')
      .eq('user_id', userId);
    
    if (!error && data) {
      const cardsRecord: Record<string, CollectionCard> = {};
      data.forEach(item => {
        cardsRecord[item.card_id] = {
          id: item.id,
          userId: item.user_id,
          cardId: item.card_id,
          quantity: item.quantity,
          condition: item.condition,
          isFavorite: item.is_favorite,
          isWishlisted: item.is_wishlisted,
          notes: item.notes,
          createdAt: item.created_at
        };
      });
      set({ collectionCards: cardsRecord, loading: false });
    } else {
      set({ loading: false });
    }
  },

  addCard: async (card: PokemonCard, userId: string) => {
    const existing = get().collectionCards[card.id];
    if (existing) {
      // Increment quantity
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
    };

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticCard: CollectionCard = {
      id: tempId,
      userId,
      cardId: card.id,
      quantity: 1,
      condition: 'Near Mint',
      isFavorite: false,
      isWishlisted: false,
      createdAt: new Date().toISOString()
    };

    set((state) => ({
      collectionCards: { ...state.collectionCards, [card.id]: optimisticCard }
    }));

    const { data, error } = await supabase
      .from('collection_cards')
      .upsert(newEntry, { onConflict: 'user_id,card_id' })
      .select()
      .single();

    if (!error && data) {
      set((state) => ({
        collectionCards: {
          ...state.collectionCards,
          [card.id]: {
            ...optimisticCard,
            id: data.id,
          }
        }
      }));
    } else {
      // Revert on error
      set((state) => {
        const next = { ...state.collectionCards };
        delete next[card.id];
        return { collectionCards: next };
      });
    }
  },

  removeCard: async (cardId: string, userId: string) => {
    const existing = get().collectionCards[cardId];
    if (!existing) return;

    // Optimistic
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
      // Revert
      set((state) => ({
        collectionCards: { ...state.collectionCards, [cardId]: existing }
      }));
    }
  },

  toggleFavorite: async (cardId: string, userId: string) => {
    const existing = get().collectionCards[cardId];
    if (!existing) return;

    const newValue = !existing.isFavorite;

    // Optimistic
    set((state) => ({
      collectionCards: {
        ...state.collectionCards,
        [cardId]: { ...existing, isFavorite: newValue }
      }
    }));

    const { error } = await supabase
      .from('collection_cards')
      .update({ is_favorite: newValue })
      .eq('user_id', userId)
      .eq('card_id', cardId);

    if (error) {
      // Revert
      set((state) => ({
        collectionCards: {
          ...state.collectionCards,
          [cardId]: { ...existing, isFavorite: !newValue }
        }
      }));
    }
  },

  toggleWishlist: async (cardId: string, userId: string) => {
    const existing = get().collectionCards[cardId];
    if (!existing) {
      // Create as wishlisted
      const newEntry = {
        user_id: userId,
        card_id: cardId,
        quantity: 0,
        condition: 'Near Mint',
        is_favorite: false,
        is_wishlisted: true,
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
        createdAt: new Date().toISOString()
      };

      set((state) => ({
        collectionCards: { ...state.collectionCards, [cardId]: optimisticCard }
      }));

      const { data, error } = await supabase
        .from('collection_cards')
        .upsert(newEntry, { onConflict: 'user_id,card_id' })
        .select()
        .single();

      if (!error && data) {
        set((state) => ({
          collectionCards: {
            ...state.collectionCards,
            [cardId]: { ...optimisticCard, id: data.id }
          }
        }));
      } else {
        set((state) => {
          const next = { ...state.collectionCards };
          delete next[cardId];
          return { collectionCards: next };
        });
      }
      return;
    }

    const newValue = !existing.isWishlisted;

    // Optimistic
    set((state) => ({
      collectionCards: {
        ...state.collectionCards,
        [cardId]: { ...existing, isWishlisted: newValue }
      }
    }));

    const { error } = await supabase
      .from('collection_cards')
      .update({ is_wishlisted: newValue })
      .eq('user_id', userId)
      .eq('card_id', cardId);

    if (error) {
      // Revert
      set((state) => ({
        collectionCards: {
          ...state.collectionCards,
          [cardId]: { ...existing, isWishlisted: !newValue }
        }
      }));
    }
  },

  updateQuantity: async (cardId: string, quantity: number, userId: string) => {
    const existing = get().collectionCards[cardId];
    if (!existing) return;

    if (quantity <= 0 && !existing.isWishlisted) {
      return get().removeCard(cardId, userId);
    }

    // Optimistic
    set((state) => ({
      collectionCards: {
        ...state.collectionCards,
        [cardId]: { ...existing, quantity }
      }
    }));

    const { error } = await supabase
      .from('collection_cards')
      .update({ quantity })
      .eq('user_id', userId)
      .eq('card_id', cardId);

    if (error) {
      // Revert
      set((state) => ({
        collectionCards: {
          ...state.collectionCards,
          [cardId]: { ...existing, quantity: existing.quantity }
        }
      }));
    }
  },

  updateCondition: async (cardId: string, condition: string, userId: string) => {
    const existing = get().collectionCards[cardId];
    if (!existing) return;

    // Optimistic
    set((state) => ({
      collectionCards: {
        ...state.collectionCards,
        [cardId]: { ...existing, condition }
      }
    }));

    const { error } = await supabase
      .from('collection_cards')
      .update({ condition })
      .eq('user_id', userId)
      .eq('card_id', cardId);

    if (error) {
      // Revert
      set((state) => ({
        collectionCards: {
          ...state.collectionCards,
          [cardId]: { ...existing, condition: existing.condition }
        }
      }));
    }
  }
}));
