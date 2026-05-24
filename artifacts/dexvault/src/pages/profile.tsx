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
    </div>
  );
}
