import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";

import { Layout } from "@/components/layout";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Search from "@/pages/search";
import Sets from "@/pages/sets";
import Collection from "@/pages/collection";
import Profile from "@/pages/profile";
import CardDetail from "@/pages/card-detail";
import { useAuth } from "@/hooks/use-auth";

const queryClient = new QueryClient();

// Protected route component
const ProtectedRoute = ({ component: Component, ...rest }: any) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>;
  }
  
  if (!user) {
    return <Redirect to="/" />;
  }
  
  return <Component {...rest} />;
};

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
        <Route path="/search"><ProtectedRoute component={Search} /></Route>
        <Route path="/sets"><ProtectedRoute component={Sets} /></Route>
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
    <ThemeProvider defaultTheme="dark" storageKey="dexvault-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
