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
});

export const buildTicketPath = (token, section = '') =>
  `/ticket/${encodeURIComponent(token)}${section ? `/${section}` : ''}`;
