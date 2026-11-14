import { APP_CONFIG } from '@/config/app.config';

const currencyFormatter = new Intl.NumberFormat(APP_CONFIG.locale, {
  style: 'currency',
  currency: APP_CONFIG.currency,
});

const dateTimeFormatter = new Intl.DateTimeFormat(APP_CONFIG.locale, {
  dateStyle: 'short',
  timeStyle: 'short',
});

const timeFormatter = new Intl.DateTimeFormat(APP_CONFIG.locale, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Formata valor em centavos para moeda BRL (ex.: 600 -> "R$ 6,00"). */
export function formatCurrencyFromCents(cents) {
  const safeCents = Number.isFinite(cents) ? cents : 0;
  return currencyFormatter.format(safeCents / 100);
}

/** Formata string ISO ou Date para data e hora curtas ("14/11/2026 09:30"). */
export function formatDateTime(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateTimeFormatter.format(date);
}

/** Formata string ISO ou Date apenas com horário ("09:30:15"). */
export function formatTime(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return timeFormatter.format(date);
}

/** Formata duração em milissegundos ou minutos de forma legível ("1h 25min" ou "42 min"). */
export function formatDurationFromMs(ms) {
  const safeMs = Math.max(0, Number(ms) || 0);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}min`;
  }
  if (minutes > 0) {
    return `${minutes}min ${String(seconds).padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

/** Formata contagem regressiva em mm:ss. */
export function formatCountdownMs(ms) {
  const safeMs = Math.max(0, Number(ms) || 0);
  const totalSeconds = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Formata placa ou retorna "Não identificada" quando ausente. */
export function formatPlate(plate) {
  if (!plate || typeof plate !== 'string' || !plate.trim()) {
    return 'Não identificada';
  }
  return plate.trim().toUpperCase();
}

/** Formata percentual entre 0 e 1 ("42%"). */
export function formatPercent(ratio) {
  const safeRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
  return `${Math.round(safeRatio * 100)}%`;
}
