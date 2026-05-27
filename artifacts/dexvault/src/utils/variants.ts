// ─── TCGPlayer price-key → display metadata ───────────────────────────────
// Keys are exactly what the Pokemon TCG API returns inside tcgplayer.prices.
// Only keys present in that object for a given card are real printings.
const PRICE_KEY_META: Record<string, { label: string; letter: string }> = {
  normal:              { label: 'Unlimited',        letter: 'U' },
  holofoil:            { label: 'Holofoil',         letter: 'H' },
  reverseHolofoil:     { label: 'Reverse Holo',     letter: 'R' },
  '1stEditionHolofoil':{ label: '1st Edition Holo', letter: '1' },
  '1stEditionNormal':  { label: '1st Edition',      letter: '1' },
  unlimitedHolofoil:   { label: 'Unlimited Holo',   letter: 'H' },
  unlimitedNormal:     { label: 'Unlimited',         letter: 'U' },
  shadowless:          { label: 'Shadowless',        letter: 'S' },
};

export type AvailableVariant = {
  key: string;
  label: string;
  letter: string;
  price: number | undefined;
};

/**
 * Returns only the variants that actually exist for a card,
 * derived from the card's tcgplayer.prices keys.
 * No variants are shown for cards that have no TCGPlayer price data.
 */
export function getAvailableVariants(
  prices: Record<string, { market?: number; mid?: number }> | undefined
): AvailableVariant[] {
  if (!prices) return [];
  return Object.keys(prices)
    .filter((k) => k in PRICE_KEY_META)
    .map((k) => ({
      key:    k,
      label:  PRICE_KEY_META[k].label,
      letter: PRICE_KEY_META[k].letter,
      price:  prices[k]?.market ?? prices[k]?.mid,
    }));
}

// ─── Letter lookup (used by CardItem badges) ──────────────────────────────
export const VARIANT_LETTER: Record<string, string> = {
  normal:               'U',
  holofoil:             'H',
  reverseHolofoil:      'R',
  '1stEditionHolofoil': '1',
  '1stEditionNormal':   '1',
  unlimitedHolofoil:    'H',
  unlimitedNormal:      'U',
  shadowless:           'S',
  // legacy keys kept so existing collection data still renders
  promo_stamped:        'P',
};

export function getVariantLetter(key: string): string {
  return VARIANT_LETTER[key] ?? key.replace(/_/g, ' ').charAt(0).toUpperCase();
}

// ─── Kept for backward-compat (legacy variant rows in card-detail) ────────
export function getPresetPrice(
  key: string,
  prices: Record<string, { market?: number; mid?: number }> | undefined
): number | undefined {
  if (!prices) return undefined;
  if (key === '1stEditionHolofoil') {
    const p = prices['1stEditionHolofoil'] ?? prices['1stEditionNormal'];
    return p?.market ?? p?.mid;
  }
  const p = prices[key];
  return p?.market ?? p?.mid;
}

export function formatVariantName(key: string): string {
  if (key in PRICE_KEY_META) return PRICE_KEY_META[key].label;
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^\w/, (s) => s.toUpperCase())
    .trim();
}

// ─── Static preset list kept only for legacy reference ────────────────────
export const PRESET_VARIANTS = [
  { key: 'holofoil',            label: 'Holofoil',         letter: 'H' },
  { key: 'reverseHolofoil',     label: 'Reverse Holo',     letter: 'R' },
  { key: 'normal',              label: 'Unlimited',         letter: 'U' },
  { key: '1stEditionHolofoil',  label: '1st Edition',       letter: '1' },
  { key: 'shadowless',          label: 'Shadowless',        letter: 'S' },
] as const;
