export type Plan = 'free' | 'pro' | 'enterprise';

export type SubscriptionStatusValue =
  | 'trialing'
  | 'active'
  | 'canceled'
  | 'expired'
  | 'past_due';

export interface PlanLimits {
  prompts: number;
  teamMembers: number;
  apiCalls: number;
}

export interface PlanConfig {
  name: Plan;
  priceId: string;
  yearlyPriceId?: string;
  limits: PlanLimits;
}

export interface FreePlanConfig {
  name: Plan;
  limits: PlanLimits;
}

export interface TrialConfig {
  days: number;
  plan: Plan;
}

export interface TrialStripePluginOptions {
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  trial: TrialConfig;
  freePlan: FreePlanConfig;
  plans: PlanConfig[];
  hooks?: {
    onTrialStart?: (userId: string) => Promise<void> | void;
    onSubscriptionChange?: (
      userId: string,
      plan: Plan,
      status: SubscriptionStatusValue,
    ) => Promise<void> | void;
  };
}

export interface SubscriptionStatus {
  plan: Plan;
  status: SubscriptionStatusValue;
  isTrial: boolean;
  hadTrial: boolean;
  daysLeft: number | null;
  limits: PlanLimits;
  cancelAtPeriodEnd: boolean;
  periodEnd: number | null;
}

export interface SubscriptionRecord {
  id: string;
  userId: string;
  organizationId: string | null;
  plan: Plan;
  status: SubscriptionStatusValue;
  trialStart: number | null;
  trialEnd: number | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  periodStart: number | null;
  periodEnd: number | null;
  cancelAtPeriodEnd: number;
  createdAt: number;
  updatedAt: number;
}
