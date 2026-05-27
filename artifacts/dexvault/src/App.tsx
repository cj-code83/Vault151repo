import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";

import { Layout } from "@/components/layout";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Search from "@/pages/search";
import Sets from "@/pages/sets";
import SetDetail from "@/pages/set-detail";
import Collection from "@/pages/collection";
import Profile from "@/pages/profile";
import CardDetail from "@/pages/card-detail";
import ScanPage from "@/pages/scan";
import { useAuth } from "@/hooks/use-auth";
import { useCollectionStore } from "@/store/collectionStore";
import { localStoragePersister, CACHE_BUSTER } from "@/lib/queryPersister";

// ─── React Query client ────────────────────────────────────────────────────
// gcTime is set to 24 h so that the persister has a chance to write every
// query to localStorage before it is garbage-collected from memory.
// Without this, a query could be evicted from memory before the serialiser
// runs, leaving an incomplete picture in localStorage.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,       // 5 min — reuse data without refetching
      gcTime:    24 * 60 * 60 * 1000, // 24 h — keep in memory so persister can save it
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

// ─── Scroll to top on navigation ──────────────────────────────────────────
function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location]);
  return null;
}

// ─── Collection hydration ──────────────────────────────────────────────────
function CollectionInitializer() {
  const { user } = useAuth();
  const fetchCollection = useCollectionStore((s) => s.fetchCollection);

  useEffect(() => {
    if (user) fetchCollection(user.id);
  }, [user?.id, fetchCollection]);

  return null;
}

// ─── Auth guard ────────────────────────────────────────────────────────────
const ProtectedRoute = ({ component: Component, ...rest }: any) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Redirect to="/" />;
  return <Component {...rest} />;
};

// ─── Router ────────────────────────────────────────────────────────────────
function Router() {
  return (
    <Layout>
      <ScrollToTop />
      <CollectionInitializer />
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
        <Route path="/search"><ProtectedRoute component={Search} /></Route>
        <Route path="/scan"><ProtectedRoute component={ScanPage} /></Route>
        <Route path="/sets"><ProtectedRoute component={Sets} /></Route>
        <Route path="/sets/:id"><ProtectedRoute component={SetDetail} /></Route>
        <Route path="/collection"><ProtectedRoute component={Collection} /></Route>
        <Route path="/profile"><ProtectedRoute component={Profile} /></Route>
        <Route path="/card/:id"><ProtectedRoute component={CardDetail} /></Route>
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────
// PersistQueryClientProvider replaces the plain QueryClientProvider.
// It transparently saves the React Query cache to localStorage and restores
// it on next load — so previously fetched cards, sets, and search results
// appear instantly without any network request.
//
// maxAge: 24 h — cached data older than this is ignored and re-fetched.
// buster: version string — changing this instantly clears all clients' cache
//         if a breaking schema change is deployed.
function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="dexvault-theme">
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: localStoragePersister,
          maxAge: 24 * 60 * 60 * 1000,
          buster: CACHE_BUSTER,
        }}
      >
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
          <SonnerToaster richColors position="bottom-right" />
        </TooltipProvider>
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
