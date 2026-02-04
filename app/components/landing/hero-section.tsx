import { IconArrowRight, IconSparkles } from '@tabler/icons-react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { AnimatedWrapper } from './animated-wrapper';
import { HeroDemoStack } from './hero-demo';
import { SocialProofBadge } from './social-proof-badge';

export const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center pt-12 sm:pt-16 overflow-hidden">
      {/* Background gradient mesh */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[min(600px,80vw)] h-[min(600px,80vw)] bg-indigo-500/20 rounded-full blur-[128px] dark:bg-indigo-500/10" />
        <div className="absolute bottom-0 right-1/4 w-[min(500px,70vw)] h-[min(500px,70vw)] bg-purple-500/20 rounded-full blur-[128px] dark:bg-purple-500/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(800px,100%)] h-[min(800px,100%)] bg-pink-500/10 rounded-full blur-[128px] dark:bg-pink-500/5" />
      </div>

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.015] dark:opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px),
                           linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
        }}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Copy */}
          <div className="flex flex-col gap-5 sm:gap-8">
            <AnimatedWrapper delay={0}>
              <Badge
                variant="outline"
                className="w-fit px-3 py-1.5 bg-background/50 backdrop-blur-sm border-indigo-200 dark:border-indigo-800"
              >
                <IconSparkles className="size-3.5 text-indigo-500 mr-1.5" />
                <span className="text-muted-foreground">
                  The CMS for AI prompts
                </span>
              </Badge>
            </AnimatedWrapper>

            <AnimatedWrapper delay={100}>
              <h1 className="text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.05] sm:leading-[1.1]">
                Your prompts don't belong in{' '}
                <span className="relative">
                  <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                    your codebase
                  </span>
                  <svg
                    className="absolute -bottom-2 left-0 w-full h-3 text-indigo-500/30"
                    viewBox="0 0 200 12"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M0,8 Q50,0 100,8 T200,8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>
            </AnimatedWrapper>

            <AnimatedWrapper delay={200}>
              <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-lg leading-relaxed">
                Manage, test, and deploy AI prompts without touching code.
                Empower your whole team to iterate on prompts while developers
                focus on building.
              </p>
            </AnimatedWrapper>

            <AnimatedWrapper delay={250}>
              <SocialProofBadge />
            </AnimatedWrapper>

            <AnimatedWrapper delay={300}>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button
                  size="lg"
                  asChild
                  className="group shadow-xl shadow-primary/25 text-base"
                >
                  <a href="https://app.promptlycms.com/sign-up">
                    Start free
                    <IconArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </a>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="text-base"
                >
                  <a href="#features">See how it works</a>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2 sm:mt-3">
                No credit card required. Free tier available.
              </p>
            </AnimatedWrapper>
          </div>

          {/* Right: Animated Demo Stack */}
          <AnimatedWrapper direction="right" delay={400} className="lg:pl-8">
            <div className="relative">
              <HeroDemoStack className="w-full max-w-xl mx-auto lg:mx-0" />
              {/* Decorative elements */}
              <div className="absolute -top-8 -left-8 size-16 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 blur-xl" />
              <div className="absolute -bottom-8 -right-8 size-24 rounded-full bg-gradient-to-br from-pink-500/20 to-orange-500/20 blur-xl" />
            </div>
          </AnimatedWrapper>
        </div>
      </div>
    </section>
  );
};
