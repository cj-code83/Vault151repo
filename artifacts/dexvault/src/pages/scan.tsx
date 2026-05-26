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
} from 'lucide-react';
import { searchCards } from '@/services/pokemonTcg';
import { useCollectionStore } from '@/store/collectionStore';
import { useAuth } from '@/hooks/use-auth';
import { PokemonCard } from '@/types/pokemon';
import { motion, AnimatePresence } from 'framer-motion';

type ScanState = 'idle' | 'live' | 'captured' | 'ocr' | 'results' | 'cam-error';

function parseCardNameFromOCR(text: string): string {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && l.length < 40);

  // Card name is typically the first line that looks like a proper name
  // (starts with capital letter, mostly alphabetic, not HP/Stage/etc)
  const skip = /^(hp|stage|basic|level|ex|gx|v|vmax|vstar|item|trainer|supporter|stadium|\d)/i;
  const candidate = lines.find((l) => /^[A-ZÀ-Ü][a-zà-ü]/.test(l) && !skip.test(l));
  return candidate ?? lines[0] ?? '';
}

export default function ScanPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { addCard, collectionCards } = useCollectionStore();

  const [scanState, setScanState] = useState<ScanState>('idle');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrText, setOcrText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<PokemonCard[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  const startCamera = async (facing: 'environment' | 'user' = facingMode) => {
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setScanState('live');
    } catch {
      setScanState('cam-error');
    }
  };

  const flipCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  };

  const capture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(imageData);
    stopStream();
    setScanState('ocr');
    setOcrProgress(0);

    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });
      const {
        data: { text },
      } = await worker.recognize(imageData);
      await worker.terminate();

      setOcrText(text);
      const name = parseCardNameFromOCR(text);
      setSearchQuery(name);
      await runSearch(name);
    } catch {
      // OCR failed — go straight to manual search
      setScanState('results');
      setResults([]);
    }
  };

  const runSearch = async (query: string) => {
    if (!query.trim()) {
      setScanState('results');
      return;
    }
    setSearchLoading(true);
    setScanState('results');
    try {
      const res = await searchCards({ name: query.trim(), pageSize: 12 });
      setResults(res.data);
    } catch {
      setResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(searchQuery);
  };

  const handleAdd = async (card: PokemonCard) => {
    if (!user) return;
    await addCard(card, user.id);
    setAddedIds((prev) => new Set(prev).add(card.id));
  };

  const reset = () => {
    setCapturedImage(null);
    setResults([]);
    setSearchQuery('');
    setOcrText('');
    setOcrProgress(0);
    setAddedIds(new Set());
    setScanState('idle');
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="sticky top-16 md:top-0 z-20 bg-background -mx-4 md:-mx-8 px-4 md:px-8 pt-4 md:pt-6 pb-3 border-b border-border flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/search')} className="shrink-0">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight leading-none">Scan Card</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Point camera at a Pokémon card</p>
        </div>
        {scanState !== 'idle' && scanState !== 'cam-error' && (
          <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={reset}>
            <RefreshCw className="h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </div>

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
            <div className="text-center space-y-1">
              <p className="font-semibold text-lg">Ready to scan</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Hold your card steady in good lighting. We'll detect the name and find it in the
                database.
              </p>
            </div>
            <Button size="lg" className="gap-2 px-8" onClick={() => startCamera()}>
              <Camera className="h-5 w-5" />
              Start Camera
            </Button>
          </motion.div>
        )}

        {/* ── CAMERA ERROR ── */}
        {scanState === 'cam-error' && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <AlertCircle className="w-12 h-12 text-destructive" />
            <div>
              <p className="font-semibold">Camera access denied</p>
              <p className="text-sm text-muted-foreground mt-1">
                Allow camera access in your browser settings, then try again.
              </p>
            </div>
            <Button onClick={() => startCamera()} variant="outline">
              Try Again
            </Button>
          </div>
        )}

        {/* ── LIVE CAMERA ── */}
        {scanState === 'live' && (
          <div className="space-y-4">
            <div className="relative w-full overflow-hidden rounded-xl bg-black aspect-[4/3] md:aspect-[16/9]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Card-frame overlay — spotlight effect */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="w-40 h-[224px] md:w-48 md:h-[268px] rounded-xl border-2 border-green-400 z-10"
                  style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }}
                >
                  {/* Corner accent marks */}
                  <span className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-4 border-l-4 border-green-400 rounded-tl" />
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-4 border-r-4 border-green-400 rounded-tr" />
                  <span className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-4 border-l-4 border-green-400 rounded-bl" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-4 border-r-4 border-green-400 rounded-br" />
                </div>
              </div>

              {/* Guide label */}
              <p className="absolute bottom-14 inset-x-0 text-center text-xs text-white/80 pointer-events-none">
                Align card within the frame
              </p>

              {/* Flip camera button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3 bg-black/40 text-white hover:bg-black/60"
                onClick={flipCamera}
              >
                <FlipVertical className="h-4 w-4" />
              </Button>
            </div>

            {/* Hidden canvas for capturing */}
            <canvas ref={canvasRef} className="hidden" />

            <Button size="lg" className="w-full gap-2" onClick={capture}>
              <Camera className="h-5 w-5" />
              Capture
            </Button>
          </div>
        )}

        {/* ── OCR PROCESSING ── */}
        {scanState === 'ocr' && (
          <div className="space-y-4">
            {capturedImage && (
              <div className="relative rounded-xl overflow-hidden w-full max-h-48 bg-black flex items-center justify-center">
                <img src={capturedImage} alt="Captured" className="max-h-48 w-auto object-contain" />
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-white text-sm font-medium">Reading card… {ocrProgress}%</p>
                  <div className="w-48 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${ocrProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
            <p className="text-center text-sm text-muted-foreground">
              Extracting text — this takes a few seconds…
            </p>
          </div>
        )}

        {/* ── RESULTS ── */}
        {scanState === 'results' && (
          <div className="space-y-4">
            {/* Captured image thumbnail */}
            {capturedImage && (
              <div className="flex gap-3 items-start">
                <img
                  src={capturedImage}
                  alt="Captured card"
                  className="w-16 rounded-lg border border-border shrink-0 object-cover"
                />
                <div className="flex-1 min-w-0">
                  {ocrText && (
                    <p className="text-xs text-muted-foreground mb-1">
                      Detected:{' '}
                      <span className="font-medium text-foreground">
                        {ocrText.split('\n')[0]?.trim() || '—'}
                      </span>
                    </p>
                  )}
                  <form onSubmit={handleManualSearch} className="flex gap-2">
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Card name…"
                      className="h-9 text-sm flex-1"
                    />
                    <Button type="submit" size="icon" className="h-9 w-9 shrink-0">
                      <SearchIcon className="h-4 w-4" />
                    </Button>
                  </form>
                  <p className="text-xs text-muted-foreground mt-1">
                    Edit and search if the name isn't right
                  </p>
                </div>
              </div>
            )}

            {/* Inline search when no capture */}
            {!capturedImage && (
              <form onSubmit={handleManualSearch} className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by card name…"
                  className="flex-1"
                  autoFocus
                />
                <Button type="submit" size="icon">
                  <SearchIcon className="h-4 w-4" />
                </Button>
              </form>
            )}

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
                  {searchQuery
                    ? `No cards found for "${searchQuery}"`
                    : 'Search for a card above'}
                </div>
              ) : (
                <motion.div
                  className="grid grid-cols-2 sm:grid-cols-3 gap-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {results.map((card) => {
                    const isAdded = addedIds.has(card.id) || !!collectionCards[card.id];
                    const owned = collectionCards[card.id];
                    return (
                      <motion.div
                        key={card.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative group"
                      >
                        <Card className="overflow-hidden border-border">
                          <CardContent className="p-1.5 space-y-1.5">
                            <img
                              src={card.images.small}
                              alt={card.name}
                              className="w-full rounded object-contain aspect-[63/88]"
                            />
                            <div className="px-0.5">
                              <p className="text-xs font-semibold truncate">{card.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {card.set.name}
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
                                <>
                                  <CheckCircle2 className="h-3 w-3" />
                                  {owned?.quantity
                                    ? `In Collection (${owned.quantity})`
                                    : 'Added'}
                                </>
                              ) : (
                                <>
                                  <Plus className="h-3 w-3" />
                                  Add
                                </>
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
