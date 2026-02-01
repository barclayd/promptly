import { IconQuote } from '@tabler/icons-react';
import { companyLogos, stats, testimonials } from '~/lib/landing-data';
import { AnimatedWrapper } from './animated-wrapper';

export const SocialProofSection = () => {
  return (
    <section className="py-24 lg:py-32 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Stats */}
        <AnimatedWrapper className="mb-20">
          <div className="grid sm:grid-cols-3 gap-8 max-w-3xl mx-auto text-center">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className={
                  index === 1 ? 'sm:border-x border-border/50 sm:px-8' : ''
                }
              >
                <p className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
                  {stat.value}
                </p>
                <p className="text-muted-foreground mt-2">{stat.label}</p>
              </div>
            ))}
          </div>
        </AnimatedWrapper>

        {/* Company logos */}
        <AnimatedWrapper delay={100} className="mb-20">
          <p className="text-center text-sm text-muted-foreground mb-8">
            Trusted by teams at
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {companyLogos.map((company) => (
              <div
                key={company}
                className="text-lg font-semibold text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                {company}
              </div>
            ))}
          </div>
        </AnimatedWrapper>

        {/* Testimonials */}
        <AnimatedWrapper delay={200}>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.author}
                className="relative p-6 rounded-2xl border border-border/50 bg-card"
              >
                <IconQuote className="absolute top-4 right-4 size-8 text-muted-foreground/10" />
                <blockquote className="text-foreground/80 leading-relaxed mb-6">
                  "{testimonial.quote}"
                </blockquote>
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                    <span className="text-sm font-medium text-foreground">
                      {testimonial.author.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">{testimonial.author}</p>
                    <p className="text-xs text-muted-foreground">
                      {testimonial.role}, {testimonial.company}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </AnimatedWrapper>
      </div>
    </section>
  );
};
