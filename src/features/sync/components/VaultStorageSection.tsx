import { useState, useEffect, useContext, useCallback, useSyncExternalStore } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Database, ShieldCheck } from 'lucide-react';
import { Card } from '../../../shared/ui/Card/Card';
import { Button } from '../../../shared/ui/Button/Button';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import {
  ANONYMOUS_OWNER_SUB,
  type VaultRegistryPort,
  type VaultPointer,
} from '../../../domain/vault/models/vault.types';
import { vaultStorageStyles } from './vaultStorage.stylex';

export interface StorageEstimateResult {
  usage?: number;
  quota?: number;
}

export interface VaultTableCounts {
  materials: number;
  documentContents: number;
  localAssets: number;
  highlights: number;
  drawings: number;
  reviewLogs: number;
  syncQueue: number;
}

export interface VaultStorageSectionProps {
  database?: any;
  vaultRegistry?: VaultRegistryPort;
  storageEstimate?: () => Promise<StorageEstimateResult>;
  onClearMediaCache?: () => Promise<void>;
  onPruneUnlinkedVaults?: (currentSub?: string) => Promise<{ prunedCount: number; unlinkedVaults?: string[] }>;
  withOrigin?: (
    db: any,
    origin: 'bypass' | 'local' | 'remote',
    tables: any[],
    fn: (tx: any) => Promise<any>,
  ) => Promise<any>;
  activeOwnerSub?: string;
}

/**
 * Storage & Local Vault Inspector component.
 * Inspects active vault database identity, account linkage, storage quota,
 * table record counts, and provides safeguarded maintenance actions.
 */
