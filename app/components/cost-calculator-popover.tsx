import {
  BadgeEuro,
  CircleDollarSign,
  CirclePoundSterling,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { Checkbox } from '~/components/ui/checkbox';
import { Input } from '~/components/ui/input';
import { InputGroupButton } from '~/components/ui/input-group';
import { Label } from '~/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  convertFromUSD,
  detectLocaleCurrency,
  fetchExchangeRates,
  formatCurrency,
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
} from '~/lib/currency';
import {
  calculateTokenCost,
  getModelPricing,
  getModelsByProvider,
} from '~/lib/model-pricing';
import { countTokens, isTokenCountEstimate } from '~/lib/token-counter';
import { usePromptEditorStore } from '~/stores/prompt-editor-store';

type CostCalculatorPopoverProps = {
  title: string;
  value: string;
};

// LocalStorage subscription for exchange rates
// Cache the parsed rates to prevent infinite re-renders
let cachedRatesSnapshot: Record<string, number> | null = null;
let cachedRatesJson: string | null = null;

const subscribeToRates = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};

  const handleStorage = (e: StorageEvent) => {
    if (e.key === 'exchange_rates_cache') {
      // Invalidate cache when storage changes
      cachedRatesJson = null;
      cachedRatesSnapshot = null;
      callback();
    }
  };
  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
};

const getExchangeRatesSnapshot = () => {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem('exchange_rates_cache');
    // Return cached snapshot if JSON hasn't changed
    if (cached === cachedRatesJson && cachedRatesSnapshot) {
      return cachedRatesSnapshot;
    }
    if (cached) {
      const parsed = JSON.parse(cached);
      cachedRatesJson = cached;
      cachedRatesSnapshot = parsed.rates as Record<string, number>;
      return cachedRatesSnapshot;
    }
  } catch {
    // Ignore
  }
  return null;
};

const getServerSnapshot = () => null;

// Get currency icon based on user's locale
const getCurrencyIcon = (): LucideIcon => {
  if (typeof window === 'undefined') return CircleDollarSign;

  const locale = navigator.language || 'en-US';
  const [language, region] = locale.split('-');

  // en-GB uses pound sterling
  if (locale === 'en-GB') {
    return CirclePoundSterling;
  }

  // European countries use euro (excluding UK)
  const euroCountries = [
    'AT',
    'BE',
    'CY',
    'EE',
    'FI',
    'FR',
    'DE',
    'GR',
    'IE',
    'IT',
    'LV',
    'LT',
    'LU',
    'MT',
    'NL',
    'PT',
    'SK',
    'SI',
    'ES',
    'HR',
  ];
  if (region && euroCountries.includes(region.toUpperCase())) {
    return BadgeEuro;
  }

  // Also check for European language codes without region
  const euroLanguages = ['de', 'fr', 'it', 'es', 'pt', 'nl', 'el', 'fi'];
  if (!region && euroLanguages.includes(language.toLowerCase())) {
    return BadgeEuro;
  }

  // Default: dollar sign (en-US, en-NZ, en-CA, en-AU, etc.)
  return CircleDollarSign;
};

