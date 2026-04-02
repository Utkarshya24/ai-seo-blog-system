'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Globe2, Layers3, Link2 } from 'lucide-react';
import { AdminShell } from '@/components/admin-shell';
import { KpiCard } from '@/components/admin-kpi-card';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getStoredTenantId, tenantFetch } from '@/lib/client/tenant';

interface TenantRow {
  id: string;
  name: string;
  slug: string;
}

interface WebsiteRow {
  id: string;
  tenantId: string;
  name: string;
  domain: string;
  baseUrl: string;
  niche: string;
  gscProperty: string | null;
  gscConnectedAt: string | null;
  gscConnected: boolean;
  isActive: boolean;
  createdAt: string;
}

interface AuthInfo {
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  tenantId: string | null;
  isGlobal: boolean;
}

function WebsitesPageInner() {
  const [auth, setAuth] = useState<AuthInfo | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [websites, setWebsites] = useState<WebsiteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingTenant, setSubmittingTenant] = useState(false);
  const [submittingWebsite, setSubmittingWebsite] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingGscForWebsiteId, setSavingGscForWebsiteId] = useState('');
  const searchParams = useSearchParams();

  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');

  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [websiteName, setWebsiteName] = useState('');
  const [websiteDomain, setWebsiteDomain] = useState('');
  const [websiteBaseUrl, setWebsiteBaseUrl] = useState('');
  const [websiteNiche, setWebsiteNiche] = useState('general');

  const canCreateTenant = auth?.isGlobal && auth?.role === 'OWNER';
  const canCreateWebsite = auth?.role === 'OWNER';

  const selectedTenantLabel = useMemo(
    () => tenants.find((t) => t.id === selectedTenantId)?.name || 'No tenant selected',
    [tenants, selectedTenantId]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [meRes, tenantRes] = await Promise.all([
        tenantFetch('/api/auth/me'),
        tenantFetch('/api/tenants'),
      ]);

      if (!meRes.ok) throw new Error('Unauthorized');
      const meData = await meRes.json();
      setAuth({
        role: meData.role,
        tenantId: meData.tenantId,
        isGlobal: meData.isGlobal,
      });

      const tenantData = await tenantRes.json();
      const tenantRows: TenantRow[] = (tenantData.tenants || []).map((t: TenantRow) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
      }));
      setTenants(tenantRows);

      const storedTenantId = getStoredTenantId();
      const defaultTenant =
        tenantRows.find((t) => t.id === storedTenantId)?.id ||
        meData.tenantId ||
        tenantRows[0]?.id ||
        '';
      setSelectedTenantId(defaultTenant);

      if (defaultTenant) {
        const websitesRes = await tenantFetch(`/api/websites?tenantId=${encodeURIComponent(defaultTenant)}`);
        const websitesData = await websitesRes.json();
        setWebsites(websitesData.websites || []);
      } else {
        setWebsites([]);
      }
    } catch (loadError) {
      console.error('[Websites] loadData error:', loadError);
      setError('Failed to load tenants/websites.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const gsc = searchParams.get('gsc');
    const message = searchParams.get('message');
    if (gsc === 'connected') {
      setNotice(message || 'Google Search Console connected.');
      void loadData();
    } else if (gsc === 'error') {
      setError(message || 'Google Search Console connection failed.');
    }
  }, [searchParams, loadData]);

  async function refreshWebsites(tenantId: string) {
    if (!tenantId) {
      setWebsites([]);
      return;
    }
    const websitesRes = await tenantFetch(`/api/websites?tenantId=${encodeURIComponent(tenantId)}`);
    const websitesData = await websitesRes.json();
    setWebsites(websitesData.websites || []);
  }

  async function createTenant(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantName.trim()) return;
    setSubmittingTenant(true);
    setError('');
    try {
      const res = await tenantFetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tenantName.trim(), slug: tenantSlug.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create tenant');
        return;
      }
      setTenantName('');
      setTenantSlug('');
      await loadData();
      if (data.tenant?.id) {
        setSelectedTenantId(data.tenant.id);
        await refreshWebsites(data.tenant.id);
      }
    } catch (createError) {
      console.error('[Websites] createTenant error:', createError);
      setError('Failed to create tenant.');
    } finally {
      setSubmittingTenant(false);
    }
  }

  async function createWebsite(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTenantId || !websiteName.trim() || !websiteDomain.trim() || !websiteBaseUrl.trim()) return;
    setSubmittingWebsite(true);
    setError('');
    try {
      const res = await tenantFetch('/api/websites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: selectedTenantId,
          name: websiteName.trim(),
          domain: websiteDomain.trim(),
          baseUrl: websiteBaseUrl.trim(),
          niche: websiteNiche.trim() || 'general',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create website');
        return;
      }
      setWebsiteName('');
      setWebsiteDomain('');
      setWebsiteBaseUrl('');
      setWebsiteNiche('general');
      await refreshWebsites(selectedTenantId);
    } catch (createError) {
      console.error('[Websites] createWebsite error:', createError);
      setError('Failed to create website.');
    } finally {
      setSubmittingWebsite(false);
    }
  }

  async function toggleWebsite(website: WebsiteRow, isActive: boolean) {
    try {
      const res = await tenantFetch(`/api/websites/${website.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update website');
        return;
      }
      setWebsites((prev) => prev.map((w) => (w.id === website.id ? data.website : w)));
    } catch (toggleError) {
      console.error('[Websites] toggleWebsite error:', toggleError);
      setError('Failed to update website status.');
    }
  }

  async function connectGsc(websiteId: string) {
    setError('');
    setNotice('');
    try {
      const res = await tenantFetch('/api/integrations/gsc/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteId }),
      });
      const data = await res.json();
      if (!res.ok || !data.authUrl) {
        setError(data.error || 'Failed to start Google OAuth');
        return;
      }
      window.location.href = data.authUrl as string;
    } catch (oauthError) {
      console.error('[Websites] connectGsc error:', oauthError);
      setError('Failed to start Google OAuth.');
    }
  }

  async function disconnectGsc(websiteId: string) {
    setError('');
    setNotice('');
    try {
      const res = await tenantFetch('/api/integrations/gsc/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to disconnect GSC');
        return;
      }
      setNotice('Google Search Console disconnected.');
      await refreshWebsites(selectedTenantId);
    } catch (disconnectError) {
      console.error('[Websites] disconnectGsc error:', disconnectError);
      setError('Failed to disconnect GSC.');
    }
  }

  async function saveGscProperty(website: WebsiteRow, gscProperty: string) {
    setSavingGscForWebsiteId(website.id);
    setError('');
    setNotice('');
    try {
      const res = await tenantFetch(`/api/websites/${website.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gscProperty }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update GSC property');
        return;
      }
      setWebsites((prev) => prev.map((w) => (w.id === website.id ? data.website : w)));
      setNotice('GSC property saved.');
    } catch (saveError) {
      console.error('[Websites] saveGscProperty error:', saveError);
      setError('Failed to save GSC property.');
    } finally {
      setSavingGscForWebsiteId('');
    }
  }

  const activeWebsites = websites.filter((website) => website.isActive).length;
  const gscConnectedSites = websites.filter((website) => website.gscConnected).length;
  const activeSiteRate = websites.length > 0 ? Math.round((activeWebsites / websites.length) * 100) : 0;
  const gscCoverageRate = websites.length > 0 ? Math.round((gscConnectedSites / websites.length) * 100) : 0;

  return (
    <AdminShell
      title="Website Linking"
      description="Create tenants, connect multiple websites, and manage active website states."
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Tenants"
            value={loading ? '-' : tenants.length}
            helper="Accessible organizations"
            icon={Layers3}
          />
          <KpiCard
            label="Linked Websites"
            value={loading ? '-' : websites.length}
            helper="In selected tenant scope"
            icon={Globe2}
            trend={loading ? undefined : { value: `${activeWebsites} active`, direction: 'up' }}
          />
          <KpiCard
            label="Active Sites"
            value={loading ? '-' : activeWebsites}
            helper="Operational websites"
            icon={CheckCircle2}
            variant="progress"
            progress={loading ? undefined : activeSiteRate}
            progressTone="success"
            trend={loading ? undefined : { value: `${activeSiteRate}% active rate`, direction: 'up' }}
          />
          <KpiCard
            label="GSC Connected"
            value={loading ? '-' : gscConnectedSites}
            helper="Search Console ready"
            icon={Link2}
            variant="progress"
            progress={loading ? undefined : gscCoverageRate}
            progressTone="primary"
            trend={
              loading
                ? undefined
                : {
                    value: `${gscCoverageRate}% coverage`,
                    direction: gscCoverageRate >= 70 ? 'up' : 'neutral',
                  }
            }
          />
        </div>

        {canCreateTenant ? (
          <Card>
            <CardHeader>
              <CardTitle>Create Tenant</CardTitle>
              <CardDescription>Global owner can onboard new clients/organizations.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={createTenant} className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Tenant Name</label>
                  <Input
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    placeholder="e.g., Acme Marketing"
                    disabled={submittingTenant}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Slug (optional)</label>
                  <Input
                    value={tenantSlug}
                    onChange={(e) => setTenantSlug(e.target.value)}
                    placeholder="acme-marketing"
                    disabled={submittingTenant}
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="w-full" disabled={submittingTenant || !tenantName.trim()}>
                    {submittingTenant ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        Creating...
                      </>
                    ) : (
                      'Create Tenant'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Link Website</CardTitle>
            <CardDescription>Add website under selected tenant and start scoped SEO workflow.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createWebsite} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Tenant</label>
                <select
                  value={selectedTenantId}
                  onChange={async (e) => {
                    const value = e.target.value;
                    setSelectedTenantId(value);
                    await refreshWebsites(value);
                  }}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  disabled={!canCreateWebsite}
                >
                  {tenants.length === 0 ? <option value="">No tenants</option> : null}
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Website Name</label>
                <Input
                  value={websiteName}
                  onChange={(e) => setWebsiteName(e.target.value)}
                  placeholder="Main Site"
                  disabled={!canCreateWebsite || submittingWebsite}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Domain</label>
                <Input
                  value={websiteDomain}
                  onChange={(e) => setWebsiteDomain(e.target.value)}
                  placeholder="example.com"
                  disabled={!canCreateWebsite || submittingWebsite}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Base URL</label>
                <Input
                  value={websiteBaseUrl}
                  onChange={(e) => setWebsiteBaseUrl(e.target.value)}
                  placeholder="https://example.com"
                  disabled={!canCreateWebsite || submittingWebsite}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Primary Niche</label>
                <Input
                  value={websiteNiche}
                  onChange={(e) => setWebsiteNiche(e.target.value)}
                  placeholder="ai tools"
                  disabled={!canCreateWebsite || submittingWebsite}
                />
              </div>
              <div className="xl:col-span-5">
                <Button
                  type="submit"
                  disabled={
                    !canCreateWebsite ||
                    submittingWebsite ||
                    !selectedTenantId ||
                    !websiteName.trim() ||
                    !websiteDomain.trim() ||
                    !websiteBaseUrl.trim()
                  }
                >
                  {submittingWebsite ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Linking...
                    </>
                  ) : (
                    `Link Website To ${selectedTenantLabel}`
                  )}
                </Button>
              </div>
            </form>
            {error ? (
              <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {notice}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Linked Websites</CardTitle>
            <CardDescription>Tenant scoped list with active/revoked website lifecycle control.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-8 w-8" />
              </div>
            ) : websites.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No websites linked yet for this tenant.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Domain</TableHead>
                      <TableHead>Base URL</TableHead>
                      <TableHead>Niche</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>GSC</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {websites.map((website) => (
                      <TableRow key={website.id}>
                        <TableCell className="font-medium">{website.name}</TableCell>
                        <TableCell>{website.domain}</TableCell>
                        <TableCell className="max-w-[220px] truncate">{website.baseUrl}</TableCell>
                        <TableCell>{website.niche}</TableCell>
                        <TableCell>
                          <StatusBadge label={website.isActive ? 'ACTIVE' : 'INACTIVE'} tone={website.isActive ? 'success' : 'neutral'} />
                        </TableCell>
                        <TableCell className="min-w-[260px]">
                          <div className="space-y-2">
                            <Input
                              defaultValue={website.gscProperty || ''}
                              placeholder="sc-domain:example.com"
                              onBlur={(e) => {
                                const value = e.target.value.trim();
                                if (value !== (website.gscProperty || '')) {
                                  void saveGscProperty(website, value);
                                }
                              }}
                            />
                            <div className="flex flex-wrap gap-2">
                              <StatusBadge
                                label={website.gscConnected ? 'CONNECTED' : 'NOT CONNECTED'}
                                tone={website.gscConnected ? 'success' : 'warning'}
                              />
                              {website.gscConnectedAt ? (
                                <span className="text-xs text-muted-foreground">
                                  {new Date(website.gscConnectedAt).toLocaleDateString()}
                                </span>
                              ) : null}
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => connectGsc(website.id)}>
                                Connect GSC
                              </Button>
                              {website.gscConnected ? (
                                <Button size="sm" variant="outline" onClick={() => disconnectGsc(website.id)}>
                                  Disconnect
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{new Date(website.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleWebsite(website, !website.isActive)}
                            disabled={savingGscForWebsiteId === website.id}
                          >
                            {website.isActive ? 'Deactivate' : 'Activate'}
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

export default function WebsitesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading websites...</div>}>
      <WebsitesPageInner />
    </Suspense>
  );
}
