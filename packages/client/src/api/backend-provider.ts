import type { Backend } from './backend';
import { HttpBackend } from './http-backend';
import { TauriBackend } from './tauri-backend';

let instance: Backend | null = null;

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Return the singleton Backend for the current environment.
 *
 * - In a Tauri webview → TauriBackend (IPC via `invoke`)
 * - Otherwise           → HttpBackend  (REST via `fetch`)
 *
 * The backend is lazily created on the first call.
 */
export function getBackend(): Backend {
  if (instance) {
    return instance;
  }

  instance = isTauri() ? new TauriBackend() : new HttpBackend();

  return instance;
}
