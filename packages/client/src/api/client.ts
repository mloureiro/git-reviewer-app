import type { ApiErrorResponse, ApiSuccessResponse } from '../types/review';

/**
 * Thrown when the server returns a non-2xx response.
 * Carries the HTTP status code and the parsed error body.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorResponse;

  constructor(status: number, body: ApiErrorResponse) {
    super(body.error);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    const parsed = await parseJsonSafe(response);
    const body: ApiErrorResponse =
      parsed !== null && typeof parsed === 'object' && 'error' in parsed
        ? (parsed as ApiErrorResponse)
        : { error: response.statusText };
    throw new ApiError(response.status, body);
  }

  const parsed = await parseJsonSafe(response);

  if (parsed === null) {
    throw new ApiError(response.status, { error: 'Server returned a non-JSON response' });
  }

  const wrapper = parsed as ApiSuccessResponse<T> | T;

  // Unwrap envelope when the response has a `data` property, otherwise return as-is.
  if (wrapper !== null && typeof wrapper === 'object' && 'data' in wrapper) {
    return (wrapper as ApiSuccessResponse<T>).data;
  }

  return wrapper as T;
}

/** Perform a GET request and return the parsed response body. */
export function apiGet<T>(url: string): Promise<T> {
  return request<T>(url);
}

/** Perform a POST request with a JSON body and return the parsed response body. */
export function apiPost<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Perform a PUT request with a JSON body and return the parsed response body. */
export function apiPut<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Perform a PATCH request with a JSON body and return the parsed response body. */
export function apiPatch<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Perform a DELETE request and return the parsed response body (or void for 204). */
export async function apiDelete(url: string): Promise<void> {
  const response = await fetch(url, { method: 'DELETE' });

  if (!response.ok) {
    const parsed = await parseJsonSafe(response);
    const body: ApiErrorResponse =
      parsed !== null && typeof parsed === 'object' && 'error' in parsed
        ? (parsed as ApiErrorResponse)
        : { error: response.statusText };
    throw new ApiError(response.status, body);
  }
}
