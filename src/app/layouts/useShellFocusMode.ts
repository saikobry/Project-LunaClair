import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../../shared/constants/storageKeys';

/**
 * Shell-owned Focus Mode state (extracted from `AppShell`): initialized from
 * localStorage, persisted on every toggle (idempotent on mount), and toggled
 * globally via Cmd+B (macOS) / Ctrl+B (Windows/Linux).
 */
export function useShellFocusMode() {
  const [isFocusMode, setIsFocusMode] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEYS.settings.focusMode) === 'true',
  );

  // Toggle Focus Mode. Persistence happens in the effect below so the
  // updater stays pure (StrictMode-safe) and rapid toggles never read
  // stale state.
  const toggleFocusMode = useCallback(() => {
    setIsFocusMode((prev) => !prev);
  }, []);

  // Persist Focus Mode whenever it changes (idempotent on mount)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.settings.focusMode, String(isFocusMode));
  }, [isFocusMode]);

  // Global keyboard shortcut: Cmd+B (macOS) / Ctrl+B (Windows/Linux)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b' && !event.repeat) {
        event.preventDefault();
        toggleFocusMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFocusMode]);

  return { isFocusMode, toggleFocusMode };
}
