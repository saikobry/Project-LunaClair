import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {
  SYNC_POLICY, openLunaClairDb, withOrigin, applyRemoteOps, findOrphans, restoreOrder, assertPolicyMatchesSchema,
  foldCard, rebuildCards, migrateStateToKeyframes, isPrunable, AppendOnlyViolation, OriginConflictError, SyncScopeError,
  type JournalOp, type ReviewLog, type Scheduler, type SyncStamp, type CardState, type LunaClairTables, type TablePolicy, type TableName,
} from './phase17-sync-sketch';

let passed = 0;
const test = async (name: string, fn: () => Promise<void> | void) => {
  try { await fn(); passed++; console.log('  ok  ', name); } catch (e) { console.error('  FAIL', name, '\n      ', (e as Error).message); process.exitCode = 1; }
};
let n = 0;
const fresh = (device: string) => openLunaClairDb(`lc_${device}_${n++}`, device, (() => { let t = 1_700_000_000_000; return () => (t += 1); })());
const drain = async (from: ReturnType<typeof fresh>) => { const ops = await from.db.outbox.toArray(); await from.db.outbox.clear(); return ops as JournalOp[]; };

(async () => {
  console.log('registry');
  await test('policy matches the real Dexie schema', () => { assertPolicyMatchesSchema(fresh('A').db); });
  await test('drift is detected (extra real table)', () => {
    const { db } = fresh('A');
    db.version(2).stores({ surprise: 'id' });
    assert.throws(() => assertPolicyMatchesSchema(db), /missing: \[surprise\]/);
  });
  await test('restoreOrder puts parents before children', () => {
    const o = restoreOrder();
    for (const [a, b] of [['materials', 'questions'], ['materials', 'documentContents'], ['documentContents', 'highlights'], ['questions', 'quizzes'], ['quizzes', 'quizAttempts']] as const) {
      assert.ok(o.indexOf(a) < o.indexOf(b), `${a} before ${b}`);
    }
  });
  await test('only derived / prunable local-only tables are prunable', () => {
    assert.equal(isPrunable('assetCache'), true);
    assert.equal(isPrunable('flashcardReviews'), true);
    assert.equal(isPrunable('outbox'), false);
    assert.equal(isPrunable('highlights'), false);
  });

  console.log('tx origin + hooks');
  await test('local write captured + stamped; guard rejects writes outside withOrigin', async () => {
    const r = fresh('A');
    await withOrigin(r.db, 'local', [r.db.highlights], async () => { await r.db.highlights.add({ id: 'h1', documentId: 'd1', start: 0, end: 3, color: 'y' }); });
    const h = await r.db.highlights.get('h1');
    assert.ok(h?._hlc);
    assert.equal(await r.db.outbox.count(), 1);
    await assert.rejects(() => r.db.highlights.add({ id: 'h2', documentId: 'd1', start: 0, end: 1, color: 'y' }), SyncScopeError);
    assert.equal(await r.db.highlights.count(), 1, 'rejected write must not persist');
  });
  await test('remote apply does not echo into the outbox', async () => {
    const a = fresh('A'); const b = fresh('B');
    await withOrigin(a.db, 'local', [a.db.highlights], async () => { await a.db.highlights.add({ id: 'h1', documentId: 'd1', start: 0, end: 3, color: 'y' }); });
    await applyRemoteOps(b.db, b.clock, await drain(a));
    assert.equal((await b.db.highlights.get('h1'))?.color, 'y');
    assert.equal(await b.db.outbox.count(), 0, 'no echo');
  });
  await test('local clear() emits tombstones; bypass clear() does not', async () => {
    const r = fresh('A');
    await withOrigin(r.db, 'local', [r.db.highlights], async () => { await r.db.highlights.bulkAdd([{ id: 'a', documentId: 'd', start: 0, end: 1, color: 'y' }, { id: 'b', documentId: 'd', start: 0, end: 1, color: 'y' }]); });
    await r.db.outbox.clear();
    await withOrigin(r.db, 'bypass', [r.db.highlights], async () => { await r.db.highlights.clear(); });
    assert.equal(await r.db.outbox.count(), 0);
    assert.equal(await r.db.tombstones.count(), 0);
    await withOrigin(r.db, 'local', [r.db.highlights], async () => { await r.db.highlights.bulkAdd([{ id: 'a', documentId: 'd', start: 0, end: 1, color: 'y' }]); });
    await r.db.outbox.clear();
    await withOrigin(r.db, 'local', [r.db.highlights], async () => { await r.db.highlights.clear(); });
    assert.deepEqual((await r.db.outbox.toArray()).map((o) => o.op), ['del']);
    assert.equal(await r.db.tombstones.count(), 1);
  });
  await test('nested tx with a different origin is refused; same origin inherits via parent chain', async () => {
    const r = fresh('A');
    await assert.rejects(() => withOrigin(r.db, 'remote', [r.db.highlights], async () => { await withOrigin(r.db, 'local', [r.db.highlights], async () => {}); }), OriginConflictError);
    await withOrigin(r.db, 'remote', [r.db.highlights], async () => {
      await withOrigin(r.db, 'remote', [r.db.highlights], async () => { await r.db.highlights.add({ id: 'n', documentId: 'd', start: 0, end: 1, color: 'y' }); });
    });
    assert.equal(await r.db.outbox.count(), 0);
  });
  await test('identical put() (empty mods) emits nothing', async () => {
    const r = fresh('A');
    const row = { id: 'h', documentId: 'd', start: 0, end: 1, color: 'y' };
    await withOrigin(r.db, 'local', [r.db.highlights], async () => { await r.db.highlights.add(row); });
    await r.db.outbox.clear();
    await withOrigin(r.db, 'local', [r.db.highlights], async () => { await r.db.highlights.put({ ...row }); });
    assert.equal(await r.db.outbox.count(), 0);
  });
  await test('append-only table rejects local updates', async () => {
    const r = fresh('A');
    await withOrigin(r.db, 'local', [r.db.quizAttempts], async () => { await r.db.quizAttempts.add({ id: 'q1', quizId: 'z', score: 1, at: 1 }); });
    await assert.rejects(() => withOrigin(r.db, 'local', [r.db.quizAttempts], async () => { await r.db.quizAttempts.update('q1', { score: 9 }); }), AppendOnlyViolation);
  });

  console.log('merge convergence');
  await test('LWW: two replicas, concurrent edits + a delete, any delivery order converge', async () => {
    const a = fresh('A'); const b = fresh('B'); const c = fresh('C');
    await withOrigin(a.db, 'local', [a.db.highlights], async () => { await a.db.highlights.add({ id: 'h', documentId: 'd', start: 0, end: 1, color: 'y' }); });
    const base = await drain(a);
    await applyRemoteOps(b.db, b.clock, base); await applyRemoteOps(c.db, c.clock, base);
    await withOrigin(a.db, 'local', [a.db.highlights], async () => { await a.db.highlights.update('h', { color: 'green' }); });
    await withOrigin(b.db, 'local', [b.db.highlights], async () => { await b.db.highlights.update('h', { color: 'pink' }); });
    const opsA = await drain(a); const opsB = await drain(b);
    await applyRemoteOps(c.db, c.clock, [...opsA, ...opsB]);
    await applyRemoteOps(a.db, a.clock, opsB); await applyRemoteOps(b.db, b.clock, opsA);
    const colors = await Promise.all([a, b, c].map(async (r) => (await r.db.highlights.get('h'))?.color));
    assert.equal(new Set(colors).size, 1, `diverged: ${colors}`);
    // delete newer than both edits, delivered BEFORE the older puts
    await withOrigin(c.db, 'local', [c.db.highlights], async () => { await c.db.highlights.delete('h'); });
    const del = await drain(c);
    const d = fresh('D');
    await applyRemoteOps(d.db, d.clock, [...del, ...opsA, ...opsB, ...base]);
    assert.equal(await d.db.highlights.get('h'), undefined, 'older puts must not resurrect');
  });
  await test('CAS: concurrent doc edits converge on one row + identical drafts; re-delivery adds no spurious draft', async () => {
    const a = fresh('A'); const b = fresh('B');
    await withOrigin(a.db, 'local', [a.db.documentContents], async () => { await a.db.documentContents.add({ id: 'doc', materialId: 'm', text: 'v0' }); });
    const base = await drain(a); await applyRemoteOps(b.db, b.clock, base);
    await withOrigin(a.db, 'local', [a.db.documentContents], async () => { await a.db.documentContents.update('doc', { text: 'A edit' }); });
    await withOrigin(b.db, 'local', [b.db.documentContents], async () => { await b.db.documentContents.update('doc', { text: 'B edit' }); });
    const opsA = await drain(a); const opsB = await drain(b);
    await applyRemoteOps(a.db, a.clock, opsB); await applyRemoteOps(b.db, b.clock, opsA);
    const rowA = await a.db.documentContents.get('doc'); const rowB = await b.db.documentContents.get('doc');
    assert.equal(rowA?.text, rowB?.text);
    const draftsA = (await a.db.conflictDrafts.toArray()).map((x) => x.id).sort();
    const draftsB = (await b.db.conflictDrafts.toArray()).map((x) => x.id).sort();
    assert.deepEqual(draftsA, draftsB); assert.equal(draftsA.length, 1);
    await applyRemoteOps(a.db, a.clock, [...base, ...opsA, ...opsB]);          // full replay
    assert.equal(await a.db.conflictDrafts.count(), 1, 'replay is idempotent');
    // fast-forward: B edits on top of the merged row, A receives it silently
    await withOrigin(b.db, 'local', [b.db.documentContents], async () => { await b.db.documentContents.update('doc', { text: 'B final' }); });
    await applyRemoteOps(a.db, a.clock, await drain(b));
    assert.equal((await a.db.documentContents.get('doc'))?.text, 'B final');
    assert.equal(await a.db.conflictDrafts.count(), 1);
  });
  await test('unknown entity / newer schema is held, not dropped', async () => {
    const r = fresh('A');
    const future: JournalOp = { entity: 'widget', key: 'w', hlc: '0000000000001_0000_Z', deviceId: 'Z', schemaVersion: 1, op: 'put', value: {} };
    const newer: JournalOp = { entity: 'highlight', key: 'h', hlc: '0000000000002_0000_Z', deviceId: 'Z', schemaVersion: 9, op: 'put', value: {} };
    await applyRemoteOps(r.db, r.clock, [future, newer]);
    assert.equal(await r.db.heldOps.count(), 2);
    assert.equal(await r.db.highlights.count(), 0);
  });

  console.log('orphans');
  await test('child arriving before parent is written and detected; resolves when parent lands', async () => {
    const a = fresh('A'); const b = fresh('B');
    await withOrigin(a.db, 'local', [a.db.materials, a.db.documentContents, a.db.highlights], async () => {
      await a.db.materials.add({ id: 'm', title: 'T' });
      await a.db.documentContents.add({ id: 'd', materialId: 'm', text: 'x' });
      await a.db.highlights.add({ id: 'h', documentId: 'd', start: 0, end: 1, color: 'y' });
    });
    const ops = await drain(a);
    await applyRemoteOps(b.db, b.clock, ops.filter((o) => o.entity === 'highlight'));
    assert.deepEqual(await findOrphans(b.db), { highlights: ['h'] });
    await applyRemoteOps(b.db, b.clock, ops.filter((o) => o.entity !== 'highlight'));
    assert.deepEqual(await findOrphans(b.db), {});
  });

  console.log('review log / FSRS');
  // Deliberately NON-commutative toy scheduler so wrong ordering changes the result.
  const sched: Scheduler = { next: (prev, rating, at, cardKey) => ({ cardKey, due: at + rating, stability: (prev?.stability ?? 1) * rating + 1, difficulty: (prev?.difficulty ?? 5) - rating, state: 2, lastReview: at, reps: (prev?.reps ?? 0) + 1 }) };
  const L = (id: string, at: number, rating: 1 | 2 | 3 | 4, hlc = ''): ReviewLog & SyncStamp => ({ id, cardKey: 'c', kind: 'review', rating, at, deviceId: 'x', _hlc: hlc || `0000000000000_${String(at).padStart(4, '0')}_x` });
  await test('foldCard is arrival-order independent', () => {
    const logs = [L('1', 10, 3), L('2', 20, 1), L('3', 30, 4), L('4', 25, 2)];
    const ref = JSON.stringify(foldCard(logs, sched));
    const perms = [[0, 1, 2, 3], [3, 2, 1, 0], [2, 0, 3, 1], [1, 3, 0, 2]];
    for (const p of perms) assert.equal(JSON.stringify(foldCard(p.map((i) => logs[i] as ReviewLog & SyncStamp), sched)), ref);
  });
  await test('keyframe supersedes earlier reviews; later reviews apply on top; late-arriving old review is absorbed', () => {
    const kf: ReviewLog & SyncStamp = { id: 'kf', cardKey: 'c', kind: 'keyframe', at: 100, deviceId: 'x', state: { cardKey: 'c', due: 150, stability: 7, difficulty: 4, state: 2, lastReview: 100, reps: 12 }, _hlc: '0000000000100_0000_x' };
    const after = L('5', 120, 3);
    const s1 = foldCard([kf, after], sched);
    const s2 = foldCard([L('old', 50, 1), kf, after], sched);
    assert.deepEqual(s1, s2);
    assert.equal(s1?.reps, 13);
  });
  await test('migration: legacy state rows -> keyframes (idempotent); derived rebuild reproduces them', async () => {
    const r = fresh('A');
    const legacy: CardState = { cardKey: 'k1', due: 5, stability: 3, difficulty: 6, state: 2, lastReview: 1, reps: 4 };
    await r.db.flashcardReviews.put(legacy);
    assert.equal(await migrateStateToKeyframes(r.db, 'A'), 1);
    assert.equal(await migrateStateToKeyframes(r.db, 'A'), 0);
    await r.db.flashcardReviews.clear();
    await rebuildCards(r.db, ['k1'], sched);
    assert.deepEqual(await r.db.flashcardReviews.get('k1'), legacy);
  });

  console.log(`\n${passed} passed${process.exitCode ? ' (with failures)' : ''}`);
})();

// ── compile-time completeness: these MUST error, or the @ts-expect-error itself errors ──
const _t: TablePolicy = { kind: 'localOnly', reason: 'x', prunable: false };
// @ts-expect-error — a table missing from the policy record is a compile error
const _missing = { materials: _t } satisfies { [K in TableName]: TablePolicy<K> };
// @ts-expect-error — a policy entry for a table that doesn't exist is a compile error
const _phantom: { [K in TableName | 'ghost']: TablePolicy } = { ...SYNC_POLICY };
void [_missing, _phantom] as unknown as LunaClairTables;
