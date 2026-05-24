import { useAuth } from '@/hooks/use-auth';
import { useCollectionStore } from '@/store/collectionStore';
import { useCollectionValue } from '@/hooks/use-collection-value';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Library, Star, Target, TrendingUp, AlertTriangle, ExternalLink } from 'lucide-react';
import { Redirect, Link } from 'wouter';
import { Button } from '@/components/ui/button';

const SQL_SETUP = `-- Run this in your Supabase project's SQL editor

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
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  avatar_url text,
  updated_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Users manage own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);`;

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { collectionCards, loading: collectionLoading, dbSetupRequired } = useCollectionStore();
  const { totalValue, isLoading: valueLoading, hasData } = useCollectionValue();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/" />;
  }

  const cardsArray = Object.values(collectionCards);
  const totalCards = cardsArray.reduce((acc, card) => acc + card.quantity, 0);
  const uniqueCards = cardsArray.length;
  const favoriteCards = cardsArray.filter((c) => c.isFavorite).length;
  const wishlistedCards = cardsArray.filter((c) => c.isWishlisted).length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your collection.</p>
      </div>

      {dbSetupRequired && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-4 flex flex-col sm:flex-row gap-4">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-800 dark:text-amber-300">Database setup required</p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              Your Supabase project needs the DexVault tables before you can save cards. Copy the SQL below and run it in your Supabase SQL editor.
            </p>
            <pre className="mt-3 text-xs bg-amber-100 dark:bg-amber-900/50 rounded-lg p-3 overflow-x-auto font-mono text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
              {SQL_SETUP}
            </pre>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline"
            >
              Open Supabase Dashboard <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover-elevate transition-all border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cards</CardTitle>
            <Library className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            {collectionLoading ? (
              <div className="h-8 w-16 bg-muted rounded animate-pulse" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-total-cards">{totalCards}</div>
                <p className="text-xs text-muted-foreground mt-1">{uniqueCards} unique prints</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Estimated Value</CardTitle>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {valueLoading ? (
              <div className="h-8 w-24 bg-muted rounded animate-pulse" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono" data-testid="text-collection-value">
                  {hasData ? `$${totalValue.toFixed(2)}` : '--'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {hasData ? 'TCGPlayer market price' : 'No price data available'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Favorites</CardTitle>
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500/20" />
          </CardHeader>
          <CardContent>
            {collectionLoading ? (
              <div className="h-8 w-8 bg-muted rounded animate-pulse" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-favorite-count">{favoriteCards}</div>
                <p className="text-xs text-muted-foreground mt-1">Starred in collection</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Wishlist</CardTitle>
            <Target className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {collectionLoading ? (
              <div className="h-8 w-8 bg-muted rounded animate-pulse" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-wishlist-count">{wishlistedCards}</div>
                <p className="text-xs text-muted-foreground mt-1">Cards you're hunting</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Recent Additions</CardTitle>
          </CardHeader>
          <CardContent>
            {collectionLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : cardsArray.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                No cards yet.{' '}
                <Link href="/search" className="text-primary hover:underline">Search for cards</Link>
                {' '}to add them.
              </div>
            ) : (
              <div className="space-y-2">
                {[...cardsArray]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 5)
                  .map((c) => (
                    <div key={c.cardId} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                      <span className="font-mono text-xs text-muted-foreground truncate">{c.cardId}</span>
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">×{c.quantity}</span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex items-center justify-between flex-row">
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/search" data-testid="link-search-cards">
                <Library className="w-4 h-4 mr-2" /> Search Cards
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/sets" data-testid="link-browse-sets">
                <Target className="w-4 h-4 mr-2" /> Browse Sets
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/collection" data-testid="link-my-collection">
                <Star className="w-4 h-4 mr-2" /> My Collection
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
