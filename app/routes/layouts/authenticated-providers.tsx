import { Outlet } from 'react-router';
import { OnboardingProvider } from '~/components/onboarding/onboarding-provider';
import { RecentsProvider } from '~/context/recents-context';
import { SearchProvider } from '~/context/search-context';

export default function AuthenticatedProviders() {
  return (
    <RecentsProvider>
      <SearchProvider>
        <OnboardingProvider>
          <Outlet />
        </OnboardingProvider>
      </SearchProvider>
    </RecentsProvider>
  );
}
