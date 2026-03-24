import { useCallback, useEffect, useState } from 'react';

/**
 * Generic persisted state hook. Reads from localStorage on mount and writes on every value change.
 * Falls back to `initialValue` if the stored value is missing or cannot be parsed.
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return initialValue;
      return JSON.parse(item) as T;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(storedValue));
    } catch {
      // Ignore write errors (e.g. storage quota exceeded, private browsing restrictions)
    }
  }, [key, storedValue]);

  const setValue = useCallback((value: T) => {
    setStoredValue(value);
  }, []);

  return [storedValue, setValue];
}
