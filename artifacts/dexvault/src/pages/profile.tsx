import { useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useCollectionStore } from '@/store/collectionStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, Copy, Download, ExternalLink, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  exportCollection,
  importCollection,
  parseBackupFile,
  CollectionBackup,
  ImportMode,
} from '@/utils/backup';

// ─── SQL snippets shown to users who need to set up their DB ─────────────

const SQL_SCHEMA = `-- Step 1: Create the collection_cards table
create table if not exists collection_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  card_id text not null,
  quantity integer default 1,
  condition text default 'Near Mint',
  is_favorite boolean default false,
  is_wishlisted boolean default false,
  notes text,
  variants jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique(user_id, card_id)
);
alter table collection_cards enable row level security;
create policy "Users manage own cards" on collection_cards
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Step 2: Create the profiles table
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  avatar_url text,
  updated_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Users manage own profile" on profiles
  for all using (auth.uid() = id)
  with check (auth.uid() = id);

-- Step 3: Add variants column if upgrading from an earlier version
alter table collection_cards add column if not exists variants jsonb default '{}'::jsonb;`;

const SQL_CACHE_TABLE = `-- Optional: shared card metadata cache
-- Stores card data fetched from the Pokémon TCG API so repeat lookups
-- are served from Supabase (~80 ms) instead of the external API (~400 ms).
-- All authenticated users can read & write; data is not user-specific.
create table if not exists card_cache (
  card_id  text primary key,
  data     jsonb not null,
  cached_at timestamptz not null default now()
);
alter table card_cache enable row level security;
create policy "card_cache_public_read"  on card_cache for select using (true);
create policy "card_cache_auth_write"   on card_cache for insert
  with check (auth.role() = 'authenticated');
create policy "card_cache_auth_update"  on card_cache for update
  using (auth.role() = 'authenticated');`;

// ─── CopyBlock ─────────────────────────────────────────────────────────────

function CopyBlock({ id, sql }: { id: string; sql: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.getElementById(id);
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }
  };

  return (
    <div className="relative">
      <pre
        id={id}
        className="text-xs bg-amber-100 dark:bg-amber-900/50 rounded-lg p-3 overflow-x-auto font-mono text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800"
      >
        {sql}
      </pre>
      <Button
        size="sm"
        variant="outline"
        className="absolute top-2 right-2 h-7 text-xs border-amber-300 dark:border-amber-600"
        onClick={handleCopy}
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        <span className="ml-1">{copied ? 'Copied' : 'Copy'}</span>
      </Button>
    </div>
  );
}

// ─── Import confirmation dialog ────────────────────────────────────────────

interface ImportDialogProps {
  backup:    CollectionBackup | null;
  onChoose:  (mode: ImportMode) => void;
  onCancel:  () => void;
  loading:   boolean;
}

