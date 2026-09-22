/** Thin wrapper around fetch so every caller gets the same error shape. */

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details ?? [];
  }
}

export async function request(path, { method = 'GET', body, headers = {}, signal } = {}) {
  let response;

  try {
    response = await fetch(path, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch {
    throw new ApiError('No connection to the server. Check your network and try again.', {
      status: 0,
      code: 'network_error',
    });
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(payload?.error?.message ?? `Request failed (${response.status}).`, {
      status: response.status,
      code: payload?.error?.code,
      details: payload?.error?.details,
    });
  }

  return payload;
}

export const api = {
  availability: () => request('/api/availability'),
  submitLead: (lead) => request('/api/leads', { method: 'POST', body: lead }),
};
