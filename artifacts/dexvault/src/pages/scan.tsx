import { useRef, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Camera,
  ChevronLeft,
  RefreshCw,
  Search as SearchIcon,
  Plus,
  CheckCircle2,
  AlertCircle,
  Scan,
  FlipVertical,
  Hash,
} from 'lucide-react';
import { searchCards } from '@/services/pokemonTcg';
import { useCollectionStore } from '@/store/collectionStore';
import { useAuth } from '@/hooks/use-auth';
import { PokemonCard } from '@/types/pokemon';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────
type ScanState = 'idle' | 'requesting' | 'live' | 'processing' | 'results' | 'cam-error';

interface Detection {
  name: string;
  number: string; // e.g. "58/102" or "025/165"
  confidence: 'high' | 'medium' | 'low';
}

// ─── Canvas helpers ───────────────────────────────────────────────────────

function cropToCanvas(
  src: HTMLCanvasElement,
  x: number, y: number, w: number, h: number
): HTMLCanvasElement {
  const dst = document.createElement('canvas');
  dst.width  = Math.max(w, 1);
  dst.height = Math.max(h, 1);
  dst.getContext('2d')!.drawImage(src, x, y, w, h, 0, 0, w, h);
  return dst;
}

// ─── Text parsers ─────────────────────────────────────────────────────────

const SKIP_NAME = /^(hp|stage|basic|level|\d|ex\b|gx\b|v\b|vmax|vstar|item|trainer|supporter|stadium|lv\.?|ability|attack|retreat|weakness|resistance|evolves)/i;

function parsePokemonName(raw: string): string {
  const lines = raw
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 1 && l.length < 35);
  return lines.find(l => /^[A-Za-zÀ-ÿ♀♂]/.test(l) && !SKIP_NAME.test(l))
    ?? lines[0]
    ?? '';
}

function parseCollectorNumber(raw: string): string {
  const full = raw.match(/(\d{1,3})\s*[/\\]\s*(\d{2,3})/);
  if (full) return `${full[1]}/${full[2]}`;
  const bare = raw.match(/\b(\d{1,3})\b/);
  return bare?.[1] ?? '';
}

// ─── OCR pipeline ─────────────────────────────────────────────────────────
/**
 * Two-pass Tesseract scan on targeted card regions:
 *
 *   Pass 1 — Name strip  (top 20 % of card area, PSM 7 = single text line)
 *             The Pokémon name is always in the top band of the card.
 *
 *   Pass 2 — Number strip (bottom 11 % of card area, PSM 7, digits+"/")
 *             The collector number e.g. "58/102" is in the bottom corner.
 *
 * Targeting specific strips before OCR instead of running on the full frame
 * eliminates false positives from HP, attack names, ability text, etc.
 * Both passes share one Tesseract worker to minimise WASM init overhead.
 *
 * Card region approximation: centre 62 % × 74 % of the captured frame.
 * Because the guide overlay is always centred this approximation holds
 * across portrait/landscape and different camera resolutions.
 */
async function analyzeCard(
  fullCanvas: HTMLCanvasElement,
  onProgress: (pct: number) => void
): Promise<Detection> {
  const W = fullCanvas.width;
  const H = fullCanvas.height;

  // Card crop (centre region)
  const cx = Math.round(W * 0.19);
  const cy = Math.round(H * 0.13);
  const cw = Math.round(W * 0.62);
  const ch = Math.round(H * 0.74);
  const cardCanvas = cropToCanvas(fullCanvas, cx, cy, cw, ch);

  const nameCanvas   = cropToCanvas(cardCanvas, 0, 0,                      cw, Math.round(ch * 0.20));
  const numberCanvas = cropToCanvas(cardCanvas, 0, Math.round(ch * 0.89), cw, Math.round(ch * 0.11));

  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress(Math.round(m.progress * 100));
    },
  });

  // Pass 1 — name (single line, no character whitelist)
  await worker.setParameters({ tessedit_pageseg_mode: '7' });
  const nameResult = await worker.recognize(nameCanvas);
  onProgress(50);

  // Pass 2 — collector number (digits + "/" only)
  await worker.setParameters({
    tessedit_pageseg_mode: '7',
    tessedit_char_whitelist: '0123456789/',
  });
  const numResult = await worker.recognize(numberCanvas);
  onProgress(100);

  await worker.terminate();

  const name   = parsePokemonName(nameResult.data.text);
  const number = parseCollectorNumber(numResult.data.text);

  return {
    name,
    number,
    confidence: name && number ? 'high' : name ? 'medium' : 'low',
  };
}

