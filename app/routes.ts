import {
  index,
  layout,
  type RouteConfig,
  route,
} from '@react-router/dev/routes';

export default [
  // Public landing page at root
  index('./routes/landing.tsx'),

  // API routes
  route('api/set-theme', './routes/api/set-theme.ts'),
  route('api/auth/*', './routes/api/auth.ts'),
  route('api/prompts/get', './routes/api/prompts.get.ts'),
  route('api/prompts/create', './routes/api/prompts.create.ts'),
  route('api/prompts/run', './routes/api/prompts.run.ts'),
  route('api/prompts/usage', './routes/api/prompts.usage.ts'),
  route('api/prompts/publish', './routes/api/prompts.publish.ts'),
  route('api/prompts/update', './routes/api/prompts.update.ts'),
  route('api/prompts/delete', './routes/api/prompts.delete.ts'),
  route('api/prompt-info', './routes/api/prompt-info.ts'),
  route('api/generate-input-data', './routes/api/generate-input-data.ts'),
  route('api/team/invite', './routes/api/team.invite.ts'),
  route('api/team/cancel-invite', './routes/api/team.cancel-invite.ts'),
  route(
    'api/settings/create-api-key',
    './routes/api/settings.create-api-key.ts',
  ),
  route(
    'api/settings/delete-api-key',
    './routes/api/settings.delete-api-key.ts',
  ),
  route('api/search-prompts', './routes/api/search-prompts.ts'),
  route('api/request-upgrade', './routes/api/request-upgrade.ts'),
  route(
    'team/accept-invitation/:id',
    './routes/team.accept-invitation.$id.tsx',
  ),
  route('invite/:id', './routes/invite.$id.tsx'),
  route('invite/:id/callback', './routes/invite.$id.callback.tsx'),
  route('auth/social', './routes/auth/social.ts'),
  route(
    'onboarding/setup-workspace',
    './routes/onboarding.setup-workspace.tsx',
  ),
  route('auth/oauth-complete', './routes/auth/oauth-complete.ts'),
  layout('./routes/layouts/auth.tsx', [
    route('login', './routes/auth/login.tsx'),
    route('sign-up', './routes/auth/sign-up.tsx'),
  ]),
  layout('./routes/layouts/app.tsx', [
    route('dashboard', './routes/dashboard.tsx'),
    route('home', './routes/home.tsx'),
    route('logout', './routes/logout.tsx'),
    route('prompts', './routes/prompts.tsx'),
    route('analytics', './routes/analytics.tsx'),
    route('team', './routes/team.tsx'),
    route('settings', './routes/settings.tsx'),
  ]),
  layout('./routes/layouts/prompt-detail.tsx', [
    route('prompts/:promptId', './routes/prompts.promptId.tsx', {
      id: 'prompt-detail',
    }),
  ]),
] satisfies RouteConfig;
