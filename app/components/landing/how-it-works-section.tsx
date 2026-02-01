import { IconArrowRight, IconVariable } from '@tabler/icons-react';
import { workflowSteps } from '~/lib/landing-data';
import { AnimatedWrapper } from './animated-wrapper';

export const HowItWorksSection = () => {
  return (
    <section className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <AnimatedWrapper className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            How it works
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get started in minutes, not months. Three steps to prompt management
            bliss.
          </p>
        </AnimatedWrapper>

        <div className="grid lg:grid-cols-3 gap-8 lg:gap-6">
          {workflowSteps.map((step, index) => (
            <AnimatedWrapper key={step.step} delay={index * 150}>
              <div className="relative">
                {/* Connector line (desktop only) */}
                {index < workflowSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-full w-6 h-0.5 bg-gradient-to-r from-border to-transparent z-10">
                    <IconArrowRight className="absolute -right-1 -top-[7px] size-4 text-muted-foreground/50" />
                  </div>
                )}

                <div className="h-full flex flex-col">
                  {/* Step number */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="size-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-500/25">
                      {step.step}
                    </div>
                    <h3 className="text-xl font-semibold">{step.title}</h3>
                  </div>

                  {/* Visual */}
                  <div className="mb-6 flex-1">
                    <StepVisual visual={step.visual} />
                  </div>

                  {/* Description */}
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            </AnimatedWrapper>
          ))}
        </div>
      </div>
    </section>
  );
};

const StepVisual = ({ visual }: { visual: string }) => {
  if (visual === 'editor') {
    return (
      <div className="rounded-xl border border-border/50 bg-card shadow-lg overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/30">
          <div className="flex gap-1">
            <div className="size-2 rounded-full bg-red-400/80" />
            <div className="size-2 rounded-full bg-yellow-400/80" />
            <div className="size-2 rounded-full bg-green-400/80" />
          </div>
          <span className="text-[10px] text-muted-foreground ml-2">
            onboarding.prompt
          </span>
        </div>
        <div className="p-4 font-mono text-xs space-y-2">
          <p className="text-foreground/80">
            Welcome{' '}
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <IconVariable className="size-2.5" />
              name
            </span>{' '}
            to our platform!
          </p>
          <p className="text-muted-foreground">Help them get started with...</p>
        </div>
      </div>
    );
  }

  if (visual === 'code') {
    return (
      <div className="rounded-xl border border-border/50 bg-zinc-950 shadow-lg overflow-hidden font-mono text-xs">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
          <span className="text-zinc-500">index.ts</span>
        </div>
        <div className="p-4 text-zinc-300 space-y-1">
          <p>
            <span className="text-purple-400">const</span>{' '}
            <span className="text-zinc-100">msg</span>{' '}
            <span className="text-purple-400">=</span>{' '}
            <span className="text-purple-400">await</span>
          </p>
          <p className="pl-2">
            <span className="text-blue-400">promptly</span>
            <span className="text-zinc-500">.</span>
            <span className="text-yellow-400">run</span>
            <span className="text-zinc-500">(</span>
            <span className="text-emerald-400">'onboarding'</span>
            <span className="text-zinc-500">,</span>
          </p>
          <p className="pl-4">
            <span className="text-zinc-500">{'{'}</span>{' '}
            <span className="text-zinc-100">name</span>
            <span className="text-zinc-500">:</span> user
            <span className="text-zinc-500">.</span>name{' '}
            <span className="text-zinc-500">{'}'}</span>
          </p>
          <p className="pl-2">
            <span className="text-zinc-500">)</span>
          </p>
        </div>
      </div>
    );
  }

  // iterate
  return (
    <div className="rounded-xl border border-border/50 bg-card shadow-lg overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Version History
          </span>
          <span className="text-[10px] text-emerald-500 font-medium">Live</span>
        </div>
        <div className="space-y-2">
          {[
            { version: 'v3', time: 'Just now', active: true },
            { version: 'v2', time: '2 hours ago', active: false },
            { version: 'v1', time: 'Yesterday', active: false },
          ].map((v) => (
            <div
              key={v.version}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                v.active
                  ? 'bg-emerald-500/10 border border-emerald-500/20'
                  : 'bg-muted/50'
              }`}
            >
              <span
                className={
                  v.active
                    ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                    : 'text-muted-foreground'
                }
              >
                {v.version}
              </span>
              <span className="text-muted-foreground">{v.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