// ─── Search strategy ──────────────────────────────────────────────────────
/**
 * Progressively looser queries until results are found:
 *   1. name + full number  ("Pikachu" + "58/102") → up to 6 — usually the exact card
 *   2. name + bare number  ("Pikachu" + "58")     → catches mis-read set totals
 *   3. name alone          ("Pikachu")             → 12 results for the user to pick
 */
async function searchByDetection(name: string, number: string): Promise<PokemonCard[]> {
  if (!name.trim()) return [];

  if (number) {
    const r1 = await searchCards({ name, number, pageSize: 6 });
    if (r1.data.length > 0) return r1.data;

    const bare = number.split('/')[0];
    if (bare !== number) {
      const r2 = await searchCards({ name, number: bare, pageSize: 6 });
      if (r2.data.length > 0) return r2.data;
    }
  }

  const r3 = await searchCards({ name, pageSize: 12 });
  return r3.data;
}

// ─── Component ────────────────────────────────────────────────────────────
export default function ScanPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { addCard, collectionCards } = useCollectionStore();

  const [scanState, setScanState]         = useState<ScanState>('idle');
  const [facingMode, setFacingMode]       = useState<'environment' | 'user'>('environment');
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress]     = useState(0);
  const [detection, setDetection]         = useState<Detection | null>(null);
  const [manualName, setManualName]       = useState('');
  const [manualNumber, setManualNumber]   = useState('');
  const [results, setResults]             = useState<PokemonCard[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addedIds, setAddedIds]           = useState<Set<string>>(new Set());

  const videoRef    = useRef<HTMLVideoElement | null>(null);
  const captureRef  = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const isCapturing = useRef(false);

  // ── Callback ref — the correct fix for the camera blank screen bug ─────
  //
  // Root cause: the <video> is only rendered when scanState === 'live'.
  // startCamera() obtains the stream first, then calls setScanState('live').
  // With a plain ref, videoRef.current is still null at that point because
  // the element hasn't mounted yet, so srcObject is never attached.
  //
  // The callback ref fires synchronously the moment React mounts the element
  // — which is after setScanState('live') triggers the re-render. By that
  // point streamRef.current already holds the live stream, so we can attach
  // it immediately. play() is called explicitly because several Android
  // Chrome builds ignore the `autoPlay` attribute on dynamically wired streams.
  const videoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      node.play().catch(() => {}); // may be blocked by autoplay policy; that's ok
    }
  }, []);

  // Cleanup on unmount
  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);
  useEffect(() => () => stopStream(), [stopStream]);

  // ── Camera start ──────────────────────────────────────────────────────
  const startCamera = useCallback(async (facing: 'environment' | 'user' = facingMode) => {
    setScanState('requesting');
    stopStream();
    try {
      // Use the plain string form of facingMode (not {ideal:…}).
      // More compatible with Android Chrome and older mobile WebKit.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      // setState → React re-renders → <video> mounts → videoCallbackRef fires
      //          → srcObject assigned → play() called
      setScanState('live');
    } catch {
      setScanState('cam-error');
    }
  }, [facingMode, stopStream]);

  const flipCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  };

  // ── Capture & two-pass OCR ────────────────────────────────────────────
  const capture = async () => {
    if (isCapturing.current) return;
    const video  = videoRef.current;
    const canvas = captureRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    isCapturing.current = true;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedDataUrl(dataUrl);
    stopStream();
    setScanState('processing');
    setOcrProgress(0);

    try {
      const det = await analyzeCard(canvas, setOcrProgress);
      setDetection(det);
      setManualName(det.name);
      setManualNumber(det.number);

      setSearchLoading(true);
      setScanState('results');
      const cards = await searchByDetection(det.name, det.number);
      setResults(cards);
    } catch {
      setDetection(null);
      setScanState('results');
      setResults([]);
    } finally {
      setSearchLoading(false);
      isCapturing.current = false;
    }
  };

  // ── Manual re-search ──────────────────────────────────────────────────
  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() && !manualNumber.trim()) return;
    setSearchLoading(true);
    try {
      setResults(await searchByDetection(manualName, manualNumber));
    } catch {
      setResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAdd = async (card: PokemonCard) => {
    if (!user) return;
    await addCard(card, user.id);
    setAddedIds(prev => new Set(prev).add(card.id));
  };

  const reset = () => {
    stopStream();
    setCapturedDataUrl(null);
    setDetection(null);
    setManualName('');
    setManualNumber('');
    setResults([]);
    setOcrProgress(0);
    setAddedIds(new Set());
    isCapturing.current = false;
    setScanState('idle');
  };

  const confidenceMeta = {
    high:   { label: 'Name + number detected',          cls: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
    medium: { label: 'Name detected (no number)',        cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
    low:    { label: 'Nothing detected — search manually', cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  } as const;

  // Hidden canvas used for capture — always mounted so captureRef is stable
  const hiddenCanvas = (
    <canvas ref={captureRef} className="absolute w-0 h-0 pointer-events-none opacity-0" />
  );

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Header ── */}
      <div className="sticky top-16 md:top-0 z-20 bg-background -mx-4 md:-mx-8 px-4 md:px-8 pt-4 md:pt-6 pb-3 border-b border-border flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => { reset(); setLocation('/search'); }} className="shrink-0">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight leading-none">Scan Card</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {scanState === 'live'
              ? 'Align card in the frame — name at top, number at bottom'
              : 'Point camera at a Pokémon card'}
          </p>
        </div>
        {scanState !== 'idle' && scanState !== 'cam-error' && scanState !== 'requesting' && (
          <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={reset}>
            <RefreshCw className="h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </div>

      {hiddenCanvas}

      <div className="flex-1 pt-4 space-y-4">

        {/* ── IDLE ── */}
        {scanState === 'idle' && (
          <motion.div
            className="flex flex-col items-center justify-center gap-6 py-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <Scan className="w-12 h-12 text-primary" />
            </div>
            <div className="text-center space-y-2 max-w-xs px-4">
              <p className="font-semibold text-lg">Ready to scan</p>
              <p className="text-sm text-muted-foreground">
                Hold your card in good lighting. The scanner reads the card name and collector
                number together for accurate identification.
              </p>
            </div>
            <Button size="lg" className="gap-2 px-8" onClick={() => startCamera()}>
              <Camera className="h-5 w-5" />
              Start Camera
            </Button>
          </motion.div>
        )}

        {/* ── REQUESTING PERMISSION ── */}
        {scanState === 'requesting' && (
          <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Requesting camera access…</p>
          </div>
        )}

        {/* ── CAMERA ERROR ── */}
        {scanState === 'cam-error' && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <AlertCircle className="w-12 h-12 text-destructive" />
            <div>
              <p className="font-semibold">Camera access denied</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Allow camera access in your browser settings, then try again.
              </p>
            </div>
            <Button onClick={() => startCamera()} variant="outline">Try Again</Button>
          </div>
        )}

        {/* ── LIVE CAMERA ── */}
        {scanState === 'live' && (
          <div className="space-y-3">
            <div className="relative w-full overflow-hidden rounded-xl bg-black aspect-[4/3] md:aspect-[16/9]">
              {/*
                The <video> is ONLY rendered here — no duplicate elsewhere.
                videoCallbackRef fires the moment this element mounts, which
                is always after streamRef.current is already set, so srcObject
                is assigned immediately and play() is called right away.
              */}
              <video
                ref={videoCallbackRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Card-frame guide overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="w-40 h-[224px] md:w-48 md:h-[268px] rounded-xl border-2 border-green-400 z-10"
                  style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }}
                >
                  <span className="absolute -top-0.5 -left-0.5  w-5 h-5 border-t-4 border-l-4 border-green-400 rounded-tl" />
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-4 border-r-4 border-green-400 rounded-tr" />
                  <span className="absolute -bottom-0.5 -left-0.5  w-5 h-5 border-b-4 border-l-4 border-green-400 rounded-bl" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-4 border-r-4 border-green-400 rounded-br" />

                  {/* Zone labels */}
                  <div className="absolute top-1 inset-x-0 flex justify-center">
                    <span className="text-[9px] text-green-300/80 bg-black/40 rounded px-1.5 py-0.5">NAME</span>
                  </div>
                  <div className="absolute bottom-1 inset-x-0 flex justify-center">
                    <span className="text-[9px] text-green-300/80 bg-black/40 rounded px-1.5 py-0.5">NUMBER</span>
                  </div>
                </div>
              </div>

              <p className="absolute bottom-12 inset-x-0 text-center text-xs text-white/70 pointer-events-none">
                Align card within the frame
              </p>

              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3 bg-black/40 text-white hover:bg-black/60"
                onClick={flipCamera}
              >
                <FlipVertical className="h-4 w-4" />
              </Button>
            </div>

            <Button size="lg" className="w-full gap-2" onClick={capture}>
              <Camera className="h-5 w-5" />
              Capture
            </Button>
          </div>
        )}

        {/* ── PROCESSING / OCR ── */}
        {scanState === 'processing' && (
          <div className="space-y-4">
            {capturedDataUrl && (
              <div className="relative rounded-xl overflow-hidden w-full max-h-52 bg-black flex items-center justify-center">
                <img
                  src={capturedDataUrl}
                  alt="Captured"
                  className="max-h-52 w-auto object-contain opacity-60"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="w-9 h-9 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-white text-sm font-semibold">
                    Reading card… {ocrProgress}%
                  </p>
                  <div className="w-52 h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-200"
                      style={{ width: `${ocrProgress}%` }}
                    />
                  </div>
                  <p className="text-white/60 text-xs">
                    {ocrProgress < 50 ? 'Reading card name…' : 'Reading collector number…'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── RESULTS ── */}
        {scanState === 'results' && (
          <div className="space-y-4">

            {/* Detection summary + editable search */}
            <Card className="border-border">
              <CardContent className="p-3 space-y-3">
                <div className="flex gap-3 items-start">
                  {capturedDataUrl && (
                    <img
                      src={capturedDataUrl}
                      alt="Captured"
                      className="w-14 rounded-lg border border-border shrink-0 object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0 space-y-2">
                    {detection && (
                      <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${confidenceMeta[detection.confidence].cls}`}>
                        {confidenceMeta[detection.confidence].label}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5">
                      <SearchIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <Input
                        value={manualName}
                        onChange={e => setManualName(e.target.value)}
                        placeholder="Pokémon name…"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <Input
                        value={manualNumber}
                        onChange={e => setManualNumber(e.target.value)}
                        placeholder="Collector number (e.g. 58/102)…"
                        className="h-8 text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>

                <form onSubmit={handleManualSearch}>
                  <Button type="submit" size="sm" className="w-full gap-1.5" disabled={searchLoading}>
                    <SearchIcon className="h-3.5 w-3.5" />
                    {searchLoading ? 'Searching…' : 'Search'}
                  </Button>
                </form>
                <p className="text-xs text-muted-foreground text-center">
                  Edit either field above if the results don't match
                </p>
              </CardContent>
            </Card>

            {/* Results grid */}
            <AnimatePresence mode="wait">
              {searchLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-[63/88] rounded-lg" />
                  ))}
                </div>
              ) : results.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl">
                  {manualName
                    ? `No cards found — try editing the name or number above`
                    : 'Enter a card name above to search'}
                </div>
              ) : (
                <motion.div
                  className="grid grid-cols-2 sm:grid-cols-3 gap-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {results.map((card) => {
                    const isAdded = addedIds.has(card.id) || !!collectionCards[card.id];
                    const owned   = collectionCards[card.id];
                    return (
                      <motion.div
                        key={card.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative"
                      >
                        <Card className="overflow-hidden border-border h-full flex flex-col">
                          <CardContent className="p-1.5 space-y-1.5 flex flex-col flex-1">
                            <img
                              src={card.images.small}
                              alt={card.name}
                              className="w-full rounded object-contain aspect-[63/88]"
                              loading="lazy"
                              decoding="async"
                            />
                            <div className="px-0.5 flex-1">
                              <p className="text-xs font-semibold truncate">{card.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {card.set.name} · {card.number}
                              </p>
                              {card.rarity && (
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 mt-0.5">
                                  {card.rarity}
                                </Badge>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant={isAdded ? 'secondary' : 'default'}
                              className="w-full h-7 text-xs gap-1"
                              onClick={() => !isAdded && handleAdd(card)}
                              disabled={!user}
                            >
                              {isAdded ? (
                                <><CheckCircle2 className="h-3 w-3" />{owned?.quantity ? `×${owned.quantity}` : 'Added'}</>
                              ) : (
                                <><Plus className="h-3 w-3" />Add</>
                              )}
                            </Button>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
