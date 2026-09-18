# Plan — `lc-asset://` Resolution: Local Rendering of Packaged Figures

Status: **Phases 1–3 complete and verified** (Sep 2026, `feature/experience`).
Rev 2 — incorporates external review (identity/generic read port, migration invariants,
URI parsing contract, object-URL lifecycle, round-trip byte identity).
Rev 3 — pins the identity-vs-grouping invariant and the minimality rules for `StoredAsset` /
`AssetRepository` / `parseAssetReference`.
Rev 4 — corrects §5.1 after implementation proved the in-place rekey impossible, and records
the two env/spec findings in §8.
Rev 5 — Phase 2 recorded: adds the two URL gates §5.4 originally omitted, plus §8.4–8.5.
Rev 6 — Phase 3 implemented (multi-asset export + deterministic package numbering), the read port
renamed to the house `*Repository` convention (§8.7–8.8).
Rev 7 — §8.2 corrected: Blob bytes *do* survive IndexedDB, the old limitation was jsdom-specific,
so byte identity is asserted in Vitest under the `node` environment and the Phase 3 gate closes.

## 1. Problem

Cloning a study package that carries figures (today: `anatomy-physiology`, 21 PNGs, 2.46 MiB pack)
persists the image bytes in Dexie but renders **broken images** in the reader. The bytes travel
correctly end-to-end; nothing can display them.

## 2. Root causes (investigated)

1. **No resolver exists.** `MarkdownViewer` renders `<img src={props.src}>` verbatim
   (`components.img` at `src/features/reader/components/MarkdownViewer.tsx`). Nothing in
   `src/features/reader`, `src/shared`, or anywhere else maps `lc-asset://{id}` to a displayable
   URL — `grep -r lc-asset src/features/reader src/shared` returns zero hits.
2. **The asset store cannot serve references.** The store (`importAssets` at the time; `localAssets`
   since v14) is keyed by `materialId`
   (`schema.ts`: `importAssets: 'materialId'`) — one blob per material, built for the importer's
   single PDF upload. Package imports `bulkPut` N assets per material under the same key, so
   multi-image materials collapse to one surviving row. The remapped asset UUID the markdown URI
   points at is discarded at the persistence boundary (`ImportStudyPackageAsset` carries no id).

This is an **identity/persistence mismatch**, not a rendering problem alone: the markdown
references individual asset UUIDs, but `importAssets` cannot preserve individual asset identity.

What already works: seeder rewrites `images/x.png` → `lc-asset://pkg_asset_{slug}` and ships
base64 assets; `validateStudyPackage` checks them; `remapStudyPackage` rewrites every
`lc-asset://pkg_asset_*` URI in `documentContent` to fresh local UUIDs and preserves bytes;
`DexieStudyPackageImportService` decodes base64 → `Blob` inside the atomic import transaction.

## 3. Goals

- Cloned packages with N figures render all N figures in the reader, offline, from IndexedDB.
- Pre-existing single-asset materials (importer PDFs, old `lc-asset://{materialId}` URIs) keep
  rendering/exporting unchanged.
- Package re-export of a cloned material keeps carrying its figures, with byte identity preserved
  across round trips (correct bytes bound to the correct markdown URI).
- No network dependency for asset rendering — Dexie is the source of truth for local assets.

## 4. Non-goals

- No `.lcpack` format change (`schemaVersion` stays 1; slugs and base64 stay as-is).
- No share-landing/preview-modal rendering of document markdown (those surfaces don't render it
  today; the preview modal shows summary/questions only).
- No D1/Worker changes — assets never sync (`sync` never touches the asset store, `localAssets`).
- No Cache Storage usage for user content (SW cache is for network resources only).

## 5. Target design

### 5.1 Storage: rekey the asset store to `assetId` (Dexie v14 → `localAssets`)

```ts
// src/domain/assets/repositories/AssetRepository.ts — the row shape IS the domain type.
export interface StoredAsset {
    assetId: string;    // primary key — the remapped local UUID the markdown URI references
    materialId: string; // indexed — "all figures of this material"
    blob: Blob;
    mimeType: string;
    filename: string;
    importedAt: string;
}
```

