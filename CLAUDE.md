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
