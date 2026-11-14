import { APP_CONFIG } from '@/config/app.config';

export const ROUTES = Object.freeze({
  ROOT: '/',
  ADMIN: {
    DASHBOARD: '/admin',
    VEHICLES: '/admin/veiculos',
    SECTORS: '/admin/setores',
    HISTORY: '/admin/historico',
  },
  DRIVER: {
    TICKET: '/ticket/:token',
    LOCATION: '/ticket/:token/localizacao',
    PAYMENT: '/ticket/:token/pagamento',
  },
  TOTEM: {
    ENTRY: '/totem/entrada',
  },
});

export const buildTicketPath = (token, section = '') =>
  `/ticket/${encodeURIComponent(token)}${section ? `/${section}` : ''}`;

export const buildTicketAbsoluteUrl = (token, origin) => {
  const configuredOrigin = APP_CONFIG.publicOrigin
    ? String(APP_CONFIG.publicOrigin).replace(/\/+$/, '')
    : '';
  const browserOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost:5173';
  const baseOrigin = origin
    ? String(origin).replace(/\/+$/, '')
    : configuredOrigin || browserOrigin;
  return `${baseOrigin}${buildTicketPath(token)}`;
};
