import { useAuth } from '@/hooks/use-auth';
import { useCollectionStore } from '@/store/collectionStore';
import { useCollectionValue } from '@/hooks/use-collection-value';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Library, Star, Target, TrendingUp, AlertTriangle, ExternalLink } from 'lucide-react';
import { Redirect, Link } from 'wouter';

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
    <div className="flex flex-col gap-4 md:gap-8 pt-4 md:pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1">Dashboard</h1>
        <p className="text-sm md:text-base text-muted-foreground">Overview of your collection.</p>
      </div>

      {dbSetupRequired && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 md:p-4 flex items-start gap-2 md:gap-4">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">Database setup required</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 hidden md:block">
              Your Supabase project needs the Vault151 tables before you can save cards.
            </p>
          </div>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline shrink-0"
          >
            Fix <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="transition-all border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1 md:pb-2 space-y-0 px-3 pt-3 md:px-6 md:pt-6">
            <CardTitle className="text-xs md:text-sm font-medium text-red-600 dark:text-red-500">Total Cards</CardTitle>
            <Library className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-600 dark:text-red-500 shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
            {collectionLoading ? (
              <div className="h-7 w-14 bg-muted rounded animate-pulse" />
            ) : (
              <>
                <Link href="/collection">
                  <div className="text-xl md:text-2xl font-bold hover:underline cursor-pointer w-fit" data-testid="text-total-cards">
                    {totalCards}
                  </div>
                </Link>
                <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">{uniqueCards} unique prints</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="transition-all border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1 md:pb-2 space-y-0 px-3 pt-3 md:px-6 md:pt-6">
            <CardTitle className="text-xs md:text-sm font-medium text-green-600 dark:text-green-500">Est. Value</CardTitle>
            <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-600 dark:text-green-500 shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
            {valueLoading ? (
              <div className="h-7 w-20 bg-muted rounded animate-pulse" />
            ) : (
              <>
                <div className="text-xl md:text-2xl font-bold font-mono" data-testid="text-collection-value">
                  {hasData ? `$${totalValue.toFixed(2)}` : '--'}
                </div>
                <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
                  {hasData ? 'TCGPlayer market' : 'No price data'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="transition-all border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1 md:pb-2 space-y-0 px-3 pt-3 md:px-6 md:pt-6">
            <CardTitle className="text-xs md:text-sm font-medium text-yellow-600 dark:text-yellow-500">Favourites</CardTitle>
            <Star className="w-3.5 h-3.5 md:w-4 md:h-4 text-yellow-600 dark:text-yellow-500 fill-yellow-500/20 shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
            {collectionLoading ? (
              <div className="h-7 w-8 bg-muted rounded animate-pulse" />
            ) : (
              <>
                <Link href="/collection?tab=favourites">
                  <div className="text-xl md:text-2xl font-bold hover:underline cursor-pointer w-fit" data-testid="text-favorite-count">
                    {favoriteCards}
                  </div>
                </Link>
                <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">Starred cards</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="transition-all border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1 md:pb-2 space-y-0 px-3 pt-3 md:px-6 md:pt-6">
            <CardTitle className="text-xs md:text-sm font-medium text-blue-600 dark:text-blue-500">Wishlist</CardTitle>
            <Target className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-600 dark:text-blue-500 shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
            {collectionLoading ? (
              <div className="h-7 w-8 bg-muted rounded animate-pulse" />
            ) : (
              <>
                <Link href="/collection?tab=wishlist">
                  <div className="text-xl md:text-2xl font-bold hover:underline cursor-pointer w-fit" data-testid="text-wishlist-count">
                    {wishlistedCards}
                  </div>
                </Link>
                <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">Cards hunting</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
