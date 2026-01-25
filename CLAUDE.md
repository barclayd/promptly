# Code Style
- Always use arrow functions instead of function declarations
- Use `export const` inline rather than separate export statements

# React Patterns
- Avoid `useEffect` wherever possible - it causes unintended bugs
- Use ref callbacks for DOM-related side effects (focus, scroll, measurements) instead of `useRef` + `useEffect`
- Prefer event-driven patterns (e.g., `useDebouncedCallback` over debounced values with useEffect)
- Use `useSyncExternalStore` for external state synchronization
- Use Navigation API listeners, event handlers, and other non-effect patterns when possible

# Agent Preferences
- Use typescript-developer agent when writing TypeScript code
- Use frontend-design skill plugin when implementing UI features
- Always test frontend changes using Chrome Dev Tools MCP

# Local Testing
- Test user email: test@promptlycms.com
- Test user password: Testing123
- Local dev server: http://localhost:5173

# Production Testing
- Production URL: https://promptlycms.com
- Test user email: test@promptlycms.com
- Test user password: Testing123
- To test prompts: Create a new prompt via the "Create" button in the sidebar or navigate to /prompts

# Database & Migrations
- D1 database migrations are stored in `migrations/drizzle/`
- Apply local migrations with: `bunx wrangler d1 migrations apply promptly --local`
- Apply remote migrations with: `bunx wrangler d1 migrations apply promptly --remote`
- The local D1 database is stored in `.wrangler/state/v3/d1/` (not `migrations/local.db`)
- Better Auth uses Kysely with CamelCasePlugin - table names become lowercase (e.g., `apiKey` → `apikey`)
- Column names use snake_case in the database (e.g., `userId` → `user_id`)
