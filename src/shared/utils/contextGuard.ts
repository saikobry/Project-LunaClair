import { useContext, type Context } from 'react';

/**
 * Safely unwraps a React context, throwing a descriptive error if used
 * outside the corresponding provider. Keeps hook boilerplate minimal.
 */
export function useContextOrThrow<T>(ctx: Context<T | null>, hookName: string): T {
  const value = useContext(ctx);
  if (!value) {
    throw new Error(`${hookName} must be used within a <ApplicationProvider>`);
  }
  return value;
}
