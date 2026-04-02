import { useCallback, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

const ZOOM_KEY = 'git-reviewer:zoom';
const DEFAULT_ZOOM = 1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

function clamp(value: number): number {
  return Math.round(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value)) * 10) / 10;
}

export function useZoom() {
  const [zoom, setZoom] = useLocalStorage<number>(ZOOM_KEY, DEFAULT_ZOOM);

  // Apply zoom to document root
  useEffect(() => {
    document.documentElement.style.zoom = String(zoom);
    return () => {
      document.documentElement.style.zoom = '';
    };
  }, [zoom]);

  const zoomIn = useCallback(() => {
    setZoom(clamp(zoom + ZOOM_STEP));
  }, [zoom, setZoom]);

  const zoomOut = useCallback(() => {
    setZoom(clamp(zoom - ZOOM_STEP));
  }, [zoom, setZoom]);

  const zoomReset = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
  }, [setZoom]);

  // Global keyboard shortcuts: Cmd/Ctrl + =/- /0
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;

      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setZoom(clamp(zoom + ZOOM_STEP));
      } else if (e.key === '-') {
        e.preventDefault();
        setZoom(clamp(zoom - ZOOM_STEP));
      } else if (e.key === '0') {
        e.preventDefault();
        setZoom(DEFAULT_ZOOM);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoom, setZoom]);

  return { zoom, zoomIn, zoomOut, zoomReset };
}
