import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { VaultStorageSection } from '../VaultStorageSection';
import { LunaClairDatabase } from '../../../../infrastructure/database/schema/LunaClairDatabase';
import {
  VaultRegistry,
  RegistryDatabase,
} from '../../../../infrastructure/database/registry/VaultRegistry';
import { withOrigin } from '../../../../infrastructure/database/sync/transactionContext';
import { installSyncHooks } from '../../../../infrastructure/database/sync/syncHooks';
import { createClock } from '../../../../domain/sync/reconcilers/plugins/MergePlugin';
import { ANONYMOUS_OWNER_SUB } from '../../../../domain/vault/models/vault.types';

describe('VaultStorageSection', () => {
  let testDbName: string;
  let testRegistryDbName: string;
  let db: LunaClairDatabase;
  let registryDb: RegistryDatabase;
  let registry: VaultRegistry;

  beforeEach(async () => {
    testDbName = `lc_vault_test_${crypto.randomUUID().replace(/-/g, '')}`;
    testRegistryDbName = `reg_test_${crypto.randomUUID().replace(/-/g, '')}`;

    db = new LunaClairDatabase(testDbName);
    await db.open();

    const clock = createClock('client-test');
    installSyncHooks(db, clock, () => true);

    registryDb = new RegistryDatabase(testRegistryDbName);
    await registryDb.open();
    registry = new VaultRegistry(registryDb);
  });

  afterEach(async () => {
    db.close();
    await Dexie.delete(testDbName);
    registryDb.close();
    await Dexie.delete(testRegistryDbName);
  });

  it('inspects active vault identity, account linkage, and storage footprint gauge', async () => {
    await registryDb.vaults.add({
      ownerSub: ANONYMOUS_OWNER_SUB,
      physicalDbName: testDbName,
      createdAt: 1000,
      lastActiveAt: 1000,
    });

    const mockEstimate = vi.fn().mockResolvedValue({
      usage: 25 * 1024 * 1024, // 25 MB
      quota: 100 * 1024 * 1024, // 100 MB
    });

    render(
      <VaultStorageSection
        database={db}
        vaultRegistry={registry}
        storageEstimate={mockEstimate}
        activeOwnerSub={ANONYMOUS_OWNER_SUB}
        withOrigin={withOrigin}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('active-vault-name').textContent).toBe(testDbName);
      expect(screen.getByTestId('account-linkage').textContent).toContain('Local (Anonymous)');
      const gauge = screen.getByTestId('storage-gauge');
      expect(gauge.textContent).toContain('25.0 MB');
      expect(gauge.textContent).toContain('100 MB');
      expect(gauge.textContent).toContain('25%');
    });
  });

  it('displays authenticated account linkage when user is linked', async () => {
    const userSub = 'user-google-12345';
    await registryDb.vaults.add({
      ownerSub: userSub,
      physicalDbName: testDbName,
      createdAt: 1000,
      lastActiveAt: 1000,
    });

    render(
      <VaultStorageSection
        database={db}
        vaultRegistry={registry}
        activeOwnerSub={userSub}
        withOrigin={withOrigin}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('active-vault-name').textContent).toBe(testDbName);
      expect(screen.getByTestId('account-linkage').textContent).toContain(`Linked (${userSub})`);
    });
  });

  it('displays accurate record breakdown counts across tables', async () => {
    await registryDb.vaults.add({
      ownerSub: ANONYMOUS_OWNER_SUB,
      physicalDbName: testDbName,
      createdAt: 1000,
      lastActiveAt: 1000,
    });

    // Populate data across tables
    await withOrigin(db, 'bypass', [db.materials, db.documentContents, db.localAssets, db.highlights, db.drawings, db.reviewLogs, db.syncQueue], async () => {
      await db.materials.add({
        id: 'mat-1',
        title: 'Material 1',
        createdAt: '2026-10-17T00:00:00.000Z',
        updatedAt: '2026-10-17T00:00:00.000Z',
      } as any);

      await db.documentContents.add({
        documentId: 'doc-1',
        markdown: '# Title',
        updatedAt: '2026-10-17T00:00:00.000Z',
      } as any);

      await db.localAssets.bulkAdd([
        { assetId: 'ast-1', materialId: 'mat-1', blob: new Blob(['a']), mimeType: 'image/png', filename: 'ast-1.png', importedAt: '2026-10-17T00:00:00.000Z' },
        { assetId: 'ast-2', materialId: 'mat-1', blob: new Blob(['b']), mimeType: 'image/png', filename: 'ast-2.png', importedAt: '2026-10-17T00:00:00.000Z' },
      ]);

      await db.highlights.add({
        id: 'hl-1',
        documentId: 'doc-1',
        text: 'Sample',
        color: 'yellow',
        start: 0,
        end: 6,
        createdAt: '2026-10-17T00:00:00.000Z',
      });

      await db.drawings.add({
        id: 'drw-1',
        documentId: 'doc-1',
        color: '#ff0000',
        thickness: 2,
        points: [{ x: 0, y: 0 }],
        createdAt: '2026-10-17T00:00:00.000Z',
      });

      await db.reviewLogs.add({
        id: 'rl-1',
        cardId: 'card-1',
        rating: 'good',
        reviewedAt: '2026-10-17T00:00:00.000Z',
        scheduledDays: 1,
        elapsedDays: 0,
        hlc: '1-test',
      } as any);

      await db.syncQueue.add({
        id: 'op-1',
        entity: 'materials',
        key: 'mat-1',
        kind: 'create',
        hlc: '1-test',
        clientTimestamp: Date.now(),
        status: 'pending',
      } as any);
    });

    render(
      <VaultStorageSection
        database={db}
        vaultRegistry={registry}
        withOrigin={withOrigin}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('count-materials').textContent).toBe('1');
      expect(screen.getByTestId('count-documentContents').textContent).toBe('1');
      expect(screen.getByTestId('count-localAssets').textContent).toBe('2');
      expect(screen.getByTestId('count-highlights').textContent).toBe('1');
      expect(screen.getByTestId('count-drawings').textContent).toBe('1');
      expect(screen.getByTestId('count-reviewLogs').textContent).toBe('1');
      expect(screen.getByTestId('count-syncQueue').textContent).toBe('1');
    });
  });

  it('clears media cache under bypass origin emitting zero deletion tombstones', async () => {
    await registryDb.vaults.add({
      ownerSub: ANONYMOUS_OWNER_SUB,
      physicalDbName: testDbName,
      createdAt: 1000,
      lastActiveAt: 1000,
    });

    // Populate localAssets
    await withOrigin(db, 'bypass', [db.localAssets], async () => {
      await db.localAssets.bulkAdd([
        { assetId: 'asset-1', materialId: 'm1', blob: new Blob(['x']), mimeType: 'image/jpeg', filename: 'asset-1.jpg', importedAt: '2026-10-17T00:00:00.000Z' },
        { assetId: 'asset-2', materialId: 'm1', blob: new Blob(['y']), mimeType: 'image/jpeg', filename: 'asset-2.jpg', importedAt: '2026-10-17T00:00:00.000Z' },
      ]);
    });

    expect(await db.localAssets.count()).toBe(2);
    expect(await db.tombstones.count()).toBe(0);
    expect(await db.syncQueue.count()).toBe(0);

    render(
      <VaultStorageSection
        database={db}
        vaultRegistry={registry}
        withOrigin={withOrigin}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('count-localAssets').textContent).toBe('2');
    });

    const clearButton = screen.getByTestId('clear-media-cache-button');
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(screen.getByTestId('count-localAssets').textContent).toBe('0');
    });

    // Assert database state: assets cleared, but ZERO tombstones or syncQueue entries emitted
    expect(await db.localAssets.count()).toBe(0);
    expect(await db.tombstones.count()).toBe(0);
    expect(await db.syncQueue.count()).toBe(0);
    expect(screen.getByTestId('status-message').textContent).toContain('0 deletion tombstones emitted');
  });

  it('prunes unlinked vaults while safeguarding active database and current user', async () => {
    const activeSub = 'active-account';
    const staleSub = 'stale-account';
    const orphanSub = 'orphan-account';

    await registryDb.vaults.bulkAdd([
      {
        ownerSub: activeSub,
        physicalDbName: testDbName,
        createdAt: 1000,
        lastActiveAt: 2000,
      },
      {
        ownerSub: staleSub,
        physicalDbName: 'lc_vault_stale_to_delete',
        createdAt: 500,
        lastActiveAt: 500,
        pendingDeleteAt: Date.now() - 5000, // expired quarantine
      },
      {
        ownerSub: orphanSub,
        physicalDbName: 'lc_vault_orphan_to_quarantine',
        createdAt: 600,
        lastActiveAt: 600,
      },
    ]);

    render(
      <VaultStorageSection
        database={db}
        vaultRegistry={registry}
        activeOwnerSub={activeSub}
        withOrigin={withOrigin}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('active-vault-name').textContent).toBe(testDbName);
    });

    const pruneButton = screen.getByTestId('prune-unlinked-vaults-button');
    fireEvent.click(pruneButton);

    await waitFor(() => {
      expect(screen.getByTestId('status-message').textContent).toContain('Pruned');
    });

    // Safeguards check:
    // 1. Active vault is untouched
    const activeVault = await registryDb.vaults.get(activeSub);
    expect(activeVault).toBeDefined();
    expect(activeVault?.physicalDbName).toBe(testDbName);

    // 2. Stale expired vault is deleted
    const staleVault = await registryDb.vaults.get(staleSub);
    expect(staleVault).toBeUndefined();
  });
});
