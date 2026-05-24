import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useCollectionStore } from '@/store/collectionStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  with check (auth.uid() = id);`;

export default function Profile() {
  const { user, signOut } = useAuth();
  const { dbSetupRequired, fetchCollection } = useCollectionStore();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SQL_SCHEMA);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select the text
      const el = document.getElementById('sql-schema-text');
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }
  };

  const handleRetry = () => {
    if (user) fetchCollection(user.id);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Profile</h1>
        <p className="text-muted-foreground">Manage your account and database setup.</p>
      </div>

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

      <Card className={`border-2 ${dbSetupRequired ? 'border-amber-400 dark:border-amber-600' : 'border-border'}`}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                Database Setup
                {dbSetupRequired && (
                  <span className="text-xs font-semibold bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                    Required
                  </span>
                )}
              </CardTitle>
              <CardDescription className="mt-1.5">
                Run this SQL once in your{' '}
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  Supabase SQL Editor <ExternalLink className="w-3 h-3" />
                </a>
                {' '}to create the tables DexVault needs.
              </CardDescription>
            </div>
            <Button
              variant={copied ? 'secondary' : 'outline'}
              size="sm"
              onClick={handleCopy}
              className="shrink-0"
              data-testid="button-copy-sql"
            >
              {copied ? (
                <><Check className="w-4 h-4 mr-1.5 text-green-500" /> Copied</>
              ) : (
                <><Copy className="w-4 h-4 mr-1.5" /> Copy SQL</>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <pre
            id="sql-schema-text"
            className="bg-muted rounded-lg p-4 overflow-x-auto text-xs font-mono leading-relaxed text-foreground/80 select-all border border-border"
          >
            {SQL_SCHEMA}
          </pre>
          {dbSetupRequired && (
            <div className="mt-4 flex items-center gap-3">
              <p className="text-sm text-amber-700 dark:text-amber-400 flex-1">
                After running the SQL, click Retry to verify the setup.
              </p>
              <Button size="sm" onClick={handleRetry} data-testid="button-retry-setup">
                Retry
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
