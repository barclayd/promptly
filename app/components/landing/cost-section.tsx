import { IconBell, IconChartBar, IconTrendingDown } from '@tabler/icons-react';
import { Badge } from '~/components/ui/badge';
import { AnimatedWrapper } from './animated-wrapper';

const costFeatures = [
  {
    icon: IconChartBar,
    title: 'Per-call tracking',
    description: 'See exactly what each prompt costs, down to the token.',
  },
  {
    icon: IconBell,
    title: 'Real-time alerts',
    description: 'Get notified before you hit spending limits.',
  },
  {
    icon: IconTrendingDown,
    title: 'Optimization insights',
    description: 'Identify expensive prompts and reduce waste.',
  },
];

export const CostSection = () => {
  return (
    <section className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Content */}
          <AnimatedWrapper direction="left">
            <div className="space-y-6">
              <Badge
                variant="outline"
                className="px-3 py-1.5 bg-amber-500/10 border-amber-200 dark:border-amber-800"
              >
                <span className="text-amber-600 dark:text-amber-400">
                  Cost Management
                </span>
              </Badge>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
                No more billing surprises
              </h2>

              <p className="text-lg text-muted-foreground leading-relaxed">
                Track costs in real-time, set spending alerts, and optimize your
                prompts before the bill arrives. Know exactly where every dollar
                goes.
              </p>

              <div className="space-y-4 pt-4">
                {costFeatures.map((feature) => (
                  <div key={feature.title} className="flex items-start gap-4">
                    <div className="shrink-0 size-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <feature.icon className="size-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">
                        {feature.title}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedWrapper>

          {/* Right: Dashboard mockup */}
          <AnimatedWrapper direction="right" delay={200}>
            <div className="relative">
              <div className="rounded-2xl border border-border/50 bg-card shadow-2xl shadow-black/10 dark:shadow-black/30 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
                  <h3 className="font-semibold">Cost Dashboard</h3>
                  <select className="text-xs bg-muted rounded-md px-2 py-1 border-0 focus:ring-0">
                    <option>Last 7 days</option>
                  </select>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 p-6 border-b border-border/50">
                  {[
                    { label: 'Total Spend', value: '$127.45', change: '-12%' },
                    { label: 'API Calls', value: '24.3K', change: '+8%' },
                    { label: 'Avg Cost/Call', value: '$0.005', change: '-3%' },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <p className="text-xs text-muted-foreground mb-1">
                        {stat.label}
                      </p>
                      <p className="text-lg font-bold">{stat.value}</p>
                      <p
                        className={`text-xs ${
                          stat.change.startsWith('-')
                            ? 'text-emerald-500'
                            : 'text-amber-500'
                        }`}
                      >
                        {stat.change}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Chart */}
                <div className="p-6">
                  <p className="text-xs text-muted-foreground mb-4">
                    Daily Spend
                  </p>
                  <div className="flex items-end gap-2 h-32">
                    {[35, 55, 40, 70, 45, 60, 50].map((height) => (
                      <div
                        key={height}
                        className="flex-1 rounded-t-md bg-gradient-to-t from-amber-500/60 to-amber-400/40"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(
                      (day) => (
                        <span key={day}>{day}</span>
                      ),
                    )}
                  </div>
                </div>

                {/* Top prompts */}
                <div className="px-6 pb-6">
                  <p className="text-xs text-muted-foreground mb-3">
                    Top Prompts by Cost
                  </p>
                  <div className="space-y-2">
                    {[
                      { name: 'product-description', cost: '$45.20', pct: 35 },
                      { name: 'customer-support', cost: '$32.10', pct: 25 },
                      { name: 'email-generator', cost: '$28.50', pct: 22 },
                    ].map((prompt) => (
                      <div
                        key={prompt.name}
                        className="flex items-center gap-3"
                      >
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium">{prompt.name}</span>
                            <span className="text-muted-foreground">
                              {prompt.cost}
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${prompt.pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Decorative elements */}
              <div className="absolute -top-6 -right-6 size-24 rounded-full bg-amber-500/10 blur-2xl" />
              <div className="absolute -bottom-6 -left-6 size-32 rounded-full bg-orange-500/10 blur-2xl" />
            </div>
          </AnimatedWrapper>
        </div>
      </div>
    </section>
  );
};
