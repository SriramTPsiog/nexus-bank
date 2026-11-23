import workerUrl from '../cloudflare-config';

export const configuredEndpoint = import.meta.env.VITE_X42_API_URL || workerUrl;

export function readStorage(storage, key, fallback) {
  try { return JSON.parse(storage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

export function saveStorage(storage, key, value) {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
  } catch { /* The form continues to work without browser storage. */ }
}

export function parseEndpoint(input) {
  let url;
  try { url = new URL(input.trim()); }
  catch { throw new Error('Enter the full HTTPS URL of your Cloudflare Worker.'); }
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) ||
    url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Enter the Worker origin without a path or query, for example https://your-api.workers.dev.');
  }
  return url.origin;
}

export async function liveApi(base, path, { token, data, key, signal } = {}) {
  const headers = new Headers();
  if (token) headers.set('Authorization', 'Bearer ' + token);
  if (key) headers.set('Idempotency-Key', key);
  if (data) headers.set('Content-Type', 'application/json');
  const timeout = AbortSignal.timeout(15_000);
  let response;
  try {
    response = await fetch(base + '/api/v1' + path, {
      method: data ? 'POST' : 'GET', headers, signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      redirect: 'error', credentials: 'omit', ...(data && { body: JSON.stringify(data) }),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    const reason = timeout.aborted ? 'The request timed out.' : 'Could not reach the banking service.';
    throw new Error(key ? reason + ' Check activity before retrying with the same details.' : reason + ' Try again shortly.');
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const unavailable = [429, 503].includes(response.status);
    const message = unavailable ? 'The banking service is temporarily unavailable.' :
      result?.error?.message || 'The banking service returned HTTP ' + response.status + '.';
    const error = new Error(message + (unavailable && key ? ' Check activity before retrying with the same details.' : ''));
    error.status = response.status;
    error.code = result?.error?.code;
    throw error;
  }
  if (!result || typeof result !== 'object') throw new Error('The banking service returned an unreadable response.');
  return result;
}
