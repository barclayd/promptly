import { features } from '~/lib/landing-data';
import { AnimatedWrapper } from './animated-wrapper';
import { FeatureCard } from './feature-card';

export const FeaturesGridSection = () => {
  return (
    <section className="py-24 lg:py-32 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <AnimatedWrapper className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Everything you need
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A complete platform for managing AI prompts at scale, from creation
            to deployment.
          </p>
        </AnimatedWrapper>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <AnimatedWrapper key={feature.title} delay={index * 100}>
              <FeatureCard
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                badge={feature.badge}
              />
            </AnimatedWrapper>
          ))}
        </div>
      </div>
    </section>
  );
};
