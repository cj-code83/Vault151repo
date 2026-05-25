export function formatVariantName(key: string): string {
  const map: Record<string, string> = {
    holofoil: 'Holofoil',
    reverseHolofoil: 'Reverse Holo',
    normal: 'Normal',
    '1stEditionHolofoil': '1st Ed. Holofoil',
    '1stEditionNormal': '1st Ed. Normal',
    unlimitedHolofoil: 'Unlimited Holo',
    unlimitedNormal: 'Unlimited Normal',
    shadowless: 'Shadowless',
    wstamped: 'W Stamped',
    promoHolofoil: 'Promo Holo',
  };
  return (
    map[key] ??
    key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^\w/, (s) => s.toUpperCase())
      .trim()
  );
}
