import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useCollectionStore } from '@/store/collectionStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Library, Star, Target, TrendingUp } from 'lucide-react';
import { Redirect } from 'wouter';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { collectionCards, fetchCollection, loading: collectionLoading } = useCollectionStore();

  useEffect(() => {
    if (user) {
      fetchCollection(user.id);
    }
  }, [user, fetchCollection]);

  if (authLoading || collectionLoading) {
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
  const favoriteCards = cardsArray.filter(c => c.isFavorite).length;
  const wishlistedCards = cardsArray.filter(c => c.isWishlisted).length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your collection.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover-elevate transition-all border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cards</CardTitle>
            <Library className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCards}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {uniqueCards} unique prints
            </p>
          </CardContent>
        </Card>
        
        <Card className="hover-elevate transition-all border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Estimated Value</CardTitle>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">--</div>
            <p className="text-xs text-muted-foreground mt-1">
              Market data unavailable
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Favorites</CardTitle>
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500/20" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{favoriteCards}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Starred in collection
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Wishlist</CardTitle>
            <Target className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wishlistedCards}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Cards you're hunting
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Recent Additions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground text-center py-8">
              No recent activity. Search for cards to add them.
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Set Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground text-center py-8">
              Start adding cards to track set progress.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
