import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError, apiGet, apiPost, apiPatch } from './client';

// Use vitest's built-in fetch mock
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('ApiError', () => {
  it('sets name, message, status, and body correctly', () => {
    const err = new ApiError(404, { error: 'Not found' });

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.name).toBe('ApiError');
    expect(err.message).toBe('Not found');
    expect(err.status).toBe(404);
    expect(err.body).toEqual({ error: 'Not found' });
  });
});

describe('apiGet', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns parsed response body on success', async () => {
    const payload = { diff: 'some diff text' };
    mockFetch.mockResolvedValue(makeResponse(200, payload));

    const result = await apiGet<typeof payload>('/api/diff');

    expect(result).toEqual(payload);
    expect(mockFetch).toHaveBeenCalledWith('/api/diff', undefined);
  });

  it('unwraps envelope when response has a data property', async () => {
    const innerData = { sessions: [] };
    mockFetch.mockResolvedValue(makeResponse(200, { data: innerData }));

    const result = await apiGet<typeof innerData>('/api/sessions');

    expect(result).toEqual(innerData);
  });

  it('throws ApiError with correct status and body on non-2xx response', async () => {
    mockFetch.mockResolvedValue(makeResponse(404, { error: 'Session not found' }));

    await expect(apiGet('/api/sessions/unknown')).rejects.toBeInstanceOf(ApiError);

    try {
      await apiGet('/api/sessions/unknown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      if (err instanceof ApiError) {
        expect(err.status).toBe(404);
        expect(err.message).toBe('Session not found');
      }
    }
  });

  it('throws ApiError with 500 status on server error', async () => {
    mockFetch.mockResolvedValue(makeResponse(500, { error: 'Internal error' }));

    await expect(apiGet('/api/diff')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('apiPost', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('sends a POST request with JSON body and returns parsed response', async () => {
    const responseBody = { id: 'session-1', version: 1 };
    mockFetch.mockResolvedValue(makeResponse(201, responseBody));

    const result = await apiPost('/api/sessions', {
      title: 'Test',
      baseRef: 'main',
      headRef: 'HEAD',
    });

    expect(result).toEqual(responseBody);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/sessions',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test', baseRef: 'main', headRef: 'HEAD' }),
      }),
    );
  });

  it('throws ApiError on non-2xx response', async () => {
    mockFetch.mockResolvedValue(makeResponse(400, { error: 'Bad request' }));

    await expect(apiPost('/api/sessions', {})).rejects.toBeInstanceOf(ApiError);
  });
});

describe('apiPatch', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('sends a PATCH request with JSON body and returns parsed response', async () => {
    const responseBody = { id: 'comment-1', resolved: true };
    mockFetch.mockResolvedValue(makeResponse(200, responseBody));

    const result = await apiPatch('/api/sessions/sha/comments/comment-1', { resolved: true });

    expect(result).toEqual(responseBody);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/sessions/sha/comments/comment-1',
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: true }),
      }),
    );
  });

  it('throws ApiError on non-2xx response', async () => {
    mockFetch.mockResolvedValue(makeResponse(404, { error: 'Not found' }));

    await expect(apiPatch('/api/sessions/sha', { status: 'approved' })).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});
