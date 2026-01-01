# Code Style
- Always use arrow functions instead of function declarations
- Use `export const` inline rather than separate export statements

# React Patterns
- Avoid `useEffect` wherever possible - it causes unintended bugs
- Prefer event-driven patterns (e.g., `useDebouncedCallback` over debounced values with useEffect)
- Use `useSyncExternalStore` for external state synchronization
- Use Navigation API listeners, event handlers, and other non-effect patterns when possible

# Agent Preferences
- Use typescript-developer agent when writing TypeScript code
