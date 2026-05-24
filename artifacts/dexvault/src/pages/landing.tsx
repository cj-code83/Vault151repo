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
            <img
              src="/vault151-logo.png"
              alt="Vault151 logo"
              width={44}
              height={44}
              className="rounded-xl object-contain"
            />
            <span className="font-bold text-3xl tracking-tight">
              <span className="text-foreground">Vault</span>
              <span className="text-red-600 dark:text-red-500">151</span>
            </span>
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
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--primary)) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="absolute inset-0 bg-gradient-to-br from-background/50 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/20 rounded-full blur-[100px]" />
      </div>
    </div>
  );
}
