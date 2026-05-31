import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../lib/supabase';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn, Loader2, Mail, UserPlus } from 'lucide-react';
import { toast as sonnerToast } from 'sonner';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type AuthFormData = z.infer<typeof authSchema>;

type Mode = 'signin' | 'signup' | 'forgot';

export function AuthForm() {
  const [mode,      setMode]      = useState<Mode>('signin');
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation]           = useLocation();
  const { toast } = useToast();

  // Forgot-password state (separate from the main form)
  const [forgotEmail,   setForgotEmail]   = useState('');
  const [forgotSent,    setForgotSent]    = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: '', password: '' }
  });

  const onSubmit = async (data: AuthFormData) => {
    setIsLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
        });
        if (error) throw error;
        toast({ title: 'Account created', description: 'Please check your email to verify your account.' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });
        if (error) throw error;
        setLocation('/dashboard');
      }
    } catch (error: unknown) {
      const e = error as { message?: string };
      toast({
        title: 'Authentication Error',
        description: e.message || 'Something went wrong',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/dashboard` }
      });
      if (error) throw error;
    } catch (error: unknown) {
      const e = error as { message?: string };
      toast({
        title: 'Google Sign In Error',
        description: e.message || 'Could not sign in with Google',
        variant: 'destructive'
      });
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      sonnerToast.error('Please enter your email address.');
      return;
    }
    setForgotLoading(true);
    try {
      // Build redirect URL that works regardless of the app's base path
      const resetUrl = `${window.location.origin}${import.meta.env.BASE_URL}reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: resetUrl,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (error: unknown) {
      const e = error as { message?: string };
      sonnerToast.error('Could not send reset email.', { description: e.message });
    } finally {
      setForgotLoading(false);
    }
  };

  // ── Forgot password panel ──────────────────────────────────────────────
  if (mode === 'forgot') {
    return (
      <Card className="w-full max-w-md mx-auto border-border bg-card">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">Reset Password</CardTitle>
          <CardDescription>
            {forgotSent
              ? 'Check your inbox for a password reset link.'
              : "Enter your account email and we'll send you a reset link."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {forgotSent ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                A reset link was sent to <span className="font-medium text-foreground">{forgotEmail}</span>.
                The link expires in 1 hour. Check your spam folder if you don't see it.
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setForgotSent(false);
                  setForgotEmail('');
                  setMode('signin');
                }}
              >
                Back to Sign In
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email address</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="m@example.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  disabled={forgotLoading}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleForgotPassword(); }}
                />
              </div>
              <Button
                className="w-full gap-2"
                onClick={handleForgotPassword}
                disabled={forgotLoading || !forgotEmail.trim()}
              >
                {forgotLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Mail className="w-4 h-4" />
                }
                {forgotLoading ? 'Sending…' : 'Send Reset Link'}
              </Button>
            </div>
          )}
        </CardContent>

        {!forgotSent && (
          <CardFooter>
            <button
              className="text-sm text-muted-foreground hover:text-primary transition-colors mx-auto"
              onClick={() => setMode('signin')}
            >
              Back to Sign In
            </button>
          </CardFooter>
        )}
      </Card>
    );
  }

  // ── Sign-in / Sign-up panel ────────────────────────────────────────────
  return (
    <Card className="w-full max-w-md mx-auto border-border bg-card">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold tracking-tight">
          {mode === 'signup' ? 'Create an account' : 'Welcome back'}
        </CardTitle>
        <CardDescription>
          {mode === 'signup'
            ? 'Enter your details below to create your account'
            : 'Enter your email to sign in to your account'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
            <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="m@example.com" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {mode === 'signin' && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => { setForgotEmail(''); setForgotSent(false); setMode('forgot'); }}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <Input id="password" type="password" {...register('password')} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <Button className="w-full" type="submit" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : mode === 'signup' ? (
              <UserPlus className="w-4 h-4 mr-2" />
            ) : (
              <LogIn className="w-4 h-4 mr-2" />
            )}
            {mode === 'signup' ? 'Sign Up' : 'Sign In'}
          </Button>
        </form>
      </CardContent>

      <CardFooter>
        <button
          className="text-sm text-muted-foreground hover:text-primary transition-colors mx-auto"
          onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
        >
          {mode === 'signup' ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </button>
      </CardFooter>
    </Card>
  );
}
