import {
  IconAlertCircle,
  IconClock,
  IconCode,
  IconCoin,
  IconGitBranch,
  IconLock,
  IconRocket,
  IconUserOff,
  IconUsers,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';

export type PainPoint = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
};

export const painPoints: PainPoint[] = [
  {
    icon: IconCode,
    title: 'Prompts buried in code',
    description:
      'Your most valuable AI logic is scattered across repositories, hidden in string literals and config files.',
  },
  {
    icon: IconClock,
    title: 'Waiting for deployments',
    description:
      'A simple prompt tweak requires a PR, review, merge, and deploy. Days lost to process.',
  },
  {
    icon: IconGitBranch,
    title: 'No version visibility',
    description:
      "When something breaks, you're digging through git history trying to find what changed.",
  },
  {
    icon: IconAlertCircle,
    title: 'Cost surprises',
    description:
      "You only discover expensive prompts after the bill arrives. By then, it's too late.",
  },
  {
    icon: IconUserOff,
    title: 'Domain experts locked out',
    description:
      'The people who understand your content best need to ask engineers for every change.',
  },
];

export type Feature = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  badge?: string;
};

export const features: Feature[] = [
  {
    icon: IconUsers,
    title: 'Real-time collaboration',
    description:
      'Edit prompts together like Google Docs. See changes instantly, no merge conflicts.',
    badge: 'Live',
  },
  {
    icon: IconGitBranch,
    title: 'Version history & diffs',
    description:
      'Track every change with side-by-side comparisons. Roll back with one click.',
  },
  {
    icon: IconRocket,
    title: 'Instant deployment',
    description: 'Publish changes immediately. No PRs, no deploys, no waiting.',
  },
  {
    icon: IconCoin,
    title: 'Cost tracking',
    description:
      'Monitor spending per prompt in real-time. Set alerts before budgets blow up.',
  },
  {
    icon: IconCode,
    title: 'Developer SDK',
    description:
      'Easy to integrate API. TypeScript client with Zod schemas. Full autocomplete, zero guesswork.',
    badge: 'TypeScript',
  },
  {
    icon: IconLock,
    title: 'Secure & isolated',
    description:
      'Environment separation, audit logs, and granular permissions. Enterprise ready.',
  },
];

export type WorkflowStep = {
  step: number;
  title: string;
  description: string;
  visual: 'editor' | 'code' | 'iterate';
};

export const workflowSteps: WorkflowStep[] = [
  {
    step: 1,
    title: 'Create your prompt',
    description:
      'Write prompts in a familiar editor with syntax highlighting, variables, and live preview.',
    visual: 'editor',
  },
  {
    step: 2,
    title: 'Integrate once',
    description:
      'Add our SDK to your app. Type-safe prompts with full autocomplete.',
    visual: 'code',
  },
  {
    step: 3,
    title: 'Iterate freely',
    description:
      'Make changes anytime without touching code. Your app stays up to date automatically.',
    visual: 'iterate',
  },
];

export type AudienceCard = {
  title: string;
  forRole: string;
  benefits: string[];
};

export const audienceCards: AudienceCard[] = [
  {
    title: 'For Developers',
    forRole: 'developers',
    benefits: [
      "Seamless integration with Vercel's AI SDK",
      'Type-safe TypeScript SDK',
      'Full Zod schema validation',
      'Autocomplete for all prompts',
      'No more string interpolation',
    ],
  },
  {
    title: 'For Editors',
    forRole: 'editors',
    benefits: [
      'Familiar document editor',
      'Test prompts before publishing',
      'See changes in real-time',
      'Collaborate with your team',
      'No code knowledge required',
    ],
  },
];

export type PricingTier = {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  popular?: boolean;
};

export const pricingTiers: PricingTier[] = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'For individuals and small projects',
    features: [
      '3 prompts',
      '1 team member',
      'Basic analytics',
      'Community support',
      '1,000 API calls/month',
    ],
    cta: 'Start free',
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    description: 'For growing teams shipping AI features',
    features: [
      'Unlimited prompts',
      '5 team members',
      'Version history',
      'Advanced analytics',
      'Priority support',
      '50,000 API calls/month',
    ],
    cta: 'Start free trial',
    popular: true,
  },
  {
    name: 'Team',
    price: '$99',
    period: '/month',
    description: 'For organizations with advanced needs',
    features: [
      'Everything in Pro',
      'Unlimited team members',
      'SSO / SAML',
      'Audit logs',
      'Dedicated support',
      'Unlimited API calls',
    ],
    cta: 'Contact sales',
  },
];

export type FAQ = {
  question: string;
  answer: string;
};

export const faqs: FAQ[] = [
  {
    question: 'How does Promptly compare to storing prompts in my codebase?',
    answer:
      'Promptly separates your prompt logic from your application code. This means content teams can iterate on prompts without engineering involvement, changes go live instantly without deployments, and you get version history, analytics, and cost tracking out of the box.',
  },
  {
    question: 'Is my data secure?',
    answer:
      "Absolutely. All data is encrypted at rest and in transit. We never train on your prompts or outputs. Each organization's data is isolated, and we support SSO, audit logs, and granular permissions for enterprise customers.",
  },
  {
    question: 'What AI providers do you support?',
    answer:
      'Promptly works with OpenAI, Anthropic, Google, and any OpenAI-compatible API. You bring your own API keys, so you maintain full control over your AI provider relationships and costs.',
  },
  {
    question: 'How does the SDK work?',
    answer:
      'Install our npm package, initialize it with your API key, and call your prompts by name. You get full TypeScript types, Zod validation for inputs, and automatic updates when prompts change. No more managing prompt strings in your code.',
  },
  {
    question: 'Can I try Promptly before committing?',
    answer:
      'Yes! Our free tier includes 3 prompts and 1,000 API calls per month. No credit card required. You can upgrade anytime as your needs grow.',
  },
  {
    question: 'What happens if Promptly goes down?',
    answer:
      'Our SDK includes built-in caching and fallback support. If our service is unavailable, your app continues working with cached prompts. We also maintain 99.9% uptime SLA for paid plans.',
  },
];

export type Testimonial = {
  quote: string;
  author: string;
  role: string;
  company: string;
  avatar?: string;
};

export const testimonials: Testimonial[] = [
  {
    quote:
      'We cut our prompt iteration cycle from days to minutes. Our content team can now experiment freely without waiting for engineering.',
    author: 'Sarah D-G',
    role: 'Head of Product Marketing',
    company: 'AnyVan',
  },
  {
    quote:
      'The cost tracking alone paid for itself in the first week. We found a runaway prompt that was costing us $2000/day. Promptly gave us visibility and controls to run AI at scale.',
    author: 'Dan B',
    role: 'Engineering Lead',
    company: 'KeepFresh',
  },
  {
    quote:
      'Finally, our product team can own their prompts. Engineers focus on building features, not sending Google Docs changes back and forth.',
    author: 'Hannah S',
    role: 'VP Product',
    company: 'AI First Labs',
  },
];

export const companyLogos = ['AnyVan', 'KeepFresh', 'TripSplit'];

export const stats = [
  { value: '1M+', label: 'API calls processed' },
  { value: '300+', label: 'Users on Promptly' },
  { value: '99.9%', label: 'Uptime SLA' },
];
