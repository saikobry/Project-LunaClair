import { createContext, useContext, useMemo, type ReactNode } from 'react';

export interface FocusModeContextValue {
  isFocusMode: boolean;
}

/**
 * Cross-cutting Focus Mode state, provided by `AppShell` so deeply-nested
 * toolbars (reader annotation toolbar, quiz canvas card toolbar) can react
 * to the mode without prop-drilling through every intermediate screen.
 * React context flows through portals, so the mobile toolbars that portal
 * to `document.body` still receive updates.
 */
// Not exported — consumers use the `useFocusMode` hook (keeps fast-refresh clean).
const FocusModeContext = createContext<FocusModeContextValue | null>(null);

export function FocusModeProvider({
  isFocusMode,
  children,
}: {
  isFocusMode: boolean;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ isFocusMode }), [isFocusMode]);
  return <FocusModeContext.Provider value={value}>{children}</FocusModeContext.Provider>;
}

// oxlint-disable-next-line react/only-export-components
export function useFocusMode(): FocusModeContextValue {
  const ctx = useContext(FocusModeContext);
  if (!ctx) {
    throw new Error('useFocusMode must be used within a FocusModeProvider');
  }
  return ctx;
}
