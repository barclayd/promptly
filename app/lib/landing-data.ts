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
  {
    icon: IconLock,
    title: 'Wrong people, wrong job',
    description:
      'Developers become copywriters. Marketing waits in ticket queues. Everyone stuck doing work outside their expertise.',
  },
];

export type Feature = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  badge?: string | string[];
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
    badge: ['TypeScript', 'API'],
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
      '5,000 API calls/month',
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
    question: 'What is Promptly?',
    answer:
      'Promptly is a prompt management platform that lets teams create, test, version, and deploy AI prompts without code changes. Editors get a familiar writing interface; developers integrate once with a type-safe SDK. Changes go live instantly — no PRs, no deployments.',
  },
  {
    question: 'Do I need coding experience to use Promptly?',
    answer:
      // biome-ignore lint/suspicious/noTemplateCurlyInString: docs
      'No. The editor works like Google Docs — write in plain text, add variables like ${customer_name}, and test with sample data. Developers handle the one-time integration; after that, anyone can edit and publish prompts.',
  },
  {
    question: 'What AI providers do you support?',
    answer:
      "Promptly is model-agnostic. We support all models from OpenAI (GPT-4, GPT-5 and others), all models Anthropic (Claude 4.5 Haiku, Sonnet and 4.5 Opus), Google Gemini, Grok other LLMs supported by Vercel's AI SDK.",
  },
  {
    question: 'Is my data secure?',
    answer:
      "Yes. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We're hosted on SOC 2 Type II certified infrastructure and never train on your data.",
  },
  {
    question: 'How much does Promptly cost?',
    answer:
      'Free: 3 prompts, 5,000 API calls/month. Pro ($29/mo): unlimited prompts, 50,000 API calls. Team ($99/mo): unlimited everything plus SSO and audit logs. All plans include a 14-day free trial.',
  },
  {
    question: 'Can I try Promptly before committing?',
    answer:
      'Yes. Every plan includes a 14-day free trial with full Pro features — no credit card required. The Free plan is also available indefinitely for evaluation.',
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
    role: 'CTO',
    company: 'KeepFresh',
  },
  {
    quote:
      'Finally, our product team can own their prompts. Engineers focus on building features, not sending Google Docs changes back and forth.',
    author: 'Hannah S',
    role: 'Head of CRM',
    company: 'AVB',
  },
];

export const companyLogos = [
  'AnyVan',
  'KeepFresh',
  'AVB',
  'myFridge',
  'TripSplit',
];

export const stats = [
  { value: '1M+', label: 'API calls processed' },
  { value: '300+', label: 'Users on Promptly' },
  { value: '99.9%', label: 'Uptime SLA' },
];
