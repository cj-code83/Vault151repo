import { useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Minus, PenLine, X } from 'lucide-react';
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
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const owned = user ? collectionCards[card.id] : null;
  const variants = owned?.variants ?? {};
  const prices = card.tcgplayer?.prices ?? {};

  const apiVariantKeys = Object.keys(prices);
  const customVariantKeys = Object.keys(variants).filter((k) => !apiVariantKeys.includes(k));
  const allKeys = [...apiVariantKeys, ...customVariantKeys];

  const handleChange = async (key: string, delta: number) => {
    if (!user) return;
    const current = variants[key] ?? 0;
    const newQty = Math.max(0, current + delta);
    const newVariants = { ...variants, [key]: newQty };
    if (newQty === 0) delete newVariants[key];
    await updateVariants(card.id, newVariants, user.id, card);
  };

  const handleAddCustom = async () => {
    const label = customInput.trim();
    if (!label || !user) return;
    const slug = label.toLowerCase().replace(/\s+/g, '_');
    const newVariants = { ...variants, [slug]: (variants[slug] ?? 0) + 1 };
    await updateVariants(card.id, newVariants, user.id, card);
    setCustomInput('');
    setShowCustomInput(false);
  };

  const handleRemoveCustom = async (key: string) => {
    if (!user) return;
    const newVariants = { ...variants };
    delete newVariants[key];
    await updateVariants(card.id, newVariants, user.id, card);
  };

  const totalVariantQty = Object.values(variants).reduce((s, v) => s + v, 0);
  const totalVariantValue = Object.entries(variants).reduce((s, [k, qty]) => {
    const price = prices[k]?.market ?? prices[k]?.mid ?? 0;
    return s + price * qty;
  }, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* p-0 overrides the default p-6 so we control all padding ourselves */}
      <SheetContent
        side="bottom"
        className="rounded-t-2xl flex flex-col p-0 max-h-[85vh]"
        aria-describedby={undefined}
      >
        {/* Fixed header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
          <SheetTitle className="text-base">{card.name} — Print Variants</SheetTitle>
        </div>

        {/* Scrollable variants list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {allKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No TCGPlayer price data for this card. Use "Add Custom Variant" below to track your copies.
            </p>
          ) : (
            allKeys.map((key) => {
              const qty = variants[key] ?? 0;
              const priceData = prices[key];
              const price = priceData?.market ?? priceData?.mid;
              const isCustom = !apiVariantKeys.includes(key);

              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm">
                        {isCustom
                          ? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                          : formatVariantName(key)}
                      </span>
                      {isCustom && (
                        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium leading-none">
                          custom
                        </span>
                      )}
                    </div>
                    {price != null ? (
                      <div className="text-xs text-green-600 dark:text-green-400 font-mono mt-0.5">
                        ${price.toFixed(2)} market
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground mt-0.5">No price data</div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isCustom && qty === 0 ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveCustom(key)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Fixed footer: custom variant + summary */}
        <div className="px-6 pb-8 pt-3 border-t border-border shrink-0 space-y-3">
          {showCustomInput ? (
            <div className="flex gap-2">
              <Input
                placeholder="e.g. W Stamped, Shadowless, CGC 9..."
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
                autoFocus
                className="flex-1"
              />
              <Button onClick={handleAddCustom} disabled={!customInput.trim()}>
                Add
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomInput('');
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setShowCustomInput(true)}
            >
              <PenLine className="h-4 w-4" />
              Add Custom Variant
            </Button>
          )}

          {totalVariantQty > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {totalVariantQty} variant {totalVariantQty === 1 ? 'copy' : 'copies'} tracked
              </span>
              {totalVariantValue > 0 && (
                <span className="font-mono font-bold text-green-600 dark:text-green-400">
                  ${totalVariantValue.toFixed(2)} est. value
                </span>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
