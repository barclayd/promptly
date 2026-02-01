/**
 * Test data constants for E2E tests
 */

export const TEST_USER = {
  email: 'test@promptlycms.com',
  password: 'Testing123',
} as const;

export const ROUTES = {
  landing: '/',
  home: '/dashboard',
  login: '/login',
  dashboard: '/dashboard',
  prompts: '/prompts',
  analytics: '/analytics',
  team: '/team',
  settings: '/settings',
} as const;

export const TIMEOUTS = {
  autoSave: 3500, // Auto-save delay + buffer
  streaming: 30000, // Max time for streaming response
  navigation: 5000, // Page navigation timeout
} as const;
