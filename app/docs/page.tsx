import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BookOpen,
  Building2,
  Database,
  Globe,
  LineChart,
  Rocket,
  Settings2,
  Shield,
  Target,
  Workflow,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Docs | AI SEO Blog System',
  description: 'Complete user guide, SEO workflow, and internal system architecture.',
};

const userSteps = [
  {
    icon: Shield,
    title: '1. Login with Admin Token',
    description: 'Open /auth and paste token. Token is saved in localStorage for real admin session flow.',
  },
  {
    icon: Building2,
    title: '2. Create Tenant + Website',
    description: 'Use /admin/websites to create workspace accounts and connect multiple domains safely.',
  },
  {
    icon: Workflow,
    title: '3. Select Workspace Context',
    description: 'Pick tenant and website in header. Every API call becomes scoped to selected website.',
  },
  {
    icon: Rocket,
    title: '4. Run Content Pipeline',
    description: 'Generate keywords, create draft, publish post, and send content to your website.',
  },
  {
    icon: LineChart,
    title: '5. Connect GSC + Optimize',
    description: 'Connect GSC per website from Websites page, then use metrics to improve CTR and ranking.',
  },
];

const systemBlocks = [
  {
    icon: Database,
    title: 'Data Isolation Model',
    content: 'Tenant -> Website -> Keyword/Post/SeoMetrics. User data remains isolated per workspace.',
  },
  {
    icon: Settings2,
    title: 'Context Resolution',
    content: 'Backend resolves x-tenant-id and x-website-id with token scope checks and RBAC guards.',
  },
  {
    icon: Globe,
    title: 'Distribution Layer',
    content: 'Posts can be consumed via pull APIs or pushed to external CMS/site webhook endpoints.',
  },
  {
    icon: Shield,
    title: 'Access Control',
    content: 'Admin APIs are protected through token auth and role permissions: OWNER, EDITOR, VIEWER.',
  },
];

const seoPlaybook = [
  'Use intent-matched keyword clusters (informational + comparison + commercial).',
  'Maintain consistent publishing cadence per website niche.',
  'Monitor impressions, clicks, CTR, and position weekly.',
  'Refresh pages with high impressions but low CTR using better title/meta.',
  'Expand pages stuck at positions 8-25 with deeper sections and internal linking.',
];

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,hsl(var(--secondary))_0%,transparent_35%),radial-gradient(circle_at_90%_20%,hsl(var(--primary)/0.12)_0%,transparent_30%),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--background)))]">
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-4xl space-y-4 text-center">
          <p className="inline-flex items-center rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
            <BookOpen className="mr-2 h-3.5 w-3.5" />
            Product Documentation
          </p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">AI SEO Blog System Docs</h1>
          <p className="text-muted-foreground">
            Complete guide for users, teams, and internal operators to run multi-website SEO workflows.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/auth">Open Login</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/websites">Open Websites</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/team">Open Team Access</Link>
            </Button>
          </div>
        </div>

        <section className="mt-12">
          <h2 className="mb-4 text-2xl font-semibold">User Workflow</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {userSteps.map((step) => {
              const Icon = step.icon;
              return (
                <Card key={step.title} className="border-border/70 bg-card/80">
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <Icon className="mr-2 h-5 w-5 text-primary" />
                      {step.title}
                    </CardTitle>
                    <CardDescription>{step.description}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="mb-4 text-2xl font-semibold">Internal Working</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {systemBlocks.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="border-border/70 bg-card/80">
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <Icon className="mr-2 h-5 w-5 text-primary" />
                      {item.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{item.content}</CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mt-12">
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="mr-2 h-5 w-5 text-primary" />
                SEO Ranking Playbook
              </CardTitle>
              <CardDescription>How to push rankings using this system in production.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {seoPlaybook.map((point) => (
                <p key={point}>- {point}</p>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="mt-12">
          <Card className="border-dashed border-primary/40 bg-primary/5">
            <CardHeader>
              <CardTitle>Docs Files in Repo</CardTitle>
              <CardDescription>Detailed markdown references for implementation and operations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>- README.md</p>
              <p>- API.md</p>
              <p>- docs/USER_WORKFLOW.md</p>
              <p>- docs/SEO_RANKING_PLAYBOOK.md</p>
              <p>- docs/INTEGRATION_GUIDE.md</p>
              <p>- docs/MULTI_TENANT_GUIDE.md</p>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