function ImportDialog({ backup, onChoose, onCancel, loading }: ImportDialogProps) {
  return (
    <Dialog open={!!backup} onOpenChange={(open) => { if (!open && !loading) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Collection</DialogTitle>
          <DialogDescription>
            How would you like to import this collection?
            {backup && (
              <span className="block mt-1 font-medium text-foreground">
                {backup.cards.length} cards · exported {new Date(backup.exportDate).toLocaleDateString()}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Merge option */}
          <button
            disabled={loading}
            onClick={() => onChoose('merge')}
            className="w-full text-left rounded-lg border border-border hover:border-primary/60 hover:bg-primary/5 p-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <p className="font-semibold text-sm">Merge With Existing Collection</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add or overwrite cards from the backup. Cards not in the file are kept as-is.
            </p>
          </button>

          {/* Replace option */}
          <button
            disabled={loading}
            onClick={() => onChoose('replace')}
            className="w-full text-left rounded-lg border border-destructive/40 hover:border-destructive hover:bg-destructive/5 p-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <p className="font-semibold text-sm text-destructive">Replace Existing Collection</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Delete your current collection and replace it entirely with the backup.
              This cannot be undone — export first if you want to keep a copy.
            </p>
          </button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Importing…
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function Profile() {
  const { user, signOut } = useAuth();
  const { dbSetupRequired, fetchCollection } = useCollectionStore();

  // ── Backup state ───────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting]         = useState(false);
  const [importing, setImporting]         = useState(false);
  const [pendingBackup, setPendingBackup] = useState<CollectionBackup | null>(null);

  const handleRetry = () => {
    if (user) fetchCollection(user.id);
  };

  // ── Export ─────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!user) return;
    setExporting(true);
    try {
      await exportCollection(user.id);
    } finally {
      setExporting(false);
    }
  };

  // ── Import: open file picker ───────────────────────────────────────────
  const handleImportClick = () => {
    if (!user) return;
    fileInputRef.current?.click();
  };

  // ── Import: file selected — parse & validate, then show dialog ────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input so the same file can be re-selected after cancellation
    e.target.value = '';
    if (!file || !user) return;

    try {
      const backup = await parseBackupFile(file);
      setPendingBackup(backup);
    } catch (err) {
      toast.error('Invalid backup file', {
        description: err instanceof Error ? err.message : 'Could not parse file.',
      });
    }
  };

  // ── Import: user chose merge or replace ───────────────────────────────
  const handleImportChoose = async (mode: ImportMode) => {
    if (!user || !pendingBackup) return;
    setImporting(true);
    try {
      const ok = await importCollection(user.id, pendingBackup, mode);
      if (ok) {
        setPendingBackup(null);
        // Refresh the in-memory collection store so the UI reflects the import immediately
        await fetchCollection(user.id);
      }
    } finally {
      setImporting(false);
    }
  };

  const handleImportCancel = () => {
    if (!importing) setPendingBackup(null);
  };

  return (
    <div className="flex flex-col">
      <div className="sticky top-16 md:top-0 z-20 bg-background -mx-4 md:-mx-8 px-4 md:px-8 pt-4 md:pt-8 pb-4 border-b border-border">
        <h1 className="text-3xl font-bold tracking-tight mb-1">Profile</h1>
        <p className="text-muted-foreground">Manage your account and database setup.</p>
      </div>

      <div className="pt-6 space-y-6 max-w-2xl">
        {/* ── Account ── */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-sm font-medium text-muted-foreground">Email</span>
              <p className="text-base mt-0.5" data-testid="text-user-email">{user?.email}</p>
            </div>
            <Button variant="destructive" onClick={signOut} data-testid="button-sign-out">
              Sign Out
            </Button>
          </CardContent>
        </Card>

        {/* ── Collection Backup ── */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Collection Backup</CardTitle>
            <CardDescription>
              Protect your collection by exporting a backup file that can be restored on any device.
              Backups contain only your card list — never images, pricing, or cache data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Export */}
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleExport}
              disabled={exporting || !user}
            >
              {exporting
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Download className="w-4 h-4" />}
              Export Collection
            </Button>

            {/* Import — hidden file input + visible button */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleImportClick}
              disabled={importing || !user}
            >
              <Upload className="w-4 h-4" />
              Import Collection
            </Button>

            <p className="text-xs text-muted-foreground pt-1">
              Import accepts files exported from this app. Choose between merging with your
              existing collection or replacing it entirely.
            </p>
          </CardContent>
        </Card>

        {/* ── Database setup required ── */}
        {dbSetupRequired && (
          <Card className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40">
            <CardHeader>
              <CardTitle className="text-amber-800 dark:text-amber-300">Database Setup Required</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Run the SQL below in your Supabase SQL editor to create the required tables.
              </p>
              <CopyBlock id="sql-schema-text" sql={SQL_SCHEMA} />
              <div className="flex items-center gap-3">
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline"
                >
                  Open Supabase Dashboard <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <Button size="sm" variant="outline" onClick={handleRetry} className="ml-auto">
                  Retry Connection
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Shared card cache ── */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Shared Card Cache</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Run this SQL once to enable a shared cache table in Supabase. Once active, card detail
              pages load from Supabase (~80 ms) instead of the Pokémon TCG API (~400 ms) for any card
              that has already been looked up by any user — reducing API usage as the app scales.
            </p>
            <p className="text-xs text-muted-foreground">
              The app works without this table — it simply falls back to direct API calls. No images
              are stored; only lightweight JSON metadata is cached.
            </p>
            <CopyBlock id="sql-cache-text" sql={SQL_CACHE_TABLE} />
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Open Supabase Dashboard <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </CardContent>
        </Card>
      </div>

      {/* ── Import mode selection dialog ── */}
      <ImportDialog
        backup={pendingBackup}
        onChoose={handleImportChoose}
        onCancel={handleImportCancel}
        loading={importing}
      />
    </div>
  );
}
