import type { MergePlugin } from './MergePlugin';
import { stamped, base } from './MergePlugin';

export class AppendOnlyViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppendOnlyViolation';
  }
}

/**
 * Pure Append-Only event stream merge plugin.
 * Throws AppendOnlyViolation if an update or delete is attempted.
 * Inbound applies are idempotent by primary key.
 */
export const AppendOnlyPlugin: MergePlugin = {
  id: 'appendOnly',
  capture(change, ctx) {
    if (change.kind !== 'create') {
      throw new AppendOnlyViolation(`${ctx.entity} is append-only (${change.kind} rejected)`);
    }
    const hlc = ctx.clock.tick();
    return {
      op: { ...base(ctx, change.key, hlc), op: 'put', value: ctx.wire(change.next) as never },
      stamp: { _hlc: hlc },
    };
  },
  apply(state, op) {
    if (state.row || op.op !== 'put') {
      return { kind: 'noop' }; // idempotent by key
    }
    return { kind: 'put', row: stamped(op.value, { _hlc: op.hlc }) };
  },
};
