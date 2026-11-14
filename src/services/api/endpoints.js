/**
 * Endpoints REST centralizados para integração futura com o backend oficial da equipe Articuno.
 */
export const ENDPOINTS = Object.freeze({
  dashboard: {
    overview: '/dashboard/overview',
  },
  sectors: {
    list: '/sectors',
    adjustOccupancy: (setorId) => `/sectors/${encodeURIComponent(setorId)}/adjustments`,
    recommendations: '/sectors/recommendations',
  },
  sessions: {
    list: '/sessions',
  },
  history: {
    events: '/history/events',
    payments: '/history/payments',
    adjustments: '/history/adjustments',
  },
  tickets: {
    byToken: (token) => `/tickets/${encodeURIComponent(token)}`,
    simulatePayment: (token) => `/tickets/${encodeURIComponent(token)}/simulate-payment`,
  },
});
