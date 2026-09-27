# src/infrastructure/ — Persistence and API Layer

## Purpose

Persistence, external APIs, extraction engines, and runtime adapters: IndexedDB/Dexie schema and lifecycle, remote Cloudflare Worker API repositories and transports, AI streaming gateway, browser storage/lifecycle providers, import extraction engines, and composite storage repositories satisfying domain ports. Governed by ADR-015 (Boundary-First, Responsibility-Second Organization).

## Ownership

- `database/` — Dexie / IndexedDB persistence engine:
  - `schema/` — Database engine definition, schema history, lifecycle, and migrations:
    - `LunaClairDatabase.ts` → `LunaClairDatabase` (Dexie subclass with typed `Table` properties, singleton `db`)
    - `schema.ts` → Version 1 through 15 schema definitions
    - `DatabaseInitializer.ts` → Startup orchestrator (refuses a database a newer build owns → `db.open()` → `migrateIfNeeded()`, deliberately no seeding)
    - `databaseLifecycle.ts` → Reload-required vocabulary and detection (`DatabaseReloadReason`, `DatabaseReloadRequiredError`, `readStoredDatabaseVersion`, `isStoredDatabaseNewer`)
    - `DatabaseMigrator.ts` → One-time migration of legacy `localStorage` data into IndexedDB
  - `repositories/` — Concrete Dexie persistence adapters implementing domain repository ports:
    - `DexieAiChatRepository.ts` → `AiChatRepository` (normalizes every read into the domain shape: a **global** row (no `materialId`) is coerced to `grounding: 'none'` whatever is stored, and a material-scoped row with an absent or malformed value reads `'whole'` — absence is a property of `AiThreadRow` only, and normalization is side-effect free, never rewriting the row. `grounding` is deliberately **unindexed**, so it needs no schema version. Partial update `setGrounding` modifies only grounding without disturbing `updatedAt` or title, and `saveMessagePair` atomically opens turns with a streaming placeholder so aborted/interrupted turns are never left orphaned without an assistant partner)
    - `DexieAnalyticsRepository.ts` → `AnalyticsRepository`
    - `DexieAnnotationRepository.ts` → `AnnotationRepository`
    - `DexieAssetRepository.ts` → `AssetRepository` (read-only: `get(assetId)`, `getByMaterialId(materialId)`)
    - `DexieConflictDraftRepository.ts` → `ConflictDraftRepository`
    - `DexieDocumentContentRepository.ts` → `DocumentContentRepository`
    - `DexieFlashcardReviewRepository.ts` → `FlashcardReviewRepository` (both writes are syncable: `save` puts the rows and their `UPSERT` outbox items in one `db.transaction('rw', [flashcardReviews, syncQueue])`, and `deleteByKeys` mirrors it with a `DELETE` item per key. The deletion tombstone is part of the contract, not an optimisation — `flashcardReview` is a Model A LWW entity, so a local-only clear is undone by the next pull and the schedule resurrects. Its `clientTimestamp` is the moment of deletion, which is what keeps the tombstone newer than the UPSERT that created the row under the Worker's LWW comparison)
    - `DexieImportAssetRepository.ts` → `ImportAssetRepository` (write-only: `put`)
    - `DexieLibraryRepository.ts` → `LibraryRepository` (normalizes material `tags` through the shared `normalizeTags` helper in `shared/utils/tags.ts` at both write boundaries — `undefined` leaves tags unchanged, empty array clears; declares no material delete — removal is `DexieLibraryImportService`'s atomic cascade)
    - `DexiePreferencesRepository.ts` → `PreferencesRepository` (owns the `ai.*` preference keys, which never leave this adapter; validates the stored value on read and falls back to the default — a stored preference is a hint, not a contract. The `preferences` store has existed unused since an early schema version and is now live; it needs no schema change)
    - `DexieQuestionRepository.ts` → `QuestionRepository`
    - `DexieQuizDraftRepository.ts` → `QuizDraftRepository`
    - `DexieQuizRepository.ts` → `QuizRepository`
    - `DexieQuizSessionRepository.ts` → `QuizSessionRepository`
    - `DexieCollectionRepository.ts` → `CollectionRepository`
    - `DexieCollectionMaterialRepository.ts` → `CollectionMaterialRepository`
    - `DexieSyncQueueRepository.ts` → `SyncQueueRepository`
    - `DexieSyncStateRepository.ts` → `SyncStateRepository`
  - `services/` — Multi-table atomic Dexie transactional application services:
    - `DexieLibraryImportService.ts` → `LibraryImportService`
    - `DexieQuizEditorService.ts` → `QuizEditorService`
    - `DexieStudyPackageImportService.ts` → `StudyPackageImportService`
  - `sync/` — Dexie-level sync reconciliation and transactional outbox:
    - `DexieSyncReconciler.ts` → `SyncReconciler`
    - `transactionalOutbox.ts` → `runSyncableTransaction`
- `api/` — Cloudflare Worker REST API boundary:
  - `transports/` — Cloudflare Worker HTTP network transports:
    - `WorkerSyncTransport.ts` → `SyncTransport` (`/api/sync/pull`, `/api/sync/push`)
    - `WorkerShareTransport.ts` → `ShareTransport` (`/api/shares`, `/api/shares/:code`)
- `browser/` — Browser environment and runtime capability adapters:
  - `lifecycle/` — Browser event integrations:
    - `BrowserSyncLifecycle.ts` → Window `online`, `visibilitychange`, and periodic interval triggers
  - `storage/` — LocalStorage-backed providers:
    - `LocalStorageCredentialsProvider.ts` → `SessionCredentialsProvider`
    - `deviceId.ts` → `getOrCreateDeviceId()`
- `importer/` — Document extraction and parsing boundary:
  - `registry/` — Format registry and extractor factory:
    - `DefaultImporterRegistry.ts` → `ImporterRegistry`
    - `createExtractors.ts` → `createDefaultImporterRegistry()`, `createOcrExtractor()`
  - `adapters/` — Format-specific importers implementing `ContentImporter`:
    - `PdfjsImporter.ts` → PDF document extractor via `pdfjs-dist` (supports local text/Tesseract extraction and opt-in multimodal AI vision extraction with 12s pacing, rate-limit cooldown, cancellation-safe partial page preservation, and explicit error contract on `ocrEngine === 'ai-vision'` with zero silent fallback to Tesseract)
    - `ImageImporter.ts` → Image extractor supporting local Tesseract OCR and opt-in multimodal AI vision extraction (`ocrEngine === 'ai-vision'`) via canvas/FileReader conversion
  - `engines/` — Raw processing engines:
    - `TesseractExtractor.ts` → OCR worker pool management via `tesseract.js`
    - `AiVisionExtractor.ts` → Multimodal vision page extractor wrapping `AiService.streamChat` with capability checks, verbatim visual transcription prompt (`AI_VISION_SYSTEM_PROMPT`: Perception stage — faithful pixel-to-text recognition; formats tables/forms into standard GFM pipe tables with header separators, preserves list numbering and bullet hierarchy without converting numbered policy clauses into `##` headings, omits obvious recurring document-control running headers/footers and stamps while strictly preserving cover/approval tables; Markdown structuring and cleanup belong to Stage 2 Review), and output truncation detection
- `ai/` — Worker AI gateway:
  - `adapters/` — Model gateway implementations:
    - `WorkerAiAdapter.ts` → `AiService` (streaming SSE client for `/api/ai/chat`; forwards the request's optional catalog model id and surfaces the Worker's failure `code` and `retryAfterSeconds` verbatim instead of flattening every failure to `HTTP_<status>` — the cooldown depends on the provider's own wait)
  - `catalog/` — Model catalog resolution:
    - `WorkerAiModelCatalogRepository.ts` → `AiModelCatalogRepository` (fetch `/api/ai/models`, cache the last-good catalog in versioned `localStorage` with the `fetchedAt` it came from, and answer offline from cache or the bundled mirror so the app prices turns and meters requests without a network; bounded by a fetch timeout and never throws). **A successful fetch wins outright** rather than being version-ranked: removing a model is a change to the catalog, not only a bump to its `version`, so the server — the only party that knows what exists now — must beat a cache whose version reads higher. `version` therefore arbitrates only between the two offline sources. The **cache expires after 24h** (`CACHE_MAX_AGE_MS`) so a retired model cannot stay authoritative indefinitely while the endpoint is unreachable; the bundled mirror has no expiry because it cannot be newer than the app around it. The clock is injectable (`now`) so freshness is testable. A catalog carrying `availability: 'disabled'` is **served to the caller but never cached**: the switch is an incident state, not a catalog, and persisting it would keep the assistant looking switched off after the incident ended. An entry written before the field existed is read as available.
  - `parsing/` — SSE stream parsing and structured output extraction:
    - `parseStructuredAiResponse.ts` → Stream parser and structured validator
- `storage/` — Composite multi-tier storage repositories:
  - `repositories/`:
    - `HybridDocumentRepository.ts` → `DocumentRepository` (Dexie `documentContents` local-first read with empty fallback for unauthored materials)

## Local Contracts

- **ADR-015 Compliance**: Infrastructure modules strictly organize by `src/infrastructure/<boundary>/<responsibility>/<Implementation>.ts`.
- **Zero Barrels (ADR-010)**: Internal `index.ts` barrels are prohibited; consumers import directly from concrete paths.
- **Architectural Boundary Guardrails**: Features are statically prohibited by Oxlint from importing `src/infrastructure/**`. All feature writes route through application use cases. Composition roots (`createInfrastructure.ts`, `bootstrap.ts`) and test suites are the sole authorized consumers.
- **1:1 Primary Unit Test Colocation (ADR-012)**: Every production file has a corresponding test in a colocated `__tests__/` directory within its responsibility folder. Consolidated multi-unit test files are prohibited.
- **DI types domain ports, not adapters.** `Infrastructure.services.ai` is typed `AiService` (the domain port), not `WorkerAiAdapter`: composition roots wire concretes, but the graph's declared types must not let consumers depend on a gateway implementation.
- **Dependency Injection**: Atomic database services standardize on explicit constructor injection with default singleton fallback (`constructor(db: LunaClairDatabase = defaultDb)`), adhering to TypeScript `erasableSyntaxOnly`.
- **Atomic Dexie Transactions**: Multi-table operations (`DexieQuizEditorService.saveQuiz`, `DexieLibraryImportService`, `runSyncableTransaction`) execute within a single atomic `db.transaction('rw', ...)` scope.
- **Local binary assets live in one store**: `localAssets` (Dexie v14) is keyed by `assetId` — the identity `lc-asset://{assetId}` document references resolve against — with a `materialId` index for "every asset belonging to this material". PDF/image import writes exactly one row per material as `assetId = materialId` (the importer's 1:1 contract); study package import writes N rows per material. Material removal deletes that material's `localAssets` rows inside the same `removeMaterial` transaction (`DexieLibraryImportService`) — an off-transaction delete would strand blobs whenever the material delete succeeded first. The same transaction also clears the material's `collectionMaterials` junction rows: a stale membership row keeps a deleted material counted as assigned, inflating a collection's count and holding the material out of the Library's `uncollected` lens.
- **Index-only schema versions need no `upgrade` callback, but they do need evidence (v15).** Dexie creates added indexes and drops retired ones inside its own upgrade transaction without rewriting a record. What v15 required instead was proof per removal: the index must have zero `.where()` / `.orderBy()` call sites, because Dexie raises `SchemaError: KeyPath x on object store y is not indexed` — it never falls back to a scan — and a compound is a separate index name that does **not** subsume the single-column index its call sites name. v15 dropped 37 singles and added 4 (three compounds plus `quizSessions.status`); inventory and per-store reasoning: `docs/reviews/schema-review-verification.md`.
- **Compound reads and their two traps.** `.where('[a+b]').between([v, Dexie.minKey], [v, Dexie.maxKey])` returns records in `b` order within `v`, so `.limit(n)` stops the cursor early — that is what makes the outbox drain bounded (`DexieSyncQueueRepository.peekPending`) and the chat reads ordered (`DexieAiChatRepository`). Trap 1: `where()` hands back a `WhereClause`, which has no `toArray` of its own — the comparison method is what executes the query, so a missing index surfaces there rather than at `where()`. Trap 2: a record whose index key is `undefined` is **absent** from that index, so a compound may only key on fields the domain model requires and every writer sets (global AI threads carry no `materialId` and stay a scan for exactly this reason).
- **A schema version bump can strand a stale bundle, and the stale bundle does not fail loudly — it patches.** A precached bundle older than the stored schema is the case that matters (the exposure window is the service-worker update delay), and `db.open()` does **not** reject for it: Dexie catches the `VersionError`, reopens at the stored version, and treats the mismatch as a schema diff to patch — `patchCurrentVersion` re-creates missing stores and re-adds missing indexes one native version higher, so a v15-era bundle meeting a v16 database quietly undoes what v15 retired and permanently bumps 160 → 161. Detection therefore happens in `DatabaseInitializer.initialize()` **before** `db.open()`, where nothing has been written yet: `readStoredDatabaseVersion` reads the stored native version through an unnamed `open()` that is rolled back if it would *create* the database (a stray native-1 database would send Dexie down its per-version path on a fresh install, where the v8 primary-key change cannot be applied at all), and `isStoredDatabaseNewer` compares that against `db.verno`. Two Dexie facts shape the comparison: a declared version `n` is stored as native `n * 10`, and a *patch* lands one step above it — so the check **rounds** rather than testing multiples of ten, because an artifact rounds back onto the version that produced it while a genuinely newer build sits a full factor away. Reading an artifact as "newer" would be worse than the fault it reports: a reload cannot change the stored number, so the tab would land on that state forever. `LunaClairDatabase` reports the same vocabulary for a connection lost while running — `versionchange` (`app-updated`, or `database-reset` when `newVersion === 0`, i.e. a delete request) and `blocked` (`upgrade-blocked`, where `open()` stays pending forever and only the event can carry it). `useAppBootstrap` subscribes before opening, so a blocked startup still reaches `DatabaseReloadScreen`. Closing the connection ends that tab's queries; it must not limp along. **Data-safe recovery is close → surface → reload → retry; `Dexie.delete`, recreating the database, continuing without an open database, and downgrading a declaration are all forbidden.** This is why the version number is not bumped casually, and why a stale-declaration patch is the one thing startup must prevent rather than tolerate.
- **A primary-key rekey cannot migrate rows.** IndexedDB has no operation to change an object store's primary key, and Dexie diffs schemas before running any `upgrade` callback — so the v14 rekey is implemented by dropping the old store (`importAssets: null`) and declaring a new one (`localAssets`), copying rows inside the same version's upgrade. The v8 `documentContents` rekey (`sourceId` → `documentId`) is therefore **declared only, with no upgrade callback**: one there would be unreachable, since a pre-v8 database fails to open before the callback could run. Rows written after v8 simply use `documentId`.
- **No Auto-Hydration**: The app boots with an empty local library; courses are discovered via StudyPackage shares or imported as `.lcpack` bundles and explicitly cloned/imported by user action.
- **Importer AI Vision Contract**: When `ocrEngine === 'ai-vision'`, importers (`PdfjsImporter`, `ImageImporter`) strictly execute the AI Vision pipeline emitting `phase: 'ai-vision'` progress and tracking `visionPages`. If `visionExtractor` is uninitialized or `navigator.onLine` is false, they throw explicit descriptive errors immediately with zero silent fallback to local Tesseract OCR.

## Work Guidance

- When creating or modifying infrastructure modules, place them into the authorized `<boundary>/<responsibility>/` subdirectory.
- Colocate 1:1 unit tests in `__tests__/` alongside the implementation file.
- Maintain TS `erasableSyntaxOnly` compliance (explicit class member declarations, no parameter properties).

## Verification

- `npm run lint` — Oxlint verification of import boundaries and syntax rules.
- `npm run build` — Full TypeScript (`tsc -b`) and Vite production bundling.
- `npm run test:run` — Complete Vitest test suite.
- `npm run test:e2e` — Playwright acceptance tests.
- **Blob byte assertions require the `node` environment.** Under the default `jsdom` environment a stored `Blob` does not survive `fake-indexeddb`'s structured clone (it reads back as a plain object with no bytes, re-encoding as `[object Object]`), so a byte comparison there is vacuous. A suite that compares stored bytes declares `// @vitest-environment node` and asserts its own environment, so it fails loudly instead of passing silently. Record, filename, index, and reference assertions are fine under `jsdom`.

## Child DOX Index

No child AGENTS.md files — `ai/`, `api/`, `browser/`, `database/`, `importer/`, and `storage/` are boundary subdirectories governed by this document.
