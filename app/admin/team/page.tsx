'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, ShieldOff, UserCog } from 'lucide-react';
import { AdminShell } from '@/components/admin-shell';
import { KpiCard } from '@/components/admin-kpi-card';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { tenantFetch } from '@/lib/client/tenant';

interface AdminTokenRow {
  id: string;
  name: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  tenantId: string | null;
  lastFour: string;
  isActive: boolean;
  createdAt: string;
}

interface TenantRow {
  id: string;
  name: string;
}

interface MeResponse {
  authenticated: boolean;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  tenantId: string | null;
  isGlobal: boolean;
}

export default function TeamAccessPage() {
  const [tokens, setTokens] = useState<AdminTokenRow[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<'OWNER' | 'EDITOR' | 'VIEWER'>('EDITOR');
  const [tenantId, setTenantId] = useState('');
  const [lastCreatedRawToken, setLastCreatedRawToken] = useState('');
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [meRes, tokenRes, tenantRes] = await Promise.all([
        tenantFetch('/api/auth/me'),
        tenantFetch('/api/auth/tokens'),
        tenantFetch('/api/tenants'),
      ]);

      if (!meRes.ok) throw new Error('Unauthorized');
      const meData = (await meRes.json()) as MeResponse;
      setMe(meData);

      const tokenData = await tokenRes.json();
      setTokens(tokenData.tokens || []);

      const tenantData = await tenantRes.json();
      setTenants((tenantData.tenants || []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));

      setTenantId((current) => {
        if (!meData.isGlobal && meData.tenantId) return meData.tenantId;
        if (!current && tenantData.tenants?.[0]?.id) return tenantData.tenants[0].id;
        return current;
      });
    } catch (loadError) {
      console.error('[Team] Failed to load data:', loadError);
      setError('Unable to load team access data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function createToken(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    setError('');
    setLastCreatedRawToken('');

    try {
      const payload = {
        name: name.trim(),
        role,
        tenantId: me?.isGlobal ? tenantId || null : me?.tenantId || null,
      };

      const res = await tenantFetch('/api/auth/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create token');
        return;
      }

      setLastCreatedRawToken(data.rawToken || '');
      setName('');
      await loadData();
    } catch (createError) {
      console.error('[Team] Token create error:', createError);
      setError('Failed to create token.');
    } finally {
      setCreating(false);
    }
  }

  async function toggleToken(token: AdminTokenRow, nextState: boolean) {
    try {
      const res = await tenantFetch(`/api/auth/tokens/${token.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextState }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update token');
        return;
      }
      setTokens((prev) => prev.map((row) => (row.id === token.id ? data.token : row)));
    } catch (toggleError) {
      console.error('[Team] Token toggle error:', toggleError);
      setError('Failed to update token state.');
    }
  }

  const activeTokens = tokens.filter((token) => token.isActive).length;
  const revokedTokens = tokens.length - activeTokens;
  const ownerCount = tokens.filter((token) => token.role === 'OWNER').length;
  const editorCount = tokens.filter((token) => token.role === 'EDITOR').length;
  const activeRate = tokens.length > 0 ? Math.round((activeTokens / tokens.length) * 100) : 0;

  return (
    <AdminShell
      title="Team Access"
      description="Create and manage role-based admin tokens for multi-user team workflows."
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Total Tokens"
            value={loading ? '-' : tokens.length}
            helper="Issued credentials"
            icon={KeyRound}
          />
          <KpiCard
            label="Active"
            value={loading ? '-' : activeTokens}
            helper="Currently enabled"
            icon={ShieldCheck}
            variant="progress"
            progress={loading ? undefined : activeRate}
            progressTone="success"
            trend={loading ? undefined : { value: `${activeRate}% active`, direction: 'up' }}
          />
          <KpiCard
            label="Revoked"
            value={loading ? '-' : revokedTokens}
            helper="Blocked credentials"
            icon={ShieldOff}
            variant="compact"
            trend={
              loading
                ? undefined
                : {
                    value: revokedTokens > 0 ? 'Review access list' : 'No revoked tokens',
                    direction: revokedTokens > 0 ? 'neutral' : 'up',
                  }
            }
          />
          <KpiCard
            label="OWNER / EDITOR"
            value={loading ? '-' : `${ownerCount}/${editorCount}`}
            helper="Permission mix"
            icon={UserCog}
            variant="compact"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Team Token</CardTitle>
            <CardDescription>Generate scoped token for owner/editor/viewer access.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createToken} className="grid gap-4 md:grid-cols-4">
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium">Member / Token Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Content Manager"
                  disabled={creating}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'OWNER' | 'EDITOR' | 'VIEWER')}
                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                  disabled={creating}
                >
                  <option value="OWNER">OWNER</option>
                  <option value="EDITOR">EDITOR</option>
                  <option value="VIEWER">VIEWER</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Tenant Scope</label>
                <select
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                  disabled={creating || !me?.isGlobal}
                >
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-4">
                <Button type="submit" disabled={creating || !name.trim()}>
                  {creating ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Creating...
                    </>
                  ) : (
                    'Create Access Token'
                  )}
                </Button>
              </div>
            </form>

            {lastCreatedRawToken ? (
              <div className="mt-4 rounded-md border border-emerald-300/50 bg-emerald-50 p-3 text-sm text-emerald-800">
                <p className="font-medium">Copy this token now (shown once):</p>
                <p className="mt-1 break-all font-mono">{lastCreatedRawToken}</p>
              </div>
            ) : null}

            {error ? (
              <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Issued Tokens</CardTitle>
            <CardDescription>{tokens.length} token records</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-8 w-8" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Last 4</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tokens.map((token) => (
                      <TableRow key={token.id}>
                        <TableCell className="font-medium">{token.name}</TableCell>
                        <TableCell>{token.role}</TableCell>
                        <TableCell className="font-mono text-xs">{token.tenantId || 'GLOBAL'}</TableCell>
                        <TableCell className="font-mono">****{token.lastFour}</TableCell>
                        <TableCell>
                          <StatusBadge label={token.isActive ? 'ACTIVE' : 'REVOKED'} tone={token.isActive ? 'success' : 'neutral'} />
                        </TableCell>
                        <TableCell>{new Date(token.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleToken(token, !token.isActive)}
                          >
                            {token.isActive ? 'Revoke' : 'Activate'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
