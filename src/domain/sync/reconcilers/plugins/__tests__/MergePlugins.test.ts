import { describe, it, expect } from 'vitest';
import {
  type MergePlugin,
  PLUGINS,
  compareHlc,
  createClock,
  toWire,
  stamped,
  newestOf,
  type CaptureCtx,
  type LocalChange,
} from '../MergePlugin';
import { LwwPlugin } from '../LwwPlugin';
import { AppendOnlyPlugin, AppendOnlyViolation } from '../AppendOnlyPlugin';
import { CasDraftPlugin, ANCESTOR_CAP } from '../CasDraftPlugin';

describe('Merge Plugins (LWW, AppendOnly, CasDraft)', () => {
  const dummyWire = (r: object) => toWire(r);

  describe('Primitives & Utilities', () => {
    it('compareHlc orders lexicographically and returns -1, 0, 1', () => {
      expect(compareHlc('100_0000_A', '200_0000_A')).toBe(-1);
      expect(compareHlc('200_0000_A', '100_0000_A')).toBe(1);
      expect(compareHlc('100_0000_A', '100_0000_A')).toBe(0);
      expect(compareHlc('100_0000_A', '100_0000_B')).toBe(-1);
      expect(compareHlc('100_0001_A', '100_0000_A')).toBe(1);
    });

    it('createClock generates monotonic timestamps and advances on remote stamps', () => {
      let t = 1_000;
      const clock = createClock('dev1.fixed', () => t);

      const hlc1 = clock.tick();
      expect(hlc1).toBe('0000000001000_0000_dev1.fixed');

      const hlc2 = clock.tick();
      expect(hlc2).toBe('0000000001000_0001_dev1.fixed');
      expect(compareHlc(hlc1, hlc2)).toBe(-1);

      // Advance clock with a remote stamp that is ahead
      const remoteHlc = '0000000002000_0005_dev2';
      const folded = clock.receive(remoteHlc);
      expect(compareHlc(folded, remoteHlc)).toBeGreaterThanOrEqual(0);

      const hlc3 = clock.tick();
      expect(compareHlc(hlc3, remoteHlc)).toBe(1);
    });

    it('ensures distinct connection nonce and deterministic HLC ordering across tabs for the same device', () => {
      const clockTabA = createClock('devA', () => 10_000);
      const clockTabB = createClock('devA', () => 10_000);

      expect(clockTabA.deviceId).toMatch(/^devA\.[a-z0-9]+$/);
      expect(clockTabB.deviceId).toMatch(/^devA\.[a-z0-9]+$/);
      expect(clockTabA.deviceId).not.toBe(clockTabB.deviceId);

      const stampA = clockTabA.tick();
      const stampB = clockTabB.tick();

      expect(stampA).not.toBe(stampB);
      expect(compareHlc(stampA, stampB)).not.toBe(0);

      const advanceResult = clockTabA.receive(stampB);
      expect(compareHlc(advanceResult, stampB)).toBeGreaterThanOrEqual(0);

      const nextStampA = clockTabA.tick();
      expect(compareHlc(nextStampA, stampB)).toBe(1);
    });

    it('toWire strips internal sync metadata and excluded fields', () => {
      const row = {
        id: '123',
        text: 'Hello world',
        _hlc: '001_0_A',
        _rev: '001_0_A',
        _anc: ['000_0_A'],
        localCache: 'ephemeral',
      };

      const wire = toWire(row, ['localCache']);
      expect(wire).toEqual({ id: '123', text: 'Hello world' });
      expect((wire as any)._hlc).toBeUndefined();
      expect((wire as any)._rev).toBeUndefined();
      expect((wire as any)._anc).toBeUndefined();
      expect((wire as any).localCache).toBeUndefined();
    });

    it('stamped attaches sync stamps to an object without mutating original', () => {
      const obj = { id: 'x', title: 'test' };
      const res = stamped(obj, { _hlc: 'h1', _rev: 'r1' });
      expect(res).toEqual({ id: 'x', title: 'test', _hlc: 'h1', _rev: 'r1' });
      expect((obj as any)._hlc).toBeUndefined();
    });

    it('newestOf returns the lexicographically latest HLC', () => {
      expect(newestOf('100_0000_A', '200_0000_B')).toBe('200_0000_B');
      expect(newestOf('300_0000_A', '200_0000_B')).toBe('300_0000_A');
      expect(newestOf('100_0000_A', undefined)).toBe('100_0000_A');
      expect(newestOf(undefined, '200_0000_A')).toBe('200_0000_A');
      expect(newestOf(undefined, undefined)).toBeUndefined();
    });
  });

  describe('LwwPlugin', () => {
    const makeCtx = (deviceId = 'devA'): CaptureCtx => ({
      clock: createClock(deviceId, () => 10_000),
      entity: 'highlight',
      schemaVersion: 1,
      wire: dummyWire,
    });

    it('captures create, update, and delete correctly', () => {
      const ctx = makeCtx();

      // Create
      const createChange: LocalChange<{ id: string; color: string }> = {
        kind: 'create',
        key: 'h1',
        next: { id: 'h1', color: 'yellow' },
      };
      const capCreate = LwwPlugin.capture(createChange, ctx);
      expect(capCreate).not.toBeNull();
      expect(capCreate?.op.op).toBe('put');
      expect(capCreate?.op.key).toBe('h1');
      expect(capCreate?.op.value).toEqual({ id: 'h1', color: 'yellow' });
      expect(capCreate?.stamp._hlc).toBeDefined();

      // Update
      const updateChange: LocalChange<{ id: string; color: string }> = {
        kind: 'update',
        key: 'h1',
        prev: { id: 'h1', color: 'yellow', _hlc: capCreate!.stamp._hlc },
        next: { id: 'h1', color: 'green' },
      };
      const capUpdate = LwwPlugin.capture(updateChange, ctx);
      expect(capUpdate?.op.op).toBe('put');
      expect(capUpdate?.op.value).toEqual({ id: 'h1', color: 'green' });
      expect(compareHlc(capUpdate!.stamp._hlc!, capCreate!.stamp._hlc!)).toBe(1);

      // Delete
      const deleteChange: LocalChange<{ id: string; color: string }> = {
        kind: 'delete',
        key: 'h1',
        prev: { id: 'h1', color: 'green', _hlc: capUpdate!.stamp._hlc },
      };
      const capDelete = LwwPlugin.capture(deleteChange, ctx);
      expect(capDelete?.op.op).toBe('del');
      expect(capDelete?.tombstone).toBe(true);
      expect(capDelete?.stamp).toEqual({});
    });

    it('applies put when incoming HLC is newer than local state', () => {
      const localRow = { id: 'h1', color: 'yellow', _hlc: '0000000010000_0000_devA' };
      const decision = LwwPlugin.apply({ row: localRow }, {
        entity: 'highlight',
        key: 'h1',
        hlc: '0000000010000_0001_devB',
        deviceId: 'devB',
        schemaVersion: 1,
        op: 'put',
        value: { id: 'h1', color: 'green' },
      });

      expect(decision).toEqual({
        kind: 'put',
        row: { id: 'h1', color: 'green', _hlc: '0000000010000_0001_devB' },
      });
    });

    it('returns noop when incoming put HLC is older than local row or tombstone', () => {
      const localRow = { id: 'h1', color: 'yellow', _hlc: '0000000020000_0000_devA' };

      // Older than local row
      const dec1 = LwwPlugin.apply({ row: localRow }, {
        entity: 'highlight',
        key: 'h1',
        hlc: '0000000010000_0000_devB',
        deviceId: 'devB',
        schemaVersion: 1,
        op: 'put',
        value: { id: 'h1', color: 'red' },
      });
      expect(dec1).toEqual({ kind: 'noop' });

      // Older than local tombstone
      const dec2 = LwwPlugin.apply({ tombstoneHlc: '0000000020000_0000_devA' }, {
        entity: 'highlight',
        key: 'h1',
        hlc: '0000000010000_0000_devB',
        deviceId: 'devB',
        schemaVersion: 1,
        op: 'put',
        value: { id: 'h1', color: 'red' },
      });
      expect(dec2).toEqual({ kind: 'noop' });
    });

    it('applies delete when incoming del HLC is newer than local row', () => {
      const localRow = { id: 'h1', color: 'yellow', _hlc: '0000000010000_0000_devA' };
      const decision = LwwPlugin.apply({ row: localRow }, {
        entity: 'highlight',
        key: 'h1',
        hlc: '0000000015000_0000_devB',
        deviceId: 'devB',
        schemaVersion: 1,
        op: 'del',
      });

      expect(decision).toEqual({
        kind: 'del',
        tombstoneHlc: '0000000015000_0000_devB',
      });
    });

    it('resurrects row when put is strictly newer than existing tombstone', () => {
      const decision = LwwPlugin.apply({ tombstoneHlc: '0000000010000_0000_devA' }, {
        entity: 'highlight',
        key: 'h1',
        hlc: '0000000020000_0000_devB',
        deviceId: 'devB',
        schemaVersion: 1,
        op: 'put',
        value: { id: 'h1', color: 'blue' },
      });

      expect(decision).toEqual({
        kind: 'put',
        row: { id: 'h1', color: 'blue', _hlc: '0000000020000_0000_devB' },
      });
    });
  });

  describe('AppendOnlyPlugin', () => {
    const makeCtx = (): CaptureCtx => ({
      clock: createClock('dev1', () => 50_000),
      entity: 'quizAttempt',
      schemaVersion: 1,
      wire: dummyWire,
    });

    it('captures create successfully', () => {
      const ctx = makeCtx();
      const change: LocalChange<{ id: string; score: number }> = {
        kind: 'create',
        key: 'attempt-1',
        next: { id: 'attempt-1', score: 95 },
      };

      const result = AppendOnlyPlugin.capture(change, ctx);
      expect(result?.op.op).toBe('put');
      expect(result?.op.key).toBe('attempt-1');
      expect(result?.op.value).toEqual({ id: 'attempt-1', score: 95 });
      expect(result?.stamp._hlc).toBeDefined();
    });

    it('throws AppendOnlyViolation on update or delete attempts', () => {
      const ctx = makeCtx();
      const updateChange: LocalChange<{ id: string }> = {
        kind: 'update',
        key: 'a1',
        prev: { id: 'a1' },
        next: { id: 'a1' },
      };
      const deleteChange: LocalChange<{ id: string }> = {
        kind: 'delete',
        key: 'a1',
        prev: { id: 'a1' },
      };

      expect(() => AppendOnlyPlugin.capture(updateChange, ctx)).toThrow(AppendOnlyViolation);
      expect(() => AppendOnlyPlugin.capture(deleteChange, ctx)).toThrow(AppendOnlyViolation);
    });

    it('applies put if row does not exist locally', () => {
      const decision = AppendOnlyPlugin.apply({}, {
        entity: 'quizAttempt',
        key: 'a1',
        hlc: '100_0_dev1',
        deviceId: 'dev1',
        schemaVersion: 1,
        op: 'put',
        value: { id: 'a1', score: 100 },
      });

      expect(decision).toEqual({
        kind: 'put',
        row: { id: 'a1', score: 100, _hlc: '100_0_dev1' },
      });
    });

    it('returns noop if record already exists locally or op is not put', () => {
      const local = { id: 'a1', score: 100, _hlc: '100_0_dev1' };

      const putDecision = AppendOnlyPlugin.apply({ row: local }, {
        entity: 'quizAttempt',
        key: 'a1',
        hlc: '200_0_dev2',
        deviceId: 'dev2',
        schemaVersion: 1,
        op: 'put',
        value: { id: 'a1', score: 80 },
      });
      expect(putDecision).toEqual({ kind: 'noop' });

      const delDecision = AppendOnlyPlugin.apply({}, {
        entity: 'quizAttempt',
        key: 'a1',
        hlc: '200_0_dev2',
        deviceId: 'dev2',
        schemaVersion: 1,
        op: 'del',
      });
      expect(delDecision).toEqual({ kind: 'noop' });
    });
  });

  describe('CasDraftPlugin', () => {
    const makeCtx = (deviceId = 'dev1'): CaptureCtx => ({
      clock: createClock(deviceId, () => 70_000),
      entity: 'documentContent',
      schemaVersion: 1,
      wire: dummyWire,
    });

    it('capture creates revision stamp and appends to ancestor chain up to cap', () => {
      const ctx = makeCtx();

      // Initial create
      const createRes = CasDraftPlugin.capture({
        kind: 'create',
        key: 'doc1',
        next: { id: 'doc1', text: 'v0' },
      }, ctx);

      expect(createRes?.op.baseRevision).toBeUndefined();
      expect(createRes?.stamp._rev).toBeDefined();
      expect(createRes?.stamp._anc).toEqual([]);

      const rev0 = createRes!.stamp._rev!;

      // First update on top of rev0
      const updateRes1 = CasDraftPlugin.capture({
        kind: 'update',
        key: 'doc1',
        prev: { id: 'doc1', text: 'v0', _rev: rev0, _anc: [] },
        next: { id: 'doc1', text: 'v1' },
      }, ctx);

      expect(updateRes1?.op.baseRevision).toBe(rev0);
      expect(updateRes1?.stamp._anc).toEqual([rev0]);
      const rev1 = updateRes1!.stamp._rev!;

      // Second update on top of rev1
      const updateRes2 = CasDraftPlugin.capture({
        kind: 'update',
        key: 'doc1',
        prev: { id: 'doc1', text: 'v1', _rev: rev1, _anc: [rev0] },
        next: { id: 'doc1', text: 'v2' },
      }, ctx);

      expect(updateRes2?.op.baseRevision).toBe(rev1);
      expect(updateRes2?.stamp._anc).toEqual([rev0, rev1]);

      // Delete capture carries baseRevision
      const delRes = CasDraftPlugin.capture({
        kind: 'delete',
        key: 'doc1',
        prev: { id: 'doc1', text: 'v2', _rev: rev1, _anc: [rev0] },
      }, ctx);

      expect(delRes?.op.op).toBe('del');
      expect(delRes?.op.baseRevision).toBe(rev1);
      expect(delRes?.tombstone).toBe(true);
    });

    it('caps ancestor list at ANCESTOR_CAP (32)', () => {
      const ctx = makeCtx();
      const longAnc = Array.from({ length: 40 }, (_, i) => `rev_${i}`);
      const updateRes = CasDraftPlugin.capture({
        kind: 'update',
        key: 'doc1',
        prev: { id: 'doc1', text: 'prev', _rev: 'rev_latest', _anc: longAnc },
        next: { id: 'doc1', text: 'next' },
      }, ctx);

      expect(updateRes?.stamp._anc?.length).toBe(ANCESTOR_CAP);
      expect(updateRes?.stamp._anc?.[ANCESTOR_CAP - 1]).toBe('rev_latest');
    });

    it('fast-forwards cleanly when incoming op.baseRevision matches local._rev', () => {
      const localRow = {
        id: 'doc1',
        text: 'v0',
        _hlc: '100_0_dev1',
        _rev: '100_0_dev1',
        _anc: [],
      };

      const decision = CasDraftPlugin.apply({ row: localRow }, {
        entity: 'documentContent',
        key: 'doc1',
        hlc: '200_0_dev2',
        deviceId: 'dev2',
        schemaVersion: 1,
        op: 'put',
        baseRevision: '100_0_dev1',
        value: { id: 'doc1', text: 'v1' },
      });

      expect(decision.kind).toBe('put');
      if (decision.kind === 'put') {
        expect(decision.row.text).toBe('v1');
        expect(decision.row._rev).toBe('200_0_dev2');
        expect(decision.row._anc).toEqual(['100_0_dev1']);
        expect(decision.drafts).toBeUndefined();
      }
    });

    it('ignores already applied or ancestor revision (idempotency)', () => {
      const localRow = {
        id: 'doc1',
        text: 'v2',
        _hlc: '300_0_dev1',
        _rev: '300_0_dev1',
        _anc: ['100_0_dev1', '200_0_dev1'],
      };

      // Exactly the current revision
      const dec1 = CasDraftPlugin.apply({ row: localRow }, {
        entity: 'documentContent',
        key: 'doc1',
        hlc: '300_0_dev1',
        deviceId: 'dev1',
        schemaVersion: 1,
        op: 'put',
        value: { id: 'doc1', text: 'v2' },
      });
      expect(dec1).toEqual({ kind: 'noop' });

      // In ancestor list
      const dec2 = CasDraftPlugin.apply({ row: localRow }, {
        entity: 'documentContent',
        key: 'doc1',
        hlc: '200_0_dev1',
        deviceId: 'dev1',
        schemaVersion: 1,
        op: 'put',
        value: { id: 'doc1', text: 'v1' },
      });
      expect(dec2).toEqual({ kind: 'noop' });
    });

    it('handles concurrent divergence deterministically: higher HLC wins row, lower kept as draft', () => {
      // Local state is at revA
      const localRow = {
        id: 'doc1',
        text: 'Local edit',
        _hlc: '100_0_devA',
        _rev: '100_0_devA',
        _anc: ['000_0_devA'],
      };

      // Remote op based on same base 000_0_devA, but with higher HLC (200 > 100)
      const remoteOp = {
        entity: 'documentContent',
        key: 'doc1',
        hlc: '200_0_devB',
        deviceId: 'devB',
        schemaVersion: 1,
        op: 'put' as const,
        baseRevision: '000_0_devA',
        value: { id: 'doc1', text: 'Remote edit' },
      };

      const decision = CasDraftPlugin.apply({ row: localRow }, remoteOp);
      expect(decision.kind).toBe('put');
      if (decision.kind === 'put') {
        // Remote wins the main row
        expect(decision.row.text).toBe('Remote edit');
        expect(decision.row._rev).toBe('200_0_devB');
        // Local is saved as draft
        expect(decision.drafts).toHaveLength(1);
        expect(decision.drafts?.[0]).toEqual({
          id: 'documentContent:doc1@100_0_devA',
          entity: 'documentContent',
          key: 'doc1',
          value: { id: 'doc1', text: 'Local edit' },
        });
      }

      // Mirror case: Local row has higher HLC (300 > 200)
      const winningLocalRow = {
        id: 'doc1',
        text: 'Winning local',
        _hlc: '300_0_devA',
        _rev: '300_0_devA',
        _anc: ['000_0_devA'],
      };

      const decision2 = CasDraftPlugin.apply({ row: winningLocalRow }, remoteOp);
      expect(decision2.kind).toBe('put');
      if (decision2.kind === 'put') {
        // Local remains the main row
        expect(decision2.row.text).toBe('Winning local');
        // Remote is saved as draft
        expect(decision2.drafts).toHaveLength(1);
        expect(decision2.drafts?.[0]).toEqual({
          id: 'documentContent:doc1@200_0_devB',
          entity: 'documentContent',
          key: 'doc1',
          value: { id: 'doc1', text: 'Remote edit' },
        });
      }
    });

    it('enforces edit beats delete on concurrent edits', () => {
      // Local has a newer edit (rev2)
      const localRow = {
        id: 'doc1',
        text: 'Local edit on top',
        _hlc: '200_0_devA',
        _rev: '200_0_devA',
        _anc: ['100_0_devA'],
      };

      // Remote attempts to delete base revision rev1
      const delOp = {
        entity: 'documentContent',
        key: 'doc1',
        hlc: '250_0_devB',
        deviceId: 'devB',
        schemaVersion: 1,
        op: 'del' as const,
        baseRevision: '100_0_devA',
      };

      const decision = CasDraftPlugin.apply({ row: localRow }, delOp);
      // Because baseRevision !== local._rev, edit beats delete
      expect(decision).toEqual({ kind: 'noop' });
    });

    it('deletes cleanly when baseRevision matches local._rev', () => {
      const localRow = {
        id: 'doc1',
        text: 'To be deleted',
        _hlc: '100_0_devA',
        _rev: '100_0_devA',
        _anc: [],
      };

      const delOp = {
        entity: 'documentContent',
        key: 'doc1',
        hlc: '150_0_devB',
        deviceId: 'devB',
        schemaVersion: 1,
        op: 'del' as const,
        baseRevision: '100_0_devA',
      };

      const decision = CasDraftPlugin.apply({ row: localRow }, delOp);
      expect(decision).toEqual({
        kind: 'del',
        tombstoneHlc: '150_0_devB',
      });
    });
  });

  describe('PLUGINS Registry mapping', () => {
    it('contains all strategies declared in MergeStrategyId', () => {
      const plugins: Record<string, MergePlugin> = PLUGINS;
      expect(plugins.lww).toBe(LwwPlugin);
      expect(plugins.appendOnly).toBe(AppendOnlyPlugin);
      expect(plugins.casDraft).toBe(CasDraftPlugin);
    });
  });
});
