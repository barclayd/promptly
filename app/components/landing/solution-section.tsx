import {
  IconBriefcase,
  IconCheck,
  IconCode,
  IconPencil,
} from '@tabler/icons-react';
import { Badge } from '~/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { AnimatedWrapper } from './animated-wrapper';

const solutionTabs = [
  {
    value: 'editors',
    label: 'For Editors',
    icon: IconPencil,
    badge: 'No code',
    headline: 'Write prompts like documents',
    description:
      'A familiar editing experience with syntax highlighting, variables, and live preview. Test prompts instantly and see exactly what your users will experience.',
    benefits: [
      'Visual prompt editor with live preview',
      'Test with sample data before publishing',
      'Real-time collaboration with your team',
      'Version comparison and rollback',
    ],
  },
  {
    value: 'developers',
    label: 'For Developers',
    icon: IconCode,
    badge: 'TypeScript',
    headline: 'Type-safe prompts, zero maintenance',
    description:
      'Install our SDK, call your prompts by name, and get full TypeScript types automatically. No more managing string templates or syncing prompt changes.',
    benefits: [
      'npm install @promptly/sdk',
      'Full TypeScript autocomplete',
      'Zod schema validation built-in',
      'Automatic sync when prompts change',
    ],
  },
  {
    value: 'business',
    label: 'For Business',
    icon: IconBriefcase,
    badge: 'Insights',
    headline: 'Visibility into every AI interaction',
    description:
      'Track costs per prompt, set spending alerts, and understand how your AI features perform. Make data-driven decisions about your AI investment.',
    benefits: [
      'Real-time cost tracking per prompt',
      'Usage analytics and trends',
      'Budget alerts before overspending',
      'Team activity and audit logs',
    ],
  },
];

export const SolutionSection = () => {
  return (
    <section id="features" className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <AnimatedWrapper className="text-center mb-16">
          <Badge
            variant="outline"
            className="mb-4 px-3 py-1.5 bg-emerald-500/10 border-emerald-200 dark:border-emerald-800"
          >
            <span className="text-emerald-600 dark:text-emerald-400">
              The solution
            </span>
          </Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Prompts deserve their own home
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A dedicated platform where everyone on your team can contribute to
            your AI features.
          </p>
        </AnimatedWrapper>

        <AnimatedWrapper delay={200}>
          <Tabs defaultValue="editors" className="w-full">
            <TabsList className="w-full max-w-md mx-auto grid grid-cols-3 h-auto p-1 mb-12">
              {solutionTabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-2 py-2.5 data-[state=active]:shadow-md"
                >
                  <tab.icon className="size-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {solutionTabs.map((tab) => (
              <TabsContent key={tab.value} value={tab.value}>
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                  {/* Left: Content */}
                  <div className="space-y-6">
                    <Badge
                      variant="secondary"
                      className="text-xs font-medium px-2.5 py-1"
                    >
                      {tab.badge}
                    </Badge>
                    <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
                      {tab.headline}
                    </h3>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                      {tab.description}
                    </p>
                    <ul className="space-y-3">
                      {tab.benefits.map((benefit) => (
                        <li key={benefit} className="flex items-center gap-3">
                          <div className="shrink-0 size-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <IconCheck className="size-3 text-emerald-500" />
                          </div>
                          <span className="text-foreground/80">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Right: Visual */}
                  <div className="relative">
                    <TabVisual tab={tab.value} />
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </AnimatedWrapper>
      </div>
    </section>
  );
};

const TabVisual = ({ tab }: { tab: string }) => {
  if (tab === 'editors') {
    return (
      <div className="rounded-2xl border border-border/50 bg-card shadow-xl shadow-black/5 dark:shadow-black/20 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/30">
          <div className="flex gap-1.5">
            <div className="size-2.5 rounded-full bg-red-400/80" />
            <div className="size-2.5 rounded-full bg-yellow-400/80" />
            <div className="size-2.5 rounded-full bg-green-400/80" />
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="h-4 w-32 rounded bg-muted animate-pulse" />
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-muted/60" />
            <div className="h-3 w-4/5 rounded bg-muted/60" />
            <div className="h-3 w-3/4 rounded bg-muted/60" />
          </div>
          <div className="flex gap-2 pt-4">
            <div className="px-3 py-1.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-medium">
              user_name
            </div>
            <div className="px-3 py-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
              company
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'developers') {
    return (
      <div className="rounded-2xl border border-border/50 bg-zinc-950 shadow-xl shadow-black/10 dark:shadow-black/30 overflow-hidden font-mono text-sm">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <span className="text-zinc-500">app.ts</span>
        </div>
        <div className="p-6 text-zinc-300 space-y-1">
          <p>
            <span className="text-purple-400">import</span>{' '}
            <span className="text-zinc-100">{'{ Promptly }'}</span>{' '}
            <span className="text-purple-400">from</span>{' '}
            <span className="text-emerald-400">'@promptly/sdk'</span>
          </p>
          <p className="text-zinc-600">{'// ...'}</p>
          <p className="mt-4">
            <span className="text-purple-400">const</span>{' '}
            <span className="text-zinc-100">result</span>{' '}
            <span className="text-purple-400">=</span>{' '}
            <span className="text-purple-400">await</span>{' '}
            <span className="text-blue-400">promptly</span>
            <span className="text-zinc-500">.</span>
            <span className="text-yellow-400">run</span>
            <span className="text-zinc-500">(</span>
          </p>
          <p className="pl-4">
            <span className="text-emerald-400">'welcome-email'</span>
            <span className="text-zinc-500">,</span>
          </p>
          <p className="pl-4">
            <span className="text-zinc-500">{'{'}</span>{' '}
            <span className="text-zinc-100">user_name</span>
            <span className="text-zinc-500">:</span>{' '}
            <span className="text-emerald-400">'Sarah'</span>{' '}
            <span className="text-zinc-500">{'}'}</span>
          </p>
          <p>
            <span className="text-zinc-500">)</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-xl shadow-black/5 dark:shadow-black/20 overflow-hidden">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Cost Overview</span>
          <span className="text-xs text-muted-foreground">Last 7 days</span>
        </div>
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-3xl font-bold">$127.45</p>
              <p className="text-sm text-muted-foreground">Total spend</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-emerald-500">-12%</p>
              <p className="text-xs text-muted-foreground">vs last week</p>
            </div>
          </div>
          {/* Mini chart visualization */}
          <div className="flex items-end gap-1 h-16">
            {[40, 65, 45, 80, 55, 70, 50].map((height) => (
              <div
                key={height}
                className="flex-1 rounded-t bg-indigo-500/20 dark:bg-indigo-400/20"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
