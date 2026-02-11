// Mock for NextStepjs's internal `next/navigation` import.
// NextStepjs was built for Next.js and imports next/navigation internally.
// This mock satisfies the import in a React Router 7 environment.
export const useRouter = () => ({
  push: () => {},
  replace: () => {},
  back: () => {},
  forward: () => {},
  refresh: () => {},
  prefetch: () => {},
});

export const usePathname = () => '/';
export const useSearchParams = () => new URLSearchParams();
