import { useAuth } from '@/hooks/use-auth';
import { useCollectionStore } from '@/store/collectionStore';
import { useCollectionValue } from '@/hooks/use-collection-value';
import { Card, CardContent } from '@/components/ui/card';
import { Library, Star, Target, TrendingUp, AlertTriangle, ExternalLink } from 'lucide-react';
import { Redirect, Link } from 'wouter';

function StatCard({
  title,
  icon: Icon,
  color,
  value,
  sub,
  href,
  loading,
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  value: string | number;
  sub: string;
  href?: string;
  loading?: boolean;
}) {
  const number = loading ? (
    <div className="h-7 w-16 bg-muted rounded animate-pulse" />
  ) : href ? (
    <Link href={href}>
      <span className="text-2xl font-bold hover:underline cursor-pointer tabular-nums">{value}</span>
    </Link>
  ) : (
    <span className="text-2xl font-bold tabular-nums">{value}</span>
  );

  return (
    <Card className="border-border shadow-sm">
      <CardContent className="px-4 py-3 md:px-6 md:py-4">
        {/* Mobile: icon+label left, number right */}
        {/* Desktop: stacked */}
        <div className="flex items-center justify-between md:block">
          <div className="flex items-center gap-2 md:justify-between md:mb-2">
            <Icon className={`w-4 h-4 shrink-0 ${color}`} />
            <span className={`text-sm font-medium ${color}`}>{title}</span>
          </div>
          <div className="md:mt-0 text-right md:text-left">
            {number}
            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 hidden md:block">{sub}</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5 md:hidden">{sub}</p>
      </CardContent>
    </Card>
  );
}

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
  const totalCards = cardsArray.reduce((acc, card) => {
    const vTotal = Object.values(card.variants ?? {}).reduce((s, v) => s + v, 0);
    return acc + card.quantity + vTotal;
  }, 0);
  const uniqueCards = cardsArray.filter(
    (c) => c.quantity > 0 || Object.values(c.variants ?? {}).some((v) => v > 0)
  ).length;
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

      {/* 1-column on mobile, 4-column on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard
          title="Total Cards"
          icon={Library}
          color="text-red-600 dark:text-red-500"
          value={totalCards}
          sub={`${uniqueCards} unique prints`}
          href="/collection"
          loading={collectionLoading}
        />
        <StatCard
          title="Est. Value"
          icon={TrendingUp}
          color="text-green-600 dark:text-green-500"
          value={hasData ? `$${totalValue.toFixed(2)}` : '--'}
          sub={hasData ? 'TCGPlayer market' : 'No price data'}
          loading={valueLoading}
        />
        <StatCard
          title="Favourites"
          icon={Star}
          color="text-yellow-600 dark:text-yellow-500"
          value={favoriteCards}
          sub="Starred cards"
          href="/collection?tab=favourites"
          loading={collectionLoading}
        />
        <StatCard
          title="Wishlist"
          icon={Target}
          color="text-blue-600 dark:text-blue-500"
          value={wishlistedCards}
          sub="Cards hunting"
          href="/collection?tab=wishlist"
          loading={collectionLoading}
        />
      </div>
    </div>
  );
}
