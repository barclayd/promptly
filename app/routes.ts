import { type RouteConfig, route, index, layout } from '@react-router/dev/routes';

export default [
  route('api/auth/*', './routes/api/auth-catchall.ts'),
  route('auth/social', './routes/auth/social.ts'),
  layout('./routes/layouts/auth.tsx', [
    route('login', './routes/auth/login.tsx'),
    route('sign-up', './routes/auth/sign-up.tsx'),
  ]),
  layout('./routes/layouts/app.tsx', [
    index('./routes/app/index.tsx'),
    route('home', './routes/app/home.tsx'),
    route('logout', './routes/app/logout.tsx'),
    route('prompts', './routes/app/prompts.tsx'),
    route('prompts/create', './routes/app/prompts-create.tsx'),
    route('prompts/:id', './routes/app/prompts-id.tsx'),
    route('prompts/:id/:id', './routes/app/prompts-id-id.tsx'),
  ]),
] satisfies RouteConfig;
