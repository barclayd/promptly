import {
  index,
  layout,
  type RouteConfig,
  route,
} from '@react-router/dev/routes';

export default [
  route('api/auth/*', './routes/api/auth.ts'),
  route('api/prompts/create', './routes/api/prompts.create.ts'),
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
    route('prompts/create', './routes/prompts.create.tsx'),
    route('prompts/:folderId', './routes/prompts.id.tsx'),
    route('prompts/:folderId/:promptId', './routes/prompts.id.id.tsx'),
  ]),
] satisfies RouteConfig;
