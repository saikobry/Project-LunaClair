import type { MergePlugin, ConflictDraft, Hlc } from './MergePlugin';
import { compareHlc, stamped, toWire, base } from './MergePlugin';

export const ANCESTOR_CAP = 32;

/**
 * Versioned CAS. Every write carries the revision it was based on. Fast-forwards apply silently;
 * concurrent edits converge on the HIGHER revision as the main row and keep the other as a draft with a
 * deterministic id, so every replica ends with the same row AND the same drafts. Edit beats delete.
 */
export const CasDraftPlugin: MergePlugin = {
  id: 'casDraft',
  capture(change, ctx) {
    const hlc = ctx.clock.tick();
    if (change.kind === 'delete') {
      return {
        op: { ...base(ctx, change.key, hlc), op: 'del', baseRevision: change.prev._rev },
        stamp: {},
        tombstone: true,
      };
    }
    const prev = change.kind === 'update' ? change.prev : undefined;
    const anc = prev?._rev ? [...(prev._anc ?? []), prev._rev].slice(-ANCESTOR_CAP) : [];
    return {
      op: {
        ...base(ctx, change.key, hlc),
        op: 'put',
        value: ctx.wire(change.next) as never,
        baseRevision: prev?._rev,
      },
      stamp: { _hlc: hlc, _rev: hlc, _anc: anc },
    };
  },
  apply(state, op) {
    const local = state.row;
    if (op.op === 'del') {
      if (!local) {
        return state.tombstoneHlc && compareHlc(op.hlc, state.tombstoneHlc) <= 0
          ? { kind: 'noop' }
          : { kind: 'del', tombstoneHlc: op.hlc };
      }
      return op.baseRevision === local._rev
        ? { kind: 'del', tombstoneHlc: op.hlc }
        : { kind: 'noop' }; // edit beats delete
    }

    const stampedIncoming = (anc: Hlc[]) => stamped(op.value, { _hlc: op.hlc, _rev: op.hlc, _anc: anc });

    if (!local) {
      if (state.tombstoneHlc && compareHlc(op.hlc, state.tombstoneHlc) < 0) {
        return { kind: 'noop' };
      }
      return { kind: 'put', row: stampedIncoming(op.baseRevision ? [op.baseRevision] : []) };
    }

    if (op.hlc === local._rev || (local._anc ?? []).includes(op.hlc)) {
      return { kind: 'noop' }; // already have it / older
    }

    if (op.baseRevision === local._rev) {
      return {
        kind: 'put',
        row: stampedIncoming([...(local._anc ?? []), local._rev as Hlc].slice(-ANCESTOR_CAP)),
      };
    }

    // Concurrent: deterministic winner, loser kept as a draft with a deterministic id
    const localRev = local._rev ?? local._hlc ?? '';
    const draftOf = (rev: Hlc, value: unknown): ConflictDraft => ({
      id: `${op.entity}:${op.key}@${rev}`,
      entity: op.entity,
      key: op.key,
      value,
    });

    if (compareHlc(op.hlc, localRev) > 0) {
      return {
        kind: 'put',
        row: stampedIncoming([...(local._anc ?? []), localRev].slice(-ANCESTOR_CAP)),
        drafts: [draftOf(localRev, toWire(local))],
      };
    }

    return {
      kind: 'put',
      row: local,
      drafts: [draftOf(op.hlc, op.value)],
    }; // local wins; row unchanged, remote kept as draft
  },
};
