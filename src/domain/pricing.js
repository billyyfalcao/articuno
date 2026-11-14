import { APP_CONFIG } from '@/config/app.config';
import { SESSION_STATUS } from './constants';

/**
 * Cálculo demonstrativo de tarifa (exibição no frontend).
 *
 * Regras oficiais do projeto:
 *  - R$ 6,00 (600 centavos) pela primeira hora (até 60 min).
 *  - R$ 3,00 (300 centavos) por hora adicional iniciada.
 *  - Após pagamento simulado, o motorista tem 15 minutos para realizar a saída.
 *  - Caso o prazo de 15 min expire sem saída, o pagamento anterior permanece
 *    registrado, porém a autorização de saída fica inválida (exige regularização).
 *    A cobrança adicional definitiva é responsabilidade do backend.
 */
export function calculateEstimatedTariff(entradaEm, referenceNow = Date.now()) {
  const startMs = new Date(entradaEm).getTime();
  const nowMs =
    referenceNow instanceof Date ? referenceNow.getTime() : Number(referenceNow) || Date.now();

  if (Number.isNaN(startMs)) {
    return {
      elapsedMs: 0,
      elapsedMinutes: 0,
      additionalHours: 0,
      firstHourCents: APP_CONFIG.pricing.firstHourCents,
      additionalCents: 0,
      totalCents: APP_CONFIG.pricing.firstHourCents,
    };
  }

  const elapsedMs = Math.max(0, nowMs - startMs);
  const elapsedMinutes = elapsedMs / 60000;
  const additionalHours =
    elapsedMinutes <= 60 ? 0 : Math.ceil((elapsedMinutes - 60) / 60);

  const { firstHourCents, additionalHourCents } = APP_CONFIG.pricing;
  const additionalCents = additionalHours * additionalHourCents;
  const totalCents = firstHourCents + additionalCents;

  return {
    elapsedMs,
    elapsedMinutes: Math.floor(elapsedMinutes),
    additionalHours,
    firstHourCents,
    additionalHourCents,
    additionalCents,
    totalCents,
  };
}

/**
 * Calcula a data/hora limite para saída após o pagamento (pagoEm + 15 minutos).
 */
export function computeExitDeadlineIso(pagoEm) {
  const paidMs = new Date(pagoEm).getTime();
  const baseMs = Number.isNaN(paidMs) ? Date.now() : paidMs;
  const deadlineMs = baseMs + APP_CONFIG.exitWindowMinutes * 60 * 1000;
  return new Date(deadlineMs).toISOString();
}

/**
 * Avalia o estado da autorização de saída de uma sessão paga.
 *
 * Importante: se o prazo expirar, a sessão NÃO volta automaticamente para ATIVA
 * nem desconsidera o pagamento realizado; a autorização de saída fica inválida
 * (`isAuthorizationValid = false` e `requiresRegularization = true`).
 */
export function evaluateExitAuthorization(session, referenceNow = Date.now()) {
  if (!session || session.status !== SESSION_STATUS.PAID || !session.prazoSaidaEm) {
    return {
      hasExitWindow: false,
      remainingMs: 0,
      isExpired: false,
      isAuthorizationValid: false,
      requiresRegularization: false,
      deadlineIso: session?.prazoSaidaEm || null,
    };
  }

  const deadlineMs = new Date(session.prazoSaidaEm).getTime();
  const nowMs =
    referenceNow instanceof Date ? referenceNow.getTime() : Number(referenceNow) || Date.now();
  const remainingMs = Math.max(0, deadlineMs - nowMs);
  const isExpired = nowMs > deadlineMs;

  return {
    hasExitWindow: true,
    remainingMs,
    isExpired,
    isAuthorizationValid: !isExpired,
    requiresRegularization: isExpired,
    deadlineIso: session.prazoSaidaEm,
  };
}
