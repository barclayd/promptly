import { IconFlask } from '@tabler/icons-react';
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
  SelectItem,
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
import { calculateTokenCost, getModelPricing } from '~/lib/model-pricing';
import { countTokens, isTokenCountEstimate } from '~/lib/token-counter';
import { useSnippetEditorStore } from '~/stores/snippet-editor-store';

// LocalStorage subscription for exchange rates
// Cache the parsed rates to prevent infinite re-renders
let cachedRatesSnapshot: Record<string, number> | null = null;
let cachedRatesJson: string | null = null;

const subscribeToRates = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};

  const handleStorage = (e: StorageEvent) => {
    if (e.key === 'exchange_rates_cache') {
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

const getCurrencyIcon = (): LucideIcon => {
  if (typeof window === 'undefined') return CircleDollarSign;

  const locale = navigator.language || 'en-US';
  const [language, region] = locale.split('-');

  if (locale === 'en-GB') {
    return CirclePoundSterling;
  }

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

  const euroLanguages = ['de', 'fr', 'it', 'es', 'pt', 'nl', 'el', 'fi'];
  if (!region && euroLanguages.includes(language.toLowerCase())) {
    return BadgeEuro;
  }

  return CircleDollarSign;
};

export const SnippetCostCalculatorPopover = () => {
  const content = useSnippetEditorStore((s) => s.content);
  const model = useSnippetEditorStore((s) => s.model);
  const testModel = useSnippetEditorStore((s) => s.testModel);
  const lastSystemInputTokens = useSnippetEditorStore(
    (s) => s.lastSystemInputTokens,
  );

  // State
  const [isOpen, setIsOpen] = useState(false);
  const [inputTokensOverride, setInputTokensOverride] = useState<string>('');
  const [useCached, setUseCached] = useState(true);
  const [generationCount, setGenerationCount] = useState<string>('1');
  const [currency, setCurrency] = useState<SupportedCurrency>(() =>
    detectLocaleCurrency(),
  );
  const [isLoadingRates, setIsLoadingRates] = useState(false);

  const CurrencyIcon = useMemo(() => getCurrencyIcon(), []);

  const cachedRates = useSyncExternalStore(
    subscribeToRates,
    getExchangeRatesSnapshot,
    getServerSnapshot,
  );

  const [exchangeRates, setExchangeRates] = useState<Record<
    string,
    number
  > | null>(cachedRates);

  const handleOpenChange = useCallback(
    async (open: boolean) => {
      setIsOpen(open);
      if (open) {
        setUseCached(true);

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
    [exchangeRates],
  );

  const effectiveModel = testModel || model || 'gpt-4o';
  const pricing = getModelPricing(effectiveModel);

  const estimatedInputTokens = useMemo(() => {
    if (!content) return 0;
    return countTokens(content, effectiveModel);
  }, [content, effectiveModel]);

  const defaultInputTokens = lastSystemInputTokens ?? estimatedInputTokens;
  const hasStoredInputTokens = lastSystemInputTokens !== null;

  const isEstimate =
    isTokenCountEstimate(effectiveModel) && !hasStoredInputTokens;

  const inputTokensNum =
    inputTokensOverride !== ''
      ? Number.parseInt(inputTokensOverride, 10) || 0
      : defaultInputTokens;
  const countNum = Number.parseInt(generationCount, 10) || 1;

  const costs = useMemo(() => {
    if (!pricing || !exchangeRates) {
      return {
        inputCost: 0,
        total: 0,
      };
    }

    const inputPrice = useCached
      ? pricing.cachedInputPrice
      : pricing.inputPrice;
    const inputCostUSD = calculateTokenCost(inputTokensNum, inputPrice);
    const totalUSD = inputCostUSD * countNum;

    return {
      inputCost: convertFromUSD(inputCostUSD, currency, exchangeRates),
      total: convertFromUSD(totalUSD, currency, exchangeRates),
    };
  }, [pricing, exchangeRates, useCached, inputTokensNum, countNum, currency]);

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <InputGroupButton variant="ghost" size="icon-xs">
          <CurrencyIcon className="size-4" />
        </InputGroupButton>
      </PopoverTrigger>
      <PopoverContent
        className="w-80"
        side="bottom"
        align="end"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="grid gap-4">
          <div className="space-y-2">
            <div className="space-y-1">
              <h4 className="font-medium leading-none">Cost Calculator</h4>
              <p className="text-muted-foreground text-xs">
                Estimate API costs based on your snippet
              </p>
            </div>

            {!hasStoredInputTokens && (
              <div className="flex items-start gap-2.5 rounded-md bg-muted/50 border border-dashed border-muted-foreground/20 px-3 py-2.5">
                <IconFlask className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Run a test to get accurate token counts based on your actual
                  prompt with substituted variables.
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-3">
            {/* Input Tokens */}
            <div className="grid gap-1.5">
              <Label htmlFor="snippet-calc-input-tokens" className="text-xs">
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
                id="snippet-calc-input-tokens"
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
                id="snippet-calc-cached"
                checked={useCached}
                onCheckedChange={(checked) => setUseCached(checked === true)}
              />
              <Label
                htmlFor="snippet-calc-cached"
                className="text-xs font-normal cursor-pointer"
              >
                Use cached input pricing
              </Label>
            </div>

            {/* Generation Count */}
            <div className="grid gap-1.5">
              <Label htmlFor="snippet-calc-count" className="text-xs">
                Number of generations
              </Label>
              <Input
                id="snippet-calc-count"
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
              <Label htmlFor="snippet-calc-currency" className="text-xs">
                Currency
              </Label>
              <Select
                value={currency}
                onValueChange={(v) => setCurrency(v as SupportedCurrency)}
              >
                <SelectTrigger id="snippet-calc-currency" size="sm">
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
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                  System Prompt Snippet
                </p>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Per generation</span>
                  <span>{formatCurrency(costs.inputCost, currency)}</span>
                </div>
                {countNum > 1 ? (
                  <div className="flex justify-between text-sm font-medium">
                    <span>Total ({countNum} generations)</span>
                    <span>{formatCurrency(costs.total, currency)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-sm font-medium">
                    <span>Total</span>
                    <span>{formatCurrency(costs.total, currency)}</span>
                  </div>
                )}
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
