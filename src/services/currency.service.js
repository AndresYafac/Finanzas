import { storage } from './storage.service';

export const CURRENCY_CONFIG_KEY = 'fintrack_currency_config';

export const DEFAULT_CURRENCY_CONFIG = {
  base: 'PEN',
  rates: {
    PEN: 1,
    USD: 3.75,
    EUR: 4.05,
  },
  updated_at: null,
};

export const CURRENCY_SYMBOLS = {
  PEN: 'S/',
  USD: '$',
  EUR: '€',
};

export function getCurrencyConfig() {
  const saved = storage.getJson(CURRENCY_CONFIG_KEY, {});
  return {
    ...DEFAULT_CURRENCY_CONFIG,
    ...saved,
    rates: {
      ...DEFAULT_CURRENCY_CONFIG.rates,
      ...(saved?.rates || {}),
    },
  };
}

export function saveCurrencyConfig(config) {
  const next = {
    ...getCurrencyConfig(),
    ...config,
    rates: {
      ...getCurrencyConfig().rates,
      ...(config?.rates || {}),
    },
    updated_at: new Date().toISOString(),
  };
  storage.setJson(CURRENCY_CONFIG_KEY, next);
  window.dispatchEvent(new Event('fintrack_currency_config'));
  return next;
}

export function convertAmount(amount, fromCurrency, toCurrency, config = getCurrencyConfig()) {
  const from = fromCurrency || config.base;
  const to = toCurrency || config.base;
  const value = Number(amount || 0);
  const fromRate = Number(config.rates?.[from] || 1);
  const toRate = Number(config.rates?.[to] || 1);
  if (!fromRate || !toRate) return value;
  return (value / fromRate) * toRate;
}

export function formatCurrency(amount, currency = getCurrencyConfig().base) {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  return `${symbol} ${Number(amount || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function summarizeByCurrency(rows = [], amountField = 'saldo', currencyField = 'moneda') {
  return rows.reduce((map, row) => {
    const currency = row?.[currencyField] || 'PEN';
    map[currency] = (map[currency] || 0) + Number(row?.[amountField] || 0);
    return map;
  }, {});
}

