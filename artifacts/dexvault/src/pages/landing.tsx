import { useAuth } from '@/hooks/use-auth';
import { AuthForm } from '@/components/auth-form';
import { Redirect } from 'wouter';

export default function Landing() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12">
        <div className="max-w-xl">
          <div className="flex items-center gap-3 mb-8">
            <svg width="44" height="44" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="DexVault logo">
              <rect width="32" height="32" rx="7" fill="hsl(262.1 83.3% 57.8%)" />
              <rect x="6" y="5" width="14" height="19" rx="2.5" fill="white" fillOpacity="0.18" />
              <rect x="6" y="5" width="14" height="19" rx="2.5" stroke="white" strokeOpacity="0.7" strokeWidth="1.2" />
              <rect x="9" y="8" width="8" height="1.5" rx="0.75" fill="white" fillOpacity="0.8" />
              <rect x="9" y="11" width="8" height="1.5" rx="0.75" fill="white" fillOpacity="0.8" />
              <rect x="9" y="14" width="5" height="1.5" rx="0.75" fill="white" fillOpacity="0.8" />
              <rect x="12" y="10" width="14" height="19" rx="2.5" fill="hsl(262.1 83.3% 47%)" />
              <rect x="12" y="10" width="14" height="19" rx="2.5" stroke="white" strokeOpacity="0.5" strokeWidth="1.2" />
              <circle cx="19" cy="19.5" r="4" fill="white" fillOpacity="0.15" stroke="white" strokeOpacity="0.7" strokeWidth="1" />
              <path d="M15 19.5h8" stroke="white" strokeOpacity="0.9" strokeWidth="1" />
              <circle cx="19" cy="19.5" r="1.5" fill="white" />
            </svg>
            <span className="font-bold text-3xl tracking-tight text-foreground">DexVault</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground mb-6 leading-tight">
            Track Every Card <br className="hidden md:block" />
            <span className="text-primary">You Catch.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-md leading-relaxed">
            The collector's obsession tool. A premium dashboard to track your Pokémon TCG pulls, hunts, and grails.
          </p>
          <AuthForm />
        </div>
      </div>
      
      <div className="hidden md:block flex-1 bg-muted relative overflow-hidden border-l border-border">
        {/* Placeholder for hero artwork/pattern */}
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--primary)) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="absolute inset-0 bg-gradient-to-br from-background/50 to-transparent" />
        
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/20 rounded-full blur-[100px]" />
      </div>
    </div>
  );
}
