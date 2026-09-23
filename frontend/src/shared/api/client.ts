const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '/api';

type QueryValue = string | number | boolean | undefined;

interface ApiErrorPayload {
  error?: string;
  message?: string | string[];
  statusCode?: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: ApiErrorPayload,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  });

  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  if (init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiError('Unable to reach the CMQ API.', 0);
  }

  if (!response.ok) {
    const details = await readErrorPayload(response);
    const fallback =
      response.status >= 500
        ? 'The CMQ API returned a server error. Try again.'
        : response.status === 404
          ? 'The requested record was not found.'
          : response.status === 409
            ? 'The request conflicts with an existing record.'
            : `Request failed with status ${response.status}`;
    const message = Array.isArray(details?.message)
      ? details.message.join(', ')
      : details?.message || details?.error || fallback;

    throw new ApiError(message, response.status, details);
  }

  return (await response.json()) as T;
}

async function readErrorPayload(
  response: Response,
): Promise<ApiErrorPayload | undefined> {
  try {
    return (await response.json()) as ApiErrorPayload;
  } catch {
    return undefined;
  }
}
