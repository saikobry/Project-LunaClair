import { describe, it, expect } from 'vitest';
import {
  ANONYMOUS_OWNER_SUB,
  type VaultPointer,
  type PromotionResult,
  type VaultRegistryPort,
} from '../vault.types';

describe('vault.types — domain models and contracts', () => {
  it('exports the standard ANONYMOUS_OWNER_SUB constant', () => {
    expect(ANONYMOUS_OWNER_SUB).toBe('ANONYMOUS');
  });

  it('conforms to VaultPointer shape', () => {
    const pointer: VaultPointer = {
      ownerSub: ANONYMOUS_OWNER_SUB,
      physicalDbName: 'lc_vault_1234567890abcdef1234567890abcdef',
      createdAt: 1700000000000,
      lastActiveAt: 1700000000000,
    };

    expect(pointer.ownerSub).toBe('ANONYMOUS');
    expect(pointer.physicalDbName).toBe('lc_vault_1234567890abcdef1234567890abcdef');
    expect(pointer.createdAt).toBe(1700000000000);
    expect(pointer.lastActiveAt).toBe(1700000000000);
  });

  it('conforms to PromotionResult shape with and without collision', () => {
    const directResult: PromotionResult = {
      pointer: {
        ownerSub: 'google-sub-123',
        physicalDbName: 'lc_vault_anon_db',
        createdAt: 1700000000000,
        lastActiveAt: 1700000001000,
      },
    };
    expect(directResult.collisionFromAnonDb).toBeUndefined();

    const collisionResult: PromotionResult = {
      pointer: {
        ownerSub: 'google-sub-123',
        physicalDbName: 'lc_vault_user_db',
        createdAt: 1690000000000,
        lastActiveAt: 1700000002000,
      },
      collisionFromAnonDb: 'lc_vault_anon_db',
    };
    expect(collisionResult.collisionFromAnonDb).toBe('lc_vault_anon_db');
  });

  it('enforces VaultRegistryPort method signatures', async () => {
    class MockVaultRegistry implements VaultRegistryPort {
      private pointer: VaultPointer = {
        ownerSub: ANONYMOUS_OWNER_SUB,
        physicalDbName: 'lc_vault_mock',
        createdAt: 1000,
        lastActiveAt: 1000,
      };

      async getActiveVault(_preferredSub?: string): Promise<VaultPointer> {
        return this.pointer;
      }

      async promoteAnonymousVault(newOwnerSub: string): Promise<PromotionResult> {
        this.pointer = { ...this.pointer, ownerSub: newOwnerSub };
        return { pointer: this.pointer };
      }

      async listVaults(): Promise<VaultPointer[]> {
        return [this.pointer];
      }

      async switchActiveVault(targetSub: string): Promise<VaultPointer> {
        if (this.pointer.ownerSub !== targetSub) {
          throw new Error('Not found');
        }
        return this.pointer;
      }

      async deleteVault(ownerSub: string): Promise<void> {
        if (this.pointer.ownerSub === ownerSub) {
          this.pointer = { ...this.pointer, ownerSub: 'DELETED' };
        }
      }
    }

    const registry: VaultRegistryPort = new MockVaultRegistry();
    const active = await registry.getActiveVault();
    expect(active.ownerSub).toBe('ANONYMOUS');

    const promoted = await registry.promoteAnonymousVault('user-1');
    expect(promoted.pointer.ownerSub).toBe('user-1');

    const list = await registry.listVaults();
    expect(list).toHaveLength(1);

    const switched = await registry.switchActiveVault('user-1');
    expect(switched.ownerSub).toBe('user-1');

    await registry.deleteVault('user-1');
    const afterDelete = await registry.listVaults();
    expect(afterDelete[0].ownerSub).toBe('DELETED');
  });
});
