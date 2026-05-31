import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, KeyRound, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

type Status = 'checking' | 'ready' | 'invalid' | 'expired' | 'success';

export default function ResetPassword() {
  const [status,          setStatus]          = useState<Status>('checking');
  const [newPassword,     setNewPassword]      = useState('');
  const [confirmPassword, setConfirmPassword]  = useState('');
  const [saving,          setSaving]           = useState(false);
  const [, setLocation]                        = useLocation();

  useEffect(() => {
    // Supabase embeds `type=recovery` in the URL hash when the reset link is clicked.
    // The JS client auto-parses the hash and stores the session; we just need to
    // confirm the hash is present and the session is valid.
    const hash = window.location.hash;

    if (!hash.includes('type=recovery')) {
      setStatus('invalid');
      return;
    }

    // Listen for the PASSWORD_RECOVERY event (fires when Supabase processes the hash)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStatus('ready');
      }
    });

    // Also check immediately — the client may have already processed the hash
    // before this component mounted (e.g. slow render).
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        setStatus('expired');
      } else {
        setStatus('ready');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async () => {
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);

    if (error) {
      if (error.message?.toLowerCase().includes('expired') || error.message?.toLowerCase().includes('invalid')) {
        setStatus('expired');
      } else {
        toast.error('Could not update password.', { description: error.message });
      }
    } else {
      setStatus('success');
      toast.success('Password updated! Redirecting to login…');
      setTimeout(() => {
        supabase.auth.signOut().finally(() => setLocation('/'));
      }, 2500);
    }
  };

  // ── Checking ──────────────────────────────────────────────────────────────
  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Invalid link ──────────────────────────────────────────────────────────
  if (status === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-border">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center">
              <ShieldAlert className="w-10 h-10 text-destructive" />
            </div>
            <CardTitle>Invalid Reset Link</CardTitle>
            <CardDescription>
              This link doesn't appear to be a valid password reset link.
              Please request a new one from the login page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation('/')}>
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Expired ───────────────────────────────────────────────────────────────
  if (status === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-border">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center">
              <ShieldAlert className="w-10 h-10 text-amber-500" />
            </div>
            <CardTitle>Link Expired</CardTitle>
            <CardDescription>
              This password reset link has expired or has already been used.
              Reset links are valid for 1 hour. Please request a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation('/')}>
              Request a New Link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-border">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center">
              <ShieldCheck className="w-10 h-10 text-green-500" />
            </div>
            <CardTitle>Password Updated</CardTitle>
            <CardDescription>
              Your password has been changed successfully. Redirecting you to
              the login page…
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Redirecting…
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Ready — show new password form ────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-2">
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">Set New Password</CardTitle>
          <CardDescription className="text-center">
            Choose a strong password for your account.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={saving}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Repeat your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={saving}
              onKeyDown={(e) => { if (e.key === 'Enter') handleReset(); }}
            />
          </div>

          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-destructive">Passwords do not match.</p>
          )}
          {newPassword.length > 0 && newPassword.length < 8 && (
            <p className="text-xs text-destructive">
              Password must be at least 8 characters ({newPassword.length}/8).
            </p>
          )}

          <Button
            className="w-full gap-2"
            onClick={handleReset}
            disabled={saving || newPassword.length < 8 || newPassword !== confirmPassword}
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Check className="w-4 h-4" />
            }
            {saving ? 'Updating…' : 'Set New Password'}
          </Button>

          <button
            className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
            onClick={() => setLocation('/')}
          >
            Back to login
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
