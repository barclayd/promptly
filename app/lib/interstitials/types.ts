import type { SubscriptionStatus } from '~/plugins/trial-stripe/types';

export type InterstitialKind = 'modal' | 'drawer' | 'banner';

export interface ClientStateReader {
  getLocal: (key: string) => string | null;
  getSession: (key: string) => string | null;
}

export interface InterstitialContext {
  subscription: SubscriptionStatus | null;
  organizationId: string | null;
  userId: string | null;
  userCreatedAt: Date | null;
  canManageBilling: boolean;
  promptCount: number;
  promptLimit: number;
  memberCount: number;
  memberLimit: number;
  apiCallCount: number;
  apiCallLimit: number;
  userState: Record<string, string>;
  clientState: ClientStateReader;
}

export type InterstitialResult<TProps = Record<string, unknown>> =
  | { visible: false }
  | { visible: true; props: TProps };

export interface InterstitialDefinition<TProps = Record<string, unknown>> {
  id: string;
  kind: InterstitialKind;
  priority: number;
  delay?: number;
  evaluate: (ctx: InterstitialContext) => InterstitialResult<TProps>;
  component: React.ComponentType<
    TProps & { open?: boolean; onOpenChange?: (open: boolean) => void }
  >;
}
