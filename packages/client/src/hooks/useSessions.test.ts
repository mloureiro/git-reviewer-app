import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSessions } from './useSessions';
import * as reviewsApi from '../api/reviews';
import type { ReviewData } from '../types/review';

vi.mock('../api/reviews');

const mockFetchSessions = vi.mocked(reviewsApi.fetchSessions);

const makeSession = (overrides: Partial<ReviewData['session']> = {}): ReviewData => ({
  version: 1,
  session: {
    id: 'session-1',
    title: 'Test Review',
    baseRef: 'main',
    headRef: 'feature',
    baseCommit: 'abc123',
    headCommit: 'def456',
    status: 'pending',
    createdAt: '2026-03-19T00:00:00Z',
    updatedAt: '2026-03-19T00:00:00Z',
    ...overrides,
  },
  comments: [],
});

describe('useSessions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns loading=true initially', () => {
    mockFetchSessions.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => useSessions());

    expect(result.current.loading).toBe(true);
    expect(result.current.sessions).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('returns sessions on success', async () => {
    const session = makeSession();
    mockFetchSessions.mockResolvedValue({ sessions: [session] });

    const { result } = renderHook(() => useSessions());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.sessions).toEqual([session]);
    expect(result.current.error).toBeNull();
  });

  it('returns empty array when no sessions exist', async () => {
    mockFetchSessions.mockResolvedValue({ sessions: [] });

    const { result } = renderHook(() => useSessions());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.sessions).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('returns error message on failure', async () => {
    mockFetchSessions.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useSessions());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.sessions).toBeNull();
    expect(result.current.error).toBe('Network error');
  });

  it('handles non-Error rejections gracefully', async () => {
    mockFetchSessions.mockRejectedValue('plain string error');

    const { result } = renderHook(() => useSessions());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Failed to fetch sessions');
  });
});
