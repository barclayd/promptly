import {
  index,
  layout,
  type RouteConfig,
  route,
} from '@react-router/dev/routes';

export default [
  route('api/auth/*', './routes/api/auth.ts'),
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
    route('prompts/create', './routes/prompts-create.tsx'),
    route('prompts/:id', './routes/prompts-id.tsx'),
    route('prompts/:id/:id', './routes/prompts-id-id.tsx'),
  ]),
] satisfies RouteConfig;
