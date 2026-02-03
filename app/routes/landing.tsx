import { AudienceSection } from '~/components/landing/audience-section';
import { CostSection } from '~/components/landing/cost-section';
import { FAQSection } from '~/components/landing/faq-section';
import { FeaturesGridSection } from '~/components/landing/features-grid-section';
import { FooterSection } from '~/components/landing/footer-section';
import { HeroSection } from '~/components/landing/hero-section';
import { HowItWorksSection } from '~/components/landing/how-it-works-section';
import { Navigation } from '~/components/landing/navigation';
import { PainPointsSection } from '~/components/landing/pain-points-section';
import { PricingSection } from '~/components/landing/pricing-section';
import { SocialProofSection } from '~/components/landing/social-proof-section';
import { SolutionSection } from '~/components/landing/solution-section';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/landing';

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
        <PainPointsSection />
        <SolutionSection />
        <FeaturesGridSection />
        <HowItWorksSection />
        <AudienceSection />
        <CostSection />
        <SocialProofSection />
        <PricingSection />
        <FAQSection />
      </main>
      <FooterSection />
    </div>
  );
}