export const CostCalculatorPopover = ({
  title,
  value,
}: CostCalculatorPopoverProps) => {
  const storeModel = usePromptEditorStore((state) => state.model);
  const systemMessage = usePromptEditorStore((state) => state.systemMessage);
  const userMessage = usePromptEditorStore((state) => state.userMessage);
  const lastOutputTokens = usePromptEditorStore(
    (state) => state.lastOutputTokens,
  );
  const lastSystemInputTokens = usePromptEditorStore(
    (state) => state.lastSystemInputTokens,
  );
  const lastUserInputTokens = usePromptEditorStore(
    (state) => state.lastUserInputTokens,
  );
  const isSystemPrompt = title === 'System Prompt';

  // State
  const [isOpen, setIsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [inputTokensOverride, setInputTokensOverride] = useState<string>('');
  const [useCached, setUseCached] = useState(isSystemPrompt);
  const [outputTokens, setOutputTokens] = useState<string>(
    () => lastOutputTokens?.toString() ?? '500',
  );
  const [generationCount, setGenerationCount] = useState<string>('1');
  const [currency, setCurrency] = useState<SupportedCurrency>(() =>
    detectLocaleCurrency(),
  );
  const [isLoadingRates, setIsLoadingRates] = useState(false);

  // Get locale-based currency icon
  const CurrencyIcon = useMemo(() => getCurrencyIcon(), []);

  // Subscribe to exchange rates in localStorage
  const cachedRates = useSyncExternalStore(
    subscribeToRates,
    getExchangeRatesSnapshot,
    getServerSnapshot,
  );

  const [exchangeRates, setExchangeRates] = useState<Record<
    string,
    number
  > | null>(cachedRates);

  // Fetch exchange rates when popover opens
  const handleOpenChange = useCallback(
    async (open: boolean) => {
      setIsOpen(open);
      if (open) {
        // Reset model to store model when opening
        setSelectedModel(storeModel);
        // Reset cached checkbox based on prompt type
        setUseCached(isSystemPrompt);
        // Reset output tokens to latest value from store (may have changed after a test run)
        setOutputTokens(lastOutputTokens?.toString() ?? '500');

        if (!exchangeRates) {
          setIsLoadingRates(true);
          try {
            const rates = await fetchExchangeRates();
            setExchangeRates(rates);
          } finally {
            setIsLoadingRates(false);
          }
        }
      }
    },
    [storeModel, isSystemPrompt, exchangeRates, lastOutputTokens],
  );

  // Use selected model or fall back to store model
  const effectiveModel = selectedModel ?? storeModel ?? 'gpt-4o';
  const pricing = getModelPricing(effectiveModel);

  // Get stored input tokens for this prompt type
  const storedInputTokens = isSystemPrompt
    ? lastSystemInputTokens
    : lastUserInputTokens;

  // Calculate estimated tokens from text (fallback when no stored value)
  const estimatedInputTokens = useMemo(() => {
    if (!value) return 0;
    return countTokens(value, effectiveModel);
  }, [value, effectiveModel]);

  // Default input tokens: use stored value if available, otherwise estimate
  const defaultInputTokens = storedInputTokens ?? estimatedInputTokens;
  const hasStoredInputTokens = storedInputTokens !== null;

  // Calculate tokens for the other prompt
  const storedOtherInputTokens = isSystemPrompt
    ? lastUserInputTokens
    : lastSystemInputTokens;
  const otherPromptValue = isSystemPrompt ? userMessage : systemMessage;
  const otherPromptTokensEstimate = useMemo(() => {
    if (!otherPromptValue) return 0;
    return countTokens(otherPromptValue, effectiveModel);
  }, [otherPromptValue, effectiveModel]);
  const otherPromptTokens = storedOtherInputTokens ?? otherPromptTokensEstimate;

  const isEstimate =
    isTokenCountEstimate(effectiveModel) && !hasStoredInputTokens;

  // Parse numeric inputs
  const inputTokensNum =
    inputTokensOverride !== ''
      ? Number.parseInt(inputTokensOverride, 10) || 0
      : defaultInputTokens;
  const outputTokensNum = Number.parseInt(outputTokens, 10) || 0;
  const countNum = Number.parseInt(generationCount, 10) || 1;

  // Calculate costs
  const costs = useMemo(() => {
    if (!pricing || !exchangeRates) {
      return {
        inputCost: 0,
        outputCost: 0,
        perGeneration: 0,
        total: 0,
        otherInputCost: 0,
        combinedPerGeneration: 0,
        combinedTotal: 0,
      };
    }

    const inputPrice = useCached
      ? pricing.cachedInputPrice
      : pricing.inputPrice;
    const inputCostUSD = calculateTokenCost(inputTokensNum, inputPrice);
    const outputCostUSD = calculateTokenCost(
      outputTokensNum,
      pricing.outputPrice,
    );
    const perGenerationUSD = inputCostUSD + outputCostUSD;
    const totalUSD = perGenerationUSD * countNum;

    // Calculate other prompt cost
    // System prompts typically use cached pricing, user prompts use regular pricing
    const otherInputPrice = isSystemPrompt
      ? pricing.inputPrice // User prompt uses regular pricing
      : pricing.cachedInputPrice; // System prompt uses cached pricing
    const otherInputCostUSD = calculateTokenCost(
      otherPromptTokens,
      otherInputPrice,
    );

    // Combined costs include both prompts
    const combinedPerGenerationUSD =
      inputCostUSD + otherInputCostUSD + outputCostUSD;
    const combinedTotalUSD = combinedPerGenerationUSD * countNum;

    return {
      inputCost: convertFromUSD(inputCostUSD, currency, exchangeRates),
      outputCost: convertFromUSD(outputCostUSD, currency, exchangeRates),
      perGeneration: convertFromUSD(perGenerationUSD, currency, exchangeRates),
      total: convertFromUSD(totalUSD, currency, exchangeRates),
      otherInputCost: convertFromUSD(
        otherInputCostUSD,
        currency,
        exchangeRates,
      ),
      combinedPerGeneration: convertFromUSD(
        combinedPerGenerationUSD,
        currency,
        exchangeRates,
      ),
      combinedTotal: convertFromUSD(combinedTotalUSD, currency, exchangeRates),
    };
  }, [
    pricing,
    exchangeRates,
    useCached,
    inputTokensNum,
    outputTokensNum,
    countNum,
    currency,
    isSystemPrompt,
    otherPromptTokens,
  ]);

  const openaiModels = getModelsByProvider('openai');
  const anthropicModels = getModelsByProvider('anthropic');
  const googleModels = getModelsByProvider('google');

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <InputGroupButton variant="ghost" size="icon-xs">
          <CurrencyIcon className="size-4" />
        </InputGroupButton>
      </PopoverTrigger>
      <PopoverContent className="w-80" side="bottom" align="end">
        <div className="grid gap-4">
          <div className="space-y-1">
            <h4 className="font-medium leading-none">Cost Calculator</h4>
            <p className="text-muted-foreground text-xs">
              Estimate API costs based on your current prompt
            </p>
          </div>

          <div className="grid gap-3">
            {/* Model Selector */}
            <div className="grid gap-1.5">
              <Label htmlFor="calc-model" className="text-xs">
                Model
              </Label>
              <Select value={effectiveModel} onValueChange={setSelectedModel}>
                <SelectTrigger id="calc-model" size="sm">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>OpenAI</SelectLabel>
                    {openaiModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.displayName}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Anthropic</SelectLabel>
                    {anthropicModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.displayName}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Google Gemini</SelectLabel>
                    {googleModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.displayName}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Input Tokens */}
            <div className="grid gap-1.5">
              <Label htmlFor="calc-input-tokens" className="text-xs">
                Input tokens{' '}
                {hasStoredInputTokens ? (
                  <span className="text-muted-foreground">
                    (from last test)
                  </span>
                ) : isEstimate ? (
                  <span className="text-muted-foreground">(estimate)</span>
                ) : null}
              </Label>
              <Input
                id="calc-input-tokens"
                type="number"
                min="0"
                value={
                  inputTokensOverride !== ''
                    ? inputTokensOverride
                    : defaultInputTokens
                }
                onChange={(e) => setInputTokensOverride(e.target.value)}
                onFocus={(e) => {
                  if (inputTokensOverride === '') {
                    setInputTokensOverride(String(defaultInputTokens));
                  }
                  e.target.select();
                }}
                className="h-8"
              />
            </div>

            {/* Cached Input Toggle */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="calc-cached"
                checked={useCached}
                onCheckedChange={(checked) => setUseCached(checked === true)}
              />
              <Label
                htmlFor="calc-cached"
                className="text-xs font-normal cursor-pointer"
              >
                Use cached input pricing
              </Label>
            </div>

            {/* Output Tokens */}
            <div className="grid gap-1.5">
              <Label htmlFor="calc-output-tokens" className="text-xs">
                Output tokens
                {lastOutputTokens && (
                  <span className="text-muted-foreground">
                    {' '}
                    (from last test)
                  </span>
                )}
              </Label>
              <Input
                id="calc-output-tokens"
                type="number"
                min="0"
                value={outputTokens}
                onChange={(e) => setOutputTokens(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="h-8"
              />
            </div>

            {/* Generation Count */}
            <div className="grid gap-1.5">
              <Label htmlFor="calc-count" className="text-xs">
                Number of generations
              </Label>
              <Input
                id="calc-count"
                type="number"
                min="1"
                value={generationCount}
                onChange={(e) => setGenerationCount(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="h-8"
              />
            </div>

            {/* Currency Selector */}
            <div className="grid gap-1.5">
              <Label htmlFor="calc-currency" className="text-xs">
                Currency
              </Label>
              <Select
                value={currency}
                onValueChange={(v) => setCurrency(v as SupportedCurrency)}
              >
                <SelectTrigger id="calc-currency" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((curr) => (
                    <SelectItem key={curr.code} value={curr.code}>
                      {curr.symbol} {curr.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cost Display */}
          <div className="border-t pt-3 space-y-2">
            {isLoadingRates ? (
              <p className="text-muted-foreground text-sm">
                Loading exchange rates...
              </p>
            ) : (
              <>
                {/* This prompt section */}
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                  {title}
                </p>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Input cost</span>
                  <span>{formatCurrency(costs.inputCost, currency)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Output cost</span>
                  <span>{formatCurrency(costs.outputCost, currency)}</span>
                </div>
                <div className="flex justify-between text-xs border-t pt-2">
                  <span className="text-muted-foreground">Per generation</span>
                  <span>{formatCurrency(costs.perGeneration, currency)}</span>
                </div>

                {/* Other prompt section */}
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide pt-2">
                  {isSystemPrompt ? 'User Prompt' : 'System Prompt'}
                </p>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Input cost</span>
                  <span>{formatCurrency(costs.otherInputCost, currency)}</span>
                </div>

                {/* Combined total section */}
                <div className="border-t pt-2 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      Combined per generation
                    </span>
                    <span>
                      {formatCurrency(costs.combinedPerGeneration, currency)}
                    </span>
                  </div>
                  {countNum > 1 && (
                    <div className="flex justify-between text-sm font-medium">
                      <span>
                        Combined total ({countNum} generation
                        {countNum > 1 ? 's' : ''})
                      </span>
                      <span>
                        {formatCurrency(costs.combinedTotal, currency)}
                      </span>
                    </div>
                  )}
                  {countNum === 1 && (
                    <div className="flex justify-between text-sm font-medium">
                      <span>Combined total</span>
                      <span>
                        {formatCurrency(costs.combinedTotal, currency)}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Pricing Info */}
          {pricing && (
            <div className="text-[10px] text-muted-foreground border-t pt-2">
              <p>
                {pricing.displayName}: ${pricing.inputPrice}/1M input
                {useCached && ` ($${pricing.cachedInputPrice} cached)`}, $
                {pricing.outputPrice}/1M output
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