**The rekey cannot happen in place.** IndexedDB has no operation to change an object store's
primary key, and Dexie 4 does not work around it — `updateTablesAndIndexes` diffs the schemas and
throws `UpgradeError: Not yet support for changing primary key` before any `upgrade` callback
runs (verified against dexie 4.4.5 with a minimal repro, and re-verified by the shipped migration
test). So `SCHEMA_V14` **drops the old store and declares a new one**:

```ts
export const SCHEMA_V14 = {
    ...SCHEMA_V13,
    importAssets: null,            // deleted (IndexedDB cannot rekey it in place)
    localAssets: 'assetId, materialId',
} as const;
```

The upgrade reads the old store by name and writes the new one. Dexie re-adds tables scheduled
for deletion to the upgrade transaction's schema (`upgradeSchema[table] = oldSchema[table]`), so
`tx.table('importAssets')` is readable inside the v14 callback even though the version deletes it —
and the delete itself runs after the callback, in the same version.

> **Correction to an earlier claim.** The plan previously cited v8 (`documentContents`:
> `sourceId` → `documentId`) as proof that this pattern works. It does not: v8 changes a primary
> key the same way, so it throws identically and its rekey `upgrade` is dead code — latent, because
> a v7 database would already have failed to open on every build since v8 shipped, so none survive.
> v14 is the first rekey in this codebase that actually works, and it is verified against the real
> v13 schema chain (§8).

**Migration (explicit, field-by-field — do not spread+diverge):**

```ts
{ assetId: record.materialId, materialId: record.materialId, blob: record.blob,
  mimeType: record.mimeType, filename: record.filename, importedAt: record.importedAt }
```

`materialId` is **preserved from the existing record**, never derived or recomputed. The legacy row
keeps `materialId` as its `assetId`, which is exactly what the legacy `lc-asset://{materialId}` URIs
reference — so old materials resolve with zero markdown rewrite. Safe only because v13 holds at most
one surviving row per material (the collision described in §2.2).

**In-migration invariant test (per migrated legacy row):**

```
assetId === materialId   // and blob/mimeType/filename/importedAt unchanged
```

### 5.2 Ports: generic read port; importer write port unchanged

The read abstraction must **not** be package-coupled or importer-coupled — assets are material
assets regardless of whether they arrived from an `.lcpack`, a PDF import, or a future importer.

- **New reserved domain `src/domain/assets/`** — canonical stored-asset shape (`assetId`,
  `materialId`, `blob`, `mimeType`, `filename`, `importedAt`) plus the **read-only** port:

  ```ts
  interface AssetRepository {
    get(assetId: string): Promise<StoredAsset | undefined>;
    getByMaterialId(materialId: string): Promise<StoredAsset[]>;
  }
  ```

  Read-only by contract: writes stay owned by the package/import infrastructure paths, so the
  reader never becomes another persistence boundary. Impl: `DexieAssetRepository`
  (`src/infrastructure/database/repositories/`), backed by the `assetId` primary key and the
  `materialId` index. Registered in `createInfrastructure.ts` composition root.

  **`StoredAsset` stays deliberately minimal** — exactly the six fields above, with no
  package/importer concepts: no `.lcpack`, no remapping, no `pkg_asset_*`, no import-session
  semantics. `AssetRepository` knows *how to retrieve* stored assets, never *why they were imported*.
  That keeps the dependency direction one-way (`domain/assets` ← infrastructure / reader; package,
  importer, and reader all write through persistence rather than through this port).

  **Binding invariant — identity vs. grouping:**

  ```
  lc-asset://A  →  assetId A  →  exactly one blob        (identity: what a document references)
  materialId M  →  A, B, C ...                           (grouping: index for "all of M's assets")
  ```

  `assetId` is the identity document references resolve against; `materialId` is only the grouping
  index. This distinction is the conceptual change the whole v14 migration exists to establish, and
  it is exactly what a future maintainer can break by assuming "`materialId` identifies the asset".
  It belongs in the domain contract beside the other `AssetRepository` rules (§7 DOX).