export function VaultStorageSection({
  database: propDatabase,
  vaultRegistry: propVaultRegistry,
  storageEstimate: propStorageEstimate,
  onClearMediaCache: propOnClearMediaCache,
  onPruneUnlinkedVaults: propOnPruneUnlinkedVaults,
  withOrigin: propWithOrigin,
  activeOwnerSub: propActiveOwnerSub,
}: VaultStorageSectionProps) {
  const context = useContext(ApplicationContext);
  const db = propDatabase ?? context?.infrastructure?.db;
  const registry = propVaultRegistry ?? (context?.infrastructure as any)?.vaultRegistry;
  const auth = context?.infrastructure?.providers?.auth;

  const session = useSyncExternalStore(
    (notify) => auth?.subscribe(notify) ?? (() => {}),
    () => auth?.getSession() ?? null,
    () => auth?.getSession() ?? null,
  );

  const currentSub = propActiveOwnerSub ?? session?.user?.sub ?? ANONYMOUS_OWNER_SUB;
  const isLinked = currentSub !== ANONYMOUS_OWNER_SUB;

  const [activeVault, setActiveVault] = useState<VaultPointer | null>(null);
  const [counts, setCounts] = useState<VaultTableCounts>({
    materials: 0,
    documentContents: 0,
    localAssets: 0,
    highlights: 0,
    drawings: 0,
    reviewLogs: 0,
    syncQueue: 0,
  });
  const [estimate, setEstimate] = useState<StorageEstimateResult>({ usage: 0, quota: 0 });
  const [isClearing, setIsClearing] = useState(false);
  const [isPruning, setIsPruning] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      if (registry) {
        const pointer = await registry.getActiveVault(currentSub);
        setActiveVault(pointer);
      }

      if (propStorageEstimate) {
        const est = await propStorageEstimate();
        setEstimate(est);
      } else if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
        try {
          const est = await navigator.storage.estimate();
          setEstimate(est);
        } catch {
          setEstimate({ usage: 0, quota: 0 });
        }
      }

      if (db) {
        const [
          materials,
          documentContents,
          localAssets,
          highlights,
          drawings,
          reviewLogs,
          syncQueue,
        ] = await Promise.all([
          db.materials?.count?.().catch(() => 0) ?? 0,
          db.documentContents?.count?.().catch(() => 0) ?? 0,
          db.localAssets?.count?.().catch(() => 0) ?? 0,
          db.highlights?.count?.().catch(() => 0) ?? 0,
          db.drawings?.count?.().catch(() => 0) ?? 0,
          db.reviewLogs?.count?.().catch(() => 0) ?? 0,
          db.syncQueue?.count?.().catch(() => 0) ?? 0,
        ]);

        setCounts({
          materials,
          documentContents,
          localAssets,
          highlights,
          drawings,
          reviewLogs,
          syncQueue,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to inspect local vault storage.');
    }
  }, [db, registry, currentSub, propStorageEstimate]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        let pointer: VaultPointer | null = null;
        if (registry) {
          pointer = await registry.getActiveVault(currentSub);
        }

        let est: StorageEstimateResult = { usage: 0, quota: 0 };
        if (propStorageEstimate) {
          est = await propStorageEstimate();
        } else if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
          try {
            est = await navigator.storage.estimate();
          } catch {
            est = { usage: 0, quota: 0 };
          }
        }

        let nextCounts: VaultTableCounts = {
          materials: 0,
          documentContents: 0,
          localAssets: 0,
          highlights: 0,
          drawings: 0,
          reviewLogs: 0,
          syncQueue: 0,
        };

        if (db) {
          const [
            materials,
            documentContents,
            localAssets,
            highlights,
            drawings,
            reviewLogs,
            syncQueue,
          ] = await Promise.all([
            db.materials?.count?.().catch(() => 0) ?? 0,
            db.documentContents?.count?.().catch(() => 0) ?? 0,
            db.localAssets?.count?.().catch(() => 0) ?? 0,
            db.highlights?.count?.().catch(() => 0) ?? 0,
            db.drawings?.count?.().catch(() => 0) ?? 0,
            db.reviewLogs?.count?.().catch(() => 0) ?? 0,
            db.syncQueue?.count?.().catch(() => 0) ?? 0,
          ]);

          nextCounts = {
            materials,
            documentContents,
            localAssets,
            highlights,
            drawings,
            reviewLogs,
            syncQueue,
          };
        }

        if (!cancelled) {
          if (pointer) setActiveVault(pointer);
          setEstimate(est);
          setCounts(nextCounts);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to inspect local vault storage.');
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [db, registry, currentSub, propStorageEstimate]);

  const handleClearMediaCache = useCallback(async () => {
    setIsClearing(true);
    setFeedback(null);
    setError(null);
    try {
      if (propOnClearMediaCache) {
        await propOnClearMediaCache();
      } else if (context?.useCases?.sync && 'clearMediaCache' in context.useCases.sync) {
        await (context.useCases.sync as any).clearMediaCache.execute();
      } else if (propWithOrigin && db && db.localAssets) {
        await propWithOrigin(db, 'bypass', [db.localAssets], async () => {
          await db.localAssets.clear();
        });
      } else if (db && db.localAssets) {
        await db.localAssets.clear();
      }
      setFeedback('Media cache cleared (0 deletion tombstones emitted).');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear media cache.');
    } finally {
      setIsClearing(false);
    }
  }, [propOnClearMediaCache, context, propWithOrigin, db, loadData]);

  const handlePruneUnlinkedVaults = useCallback(async () => {
    setIsPruning(true);
    setFeedback(null);
    setError(null);
    try {
      let pruned = 0;
      if (propOnPruneUnlinkedVaults) {
        const res = await propOnPruneUnlinkedVaults(currentSub);
        pruned = res.prunedCount;
      } else if (context?.useCases?.sync && 'pruneUnlinkedVaults' in context.useCases.sync) {
        const res = await (context.useCases.sync as any).pruneUnlinkedVaults.execute(currentSub);
        pruned = res.prunedCount;
      } else if (registry) {
        const activeDbName = activeVault?.physicalDbName ?? db?.name ?? '';
        if (typeof registry.pruneStaleVaults === 'function') {
          const res = await registry.pruneStaleVaults(activeDbName, currentSub, 0);
          pruned = res.deleted.length + res.quarantined.length;
        } else {
          const allVaults = await registry.listVaults();
          const now = Date.now();
          for (const v of allVaults) {
            if (v.physicalDbName === activeDbName) continue;
            if (currentSub && v.ownerSub === currentSub && currentSub !== ANONYMOUS_OWNER_SUB) continue;
            if (v.pendingDeleteAt && v.pendingDeleteAt <= now) {
              await registry.deleteVault(v.ownerSub);
              pruned++;
            } else if (typeof registry.quarantineVault === 'function') {
              await registry.quarantineVault(v.ownerSub, now + 86400000);
              pruned++;
            } else {
              await registry.deleteVault(v.ownerSub);
              pruned++;
            }
          }
        }
      }
      setFeedback(
        pruned > 0
          ? `Pruned ${pruned} unlinked vault(s).`
          : 'No unlinked vaults found to prune.'
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prune unlinked vaults.');
    } finally {
      setIsPruning(false);
    }
  }, [propOnPruneUnlinkedVaults, context, registry, activeVault, db, currentSub, loadData]);

  const activeDbName = activeVault?.physicalDbName ?? db?.name ?? 'Unknown';
  const usageMB = ((estimate.usage ?? 0) / (1024 * 1024)).toFixed(1);
  const quotaMB = ((estimate.quota ?? 0) / (1024 * 1024)).toFixed(0);
  const percentUsed = estimate.quota && estimate.quota > 0
    ? Math.min(100, Math.round(((estimate.usage ?? 0) / estimate.quota) * 100))
    : 0;

  return (
    <section {...stylex.props(vaultStorageStyles.section)} aria-labelledby="settings-vault-heading">
      <h2 {...stylex.props(vaultStorageStyles.heading)} id="settings-vault-heading">
        Local Vault & Storage
      </h2>
      <p {...stylex.props(vaultStorageStyles.description)}>
        Inspect active storage quota, isolated vault database records, and perform zero-tombstone maintenance.
      </p>

      <Card>
        <div {...stylex.props(vaultStorageStyles.cardContent)}>
          {feedback && (
            <div
              {...stylex.props(vaultStorageStyles.statusMessage)}
              role="status"
              data-testid="status-message"
            >
              {feedback}
            </div>
          )}
          {error && (
            <div
              {...stylex.props(vaultStorageStyles.errorMessage)}
              role="alert"
              data-testid="error-message"
            >
              {error}
            </div>
          )}

          <div {...stylex.props(vaultStorageStyles.identityRow)}>
            <div {...stylex.props(vaultStorageStyles.vaultMeta)}>
              <span {...stylex.props(vaultStorageStyles.vaultIdLabel)}>Active Vault Database</span>
              <span
                {...stylex.props(vaultStorageStyles.vaultIdValue)}
                data-testid="active-vault-name"
              >
                {activeDbName}
              </span>
            </div>

            <span
              {...stylex.props(
                vaultStorageStyles.badge,
                isLinked ? vaultStorageStyles.badgeLinked : vaultStorageStyles.badgeAnonymous,
              )}
              data-testid="account-linkage"
            >
              {isLinked ? (
                <>
                  <ShieldCheck size={14} />
                  <span>Linked ({session?.user?.email ?? currentSub})</span>
                </>
              ) : (
                <>
                  <Database size={14} />
                  <span>Local (Anonymous)</span>
                </>
              )}
            </span>
          </div>

          <div {...stylex.props(vaultStorageStyles.gaugeContainer)}>
            <div {...stylex.props(vaultStorageStyles.gaugeHeader)}>
              <span {...stylex.props(vaultStorageStyles.gaugeLabel)}>Storage Footprint</span>
              <span
                {...stylex.props(vaultStorageStyles.gaugeValue)}
                data-testid="storage-gauge"
                data-usage-mb={usageMB}
                data-quota-mb={quotaMB}
              >
                {usageMB} MB of {quotaMB} MB used ({percentUsed}%)
              </span>
            </div>
            <div {...stylex.props(vaultStorageStyles.gaugeTrack)}>
              <div
                {...stylex.props(
                  vaultStorageStyles.gaugeBar,
                  percentUsed > 80 && vaultStorageStyles.gaugeBarWarning,
                )}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
          </div>

          <div {...stylex.props(vaultStorageStyles.countsSection)}>
            <h3 {...stylex.props(vaultStorageStyles.countsHeading)}>Record Breakdown</h3>
            <div {...stylex.props(vaultStorageStyles.tableCountsGrid)}>
              <div {...stylex.props(vaultStorageStyles.tableCountCard)}>
                <span {...stylex.props(vaultStorageStyles.tableCountLabel)}>Materials</span>
                <span {...stylex.props(vaultStorageStyles.tableCountNumber)} data-testid="count-materials">
                  {counts.materials}
                </span>
              </div>
              <div {...stylex.props(vaultStorageStyles.tableCountCard)}>
                <span {...stylex.props(vaultStorageStyles.tableCountLabel)}>Document Contents</span>
                <span {...stylex.props(vaultStorageStyles.tableCountNumber)} data-testid="count-documentContents">
                  {counts.documentContents}
                </span>
              </div>
              <div {...stylex.props(vaultStorageStyles.tableCountCard)}>
                <span {...stylex.props(vaultStorageStyles.tableCountLabel)}>Media Assets</span>
                <span {...stylex.props(vaultStorageStyles.tableCountNumber)} data-testid="count-localAssets">
                  {counts.localAssets}
                </span>
              </div>
              <div {...stylex.props(vaultStorageStyles.tableCountCard)}>
                <span {...stylex.props(vaultStorageStyles.tableCountLabel)}>Highlights</span>
                <span {...stylex.props(vaultStorageStyles.tableCountNumber)} data-testid="count-highlights">
                  {counts.highlights}
                </span>
              </div>
              <div {...stylex.props(vaultStorageStyles.tableCountCard)}>
                <span {...stylex.props(vaultStorageStyles.tableCountLabel)}>Drawings</span>
                <span {...stylex.props(vaultStorageStyles.tableCountNumber)} data-testid="count-drawings">
                  {counts.drawings}
                </span>
              </div>
              <div {...stylex.props(vaultStorageStyles.tableCountCard)}>
                <span {...stylex.props(vaultStorageStyles.tableCountLabel)}>Review Logs</span>
                <span {...stylex.props(vaultStorageStyles.tableCountNumber)} data-testid="count-reviewLogs">
                  {counts.reviewLogs}
                </span>
              </div>
              <div {...stylex.props(vaultStorageStyles.tableCountCard)}>
                <span {...stylex.props(vaultStorageStyles.tableCountLabel)}>Sync Queue</span>
                <span {...stylex.props(vaultStorageStyles.tableCountNumber)} data-testid="count-syncQueue">
                  {counts.syncQueue}
                </span>
              </div>
            </div>
          </div>

          <div {...stylex.props(vaultStorageStyles.actionsRow)}>
            <Button
              label="Clear Media Cache"
              variant="secondary"
              isLoading={isClearing}
              isDisabled={isClearing}
              onClick={handleClearMediaCache}
              data-testid="clear-media-cache-button"
            >
              Clear Media Cache
            </Button>
            <Button
              label="Prune Unlinked Vaults"
              variant="secondary"
              isLoading={isPruning}
              isDisabled={isPruning}
              onClick={handlePruneUnlinkedVaults}
              data-testid="prune-unlinked-vaults-button"
            >
              Prune Unlinked Vaults
            </Button>
          </div>
        </div>
      </Card>
    </section>
  );
}

export default VaultStorageSection;
