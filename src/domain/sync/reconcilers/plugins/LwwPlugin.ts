import type { MergePlugin } from './MergePlugin';
import { compareHlc, newestOf, stamped, base } from './MergePlugin';

/**
 * Pure Last-Write-Wins (LWW) merge plugin using Hybrid Logical Clocks.
 * Deterministic total ordering based on HLC timestamps.
 */
export const LwwPlugin: MergePlugin = {
  id: 'lww',
  capture(change, ctx) {
    const hlc = ctx.clock.tick();
    if (change.kind === 'delete') {
      return {
        op: { ...base(ctx, change.key, hlc), op: 'del' },
        stamp: {},
        tombstone: true,
      };
    }
    return {
      op: { ...base(ctx, change.key, hlc), op: 'put', value: ctx.wire(change.next) as never },
      stamp: { _hlc: hlc },
    };
  },
  apply(state, op) {
    const known = newestOf(state.row?._hlc, state.tombstoneHlc);
    if (known && compareHlc(op.hlc, known) <= 0) {
      return { kind: 'noop' };
    }
    if (op.op === 'del') {
      return { kind: 'del', tombstoneHlc: op.hlc };
    }
    return { kind: 'put', row: stamped(op.value, { _hlc: op.hlc }) };
  },
};
