/**
 * Utilitários de validação, normalização e geração de placas veiculares
 * nos padrões brasileiros (Mercosul AAA0A00 e padrão anterior AAA0000).
 */

const MERCOSUL_PLATE_REGEX = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
const LEGACY_PLATE_REGEX = /^[A-Z]{3}[0-9]{4}$/;

/**
 * Normaliza uma placa removendo espaços, hífens e convertendo para maiúsculas.
 * Retorna `null` quando vazia ou ausente.
 */
export function normalizePlate(rawPlate) {
  if (rawPlate === null || rawPlate === undefined) return null;
  const cleaned = String(rawPlate)
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, '');
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Verifica se a placa informada obedece ao formato brasileiro (Mercosul ou antigo).
 */
export function isValidVehiclePlate(rawPlate) {
  const normalized = normalizePlate(rawPlate);
  if (!normalized) return false;
  return MERCOSUL_PLATE_REGEX.test(normalized) || LEGACY_PLATE_REGEX.test(normalized);
}

/**
 * Gera um identificador público amigável do ticket a partir do token seguro,
 * sem expor o ID interno da sessão (SES-xxxx).
 */
export function formatPublicTicketCode(token) {
  if (!token || typeof token !== 'string') return 'TCK-000000';
  const clean = token.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const suffix = clean.slice(0, 4) + '-' + clean.slice(-4);
  return `TCK-${suffix}`;
}

/**
 * Gera uma placa Mercosul válida para simulação no modo de demonstração.
 */
export function generateSimulatedPlate(prefix = 'ART') {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '0123456789';
  const pick = (chars) => chars[Math.floor(Math.random() * chars.length)];
  const safePrefix =
    typeof prefix === 'string' && /^[A-Za-z]{3}$/.test(prefix)
      ? prefix.toUpperCase()
      : `${pick(letters)}${pick(letters)}${pick(letters)}`;
  return `${safePrefix}${pick(digits)}${pick(letters)}${pick(digits)}${pick(digits)}`;
}
