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
import ResetPassword from "@/pages/reset-password";
import Dashboard from "@/pages/dashboard";
import Search from "@/pages/search";
import Sets from "@/pages/sets";
import SetDetail from "@/pages/set-detail";
import Collection from "@/pages/collection";
import Profile from "@/pages/profile";
import CardDetail from "@/pages/card-detail";
import { useAuth } from "@/hooks/use-auth";
import { useCollectionStore } from "@/store/collectionStore";
import { localStoragePersister, CACHE_BUSTER } from "@/lib/queryPersister";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime:    24 * 60 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location]);
  return null;
}

function CollectionInitializer() {
  const { user } = useAuth();
  const fetchCollection = useCollectionStore((s) => s.fetchCollection);
  useEffect(() => {
    if (user) fetchCollection(user.id);
  }, [user?.id, fetchCollection]);
  return null;
}

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

function Router() {
  return (
    <Layout>
      <ScrollToTop />
      <CollectionInitializer />
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
        <Route path="/search"><ProtectedRoute component={Search} /></Route>
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
