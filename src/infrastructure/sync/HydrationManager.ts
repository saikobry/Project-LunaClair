import { getActiveVaultDatabase, type LunaClairDatabase } from '../database/schema/LunaClairDatabase';
import type { SyncPointerPayload } from '../../domain/sync/models/SyncPointer';
import type { PendingHydration } from '../../domain/sync/models/sync.types';
import { ShareHttpError } from '../api/transports/WorkerShareTransport';

export interface ShareCloner {
  execute(params: { shareId: string }, signal?: AbortSignal): Promise<unknown>;
}

export interface ProcessQueueResult {
  processed: number;
  succeeded: number;
  delisted: number;
  failed: number;
}

export interface HydrationManagerOptions {
  db?: LunaClairDatabase;
  cloneUseCase?: ShareCloner;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
}

/**
 * Manages background resolution of pending hydrations queue in Dexie.
 */
export class HydrationManager {
  private readonly db: LunaClairDatabase;
  private cloneUseCase?: ShareCloner;
  private readonly initialBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly delistedShareIds: Set<string>;
  private isProcessing: boolean;

  constructor(options: HydrationManagerOptions = {}) {
    this.db = options.db ?? getActiveVaultDatabase();
    this.cloneUseCase = options.cloneUseCase;
    this.initialBackoffMs = options.initialBackoffMs ?? 1000;
    this.maxBackoffMs = options.maxBackoffMs ?? 60000;
    this.delistedShareIds = new Set<string>();
    this.isProcessing = false;
  }

  setCloneUseCase(cloneUseCase: ShareCloner): void {
    this.cloneUseCase = cloneUseCase;
  }

  isDelisted(originShareId: string): boolean {
    return this.delistedShareIds.has(originShareId);
  }

  async enqueuePointer(pointer: SyncPointerPayload): Promise<void> {
    if (this.delistedShareIds.has(pointer.originShareId)) {
      return;
    }

    const existing = await this.db.pendingHydrations.get(pointer.originShareId);
    if (!existing) {
      const entry: PendingHydration = {
        originShareId: pointer.originShareId,
        attempts: 0,
        nextAttemptAt: 0,
        title: pointer.title,
        publishedAt: pointer.publishedAt,
        schemaVersion: pointer.schemaVersion,
      };
      await this.db.pendingHydrations.put(entry);
    }
  }

  notify(): void {
    if (!this.isProcessing && this.cloneUseCase) {
      void this.processQueue().catch((err: unknown) => {
        console.warn('[HydrationManager] Background processQueue failed:', err);
      });
    }
  }

  async processQueue(signal?: AbortSignal): Promise<ProcessQueueResult> {
    if (this.isProcessing) {
      return { processed: 0, succeeded: 0, delisted: 0, failed: 0 };
    }
    if (!this.cloneUseCase) {
      return { processed: 0, succeeded: 0, delisted: 0, failed: 0 };
    }

    this.isProcessing = true;
    const result: ProcessQueueResult = {
      processed: 0,
      succeeded: 0,
      delisted: 0,
      failed: 0,
    };

    try {
      const now = Date.now();
      const allPending = await this.db.pendingHydrations.toArray();
      const eligible = allPending.filter((item) => (item.nextAttemptAt ?? 0) <= now);

      for (const item of eligible) {
        if (signal?.aborted) {
          break;
        }

        result.processed += 1;

        try {
          await this.cloneUseCase.execute({ shareId: item.originShareId }, signal);
          await this.db.pendingHydrations.delete(item.originShareId);
          result.succeeded += 1;
        } catch (err: unknown) {
          if (signal?.aborted) {
            break;
          }

          if (this.isPermanentlyUnavailable(err)) {
            this.delistedShareIds.add(item.originShareId);
            await this.db.pendingHydrations.delete(item.originShareId);
            result.delisted += 1;
          } else {
            const attempts = (item.attempts ?? 0) + 1;
            const delayMs = Math.min(
              this.initialBackoffMs * Math.pow(2, attempts - 1),
              this.maxBackoffMs
            );
            await this.db.pendingHydrations.put({
              ...item,
              attempts,
              nextAttemptAt: Date.now() + delayMs,
              lastError: err instanceof Error ? err.message : String(err),
            });
            result.failed += 1;
          }
        }
      }

      return result;
    } finally {
      this.isProcessing = false;
    }
  }

  private isPermanentlyUnavailable(err: unknown): boolean {
    if (!err) return false;
    if (err instanceof ShareHttpError) {
      return err.status === 404 || err.status === 410;
    }
    const status = (err as { status?: number; statusCode?: number }).status ??
      (err as { status?: number; statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      return true;
    }
    const message = err instanceof Error ? err.message : String(err);
    return (
      /\b(404|410)\b/.test(message) ||
      message.toLowerCase().includes('not found') ||
      message.toLowerCase().includes('delisted') ||
      message.toLowerCase().includes('gone')
    );
  }
}

export const hydrationManager = new HydrationManager();
