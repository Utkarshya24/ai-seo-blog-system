'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Gauge, Handshake, MailCheck, Search } from 'lucide-react';
import { AdminShell } from '@/components/admin-shell';
import { KpiCard } from '@/components/admin-kpi-card';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { tenantFetch } from '@/lib/client/tenant';
import { outreachStatusTones } from '@/lib/ui/status-maps';

type OutreachStatus = 'PROSPECT' | 'CONTACTED' | 'FOLLOW_UP' | 'NEGOTIATING' | 'LIVE' | 'REJECTED';

interface Opportunity {
  id: string;
  targetDomain: string;
  targetUrl: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactSocial: string | null;
  status: OutreachStatus;
  relevanceScore: number;
  authorityScore: number;
  expectedLink: string | null;
  notes: string | null;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  wonAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_OPTIONS: OutreachStatus[] = [
  'PROSPECT',
  'CONTACTED',
  'FOLLOW_UP',
  'NEGOTIATING',
  'LIVE',
  'REJECTED',
];

function scoreClass(score: number) {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-rose-600';
}

export default function OutreachPage() {
  const [rows, setRows] = useState<Opportunity[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<OutreachStatus | ''>('');

  const [targetDomain, setTargetDomain] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSocial, setContactSocial] = useState('');
  const [relevanceScore, setRelevanceScore] = useState('70');
  const [authorityScore, setAuthorityScore] = useState('50');
  const [expectedLink, setExpectedLink] = useState('');
  const [nextFollowUpAt, setNextFollowUpAt] = useState('');
  const [notes, setNotes] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (statusFilter) params.set('status', statusFilter);
      const url = `/api/outreach/opportunities${params.toString() ? `?${params.toString()}` : ''}`;

      const res = await tenantFetch(url);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load outreach opportunities');
        return;
      }