- **`src/domain/importer/ImportAssetRepository`** stays the **single-asset-per-material** write
  contract the importer owns (`put(asset)` / `get(materialId)` / `delete(materialId)`), and
  `ImportedAsset` stays unchanged (no `assetId`). The Dexie impl supplies `assetId = materialId`
  at the write boundary; importer behavior is bit-identical.

### 5.3 Persistence: carry the remapped asset id through import

- `ImportStudyPackageAsset` gains `assetId: string` (the remapped local UUID — already computed
  in `remapStudyPackage`'s `idMap`, currently dropped in `ImportStudyPackageUseCase` step 3).
- `DexieStudyPackageImportService` writes `{ assetId, materialId, blob, mimeType, filename,
  importedAt }` — N rows per material, no collisions.

### 5.4 Rendering: pure URI resolver + a thin rendering adapter

URI knowledge lives in a **pure, exhaustively testable function**, not in React. It knows only the
URI *syntax* — it must not touch Dexie, must not know about `materialId`, and must not carry
package concepts:

```ts
parseAssetReference(src: string | undefined): string | undefined   // 'lc-asset://abc' → 'abc'
```

Truth table (unit-tested, no DOM):

| input | result |
|---|---|
| `lc-asset://abc` | `abc` |
| `lc-asset://unknown` | `unknown` (resolver misses → placeholder) |
| `https://…` | `undefined` (unchanged) |
| `/images/foo.png` | `undefined` (unchanged) |
| `undefined` | `undefined` (unchanged) |

Then the render-side resolution, in the resolver hook, with this **documented lookup order**:

1. Resolve exact asset ID (`db.get(assetId)` → object URL).
2. Legacy material-ID references are valid asset IDs after the v14 migration (rule 1 covers them).
3. **Never rewrite legacy markdown** — the fallback is a lookup-order guarantee, not a data edit.
4. Missing references render the stable placeholder.

- New reader hook (`useMaterialAssets(materialId)`): loads the material's assets once via
  `AssetRepository`, builds `Map<assetId, objectURL>` with `URL.createObjectURL`, revokes on
  unmount/material change.
- `MarkdownViewer` accepts an optional `assetUrls?: Map<string, string>` prop and stays a rendering
  adapter: `parseAssetReference(props.src)` → map hit? resolved URL : labelled placeholder;
  `undefined` (a non-asset src) → `props.src` passes through untouched. An absent map means an
  `lc-asset://` reference renders the placeholder rather than a broken image — an unresolved
  figure is never silent. The map travels to the element components by module-level context, so
  the `components` map itself stays stable.

**Two URL gates must both allow the reference, and the spec missed both.** A figure renders
src-less and *silently* if either rejects the scheme:

1. `rehypeSanitize`'s `protocols.src` — `defaultSchema` permits only `http`/`https`, so it strips the
   `lc-asset://{assetId}` attribute **before** the `img` element component ever runs (the viewer
   never sees the reference at all).
2. `react-markdown`'s `urlTransform` — its default (`defaultUrlTransform`) blanks any URL whose
   protocol is outside `http`/`https`/`irc`/`ircs`/`mailto`/`xmpp`. Fixing only the sanitize schema
   still yields a src-less `<img>`.

Only `lc-asset` is allow-listed in both. Resolved `blob:` object URLs are deliberately **not**
allow-listed: they are minted at render time and never written back into markdown, so documents
only ever carry `lc-asset://` references.
- The other MarkdownViewer consumer (`ImportReviewView`) renders pre-package markdown
  (`images/...` or `lc-asset://{materialId}` from a live import session) — pass the resolver there
  too so inline figure review works.

### 5.5 Re-export: generalize `MaterializeStudyPackageUseCase` (minimal)

Today it fetches one asset by `materialId` and rewrites `lc-asset://{materialId}` → `lc-asset://pkg_asset_1`.
After the rekey it uses `AssetRepository.getByMaterialId`: fetch all assets, sort **deterministically**,
emit `pkg_asset_1..N`, rewrite each `lc-asset://{assetId}` → `lc-asset://pkg_asset_{n}`, and keep the
legacy `{materialId}` rewrite for old rows.

```ts
assets.sort((a, b) => a.filename.localeCompare(b.filename) || a.assetId.localeCompare(b.assetId));
```

The `assetId` tie-breaker keeps package numbering deterministic when two assets share a filename.

## 6. Phases

### Phase 1 — schema rekey + persistence plumbing (no visual change) — ✅ implemented

1. `SCHEMA_V14` + `StoredAsset` rekey (drop + recreate) + field-explicit v14 upgrade migration (§5.1).
2. `src/domain/assets/` reserved domain: `StoredAsset` + `AssetRepository` read-only port (+ barrel-free
   direct-path imports per ADR-010/013).
3. `DexieAssetRepository` impl + `createInfrastructure.ts` registration.
4. `ImportAssetRepository` impl: legacy-compatible `put`/`get`/`delete` over the new shape
   (`assetId = materialId` at the write boundary).
5. `ImportStudyPackageAsset.assetId` + import service writes it.
6. Tests: `DexieAssetRepository` (`get` by id, `getByMaterialId` returns N in one material),
   `DexieImportAssetRepository` (still 1:1), **migration test asserting `assetId === materialId`**
   and untouched blob/mimeType/filename/importedAt for every v13 row.

Gate: **passed** — 261 files / 1321 tests · `npm run build` ✓ · `npm run lint` 0/0. Deviations
from the spec above are recorded in §8.

### Phase 2 — reader resolution — ✅ implemented

1. Pure `parseAssetReference` (domain/shared util) + exhaustive truth-table unit tests (§5.4).
2. `useMaterialAssets` hook (object URLs + revoke lifecycle) in reader.
3. `MarkdownViewer` `assetUrls` prop wired through `ReaderView`. (`ImportReviewView` deliberately not
   wired — it renders pre-commit markdown with no `lc-asset://` references; see §8.5.)
4. Tests:
   - Viewer: resolved src, unknown-id placeholder, non-`lc-asset` src passes through, no-`assetUrls`
     behavior identical to today.
   - Hook — the real invariant is "**an object URL stays valid for every `<img>` rendered from the
     current map, and is revoked only once that map is no longer in use**":
     - mount(material A) → N URLs created
     - switch to material B → A's URLs revoked, B's created
     - unmount → B's revoked
     - assert `revokeObjectURL` is **not** called during a render/update of the same material
   - Must assert exactly-once revocation per URL (no double-revoke).

Gate: **passed** — 264 files / 1337 tests · lint 0/0 · `npm run build` ✓ · react-doctor `--scope
full` 100/100 · manual UI pass on the local dev Worker confirmed (Sep 2026): a cloned package's
figures now render in the reader. Phase 2 is complete end to end.

### Phase 3 — re-export round trip — ✅ implemented

1. `MaterializeStudyPackageUseCase` multi-asset generalization with the sort tie-breaker (§5.5).
2. Extend `packageRoundtrip.test.ts` — assert **content identity, not record counts**:

   ```
   original asset A bytes → pkg_asset_1 → local UUID A' → re-export → pkg_asset_1 → local UUID A''
   assert bytes(A) === bytes(A'')  and  every markdown URI resolves to the bytes it resolved to originally
   ```

   Record-count-only assertions can pass while binding the wrong bytes to the wrong markdown URI.

Gate: **passed** — 265 files / 1346 tests · lint 0/0 · `npm run build` ✓ · react-doctor `--scope
full` 100/100. Byte identity is asserted in Vitest by
`packageRoundtripBytes.test.ts`, which runs under the `node` environment where IndexedDB preserves
real `Blob` bytes (§8.2); the pairing/ordering contract is pinned by `packageRoundtrip.test.ts`
and `MaterializeStudyPackageUseCase.test.ts`. No browser round trip is outstanding.

## 7. Risks / notes

- **Migration safety**: v14 drops the legacy store and recreates it as `localAssets` (§5.1) —
  IndexedDB cannot rekey a store in place. The copy and the drop happen in one version, so a crash
  mid-upgrade leaves Dexie to replay the transaction and no committed state holds rows in both
  stores. The field-explicit migration plus the `assetId === materialId` assertion is what makes the
  compatibility promise provable.
- **Object-URL hygiene**: revoke on unmount/material change only; never revoke while an `<img>`
  rendered from that map is mounted.
- **5 MiB package ceiling**: unchanged; bytes already fit (`anatomy-physiology` = 49% of ceiling).
- **Phase ordering matters**: Phase 2 works for legacy rows immediately but needs Phase 1 for
  N-image materials — don't ship Phase 2 without Phase 1.
- **DOX** (per phase):
  - `src/domain/AGENTS.md` — new `assets/` reserved domain in Ownership, plus the
    **identity-vs-grouping invariant** and the `StoredAsset`/`AssetRepository` minimality rules in
    Local Contracts (where every other cross-domain contract lives: tag casing, repository ports).
    No child `src/domain/assets/AGENTS.md` yet — a two-file domain doesn't warrant its own doc;
    split it out if the folder grows. (Root AGENTS.md DOX rule: children when a folder owns its
    own purpose, workflow, and standards.)
  - `src/infrastructure/AGENTS.md` — `DexieAssetRepository` + schema version 1–14.
  - `src/domain/importer/AGENTS.md` — importer port stays single-asset (write boundary note).
  - `src/domain/package/AGENTS.md` — remap/asset contracts unchanged; re-export ordering note.
  - `src/features/reader/AGENTS.md` — viewer `assetUrls` + resolver contract, the two URL gates,
    and the object-URL lifecycle invariant.
  - Root AGENTS.md PWA section stays accurate (Dexie = local working state; no new sync surface).

## 8. Implementation findings (Phases 1–3, Sep 2026)

**8.1 — The v14 store is named `localAssets`, not `importAssets`.** Forced by the Dexie
constraint in §5.1, and consistent with the §5.2 decision to decouple this from the importer.
`SCHEMA_V14.importAssets = null` deletes the legacy store after the upgrade copies every row out.
The old `ImportAssetRecord` type is gone; `StoredAsset` (`domain/assets`) is the row type.
Rename cost is confined to `db.localAssets` call sites.

**8.2 — Blob bytes survive IndexedDB; the limitation was jsdom, not the storage layer.** (Corrected in
Rev 7. Rev 4 generalised a jsdom observation into "byte comparisons through IndexedDB are vacuous"
and pushed byte identity to the browser; that was an artefact of the test environment.)

- Under **`jsdom`**, `new Blob(...)` builds *jsdom's* `Blob`, which `fake-indexeddb`'s structured
  clone cannot serialize. The stored value reads back as a plain object with its bytes dropped
  (`Object.keys()` empty, no `arrayBuffer`/`text`), and re-encoding it yields `"[object Object]"`
  (base64 `W29iamVjdCBPYmplY3Rd`). A byte comparison there is worse than impossible — it is vacuous.
- Under Vitest's **`node`** environment the real `Blob` is used and survives the round trip intact.

So byte identity *is* assertable in Vitest. `packageRoundtripBytes.test.ts` declares
`// @vitest-environment node` and is written so it cannot degrade silently:

- a canary asserts `window` is `undefined` — if the file ever runs under jsdom the suite **fails**
  rather than passing vacuously (verified by forcing the directive to jsdom: all three tests fail,
  the base64 diff showing `W29iamVjdCBPYmplY3Rd` against the expected `iVBORwECAwT6/w==`);
- every base64 read back out of IndexedDB is **decoded and compared to the exact seeded bytes**
  (decoding also guards the degenerate case — `"[object Object]"` is not valid base64 and `atob`
  would throw, so a lost blob cannot compare equal by accident);
- a second hop asserts export → import → **re-export** still yields identical bytes per filename.

The resulting rule: **byte-level assertions on stored blobs must run under the `node` environment;
record, filename, and reference assertions are fine under jsdom.** The rest of the suite stays on
jsdom deliberately.

`blobToBase64` in `domain/package/engines/StudyPackageSerializer.ts` remains the product's encoder
and tolerates both environments.

**8.3 — `ImportAssetRepository.delete` now clears all rows of a material.** It deletes by the
`materialId` index rather than one primary key, so a material's package-imported figures are
removed alongside its imported PDF. That is the correct semantic for "remove this material's
assets"; the method currently has no callers (`RemoveImportedMaterialUseCase` does not touch
assets — a separate, pre-existing gap).

