import { describe, it, expect, vi, beforeEach } from 'vitest';

// We use dynamic imports after vi.resetModules() so each test gets a fresh
// module instance with a clean singleton. Imports at the top of the file would
// be cached and share state across tests.

describe('getBackend', () => {
  beforeEach(() => {
    // Reset all module caches so the singleton `instance` variable starts null.
    vi.resetModules();
    // Reset any window property stubs added by previous tests.
    delete (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'];
  });

  it('returns an HttpBackend instance in a non-Tauri environment', async () => {
    const { getBackend } = await import('./backend-provider');
    const { HttpBackend } = await import('./http-backend');

    const backend = getBackend();

    expect(backend).toBeInstanceOf(HttpBackend);
  });

  it('returns the same instance on repeated calls (singleton)', async () => {
    const { getBackend } = await import('./backend-provider');

    const first = getBackend();
    const second = getBackend();

    expect(first).toBe(second);
  });

  it('returns a TauriBackend instance when __TAURI_INTERNALS__ is present on window', async () => {
    // Simulate a Tauri webview environment.
    (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'] = {};

    const { getBackend } = await import('./backend-provider');
    const { TauriBackend } = await import('./tauri-backend');

    const backend = getBackend();

    expect(backend).toBeInstanceOf(TauriBackend);
  });

  it('returns an HttpBackend when __TAURI_INTERNALS__ is absent', async () => {
    const { getBackend } = await import('./backend-provider');
    const { HttpBackend } = await import('./http-backend');

    const backend = getBackend();

    expect(backend).toBeInstanceOf(HttpBackend);
  });
});
