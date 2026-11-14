const env = import.meta.env || {};

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const deepFreeze = (obj) => {
  Object.values(obj).forEach((v) => v && typeof v === 'object' && deepFreeze(v));
  return Object.freeze(obj);
};

export const APP_CONFIG = deepFreeze({
  brand: {
    team: 'Articuno',
    product: 'Estacionamento Inteligente',
    venue: 'Capim Dourado Shopping',
  },
  locale: 'pt-BR',
  currency: 'BRL',
  publicOrigin: env.VITE_PUBLIC_ORIGIN || '',
  api: {
    baseUrl: env.VITE_API_BASE_URL || 'http://localhost:3000/api',
    timeoutMs: 8000,
  },
  useMocks: env.VITE_USE_MOCKS !== 'false',
  demoMode: env.VITE_DEMO_MODE !== 'false',
  polling: {
    intervalMs: toNumber(env.VITE_POLLING_MS, 2500),
  },
  pricing: {
    firstHourCents: 600,
    additionalHourCents: 300,
  },
  exitWindowMinutes: 15,
  availability: {
    redMaxFreeRatio: 0.2,
    yellowMaxFreeRatio: 0.4,
  },
  recommendation: {
    availabilityWeight: 0.7,
    proximityWeight: 0.3,
    topN: 3,
  },
  totem: {
    thermalPaperWidthMm: 80,
    autoResetSeconds: toNumber(env.VITE_TOTEM_AUTO_RESET_SECONDS, 25),
    duplicatePlateCooldownMs: 6000,
  },
});

const isLocalHost = () => {
  if (typeof window === 'undefined') return false;
  const { hostname } = window.location;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
};

export const isLocalDemoMode = () =>
  APP_CONFIG.demoMode && APP_CONFIG.useMocks && (Boolean(env.DEV) || isLocalHost());
