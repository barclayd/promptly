import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouteLoaderData } from 'react-router';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import { useOrganizationId } from '~/hooks/use-organization-id';
import { useResourceLimits } from '~/hooks/use-resource-limits';
import { useSubscription } from '~/hooks/use-subscription';
import { createClientStateReader } from '~/lib/interstitials/client-state';
import { INTERSTITIAL_REGISTRY } from '~/lib/interstitials/registry';
import type {
  InterstitialContext,
  InterstitialResult,
} from '~/lib/interstitials/types';
import type { SubscriptionStatus } from '~/plugins/trial-stripe/types';
import type { loader as rootLoader } from '~/root';

export interface ActiveInterstitial {
  id: string;
  // biome-ignore lint/suspicious/noExplicitAny: registry components have varying props
  component: React.ComponentType<any>;
  // biome-ignore lint/suspicious/noExplicitAny: props vary per interstitial
  props: Record<string, any>;
}

const clientStateReader = createClientStateReader();

export const useInterstitials = () => {
  const rootData = useRouteLoaderData<typeof rootLoader>('root');
  const { subscription } = useSubscription();
  const organizationId = useOrganizationId();
  const { canManageBilling } = useCanManageBilling();
  const {
    promptCount,
    promptLimit,
    memberCount,
    memberLimit,
    apiCallCount,
    apiCallLimit,
  } = useResourceLimits();

  const user = rootData?.user;
  const userState =
    (rootData as { userState?: Record<string, string> })?.userState ?? {};

  // Build context
  const ctx: InterstitialContext = useMemo(
    () => ({
      subscription: (subscription ?? null) as SubscriptionStatus | null,
      organizationId,
      userId: user?.id ?? null,
      userCreatedAt: user?.createdAt ? new Date(user.createdAt) : null,
      canManageBilling,
      promptCount,
      promptLimit,
      memberCount,
      memberLimit,
      apiCallCount,
      apiCallLimit,
      userState,
      clientState: clientStateReader,
    }),
    [
      subscription,
      organizationId,
      user?.id,
      user?.createdAt,
      canManageBilling,
      promptCount,
      promptLimit,
      memberCount,
      memberLimit,
      apiCallCount,
      apiCallLimit,
      userState,
    ],
  );

  // Evaluate all registry entries
  const { banners, overlay } = useMemo(() => {
    const activeBanners: ActiveInterstitial[] = [];
    let winningOverlay:
      | (ActiveInterstitial & {
          delay: number;
          priority: number;
        })
      | null = null;

    for (const def of INTERSTITIAL_REGISTRY) {
      const result: InterstitialResult = def.evaluate(ctx);
      if (!result.visible) continue;

      if (def.kind === 'banner') {
        activeBanners.push({
          id: def.id,
          component: def.component,
          props: result.props,
        });
      } else {
        // Overlay: only keep the lowest priority number (highest priority)
        if (!winningOverlay || def.priority < winningOverlay.priority) {
          winningOverlay = {
            id: def.id,
            component: def.component,
            props: result.props,
            delay: def.delay ?? 2000,
            priority: def.priority,
          };
        }
      }
    }

    return { banners: activeBanners, overlay: winningOverlay };
  }, [ctx]);

  // Manage delayed open state for overlay
  const [overlayOpen, setOverlayOpenState] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastOverlayIdRef = useRef<string | null>(null);

  // Track overlay changes and manage delayed open
  if (overlay && overlay.id !== lastOverlayIdRef.current) {
    // New overlay — start delay timer
    lastOverlayIdRef.current = overlay.id;
    if (timerRef.current) clearTimeout(timerRef.current);
    setOverlayOpenState(false);
    timerRef.current = setTimeout(() => {
      setOverlayOpenState(true);
    }, overlay.delay);
  } else if (!overlay && lastOverlayIdRef.current) {
    // Overlay gone — clean up
    lastOverlayIdRef.current = null;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (overlayOpen) {
      setOverlayOpenState(false);
    }
  }

  const setOverlayOpen = useCallback((open: boolean) => {
    setOverlayOpenState(open);
  }, []);

  return {
    banners,
    overlay,
    overlayOpen,
    setOverlayOpen,
  };
};
