'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, BookOpen, FileText, Globe2, Home, LayoutDashboard, LogOut, Menu, Search, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { clearStoredWorkspace, getStoredAdminToken, setStoredAdminToken, setStoredTenantId, setStoredWebsiteId, tenantFetch } from '@/lib/client/tenant';

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

      const storedWebsiteId = typeof window !== 'undefined' ? localStorage.getItem('seo-admin-website-id') : null;
      const initialWebsite = websiteRows.find((w) => w.id === storedWebsiteId)?.id || websiteRows[0]?.id || '';
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

      const storedTenantId = typeof window !== 'undefined' ? localStorage.getItem('seo-admin-tenant-id') : null;
      const initialTenant = tenantRows.find((t) => t.id === storedTenantId)?.id || tenantRows[0]?.id || '';
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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Authenticating workspace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/40">
      <div className="mx-auto flex max-w-[1400px]">
        <aside className="hidden w-72 border-r border-border/70 bg-card/70 p-6 backdrop-blur md:block">
          <Link href="/admin" className="mb-8 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">AI SEO</p>
              <p className="text-lg font-semibold">Admin Panel</p>
            </div>
          </Link>

          <nav className="space-y-2">
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
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-10 space-y-2">
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Back To Home
              </Link>
            </Button>
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
          </div>
        </aside>

        <div className="flex-1">
          <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 px-4 py-4 backdrop-blur md:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="md:hidden">
                      <Menu className="h-4 w-4" />
                      <span className="sr-only">Open admin navigation</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0">
                    <SheetHeader className="border-b border-border/70">
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
                          <Link href="/">
                            <Home className="mr-2 h-4 w-4" />
                            Back To Home
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
                          <Link href="/docs">
                            <BookOpen className="mr-2 h-4 w-4" />
                            Documentation
                          </Link>
                        </Button>
                      </SheetClose>
                    </div>
                  </SheetContent>
                </Sheet>
                <p className="text-sm text-muted-foreground">Admin Workspace</p>
                <div>
                  <h1 className="text-2xl font-semibold">{title}</h1>
                  <p className="text-sm text-muted-foreground">{description}</p>
                  {activeWebsite ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Active website: <span className="font-medium text-foreground">{activeWebsite.name}</span> ({activeWebsite.domain})
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="password"
                  placeholder="Admin token"
                  value={adminToken}
                  onChange={(e) => {
                    const value = e.target.value;
                    setAdminToken(value);
                    setStoredAdminToken(value || null);
                  }}
                  className="h-9 w-44 rounded-md border border-input bg-background px-2 text-xs"
                />
                <select
                  value={selectedTenant}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedTenant(value);
                    setStoredTenantId(value);
                  }}
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                >
                  {tenants.length === 0 ? <option value="">No tenants</option> : null}
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedWebsite}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedWebsite(value);
                    setStoredWebsiteId(value || null);
                  }}
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                >
                  {websites.length === 0 ? <option value="">No websites</option> : null}
                  {websites.map((website) => (
                    <option key={website.id} value={website.id}>
                      {website.name}
                    </option>
                  ))}
                </select>
                <Button variant="outline" onClick={() => router.back()}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button asChild variant="outline">
                  <Link href="/admin">Dashboard</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/docs">
                    <BookOpen className="mr-2 h-4 w-4" />
                    Docs
                  </Link>
                </Button>
                <Button variant="destructive" onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
          </header>

          <main className="px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
