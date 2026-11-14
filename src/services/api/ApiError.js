/**
 * Erro padronizado para falhas de comunicação com a API REST ou regras dos serviços.
 */
export class ApiError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}
