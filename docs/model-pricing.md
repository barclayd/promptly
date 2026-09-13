# Cost Calculator Feature

The cost calculator popover (`app/components/cost-calculator-popover.tsx`) estimates LLM API costs based on model, token counts, and user preferences.

## Files
- `app/lib/model-pricing.ts` - Model pricing data (input/cached/output prices per 1M tokens)
- `app/lib/currency.ts` - Currency conversion using Frankfurter API
- `app/lib/token-counter.ts` - Token counting (tiktoken for OpenAI, estimates for others)
- `app/components/cost-calculator-popover.tsx` - Main popover component

## Updating Model Prices
Edit `app/lib/model-pricing.ts` and update the `MODEL_PRICING` object. Prices are in USD per 1M tokens:

```typescript
'model-id': {
  id: 'model-id',
  displayName: 'Model Name',
  provider: 'openai' | 'anthropic' | 'google',
  inputPrice: 2.50,        // $/1M input tokens
  cachedInputPrice: 1.25,  // $/1M cached input tokens
  outputPrice: 10.00,      // $/1M output tokens
},
```

Price sources: [llm-prices.com](https://www.llm-prices.com/)

## Adding a New Model (Full Process)

Use the `/project:update-models` slash command for a guided walkthrough. The full process involves:

1. **Research**: Verify the AI SDK model ID at https://github.com/vercel/ai (check PRs and provider source)
2. **Package update**: `bun update @ai-sdk/<provider>` if the model is very new
3. **Pricing entry**: Add to `MODEL_PRICING` in `app/lib/model-pricing.ts`
4. **SDK mapping**: Add display-ID → SDK-ID mapping in `app/lib/model-dispatch.server.ts` (Anthropic uses dots in display IDs but hyphens in SDK IDs)
5. **Landing page**: Update hardcoded model names in `app/components/landing/hero-demo/demo-editor-window.tsx` and `app/components/landing/how-it-works/static-editor-window.tsx` if the new model replaces the flagship
6. **Automated checks**: `bun run lint:fix`, `bun run typecheck`, `bun run test:e2e`
7. **Browser verification**: Add the model via Settings > LLM API Keys (using the provider key from `.env`), test a prompt to confirm streaming works, then verify cost calculator math

### Files that need manual edits
| File | What to add |
|------|-------------|
| `app/lib/model-pricing.ts` | Pricing entry in `MODEL_PRICING` |
| `app/lib/model-dispatch.server.ts` | SDK ID mapping in `MODEL_ID_MAP` (if IDs differ) |
| `app/components/landing/hero-demo/demo-editor-window.tsx` | Update model badge text (if flagship) |
| `app/components/landing/how-it-works/static-editor-window.tsx` | Update model badge text (if flagship) |
| `app/lib/landing-data.ts` | Update model names in FAQ copy (if flagship) |

### Files that auto-derive (no edits needed)
- `app/components/ui/select-scrollable.tsx` — groups models by provider prefix
- `app/components/cost-calculator-popover.tsx` — reads from `getModelPricing()`
- `app/components/create-llm-api-key-dialog.tsx` — reads from `getModelsByProvider()`
- `app/components/sidebar-right.tsx` — uses `SelectScrollable`

## Token Counting
Token counting uses character-based estimation as a fallback before tests are run.
Real accurate values come from the AI SDK response after running a test.

- **OpenAI**: ~4 characters per token (official OpenAI documentation)
- **Anthropic**: ~3.5 characters per token (Anthropic recommendation)
- **Google**: ~4 characters per token (Google AI documentation)

## Currency Conversion
- Uses Frankfurter API (free, no API key): `https://api.frankfurter.dev/v1/latest?base=USD`
- Rates cached in localStorage for 24 hours
- Detects user's locale currency via `Intl.NumberFormat`

## Technical Notes
- Uses `useSyncExternalStore` for localStorage rate subscription (with object caching to prevent re-renders)
- Model selector auto-syncs with sidebar selection from `usePromptEditorStore`
- "Use cached input pricing" checkbox defaults ON for System Prompt, OFF for User Prompt

