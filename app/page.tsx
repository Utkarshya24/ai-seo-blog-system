import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">AI SEO Blog</h1>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:gap-3">
            <Button asChild variant="ghost">
              <Link href="/blog">Blog</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/docs">Docs</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/auth">Login</Link>
            </Button>
            <Button asChild>
              <Link href="/admin">Admin Dashboard</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-14 text-center sm:py-20">
        <div className="mx-auto max-w-3xl space-y-6">
          <h2 className="text-4xl font-bold text-foreground sm:text-5xl md:text-6xl">
            AI-Powered SEO Blog System
          </h2>
          <p className="text-base text-muted-foreground sm:text-xl">
            Generate, manage, and optimize SEO-friendly blog content with AI. Automate keyword research, content creation, and performance tracking.
          </p>

          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/blog">Read Our Blog</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/admin">Manage Content</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/docs">Read Docs</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="mb-12 text-center">
          <h3 className="text-3xl font-bold text-foreground">Key Features</h3>
          <p className="mt-2 text-muted-foreground">
            Everything you need to build an AI-powered blog system
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>AI Keyword Generation</CardTitle>
              <CardDescription>
                Automatically generate SEO keywords for any niche
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Use OpenAI to create relevant, high-volume keywords tailored to your target audience.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Smart Content Creation</CardTitle>
              <CardDescription>
                Generate blog posts from keywords
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Create comprehensive, SEO-optimized blog posts with proper structure and metadata.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SEO Optimization</CardTitle>
              <CardDescription>
                Automatic meta descriptions and slugs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Generate compelling meta descriptions and URL-friendly slugs automatically.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cron Job Automation</CardTitle>
              <CardDescription>
                Schedule content generation tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Automate keyword generation, blog posting, and metrics updates on a schedule.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>
                Track blog post performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Monitor views, clicks, bounce rates, and engagement metrics for each post.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Admin Dashboard</CardTitle>
              <CardDescription>
                Manage everything in one place
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Comprehensive dashboard for keywords, posts, and metrics management.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="mb-12 text-center">
          <h3 className="text-3xl font-bold text-foreground">How It Works</h3>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div className="space-y-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white mx-auto">
              1
            </div>
            <h4 className="font-bold text-foreground">Generate Keywords</h4>
            <p className="text-sm text-muted-foreground">
              AI generates relevant SEO keywords for your niche
            </p>
          </div>

          <div className="space-y-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white mx-auto">
              2
            </div>
            <h4 className="font-bold text-foreground">Create Content</h4>
            <p className="text-sm text-muted-foreground">
              Convert keywords into full blog posts with AI
            </p>
          </div>

          <div className="space-y-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white mx-auto">
              3
            </div>
            <h4 className="font-bold text-foreground">Optimize & Publish</h4>
            <p className="text-sm text-muted-foreground">
              Add SEO metadata and publish to your blog
            </p>
          </div>

          <div className="space-y-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white mx-auto">
              4
            </div>
            <h4 className="font-bold text-foreground">Track Metrics</h4>
            <p className="text-sm text-muted-foreground">
              Monitor performance and engagement data
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border bg-secondary/30 py-16">
        <div className="container mx-auto px-4 text-center">
          <h3 className="mb-4 text-3xl font-bold text-foreground">
            Ready to Get Started?
          </h3>
          <p className="mb-8 text-lg text-muted-foreground">
            Visit the admin dashboard to start generating AI-powered content
          </p>

          <Button asChild size="lg">
            <Link href="/admin">Go to Admin Dashboard</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            AI SEO Blog System · Built with Next.js, Prisma, and OpenAI
          </p>
        </div>
      </footer>
    </main>
  );
}
