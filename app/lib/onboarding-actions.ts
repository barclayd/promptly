import { nanoid } from 'nanoid';
import type { SchemaField } from '~/lib/schema-types';

export const getTimeOfDay = (): string => {
  const hour = new Date().getHours();
  if (hour < 5) return 'Midnight';
  if (hour < 12) return 'Morning';
  if (hour < 14) return 'Lunchtime';
  if (hour < 17) return 'Afternoon';
  if (hour < 19) return 'Early evening';
  if (hour < 21) return 'Evening';
  return 'Nighttime';
};

export const getPromptName = (firstName: string) => `Welcome ${firstName}`;

export const getPromptDescription = (firstName: string) =>
  `A sample prompt to show ${firstName} how to get started with Promptly and just how easy it is to manage your prompts and ship AI agents in production at lightening speed`;

export const SYSTEM_MESSAGE = `You are the welcome assistant for PromptlyCMS, a modern content management platform. Your job is to greet new users warmly and personally when they first log in.

Behaviour:

Address the user by their first name if available.
Keep your tone friendly, upbeat, and professional — like a helpful colleague on their first day.
Deliver exactly 3 short bullet points highlighting the key benefits of using PromptlyCMS. Each bullet should start with a relevant emoji and be no longer than one sentence.
After the bullets, include a brief closing line encouraging them to get started or explore.

Benefits to communicate (adapt wording naturally, don't recite verbatim):

Effortless content creation — AI-assisted editing and templates that let you publish faster.
Full control, zero complexity — Manage pages, media, and SEO settings from one clean dashboard.
Built to grow with you — From a single blog to a multi-site setup, PromptlyCMS scales as your needs evolve.

Formatting rules:

Use emojis at the start of each bullet point to aid scannability.
Do not use more than 3 bullet points.
Keep the entire message concise — aim for under 100 words total.
Do not include technical jargon or onboarding instructions. This is a welcome moment, not a tutorial.`;

// Template variables use ${var} syntax — Promptly's runtime replaces them.
// prettier-ignore
export const USER_MESSAGE =
  // biome-ignore lint/suspicious/noTemplateCurlyInString: prompt template variables
  "The user's first name is: ${first_name}\nThe current time of day is: ${time_of_day}\n\nPlease welcome this user to PromptlyCMS. Tailor your greeting to the time of day and address them by their first name. If the first name is empty or unavailable, use a friendly generic greeting instead.";

export const getSchemaFields = (): SchemaField[] => [
  {
    id: nanoid(),
    name: 'first_name',
    type: 'string',
    validations: [],
    params: { description: "The user's first name" },
  },
  {
    id: nanoid(),
    name: 'time_of_day',
    type: 'string',
    validations: [],
    params: { description: 'Current time of day' },
  },
];

export const getInputData = (firstName: string) => ({
  first_name: firstName,
  time_of_day: getTimeOfDay(),
});
