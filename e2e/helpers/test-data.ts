/**
 * Test data constants for E2E tests
 */

export const TEST_USER = {
  email: 'test@promptlycms.com',
  password: 'Testing123',
} as const;

export const ROUTES = {
  home: '/',
  login: '/login',
  dashboard: '/dashboard',
  prompts: '/prompts',
} as const;