      setRows(data.opportunities || []);
      setSummary(data.summary || {});
    } catch (loadError) {
      console.error('[Outreach] loadData error:', loadError);
      setError('Failed to load outreach opportunities.');
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function createOpportunity(e: React.FormEvent) {
    e.preventDefault();
    if (!targetDomain.trim()) return;

    setCreating(true);
    setError('');
    setMessage('');

    try {
      const res = await tenantFetch('/api/outreach/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetDomain,
          targetUrl,
          contactName,
          contactEmail,
          contactSocial,
          relevanceScore: Number(relevanceScore || 0),
          authorityScore: Number(authorityScore || 0),
          expectedLink,
          nextFollowUpAt: nextFollowUpAt || undefined,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create opportunity');
        return;
      }

      setMessage('Outreach opportunity created.');
      setTargetDomain('');
      setTargetUrl('');
      setContactName('');
      setContactEmail('');
      setContactSocial('');
      setExpectedLink('');
      setNextFollowUpAt('');
      setNotes('');
      await loadData();
    } catch (createError) {
      console.error('[Outreach] create error:', createError);
      setError('Failed to create outreach opportunity.');
    } finally {
      setCreating(false);
    }
  }

  async function updateStatus(row: Opportunity, status: OutreachStatus) {
    setSavingId(row.id);
    setError('');
    setMessage('');
    try {
      const res = await tenantFetch(`/api/outreach/opportunities/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update status');
        return;
      }
      setRows((prev) => prev.map((item) => (item.id === row.id ? data.opportunity : item)));
      setMessage(`Status updated to ${status}.`);
      await loadData();
    } catch (updateError) {
      console.error('[Outreach] updateStatus error:', updateError);
      setError('Failed to update status.');
    } finally {
      setSavingId(null);
    }
  }

  const summaryCards = useMemo(
    () => [
      { label: 'Prospects', key: 'PROSPECT' },
      { label: 'Contacted', key: 'CONTACTED' },
      { label: 'Negotiating', key: 'NEGOTIATING' },
      { label: 'Live Links', key: 'LIVE' },
    ],
    []
  );

  const avgRelevance =
    rows.length > 0 ? Math.round(rows.reduce((sum, row) => sum + row.relevanceScore, 0) / rows.length) : 0;
  const avgAuthority =
    rows.length > 0 ? Math.round(rows.reduce((sum, row) => sum + row.authorityScore, 0) / rows.length) : 0;

  const todayIso = new Date().toISOString().slice(0, 10);
  const dueTodayCount = rows.filter((row) => row.nextFollowUpAt?.slice(0, 10) === todayIso).length;
  const overdueCount = rows.filter(
    (row) => row.nextFollowUpAt && row.nextFollowUpAt.slice(0, 10) < todayIso && row.status !== 'LIVE'
  ).length;
  const activePipelineCount = rows.filter((row) => row.status !== 'LIVE' && row.status !== 'REJECTED').length;
  const overdueRate = activePipelineCount > 0 ? Math.round((overdueCount / activePipelineCount) * 100) : 0;

  return (
    <AdminShell
      title="Backlink Outreach"
      description="CRM-style pipeline for backlink prospecting, follow-ups, and live link tracking."
    >
      <div className="grid min-w-0 gap-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Total Opportunities"
            value={loading ? '-' : rows.length}
            helper="Current outreach workload"
            icon={Handshake}
            trend={loading ? undefined : { value: `${summary.LIVE || 0} live links`, direction: 'up' }}
          />
          <KpiCard
            label="Follow-ups Due Today"
            value={loading ? '-' : dueTodayCount}
            helper="Immediate outreach actions"
            icon={CalendarClock}
            variant="compact"
            trend={
              loading
                ? undefined
                : {
                    value: dueTodayCount > 0 ? 'Action required today' : 'No immediate actions',
                    direction: dueTodayCount > 0 ? 'down' : 'up',
                  }
            }
          />
          <KpiCard
            label="Overdue Follow-ups"
            value={loading ? '-' : overdueCount}
            helper="Needs escalation this week"
            icon={MailCheck}
            variant="progress"
            progress={loading ? undefined : overdueRate}
            progressTone="warning"
            trend={
              loading
                ? undefined
                : {
                    value: overdueRate > 20 ? 'Backlog building up' : 'Within control',
                    direction: overdueRate > 20 ? 'down' : 'up',
                  }
            }
          />
          <KpiCard
            label="Avg Relevance / Authority"
            value={loading ? '-' : `${avgRelevance}/${avgAuthority}`}
            helper="Prospect quality score"
            icon={Gauge}
            variant="compact"
            trend={
              loading
                ? undefined
                : {
                    value: avgRelevance >= 70 ? 'Strong pipeline quality' : 'Quality can improve',
                    direction: avgRelevance >= 70 ? 'up' : 'neutral',
                  }
            }
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline Snapshot</CardTitle>
            <CardDescription>Status counts in active tenant/website scope.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {summaryCards.map((item) => (
                <div key={item.key} className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-2xl font-semibold">{summary[item.key] || 0}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add Outreach Opportunity</CardTitle>
            <CardDescription>Create a prospect and track it through outreach stages.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createOpportunity} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Target Domain</label>
                <Input value={targetDomain} onChange={(e) => setTargetDomain(e.target.value)} placeholder="example.com" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Target URL</label>
                <Input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://example.com/write-for-us" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Contact Name</label>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jane Doe" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Contact Email</label>
                <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="jane@example.com" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Contact Social</label>
                <Input value={contactSocial} onChange={(e) => setContactSocial(e.target.value)} placeholder="https://linkedin.com/in/..." />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Relevance Score</label>
                <Input type="number" min="0" max="100" value={relevanceScore} onChange={(e) => setRelevanceScore(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Authority Score</label>
                <Input type="number" min="0" max="100" value={authorityScore} onChange={(e) => setAuthorityScore(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Expected Link</label>
                <Input value={expectedLink} onChange={(e) => setExpectedLink(e.target.value)} placeholder="https://your-site.com/blog/target" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Next Follow-Up</label>
                <Input type="date" value={nextFollowUpAt} onChange={(e) => setNextFollowUpAt(e.target.value)} />
              </div>
              <div className="md:col-span-2 xl:col-span-3">
                <label className="mb-1.5 block text-sm font-medium">Notes</label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pitch angle, contact context, deadlines..." />
              </div>
              <div className="md:col-span-2 xl:col-span-4">
                <Button type="submit" disabled={creating || !targetDomain.trim()}>
                  {creating ? 'Creating...' : 'Create Opportunity'}
                </Button>
              </div>
            </form>

            {error ? (
              <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="mt-4 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
                {message}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Outreach Pipeline</CardTitle>
            <CardDescription>Manage prospects and progress by status stage.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search domain/contact/notes"
                  className="pl-9"
                />
              </div>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter((e.target.value as OutreachStatus) || '')}
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <Button variant="outline" onClick={() => void loadData()}>
                Refresh List
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-8 w-8" />
              </div>
            ) : rows.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No outreach opportunities found.</p>
            ) : (
              <div className="max-w-full overflow-x-auto rounded-lg border border-border/60">
                <Table className="min-w-[920px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead className="hidden md:table-cell">Scores</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Follow-Up</TableHead>
                      <TableHead className="hidden lg:table-cell">Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="max-w-[220px] whitespace-normal break-words">
                          <p className="font-medium break-all">{row.targetDomain}</p>
                          <p className="text-xs text-muted-foreground break-all">{row.targetUrl || '-'}</p>
                        </TableCell>
                        <TableCell className="max-w-[220px] whitespace-normal break-words">
                          <p>{row.contactName || '-'}</p>
                          <p className="text-xs text-muted-foreground break-all">{row.contactEmail || row.contactSocial || '-'}</p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <p className={`text-xs font-medium ${scoreClass(row.relevanceScore)}`}>Rel: {row.relevanceScore}</p>
                          <p className={`text-xs font-medium ${scoreClass(row.authorityScore)}`}>Auth: {row.authorityScore}</p>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <StatusBadge
                              label={row.status}
                              tonesByLabel={outreachStatusTones}
                            />
                            <select
                              className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                              value={row.status}
                              onChange={(e) => void updateStatus(row, e.target.value as OutreachStatus)}
                              disabled={savingId === row.id}
                            >
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                          {row.nextFollowUpAt ? new Date(row.nextFollowUpAt).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                          {new Date(row.updatedAt).toLocaleDateString()}
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
