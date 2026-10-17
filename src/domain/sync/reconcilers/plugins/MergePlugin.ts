import type { MergeStrategyId } from '../../policy/SyncPolicy';
import { LwwPlugin } from './LwwPlugin';
import { AppendOnlyPlugin } from './AppendOnlyPlugin';
import { CasDraftPlugin } from './CasDraftPlugin';

export type Hlc = string;

/**
 * Pure HLC lexicographical comparator: returns -1 if a < b, 1 if a > b, 0 if equal.
 */
export const compareHlc = (a: Hlc, b: Hlc): -1 | 0 | 1 => (a < b ? -1 : a > b ? 1 : 0);

export interface HlcClock {
  readonly deviceId: string;
  tick(): Hlc;
  receive(remote: Hlc): Hlc;
}

export function createTabNonce(): string {
  return Math.random().toString(36).slice(2, 6);
}

/**
 * Creates an in-memory Hybrid Logical Clock generator.
 * Timestamp format: `${wallMs(13)}_${counter(4)}_${deviceId}` (strictly lexicographically ordered).
 * If deviceId does not contain a dot, appends a connection nonce to isolate concurrent tabs.
 */
export function createClock(deviceId: string, now: () => number = Date.now): HlcClock {
  const resolvedDeviceId = deviceId.includes('.') ? deviceId : `${deviceId}.${createTabNonce()}`;
  let wall = 0;
  let counter = 0;

  const fmt = () => `${String(wall).padStart(13, '0')}_${String(counter).padStart(4, '0')}_${resolvedDeviceId}`;

  const advance = (remoteWall: number, remoteCounter: number): Hlc => {
    const pt = now();
    const nextWall = Math.max(wall, remoteWall, pt);
    counter =
      nextWall === wall && nextWall === remoteWall
        ? Math.max(counter, remoteCounter) + 1
        : nextWall === wall
        ? counter + 1
        : nextWall === remoteWall
        ? remoteCounter + 1
        : 0;
    wall = nextWall;
    return fmt();
  };

  return {
    deviceId: resolvedDeviceId,
    tick: () => advance(0, 0),
    receive: (remote: Hlc) => {
      const [w, c] = remote.split('_');
      return advance(Number(w), Number(c));
    },
  };
}

export const createTabClock = createClock;

/** Fields the sync layer stamps onto rows of synced tables. */
export interface SyncStamp {
  _hlc?: Hlc;
  _rev?: Hlc;
  _anc?: Hlc[];
}

export interface JournalOp<T = unknown> {
  entity: string;
  key: string;
  hlc: Hlc;
  deviceId: string;
  schemaVersion: number;
  op: 'put' | 'del';
  value?: T;
  baseRevision?: Hlc;
}

export interface ConflictDraft {
  id: string;
  entity: string;
  key: string;
  value: unknown;
}

export type LocalChange<T> =
  | { kind: 'create'; key: string; next: T }
  | { kind: 'update'; key: string; prev: T & SyncStamp; next: T }
  | { kind: 'delete'; key: string; prev: T & SyncStamp };

export interface CaptureResult<T> {
  op: JournalOp<T>;
  stamp: SyncStamp;
  tombstone?: boolean;
}

export interface CaptureCtx {
  clock: HlcClock;
  entity: string;
  schemaVersion: number;
  wire(row: object): object;
}

export interface LocalState<T> {
  row?: T & SyncStamp;
  tombstoneHlc?: Hlc;
}

export type MergeDecision<T> =
  | { kind: 'noop' }
  | { kind: 'put'; row: T & SyncStamp; drafts?: ConflictDraft[] }
  | { kind: 'del'; tombstoneHlc: Hlc };

/**
 * Pure: no DB, no clock, no I/O.
 * `capture` executes synchronously inside Dexie hooks.
 * `apply` executes during inbound reconciliation.
 */
export interface MergePlugin {
  readonly id: MergeStrategyId;
  capture<T extends object>(change: LocalChange<T>, ctx: CaptureCtx): CaptureResult<T> | null;
  apply<T extends object>(state: LocalState<T>, op: JournalOp<T>): MergeDecision<T>;
}

export { META_KEYS, toWire } from '../../policy/SyncPolicy';

export const stamped = <T extends object>(value: T | undefined, stamp: SyncStamp): T & SyncStamp =>
  ({ ...(value as object), ...stamp } as T & SyncStamp);

export const newestOf = (a?: Hlc, b?: Hlc): Hlc | undefined =>
  a && b ? (compareHlc(a, b) >= 0 ? a : b) : a ?? b;

export const base = (ctx: CaptureCtx, key: string, hlc: Hlc) => ({
  entity: ctx.entity,
  key,
  hlc,
  deviceId: ctx.clock.deviceId,
  schemaVersion: ctx.schemaVersion,
});

export const PLUGINS: Record<MergeStrategyId, MergePlugin> = {
  lww: LwwPlugin,
  appendOnly: AppendOnlyPlugin,
  casDraft: CasDraftPlugin,
};
