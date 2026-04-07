'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Eye,
  FileText,
  Globe2,
  Handshake,
  Home,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Newspaper,
  Search,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
  clearStoredWorkspace,
  getStoredAdminToken,
  setStoredAdminToken,
  setStoredTenantId,
  setStoredWebsiteId,
  tenantFetch,
} from '@/lib/client/tenant';

interface AdminShellProps {
  title: string;
  description: string;
  children: ReactNode;
}

const navItems = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/keywords', label: 'Keywords', icon: Search },
  { href: '/admin/posts', label: 'Posts', icon: FileText },
  { href: '/admin/websites', label: 'Websites', icon: Globe2 },
  { href: '/admin/metrics', label: 'Metrics', icon: BarChart3 },
  { href: '/admin/visibility', label: 'Visibility', icon: Eye },
  { href: '/admin/social', label: 'Social', icon: Megaphone },
  { href: '/admin/tech-news', label: 'Tech News', icon: Newspaper },
  { href: '/admin/outreach', label: 'Outreach', icon: Handshake },
  { href: '/admin/team', label: 'Team', icon: Users },
];

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface Website {
  id: string;
  tenantId: string;
  name: string;
  domain: string;
}

function WorkspaceControls({
  adminToken,
  tenants,
  websites,
  selectedTenant,
  selectedWebsite,
  onTokenChange,
  onTenantChange,
  onWebsiteChange,
}: {
  adminToken: string;
  tenants: Tenant[];
  websites: Website[];
  selectedTenant: string;
  selectedWebsite: string;
  onTokenChange: (value: string) => void;
  onTenantChange: (value: string) => void;
  onWebsiteChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Workspace Controls</p>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          Secure Context
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1">
          <span className="text-xs font-medium text-muted-foreground">Admin Token</span>
          <Input
            type="password"
            placeholder="Workspace token"
            value={adminToken}
            onChange={(e) => onTokenChange(e.target.value)}
            className="h-9 text-xs"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-medium text-muted-foreground">Tenant</span>
          <select
            value={selectedTenant}
            onChange={(e) => onTenantChange(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          >
            {tenants.length === 0 ? <option value="">No tenants</option> : null}
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-medium text-muted-foreground">Website</span>
          <select
            value={selectedWebsite}
            onChange={(e) => onWebsiteChange(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          >
            {websites.length === 0 ? <option value="">No websites</option> : null}
            {websites.map((website) => (
              <option key={website.id} value={website.id}>
                {website.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

export function AdminShell({ title, description, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [adminToken, setAdminToken] = useState(() => getStoredAdminToken() || '');
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [selectedWebsite, setSelectedWebsite] = useState<string>('');
  const [authorized, setAuthorized] = useState(false);

  const loadWebsites = useCallback(async (tenantId: string) => {
    try {
      const res = await tenantFetch(`/api/websites?tenantId=${encodeURIComponent(tenantId)}`);
      const data = await res.json();
      const websiteRows: Website[] = data.websites || [];
      setWebsites(websiteRows);

      const storedWebsiteId =
        typeof window !== 'undefined' ? localStorage.getItem('seo-admin-website-id') : null;
      const initialWebsite =
        websiteRows.find((w) => w.id === storedWebsiteId)?.id || websiteRows[0]?.id || '';
      setSelectedWebsite(initialWebsite);
      setStoredWebsiteId(initialWebsite || null);
    } catch (error) {
      console.error('[AdminShell] Failed to load websites:', error);
      setWebsites([]);
      setSelectedWebsite('');
      setStoredWebsiteId(null);
    }
  }, []);

  const bootstrapWorkspace = useCallback(async () => {
    try {
      if (!getStoredAdminToken()) {
        setAuthorized(false);
        router.replace('/auth');
        return;
      }

      const res = await tenantFetch('/api/tenants');
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setAuthorized(false);
          clearStoredWorkspace();
          router.replace('/auth');
          return;
        }
        return;
      }
      setAuthorized(true);
      const data = await res.json();
      const tenantRows: Tenant[] = data.tenants || [];
      setTenants(tenantRows);

      const storedTenantId =
        typeof window !== 'undefined' ? localStorage.getItem('seo-admin-tenant-id') : null;
      const initialTenant =
        tenantRows.find((t) => t.id === storedTenantId)?.id || tenantRows[0]?.id || '';
      if (!initialTenant) return;
      setSelectedTenant(initialTenant);
      setStoredTenantId(initialTenant);
    } catch (error) {
      console.error('[AdminShell] Failed to bootstrap tenant workspace:', error);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void bootstrapWorkspace();
  }, [bootstrapWorkspace]);

  useEffect(() => {
    if (!selectedTenant) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadWebsites(selectedTenant);
  }, [selectedTenant, loadWebsites]);

  const activeWebsite = useMemo(
    () => websites.find((w) => w.id === selectedWebsite),
    [websites, selectedWebsite]
  );

  function logout() {
    clearStoredWorkspace();
    setAdminToken('');
    setAuthorized(false);
    router.replace('/auth');
  }

  if (!authorized) {
    return (
      <div className="dashboard-bg flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card/80 p-8 text-center shadow-sm backdrop-blur">
          <p className="text-sm text-muted-foreground">Authenticating workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-bg min-h-screen">
      <div className="dashboard-grid-overlay min-h-screen">
        <div className="mx-auto top-4 flex w-full gap-2">
          <aside className="hidden w-72 lg:block">
            <div className="sticky overflow-hidden rounded-3xl border border-border/70 bg-card/85 p-4 shadow-sm backdrop-blur">
              <Link href="/admin" className="mb-6 flex items-center gap-3 rounded-2xl border border-border/60 bg-background/70 p-3">
                <div className="rounded-xl bg-primary/15 p-2 text-primary">
                  <Workflow className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">AI SEO Suite</p>
                  <p className="text-base font-semibold">Ops Dashboard</p>
                </div>
              </Link>

              <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Core Modules</p>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.href ||
                    (item.href !== '/admin' && pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-6 rounded-2xl border border-border/60 bg-background/70 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Workspace</p>
                <p className="mt-2 text-sm font-medium">{tenants.length} tenants connected</p>
                <p className="text-sm text-muted-foreground">{websites.length} websites available</p>
                {activeWebsite ? (
                  <p className="mt-2 truncate text-xs text-muted-foreground">
                    Active: <span className="font-medium text-foreground">{activeWebsite.domain}</span>
                  </p>
                ) : null}
              </div>

              <div className="mt-4 space-y-2">
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href="/blog">
                    <FileText className="mr-2 h-4 w-4" />
                    View Blog
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href="/docs">
                    <BookOpen className="mr-2 h-4 w-4" />
                    Documentation
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href="/">
                    <Home className="mr-2 h-4 w-4" />
                    Back To Home
                  </Link>
                </Button>
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <header className="mb-5 rounded-3xl border border-border/70 bg-card/75 p-4 shadow-sm backdrop-blur md:p-5">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="outline" size="icon" className="lg:hidden">
                          <Menu className="h-4 w-4" />
                          <span className="sr-only">Open admin navigation</span>
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="left" className="p-0">
                        <SheetHeader className="border-b border-border/70 px-4 py-3">
                          <SheetTitle>Admin Navigation</SheetTitle>
                          <SheetDescription>Move between dashboard modules.</SheetDescription>
                        </SheetHeader>
                        <div className="space-y-2 p-4">
                          {navItems.map((item) => {
                            const Icon = item.icon;
                            const active =
                              pathname === item.href ||
                              (item.href !== '/admin' && pathname.startsWith(item.href));

                            return (
                              <SheetClose asChild key={item.href}>
                                <Link
                                  href={item.href}
                                  className={cn(
                                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                                    active
                                      ? 'bg-primary text-primary-foreground'
                                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                                  )}
                                >
                                  <Icon className="h-4 w-4" />
                                  {item.label}
                                </Link>
                              </SheetClose>
                            );
                          })}
                        </div>
                        <div className="mt-auto space-y-2 border-t border-border/70 p-4">
                          <SheetClose asChild>
                            <Button asChild variant="outline" className="w-full justify-start">
                              <Link href="/docs">
                                <BookOpen className="mr-2 h-4 w-4" />
                                Documentation
                              </Link>
                            </Button>
                          </SheetClose>
                          <SheetClose asChild>
                            <Button asChild variant="outline" className="w-full justify-start">
                              <Link href="/blog">
                                <FileText className="mr-2 h-4 w-4" />
                                View Blog
                              </Link>
                            </Button>
                          </SheetClose>
                          <SheetClose asChild>
                            <Button asChild variant="outline" className="w-full justify-start">
                              <Link href="/">
                                <Home className="mr-2 h-4 w-4" />
                                Back To Home
                              </Link>
                            </Button>
                          </SheetClose>
                        </div>
                      </SheetContent>
                    </Sheet>
                    <div>
                      <p className="inline-flex items-center rounded-full border border-border/70 bg-background/60 px-2 py-0.5 text-xs text-muted-foreground">
                        <Sparkles className="mr-1 h-3 w-3 text-primary" />
                        SaaS Operations
                      </p>
                      <h1 className="mt-1 text-xl font-semibold sm:text-2xl">{title}</h1>
                      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                      {activeWebsite ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Active website:{' '}
                          <span className="font-medium text-foreground">{activeWebsite.name}</span> (
                          {activeWebsite.domain})
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="hidden items-center gap-2 xl:flex">
                    <Button variant="outline" onClick={() => router.back()}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/admin">Dashboard</Link>
                    </Button>
                    <Button variant="destructive" onClick={logout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </Button>
                  </div>
                </div>

                <WorkspaceControls
                  adminToken={adminToken}
                  tenants={tenants}
                  websites={websites}
                  selectedTenant={selectedTenant}
                  selectedWebsite={selectedWebsite}
                  onTokenChange={(value) => {
                    setAdminToken(value);
                    setStoredAdminToken(value || null);
                  }}
                  onTenantChange={(value) => {
                    setSelectedTenant(value);
                    setStoredTenantId(value);
                  }}
                  onWebsiteChange={(value) => {
                    setSelectedWebsite(value);
                    setStoredWebsiteId(value || null);
                  }}
                />

                <div className="grid grid-cols-2 gap-2 xl:hidden">
                  <Button variant="outline" onClick={() => router.back()} className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button variant="destructive" onClick={logout} className="w-full">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </Button>
                </div>
              </div>
            </header>

            <main className="min-w-0 pb-10">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
