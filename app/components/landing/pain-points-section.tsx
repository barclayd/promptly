import { painPoints } from '~/lib/landing-data';
import { AnimatedWrapper } from './animated-wrapper';

export const PainPointsSection = () => {
  return (
    <section className="py-24 lg:py-32 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <AnimatedWrapper className="text-center mb-16">
          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mb-3">
            Sound familiar?
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
            The pain of prompts in code
          </h2>
        </AnimatedWrapper>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {painPoints.map((point, index) => (
            <AnimatedWrapper
              key={point.title}
              delay={index * 100}
              className="group"
            >
              <div className="h-full p-6 rounded-2xl border border-border/50 bg-card hover:bg-card/80 hover:border-border transition-all duration-300 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 size-10 rounded-xl bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/15 transition-colors">
                    <point.icon className="size-5 text-red-500 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">
                      {point.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {point.description}
                    </p>
                  </div>
                </div>
              </div>
            </AnimatedWrapper>
          ))}
        </div>
      </div>
    </section>
  );
};
