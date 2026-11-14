import { APP_CONFIG } from '@/config/app.config';
import { authService } from '@/services/auth.service';
import { ApiError } from './ApiError';

/**
 * Cliente HTTP leve baseado em fetch, preparado para o backend oficial.
 * Suporta baseUrl, timeout, AbortSignal externo, parâmetros de busca e token de autorização.
 */
async function request(path, { method = 'GET', params, body, signal, headers = {} } = {}) {
  const baseUrl = APP_CONFIG.api.baseUrl.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${baseUrl}${cleanPath}`);

  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), APP_CONFIG.api.timeoutMs);

  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const requestHeaders = {
    Accept: 'application/json',
    ...headers,
  };

  const token = authService.getAccessToken();
  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url.toString(), {
      method,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? await response.json() : null;

    if (!response.ok) {
      throw new ApiError(
        payload?.message || `Erro HTTP ${response.status}`,
        response.status,
        payload,
      );
    }

    return payload;
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err?.message || 'Não foi possível comunicar com o servidor.',
      0,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export const httpClient = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
};