**8.4 — Phase 2 needed two URL gates, not one (§5.4).** Recorded there in full. Worth stating as a
finding because the failure mode is invisible: with either gate rejecting `lc-asset`, the `<img>`
renders with **no `src` and no error** — the symptom looks identical to "the resolver was never
wired up". The viewer test was written before the fix specifically to capture that evidence.

**8.5 — `ImportReviewView` is intentionally not wired with `assetUrls`.** The spec listed it, but it
renders pre-commit import markdown: those documents carry no `lc-asset://` references (figures are
rewritten to that scheme only when a package is materialized) and no material exists yet to read
assets for. Passing a map there would be dead wiring; the existing `MarkdownViewer` calls keep the
"absent map" path.

**8.6 — One lint exception recorded.** `useMaterialAssets` deliberately creates object URLs in an
effect (StrictMode safety, §8.4 context above) and trips oxlint's `react/set-state-in-effect`, whose
own carve-out is "use an effect only when synchronizing with an external system". Suppressed via a
file+rule `.oxlintrc.json` override — not a repo-wide rule off-switch — with the rationale and
review condition in `.react-doctor/false-positives.md`.

**8.7 — Phase 3 shipped: export is multi-asset.** `MaterializeStudyPackageUseCase` now takes the
`AssetRepository` read port (not the importer's write port) and fetches every asset of the material
via `getByMaterialId`. Assets are numbered `pkg_asset_1..N` after a deterministic sort (filename
asc, asset id as tie-breaker), and all document references are rewired in **one pass** with the same
`lc-asset://([a-zA-Z0-9_-]+)` shape `remapStudyPackage` uses — unknown references are left
alone. That replaced a single `new RegExp(...lc-asset://${id}...)` build, which was both
single-asset and prefix-unsafe (id `abc` would also match inside `lc-asset://abcd`). Legacy rows
needed no special case: after the v14 migration their `assetId` **is** their `materialId`, so the
identity rewrite matches the old `lc-asset://{materialId}` form by construction.

**Coverage of the acceptance criterion** ("content identity, not record counts"), in three layers:

- **Payload ↔ reference pairing, with real bytes** — asserted in
  `MaterializeStudyPackageUseCase.test.ts`, where blobs are created in-process so `dataBase64` can be
  compared to `btoa(...)` directly. This is the assertion that catches "right URI, wrong payload".
  It runs under jsdom, which is correct here — no data crosses IndexedDB in this test.
- **Pairing survives both hops** — asserted in `packageRoundtrip.test.ts` over export → re-import:
  the source document lists references in an order *deliberately different* from the export sort
  order, and after two hops each URI still resolves to its own filename.
- **Bytes survive an IndexedDB round trip** — asserted in `packageRoundtripBytes.test.ts` under the
  `node` environment, where stored `Blob`s keep their payload (§8.2). This closes the criterion: the
  bytes read back out of storage are compared against the seeded bytes, and the reference order
  they resolve in matches the source document.

**8.8 — Read port renamed `AssetReader` → `AssetRepository`.** The original name broke the
repo-wide persistence-port convention: every other port ends in `*Repository` with a
`Dexie*Repository` adapter, and a `*Reader` sitting inside a `repositories/` folder was doubly off.
Read-only remains a **contract** property (two methods, no writes) documented on the port, not a
naming one. Rename scope: `AssetRepository`, `DexieAssetRepository`,
`dexieAssetRepository`, `useAssetRepository`, plus the `Repositories.asset` key (unchanged).
`ImportAssetRepository` keeps its name — it is the importer's own single-file write contract,
scoped to `domain/importer`, and the two coexist deliberately over the one `localAssets` store.
