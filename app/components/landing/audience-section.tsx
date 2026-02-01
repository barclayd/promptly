import { IconCheck, IconCode, IconPencil } from '@tabler/icons-react';
import { audienceCards } from '~/lib/landing-data';
import { AnimatedWrapper } from './animated-wrapper';

export const AudienceSection = () => {
  return (
    <section className="py-24 lg:py-32 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <AnimatedWrapper className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Built for your whole team
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Whether you're writing code or crafting content, Promptly fits into
            your workflow.
          </p>
        </AnimatedWrapper>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {audienceCards.map((card, index) => (
            <AnimatedWrapper
              key={card.forRole}
              direction={index === 0 ? 'left' : 'right'}
              delay={index * 150}
            >
              <div className="h-full p-8 rounded-2xl border border-border/50 bg-card shadow-lg shadow-black/5 dark:shadow-black/20">
                <div className="flex items-center gap-4 mb-6">
                  <div
                    className={`size-12 rounded-xl flex items-center justify-center ${
                      card.forRole === 'developers'
                        ? 'bg-indigo-500/10'
                        : 'bg-purple-500/10'
                    }`}
                  >
                    {card.forRole === 'developers' ? (
                      <IconCode className="size-6 text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <IconPencil className="size-6 text-purple-600 dark:text-purple-400" />
                    )}
                  </div>
                  <h3 className="text-2xl font-bold">{card.title}</h3>
                </div>

                <ul className="space-y-4">
                  {card.benefits.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-3">
                      <div className="shrink-0 size-5 rounded-full bg-emerald-500/10 flex items-center justify-center mt-0.5">
                        <IconCheck className="size-3 text-emerald-500" />
                      </div>
                      <span
                        className={`${
                          benefit.startsWith('npm') ||
                          benefit.includes('TypeScript') ||
                          benefit.includes('Zod')
                            ? 'font-mono text-sm bg-muted px-2 py-0.5 rounded'
                            : ''
                        } text-foreground/80`}
                      >
                        {benefit}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </AnimatedWrapper>
          ))}
        </div>
      </div>
    </section>
  );
};
