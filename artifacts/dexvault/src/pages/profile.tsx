import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useCollectionStore } from '@/store/collectionStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Copy, ExternalLink } from 'lucide-react';

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

// Separate SQL block so users can run it independently once the core schema exists.
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

export default function Profile() {
  const { user, signOut } = useAuth();
  const { dbSetupRequired, fetchCollection } = useCollectionStore();

  const handleRetry = () => {
    if (user) fetchCollection(user.id);
  };

  return (
    <div className="flex flex-col">
      <div className="sticky top-16 md:top-0 z-20 bg-background -mx-4 md:-mx-8 px-4 md:px-8 pt-4 md:pt-8 pb-4 border-b border-border">
        <h1 className="text-3xl font-bold tracking-tight mb-1">Profile</h1>
        <p className="text-muted-foreground">Manage your account and database setup.</p>
      </div>

      <div className="pt-6 space-y-6 max-w-2xl">
        {/* Account */}
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

        {/* Core schema (shown when DB isn't set up yet) */}
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

        {/* Shared card cache — always shown so users can opt in */}
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
    </div>
  );
}
