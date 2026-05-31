import { Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const TYPE_ENTRIES = [
  { name: 'Fire',      color: '#FF6B35' },
  { name: 'Water',     color: '#5DADE2' },
  { name: 'Grass',     color: '#52BE80' },
  { name: 'Lightning', color: '#F4D03F' },
  { name: 'Psychic',   color: '#AF7AC5' },
  { name: 'Fighting',  color: '#CB4335' },
  { name: 'Darkness',  color: '#1C2833' },
  { name: 'Metal',     color: '#808B96' },
  { name: 'Dragon',    color: '#6E2DC3' },
  { name: 'Fairy',     color: '#F48FB1' },
  { name: 'Colorless', color: '#BDC3C7' },
];

const VARIANT_LETTERS = [
  { letter: 'H', label: 'Holofoil',       desc: 'Holographic foil print' },
  { letter: 'R', label: 'Reverse Holo',   desc: 'Reverse holographic foil' },
  { letter: 'U', label: 'Unlimited',      desc: 'Standard unlimited reprint' },
  { letter: '1', label: '1st Edition',    desc: 'First edition holofoil' },
  { letter: 'S', label: 'Shadowless',     desc: 'Shadowless Base Set variant' },
];

interface LegendDialogProps {
  /** Override the trigger button's className. Defaults to muted foreground style. */
  triggerClassName?: string;
}

export function LegendDialog({ triggerClassName }: LegendDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className={
            triggerClassName ??
            'flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors shrink-0'
          }
          aria-label="Symbol legend"
        >
          <Info className="w-4 h-4" />
          <span className="text-xs hidden sm:inline">Legend</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Card Grid Symbols</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">

          {/* Type dots */}
          <div>
            <p className="font-semibold mb-1.5">Energy type dots</p>
            <p className="text-xs text-muted-foreground mb-2">
              Coloured circles below each card indicate its Pokémon energy type.
            </p>
            <div className="grid grid-cols-2 gap-1">
              {TYPE_ENTRIES.map(({ name, color }) => (
                <div key={name} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-xs text-muted-foreground">{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quantity badge */}
          <div>
            <p className="font-semibold mb-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[9px] font-bold mr-2">3</span>
              Blue badge (top-right)
            </p>
            <p className="text-xs text-muted-foreground">
              Total copies of this card in your collection, including all variants.
            </p>
          </div>

          {/* Variant letters */}
          <div>
            <p className="font-semibold mb-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-500 text-white text-[9px] font-bold mr-2">H</span>
              Gold badges (top-left)
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              Shown when you own a special variant <em>beyond</em> the card's standard print.
            </p>
            <div className="space-y-1">
              {VARIANT_LETTERS.map(({ letter, label, desc }) => (
                <div key={letter} className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-500 text-white text-[9px] font-bold shrink-0 mt-0.5">
                    {letter}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    <span className="text-foreground font-medium">{label}</span> — {desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Completion balls */}
          <div>
            <p className="font-semibold mb-1.5">Set completion balls</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>🔴 <span className="text-foreground font-medium">Pokéball</span> — standard set complete (all numbered cards 1–{'{'}printedTotal{'}'}).</p>
              <p>⚪ <span className="text-foreground font-medium">Master Ball</span> — master set complete (every card including secret rares).</p>
            </div>
          </div>

          {/* Standard print note */}
          <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Standard print</span> — the base printing
            tracked by the ± buttons. Priority: Unlimited → Holofoil → Reverse Holo.
            Variants above this are shown as gold badges.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
