import {
  index,
  layout,
  type RouteConfig,
  route,
} from '@react-router/dev/routes';

export default [
  route('api/auth/*', './routes/api/auth.ts'),
  route('api/prompts/create', './routes/api/prompts.create.ts'),
  route('api/prompts/run', './routes/api/prompts.run.ts'),
  route('api/prompt-info', './routes/api/prompt-info.ts'),
  route('auth/social', './routes/auth/social.ts'),
  layout('./routes/layouts/auth.tsx', [
    route('login', './routes/auth/login.tsx'),
    route('sign-up', './routes/auth/sign-up.tsx'),
  ]),
  layout('./routes/layouts/app.tsx', [
    index('./routes/index.tsx'),
    route('home', './routes/home.tsx'),
    route('logout', './routes/logout.tsx'),
    route('prompts', './routes/prompts.tsx'),
    route('prompts/:folderId', './routes/prompts.id.tsx'),
  ]),
  layout('./routes/layouts/prompt-detail.tsx', [
    route(
      'prompts/:folderId/:promptId',
      './routes/prompts.folderId.promptId.tsx',
      {
        id: 'prompt-detail',
      },
    ),
  ]),
] satisfies RouteConfig;
