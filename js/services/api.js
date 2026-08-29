export class ApiError extends Error {
  constructor(message, { status = 0, code = 'API_ERROR', cause } = {}) {
    super(message, { cause });
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function postJSON(path, body = {}, { timeout = 8000, signal } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  const abort = () => ctrl.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  }
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`, { status: res.status, code: 'HTTP_ERROR' });
    try { return await res.json(); }
    catch (cause) { throw new ApiError('接口返回的不是有效 JSON', { status: res.status, code: 'BAD_JSON', cause }); }
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    const code = cause?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR';
    throw new ApiError(code === 'TIMEOUT' ? '请求超时' : '网络请求失败', { code, cause });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', abort);
  }
}

export async function postJSONSafe(path, body = {}, options = {}) {
  try { return await postJSON(path, body, options); }
  catch (error) { return { degraded: true, reason: error.code || 'API_ERROR', error }; }
}
