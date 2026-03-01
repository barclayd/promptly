import { lazy, Suspense } from 'react';
import { FooterSection } from '~/components/landing/footer-section';
import { HeroSection } from '~/components/landing/hero-section';
import { Navigation } from '~/components/landing/navigation';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/landing';

const PainPointsSection = lazy(() =>
  import('~/components/landing/pain-points-section').then((m) => ({
    default: m.PainPointsSection,
  })),
);

// Lazy-load below-fold sections — prerendered HTML is already in the page for SEO,
// so the Suspense fallback is null (hydration picks up the existing DOM)
const SolutionSection = lazy(() =>
  import('~/components/landing/solution-section').then((m) => ({
    default: m.SolutionSection,
  })),
);
const FeaturesGridSection = lazy(() =>
  import('~/components/landing/features-grid-section').then((m) => ({
    default: m.FeaturesGridSection,
  })),
);
const HowItWorksSection = lazy(() =>
  import('~/components/landing/how-it-works-section').then((m) => ({
    default: m.HowItWorksSection,
  })),
);
const AudienceSection = lazy(() =>
  import('~/components/landing/audience-section').then((m) => ({
    default: m.AudienceSection,
  })),
);
const CostSection = lazy(() =>
  import('~/components/landing/cost-section').then((m) => ({
    default: m.CostSection,
  })),
);
const SocialProofSection = lazy(() =>
  import('~/components/landing/social-proof-section').then((m) => ({
    default: m.SocialProofSection,
  })),
);
const PricingSection = lazy(() =>
  import('~/components/landing/pricing-section').then((m) => ({
    default: m.PricingSection,
  })),
);
const FAQSection = lazy(() =>
  import('~/components/landing/faq-section').then((m) => ({
    default: m.FAQSection,
  })),
);

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const auth = getAuth(context);
  const session = await auth.api.getSession({ headers: request.headers });

  return {
    isAuthenticated: !!session?.user,
  };
};

// biome-ignore lint/correctness/noEmptyPattern: react router default
export const meta = ({}: Route.MetaArgs) => [
  { title: 'Promptly - The CMS for AI Prompts' },
  {
    name: 'description',
    content:
      'Manage, test, and deploy AI prompts without touching code. Empower your whole team to iterate on prompts while developers focus on building.',
  },
  // Canonical URL
  { tagName: 'link', rel: 'canonical', href: 'https://promptlycms.com/' },
  // Open Graph
  { property: 'og:site_name', content: 'Promptly' },
  { property: 'og:locale', content: 'en_GB' },
  { property: 'og:type', content: 'website' },
  { property: 'og:url', content: 'https://promptlycms.com/' },

  { property: 'og:title', content: 'Promptly - The CMS for AI Prompts' },
  {
    property: 'og:description',
    content:
      'Manage, test, and deploy AI prompts without touching code. Empower your whole team to iterate on prompts while developers focus on building.',
  },
  {
    property: 'og:image',
    content: 'https://images.keepfre.sh/app/images/og-image.png',
  },
  { property: 'og:image:width', content: '1200' },
  { property: 'og:image:height', content: '630' },
  // Twitter Card
  { name: 'twitter:card', content: 'summary_large_image' },
  { name: 'twitter:title', content: 'Promptly - The CMS for AI Prompts' },
  {
    name: 'twitter:description',
    content:
      'Manage, test, and deploy AI prompts without touching code. Empower your whole team to iterate on prompts while developers focus on building.',
  },
  {
    name: 'twitter:image',
    content: 'https://images.keepfre.sh/app/images/og-image.png',
  },
];

export default function Landing({ loaderData }: Route.ComponentProps) {
  const { isAuthenticated } = loaderData;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Navigation isAuthenticated={isAuthenticated} />
      <main>
        <HeroSection />
        <Suspense>
          <PainPointsSection />
          <SolutionSection />
          <FeaturesGridSection />
          <HowItWorksSection />
          <AudienceSection />
          <CostSection />
          <SocialProofSection />
          <PricingSection />
          <FAQSection />
        </Suspense>
      </main>
      <FooterSection />
    </div>
  );
}
