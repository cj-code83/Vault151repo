import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Plus, Minus } from 'lucide-react';
import { PokemonCard } from '@/types/pokemon';
import { useCollectionStore } from '@/store/collectionStore';
import { useAuth } from '@/hooks/use-auth';
import { formatVariantName } from '@/utils/variants';

interface VariantSheetProps {
  card: PokemonCard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VariantSheet({ card, open, onOpenChange }: VariantSheetProps) {
  const { user } = useAuth();
  const { collectionCards, updateVariants } = useCollectionStore();

  const owned = user ? collectionCards[card.id] : null;
  const variants = owned?.variants ?? {};
  const prices = card.tcgplayer?.prices ?? {};

  const handleChange = async (key: string, delta: number) => {
    if (!user) return;
    const current = variants[key] ?? 0;
    const newQty = Math.max(0, current + delta);
    const newVariants = { ...variants, [key]: newQty };
    if (newQty === 0) delete newVariants[key];
    await updateVariants(card.id, newVariants, user.id, card);
  };

  const totalVariantQty = Object.values(variants).reduce((s, v) => s + v, 0);
  const totalVariantValue = Object.entries(variants).reduce((s, [k, qty]) => {
    const price = prices[k]?.market ?? prices[k]?.mid ?? 0;
    return s + price * qty;
  }, 0);

  const entries = Object.entries(prices);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-left">{card.name} — Print Variants</SheetTitle>
        </SheetHeader>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pricing data available for this card.</p>
        ) : (
          <div className="space-y-2">
            {entries.map(([key, priceData]) => {
              const qty = variants[key] ?? 0;
              const price = priceData.market ?? priceData.mid;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{formatVariantName(key)}</div>
                    {price != null ? (
                      <div className="text-xs text-green-600 dark:text-green-400 font-mono mt-0.5">
                        ${price.toFixed(2)} market
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground mt-0.5">No price data</div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleChange(key, -1)}
                      disabled={!user || qty === 0}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-8 text-center font-mono font-bold text-sm tabular-nums">
                      {qty}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleChange(key, 1)}
                      disabled={!user}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalVariantQty > 0 && (
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {totalVariantQty} variant copy{totalVariantQty !== 1 ? 'ies' : ''} tracked
            </span>
            {totalVariantValue > 0 && (
              <span className="font-mono font-bold text-green-600 dark:text-green-400">
                ${totalVariantValue.toFixed(2)} est. value
              </span>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
