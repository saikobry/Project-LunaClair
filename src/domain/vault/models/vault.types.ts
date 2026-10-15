/**
 * Domain contracts and models for Vault namespacing and Registry in LunaClair.
 *
 * Implements Phase 2 BYOS Vault Architecture (ADR-018).
 * Decouples logical user account identity (`ownerSub`) from physical IndexedDB
 * database names (`lc_vault_${uuid}`) for zero-copy promotion.
 * Zero UI or React dependencies.
 */

/**
 * Standard identifier for anonymous / unauthenticated vault ownership.
 */
export const ANONYMOUS_OWNER_SUB = 'ANONYMOUS';

/**
 * Registry pointer mapping a logical user identity to a physical IndexedDB database.
 */
export interface VaultPointer {
  ownerSub: string;
  physicalDbName: string;
  createdAt: number;
  lastActiveAt: number;
}

/**
 * Result of promoting an anonymous vault to an authenticated user identity.
 */
export interface PromotionResult {
  pointer: VaultPointer;
  collisionFromAnonDb?: string;
}

/**
 * Capability port for managing local vault pointers and lifecycle.
 */
export interface VaultRegistryPort {
  /**
   * Resolves the active vault pointer.
   * If `preferredSub` is given, returns that user's vault if it exists.
   * Otherwise, returns the active 'ANONYMOUS' vault, creating it if no vault exists yet.
   */
  getActiveVault(preferredSub?: string): Promise<VaultPointer>;

  /**
   * Promotes an anonymous vault to a new authenticated owner `sub`.
   * If no vault exists for `newOwnerSub`, atomically updates the pointer's owner.
   * If `newOwnerSub` already has a local vault, returns existing vault and notes
   * `collisionFromAnonDb` so the caller can merge data if desired.
   */
  promoteAnonymousVault(newOwnerSub: string): Promise<PromotionResult>;

  /**
   * Lists all registered vault pointers.
   */
  listVaults(): Promise<VaultPointer[]>;

  /**
   * Switches the active vault to `targetSub`, updating its lastActiveAt timestamp.
   * Throws if the target vault is not found.
   */
  switchActiveVault(targetSub: string): Promise<VaultPointer>;

  /**
   * Deletes a vault and removes its physical IndexedDB database.
   */
  deleteVault(ownerSub: string): Promise<void>;
}
