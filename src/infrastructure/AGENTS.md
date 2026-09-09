# src/infrastructure/ — Persistence and API Layer

## Purpose

Persistence, external APIs, extraction engines, and runtime adapters: IndexedDB/Dexie schema and lifecycle, remote Cloudflare Worker API repositories and transports, AI streaming gateway, browser storage/lifecycle providers, import extraction engines, and composite storage repositories satisfying domain ports. Governed by ADR-015 (Boundary-First, Responsibility-Second Organization).

## Ownership

- `database/` — Dexie / IndexedDB persistence engine:
  - `schema/` — Database engine definition, schema history, lifecycle, and migrations:
    - `LunaClairDatabase.ts` → `LunaClairDatabase` (Dexie subclass with typed `Table` properties, singleton `db`)
    - `schema.ts` → Version 1 through 13 schema definitions
    - `DatabaseInitializer.ts` → Startup orchestrator (`db.open()` → `migrateIfNeeded()`, deliberately no seeding)
    - `DatabaseMigrator.ts` → One-time migration of legacy `localStorage` data into IndexedDB
  - `repositories/` — Concrete Dexie persistence adapters implementing domain repository ports:
    - `DexieAiChatRepository.ts` → `AiChatRepository`
    - `DexieAnalyticsRepository.ts` → `AnalyticsRepository`
    - `DexieAnnotationRepository.ts` → `AnnotationRepository`
    - `DexieConflictDraftRepository.ts` → `ConflictDraftRepository`
    - `DexieDocumentContentRepository.ts` → `DocumentContentRepository`
    - `DexieFlashcardReviewRepository.ts` → `FlashcardReviewRepository`
    - `DexieImportAssetRepository.ts` → `ImportAssetRepository`
    - `DexieLibraryRepository.ts` → `LibraryRepository` (normalizes material `tags` through the domain `normalizeTags` helper at both write boundaries — `undefined` leaves tags unchanged, empty array clears)
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
    - `PdfjsImporter.ts` → PDF document extractor via `pdfjs-dist`
    - `ImageImporter.ts` → Image extractor delegating to OCR
  - `engines/` — Raw worker-based processing engines:
    - `TesseractExtractor.ts` → OCR worker pool management via `tesseract.js`
- `ai/` — Worker AI gateway:
  - `adapters/` — Model gateway implementations:
    - `WorkerAiAdapter.ts` → `AiService` (streaming SSE client for `/api/ai/chat`)
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
- **Dependency Injection**: Atomic database services standardize on explicit constructor injection with default singleton fallback (`constructor(db: LunaClairDatabase = defaultDb)`), adhering to TypeScript `erasableSyntaxOnly`.
- **Atomic Dexie Transactions**: Multi-table operations (`DexieQuizEditorService.saveQuiz`, `DexieLibraryImportService`, `runSyncableTransaction`) execute within a single atomic `db.transaction('rw', ...)` scope.
- **No Auto-Hydration**: The app boots with an empty local library; courses are discovered via StudyPackage shares or imported as `.lcpack` bundles and explicitly cloned/imported by user action.

## Work Guidance

- When creating or modifying infrastructure modules, place them into the authorized `<boundary>/<responsibility>/` subdirectory.
- Colocate 1:1 unit tests in `__tests__/` alongside the implementation file.
- Maintain TS `erasableSyntaxOnly` compliance (explicit class member declarations, no parameter properties).

## Verification

- `npm run lint` — Oxlint verification of import boundaries and syntax rules.
- `npm run build` — Full TypeScript (`tsc -b`) and Vite production bundling.
- `npm run test:run` — Complete Vitest test suite.
- `npm run test:e2e` — Playwright acceptance tests.

## Child DOX Index

No child AGENTS.md files — `ai/`, `api/`, `browser/`, `database/`, `importer/`, and `storage/` are boundary subdirectories governed by this document.
