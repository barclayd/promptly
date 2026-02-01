import { pricingTiers } from '~/lib/landing-data';
import { AnimatedWrapper } from './animated-wrapper';
import { PricingCard } from './pricing-card';

export const PricingSection = () => {
  return (
    <section id="pricing" className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <AnimatedWrapper className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free, scale as you grow. No hidden fees, no surprises.
          </p>
        </AnimatedWrapper>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-start">
          {pricingTiers.map((tier, index) => (
            <AnimatedWrapper key={tier.name} delay={index * 100}>
              <PricingCard {...tier} />
            </AnimatedWrapper>
          ))}
        </div>

        <AnimatedWrapper delay={400} className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            All plans include a 14-day free trial. No credit card required.
          </p>
        </AnimatedWrapper>
      </div>
    </section>
  );
};
