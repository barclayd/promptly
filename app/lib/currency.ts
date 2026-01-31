/**
 * Currency Conversion Utility
 *
 * Uses the Frankfurter API (free, no API key required) for exchange rates.
 * API documentation: https://frankfurter.dev/
 *
 * Exchange rates are cached in localStorage and refreshed daily.
 */

export type SupportedCurrency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'JPY';

export const SUPPORTED_CURRENCIES: {
  code: SupportedCurrency;
  name: string;
  symbol: string;
}[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '\u20ac' },
  { code: 'GBP', name: 'British Pound', symbol: '\u00a3' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '\u00a5' },
];

const CACHE_KEY = 'exchange_rates_cache';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

type ExchangeRatesCache = {
  rates: Record<string, number>;
  timestamp: number;
};

/**
 * Get cached exchange rates from localStorage
 */
const getCachedRates = (): ExchangeRatesCache | null => {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as ExchangeRatesCache;
    const now = Date.now();

    // Check if cache is still valid
    if (now - parsed.timestamp < CACHE_DURATION_MS) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * Save exchange rates to localStorage cache
 */
const setCachedRates = (rates: Record<string, number>) => {
  if (typeof window === 'undefined') return;

  try {
    const cache: ExchangeRatesCache = {
      rates,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore localStorage errors
  }
};

/**
 * Fetch exchange rates from Frankfurter API
 */
export const fetchExchangeRates = async (): Promise<Record<string, number>> => {
  const cached = getCachedRates();
  if (cached) {
    return cached.rates;
  }

  try {
    const currencies = SUPPORTED_CURRENCIES.map((c) => c.code)
      .filter((c) => c !== 'USD')
      .join(',');

    const response = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=USD&symbols=${currencies}`,
    );

    if (!response.ok) {
      throw new Error('Failed to fetch exchange rates');
    }

    const data = (await response.json()) as { rates: Record<string, number> };
    const rates = { USD: 1, ...data.rates };

    setCachedRates(rates);
    return rates;
  } catch {
    // Return fallback rates if API fails
    return {
      USD: 1,
      EUR: 0.92,
      GBP: 0.79,
      CAD: 1.36,
      AUD: 1.54,
      JPY: 148.5,
    };
  }
};

/**
 * Convert USD to another currency
 */
export const convertFromUSD = (
  amountUSD: number,
  targetCurrency: SupportedCurrency,
  rates: Record<string, number>,
): number => {
  const rate = rates[targetCurrency] ?? 1;
  return amountUSD * rate;
};

/**
 * Format a currency amount for display
 */
export const formatCurrency = (
  amount: number,
  currency: SupportedCurrency,
): string => {
  // JPY doesn't use decimals
  const fractionDigits = currency === 'JPY' ? 0 : amount < 0.01 ? 6 : 4;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
};

/**
 * Detect user's locale currency
 */
export const detectLocaleCurrency = (): SupportedCurrency => {
  if (typeof window === 'undefined') return 'USD';

  try {
    const locale = navigator.language || 'en-US';

    // Map common locales to currencies
    const localeTourrency: Record<string, SupportedCurrency> = {
      'en-US': 'USD',
      'en-GB': 'GBP',
      'en-AU': 'AUD',
      'en-CA': 'CAD',
      'de-DE': 'EUR',
      'fr-FR': 'EUR',
      'es-ES': 'EUR',
      'it-IT': 'EUR',
      'ja-JP': 'JPY',
    };

    const detected = localeTourrency[locale];
    if (detected && SUPPORTED_CURRENCIES.some((c) => c.code === detected)) {
      return detected;
    }

    // Try to detect from locale country code
    if (locale.includes('-')) {
      const country = locale.split('-')[1];
      const countryToCurrency: Record<string, SupportedCurrency> = {
        US: 'USD',
        GB: 'GBP',
        AU: 'AUD',
        CA: 'CAD',
        DE: 'EUR',
        FR: 'EUR',
        ES: 'EUR',
        IT: 'EUR',
        JP: 'JPY',
      };
      const fromCountry = countryToCurrency[country];
      if (fromCountry) return fromCountry;
    }

    return 'USD';
  } catch {
    return 'USD';
  }
};
