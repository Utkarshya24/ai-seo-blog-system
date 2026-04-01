'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { clearStoredWorkspace, setStoredAdminToken, tenantFetch } from '@/lib/client/tenant';

export default function AuthPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const checkExistingAuth = useCallback(async () => {
    try {
      const res = await tenantFetch('/api/auth/me');
      if (res.ok) {
        router.replace('/admin');
      }
    } catch {
      // Ignore and keep user on auth screen.
    }
  }, [router]);

  useEffect(() => {
    void checkExistingAuth();
  }, [checkExistingAuth]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;

    setLoading(true);
    setError('');
    setStoredAdminToken(token.trim());

    try {
      const res = await tenantFetch('/api/auth/me');
      if (!res.ok) {
        clearStoredWorkspace();
        const data = await res.json().catch(() => ({ error: 'Invalid token' }));
        setError(data.error || 'Invalid token');
        return;
      }

      router.push('/admin');
    } catch (submitError) {
      clearStoredWorkspace();
      console.error('[Auth] Login error:', submitError);
      setError('Unable to verify token right now.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background px-4 py-12">
      <div className="mx-auto max-w-md">
        <Card className="border-border/70 bg-card/85 backdrop-blur">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto w-fit rounded-full bg-primary/10 p-3 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">Admin Login</CardTitle>
            <CardDescription>Enter your admin token to access tenant workspaces securely.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Admin Token</label>
                <Input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="seo_admin_..."
                  autoComplete="off"
                  disabled={loading}
                />
              </div>

              {error ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={loading || !token.trim()}>
                <KeyRound className="mr-2 h-4 w-4" />
                {loading ? 'Verifying...' : 'Access Admin'}
              </Button>
            </form>

            <div className="mt-4 text-center text-xs text-muted-foreground">
              <p>Token gets saved in local storage for workspace continuity.</p>
              <Link href="/docs" className="mt-1 inline-block text-primary hover:underline">
                Open docs
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
