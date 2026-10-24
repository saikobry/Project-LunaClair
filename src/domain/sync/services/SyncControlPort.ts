/**
 * Port contract for persisting and retrieving sync control state (such as pause)
 * across browser sessions, scoped by vault owner identity.
 */
export interface SyncControlPort {
  isPaused(ownerSub?: string): boolean;
  pause(ownerSub?: string): void;
  resume(ownerSub?: string): void;
}
