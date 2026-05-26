export const PRESET_VARIANTS = [
  { key: 'holofoil', label: 'Holofoil', letter: 'H' },
  { key: 'reverseHolofoil', label: 'Reverse Holo', letter: 'R' },
  { key: 'promo_stamped', label: 'Promo / Stamped', letter: 'P' },
  { key: 'normal', label: 'Unlimited', letter: 'U' },
  { key: '1stEditionHolofoil', label: '1st Edition', letter: '1' },
  { key: 'shadowless', label: 'Shadowless', letter: 'S' },
] as const;

export const VARIANT_LETTER: Record<string, string> = {
  holofoil: 'H',
  reverseHolofoil: 'R',
  promo_stamped: 'P',
  normal: 'U',
  unlimitedNormal: 'U',
  '1stEditionHolofoil': '1',
  '1stEditionNormal': '1',
  shadowless: 'S',
};

export function getVariantLetter(key: string): string {
  return VARIANT_LETTER[key] ?? key.replace(/_/g, ' ').charAt(0).toUpperCase();
}

export function getPresetPrice(
  key: string,
  prices: Record<string, { market?: number; mid?: number }> | undefined
): number | undefined {
  if (!prices || key === 'promo_stamped') return undefined;
  if (key === '1stEditionHolofoil') {
    const p = prices['1stEditionHolofoil'] ?? prices['1stEditionNormal'];
    return p?.market ?? p?.mid;
  }
  const p = prices[key];
  return p?.market ?? p?.mid;
}

export function formatVariantName(key: string): string {
  const found = PRESET_VARIANTS.find((v) => v.key === key);
  if (found) return found.label;
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^\w/, (s) => s.toUpperCase())
    .trim();
}
